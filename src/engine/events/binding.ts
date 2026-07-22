// Resolves which hero an event features. Returns null when no hero fits,
// which makes the event ineligible this turn.

import { heroesAtPost } from '../types';
import type { GameState, Hero } from '../types';
import type { Rng } from '../rng';
import type { GameEvent, HeroBinding } from './types';

/**
 * Picks the featured hero. The default pool is heroes present at the post;
 * travel events pass the expedition's party instead.
 */
export function bindHero(
  state: GameState,
  event: GameEvent,
  rng: Rng,
  poolOverride?: Hero[],
): Hero | null {
  const pool = bindingCandidates(state, event, poolOverride);
  if (pool.length === 0) return null;
  const binding: HeroBinding = event.binding ?? { type: 'random' };

  switch (binding.type) {
    case 'random':
      return rng.pick(pool);
    case 'highestSkill':
      return best(pool, (h) => h.skills[binding.skill], rng);
    case 'lowestSkill':
      return best(pool, (h) => -h.skills[binding.skill], rng);
    case 'highestStat':
      return best(pool, (h) => h.stats[binding.stat], rng);
    case 'withTrait': {
      const matches = pool.filter((h) => h.traits.includes(binding.trait));
      return matches.length > 0 ? rng.pick(matches) : null;
    }
    case 'withoutTrait': {
      const matches = pool.filter((h) => !h.traits.includes(binding.trait));
      return matches.length > 0 ? rng.pick(matches) : null;
    }
    case 'highestStress':
      return best(pool, (h) => h.stress, rng);
    case 'specific':
      return pool.find((h) => h.id === binding.heroId) ?? null;
  }
}

/** Candidate pool implied by the binding, without consuming RNG. */
export function bindingCandidates(
  state: GameState,
  event: GameEvent,
  poolOverride?: Hero[],
): Hero[] {
  const pool = poolOverride ?? heroesAtPost(state);
  const binding: HeroBinding = event.binding ?? { type: 'random' };
  switch (binding.type) {
    case 'withTrait':
      return pool.filter((h) => h.traits.includes(binding.trait));
    case 'withoutTrait':
      return pool.filter((h) => !h.traits.includes(binding.trait));
    case 'specific':
      return pool.filter((h) => h.id === binding.heroId);
    default:
      return pool;
  }
}

/** Highest score wins; ties broken by seeded RNG so runs stay reproducible. */
function best(pool: Hero[], score: (h: Hero) => number, rng: Rng): Hero {
  const top = Math.max(...pool.map(score));
  const candidates = pool.filter((h) => score(h) === top);
  return candidates.length === 1 ? candidates[0] : rng.pick(candidates);
}
