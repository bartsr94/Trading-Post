// Heritage & the cultural character of the post (HERITAGE_SPEC.md Phase A):
// the culture axis, the resident heritage tally, per-neighbor native hiring,
// the Thornwatch labor expedition, culture drift, and the new event vocabulary.

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import {
  advanceExpeditions,
  dispatchError,
  dispatchExpedition,
  laborRunCost,
} from '../expeditions';
import type { ExpeditionContext } from '../expeditions';
import {
  addResidents,
  applyCultureDrift,
  applyDesertion,
  hireError,
  hireResidents,
  loseResidents,
  localHireCost,
  nativeShare,
  reallocate,
  residentTotal,
} from '../residents';
import { Rng } from '../rng';
import { partyHeritageShare } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const noop = () => {};

/** The heritage tally must always sum to the number of heads the post feeds. */
function expectTallyInvariant(s: GameState): void {
  const h = s.residents.heritage;
  expect(h.homeland + h.native).toBe(residentTotal(s));
}

function outcomeCtx(state: GameState): OutcomeContext {
  return {
    heroId: state.heroes[0].id,
    goodNames: new Map(),
    factionNames: new Map(),
    traitNames: new Map(),
    locationNames: new Map(),
    buildingNames: new Map(),
  };
}

/** Runs expeditions to completion (both legs), returning turns elapsed. */
function runToHomecoming(s: GameState, ctx: ExpeditionContext): number {
  let turns = 0;
  const rng = new Rng(1);
  while (s.expeditions.length > 0 && turns < 40) {
    advanceExpeditions(s, ctx, rng, noop);
    turns += 1;
  }
  return turns;
}

describe('the heritage tally', () => {
  it('starts empty and stays summed-equal to the pool', () => {
    const s = testState();
    expect(s.residents.heritage).toEqual({ homeland: 0, native: 0 });
    expect(nativeShare(s)).toBe(0);
    expectTallyInvariant(s);
  });

  it('records origin on add and debits proportionally on loss', () => {
    const s = testState();
    s.buildings = ['common_house']; // cap 4 + 4 = 8
    addResidents(s, 'farmers', 4, 'settlers', 'homeland');
    addResidents(s, 'guards', 4, 'kiswani', 'native');
    expect(s.residents.heritage).toEqual({ homeland: 4, native: 4 });
    expectTallyInvariant(s);
    expect(nativeShare(s)).toBe(0.5);

    // Proportional loss (50/50) removes evenly.
    loseResidents(s, undefined, 4);
    expectTallyInvariant(s);
    expect(s.residents.heritage.homeland).toBe(2);
    expect(s.residents.heritage.native).toBe(2);
  });

  it('can bias loss to a group', () => {
    const s = testState();
    s.buildings = ['common_house'];
    addResidents(s, 'farmers', 3, 'settlers', 'homeland');
    addResidents(s, 'guards', 3, 'kiswani', 'native');
    loseResidents(s, undefined, 3, 'native');
    expect(s.residents.heritage.native).toBe(0);
    expect(s.residents.heritage.homeland).toBe(3);
    expectTallyInvariant(s);
  });

  it('reallocation never changes the tally; escorts stay counted while away', () => {
    const s = testState();
    s.buildings = ['common_house'];
    addResidents(s, 'guards', 2, 'kiswani', 'native');
    addResidents(s, 'porters', 2, 'settlers', 'homeland');
    const before = { ...s.residents.heritage };

    reallocate(s, 'guards', 'idle', 1);
    expect(s.residents.heritage).toEqual(before);
    expectTallyInvariant(s);

    // Second a porter onto a caravan — still ours, still on the tally.
    dispatchExpedition(
      s,
      { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], residents: { porters: 1 } },
      TEST_CONTENT.locationDefs,
    );
    expect(s.residents.heritage).toEqual(before);
    expectTallyInvariant(s);

    runToHomecoming(s, TEST_CONTENT);
    expect(s.residents.heritage).toEqual(before);
    expectTallyInvariant(s);
  });

  it('desertion debits the tally', () => {
    const s = testState();
    s.buildings = ['common_house'];
    addResidents(s, 'farmers', 4, 'settlers', 'homeland');
    addResidents(s, 'guards', 0, undefined, 'native');
    s.residents.contentment = 0; // force unrest
    const lost = applyDesertion(s);
    expect(lost).toBeGreaterThan(0);
    expectTallyInvariant(s);
  });
});

