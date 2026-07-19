// Buildings & construction (BUILDINGS_SPEC.md). Pure — reads TUNING + state
// only, no content imports. Effects are DERIVED (never stored): selectors sum
// the completed-building set each time they're asked, so a balance tweak in
// TUNING.building never needs a save migration. Completed buildings are a plain
// id list on GameState; one construction project runs at a time.

import { TUNING } from '../content/tuning';
import { clamp } from './types';
import type { BuildingEffects, BuildingId, GameState, GoodId, TierRequirement } from './types';

const B = TUNING.building;

// -------------------------------------------------------------- selectors

/** Whether a building has been completed. */
export function hasBuilding(state: GameState, id: BuildingId): boolean {
  return state.buildings.includes(id);
}

/** Sum one passive effect field across every completed building. */
export function buildingEffect(state: GameState, field: keyof BuildingEffects): number {
  let sum = 0;
  for (const id of state.buildings) {
    const def = B.defs[id];
    if (def) sum += def.effects[field] ?? 0;
  }
  return sum;
}

// ------------------------------------------------------------ construction

/** Why building `id` can't be started right now, or null if it may proceed. */
export function constructionError(state: GameState, id: BuildingId): string | null {
  const def = B.defs[id];
  if (!def) return 'No such building.';
  if (hasBuilding(state, id)) return 'Already built.';
  if (state.construction) return 'Finish or cancel the current project first.';
  for (const req of def.prerequisites) {
    if (!hasBuilding(state, req)) return `Requires the ${req.replace('_', ' ')} first.`;
  }
  if (state.silver < def.cost.silver) return `Short ${def.cost.silver - state.silver} silver.`;
  for (const [good, qty] of Object.entries(def.cost.goods ?? {}) as [GoodId, number][]) {
    const held = state.goods[good] ?? 0;
    if (held < qty) return `Short ${qty - held} ${good}.`;
  }
  return null;
}

/** Start building `id`: deduct the cost up front, open the construction slot. */
export function startConstruction(state: GameState, id: BuildingId): boolean {
  if (constructionError(state, id) !== null) return false;
  const def = B.defs[id];
  state.silver -= def.cost.silver;
  for (const [good, qty] of Object.entries(def.cost.goods ?? {}) as [GoodId, number][]) {
    state.goods[good] = Math.max(0, (state.goods[good] ?? 0) - qty);
  }
  state.construction = { building: id, progress: 0 };
  return true;
}

/** Abandon the active project. Paid costs are forfeit — they're already spent. */
export function cancelConstruction(state: GameState): void {
  state.construction = null;
}

/** Add progress to the active project (Build turns, or an event windfall/setback). */
export function addBuildProgress(state: GameState, delta: number): void {
  if (!state.construction) return;
  state.construction.progress = Math.max(0, state.construction.progress + delta);
}

/**
 * Complete the active project if its progress has reached the threshold.
 * Returns the finished building id, or null when nothing completed.
 */
export function completeConstructionIfDone(state: GameState): BuildingId | null {
  const c = state.construction;
  if (!c) return null;
  const def = B.defs[c.building];
  if (!def || c.progress < def.buildProgress) return null;
  if (!state.buildings.includes(c.building)) state.buildings.push(c.building);
  state.construction = null;
  return c.building;
}

/** Grant a building outright (an event gift). No cost, no project needed. */
export function grantBuilding(state: GameState, id: BuildingId): boolean {
  if (!B.defs[id] || state.buildings.includes(id)) return false;
  state.buildings.push(id);
  if (state.construction?.building === id) state.construction = null;
  return true;
}

// ------------------------------------------------------------ tier advancement

/** The requirement to reach `tier`, if the ladder defines one. */
export function tierRequirement(tier: number): TierRequirement | undefined {
  return B.tierLadder.find((t) => t.tier === tier);
}

/** Whether the post can advance to the next tier right now (buildings + silver). */
export function canAdvanceTier(state: GameState): boolean {
  const req = tierRequirement(state.postTier + 1);
  if (!req) return false;
  if (state.silver < req.silverCost) return false;
  return req.requiredBuildings.every((b) => state.buildings.includes(b));
}

/** Advance one tier if eligible, paying the recipe's silver. Returns the new tier, or null. */
export function advanceTier(state: GameState): number | null {
  if (!canAdvanceTier(state)) return null;
  const req = tierRequirement(state.postTier + 1)!;
  state.silver = Math.max(0, state.silver - req.silverCost);
  state.postTier = clamp(state.postTier + 1, 1, 4);
  return state.postTier;
}
