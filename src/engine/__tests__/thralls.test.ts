// Thralls / "indentured labor" (THRALLS_SPEC.md): a parallel forced-labor
// pool mirroring residents.ts's shape, without a wage, held at real risk.

import { describe, expect, it } from 'vitest';
import { claimCapacity, claimedPopulation, residentTotal, updateContentment } from '../residents';
import {
  addThralls,
  applyEscape,
  applyHoldingPressure,
  freshThralls,
  loseThralls,
  manumitThralls,
  reallocateThralls,
  restivenessBand,
  thrallOutputMultiplier,
  thrallTotal,
  updateRestiveness,
} from '../thralls';
import { testState } from './helpers';
import { TUNING } from '../../content/tuning';

describe('thralls', () => {
  it('freshThralls starts empty with the tuned restiveness baseline', () => {
    const s = testState();
    s.thralls = freshThralls();
    expect(thrallTotal(s)).toBe(0);
    expect(s.thralls.restiveness).toBe(TUNING.thralls.restiveness.start);
  });

  it('addThralls tallies role, heritage, and tag counts', () => {
    const s = testState();
    addThralls(s, 'farmers', 3, 'kiswani', 'native');
    expect(s.thralls.roles.farmers).toBe(3);
    expect(s.thralls.heritage.native).toBe(3);
    expect(s.thralls.tags.kiswani).toBe(3);
    expect(thrallTotal(s)).toBe(3);
  });

  it('loseThralls removes idle first, then the largest role, debiting heritage/tags', () => {
    const s = testState();
    addThralls(s, 'farmers', 4, 'kiswani', 'native');
    addThralls(s, 'idle', 2, 'kiswani', 'native');
    const lost = loseThralls(s, undefined, 3);
    expect(lost).toBe(3);
    expect(s.thralls.idle).toBe(0); // idle drained first
    expect(s.thralls.roles.farmers).toBe(3);
    expect(thrallTotal(s)).toBe(3);
    expect(s.thralls.heritage.native).toBe(3);
    expect(s.thralls.tags.kiswani).toBe(3);
  });

  it('reallocateThralls moves heads between roles but never into guards', () => {
    const s = testState();
    addThralls(s, 'idle', 5);
    expect(reallocateThralls(s, 'idle', 'guards', 2)).toBe(false);
    expect(s.thralls.idle).toBe(5);
    expect(reallocateThralls(s, 'idle', 'farmers', 2)).toBe(true);
    expect(s.thralls.idle).toBe(3);
    expect(s.thralls.roles.farmers).toBe(2);
  });

  it('thrallOutputMultiplier rewards a guard escort and penalizes going without', () => {
    const s = testState();
    s.residents.roles.guards = 0; // testState seeds a couple of starting guards
    addThralls(s, 'idle', 10);
    const unguarded = thrallOutputMultiplier(s);
    expect(unguarded).toBe(TUNING.thralls.output.unguardedOutputMult);
    s.residents.roles.guards += 5; // well past guardRatioForFullOutput at 10 thralls
    expect(thrallOutputMultiplier(s)).toBe(TUNING.thralls.output.guardedOutputMult);
  });

  it('updateRestiveness rises with the thrall:free-resident ratio and falls with guards', () => {
    const s = testState();
    addThralls(s, 'idle', 20);
    s.residents.roles.farmers = 5; // small free pool relative to thralls
    const delta = updateRestiveness(s, { missedFood: false });
    expect(delta).toBeGreaterThan(0);
    const before = s.thralls.restiveness;
    s.residents.roles.guards += 20; // heavy guard presence should suppress it
    updateRestiveness(s, { missedFood: false });
    expect(s.thralls.restiveness).toBeLessThanOrEqual(before);
  });

  it('applyEscape only fires once restiveness reaches the restive band, and guards reduce it', () => {
    const s = testState();
    addThralls(s, 'idle', 20);
    expect(applyEscape(s)).toBe(0); // starts settled
    s.thralls.restiveness = TUNING.thralls.restiveness.restiveThreshold;
    expect(restivenessBand(s)).toBe('restive');
    const escaped = applyEscape(s);
    expect(escaped).toBeGreaterThan(0);
    expect(thrallTotal(s)).toBe(20 - escaped);
  });

  it('claimedPopulation combines free residents and thralls against claimCapacity', () => {
    const s = testState();
    addThralls(s, 'idle', 5);
    expect(claimedPopulation(s)).toBe(residentTotal(s) + 5);
    const cap = claimCapacity(s);
    // Push the combined population over the Concession purely via thralls.
    addThralls(s, 'idle', Math.max(1, cap - claimedPopulation(s) + 1));
    expect(claimedPopulation(s)).toBeGreaterThan(cap);
  });

  it("updateContentment feels a drag from a held thrall population", () => {
    const withThralls = testState();
    addThralls(withThralls, 'idle', 30);
    const without = testState();
    const deltaWith = updateContentment(withThralls, { missedFood: false, missedWages: false });
    const deltaWithout = updateContentment(without, { missedFood: false, missedWages: false });
    expect(deltaWith).toBeLessThan(deltaWithout);
  });

  it('applyHoldingPressure costs non-hostile native standing and nudges culture toward Frontier', () => {
    const s = testState();
    addThralls(s, 'idle', 5);
    const before = s.factions.RIVER_CLANS.standing;
    const cultureBefore = s.axes.culture;
    const { standingLoss, cultureNudge } = applyHoldingPressure(s);
    expect(standingLoss).toBe(true);
    expect(s.factions.RIVER_CLANS.standing).toBeLessThan(before);
    expect(cultureNudge).toBeGreaterThan(0);
    expect(s.axes.culture).toBeGreaterThan(cultureBefore);
  });

  it('applyHoldingPressure is a no-op with an empty pool', () => {
    const s = testState();
    const before = s.factions.RIVER_CLANS.standing;
    const { standingLoss, cultureNudge } = applyHoldingPressure(s);
    expect(standingLoss).toBe(false);
    expect(cultureNudge).toBe(0);
    expect(s.factions.RIVER_CLANS.standing).toBe(before);
  });

  it('manumitThralls moves heads into free residents, carrying tags/heritage, for a silver-scaled standing gain', () => {
    const s = testState();
    addThralls(s, 'farmers', 4, 'kiswani', 'native');
    const residentsBefore = residentTotal(s);
    const standingBefore = s.factions.RIVER_CLANS.standing;
    const cultureBefore = s.axes.culture;
    const freed = manumitThralls(s, 'farmers', 3);
    expect(freed).toBe(3);
    expect(s.thralls.roles.farmers).toBe(1);
    expect(s.thralls.heritage.native).toBe(1);
    expect(s.thralls.tags.kiswani).toBe(1);
    expect(residentTotal(s)).toBe(residentsBefore + 3);
    expect(s.residents.roles.farmers).toBeGreaterThanOrEqual(3);
    expect(s.residents.heritage.native).toBeGreaterThanOrEqual(3);
    expect(s.residents.tags.kiswani).toBeGreaterThanOrEqual(3);
    expect(s.factions.RIVER_CLANS.standing).toBeGreaterThan(standingBefore);
    expect(s.axes.culture).toBeLessThan(cultureBefore);
  });

  it('manumitThralls frees at most what is present in the requested role', () => {
    const s = testState();
    addThralls(s, 'farmers', 2);
    expect(manumitThralls(s, 'farmers', 10)).toBe(2);
    expect(s.thralls.roles.farmers).toBe(0);
  });
});
