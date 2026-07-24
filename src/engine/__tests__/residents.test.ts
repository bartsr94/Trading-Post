// Residents system (RESIDENTS_SPEC.md Phase A): pool selectors, upkeep,
// contentment, growth/desertion, hiring, expedition escorts, and the new
// event outcomes/conditions.

import { describe, expect, it } from 'vitest';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { evalCondition } from '../events/conditions';
import { cargoCapacity, dispatchError, dispatchExpedition, advanceExpeditions } from '../expeditions';
import type { ExpeditionContext } from '../expeditions';
import {
  addResidents,
  applyAxisArrivals,
  applyDesertion,
  applyGrowth,
  claimCapacity,
  contentmentBand,
  driftFriction,
  freshResidents,
  loseResidents,
  outputMultiplier,
  reallocate,
  residentCount,
  residentsAvailable,
  residentTagCounts,
  residentTotal,
  updateContentment,
} from '../residents';
import { Rng } from '../rng';
import { resolveTurn } from '../turn';
import { TEST_CONTENT, testState } from './helpers';
import { TUNING } from '../../content/tuning';
import type { GameState } from '../types';

const noop = () => {};

function outcomeCtx(state: GameState): OutcomeContext {
  return {
    heroId: state.heroes[0].id,
    goodNames: TEST_CONTENT.goodNames,
    factionNames: TEST_CONTENT.factionNames,
    traitNames: TEST_CONTENT.traitNames,
    locationNames: TEST_CONTENT.locationNames,
    locationDefs: TEST_CONTENT.locationDefs,
    buildingNames: TEST_CONTENT.buildingNames,
    recruitDefs: TEST_CONTENT.recruitDefs,
    dependantName: TEST_CONTENT.dependantName,
  };
}

function expeditionCtx(): ExpeditionContext {
  return {
    goodDefs: TEST_CONTENT.goodDefs,
    traitDefs: TEST_CONTENT.traitDefs,
    goodNames: TEST_CONTENT.goodNames,
    locationDefs: TEST_CONTENT.locationDefs,
    dependantName: TEST_CONTENT.dependantName,
  };
}

describe('resident selectors', () => {
  it('counts the whole pool including idle and away escorts', () => {
    const s = testState();
    s.residents.roles.farmers = 2;
    s.residents.roles.guards = 1;
    s.residents.idle = 1;
    expect(residentTotal(s)).toBe(4);

    s.expeditions.push({
      id: 'exp_1',
      kind: 'caravan',
      destination: 'river_meet',
      heroIds: ['p1'],
      leg: 'outbound',
      turnsLeft: 1,
      cargo: {},
      silver: 0,
      buyOrders: {},
      residentEscort: { porters: 2 },
    });
    // Escorts still eat & are paid, so they count toward the total...
    expect(residentTotal(s)).toBe(6);
    // ...but are not "present" for post work.
    expect(residentsAvailable(s, 'porters')).toBe(0);
    expect(residentCount(s, 'farmers')).toBe(2);
    expect(residentCount(s)).toBe(6);
  });

  it('cargo capacity grows with porters', () => {
    expect(cargoCapacity(2)).toBe(40); // 2 heroes × 20
    expect(cargoCapacity(2, { porters: 3 })).toBe(40 + 3 * 15);
  });

  it('contentment bands and output multiplier follow the meter', () => {
    const s = testState();
    s.residents.contentment = 9;
    expect(contentmentBand(s)).toBe('content');
    expect(outputMultiplier(s)).toBe(1);
    s.residents.contentment = 5;
    expect(contentmentBand(s)).toBe('grumbling');
    expect(outputMultiplier(s)).toBeCloseTo(0.75);
    s.residents.contentment = 2;
    expect(contentmentBand(s)).toBe('unrest');
    expect(outputMultiplier(s)).toBeCloseTo(0.4);
  });
});

