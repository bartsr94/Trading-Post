// Beastfolk — Orcs & Goblins (BEASTFOLK_SPEC.md). Taxonomy additions to the
// existing generic machinery: new Heritage values (native group), a new
// faction with no seat, resident-tally reuse, family-graph reuse, and the
// v9→v10 migration backfilling BEASTFOLK standing.

import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../../content/locations';
import { addChild, formUnion, isMixed, nodePeoples } from '../family';
import { isEligible } from '../events/selection';
import { addResidents, residentTotal } from '../residents';
import { Rng } from '../rng';
import { migrate } from '../save';
import { advancePendingEvent, resolveChoice } from '../turn';
import {
  defaultSubPeople,
  getHero,
  heritageGroup,
  isNativeHeritage,
  stanceOf,
} from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

describe('Beastfolk taxonomy', () => {
  it('orc and goblin are native-group heritages', () => {
    expect(heritageGroup('orc')).toBe('native');
    expect(heritageGroup('goblin')).toBe('native');
    expect(isNativeHeritage('orc')).toBe(true);
    expect(isNativeHeritage('goblin')).toBe(true);
  });

  it('default sub-peoples resolve to themselves (no sub-tribes yet)', () => {
    expect(defaultSubPeople('orc')).toBe('orc');
    expect(defaultSubPeople('goblin')).toBe('goblin');
  });

  it('the BEASTFOLK faction exists on a fresh game with no map seat', () => {
    const s = testState();
    expect(s.factions.BEASTFOLK).toBeDefined();
    expect(stanceOf(s.factions.BEASTFOLK.standing)).toBe('Hostile');
    const beastfolkLocations = LOCATIONS.filter((l) => l.faction === 'BEASTFOLK');
    expect(beastfolkLocations).toHaveLength(0);
  });

  it('the Gnawback Camp is discoverable wilds content, not a diplomacy seat', () => {
    const camp = LOCATIONS.find((l) => l.id === 'beast_wilds');
    expect(camp).toBeDefined();
    expect(camp!.faction).toBeUndefined();
    expect(camp!.tags).toContain('beastfolk');
  });
});

describe('Beastfolk residents', () => {
  it('settling residents land in the native tally bucket via the existing invariant', () => {
    const s = testState();
    const before = s.residents.heritage.native;
    // Tagged by specific people ('orc'/'goblin'), same convention as a
    // Kiswani/Hanjoda hire — not a generic undifferentiated 'beastfolk' tag.
    const added = addResidents(s, 'guards', 3, 'orc', 'native');
    expect(added).toBeGreaterThan(0);
    expect(s.residents.heritage.native).toBe(before + added);
    expect(s.residents.heritage.homeland + s.residents.heritage.native).toBe(residentTotal(s));
    expect(s.residents.tags.orc).toBe(added);
  });

  it('the settlement event tags orcs and goblins separately, not as one undifferentiated group', () => {
    const s = testState();
    addResidents(s, 'guards', 2, 'orc', 'native');
    addResidents(s, 'guards', 1, 'goblin', 'native');
    expect(s.residents.tags.orc).toBe(2);
    expect(s.residents.tags.goblin).toBe(1);
  });
});

describe('Beastfolk unions — reuses formUnion/Ancestry/bloodline as-is', () => {
  it('an orc alliance union reads as a mixed line, no engine changes needed', () => {
    const s = testState();
    const spouse = formUnion(s, 'p1', { source: 'alliance', heritage: 'orc', name: 'Agra' });
    expect(spouse).not.toBeNull();
    expect(spouse!.heritage).toBe('orc');
    expect(getHero(s, 'p1').bloodline).toBe('mixed');
  });

  it('a goblin alliance union works the same way', () => {
    const s = testState();
    const spouse = formUnion(s, 'p1', { source: 'alliance', heritage: 'goblin', name: 'Nettla' });
    expect(spouse).not.toBeNull();
    expect(spouse!.heritage).toBe('goblin');
    expect(getHero(s, 'p1').bloodline).toBe('mixed');
  });

  it('a human×orc child is always female and pure orc — orcs never hybridize', () => {
    const s = testState(); // p1 is Imanian
    formUnion(s, 'p1', { source: 'alliance', heritage: 'orc', name: 'Agra' });
    const rng = new Rng(3);
    const child = addChild(s, 'p1', {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      rand: () => rng.next(),
    });
    expect(child).not.toBeNull();
    expect(nodePeoples(child!)).toEqual(['orc']);
    expect(isMixed(child!)).toBe(false);
    expect(child!.gender).toBe('female');
  });

  it('a human×goblin child is always female and pure goblin, even across many rolls', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'alliance', heritage: 'goblin', name: 'Nettla' });
    const rng = new Rng(11);
    for (let i = 0; i < 20; i++) {
      const child = addChild(s, 'p1', {
        nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
        rand: () => rng.next(),
      });
      expect(child).not.toBeNull();
      expect(nodePeoples(child!)).toEqual(['goblin']);
      expect(child!.gender).toBe('female');
    }
  });
});

describe('the beastfolk match events require a male hero', () => {
  it('an unmarried female hero is not eligible for either match event', () => {
    const s = testState();
    s.locations.beast_wilds.discovery = 'visited';
    s.factions.BEASTFOLK.standing = 50;
    for (const hero of s.heroes) hero.gender = 'female';
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_orc_match')!)).toBe(false);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_goblin_match')!)).toBe(false);
  });

  it('an unmarried male hero is still eligible', () => {
    const s = testState();
    s.locations.beast_wilds.discovery = 'visited';
    s.factions.BEASTFOLK.standing = 50;
    getHero(s, 'p1').gender = 'male';
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_orc_match')!)).toBe(true);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_goblin_match')!)).toBe(true);
  });
});

