// The family graph (FAMILY_SPEC.md §4): a graph over named people — Heroes as
// roots plus Dependants (spouses, children, grown kin) linked by parentIds and
// spouseId. Pure: no React, no content, no names (callers supply names drawn
// from content/names.ts). Selectors read the graph; mutators form unions, bear
// children, age children into grown kin, and resolve parent loss.

import { TUNING } from '../content/tuning';
import { nudgeCulture } from './residents';
import { awayHeroIds, isNativeHeritage, oppositeGender } from './types';
import type {
  Ancestry,
  Dependant,
  DependantKind,
  GameState,
  Gender,
  Heritage,
  Hero,
  UnionSource,
} from './types';

/** A node in the family graph: a hero (root) or a dependant (branch). */
export type FamilyNode = Hero | Dependant;

// ------------------------------------------------------------- node accessors

export function graphNode(state: GameState, id: string): FamilyNode | undefined {
  return state.heroes.find((h) => h.id === id) ?? state.dependants.find((d) => d.id === id);
}

/** A node is a Hero if it carries a stat sheet; dependants never do. */
export function isHeroNode(node: FamilyNode): node is Hero {
  return 'stats' in node;
}

/** The peoples a node descends from (FAMILY_SPEC.md §3.3). Heroes are single-
 *  heritage; dependants may be mixed via their ancestry. */
export function nodePeoples(node: FamilyNode): Heritage[] {
  if (isHeroNode(node)) return [node.heritage];
  if (node.ancestry && node.ancestry.peoples.length > 0) return node.ancestry.peoples;
  return node.heritage ? [node.heritage] : ['imanian'];
}

/** True when a node descends from more than one people (a mixed line). */
export function isMixed(node: FamilyNode): boolean {
  return new Set(nodePeoples(node)).size > 1;
}

/** The dominant (display-first) people of a node, for single-heritage needs. */
export function dominantHeritage(node: FamilyNode): Heritage {
  return nodePeoples(node)[0] ?? 'imanian';
}

export function nodeGender(node: FamilyNode): Gender {
  return node.gender;
}

/** The hero id that heads a node's household branch (for grouping & bloodline). */
export function householdHeadId(state: GameState, id: string): string {
  const node = graphNode(state, id);
  if (!node) return id;
  return isHeroNode(node) ? node.id : node.parentId;
}

// ------------------------------------------------------------------ selectors

/** Every partner a node is united with (FAMILY_SPEC.md §4.1). Reads both the
 *  spouse-record scan and the node's own back-link, so it works for hero+spouse,
 *  multi-spouse, and grown-kin×grown-kin unions alike. */
export function spousesOf(state: GameState, id: string): FamilyNode[] {
  const out = new Map<string, FamilyNode>();
  for (const d of state.dependants) {
    if (d.spouseId === id) out.set(d.id, d);
  }
  const node = graphNode(state, id);
  if (node && !isHeroNode(node) && node.spouseId) {
    const partner = graphNode(state, node.spouseId);
    if (partner) out.set(partner.id, partner);
  }
  return [...out.values()];
}

export function spouseCount(state: GameState, id: string): number {
  return spousesOf(state, id).length;
}

export function isMarried(state: GameState, id: string): boolean {
  return spouseCount(state, id) > 0;
}

/** A node's biological children (dependants listing this id among parentIds). */
export function childrenOf(state: GameState, id: string): Dependant[] {
  return state.dependants.filter((d) => d.parentIds?.includes(id));
}

/** A child's biological parents, resolved to graph nodes. */
export function parentsOf(state: GameState, dep: Dependant): FamilyNode[] {
  return (dep.parentIds ?? [])
    .map((pid) => graphNode(state, pid))
    .filter((n): n is FamilyNode => n !== undefined);
}

/** Grown kin who are unwed — the marriageable next generation (FAMILY_SPEC.md §4.1). */
export function marriageableKin(state: GameState): Dependant[] {
  return state.dependants.filter(
    (d) => d.kind === 'kin' && d.comeOfAge === true && !isMarried(state, d.id),
  );
}

/** Grown-kin dependants who came of age at the post (they draw a light retainer). */
export function grownKinCount(state: GameState): number {
  return state.dependants.filter((d) => d.kind === 'kin' && d.comeOfAge === true).length;
}

