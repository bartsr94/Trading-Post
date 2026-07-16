// Prices and trade math (spec §7). Price = basePrice × seasonalMod ×
// localSupplyDemandMod × eventMod, drifting each turn within bands.

import { TUNING } from '../content/tuning';
import { clamp, seasonOfTurn } from './types';
import type { GameState, GoodId, Season } from './types';
import type { Rng } from './rng';

export interface GoodDef {
  id: GoodId;
  name: string;
  basePrice: number;
  seasonalMods: Record<Season, number>;
  note: string;
}

export function priceOf(state: GameState, def: GoodDef): number {
  const season = seasonOfTurn(state.turn);
  const market = state.market[def.id];
  const raw = def.basePrice * def.seasonalMods[season] * market.supplyDemandMod * market.eventMod;
  return Math.max(1, Math.round(raw));
}

/** Random-walk drift of supply/demand mods; event shocks decay toward 1. */
export function driftMarket(state: GameState, rng: Rng): void {
  const { supplyDemandMin, supplyDemandMax, supplyDemandStep, eventModDecay } = TUNING.economy;
  for (const market of Object.values(state.market)) {
    const step = rng.int(-1, 1) * supplyDemandStep;
    market.supplyDemandMod = clamp(
      Math.round((market.supplyDemandMod + step) * 100) / 100,
      supplyDemandMin,
      supplyDemandMax,
    );
    market.eventMod = 1 + (market.eventMod - 1) * eventModDecay;
    if (Math.abs(market.eventMod - 1) < 0.05) market.eventMod = 1;
  }
}

export function stockValue(state: GameState, goodDefs: ReadonlyMap<GoodId, GoodDef>): number {
  let total = 0;
  for (const [goodId, qty] of Object.entries(state.goods) as [GoodId, number][]) {
    const def = goodDefs.get(goodId);
    if (def) total += qty * priceOf(state, def);
  }
  return total;
}

/** Derived score driving trade income (and later caravan frequency / event weights). */
export function prosperity(state: GameState, goodDefs: ReadonlyMap<GoodId, GoodDef>): number {
  const { prosperitySilverDiv, prosperityStockDiv } = TUNING.economy;
  return (
    Math.round((state.silver / prosperitySilverDiv + stockValue(state, goodDefs) / prosperityStockDiv) * 10) /
    10
  );
}

/** Buy at the post market. Returns false if silver is short. */
export function buyGood(state: GameState, def: GoodDef, qty: number): boolean {
  const cost = priceOf(state, def) * qty;
  if (state.silver < cost) return false;
  state.silver -= cost;
  state.goods[def.id] += qty;
  return true;
}

/** Sell at the post market. Returns false if stock is short. */
export function sellGood(state: GameState, def: GoodDef, qty: number): boolean {
  if (state.goods[def.id] < qty) return false;
  state.goods[def.id] -= qty;
  state.silver += priceOf(state, def) * qty;
  return true;
}