describe('local (native) hiring', () => {
  it('is gated on reaching the people and their goodwill', () => {
    const s = testState();
    // Unreached seat.
    s.locations.hill_fort.discovery = 'rumored';
    expect(hireError(s, 'farmers', 1, 'dustwalker')).toMatch(/reached their people/);

    // Reached but hostile.
    s.locations.hill_fort.discovery = 'visited';
    s.factions.HILL_TRIBES.standing = -60;
    expect(hireError(s, 'farmers', 1, 'dustwalker')).toMatch(/will not send/);

    // Reached and warm.
    s.factions.HILL_TRIBES.standing = 10;
    expect(hireError(s, 'farmers', 1, 'dustwalker')).toBeNull();
  });

  it('refuses homeland hands (they come from Thornwatch)', () => {
    const s = testState();
    expect(hireError(s, 'farmers', 1, 'imanian')).toMatch(/Thornwatch/);
  });

  it('costs the discount, adds native heads, and pulls culture toward the frontier', () => {
    const s = testState(); // river_meet visited, RIVER_CLANS friendly
    const silverBefore = s.silver;
    const cultureBefore = s.axes.culture;
    expect(hireResidents(s, 'farmers', 2, 'kiswani')).toBe(true);
    expect(s.residents.roles.farmers).toBe(2);
    expect(s.residents.heritage.native).toBe(2);
    expect(s.silver).toBe(silverBefore - localHireCost('farmers', 2));
    expect(localHireCost('farmers', 1)).toBeLessThan(TUNING.residents.hire.costPerHead.farmers);
    expect(s.axes.culture).toBeCloseTo(cultureBefore + TUNING.heritage.hireAxisNudge * 2);
    expect(s.residents.tags).toContain('kiswani');
    expectTallyInvariant(s);
  });
});

describe('the Thornwatch labor run', () => {
  function readyForLabor(): GameState {
    const s = testState();
    s.postTier = 2; // cap 10 so there is room to house them
    s.locations.charter_landing.discovery = 'visited';
    s.silver = 1000;
    return s;
  }

  it('validates faction seat, silver, and room', () => {
    const s = readyForLabor();
    // Wrong faction seat.
    expect(
      dispatchError(
        s,
        { kind: 'labor', destination: 'river_meet', heroIds: ['p1'], laborCount: 2 },
        TEST_CONTENT.locationDefs,
      ),
    ).toMatch(/Company garrison/);
    // Not enough silver.
    s.silver = laborRunCost(2) - 1;
    expect(
      dispatchError(
        s,
        { kind: 'labor', destination: 'charter_landing', heroIds: ['p1'], laborCount: 2 },
        TEST_CONTENT.locationDefs,
      ),
    ).toMatch(/recruiters/);
    // No room (plenty of silver, but the cap can't hold them).
    s.silver = 100000;
    expect(
      dispatchError(
        s,
        { kind: 'labor', destination: 'charter_landing', heroIds: ['p1'], laborCount: 99 },
        TEST_CONTENT.locationDefs,
      ),
    ).toMatch(/room/);
  });

  it('pays up front, reserves the cap, and settles homeland hands on homecoming', () => {
    const s = readyForLabor();
    const silverBefore = s.silver;
    const cultureBefore = s.axes.culture;
    const standingBefore = s.factions.CHARTER_COMPANY.standing;

    expect(
      dispatchExpedition(
        s,
        { kind: 'labor', destination: 'charter_landing', heroIds: ['p1'], laborCount: 3 },
        TEST_CONTENT.locationDefs,
      ),
    ).toBe(true);
    // Fee paid at dispatch; hands reserved in-flight.
    expect(s.silver).toBe(silverBefore - laborRunCost(3));
    expect(s.expeditions[0].homelandLabor).toBe(3);
    expect(residentTotal(s)).toBe(0); // not home yet

    runToHomecoming(s, TEST_CONTENT);
    expect(residentTotal(s)).toBe(3);
    expect(s.residents.heritage.homeland).toBe(3);
    expect(s.residents.idle).toBe(3);
    expect(s.factions.CHARTER_COMPANY.standing).toBe(
      standingBefore + TUNING.heritage.homelandArrivalStanding,
    );
    // Culture pulled toward Homeland (negative).
    expect(s.axes.culture).toBeLessThan(cultureBefore);
    expectTallyInvariant(s);
  });

  it('reserves cap across concurrent runs', () => {
    const s = readyForLabor();
    s.postTier = 1; // cap 4
    dispatchExpedition(
      s,
      { kind: 'labor', destination: 'charter_landing', heroIds: ['p1'], laborCount: 4 },
      TEST_CONTENT.locationDefs,
    );
    // The first run already reserved all 4 slots.
    expect(
      dispatchError(
        s,
        { kind: 'labor', destination: 'charter_landing', heroIds: ['p2'], laborCount: 1 },
        TEST_CONTENT.locationDefs,
      ),
    ).toMatch(/room/);
  });

  it('refunds hands turned away for want of room', () => {
    const s = readyForLabor();
    s.postTier = 2; // cap 10
    dispatchExpedition(
      s,
      { kind: 'labor', destination: 'charter_landing', heroIds: ['p1'], laborCount: 6 },
      TEST_CONTENT.locationDefs,
    );
    // Fill the pool while the run is out so there's no room on return.
    addResidents(s, 'farmers', 8, 'settlers', 'homeland');
    const silverMid = s.silver;
    runToHomecoming(s, TEST_CONTENT);
    // cap 10, 8 already home → only 2 of 6 settle, 4 refunded.
    expect(s.residents.heritage.homeland).toBe(10);
    expect(s.silver).toBe(silverMid + laborRunCost(4));
    expectTallyInvariant(s);
  });
});