describe('resident mutators', () => {
  it('addResidents is uncapped and records tags', () => {
    const s = testState();
    s.residents = freshResidents(); // isolate from the new-game starting hands
    expect(addResidents(s, 'farmers', 3, 'settlers')).toBe(3);
    expect(addResidents(s, 'idle', 5)).toBe(5); // no cap — all join
    expect(residentTotal(s)).toBe(8);
    expect(s.residents.tags.settlers).toBe(3);
  });

  it('loseResidents takes idle first, then the largest role', () => {
    const s = testState();
    s.residents.roles.farmers = 3;
    s.residents.roles.guards = 1;
    s.residents.idle = 2;
    expect(loseResidents(s, undefined, 3)).toBe(3);
    expect(s.residents.idle).toBe(0);
    expect(s.residents.roles.farmers).toBe(2); // one taken from the largest role
  });

  it('reallocate moves present hands between roles and idle', () => {
    const s = testState();
    s.residents = freshResidents();
    s.residents.idle = 3;
    expect(reallocate(s, 'idle', 'guards', 2)).toBe(true);
    expect(s.residents.roles.guards).toBe(2);
    expect(s.residents.idle).toBe(1);
    expect(reallocate(s, 'idle', 'guards', 5)).toBe(false); // not enough idle
  });

  it('claimCapacity tracks the Concession, and the pool may exceed it', () => {
    const s = testState(); // starting Concession size 10
    s.residents = freshResidents();
    expect(claimCapacity(s)).toBe(10 * TUNING.claim.residentsPerChain);
    // Population is uncapped — adding past the supported number still succeeds.
    const cap = claimCapacity(s);
    expect(addResidents(s, 'farmers', cap + 5)).toBe(cap + 5);
    expect(residentTotal(s)).toBe(cap + 5);
    expect(residentTotal(s)).toBeGreaterThan(claimCapacity(s));
  });

  it('addResidents accumulates a tag count across multiple calls, not just presence', () => {
    const s = testState();
    expect(addResidents(s, 'farmers', 2, 'kiswani', 'native')).toBe(2);
    expect(addResidents(s, 'guards', 1, 'kiswani', 'native')).toBe(1);
    expect(s.residents.tags.kiswani).toBe(3);
    expect(residentTagCounts(s)).toEqual([['kiswani', 3]]);
  });

  it('loseResidents proportionally debits tag counts, and drops a tag once it hits zero', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'farmers', 4, 'orc', 'native');
    expect(loseResidents(s, undefined, 4)).toBe(4);
    expect(s.residents.tags.orc).toBeUndefined();
    expect(residentTagCounts(s)).toEqual([]);
  });
});

describe('contentment, desertion, growth', () => {
  it('a missed meal drags the mood down; a good turn lifts it', () => {
    const s = testState();
    s.residents.roles.farmers = 2;
    s.residents.contentment = 7;
    updateContentment(s, { missedFood: true, missedWages: false });
    expect(s.residents.contentment).toBe(5); // −2

    s.residents.contentment = 6;
    updateContentment(s, { missedFood: false, missedWages: false });
    expect(s.residents.contentment).toBe(7); // +1 drift when all is well
  });

  it('does nothing with an empty pool', () => {
    const s = testState();
    s.residents = freshResidents();
    const before = s.residents.contentment;
    expect(updateContentment(s, { missedFood: true, missedWages: true })).toBe(0);
    expect(s.residents.contentment).toBe(before);
  });

  it('residents desert during unrest, and guards temper it', () => {
    const s = testState();
    s.residents.roles.farmers = 10;
    s.residents.contentment = 2; // unrest
    expect(applyDesertion(s)).toBe(2); // ceil(10 * 0.2)

    const g = testState();
    g.residents.roles.guards = 5;
    g.residents.contentment = 2;
    // rate 0.2 − postDefense(5)*0.02 = 0.1 → ceil(5 * 0.1) = 1
    expect(applyDesertion(g)).toBe(1);

    const calm = testState();
    calm.residents.roles.farmers = 10;
    calm.residents.contentment = 8; // content, no desertion
    expect(applyDesertion(calm)).toBe(0);
  });

  it('growth needs a content post; the cap no longer blocks it', () => {
    // Not content → never grows.
    const grumbling = testState();
    grumbling.residents.roles.farmers = 1;
    grumbling.residents.contentment = 5;
    expect(applyGrowth(grumbling, new Rng(1), 0)).toBe(0);

    // Content → grows on at least some rng streams.
    let grewAtLeastOnce = false;
    for (let seed = 1; seed <= 60; seed++) {
      const s = testState();
      s.residents.roles.farmers = 1;
      s.residents.contentment = 9;
      if (applyGrowth(s, new Rng(seed), 5) > 0) grewAtLeastOnce = true;
    }
    expect(grewAtLeastOnce).toBe(true);

    // Even well past the Concession's supported number, a content post can grow.
    let grewWhileCrowded = false;
    for (let seed = 1; seed <= 60; seed++) {
      const s = testState();
      s.residents.roles.farmers = claimCapacity(s) + 5;
      s.residents.contentment = 9;
      if (applyGrowth(s, new Rng(seed), 99) > 0) grewWhileCrowded = true;
    }
    expect(grewWhileCrowded).toBe(true);
  });

  it('settlement axes draw arrivals at season end', () => {
    const s = testState();
    s.residents = freshResidents();
    s.axes.integration = 5;
    s.axes.communal = 5;
    const arrivals = applyAxisArrivals(s);
    expect(arrivals.map((a) => a.tag).sort()).toEqual(['native-kin', 'settlers']);
    expect(residentTotal(s)).toBe(2);
    expect(s.residents.tags['native-kin']).toBe(1);
  });
});

