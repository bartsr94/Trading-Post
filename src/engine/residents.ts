// The post's unnamed population (RESIDENTS_SPEC.md). Pure — no React, no
// content knowledge beyond tuning numbers. Selectors read the pool; the
// mutators here are called from the turn pipeline and store actions.

import { TUNING } from '../content/tuning';
import { addBuildProgress, buildingEffect } from './buildings';
import { clamp, RESIDENT_ROLES } from './types';
import type {
  GameState,
  Heritage,
  HeritageGroup,
  ResidentRole,
  ResidentState,
  TransientKind,
} from './types';
import type { Rng } from './rng';

export type ContentmentBand = 'content' | 'grumbling' | 'unrest';
export type FrictionBand = 'settled' | 'tense' | 'volatile';

export function emptyRoles(): Record<ResidentRole, number> {
  return { farmers: 0, porters: 0, guards: 0, craftsfolk: 0, herders: 0, hunters: 0 };
}

export function freshResidents(): ResidentState {
  return {
    roles: emptyRoles(),
    idle: 0,
    contentment: TUNING.residents.contentment.start,
    tags: {},
    heritage: { homeland: 0, native: 0 },
    friction: {},
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

/**
 * The population the Concession supports without resistance
 * (TULA_SETTLEMENT_SPEC.md §2.1). Replaces the old hard `residentCap`: the pool
 * may freely exceed this — over-Concession pressure (contentment + standing)
 * applies instead of a block.
 */
export function claimCapacity(state: GameState): number {
  return state.claim.size * TUNING.claim.residentsPerChain;
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

/** Current integration friction for a heritage, 0 if it never accrued one. */
export function frictionFor(state: GameState, heritage: Heritage): number {
  return state.residents.friction[heritage] ?? 0;
}

export function frictionBand(value: number): FrictionBand {
  const t = TUNING.residents.friction;
  if (value >= t.volatileThreshold) return 'volatile';
  if (value >= t.tenseThreshold) return 'tense';
  return 'settled';
}

/** Clamped 0–10 adjustment to a heritage's integration friction. */
export function adjustFriction(state: GameState, heritage: Heritage, delta: number): void {
  const next = clamp(frictionFor(state, heritage) + delta, 0, 10);
  state.residents.friction[heritage] = next;
}

/** Ongoing contentment drag from every heritage still sitting in the volatile
 *  band — mirrors `transientEffect`'s per-head-style pressure, but per group
 *  rather than per head (a whole cohort's unrest weighs on the pool once,
 *  not scaled by its size). */
export function frictionContentmentPressure(state: GameState): number {
  const t = TUNING.residents.friction;
  let pressure = 0;
  for (const value of Object.values(state.residents.friction)) {
    if (value !== undefined && frictionBand(value) === 'volatile') pressure += t.volatileContentmentPressure;
  }
  return pressure;
}

/** Friction settles naturally over time absent any event pushing it back up
 *  — called once per turn from `resolveResidentSociety`. */
export function driftFriction(state: GameState): void {
  const decay = TUNING.residents.friction.passiveDecayPerTurn;
  for (const heritage of Object.keys(state.residents.friction) as Heritage[]) {
    const value = state.residents.friction[heritage];
    if (value !== undefined && value > 0) {
      state.residents.friction[heritage] = Math.max(0, value - decay);
    }
  }
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
 * Adds residents into a role (or idle). Population is uncapped
 * (TULA_SETTLEMENT_SPEC.md §2) — crowding past what the Concession supports
 * costs mood and goodwill, it is never refused. Returns how many joined.
 * `group` records their origin on the heritage tally (kept summed-equal to
 * residentTotal). Used by settlement (Invite Settlers), growth, arrivals, events.
 */
export function addResidents(
  state: GameState,
  role: ResidentRole | 'idle',
  count: number,
  tag?: string,
  group: HeritageGroup = 'homeland',
): number {
  if (count <= 0) return 0;
  const added = count;
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

  // Crowding past what the Concession supports drags the mood (§2.1) — steeper
  // than the old over-cap penalty, since it is land the post never secured.
  const over = residentTotal(state) - claimCapacity(state);
  if (over > 0) delta -= TUNING.claim.overClaimPenalty * over;

  if (state.residents.idle > t.idleTolerance) delta -= t.idlePenalty;

  // Company inspectors and the like weigh on the mood while they linger.
  delta -= transientEffect(state, 'contentmentPressure');

  // A newly-settled group still working out its place in the post.
  delta -= frictionContentmentPressure(state);

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

/** A content post may draw a new pair of hands. Returns 1 if it grew. Growth is
 *  no longer cap-gated (TULA_SETTLEMENT_SPEC.md §2); over-Concession pressure
 *  self-limits it by pushing the pool out of the content band. */
export function applyGrowth(state: GameState, rng: Rng, prosperityScore: number): number {
  if (contentmentBand(state) !== 'content') return 0;
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
