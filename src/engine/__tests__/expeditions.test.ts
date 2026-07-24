import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { MAP_REGIONS } from '../../content/map';
import { regionAt, validMapPoint } from '../map';
import { priceAt, priceOf } from '../economy';
import { advanceExpeditions, dispatchError, dispatchExpedition } from '../expeditions';
import { selectEvents } from '../events/selection';
import { resolveOutgoingRaid, tributeFor } from '../raids';
import { addResidents, freshResidents, residentTotal } from '../residents';
import { Rng } from '../rng';
import { resolveTurn } from '../turn';
import { heroesAtPost } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const DEFS = TEST_CONTENT.locationDefs;

function dispatchCaravan(s: GameState, overrides: Partial<Parameters<typeof dispatchExpedition>[1]> = {}) {
  return dispatchExpedition(
    s,
    {
      kind: 'caravan',
      destination: 'river_meet',
      heroIds: ['p1', 'p2'],
      cargo: { tools: 2, salt: 2 },
      ...overrides,
    },
    DEFS,
  );
}

/** Runs resolveTurn and clears pending events without resolving choices. */
function tick(s: GameState): void {
  resolveTurn(s, TEST_CONTENT);
  s.pendingEvents = [];
  s.phase = 'assignment';
  s.turn += 1;
}

describe('location state', () => {
  it('initializes discovery and markets from defs', () => {
    const s = testState();
    expect(s.locations.post.discovery).toBe('known');
    expect(s.locations.river_meet.discovery).toBe('visited');
    expect(s.locations.black_mere.discovery).toBe('unknown');
    expect(s.locations.river_meet.market).toBeDefined();
    expect(s.locations.old_road.market).toBeUndefined();
    expect(s.locations.post.market).toBeUndefined(); // the post uses GameState.market
  });

  it('applies location price bias', () => {
    const s = testState();
    const furs = TEST_CONTENT.goodDefs.get('furs')!;
    const hillFort = DEFS.get('hill_fort')!;
    // Same drift state at start, so the 0.6 bias must show through.
    expect(priceAt(s, furs, hillFort)).toBeLessThan(priceOf(s, furs));
  });
});

describe('dispatch validation', () => {
  it('rejects bad dispatches with a reason', () => {
    const s = testState();
    expect(dispatchError(s, { kind: 'caravan', destination: 'nowhere', heroIds: ['p1'] }, DEFS)).toBeTruthy();
    expect(dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: [] }, DEFS)).toBeTruthy();
    expect(
      dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1', 'p2', 'p3'] }, DEFS),
    ).toBeTruthy();
    // hill_fort starts rumored: no caravans until visited.
    expect(dispatchError(s, { kind: 'caravan', destination: 'hill_fort', heroIds: ['p1'] }, DEFS)).toBeTruthy();
    // A hidden authored place cannot be targeted by id (free spatial searching can still find it).
    expect(dispatchError(s, { kind: 'explore', destination: 'black_mere', heroIds: ['p1'] }, DEFS)).toBeTruthy();
    // cargo beyond stock or capacity fails.
    expect(
      dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], cargo: { tools: 99 } }, DEFS),
    ).toBeTruthy();
    // valid dispatches pass.
    expect(dispatchError(s, { kind: 'explore', destination: 'hill_fort', heroIds: ['p1'] }, DEFS)).toBeNull();
    expect(dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'] }, DEFS)).toBeNull();
  });

  it('rejects raids against places with no faction or camp to hit', () => {
    const s = testState();
    expect(
      dispatchError(s, { kind: 'raid', destination: 'old_road', heroIds: ['p1'] }, DEFS),
    ).toBeTruthy();
  });

  it('rejects double-booking a hero', () => {
    const s = testState();
    expect(dispatchCaravan(s)).toBe(true);
    expect(dispatchError(s, { kind: 'explore', destination: 'old_road', heroIds: ['p1'] }, DEFS)).toBeTruthy();
  });

  it('rejects duplicate party members and reserve heroes', () => {
    const duplicate = testState();
    expect(
      dispatchError(
        duplicate,
        { kind: 'caravan', destination: 'river_meet', heroIds: ['p1', 'p1'] },
        DEFS,
      ),
    ).toBeTruthy();

    const reserve = testState();
    reserve.activePartyIds = reserve.activePartyIds.filter((id) => id !== 'p1');
    expect(
      dispatchError(
        reserve,
        { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'] },
        DEFS,
      ),
    ).toBeTruthy();
  });

  it('a Dock raises the cargo a caravan can carry', () => {
    const s = testState();
    s.goods.tools = 100;
    expect(
      dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], cargo: { tools: 25 } }, DEFS),
    ).toBeTruthy(); // 1 hero, no escort: cap is 20, short of 25

    s.buildings.push('dock'); // +8 cargo capacity
    expect(
      dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], cargo: { tools: 25 } }, DEFS),
    ).toBeNull();
  });

  it('moves cargo and silver out of the post stock on dispatch', () => {
    const s = testState();
    const toolsBefore = s.goods.tools;
    const silverBefore = s.silver;
    expect(dispatchCaravan(s, { silver: 50 })).toBe(true);
    expect(s.goods.tools).toBe(toolsBefore - 2);
    expect(s.silver).toBe(silverBefore - 50);
    expect(s.expeditions).toHaveLength(1);
    expect(heroesAtPost(s).map((h) => h.id)).not.toContain('p1');
  });
});

