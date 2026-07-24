// The Concession, settlement & farming (TULA_SETTLEMENT_SPEC.md). Pure — reads
// TUNING + state (+ injected location defs for the "nearest neighbour"
// selector). Land is measured in chains; population is uncapped and the
// Concession is a soft support threshold, not a hard wall.

import { TUNING } from '../content/tuning';
import { buildingEffect } from './buildings';
import { journeyTurns } from './map';
import {
  claimCapacity,
  claimedPopulation,
  outputMultiplier,
  residentsAvailable,
} from './residents';
import { thrallOutputMultiplier, thrallsAvailable } from './thralls';
import { clamp, discoveryAtLeast, isNativeHeritage } from './types';
import type {
  ClaimState,
  FactionId,
  GameState,
  HerdState,
  LandUse,
  LocationDef,
  LocationId,
} from './types';
import type { Rng } from './rng';

const C = TUNING.claim;

export function freshClaim(): ClaimState {
  return {
    size: C.startingSize,
    allocation: {
      cropland: C.startingAllocation.cropland,
      pasture: C.startingAllocation.pasture,
      wildland: C.startingAllocation.wildland,
    },
    cropProgress: 0,
  };
}

export function freshHerd(): HerdState {
  return { count: 0 };
}

// ---------------------------------------------------------------- selectors

/** Chains given to a land use, rounded (TULA_SETTLEMENT_SPEC.md §2.2). */
export function landChains(state: GameState, use: LandUse): number {
  return Math.round(state.claim.size * (state.claim.allocation[use] / 100));
}

/** Farmers the cropland can usefully employ. */
export function croplandCapacity(state: GameState): number {
  return Math.floor(landChains(state, 'cropland') / C.chainsPerFarmer);
}

/** Herders the pasture can usefully employ. */
export function pastureCapacity(state: GameState): number {
  return Math.floor(landChains(state, 'pasture') / C.chainsPerHerder);
}

/** Hunters the wildland can usefully employ. */
export function wildlandCapacity(state: GameState): number {
  return Math.floor(landChains(state, 'wildland') / C.chainsPerHunter);
}

/** Head of livestock the pasture can carry. */
export function herdCarryingCapacity(state: GameState): number {
  return landChains(state, 'pasture') * C.herdPerPastureChain;
}

/** True when the population (free residents + held thralls) has run past
 *  what the Concession supports (§2.1; THRALLS_SPEC.md decision #6). */
export function isOverClaim(state: GameState): boolean {
  return claimedPopulation(state) > claimCapacity(state);
}

/**
 * Re-split the Concession across the three uses. Validates the percentages are
 * whole, non-negative, and sum to 100 — free & instant, like role reallocation.
 */
export function setLandAllocation(state: GameState, allocation: Record<LandUse, number>): boolean {
  const values = [allocation.cropland, allocation.pasture, allocation.wildland];
  if (values.some((v) => !Number.isFinite(v) || v < 0 || !Number.isInteger(v))) return false;
  if (values.reduce((a, b) => a + b, 0) !== 100) return false;
  state.claim.allocation = {
    cropland: allocation.cropland,
    pasture: allocation.pasture,
    wildland: allocation.wildland,
  };
  return true;
}

// -------------------------------------------------------- claim/herd mutators

/** Grow (or shrink) the Concession (event outcome / Negotiate Land homecoming). */
export function addClaim(state: GameState, delta: number): void {
  state.claim.size = Math.max(0, state.claim.size + delta);
}

/** Grow or cull the herd (event outcome — raids, disease, a windfall). */
export function addHerd(state: GameState, delta: number): void {
  state.herd.count = Math.max(0, state.herd.count + delta);
}

// ------------------------------------------------------------------ per turn

/** Farmers add effort to the season's cropProgress (mood-scaled). Thralls fill
 *  whatever cropland capacity free farmers leave spare, at their own output
 *  rate (THRALLS_SPEC.md: thralls work the same land, just less productively).
 *  Returns added. */
export function accrueCropProgress(state: GameState): number {
  const cap = croplandCapacity(state);
  const farmers = Math.min(residentsAvailable(state, 'farmers'), cap);
  const thrallFarmers = Math.min(thrallsAvailable(state, 'farmers'), Math.max(0, cap - farmers));
  const gain = Math.round(
    farmers * C.yieldPerFarmerPerTurn * outputMultiplier(state) +
      thrallFarmers * C.yieldPerFarmerPerTurn * thrallOutputMultiplier(state),
  );
  if (gain > 0) state.claim.cropProgress += gain;
  return gain;
}

