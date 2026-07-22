// Beastfolk — Orcs & Goblins (BEASTFOLK_SPEC.md). Taxonomy additions to the
// existing generic machinery: new Heritage values (native group), a new
// faction with no seat, resident-tally reuse, family-graph reuse, and the
// v9→v10 migration backfilling BEASTFOLK standing.

import { describe, expect, it } from 'vitest';
import { LOCATIONS } from '../../content/locations';
import { addChild, formUnion, isMixed, nodePeoples } from '../family';
import { addResidents, residentTotal } from '../residents';
import { Rng } from '../rng';
import { migrate } from '../save';
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

  it('a mixed human×orc child descends from both peoples (childAncestry generalizes for free)', () => {
    const s = testState(); // p1 is Imanian
    formUnion(s, 'p1', { source: 'alliance', heritage: 'orc', name: 'Agra' });
    const rng = new Rng(3);
    const child = addChild(s, 'p1', {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      rand: () => rng.next(),
    });
    expect(child).not.toBeNull();
    expect(new Set(nodePeoples(child!))).toEqual(new Set(['imanian', 'orc']));
    expect(isMixed(child!)).toBe(true);
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
    expect(migrated.saveVersion).toBe(20); // migrate() chains all the way to current
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