describe('expedition lifecycle', () => {
  it('caravan sells at the destination and brings silver home', () => {
    const s = testState(777);
    const silverAfterDispatch = () => s.silver;
    dispatchCaravan(s, { cargo: { tools: 4 } });
    const before = silverAfterDispatch();

    const outboundTurns = s.expeditions[0].turnsLeft;
    const travelTick = () => advanceExpeditions(s, TEST_CONTENT, new Rng(777), () => undefined);
    for (let i = 0; i < outboundTurns; i++) travelTick();
    expect(s.expeditions[0].leg).toBe('returning');
    expect(s.expeditions[0].silver).toBeGreaterThan(0);
    while (s.expeditions.length > 0) travelTick();
    expect(s.expeditions).toHaveLength(0);
    expect(s.silver).toBeGreaterThan(before);
    expect(heroesAtPost(s).map((h) => h.id)).toContain('p1');
  });

  it('explore commits spatial survey and place discovery on homecoming', () => {
    let advanced = 0;
    let mapped = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = testState(seed);
      const before = s.mapKnowledge.surveyedCells.length;
      dispatchExpedition(s, { kind: 'explore', destination: 'old_road', heroIds: ['p1', 'p4'] }, DEFS);
      for (let i = 0; i < 20 && s.expeditions.length > 0; i++) tick(s);
      if (s.locations.old_road.discovery !== 'rumored') advanced++;
      if (s.mapKnowledge.surveyedCells.length > before) mapped++;
    }
    expect(advanced).toBeGreaterThan(0);
    expect(mapped).toBeGreaterThan(0);
  });

  // A guard escort feeds a flat +TUNING.residents.effects.guardEscortBonus
  // into escortMods(), which every arrival check (caravan/explore/diplomacy/
  // invite/concession) folds in — this covers the explore case end to end
  // (dispatch -> escortMods -> resolveCheck -> surveyResult.tier). old_road
  // carries no faction/beastfolk tag, so rollAbductionRisk is a no-op and
  // never perturbs the dice sequence between the two runs, keeping the
  // natural 2d6 roll identical for a given seed — isolating the escort bonus
  // as the only thing that can move the tier.
  it('a guard escort raises the exploration arrival check tier and never lowers it', () => {
    const TIER_RANK: Record<string, number> = { critFailure: 0, failure: 1, success: 2, critSuccess: 3 };
    const trials = 60;
    let strictlyBetter = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const unescorted = testState(seed);
      dispatchExpedition(unescorted, { kind: 'explore', destination: 'old_road', heroIds: ['p1'] }, DEFS);
      const rngUnescorted = new Rng(seed);
      while (!unescorted.expeditions[0]?.surveyResult) {
        advanceExpeditions(unescorted, TEST_CONTENT, rngUnescorted, () => undefined);
      }
      const unescortedTier = unescorted.expeditions[0].surveyResult!.tier;

      const escorted = testState(seed);
      escorted.residents.roles.guards = (escorted.residents.roles.guards ?? 0) + 3;
      dispatchExpedition(
        escorted,
        { kind: 'explore', destination: 'old_road', heroIds: ['p1'], residents: { guards: 3 } },
        DEFS,
      );
      expect(escorted.expeditions[0].residentEscort?.guards).toBe(3);
      const rngEscorted = new Rng(seed);
      while (!escorted.expeditions[0]?.surveyResult) {
        advanceExpeditions(escorted, TEST_CONTENT, rngEscorted, () => undefined);
      }
      const escortedTier = escorted.expeditions[0].surveyResult!.tier;

      expect(TIER_RANK[escortedTier]).toBeGreaterThanOrEqual(TIER_RANK[unescortedTier]);
      if (TIER_RANK[escortedTier] > TIER_RANK[unescortedTier]) strictlyBetter++;
    }
    expect(strictlyBetter).toBeGreaterThan(0);
  });

  it('loses the expedition when the whole party dies en route', () => {
    const s = testState();
    dispatchCaravan(s, { heroIds: ['p1'], cargo: { tools: 3 } });
    const toolsAfterDispatch = s.goods.tools;
    s.heroes.find((h) => h.id === 'p1')!.status = 'dead';
    tick(s);
    expect(s.expeditions).toHaveLength(0);
    expect(s.goods.tools).toBe(toolsAfterDispatch); // cargo lost, not returned
  });

  it('debits resident demographics when an escorted party is lost', () => {
    const s = testState();
    s.residents = freshResidents();
    s.residents.roles.guards = 2;
    s.residents.heritage.homeland = 2;
    s.residents.tags.settlers = 2;
    expect(
      dispatchCaravan(s, {
        heroIds: ['p1'],
        cargo: {},
        residents: { guards: 2 },
      }),
    ).toBe(true);
    s.heroes.find((h) => h.id === 'p1')!.status = 'dead';

    advanceExpeditions(s, TEST_CONTENT, new Rng(1), () => undefined);

    expect(s.expeditions).toHaveLength(0);
    expect(residentTotal(s)).toBe(0);
    expect(s.residents.heritage).toEqual({ homeland: 0, native: 0 });
    expect(s.residents.tags).toEqual({});
  });

  it('can cow a target into paying tribute after a successful raid', () => {
    const s = testState(888);
    addResidents(s, 'guards', 2, undefined, 'homeland');
    const p1 = s.heroes.find((h) => h.id === 'p1')!;
    const p2 = s.heroes.find((h) => h.id === 'p2')!;
    for (const hero of [p1, p2]) {
      hero.skills.combat = 5;
      hero.skills.stealth = 5;
      hero.skills.leadership = 5;
      hero.stats.might = 5;
      hero.stats.agility = 5;
      hero.stats.resolve = 5;
    }
    const companyBefore = s.factions.CHARTER_COMPANY.standing;
    expect(
      dispatchExpedition(
        s,
        {
          kind: 'raid',
          destination: 'river_meet',
          heroIds: ['p1', 'p2'],
          residents: { guards: 2 },
          raidGoal: 'cow',
          raidManeuver: 'skirmish',
          raidRally: true,
          raidAlly: 'CHARTER_COMPANY',
        },
        DEFS,
      ),
    ).toBe(true);
    expect(s.factions.CHARTER_COMPANY.standing).toBe(
      companyBefore - TUNING.raid.allyStandingCost,
    );

    const tick = () => advanceExpeditions(s, TEST_CONTENT, new Rng(3), () => undefined);
    while (s.expeditions.length > 0 && s.expeditions[0].leg === 'outbound' && !s.pendingRaid) tick();

    expect(s.pendingRaid?.kind).toBe('outgoing');
    const pending = s.pendingRaid;
    if (!pending || pending.kind !== 'outgoing') throw new Error('Expected an outgoing raid encounter.');

    const resolution = resolveOutgoingRaid(
      s,
      pending,
      { goal: 'cow', maneuver: 'skirmish', rally: true },
      new Rng(4),
      {
        goodDefs: TEST_CONTENT.goodDefs,
        goodNames: TEST_CONTENT.goodNames,
        buildingNames: TEST_CONTENT.buildingNames,
      },
    );

    expect(resolution.direction).toBe('outgoing');
    expect(tributeFor(s, 'RIVER_CLANS')?.direction).toBe('receive');
    expect(s.expeditions[0].silver).toBeGreaterThan(0);
    expect(s.expeditions[0].leg).toBe('returning');

    while (s.expeditions.length > 0) tick();

    expect(s.expeditions).toHaveLength(0);
    expect(s.silver).toBeGreaterThan(0);
  });
});

