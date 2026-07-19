// The post's unnamed population (RESIDENTS_SPEC.md). Pure — no React, no
// content knowledge beyond tuning numbers. Selectors read the pool; the
// mutators here are called from the turn pipeline and store actions.

import { TUNING } from '../content/tuning';
import { addBuildProgress, buildingEffect } from './buildings';
import { clamp, RESIDENT_ROLES } from './types';
import type { GameState, ResidentRole, ResidentState, TransientKind } from './types';
import type { Rng } from './rng';

export type ContentmentBand = 'content' | 'grumbling' | 'unrest';

export function emptyRoles(): Record<ResidentRole, number> {
  return { farmers: 0, porters: 0, guards: 0, craftsfolk: 0 };
}

export function freshResidents(): ResidentState {
  return { roles: emptyRoles(), idle: 0, contentment: TUNING.residents.contentment.start, tags: [] };
}

// ------------------------------------------------------------- selectors

/** Residents currently seconded to expeditions, summed by role. */
export function residentsAway(state: GameState): Record<ResidentRole, number> {
  const away = emptyRoles();
  for (const exp of state.expeditions) {
    if (!exp.residentEscort) continue;
    for (const role of RESIDENT_ROLES) away[role] += exp.residentEscort[role] ?? 0;
  }
  return away;
}

function awayTotal(state: GameState): number {
  const away = residentsAway(state);
  return RESIDENT_ROLES.reduce((s, role) => s + away[role], 0);
}

/** Everyone the post feeds & pays: present roles + idle + seconded escorts. */
export function residentTotal(state: GameState): number {
  const r = state.residents;
  return RESIDENT_ROLES.reduce((s, role) => s + r.roles[role], 0) + r.idle + awayTotal(state);
}

/** Residents present at the post in a role (escorts are removed at dispatch). */
export function residentsAvailable(state: GameState, role: ResidentRole): number {
  return state.residents.roles[role];
}

/** Count for conditions: a specific role's present count, or the whole pool. */
export function residentCount(state: GameState, role?: ResidentRole): number {
  return role ? residentsAvailable(state, role) : residentTotal(state);
}

export function residentCap(state: GameState): number {
  // Tier floor + whatever completed buildings add (Storehouse, Common House…).
  return (TUNING.residents.capByTier[state.postTier] ?? 0) + buildingEffect(state, 'residentCapBonus');
}

export type TransientEffectField = 'defenseBonus' | 'contentmentPressure' | 'cargoBonus';

/** Sums a transient effect field across every group present, weighted by head count. */
export function transientEffect(state: GameState, field: TransientEffectField): number {
  const effects = TUNING.residents.transients.effects;
  return state.transients.reduce((sum, t) => sum + (effects[t.kind]?.[field] ?? 0) * t.count, 0);
}

/** Guards present + walls + visiting guards contribute post defense (read by raids later; suppresses unrest now). */
export function postDefense(state: GameState): number {
  return (
    residentsAvailable(state, 'guards') * TUNING.residents.effects.postDefensePerGuard +
    buildingEffect(state, 'defenseBonus') +
    transientEffect(state, 'defenseBonus')
  );
}

export function contentmentBand(state: GameState): ContentmentBand {
  const c = state.residents.contentment;
  const t = TUNING.residents.contentment;
  if (c >= t.contentThreshold) return 'content';
  if (c <= t.unrestThreshold) return 'unrest';
  return 'grumbling';
}

/** Role-output multiplier from the current contentment band. */
export function outputMultiplier(state: GameState): number {
  const t = TUNING.residents.contentment;
  switch (contentmentBand(state)) {
    case 'unrest':
      return t.unrestOutputMult;
    case 'grumbling':
      return t.grumblingOutputMult;
    default:
      return 1;
  }
}

// -------------------------------------------------------------- mutators

/**
 * Adds residents into a role (or idle), never exceeding the cap. Returns how
 * many actually joined. Used by hiring, growth, axis arrivals, and events.
 */
export function addResidents(
  state: GameState,
  role: ResidentRole | 'idle',
  count: number,
  tag?: string,
): number {
  if (count <= 0) return 0;
  const space = Math.max(0, residentCap(state) - residentTotal(state));
  const added = Math.min(count, space);
  if (added <= 0) return 0;
  if (role === 'idle') state.residents.idle += added;
  else state.residents.roles[role] += added;
  if (tag && !state.residents.tags.includes(tag)) state.residents.tags.push(tag);
  return added;
}

/**
 * Removes residents present at the post — idle first, then from the largest
 * role (or the named role). Never touches seconded escorts. Returns how many
 * actually left.
 */
export function loseResidents(state: GameState, role: ResidentRole | undefined, count: number): number {
  if (count <= 0) return 0;
  let remaining = count;
  const r = state.residents;

  if (role === undefined && r.idle > 0) {
    const take = Math.min(remaining, r.idle);
    r.idle -= take;
    remaining -= take;
  }

  while (remaining > 0) {
    let target: ResidentRole | 'idle' | null = null;
    if (role !== undefined) {
      target = r.roles[role] > 0 ? role : r.idle > 0 ? 'idle' : null;
    } else {
      // Largest role, then idle as a fallback.
      let best: ResidentRole | null = null;
      for (const candidate of RESIDENT_ROLES) {
        if (r.roles[candidate] > 0 && (best === null || r.roles[candidate] > r.roles[best])) {
          best = candidate;
        }
      }
      target = best ?? (r.idle > 0 ? 'idle' : null);
    }
    if (target === null) break;
    if (target === 'idle') r.idle -= 1;
    else r.roles[target] -= 1;
    remaining -= 1;
  }

  return count - remaining;
}