describe('resident event outcomes and conditions', () => {
  it('addResidents / loseResidents / contentment / addTransient apply', () => {
    const s = testState();
    s.residents = freshResidents();
    applyOutcomes(s, [{ type: 'addResidents', role: 'farmers', count: 2 }], outcomeCtx(s));
    expect(s.residents.roles.farmers).toBe(2);

    applyOutcomes(s, [{ type: 'loseResidents', count: 1 }], outcomeCtx(s));
    expect(residentTotal(s)).toBe(1);

    s.residents.contentment = 7;
    applyOutcomes(s, [{ type: 'contentment', delta: -3 }], outcomeCtx(s));
    expect(s.residents.contentment).toBe(4);

    applyOutcomes(
      s,
      [{ type: 'addTransient', kind: 'visitorGuards', count: 5, turns: 2 }],
      outcomeCtx(s),
    );
    expect(s.transients).toHaveLength(1);
    expect(s.transients[0].kind).toBe('visitorGuards');
  });

  it('resident and contentment conditions read the pool', () => {
    const s = testState();
    s.residents = freshResidents();
    s.residents.roles.guards = 3;
    s.residents.contentment = 6;
    expect(evalCondition(s, { type: 'residentsAtLeast', role: 'guards', value: 3 })).toBe(true);
    expect(evalCondition(s, { type: 'residentsAtLeast', role: 'guards', value: 4 })).toBe(false);
    expect(evalCondition(s, { type: 'residentsBelow', value: 5 })).toBe(true);
    expect(evalCondition(s, { type: 'contentmentAtMost', value: 6 })).toBe(true);
    expect(evalCondition(s, { type: 'contentmentAtLeast', value: 7 })).toBe(false);
  });

  it('residentTagAtLeast reads ResidentState.tags', () => {
    const s = testState();
    s.residents = freshResidents();
    s.residents.tags.orc = 2;
    expect(evalCondition(s, { type: 'residentTagAtLeast', tag: 'orc', value: 2 })).toBe(true);
    expect(evalCondition(s, { type: 'residentTagAtLeast', tag: 'orc', value: 3 })).toBe(false);
    expect(evalCondition(s, { type: 'residentTagAtLeast', tag: 'goblin', value: 1 })).toBe(false);
  });
});