/** Every named family member displayed under a household head hero. */
export function householdMembers(state: GameState, headId: string): Dependant[] {
  return state.dependants.filter((d) => d.parentId === headId);
}

/** Core eligibility to wed (alive/of-age + under the spouse cap), ignoring where
 *  the subject happens to be — the away-check is a dispatch-time concern only. */
export function canWed(state: GameState, subjectId: string): boolean {
  const node = graphNode(state, subjectId);
  if (!node) return false;
  if (isHeroNode(node)) {
    if (node.status !== 'active') return false;
  } else if (!(node.kind === 'kin' && node.comeOfAge)) {
    return false;
  }
  return spouseCount(state, subjectId) < TUNING.family.maxSpousesPerHero;
}

/** Why the subject may not be sent to form a union now, or null (FAMILY_SPEC.md §5.1).
 *  Dispatch-time gate: adds the away-check on top of `canWed`. */
export function unionError(state: GameState, subjectId: string): string | null {
  const node = graphNode(state, subjectId);
  if (!node) return 'No such person.';
  if (isHeroNode(node)) {
    if (node.status !== 'active') return 'They are not here to be wed.';
    if (awayHeroIds(state).has(node.id)) return 'They are away — recall them first.';
  } else if (!(node.kind === 'kin' && node.comeOfAge)) {
    return 'They are not of an age to wed.';
  }
  if (spouseCount(state, subjectId) >= TUNING.family.maxSpousesPerHero) {
    return 'They already keep as full a household as custom allows.';
  }
  return null;
}

// ------------------------------------------------------------------- mutators

/** Low-level dependant creator. Callers supply the name (from content/names.ts). */
export function addDependant(
  state: GameState,
  fields: {
    kind: DependantKind;
    name: string;
    parentId: string;
    gender: Gender;
    parentIds?: string[];
    spouseId?: string;
    union?: UnionSource;
    ancestry?: Ancestry;
    heritage?: Heritage;
    bornTurn?: number;
  },
): Dependant {
  const dep: Dependant = {
    id: `d${state.nextDependantId}`,
    name: fields.name,
    kind: fields.kind,
    parentId: fields.parentId,
    gender: fields.gender,
    ...(fields.parentIds ? { parentIds: fields.parentIds } : {}),
    ...(fields.spouseId ? { spouseId: fields.spouseId } : {}),
    ...(fields.union ? { union: fields.union } : {}),
    ...(fields.ancestry ? { ancestry: fields.ancestry } : {}),
    ...(fields.heritage ? { heritage: fields.heritage } : {}),
    ...(fields.bornTurn !== undefined ? { bornTurn: fields.bornTurn } : {}),
  };
  state.dependants.push(dep);
  state.nextDependantId += 1;
  return dep;
}

export function removeDependant(state: GameState, dependantId: string): boolean {
  const removed = state.dependants.find((d) => d.id === dependantId);
  const before = state.dependants.length;
  // Sever any spouse back-links to the removed node.
  for (const d of state.dependants) {
    if (d.spouseId === dependantId) delete d.spouseId;
  }
  state.dependants = state.dependants.filter((d) => d.id !== dependantId);
  const didRemove = state.dependants.length < before;
  if (didRemove && removed) recomputeBloodline(state, removed.parentId);
  return didRemove;
}

/**
 * Recompute a hero-headed household's bloodline marker from its members
 * (FAMILY_SPEC.md §3.4). 'mixed' if any spouse/descendant carries native blood;
 * 'pure' if the head is homeland and wed with only homeland blood; else unset.
 */
export function recomputeBloodline(state: GameState, headId: string): void {
  const head = state.heroes.find((h) => h.id === headId);
  if (!head) return;
  const members = householdMembers(state, headId);
  const wed = members.some((m) => m.kind === 'spouse') || spouseCount(state, headId) > 0;
  if (!wed) {
    delete head.bloodline;
    return;
  }
  const anyNative =
    isNativeHeritage(head.heritage) ||
    members.some((m) => nodePeoples(m).some((p) => isNativeHeritage(p)));
  head.bloodline = anyNative ? 'mixed' : 'pure';
}

