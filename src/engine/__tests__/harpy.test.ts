import { describe, expect, it } from 'vitest';
import { LOCATION_DEFS } from '../../content/locations';
import { MAP_FEATURES, MAP_REGIONS } from '../../content/map';
import { isFactionKnown, reconcileFactionsKnown } from '../diplomacy';
import { evalConditions } from '../events/conditions';
import type { TravelContext } from '../events/types';
import { isEligible } from '../events/selection';
import { spousesOf, nodePeoples } from '../family';
import { tagsAt } from '../map';
import { frictionFor } from '../residents';
import { getHero, heritageGroup, isNativeHeritage } from '../types';
import { advancePendingEvent, resolveChoice } from '../turn';
import { TEST_CONTENT, TEST_LOCATIONS, testState } from './helpers';

/** A state with the Windward Crags discovered and HARPY at `standing`. */
function cr(standing: number) {
  const s = testState();
  s.locations.harpy_eyrie.discovery = 'visited';
  s.factions.HARPY.standing = standing;
  return s;
}

describe('Harpies (TERRITORY_DISCOVERY_SPEC.md §6)', () => {
  it('harpy is a native-group heritage', () => {
    expect(heritageGroup('harpy')).toBe('native');
    expect(isNativeHeritage('harpy')).toBe(true);
  });

  it('the Windward Crags sit in harpy territory', () => {
    const eyrie = LOCATION_DEFS.get('harpy_eyrie')!;
    expect(tagsAt(eyrie.mapPoint, MAP_REGIONS, MAP_FEATURES)).toContain('harpy');
  });

  it('HARPY is a seatless faction, unknown until the eyrie is found', () => {
    const s = testState();
    // The eyrie starts 'unknown' — the crags haven't been contacted.
    expect(isFactionKnown(s, 'HARPY')).toBe(false);

    s.locations.harpy_eyrie.discovery = 'visited';
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    expect(isFactionKnown(s, 'HARPY')).toBe(true);
  });

  it('harpy tribute only becomes eligible once the crags are discovered', () => {
    const s = testState();
    s.factions.HARPY.standing = -60; // hostile, as they start
    const tribute = TEST_CONTENT.events.get('harpy_tribute')!;
    expect(isEligible(s, tribute)).toBe(false); // eyrie still unknown

    s.locations.harpy_eyrie.discovery = 'visited';
    expect(isEligible(s, tribute)).toBe(true);
  });

  it('the match event weds a harpy into the household and marks the trait', () => {
    const s = cr(20);
    getHero(s, 'p1').gender = 'male';
    const event = TEST_CONTENT.events.get('harpy_match')!;
    expect(isEligible(s, event)).toBe(true);

    const standingBefore = s.factions.HARPY.standing;
    resolveChoice(s, TEST_CONTENT, event, 0, 'p1');
    const spouses = spousesOf(s, 'p1');
    expect(spouses.length).toBe(1);
    expect(nodePeoples(spouses[0])).toContain('harpy');
    expect(getHero(s, 'p1').traits).toContain('wed_harpy');
    expect(s.factions.HARPY.standing).toBeGreaterThan(standingBefore);
  });

  it('the settlement event seats harpy watch/hunters and opens integration friction', () => {
    const s = cr(30);
    const guardsBefore = s.residents.roles.guards;
    const huntersBefore = s.residents.roles.hunters;
    const event = TEST_CONTENT.events.get('harpy_settlement')!;
    expect(isEligible(s, event)).toBe(true);

    resolveChoice(s, TEST_CONTENT, event, 0, 'p1');
    expect(s.residents.roles.guards).toBe(guardsBefore + 2);
    expect(s.residents.roles.hunters).toBe(huntersBefore + 1);
    expect(s.residents.tags.harpy).toBe(3);
    expect(frictionFor(s, 'harpy')).toBe(7);
  });

  it('the integration-settled event only fires once friction has cooled', () => {
    const s = cr(30);
    s.residents.tags.harpy = 3;
    const settled = TEST_CONTENT.events.get('harpy_integration_settled')!;
    s.residents.friction = { harpy: 5 };
    expect(isEligible(s, settled)).toBe(false);
    s.residents.friction = { harpy: 1 };
    expect(isEligible(s, settled)).toBe(true);
  });

  // "Wings Against the Wind" (WILDS_FIRST_ENCOUNTER_SPEC.md) — directly
  // queued via harpy_eyrie's LocationDef.discoveryEventId, not drawn from
  // the weighted pool. See beastfolk.test.ts's "A Patrol at the Treeline"
  // block for the generic dispatch-level wiring test; this covers the
  // harpy-specific content and its own chain.
  it('harpy_eyrie carries the discoveryEventId wiring the discovery-moment chain', () => {
    const eyrie = LOCATION_DEFS.get('harpy_eyrie')!;
    expect(eyrie.discoveryEventId).toBe('harpy_first_encounter');
  });

  it('is never eligible via the weighted pool, discovered or not', () => {
    const s = testState();
    const entry = TEST_CONTENT.events.get('harpy_first_encounter')!;
    expect(isEligible(s, entry)).toBe(false);
    s.locations.harpy_eyrie.discovery = 'visited';
    expect(isEligible(s, entry)).toBe(false);
  });

  it('walks the speak-first branch through all three stages to a standing/tribute payoff', () => {
    const s = cr(0);
    const entry = TEST_CONTENT.events.get('harpy_first_encounter')!;
    s.pendingEvents = [{ eventId: entry.id, heroId: 'p1' }];
    for (const hero of s.heroes) hero.stats.charm = 10;

    resolveChoice(s, TEST_CONTENT, entry, 0, 'p1');
    expect(s.pendingEvents).toHaveLength(2);
    advancePendingEvent(s);
    const stage2 = s.pendingEvents[0];
    expect(stage2.eventId).toBe('harpy_first_encounter_talks');
    expect(stage2.vars?.approach).toBe('peace');

    const talks = TEST_CONTENT.events.get('harpy_first_encounter_talks')!;
    resolveChoice(s, TEST_CONTENT, talks, 0, stage2.heroId, undefined, stage2.locationId);
    advancePendingEvent(s);
    const stage3 = s.pendingEvents[0];
    expect(stage3.eventId).toBe('harpy_first_encounter_close');
    expect(stage3.vars?.outcome).toBe('alliance');

    const before = s.factions.HARPY.standing;
    const close = TEST_CONTENT.events.get('harpy_first_encounter_close')!;
    resolveChoice(s, TEST_CONTENT, close, 0, stage3.heroId, undefined, stage3.locationId);
    expect(s.factions.HARPY.standing).toBe(before + 6);
    expect(s.tributes.some((t) => t.faction === 'HARPY' && t.direction === 'receive')).toBe(true);
  });

  it('the withdraw choice ends the encounter without spawning a continuation', () => {
    const s = cr(0);
    const entry = TEST_CONTENT.events.get('harpy_first_encounter')!;
    s.pendingEvents = [{ eventId: entry.id, heroId: 'p1' }];

    resolveChoice(s, TEST_CONTENT, entry, 2, 'p1');
    expect(s.pendingEvents).toHaveLength(1);
  });

  it('the sky-toll travel event gates on being in harpy country', () => {
    const s = testState();
    const toll = TEST_CONTENT.events.get('travel_harpy_toll')!;
    const inHarpyCountry: TravelContext = {
      expedition: s.expeditions[0] ?? ({ kind: 'explore', leg: 'outbound', cargo: {} } as never),
      destination: { point: { x: 0.21, y: 0.08 }, name: 'the crags', tags: ['harpy', 'wilds'] },
      paceCheckModifier: 0,
    };
    const elsewhere: TravelContext = {
      ...inHarpyCountry,
      destination: { point: { x: 0.7, y: 0.4 }, name: 'the river', tags: ['river'] },
    };
    expect(evalConditions(s, toll.conditions, { travel: inHarpyCountry })).toBe(true);
    expect(evalConditions(s, toll.conditions, { travel: elsewhere })).toBe(false);
  });
});
