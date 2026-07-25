// Forced labor — thralls to the Sauromatians, "indentured labor" to the
// Company, same mechanic either way (THRALLS_SPEC.md). A parallel pool to
// `residents.ts`, mirroring its shape and mutator discipline, but pure and
// deliberately without any import from `residents.ts` (residents.ts imports
// from here instead, so the two modules never cycle) — where a formula needs
// a free-resident number (guards on hand), it reads `state.residents` directly
// as plain data rather than calling into the sibling module.

import { TUNING } from '../content/tuning';
import { clamp, RESIDENT_ROLES } from './types';
import type { FactionId, GameState, HeritageGroup, ResidentRole, ThrallState } from './types';

export type RestivenessBand = 'settled' | 'uneasy' | 'restive';

export function emptyThrallRoles(): Record<ResidentRole, number> {
  return { farmers: 0, porters: 0, guards: 0, craftsfolk: 0, herders: 0, hunters: 0 };
}

export function freshThralls(): ThrallState {
  return {
    roles: emptyThrallRoles(),
    idle: 0,
    restiveness: TUNING.thralls.restiveness.start,
    tags: {},
    heritage: { homeland: 0, native: 0 },
  };
}

// ------------------------------------------------------------- selectors

/** Everyone the post feeds (no wage): present roles + idle. Thralls are never
 *  seconded to expeditions, so there is no away-total to add (cf. residentTotal). */
export function thrallTotal(state: GameState): number {
  const t = state.thralls;
  return RESIDENT_ROLES.reduce((s, role) => s + t.roles[role], 0) + t.idle;
}

/** Thralls present at the post in a role. */
export function thrallsAvailable(state: GameState, role: ResidentRole): number {
  return state.thralls.roles[role];
}

/** Heads of a given origin held as thralls — mirrors `heritageCount` in
 *  residents.ts, one-directional import discipline still holds since this
 *  reads `state.thralls` only. */
export function thrallHeritageCount(state: GameState, group: HeritageGroup): number {
  return state.thralls.heritage[group];
}

/** Non-zero flavor-tag head counts among thralls, largest first — mirrors
 *  `residentTagCounts`. */