describe('travel events', () => {
  it('only binds heroes from the travelling party', () => {
    let travelSeen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = testState(seed);
      expect(dispatchCaravan(s, { cargo: { tools: 3, salt: 3 } })).toBe(true);
      const selected = selectEvents(s, TEST_CONTENT.events, DEFS, new Rng(seed));
      for (const active of selected) {
        const event = TEST_CONTENT.events.get(active.eventId)!;
        if (event.category === 'travel') {
          travelSeen++;
          expect(active.expeditionId).toBe(s.expeditions[0].id);
          expect(['p1', 'p2']).toContain(active.heroId);
        } else {
          expect(['p1', 'p2']).not.toContain(active.heroId);
        }
      }
    }
    expect(travelSeen).toBeGreaterThan(0);
  });

  it('never fires travel events with no expedition out', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = testState(seed);
      const selected = selectEvents(s, TEST_CONTENT.events, DEFS, new Rng(seed));
      for (const active of selected) {
        expect(TEST_CONTENT.events.get(active.eventId)!.category).not.toBe('travel');
      }
    }
  });
});

describe('tuning sanity', () => {
  it('home location id exists in content', () => {
    expect(DEFS.has(TUNING.map.homeLocationId)).toBe(true);
  });

  it('all locations have valid points in their declared map region', () => {
    for (const def of DEFS.values()) {
      expect(validMapPoint(def.mapPoint), `${def.id} has an invalid map point`).toBe(true);
      expect(regionAt(def.mapPoint, MAP_REGIONS)?.id).toBe(def.mapRegion);
    }
  });
});
