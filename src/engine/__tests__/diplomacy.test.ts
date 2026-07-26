import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { LOCATION_DEFS } from '../../content/locations';
import { advanceExpeditions, dispatchExpedition } from '../expeditions';
import { applyDiplomacyShift, isFactionKnown, isFirstContact, reconcileFactionsKnown } from '../diplomacy';
import { evalCondition } from '../events/conditions';
import type { GameEvent } from '../events/types';
import { Rng } from '../rng';
import { thrallTotal } from '../thralls';
import { resolveChoice, resolveTurn } from '../turn';
import { TEST_CONTENT, testState, TEST_LOCATIONS } from './helpers';

const noop = () => undefined;

describe('diplomacy seats', () => {
  it('seeds per-community diplomacy state from starting faction standings', () => {
    const state = testState(700);
    expect(state.diplomacySeats.river_meet.faction).toBe('RIVER_CLANS');
    expect(state.diplomacySeats.river_meet.standing).toBe(state.factions.RIVER_CLANS.standing);
    expect(state.diplomacySeats.charter_landing.standing).toBe(state.factions.CHARTER_COMPANY.standing);
    expect(state.diplomacySeats.pemba_jasiri.pact).toBe('none');
  });

  it('applies seat shifts with sibling spillover and faction sentiment drift', () => {
    const state = testState(701);
    const beforeFaction = state.factions.HILL_TRIBES.standing;
    const beforeSeat = state.diplomacySeats.hill_fort.standing;
    const beforeSibling = state.diplomacySeats.blackstone_plateau.standing;

    applyDiplomacyShift(state, LOCATION_DEFS, 'hill_fort', 4, 1);

    expect(state.diplomacySeats.hill_fort.standing).toBe(beforeSeat + 4);
    expect(state.diplomacySeats.hill_fort.grievances).toBe(1);
    expect(state.diplomacySeats.blackstone_plateau.standing).toBe(beforeSibling + 1);
    expect(state.diplomacySeats.redsand_range.standing).toBe(beforeSibling + 1);
    expect(state.factions.HILL_TRIBES.standing).toBe(beforeFaction + 2);
  });
});

describe('faction discovery (TERRITORY_DISCOVERY_SPEC.md §5)', () => {
  it('a seatless faction stays unknown until its discovery node is visited', () => {
    const s = testState();
    // The Beastfolk camps start only 'rumored', so the post hasn't met them.
    expect(isFactionKnown(s, 'BEASTFOLK')).toBe(false);

    s.locations.beast_wilds.discovery = 'visited';
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    expect(isFactionKnown(s, 'BEASTFOLK')).toBe(true);
  });

  it('discovery is monotonic and never double-lists a faction', () => {
    const s = testState();
    s.locations.goblin_wilds.discovery = 'visited';
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    expect(s.factionsKnown.filter((f) => f === 'BEASTFOLK')).toHaveLength(1);
  });

  it('a seated faction becomes known once one of its seats is visited', () => {
    const s = testState();
    const faction = LOCATION_DEFS.get('river_meet')!.faction!;
    // Hide every seat of this faction so the before-state is a clean unknown.
    for (const def of TEST_LOCATIONS) {
      if (def.faction === faction && s.locations[def.id]) {
        s.locations[def.id].discovery = 'rumored';
      }
    }
    s.factionsKnown = s.factionsKnown.filter((f) => f !== faction);
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    expect(isFactionKnown(s, faction)).toBe(false);

    s.locations.river_meet.discovery = 'visited';
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    expect(isFactionKnown(s, faction)).toBe(true);
  });

  it('the factionKnown / factionUnknown conditions read the discovery state', () => {
    const s = testState();
    expect(evalCondition(s, { type: 'factionUnknown', faction: 'BEASTFOLK' })).toBe(true);
    expect(evalCondition(s, { type: 'factionKnown', faction: 'BEASTFOLK' })).toBe(false);

    s.locations.beast_wilds.discovery = 'visited';
    reconcileFactionsKnown(s, TEST_LOCATIONS);
    expect(evalCondition(s, { type: 'factionKnown', faction: 'BEASTFOLK' })).toBe(true);
    expect(evalCondition(s, { type: 'factionUnknown', faction: 'BEASTFOLK' })).toBe(false);
  });

  it('resolveTurn reconciles newly-discovered factions', () => {
    const s = testState();
    expect(isFactionKnown(s, 'BEASTFOLK')).toBe(false);
    // A camp reached 'visited' this turn (e.g. via a homecoming); resolveTurn's
    // reconcile pass should register the contact.
    s.locations.beast_wilds.discovery = 'visited';
    resolveTurn(s, TEST_CONTENT);
    expect(isFactionKnown(s, 'BEASTFOLK')).toBe(true);
  });
});

