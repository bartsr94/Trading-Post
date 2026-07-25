import { describe, expect, it } from 'vitest';
import { LOCATION_DEFS } from '../../content/locations';
import { TUNING } from '../../content/tuning';
import {
  buyGood,
  driftMarket,
  priceAt,
  priceOf,
  prosperity,
  recordPriceIntel,
  resolveShocks,
  sellGood,
  stockValue,
  structuralPrice,
} from '../economy';
import { Rng } from '../rng';
import { TEST_CONTENT, testState } from './helpers';

const furs = TEST_CONTENT.goodDefs.get('furs')!;
const grain = TEST_CONTENT.goodDefs.get('grain')!;
// river_meet: furs bias 0.7 — a market with a clear structural identity.
const riverMeet = LOCATION_DEFS.get('river_meet')!;

describe('prices', () => {
  it('price = base × seasonal × supplyDemand × event, rounded, min 1', () => {
    const s = testState();
    // Turn 1 = spring; furs spring mod is 1.0, mods start at 1.
    expect(priceOf(s, furs)).toBe(12);
    s.market.furs.supplyDemandMod = 1.5;
    s.market.furs.eventMod = 2;
    expect(priceOf(s, furs)).toBe(36);
  });

  it('applies seasonal modifiers by turn', () => {
    const s = testState();
    s.turn = 10; // turns 10–12 = winter (turnsPerSeason: 3, turnsPerYear: 12)
    expect(priceOf(s, furs)).toBe(Math.round(12 * 1.4));
  });

  it('drift keeps supply/demand inside the tuning band', () => {
    const s = testState();
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) driftMarket(s, rng);
    for (const m of Object.values(s.market)) {
      expect(m.supplyDemandMod).toBeGreaterThanOrEqual(TUNING.economy.supplyDemandMin);
      expect(m.supplyDemandMod).toBeLessThanOrEqual(TUNING.economy.supplyDemandMax);
    }
  });

  it('drift mean-reverts supply/demand toward 1.0', () => {
    const s = testState();
    // Start pinned at the top of the band; reversion should pull it back so the
    // long-run average hovers near the neutral 1.0 (structural spread lives in
    // priceBias, not here).
    for (const m of Object.values(s.market)) m.supplyDemandMod = TUNING.economy.supplyDemandMax;
    const rng = new Rng(7);
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 500; i++) {
      driftMarket(s, rng);
      if (i >= 50) {
        // skip the initial pull-in transient
        sum += s.market.furs.supplyDemandMod;
        n += 1;
      }
    }
    expect(sum / n).toBeGreaterThan(0.85);
    expect(sum / n).toBeLessThan(1.15);
  });

});

describe('market shocks', () => {
  it('a rumored shock holds off, then bites for its duration, then expires', () => {
    const s = testState();
    s.marketShocks = [
      { locationId: 'post', goodId: 'furs', mod: 2, leadLeft: 2, turnsLeft: 3 },
    ];

    // Lead-in turns: still only a rumor, price unmoved.
    resolveShocks(s);
    expect(s.market.furs.eventMod).toBe(1);
    resolveShocks(s);
    expect(s.market.furs.eventMod).toBe(1);

    // Now it bites for three turns.
    for (let i = 0; i < 3; i++) {
      resolveShocks(s);
      expect(s.market.furs.eventMod).toBe(2);
    }

    // Then it is gone and the market reads neutral again.
    resolveShocks(s);
    expect(s.market.furs.eventMod).toBe(1);
    expect(s.marketShocks).toHaveLength(0);
  });

  it('shocks fully own eventMod — a shock-less turn resets any stray value to 1', () => {
    const s = testState();
    s.market.furs.eventMod = 1.7; // a leftover from an old save / earlier shock
    resolveShocks(s);
    expect(s.market.furs.eventMod).toBe(1);
  });

  it('applies a shock to a remote market, not the post', () => {
    const s = testState();
    s.marketShocks = [
      { locationId: 'river_meet', goodId: 'salt', mod: 1.8, leadLeft: 0, turnsLeft: 2 },
    ];
    resolveShocks(s);
    expect(s.locations.river_meet!.market!.salt.eventMod).toBe(1.8);
    expect(s.market.salt.eventMod).toBe(1);
  });
});

describe('price intel', () => {
  it('structural price reflects only base × seasonal × bias, ignoring live mods', () => {
    const s = testState();
    // Live supply/demand and a shock should not move the structural estimate.
    s.locations.river_meet!.market!.furs.supplyDemandMod = 1.5;
    s.locations.river_meet!.market!.furs.eventMod = 2;
    // spring furs mod 1.0, base 12, river_meet bias 0.7 → round(8.4) = 8.
    expect(structuralPrice(s, furs, riverMeet)).toBe(8);
  });

  it('recordPriceIntel snapshots the live price and the turn seen', () => {
    const s = testState();
    s.turn = 5;
    s.locations.river_meet!.market!.furs.supplyDemandMod = 1.2;
    recordPriceIntel(s, riverMeet, TEST_CONTENT.goodDefs);
    const obs = s.locations.river_meet!.priceIntel!.furs!;
    expect(obs.price).toBe(priceAt(s, furs, riverMeet));
    expect(obs.turnSeen).toBe(5);
    // Every good gets an observation, not just the one we poked.
    expect(Object.keys(s.locations.river_meet!.priceIntel!).length).toBe(TEST_CONTENT.goodDefs.size);
  });
});

describe('trading', () => {
  it('buy/sell move silver and stock symmetrically', () => {
    const s = testState();
    const price = priceOf(s, furs);
    expect(buyGood(s, furs, 3)).toBe(true);
    expect(s.goods.furs).toBe(3);
    expect(s.silver).toBe(200 - price * 3);
    expect(sellGood(s, furs, 3)).toBe(true);
    expect(s.silver).toBe(200);
  });

  it('refuses trades the player cannot afford or cover', () => {
    const s = testState();
    s.silver = 1;
    expect(buyGood(s, furs, 1)).toBe(false);
    expect(sellGood(s, furs, 1)).toBe(false);
    expect(s.silver).toBe(1);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid trade quantity (%s) without mutating state',
    (qty) => {
      const buying = testState();
      const buyBefore = structuredClone(buying);
      expect(buyGood(buying, furs, qty)).toBe(false);
      expect(buying).toEqual(buyBefore);

      const selling = testState();
      selling.goods.furs = 10;
      const sellBefore = structuredClone(selling);
      expect(sellGood(selling, furs, qty)).toBe(false);
      expect(selling).toEqual(sellBefore);
    },
  );

  it('stock value and prosperity derive from goods and silver', () => {
    const s = testState();
    const expectedStock =
      30 * priceOf(s, grain) +
      10 * priceOf(s, TEST_CONTENT.goodDefs.get('timber')!) +
      4 * priceOf(s, TEST_CONTENT.goodDefs.get('tools')!) +
      4 * priceOf(s, TEST_CONTENT.goodDefs.get('salt')!);
    expect(stockValue(s, TEST_CONTENT.goodDefs)).toBe(expectedStock);
    expect(prosperity(s, TEST_CONTENT.goodDefs)).toBeGreaterThan(0);
  });
});