export function thrallTagCounts(state: GameState): [string, number][] {
  return Object.entries(state.thralls.tags)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** Count for conditions: a specific role's present count, or the whole pool. */
export function thrallCount(state: GameState, role?: ResidentRole): number {
  return role ? thrallsAvailable(state, role) : thrallTotal(state);
}

export function restivenessBand(state: GameState): RestivenessBand {
  const v = state.thralls.restiveness;
  const t = TUNING.thralls.restiveness;
  if (v >= t.restiveThreshold) return 'restive';
  if (v <= t.settledThreshold) return 'settled';
  return 'uneasy';
}

/** Thrall role output vs. a free resident's, per the guard:thrall ratio
 *  (THRALLS_SPEC.md's output-penalty-offset-by-guards lever). Guards are a
 *  free-resident role — thralls can never be guards themselves. */
export function thrallOutputMultiplier(state: GameState): number {
  const total = thrallTotal(state);
  if (total === 0) return 1;
  const t = TUNING.thralls.output;
  const ratio = state.residents.roles.guards / total;
  return ratio >= t.guardRatioForFullOutput ? t.guardedOutputMult : t.unguardedOutputMult;
}

/** Ongoing drag on the free resident pool's mood from living alongside a held
 *  forced-labor population, scaled by the thrall:free-resident ratio. Read by
 *  `residents.ts`'s `updateContentment` (one-directional import, no cycle). */
export function thrallContentmentPressure(state: GameState, freeResidentTotal: number): number {
  const total = thrallTotal(state);
  if (total === 0) return 0;
  const ratio = total / Math.max(1, freeResidentTotal);
  return ratio * TUNING.thralls.contentmentPressure.perRatioPoint;
}

// -------------------------------------------------------------- mutators

/** Adds thralls into a role (or idle). Mirrors `addResidents` exactly, minus
 *  anything wage-related. Returns how many joined. */
export function addThralls(
  state: GameState,
  role: ResidentRole | 'idle',
  count: number,
  tag?: string,
  group: HeritageGroup = 'native',
): number {
  if (count <= 0) return 0;
  if (role === 'idle') state.thralls.idle += count;
  else state.thralls.roles[role] += count;
  state.thralls.heritage[group] += count;
  if (tag) state.thralls.tags[tag] = (state.thralls.tags[tag] ?? 0) + count;
  return count;
}

function debitThrallHeritage(state: GameState, n: number, prefer?: HeritageGroup): void {
  if (n <= 0) return;
  const h = state.thralls.heritage;
  const before = h.homeland + h.native;
  if (before <= 0) return;
  let native: number;
  if (prefer === 'native') native = Math.min(n, h.native);
  else if (prefer === 'homeland') native = n - Math.min(n, h.homeland);
  else native = Math.min(h.native, Math.round(n * (h.native / before)));
  native = clamp(native, Math.max(0, n - h.homeland), Math.min(n, h.native));
  h.native -= native;
  h.homeland -= n - native;
}

function debitThrallTags(
  state: GameState,
  n: number,
  preLossTotal: number = thrallTotal(state) + n,
): void {
  if (n <= 0) return;
  const tags = state.thralls.tags;
  const entries = Object.entries(tags);
  if (entries.length === 0 || preLossTotal <= 0) return;
  for (const [tag, count] of entries) {
    const debit = Math.min(count, Math.round(n * (count / preLossTotal)));
    if (debit <= 0) continue;
    const next = count - debit;
    if (next <= 0) delete tags[tag];
    else tags[tag] = next;
  }
}

/** Removes thralls present at the post — idle first, then the largest role
 *  (or the named role). Mirrors `loseResidents`. Returns how many actually left. */
export function loseThralls(
  state: GameState,
  role: ResidentRole | undefined,
  count: number,
  group?: HeritageGroup,
): number {
  if (count <= 0) return 0;
  let remaining = count;
  const t = state.thralls;

  if (role === undefined && t.idle > 0) {
    const take = Math.min(remaining, t.idle);
    t.idle -= take;
    remaining -= take;
  }

  while (remaining > 0) {
    let target: ResidentRole | 'idle' | null = null;
    if (role !== undefined) {
      target = t.roles[role] > 0 ? role : t.idle > 0 ? 'idle' : null;
    } else {
      let best: ResidentRole | null = null;
      for (const candidate of RESIDENT_ROLES) {
        if (t.roles[candidate] > 0 && (best === null || t.roles[candidate] > t.roles[best])) {
          best = candidate;
        }
      }
      target = best ?? (t.idle > 0 ? 'idle' : null);
    }
    if (target === null) break;
    if (target === 'idle') t.idle -= 1;
    else t.roles[target] -= 1;
    remaining -= 1;
  }

  const lost = count - remaining;
  debitThrallHeritage(state, lost, group);
  debitThrallTags(state, lost);
  return lost;
}

/** Move thralls between roles/idle at the post. Mirrors `reallocate` — never
 *  lets a head land in 'guards' (THRALLS_SPEC.md decision #7). */
export function reallocateThralls(
  state: GameState,
  from: ResidentRole | 'idle',
  to: ResidentRole | 'idle',
  count: number,
): boolean {
  if (count <= 0 || from === to || to === 'guards') return false;
  const t = state.thralls;
  const available = from === 'idle' ? t.idle : t.roles[from];
  if (available < count) return false;
  if (from === 'idle') t.idle -= count;
  else t.roles[from] -= count;
  if (to === 'idle') t.idle += count;
  else t.roles[to] += count;
  return true;
}

/** Clamped 0–10 adjustment to restiveness. */
export function adjustRestiveness(state: GameState, delta: number): void {
  const t = TUNING.thralls.restiveness;
  state.thralls.restiveness = clamp(state.thralls.restiveness + delta, t.min, t.max);
}

/**
 * Recomputes restiveness from the turn's outcomes — ratio pressure and shared
 * hardship push it up, free-resident guards suppress it. Mirrors
 * `updateContentment`'s delta-sum pattern. No-op with an empty pool.
 */
export function updateRestiveness(state: GameState, flags: { missedFood: boolean }): number {
  const total = thrallTotal(state);
  if (total === 0) return 0;
  const t = TUNING.thralls.restiveness;
  const freeTotal = RESIDENT_ROLES.reduce((s, role) => s + state.residents.roles[role], 0) + state.residents.idle;
  const ratio = total / Math.max(1, freeTotal);
  let delta = ratio * t.ratioPressurePerRatioPoint;
  if (flags.missedFood) delta += t.missedFoodPenalty;
  delta -= state.residents.roles.guards * t.guardSuppressionPerGuard;
  adjustRestiveness(state, delta);
  return delta;
}

/** Thralls flee while restive — a permanent loss, no recapture mechanic.
 *  Mirrors `applyDesertion`. Returns how many escaped. */
export function applyEscape(state: GameState): number {
  if (restivenessBand(state) !== 'restive') return 0;
  const total = thrallTotal(state);
  if (total === 0) return 0;
  const e = TUNING.thralls.escape;
  const rate = Math.max(0, e.restiveEscapeRate - state.residents.roles.guards * e.guardSuppressionPerPoint);
  const leaving = Math.ceil(total * rate);
  return loseThralls(state, undefined, leaving);
}

/** Whether any non-hostile native faction stands to gain/lose standing from
 *  the post's thrall-holding (THRALLS_SPEC.md's standing lever + manumission's
 *  mirrored upside) — deliberately not tracked per-origin-faction. */
function nonHostileNativeFactions(state: GameState): FactionId[] {
  return TUNING.thralls.holding.nativeFactions.filter((f) => state.factions[f].standing > -50);
}

/** Season-end: holding any thralls at all costs a little native goodwill and
 *  nudges the culture axis toward Frontier — deliberately leaves the trace the
 *  still-unbuilt Company-judgment mechanism would read, without building it. */
export function applyHoldingPressure(state: GameState): { standingLoss: boolean; cultureNudge: number } {
  const total = thrallTotal(state);
  if (total === 0) return { standingLoss: false, cultureNudge: 0 };
  const h = TUNING.thralls.holding;
  const targets = nonHostileNativeFactions(state);
  for (const f of targets) {
    state.factions[f].standing = clamp(state.factions[f].standing - h.nativeStandingLossPerSeason, -100, 100);
  }
  state.axes.culture = clamp(state.axes.culture + h.cultureNudgePerSeason, -10, 10);
  return { standingLoss: targets.length > 0, cultureNudge: h.cultureNudgePerSeason };
}

/**
 * Frees `count` thralls from `role` into ordinary free residents (same role,
 * or idle) — the counter-play to holding (THRALLS_SPEC.md's Manumission
 * section). Does not itself touch silver; callers charge
 * `TUNING.thralls.manumission.silverPerHead` before calling. Returns how many
 * were actually freed (may be fewer than requested if the role/idle pool is
 * short).
 */
export function manumitThralls(
  state: GameState,
  role: ResidentRole | 'idle',
  count: number,
): number {
  if (count <= 0) return 0;
  const t = state.thralls;
  const available = role === 'idle' ? t.idle : t.roles[role];
  const freed = Math.min(available, count);
  if (freed <= 0) return 0;

  if (role === 'idle') t.idle -= freed;
  else t.roles[role] -= freed;

  const before = thrallTotal(state) + freed;
  // Carry proportional tag shares across to the resident pool, same discipline
  // `debitTags`/`debitHeritage` use elsewhere for head-count moves.
  for (const [tag, tagCount] of Object.entries(t.tags)) {
    const share = Math.min(tagCount, Math.round(freed * (tagCount / before)));
    if (share <= 0) continue;
    t.tags[tag] = tagCount - share;
    if (t.tags[tag] <= 0) delete t.tags[tag];
    state.residents.tags[tag] = (state.residents.tags[tag] ?? 0) + share;
  }
  const nativeShare = Math.min(t.heritage.native, Math.round(freed * (t.heritage.native / before)));
  t.heritage.native -= nativeShare;
  t.heritage.homeland -= freed - nativeShare;
  state.residents.heritage.native += nativeShare;
  state.residents.heritage.homeland += freed - nativeShare;

  if (role === 'idle') state.residents.idle += freed;
  else state.residents.roles[role] += freed;

  const m = TUNING.thralls.manumission;
  const targets = nonHostileNativeFactions(state);
  for (const f of targets) {
    state.factions[f].standing = clamp(
      state.factions[f].standing + m.standingGainPerHead * freed,
      -100,
      100,
    );
  }
  state.axes.culture = clamp(state.axes.culture - m.cultureNudge, -10, 10);

  return freed;
}