/** Move residents between roles/idle at the post (present counts only). */
export function reallocate(
  state: GameState,
  from: ResidentRole | 'idle',
  to: ResidentRole | 'idle',
  count: number,
): boolean {
  if (count <= 0 || from === to) return false;
  const r = state.residents;
  const available = from === 'idle' ? r.idle : r.roles[from];
  if (available < count) return false;
  if (from === 'idle') r.idle -= count;
  else r.roles[from] -= count;
  if (to === 'idle') r.idle += count;
  else r.roles[to] += count;
  return true;
}

/** Why hiring `count` of `role` is invalid, or null when it may proceed. */
export function hireError(state: GameState, role: ResidentRole, count: number): string | null {
  if (count <= 0) return 'Hire at least one.';
  const cost = TUNING.residents.hire.costPerHead[role] * count;
  if (state.silver < cost) return 'Not enough silver.';
  if (residentTotal(state) + count > residentCap(state)) return 'No room for them yet.';
  return null;
}

/** Pay to bring on residents of a role (they arrive knowing their trade). */
export function hireResidents(state: GameState, role: ResidentRole, count: number): boolean {
  if (hireError(state, role, count) !== null) return false;
  state.silver -= TUNING.residents.hire.costPerHead[role] * count;
  state.residents.roles[role] += count;
  return true;
}

/** Set contentment by a delta, clamped to the tuning band. */
export function adjustContentment(state: GameState, delta: number): void {
  const t = TUNING.residents.contentment;
  state.residents.contentment = clamp(state.residents.contentment + delta, t.min, t.max);
}

// ----------------------------------------------------------------- transients

/** Adds a transient group to the post. `turns` of -1 means indefinite. */
export function addTransientGroup(
  state: GameState,
  kind: TransientKind,
  count: number,
  turns: number,
): void {
  if (count <= 0) return;
  state.transients.push({ id: `tr_${state.nextTransientId}`, kind, count, turnsLeft: turns });
  state.nextTransientId += 1;
}

/** Removes every transient group of a kind (e.g. inspectors leaving on a met quota). */
export function removeTransients(state: GameState, kind: TransientKind): number {
  const before = state.transients.length;
  state.transients = state.transients.filter((t) => t.kind !== kind);
  return before - state.transients.length;
}

// --------------------------------------------------- craftsfolk build crews

/**
 * Craftsfolk present at the post press the active construction forward each turn
 * (passive, mood-scaled — like farmers yielding grain). Returns progress added.
 */
export function applyCraftsfolkConstruction(state: GameState): number {
  if (!state.construction) return 0;
  const crew = residentsAvailable(state, 'craftsfolk');
  const gain = Math.round(
    crew * TUNING.residents.effects.crewYieldPerCraftsperson * outputMultiplier(state),
  );
  if (gain <= 0) return 0;
  addBuildProgress(state, gain);
  return gain;
}

// --------------------------------------------------- per-turn society tick

export interface UpkeepFlags {
  missedFood: boolean;
  missedWages: boolean;
}

/**
 * Recomputes contentment from the turn's outcomes. No-op with an empty pool.
 * Called after upkeep/wages, before desertion and growth.
 */
export function updateContentment(state: GameState, flags: UpkeepFlags): number {
  if (residentTotal(state) === 0) return 0;
  const t = TUNING.residents.contentment;
  let delta = 0;
  if (flags.missedFood) delta -= t.missedFoodPenalty;
  if (flags.missedWages) delta -= t.missedWagePenalty;

  const over = residentTotal(state) - residentCap(state);
  if (over > 0) delta -= t.overCapPenalty * over;

  if (state.residents.idle > t.idleTolerance) delta -= t.idlePenalty;

  // Company inspectors and the like weigh on the mood while they linger.
  delta -= transientEffect(state, 'contentmentPressure');

  // Nothing went wrong this turn → the pool settles upward.
  if (delta === 0) delta = t.fedPaidDrift;

  adjustContentment(state, delta);
  return delta;
}

/** Residents desert while contentment sits in the unrest band. Returns how many left. */
export function applyDesertion(state: GameState): number {
  if (contentmentBand(state) !== 'unrest') return 0;
  const total = residentTotal(state);
  if (total === 0) return 0;
  const d = TUNING.residents.desertion;
  const rate = Math.max(0, d.unrestDesertRate - postDefense(state) * d.guardSuppressionPerPoint);
  const leaving = Math.ceil(total * rate);
  return loseResidents(state, undefined, leaving);
}

/** A content, under-cap post may draw a new pair of hands. Returns 1 if it grew. */
export function applyGrowth(state: GameState, rng: Rng, prosperityScore: number): number {
  if (contentmentBand(state) !== 'content') return 0;
  if (residentTotal(state) >= residentCap(state)) return 0;
  const g = TUNING.residents.growth;
  const chance = g.baseGrowthChance + Math.max(0, prosperityScore) * g.prosperityBonus;
  if (rng.next() >= chance) return 0;
  return addResidents(state, 'idle', 1);
}

/** Season-end arrivals driven by the settlement axes. Returns lines describing them. */
export function applyAxisArrivals(state: GameState): { tag: string; count: number }[] {
  const a = TUNING.residents.axisGrowth;
  const arrivals: { tag: string; count: number }[] = [];
  if (state.axes.integration >= a.integrationThreshold) {
    const added = addResidents(state, 'farmers', a.arrivalsPerSeason, 'native-kin');
    if (added > 0) arrivals.push({ tag: 'native-kin', count: added });
  }
  if (state.axes.communal >= a.communalThreshold) {
    const added = addResidents(state, 'farmers', a.arrivalsPerSeason, 'settlers');
    if (added > 0) arrivals.push({ tag: 'settlers', count: added });
  }
  return arrivals;
}
