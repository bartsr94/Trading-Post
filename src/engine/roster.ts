// The named-character roster: the active party (≤ activeCap) and the reserve
// bench (CHARACTERS_SPEC.md §5). Pure — no React, no content knowledge beyond
// tuning numbers. Selectors read the roster; the mutators here are called from
// the store (between-turns swaps) and, later, recruitment outcomes.

import { TUNING } from '../content/tuning';
import { activeHeroes, awayHeroIds } from './types';
import type { Dependant, GameState } from './types';

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
