import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { buyGood, driftMarket, priceOf, prosperity, sellGood, stockValue } from '../economy';
import { Rng } from '../rng';
import { TEST_CONTENT, testState } from './helpers';

const furs = TEST_CONTENT.goodDefs.get('furs')!;
const grain = TEST_CONTENT.goodDefs.get('grain')!;

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
    s.turn = 19; // turns 19–24 = winter
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

  it('event price shocks decay back to 1', () => {
    const s = testState();
    s.market.furs.eventMod = 2;
    const rng = new Rng(3);
    for (let i = 0; i < 10; i++) driftMarket(s, rng);
    expect(s.market.furs.eventMod).toBe(1);
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
