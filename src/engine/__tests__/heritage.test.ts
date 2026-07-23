// Heritage & the cultural character of the post (HERITAGE_SPEC.md Phase A):
// the culture axis, the resident heritage tally, culture drift, and the new
// event vocabulary. (Local hiring and the Thornwatch labor run were retired by
// TULA_SETTLEMENT_SPEC.md in favour of Invite Settlers.)

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { advanceExpeditions, dispatchExpedition } from '../expeditions';
import type { ExpeditionContext } from '../expeditions';
import {
  addResidents,
  applyCultureDrift,
  applyDesertion,
  freshResidents,
  loseResidents,
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
    locationDefs: TEST_CONTENT.locationDefs,
    buildingNames: new Map(),
    recruitDefs: new Map(),
    dependantName: () => 'Test',
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
    s.residents = freshResidents();
    expect(s.residents.heritage).toEqual({ homeland: 0, native: 0 });
    expect(nativeShare(s)).toBe(0);
    expectTallyInvariant(s);
  });

  it('records origin on add and debits proportionally on loss', () => {
    const s = testState();
    s.residents = freshResidents();
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
    s.residents = freshResidents();
    addResidents(s, 'farmers', 3, 'settlers', 'homeland');
    addResidents(s, 'guards', 3, 'kiswani', 'native');
    loseResidents(s, undefined, 3, 'native');
    expect(s.residents.heritage.native).toBe(0);
    expect(s.residents.heritage.homeland).toBe(3);
    expectTallyInvariant(s);
  });

  it('reallocation never changes the tally; escorts stay counted while away', () => {
    const s = testState();
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
    addResidents(s, 'farmers', 4, 'settlers', 'homeland');
    s.residents.contentment = 0; // force unrest
    const lost = applyDesertion(s);
    expect(lost).toBeGreaterThan(0);
    expectTallyInvariant(s);
  });
});

describe('culture drift', () => {
  it('moves toward the tally-implied target, capped per season', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'guards', 4, 'kiswani', 'native'); // all native → target +10
    s.axes.culture = 0;
    const delta = applyCultureDrift(s);
    expect(delta).toBe(TUNING.heritage.axisDriftPerSeason);
    expect(s.axes.culture).toBe(TUNING.heritage.axisDriftPerSeason);
  });

  it('is a no-op with no residents', () => {
    const s = testState();
    s.residents = freshResidents();
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
    s.residents = freshResidents();
    addResidents(s, 'guards', 3, 'kiswani', 'native');
    addResidents(s, 'farmers', 1, 'settlers', 'homeland');
    expect(evalCondition(s, { type: 'nativeShareAtLeast', value: 0.5 })).toBe(true);
    expect(evalCondition(s, { type: 'nativeShareAtMost', value: 0.5 })).toBe(false);
    expect(evalCondition(s, { type: 'heritageCountAtLeast', group: 'native', value: 3 })).toBe(true);
    expect(evalCondition(s, { type: 'heroHeritageInParty', heritage: 'kiswani' })).toBe(true);
    expect(evalCondition(s, { type: 'heroHeritageInParty', heritage: 'weri' })).toBe(false);
  });

  it('honors the group param on addResidents / loseResidents outcomes', () => {
    const s = testState();
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
