// Prices and trade math (spec §7). Price = basePrice × seasonalMod ×
// localSupplyDemandMod × eventMod, drifting each turn within bands.

import { TUNING } from '../content/tuning';
import { buildingEffect } from './buildings';
import { clamp, isPositiveInt, seasonOfTurn } from './types';
import type {
  GameState,
  GoodId,
  LocationDef,
  LocationId,
  MarketGoodState,
  MarketShock,
  Season,
} from './types';
import type { Rng } from './rng';

export interface GoodDef {
  id: GoodId;
  name: string;
  basePrice: number;
  seasonalMods: Record<Season, number>;
  note: string;
}

function computePrice(
  state: GameState,
  def: GoodDef,
  market: MarketGoodState,
  bias: number,
): number {
  const season = seasonOfTurn(state.turn);
  const raw =
    def.basePrice * def.seasonalMods[season] * market.supplyDemandMod * market.eventMod * bias;
  return Math.max(1, Math.round(raw));
}

/** Price at the post market. */
export function priceOf(state: GameState, def: GoodDef): number {
  return computePrice(state, def, state.market[def.id], 1);
}

/** Price at a remote location's market (applies the location's static bias). */
export function priceAt(state: GameState, def: GoodDef, location: LocationDef): number {
  const market = state.locations[location.id]?.market?.[def.id] ?? state.market[def.id];
  return computePrice(state, def, market, location.priceBias?.[def.id] ?? 1);
}

/**
 * The price to *expect* at a market from its permanent structure alone —
 * base × seasonal × bias, with the live supply/demand and shock layers held at
 * neutral. The Ledger shows this as an estimate for a discovered market the
 * player has never actually traded at (TRADING_ECONOMY_SPEC §4).
 */
export function structuralPrice(state: GameState, def: GoodDef, location: LocationDef): number {
  const season = seasonOfTurn(state.turn);
  return Math.max(1, Math.round(def.basePrice * def.seasonalMods[season] * (location.priceBias?.[def.id] ?? 1)));
}

/**
 * Snapshot a market's current prices into the player's intel record — called
 * when a party reaches a market (TRADING_ECONOMY_SPEC §4). No-op for markets
 * with no market. Overwrites any older observation for that good.
 */
export function recordPriceIntel(
  state: GameState,
  location: LocationDef,
  goodDefs: ReadonlyMap<GoodId, GoodDef>,
): void {
  const loc = state.locations[location.id];
  if (!loc || !location.hasMarket) return;
  const intel: Partial<Record<GoodId, { price: number; turnSeen: number }>> = loc.priceIntel ?? {};
  for (const [id, def] of goodDefs) {
    intel[id] = { price: priceAt(state, def, location), turnSeen: state.turn };
  }
  loc.priceIntel = intel;
}

function allMarkets(state: GameState): Record<GoodId, MarketGoodState>[] {
  return [
    state.market,
    ...Object.values(state.locations)
      .map((loc) => loc.market)
      .filter((m): m is Record<GoodId, MarketGoodState> => m !== undefined),
  ];
}

/** Mean-reverting drift of the supply/demand layer (eventMod is owned by
 *  `resolveShocks`, not here — TRADING_ECONOMY_SPEC §3b/§3c). */
export function driftMarket(state: GameState, rng: Rng): void {
  const { supplyDemandMin, supplyDemandMax, supplyDemandStep, supplyDemandReversion } =
    TUNING.economy;
  for (const perGood of allMarkets(state)) {
    for (const market of Object.values(perGood)) {
      // Pull back toward the neutral 1.0 first — structural identity lives in
      // priceBias, so this layer stays short-run texture that self-corrects —
      // then jitter a step.
      const reverted =
        market.supplyDemandMod + (1 - market.supplyDemandMod) * supplyDemandReversion;
      const step = rng.int(-1, 1) * supplyDemandStep;
      market.supplyDemandMod = clamp(
        Math.round((reverted + step) * 100) / 100,
        supplyDemandMin,
        supplyDemandMax,
      );
    }
  }
}

/**
 * Advance every market shock one turn and rebuild each market good's `eventMod`
 * from the live ones (TRADING_ECONOMY_SPEC §3c). Rumored shocks (`leadLeft > 0`)
 * only count down — they move no price until they bite. Shocks fully own
 * `eventMod`, so this resets it to neutral first; with no active shock a market
 * simply reads 1. Called each turn from `resolveTurn`.
 */
export function resolveShocks(state: GameState): void {
  const marketOf = (locId: LocationId): Record<GoodId, MarketGoodState> | undefined =>
    locId === TUNING.map.homeLocationId ? state.market : state.locations[locId]?.market;

  for (const perGood of allMarkets(state)) {
    for (const good of Object.values(perGood)) good.eventMod = 1;
  }

  const surviving: MarketShock[] = [];
  for (const shock of state.marketShocks) {
    if (shock.leadLeft > 0) {
      shock.leadLeft -= 1;
      surviving.push(shock); // still only a rumor — no price effect yet
      continue;
    }
    const good = marketOf(shock.locationId)?.[shock.goodId];
    if (good) good.eventMod *= shock.mod;
    shock.turnsLeft -= 1;
    if (shock.turnsLeft > 0) surviving.push(shock);
  }
  state.marketShocks = surviving;
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
  const base =
    state.silver / prosperitySilverDiv + stockValue(state, goodDefs) / prosperityStockDiv;
  // Buildings raise prosperity directly (spec §6).
  return Math.round((base + buildingEffect(state, 'prosperityBonus')) * 10) / 10;
}

/** Buy at the post market. Returns false if silver is short. */
export function buyGood(state: GameState, def: GoodDef, qty: number): boolean {
  if (!isPositiveInt(qty)) return false;
  const cost = priceOf(state, def) * qty;
  if (state.silver < cost) return false;
  state.silver -= cost;
  state.goods[def.id] += qty;
  return true;
}

/** Sell at the post market. Returns false if stock is short. */
export function sellGood(state: GameState, def: GoodDef, qty: number): boolean {
  if (!isPositiveInt(qty)) return false;
  if (state.goods[def.id] < qty) return false;
  state.goods[def.id] -= qty;
  state.silver += priceOf(state, def) * qty;
  return true;
}