describe('culture drift', () => {
  it('moves toward the tally-implied target, capped per season', () => {
    const s = testState();
    s.buildings = ['common_house'];
    addResidents(s, 'guards', 4, 'kiswani', 'native'); // all native → target +10
    s.axes.culture = 0;
    const delta = applyCultureDrift(s);
    expect(delta).toBe(TUNING.heritage.axisDriftPerSeason);
    expect(s.axes.culture).toBe(TUNING.heritage.axisDriftPerSeason);
  });

  it('is a no-op with no residents', () => {
    const s = testState();
    s.axes.culture = 3;
    expect(applyCultureDrift(s)).toBe(0);
    expect(s.axes.culture).toBe(3);
  });
});

describe('party heritage & new event vocabulary', () => {
  it('partyHeritageShare reads the active party', () => {
    const s = testState(); // p1..p6; p4 kiswani, p5 dustwalker are native
    const native = partyHeritageShare(s, 'native');
    const homeland = partyHeritageShare(s, 'homeland');
    expect(native + homeland).toBeCloseTo(1);
    expect(native).toBeGreaterThan(0); // Sela + Dagny
  });

  it('evaluates the heritage conditions', () => {
    const s = testState();
    s.buildings = ['common_house'];
    addResidents(s, 'guards', 3, 'kiswani', 'native');
    addResidents(s, 'farmers', 1, 'settlers', 'homeland');
    expect(evalCondition(s, { type: 'nativeShareAtLeast', value: 0.5 })).toBe(true);
    expect(evalCondition(s, { type: 'nativeShareAtMost', value: 0.5 })).toBe(false);
    expect(evalCondition(s, { type: 'heritageCountAtLeast', group: 'native', value: 3 })).toBe(true);
    expect(evalCondition(s, { type: 'heroHeritageInParty', heritage: 'kiswani' })).toBe(true);
    expect(evalCondition(s, { type: 'heroHeritageInParty', heritage: 'bejasi' })).toBe(false);
  });

  it('honors the group param on addResidents / loseResidents outcomes', () => {
    const s = testState();
    s.buildings = ['common_house'];
    applyOutcomes(
      s,
      [{ type: 'addResidents', role: 'idle', count: 2, tag: 'kiswani', group: 'native' }],
      outcomeCtx(s),
    );
    expect(s.residents.heritage.native).toBe(2);
    applyOutcomes(s, [{ type: 'loseResidents', count: 1, group: 'native' }], outcomeCtx(s));
    expect(s.residents.heritage.native).toBe(1);
    expectTallyInvariant(s);
  });
});