describe('first contact', () => {
  it('isFirstContact is true only for a community newly reached from unknown/rumored', () => {
    const hillFort = LOCATION_DEFS.get('hill_fort')!;
    const riverMeet = LOCATION_DEFS.get('river_meet')!;
    const oldRoad = LOCATION_DEFS.get('old_road')!;
    const umojaNjema = LOCATION_DEFS.get('drowned_ruins')!;
    expect(isFirstContact(hillFort, 'rumored')).toBe(true);
    expect(isFirstContact(hillFort, 'unknown')).toBe(true);
    expect(isFirstContact(hillFort, 'visited')).toBe(false);
    expect(isFirstContact(riverMeet, 'rumored')).toBe(true);
    expect(isFirstContact(oldRoad, 'rumored')).toBe(false); // no market: not a community
    // Umoja-Njema has no faction but is still a market community — fires first
    // contact even though the resulting event can't move any seat standing.
    expect(isFirstContact(umojaNjema, 'rumored')).toBe(true);
    expect(isFirstContact(umojaNjema, 'unknown')).toBe(true);
    expect(isFirstContact(umojaNjema, 'visited')).toBe(false);
  });

  it('queues the first-contact event when an explore party reaches an uncontacted seat', () => {
    const state = testState(703);
    expect(state.locations.hill_fort.discovery).toBe('rumored');
    // hill_fort sits in the checkpoint-gated western_interior region; unlock it first.
    state.locations.old_road.discovery = 'visited';
    expect(
      dispatchExpedition(
        state,
        { kind: 'explore', destination: 'hill_fort', heroIds: ['p1'] },
        LOCATION_DEFS,
      ),
    ).toBe(true);
    while (state.expeditions.length > 0) advanceExpeditions(state, TEST_CONTENT, new Rng(11), noop);
    expect(state.locations.hill_fort.discovery).toBe('visited');
    const queued = state.queuedEvents.find((q) => q.locationId === 'hill_fort');
    expect(queued).toBeDefined();
    expect(queued!.eventId).toBe(TUNING.diplomacy.firstContactEventId);
    expect(queued!.heroId).toBe('p1');
    expect(queued!.fireOnTurn).toBe(state.turn);
  });

  it('does not queue first contact for a seat already visited/known', () => {
    const state = testState(704);
    expect(state.locations.river_meet.discovery).toBe('visited');
    dispatchExpedition(
      state,
      { kind: 'explore', destination: 'river_meet', heroIds: ['p1'] },
      LOCATION_DEFS,
    );
    while (state.expeditions.length > 0) advanceExpeditions(state, TEST_CONTENT, new Rng(12), noop);
    expect(state.queuedEvents.some((q) => q.locationId === 'river_meet')).toBe(false);
  });

  it('a thralls-purchase envoy only seats thralls on homecoming, not at arrival', () => {
    const state = testState(706);
    const hero = state.heroes.find((h) => h.id === 'p1')!;
    hero.skills.diplomacy = 5;
    hero.stats.charm = 5;
    hero.stats.wits = 5;
    expect(
      dispatchExpedition(
        state,
        {
          kind: 'diplomacy',
          destination: 'river_meet',
          heroIds: ['p1'],
          diplomacyMission: { type: 'thralls' },
          thrallPurchaseCount: 6,
        },
        LOCATION_DEFS,
      ),
    ).toBe(true);

    const rng = new Rng(13);
    // Advance exactly to arrival (outbound leg completes) without crossing
    // all the way to homecoming, so we can inspect the in-transit state.
    while (state.expeditions[0]?.leg === 'outbound') {
      advanceExpeditions(state, TEST_CONTENT, rng, noop);
    }
    const acquired = state.expeditions[0]?.thrallsCaptured ?? 0;
    expect(acquired).toBeGreaterThan(0);
    expect(thrallTotal(state)).toBe(0);

    while (state.expeditions.length > 0) advanceExpeditions(state, TEST_CONTENT, rng, noop);
    expect(thrallTotal(state)).toBe(acquired);
  });

  it('resolveChoice threads a locationId into community outcomes with no explicit location', () => {
    const state = testState(705);
    const before = state.diplomacySeats.hill_fort.standing;
    const event: GameEvent = {
      id: 'test_first_contact_stub',
      category: 'chain',
      illustration: 'x',
      title: 'Test',
      text: 'Test.',
      conditions: [],
      weight: 0,
      choices: [
        {
          label: 'Wave hello',
          outcomes: { success: { text: 'Waved.', outcomes: [{ type: 'communityStanding', delta: 4 }] } },
        },
      ],
    };
    const resolution = resolveChoice(state, TEST_CONTENT, event, 0, 'p1', undefined, 'hill_fort');
    expect(resolution.tier).toBe('success');
    expect(state.diplomacySeats.hill_fort.standing).toBe(before + 4);
  });
});