/**
 * Form a union: create a spouse dependant for the subject, link it, set the
 * household head's bloodline, and nudge `culture` toward the source's pole
 * (FAMILY_SPEC.md §5). Returns the spouse, or null if the union is invalid.
 * The homeland courtship path calls this on homecoming; alliance/informal call
 * it from the `formUnion` outcome. Callers supply the spouse's name.
 */
export function formUnion(
  state: GameState,
  subjectId: string,
  opts: { source: UnionSource; heritage: Heritage; name: string },
): Dependant | null {
  if (!canWed(state, subjectId)) return null;
  const subject = graphNode(state, subjectId);
  if (!subject) return null;

  const headId = householdHeadId(state, subjectId);
  const spouse = addDependant(state, {
    kind: 'spouse',
    name: opts.name,
    parentId: headId,
    gender: oppositeGender(subject.gender),
    spouseId: subjectId,
    union: opts.source,
    heritage: opts.heritage,
    ancestry: { peoples: [opts.heritage] },
  });

  // For a grown-kin subject, mirror the back-link so the tree reads both ways.
  if (!isHeroNode(subject) && !subject.spouseId) subject.spouseId = spouse.id;

  recomputeBloodline(state, headId);
  nudgeCulture(state, TUNING.family.unionCultureNudge[opts.source] ?? 0);
  return spouse;
}

/** The peoples a child of two parents descends from (deduped union). */
export function childAncestry(a: FamilyNode, b: FamilyNode): Ancestry {
  const peoples = [...new Set([...nodePeoples(a), ...nodePeoples(b)])];
  return { peoples };
}

/** A child's gender, skewed toward daughters on a mixed union (FAMILY_SPEC.md §8.1). */
export function childGender(a: FamilyNode, b: FamilyNode, rand: () => number): Gender {
  const mixed = new Set([...nodePeoples(a), ...nodePeoples(b)]).size > 1;
  const femaleChance = mixed ? TUNING.family.mixedFemaleChance : TUNING.family.pureFemaleChance;
  return rand() < femaleChance ? 'female' : 'male';
}

/**
 * A birth: attach a child to both parents, computing ancestry (dual-parentage)
 * and, when not given, gender (skewed by union heritage). Caller supplies the
 * name. `subjectId` is one parent (hero or grown kin); the other is their spouse.
 */
export function addChild(
  state: GameState,
  subjectId: string,
  opts: {
    nameFor: (gender: Gender, heritage: Heritage) => string;
    gender?: Gender;
    partnerId?: string;
    rand: () => number;
  },
): Dependant | null {
  const subject = graphNode(state, subjectId);
  if (!subject) return null;
  const partners = spousesOf(state, subjectId);
  const partner = opts.partnerId
    ? partners.find((candidate) => candidate.id === opts.partnerId)
    : partners[0];
  if (!partner) return null;

  const ancestry = childAncestry(subject, partner);
  const gender = opts.gender ?? childGender(subject, partner, opts.rand);
  const headId = householdHeadId(state, subjectId);
  return addDependant(state, {
    kind: 'child',
    name: opts.nameFor(gender, ancestry.peoples[0]),
    parentId: headId,
    gender,
    parentIds: [subjectId, partner.id],
    ancestry,
    heritage: ancestry.peoples[0],
    bornTurn: state.turn,
  });
}

/**
 * A child comes of age (FAMILY_SPEC.md §7): by default becomes named grown kin
 * that stays in the tree (marriageable, fertile, drawing a light retainer).
 * Returns the grown-kin dependant, or null if the id is not an eligible child.
 */
export function comeOfAge(state: GameState, childId: string): Dependant | null {
  const child = state.dependants.find((d) => d.id === childId);
  if (!child || child.kind !== 'child' || child.comeOfAge) return null;
  child.kind = 'kin';
  child.comeOfAge = true;
  return child;
}

/** Children old enough to come of age this season (FAMILY_SPEC.md §7). */
export function childrenComingOfAge(state: GameState): Dependant[] {
  return state.dependants.filter(
    (d) =>
      d.kind === 'child' &&
      !d.comeOfAge &&
      d.bornTurn !== undefined &&
      state.turn - d.bornTurn >= TUNING.family.comeOfAgeTurns,
  );
}
