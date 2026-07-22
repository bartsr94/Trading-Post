// The post's unnamed population (RESIDENTS_SPEC.md). Pure — no React, no
// content knowledge beyond tuning numbers. Selectors read the pool; the
// mutators here are called from the turn pipeline and store actions.

import { TUNING } from '../content/tuning';
import { addBuildProgress, buildingEffect } from './buildings';
import { diplomacySeatStateById, effectiveDiplomacyStanding } from './diplomacy';
import { clamp, discoveryAtLeast, RESIDENT_ROLES, stanceOf } from './types';
import type {
  GameState,
  HeritageGroup,
  ResidentRole,
  ResidentState,
  TransientKind,
} from './types';
import type { Rng } from './rng';

export type ContentmentBand = 'content' | 'grumbling' | 'unrest';

export function emptyRoles(): Record<ResidentRole, number> {
  return { farmers: 0, porters: 0, guards: 0, craftsfolk: 0 };
}

export function freshResidents(): ResidentState {
  return {
    roles: emptyRoles(),
    idle: 0,
    contentment: TUNING.residents.contentment.start,
    tags: {},
    heritage: { homeland: 0, native: 0 },
  };
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

// ------------------------------------------------------- heritage (HERITAGE_SPEC.md)

/** Heads of a given origin the post feeds (HERITAGE_SPEC.md §3.2). */
export function heritageCount(state: GameState, group: HeritageGroup): number {
  return state.residents.heritage[group];
}

/** Native heads ÷ total (0 when the pool is empty). */
export function nativeShare(state: GameState): number {
  const total = residentTotal(state);
  return total === 0 ? 0 : state.residents.heritage.native / total;
}

/**
 * Non-zero flavor-tag head counts, largest first — a finer breakdown than
 * the coarse homeland/native tally (e.g. distinguishing Kiswani from
 * Beastfolk within the same 'native' bucket). Partial: residents added
 * without a tag (organic growth, unlabeled hires) aren't represented here.
 */
export function residentTagCounts(state: GameState): [string, number][] {
  return Object.entries(state.residents.tags)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** Whichever origin currently forms the majority (ties → homeland). */
export function dominantGroup(state: GameState): HeritageGroup {
  return nativeShare(state) > 0.5 ? 'native' : 'homeland';
}

/** Nudge the culture axis (Homeland− ↔ Frontier+), clamped to the axis band. */
export function nudgeCulture(state: GameState, delta: number): void {
  state.axes.culture = clamp(state.axes.culture + delta, -10, 10);
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
 * many actually joined. `group` records their origin on the heritage tally
 * (kept summed-equal to residentTotal). Used by hiring, growth, axis arrivals,
 * and events.
 */
export function addResidents(
  state: GameState,
  role: ResidentRole | 'idle',
  count: number,
  tag?: string,
  group: HeritageGroup = 'homeland',
): number {
  if (count <= 0) return 0;
  const space = Math.max(0, residentCap(state) - residentTotal(state));
  const added = Math.min(count, space);
  if (added <= 0) return 0;
  if (role === 'idle') state.residents.idle += added;
  else state.residents.roles[role] += added;
  state.residents.heritage[group] += added;
  if (tag) state.residents.tags[tag] = (state.residents.tags[tag] ?? 0) + added;
  return added;
}

/**
 * Debits the heritage tally by `n` heads, keeping it summed-equal to the pool.
 * Biases toward `prefer` when given, otherwise splits proportionally to the
 * current mix (HERITAGE_SPEC.md §4).
 */
function debitHeritage(state: GameState, n: number, prefer?: HeritageGroup): void {
  if (n <= 0) return;
  const h = state.residents.heritage;
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

/**
 * Debits flavor-tag counts by `n` heads, proportionally to each tag's share
 * of the *pre-loss* population (not just the tagged subset — untagged heads
 * silently absorb their share, same as the heritage tally leaves no room for
 * a phantom "unlabeled" bucket). Called alongside `debitHeritage` so tag
 * counts stay a live, roughly-accurate breakdown rather than sticking at
 * their high-water mark forever.
 */
function debitTags(
  state: GameState,
  n: number,
  preLossTotal: number = residentTotal(state) + n,
): void {
  if (n <= 0) return;
  const tags = state.residents.tags;
  const entries = Object.entries(tags);
  if (entries.length === 0) return;
  if (preLossTotal <= 0) return;
  for (const [tag, count] of entries) {
    const debit = Math.min(count, Math.round(n * (count / preLossTotal)));
    if (debit <= 0) continue;
    const next = count - debit;
    if (next <= 0) delete tags[tag];
    else tags[tag] = next;
  }
}

/**
 * Removes the demographic contribution of residents already seconded to an
 * expedition. Their role counts left the post at dispatch, so only heritage
 * and flavor-tag metadata needs debiting here.
 */
export function loseResidentEscort(
  state: GameState,
  escort: Partial<Record<ResidentRole, number>> | undefined,
): number {
  if (!escort) return 0;
  const lost = RESIDENT_ROLES.reduce((sum, role) => sum + (escort[role] ?? 0), 0);
  if (lost <= 0) return 0;
  const preLossTotal = residentTotal(state);
  debitHeritage(state, lost);
  debitTags(state, lost, preLossTotal);
  return lost;
}

/**
 * Removes residents present at the post — idle first, then from the largest
 * role (or the named role). Never touches seconded escorts. `group` biases which
 * origin leaves on the heritage tally (default: proportional). Returns how many
 * actually left.
 */
export function loseResidents(
  state: GameState,
  role: ResidentRole | undefined,
  count: number,
  group?: HeritageGroup,
): number {
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

  const lost = count - remaining;
  debitHeritage(state, lost, group);
  debitTags(state, lost);
  return lost;
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

/** Silver to hire `count` native hands of a role locally (discounted from base). */
export function localHireCost(role: ResidentRole, count: number): number {
  return Math.ceil(TUNING.residents.hire.costPerHead[role] * TUNING.heritage.localCostMult) * count;
}

/**
 * Why hiring `count` of `role` from a native `source` (a tribe/region key into
 * TUNING.heritage.hireSources — 'tributary', 'bejasi_hills', 'dustwalker', …) is
 * invalid, or null when it may proceed. Native hands only — homeland hands are
 * fetched from Thornwatch (PEOPLES_SPEC.md §7.1) and Weri are heroes-only, so
 * neither has a hire source. Gated on reaching that seat and their goodwill.
 */
export function hireError(
  state: GameState,
  role: ResidentRole,
  count: number,
  source: string,
): string | null {
  if (count <= 0) return 'Hire at least one.';
  const src = TUNING.heritage.hireSources[source];
  if (!src) return 'No such people to hire from here.';
  const loc = state.locations[src.seat];
  if (!loc || !discoveryAtLeast(loc.discovery, 'visited')) {
    return 'You have not reached their people yet.';
  }
  const seat = diplomacySeatStateById(state, src.seat);
  const baseStanding = state.factions[src.faction].standing;
  const standing = seat ? effectiveDiplomacyStanding(state, seat) : baseStanding;
  const allianceBonus = seat?.pact === 'alliance' ? TUNING.diplomacy.allianceHiringBonus : 0;
  const grievancePenalty =
    (seat?.grievances ?? 0) * TUNING.diplomacy.grievanceHiringPenaltyPerPoint;
  const effectiveTrust = standing + allianceBonus - grievancePenalty;
  if (seat?.pact !== 'alliance' && stanceOf(baseStanding) === 'Hostile') {
    return 'They will not send their people to you.';
  }
  if (stanceOf(effectiveTrust) === 'Hostile') return 'They will not send their people to you.';
  if (effectiveTrust < TUNING.heritage.localHireStanding) {
    return seat && seat.grievances >= TUNING.diplomacy.grievanceWarningThreshold
      ? 'They remember old slights too clearly to send their people.'
      : 'They do not trust you enough yet.';
  }
  if (state.silver < localHireCost(role, count)) return 'Not enough silver.';
  if (residentTotal(state) + count > residentCap(state)) return 'No room for them yet.';
  return null;
}

/** Hire native hands of a role from a local source (instant; they know their trade). */
export function hireResidents(
  state: GameState,
  role: ResidentRole,
  count: number,
  source: string,
): boolean {
  if (hireError(state, role, count, source) !== null) return false;
  const src = TUNING.heritage.hireSources[source];
  state.silver -= localHireCost(role, count);
  addResidents(state, role, count, src.people, 'native');
  nudgeCulture(state, TUNING.heritage.hireAxisNudge * count);
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

  // A shrine, warren, or longhouse that speaks to the residents' own people.
  delta += buildingEffect(state, 'contentmentBonus');

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
  // Organic growth mirrors the post's existing makeup.
  return addResidents(state, 'idle', 1, undefined, dominantGroup(state));
}

/** Season-end arrivals driven by the settlement axes. Returns lines describing them. */
export function applyAxisArrivals(
  state: GameState,
): { tag: string; count: number; group: HeritageGroup }[] {
  const a = TUNING.residents.axisGrowth;
  const h = TUNING.heritage;
  const arrivals: { tag: string; count: number; group: HeritageGroup }[] = [];
  const draw = (tag: string, group: HeritageGroup) => {
    const added = addResidents(state, 'farmers', a.arrivalsPerSeason, tag, group);
    if (added > 0) arrivals.push({ tag, count: added, group });
  };
  if (state.axes.integration >= a.integrationThreshold) draw('native-kin', 'native');
  if (state.axes.communal >= a.communalThreshold) draw('settlers', 'homeland');
  // The post's cultural character draws its own kind (HERITAGE_SPEC.md §5.3).
  if (state.axes.culture >= h.frontierThreshold) draw('frontier-folk', 'native');
  if (state.axes.culture <= h.homelandThreshold) draw('homeland-folk', 'homeland');
  return arrivals;
}

/**
 * Season-end: the culture axis drifts toward the balance the resident tally
 * implies, so it self-corrects as the pool churns (HERITAGE_SPEC.md §5.1).
 * Returns the applied delta.
 */
export function applyCultureDrift(state: GameState): number {
  if (residentTotal(state) === 0) return 0;
  const target = (nativeShare(state) - 0.5) * 20; // map 0–1 share onto −10..+10
  const step = TUNING.heritage.axisDriftPerSeason;
  const before = state.axes.culture;
  nudgeCulture(state, clamp(target - before, -step, step));
  return state.axes.culture - before;
}