describe('integration friction', () => {
  it('friction outcome clamps 0-10 and the conditions read it back', () => {
    const s = testState();
    s.residents = freshResidents();
    applyOutcomes(s, [{ type: 'friction', heritage: 'orc', delta: 7 }], outcomeCtx(s));
    expect(s.residents.friction.orc).toBe(7);
    expect(evalCondition(s, { type: 'frictionAtLeast', heritage: 'orc', value: 4 })).toBe(true);
    expect(evalCondition(s, { type: 'frictionAtMost', heritage: 'orc', value: 2 })).toBe(false);

    applyOutcomes(s, [{ type: 'friction', heritage: 'orc', delta: 10 }], outcomeCtx(s));
    expect(s.residents.friction.orc).toBe(10);
    applyOutcomes(s, [{ type: 'friction', heritage: 'orc', delta: -20 }], outcomeCtx(s));
    expect(s.residents.friction.orc).toBe(0);

    // An untouched heritage never accrues an entry, and reads as 0.
    expect(evalCondition(s, { type: 'frictionAtMost', heritage: 'goblin', value: 0 })).toBe(true);
  });

  it('a volatile-band heritage drags contentment; a settled one does not', () => {
    const s = testState();
    s.residents = freshResidents();
    s.residents.roles.farmers = 1; // non-empty pool, else updateContentment no-ops
    s.residents.friction.orc = 8; // volatile (>= 7)
    const withFriction = updateContentment(s, { missedFood: false, missedWages: false });

    const s2 = testState();
    s2.residents = freshResidents();
    s2.residents.roles.farmers = 1;
    s2.residents.friction.orc = 2; // settled (< 4)
    const withoutFriction = updateContentment(s2, { missedFood: false, missedWages: false });

    expect(withFriction).toBeLessThan(withoutFriction);
  });

  it('driftFriction settles a heritage toward 0 over time, never below it', () => {
    const s = testState();
    s.residents = freshResidents();
    s.residents.friction.orc = 0.03;
    driftFriction(s);
    expect(s.residents.friction.orc).toBe(0);

    s.residents.friction.goblin = 5;
    driftFriction(s);
    expect(s.residents.friction.goblin).toBeLessThan(5);
    expect(s.residents.friction.goblin).toBeGreaterThan(0);
  });
});

describe('expedition escorts', () => {
  it('draws residents onto a caravan and returns survivors on homecoming', () => {
    const s = testState();
    s.residents = freshResidents();
    // Make the market reachable and give the post porters/guards.
    s.locations.river_meet.discovery = 'visited';
    s.residents.roles.porters = 3;
    s.residents.roles.guards = 2;

    const ok = dispatchExpedition(
      s,
      { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], residents: { porters: 2, guards: 1 } },
      TEST_CONTENT.locationDefs,
    );
    expect(ok).toBe(true);
    // Seconded hands leave the post pool but still count for upkeep.
    expect(residentsAvailable(s, 'porters')).toBe(1);
    expect(residentTotal(s)).toBe(5);
    expect(s.expeditions[0].residentEscort).toEqual({ porters: 2, guards: 1 });

    // Run the caravan out and back; escorts rejoin the pool at home.
    const ctx = expeditionCtx();
    for (let i = 0; i < 20 && s.expeditions.length > 0; i++) {
      advanceExpeditions(s, ctx, new Rng(i + 1), noop);
    }
    expect(s.expeditions).toHaveLength(0);
    expect(residentsAvailable(s, 'porters')).toBe(3);
    expect(residentsAvailable(s, 'guards')).toBe(2);
  });

  it('rejects an escort the post cannot spare', () => {
    const s = testState();
    s.locations.river_meet.discovery = 'visited';
    s.residents.roles.guards = 1;
    const reason = dispatchError(
      s,
      { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], residents: { guards: 3 } },
      TEST_CONTENT.locationDefs,
    );
    expect(reason).toBe('Not enough guards to spare.');
  });
});

describe('resident upkeep in the turn pipeline', () => {
  it('residents add to the grain the post eats', () => {
    const s = testState(1);
    s.residents = freshResidents();
    s.residents.roles.porters = 3; // eat, do not farm
    resolveTurn(s, TEST_CONTENT);
    const eatLine = s.report.lines.find((l) => l.text.includes('eats'));
    // 6 heroes + 3 residents = 9 food.
    expect(eatLine?.text).toContain('9 food');
  });

  it('wages are charged at season end', () => {
    const s = testState(2);
    s.turn = 6; // season end
    s.silver = 1000;
    s.residents = freshResidents();
    s.residents.roles.farmers = 2; // total 2 → 12 silver in wages
    resolveTurn(s, TEST_CONTENT);
    const wageLine = s.report.lines.find((l) => l.text.includes('wages'));
    expect(wageLine?.text).toContain('12 silver');
  });
});