describe('save migration v9 -> v10', () => {
  it('backfills a missing BEASTFOLK standing on an old save', () => {
    const s = testState();
    const preV10 = structuredClone(s) as GameState;
    preV10.saveVersion = 9;
    // Simulate a genuinely pre-v10 save: no BEASTFOLK key at all.
    const factions = { ...preV10.factions } as Record<string, unknown>;
    delete factions.BEASTFOLK;
    preV10.factions = factions as GameState['factions'];

    const migrated = migrate(preV10);
    expect(migrated.saveVersion).toBe(23); // migrate() chains all the way to current
    expect(migrated.factions.BEASTFOLK).toBeDefined();
    expect(migrated.factions.BEASTFOLK.standing).toBe(-60);
  });

  it('leaves an already-present BEASTFOLK standing untouched', () => {
    const s = testState();
    const preV10 = structuredClone(s) as GameState;
    preV10.saveVersion = 9;
    preV10.factions.BEASTFOLK = { standing: 12 };

    const migrated = migrate(preV10);
    expect(migrated.factions.BEASTFOLK.standing).toBe(12);
  });
});

// CHAIN_EVENTS_SPEC.md §2: all 5 pre-existing events used to gate on
// BEASTFOLK standing alone, so they could in principle fire before the
// player had ever found the Gnawback Camp. Confirms the discovery gate
// added to each is load-bearing, not decorative.
describe('Beastfolk discovery gating', () => {
  it('tribute events are ineligible before beast_wilds is discovered, even though starting standing already qualifies', () => {
    const s = testState();
    expect(s.locations.beast_wilds.discovery).toBe('rumored');
    expect(s.factions.BEASTFOLK.standing).toBeLessThanOrEqual(-20);

    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_orc_tribute')!)).toBe(false);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_goblin_tribute')!)).toBe(false);

    s.locations.beast_wilds.discovery = 'visited';
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_orc_tribute')!)).toBe(true);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_goblin_tribute')!)).toBe(true);
  });

  it('match and settlement events are ineligible before discovery, even once standing qualifies', () => {
    const s = testState();
    s.factions.BEASTFOLK.standing = 50;
    expect(s.locations.beast_wilds.discovery).toBe('rumored');

    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_orc_match')!)).toBe(false);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_goblin_match')!)).toBe(false);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_settlement')!)).toBe(false);

    s.locations.beast_wilds.discovery = 'visited';
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_orc_match')!)).toBe(true);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_goblin_match')!)).toBe(true);
    expect(isEligible(s, TEST_CONTENT.events.get('beastfolk_settlement')!)).toBe(true);
  });
});

// CHAIN_EVENTS_SPEC.md §5: the showcase same-sitting chain. Walks the whole
// "speak first" branch to prove continueChain/setChainVar/chainVar work end
// to end through the real content, then confirms the "withdraw" choice is a
// legitimate short ending with no continuation at all.
describe('"A Patrol at the Treeline" chain', () => {
  function readyState() {
    const s = testState();
    s.locations.beast_wilds.discovery = 'visited';
    return s;
  }

  it('is eligible only once beast_wilds is discovered', () => {
    const s = testState();
    const entry = TEST_CONTENT.events.get('beastfolk_first_encounter')!;
    expect(isEligible(s, entry)).toBe(false);
    s.locations.beast_wilds.discovery = 'visited';
    expect(isEligible(s, entry)).toBe(true);
  });

  it('walks the speak-first branch through all three stages to a standing/tribute payoff', () => {
    const s = readyState();
    const entry = TEST_CONTENT.events.get('beastfolk_first_encounter')!;
    s.pendingEvents = [{ eventId: entry.id, heroId: 'p1' }];
    for (const hero of s.heroes) hero.stats.charm = 10;

    // Mirrors the real flow: EventPanel always resolves pendingEvents[0], and
    // the player clicking "Continue" (advancePendingEvent) removes it before
    // the next stage is ever resolved.
    resolveChoice(s, TEST_CONTENT, entry, 0, 'p1');
    expect(s.pendingEvents).toHaveLength(2);
    advancePendingEvent(s);
    const stage2 = s.pendingEvents[0];
    expect(stage2.eventId).toBe('beastfolk_first_encounter_talks');
    expect(stage2.vars?.approach).toBe('peace');

    const talks = TEST_CONTENT.events.get('beastfolk_first_encounter_talks')!;
    resolveChoice(s, TEST_CONTENT, talks, 0, stage2.heroId, undefined, stage2.locationId);
    advancePendingEvent(s);
    const stage3 = s.pendingEvents[0];
    expect(stage3.eventId).toBe('beastfolk_first_encounter_close');
    expect(stage3.vars?.outcome).toBe('alliance');

    const before = s.factions.BEASTFOLK.standing;
    const close = TEST_CONTENT.events.get('beastfolk_first_encounter_close')!;
    resolveChoice(s, TEST_CONTENT, close, 0, stage3.heroId, undefined, stage3.locationId);
    expect(s.factions.BEASTFOLK.standing).toBe(before + 6);
    expect(s.tributes.some((t) => t.faction === 'BEASTFOLK' && t.direction === 'receive')).toBe(true);
  });

  it('the withdraw choice ends the encounter without spawning a continuation', () => {
    const s = readyState();
    const entry = TEST_CONTENT.events.get('beastfolk_first_encounter')!;
    s.pendingEvents = [{ eventId: entry.id, heroId: 'p1' }];

    resolveChoice(s, TEST_CONTENT, entry, 2, 'p1');
    expect(s.pendingEvents).toHaveLength(1);
  });
});
