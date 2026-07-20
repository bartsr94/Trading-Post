// The named-character roster: the active party (≤ activeCap) and the reserve
// bench (CHARACTERS_SPEC.md §5). Pure — no React, no content knowledge beyond
// tuning numbers. Selectors read the roster; the mutators here are called from
// the store (between-turns swaps) and, later, recruitment outcomes.

import { TUNING } from '../content/tuning';
import { activeHeroes, awayHeroIds, SKILL_IDS } from './types';
import type { Dependant, GameState, Hero, RecruitDef, SkillId } from './types';

// ------------------------------------------------------------- selectors

/** The active-party ceiling. Buildings raise this in Phase C. */
export function activeCap(_state: GameState): number {
  return TUNING.roster.activeCap;
}

/** Why promoting `heroId` into the active party is invalid, or null if it may proceed. */
export function activateError(state: GameState, heroId: string): string | null {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero || hero.status !== 'active') return 'They are not here to call up.';
  if (state.activePartyIds.includes(heroId)) return 'Already in the active party.';
  if (activeHeroes(state).length >= activeCap(state)) {
    return 'The party is full — bench someone first.';
  }
  return null;
}

/** Why benching `heroId` is invalid, or null if it may proceed. */
export function benchError(state: GameState, heroId: string): string | null {
  if (!state.activePartyIds.includes(heroId)) return 'Not in the active party.';
  if (awayHeroIds(state).has(heroId)) return 'They are away — recall them first.';
  return null;
}

/** A character's dependants (spouses/children/kin). */
export function dependantsOf(state: GameState, heroId: string): Dependant[] {
  return state.dependants.filter((d) => d.parentId === heroId);
}

/** Total dependants across the post (feeds the grain formula). */
export function dependantCount(state: GameState): number {
  return state.dependants.length;
}

// -------------------------------------------------------------- mutators

/** Promote a reserve character into the active party. Returns false if invalid. */
export function activateHero(state: GameState, heroId: string): boolean {
  if (activateError(state, heroId) !== null) return false;
  state.activePartyIds.push(heroId);
  if (!state.assignments[heroId]) state.assignments[heroId] = 'unassigned';
  return true;
}

/** Send an active-party character to the reserve bench. Returns false if invalid. */
export function benchHero(state: GameState, heroId: string): boolean {
  if (benchError(state, heroId) !== null) return false;
  state.activePartyIds = state.activePartyIds.filter((id) => id !== heroId);
  delete state.assignments[heroId];
  return true;
}

/** Drop dead/departed heroes from the active party (called at turn advance). */
export function reconcileRoster(state: GameState): void {
  const living = new Set(
    state.heroes.filter((h) => h.status === 'active').map((h) => h.id),
  );
  state.activePartyIds = state.activePartyIds.filter((id) => living.has(id));
}

// ------------------------------------------------------- recruitment (Phase B)

/** Builds a runtime Hero from a recruit template, minting a fresh runtime id. */
function buildRecruit(state: GameState, def: RecruitDef): Hero {
  const skills = {} as Record<SkillId, number>;
  for (const s of SKILL_IDS) skills[s] = def.skills[s] ?? 0;
  const id = `c${state.nextCharacterId}`;
  state.nextCharacterId += 1;
  return {
    id,
    name: def.name,
    epithet: def.epithet,
    bio: def.bio,
    stats: { ...def.stats },
    skills,
    skillMarks: [],
    traits: [...def.traits],
    health: TUNING.condition.maxHealth,
    stress: 0,
    status: 'active',
    heritage: def.heritage,
    gender: def.gender,
    history: [`Joined the company in turn ${state.turn}.`],
  };
}

/**
 * Recruit a named character (CHARACTERS_SPEC.md §6). Joins the reserve bench,
 * or the active party when there is room and `toActive` is set. Sets the
 * template's access-unlock flag on join. Returns the new hero.
 */
export function recruitCharacter(state: GameState, def: RecruitDef, toActive = false): Hero {
  const hero = buildRecruit(state, def);
  state.heroes.push(hero);
  if (toActive && activeHeroes(state).length < activeCap(state)) {
    state.activePartyIds.push(hero.id);
    state.assignments[hero.id] = 'unassigned';
  }
  if (def.joinFlag) state.flags[def.joinFlag] = true;
  return hero;
}

/**
 * A named character leaves the frontier (CHARACTERS_SPEC.md §7): marked departed,
 * dropped from the active party, and their dependants leave with them. Returns
 * false (state untouched) if the hero is not a living character.
 */
export function departCharacter(state: GameState, heroId: string): boolean {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero || hero.status !== 'active') return false;
  hero.status = 'departed';
  hero.history.push(`Left the company in turn ${state.turn}.`);
  state.activePartyIds = state.activePartyIds.filter((id) => id !== heroId);
  delete state.assignments[heroId];
  state.dependants = state.dependants.filter((d) => d.parentId !== heroId);
  return true;
}