/** Hunters bring in a continuous small Food trickle (mood-scaled), thralls
 *  filling spare wildland capacity the same way farmers do. Returns added. */
export function wildlandTrickle(state: GameState): number {
  const cap = wildlandCapacity(state);
  const hunters = Math.min(residentsAvailable(state, 'hunters'), cap);
  const thrallHunters = Math.min(thrallsAvailable(state, 'hunters'), Math.max(0, cap - hunters));
  const gain = Math.round(
    hunters * C.yieldPerHunterPerTurn * outputMultiplier(state) +
      thrallHunters * C.yieldPerHunterPerTurn * thrallOutputMultiplier(state),
  );
  if (gain > 0) state.goods.grain += gain;
  return gain;
}

/** Herders grow the herd toward its carrying capacity, thralls filling spare
 *  pasture capacity the same way. Returns growth added. */
export function growHerd(state: GameState): number {
  const cap = herdCarryingCapacity(state);
  if (state.herd.count >= cap) return 0;
  const pastureCap = pastureCapacity(state);
  const herders = Math.min(residentsAvailable(state, 'herders'), pastureCap);
  const thrallHerders = Math.min(thrallsAvailable(state, 'herders'), Math.max(0, pastureCap - herders));
  if (herders <= 0 && thrallHerders <= 0) return 0;
  const grown = Math.round(
    herders * C.herdGrowthPerHerder * outputMultiplier(state) +
      thrallHerders * C.herdGrowthPerHerder * thrallOutputMultiplier(state),
  );
  const next = Math.min(cap, state.herd.count + grown);
  const added = next - state.herd.count;
  state.herd.count = next;
  return added;
}

export interface HarvestResult {
  cropFood: number;
  cropFailed: boolean;
  herdFood: number;
}

/**
 * Season end (§4.1/§4.2): the accumulated cropProgress becomes a lump Food
 * harvest — ordinary variance, plus a rare true crop-failure branch — and the
 * herd yields milk-and-hide surplus (never eaten down by ordinary yield).
 */
export function resolveHarvest(state: GameState, rng: Rng): HarvestResult {
  const progress = state.claim.cropProgress;
  let cropFood = 0;
  let cropFailed = false;
  if (progress > 0) {
    let mult: number;
    if (rng.next() < C.cropFailureChance) {
      mult = C.cropFailureMult;
      cropFailed = true;
    } else {
      mult = clamp(
        1 + (rng.next() * 2 - 1) * C.harvestVariance,
        C.harvestMultMin,
        C.harvestMultMax,
      );
    }
    cropFood = Math.max(0, Math.round(progress * mult));
    // A storehouse keeps more of a good harvest from spoiling (§7).
    if (cropFood > 0) cropFood += buildingEffect(state, 'foodStorageBonus');
  }
  state.claim.cropProgress = 0;

  const herdFood = Math.round(state.herd.count * C.herdYieldFraction);
  const total = cropFood + herdFood;
  if (total > 0) state.goods.grain += total;
  return { cropFood, cropFailed, herdFood };
}

// --------------------------------------------- over-Concession standing target

/**
 * The nearest native people whose seat the post has discovered (spatial
 * distance from the post). Null until a native seat is found (§2.1).
 */
export function nearestDiscoveredNativeFaction(
  state: GameState,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
): FactionId | null {
  const home = locationDefs.get(TUNING.map.homeLocationId);
  let best: FactionId | null = null;
  let bestTurns = Infinity;
  for (const src of Object.values(TUNING.heritage.hireSources)) {
    if (!isNativeHeritage(src.people)) continue;
    const loc = state.locations[src.seat];
    if (!loc || !discoveryAtLeast(loc.discovery, 'visited')) continue;
    const def = locationDefs.get(src.seat);
    if (!def) continue;
    const turns = home ? journeyTurns(home.mapPoint, def.mapPoint, 'normal') : 0;
    if (turns < bestTurns) {
      bestTurns = turns;
      best = src.faction;
    }
  }
  return best;
}

/**
 * Whose goodwill the post spends by crowding the Concession: the negotiated
 * landholder once one exists, else the nearest discovered native people (§2.1).
 */
export function overClaimStandingTarget(
  state: GameState,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
): FactionId | null {
  if (state.claim.landholder) return state.claim.landholder;
  return nearestDiscoveredNativeFaction(state, locationDefs);
}
