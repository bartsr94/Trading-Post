// Event selection (spec §9): queued chains take priority, then a weighted
// draw per category budget. At least one event fires every turn so pacing
// never goes flat. Travel events are extra: up to one per expedition en route.

import { TUNING } from '../../content/tuning';
import { paceEventChance } from '../map';
import { travelContextFor } from '../expeditions';
import { heroesAtPost } from '../types';
import type { ActiveEvent, GameState, Hero, LocationDef, LocationId, MapFeatureDef, MapRegionDef } from '../types';
import type { Rng } from '../rng';
import { bindHero, bindingCandidates } from './binding';
import { evalConditions } from './conditions';
import type { GameEvent, TravelContext } from './types';

export function eventWeight(state: GameState, event: GameEvent): number {
  return typeof event.weight === 'function' ? event.weight(state) : event.weight;
}

export function isEligible(
  state: GameState,
  event: GameEvent,
  travel?: TravelContext,
): boolean {
  return eligibleHeroes(state, event, travel).length > 0;
}

function passesWorldGates(state: GameState, event: GameEvent): boolean {
  if (event.once && state.firedEvents.includes(event.id)) return false;
  const readyTurn = state.cooldowns[event.id];
  if (readyTurn !== undefined && state.turn < readyTurn) return false;
  if (eventWeight(state, event) <= 0) return false;
  return true;
}

function eligibleHeroes(
  state: GameState,
  event: GameEvent,
  travel?: TravelContext,
  poolOverride?: Hero[],
): Hero[] {
  if (!passesWorldGates(state, event)) return [];
  const basePool = poolOverride ?? (travel
    ? travel.expedition.heroIds
        .map((id) => state.heroes.find((hero) => hero.id === id))
        .filter((hero): hero is Hero => hero !== undefined && hero.status === 'active')
    : undefined);
  return bindingCandidates(state, event, basePool).filter((hero) =>
    evalConditions(state, event.conditions, { heroId: hero.id, travel }),
  );
}

interface EligibleEvent {
  event: GameEvent;
  heroes: Hero[];
}

/**
 * Selects this turn's events. Mutates nothing except the rng stream; the
 * caller records results on state (pendingEvents, cooldowns, firedEvents).
 */
export function selectEvents(
  state: GameState,
  allEvents: ReadonlyMap<string, GameEvent>,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
  rng: Rng,
  mapRegionDefs: readonly MapRegionDef[] = [],
  mapFeatureDefs: readonly MapFeatureDef[] = [],
): ActiveEvent[] {
  const selected: ActiveEvent[] = [];
  const usedIds = new Set<string>();
  const max = TUNING.events.maxPerTurn;

  // 1. Due chain events fire first, regardless of budgets.
  for (const queued of state.queuedEvents) {
    if (queued.fireOnTurn > state.turn || selected.length >= max) continue;
    const event = allEvents.get(queued.eventId);
    if (!event) continue;
    const hero = queued.heroId
      ? heroesAtPost(state).find((h) => h.id === queued.heroId) ?? null
      : bindHero(state, event, rng);
    if (!hero) continue;
    selected.push({
      eventId: event.id,
      heroId: hero.id,
      ...(queued.locationId ? { locationId: queued.locationId } : {}),
    });
    usedIds.add(event.id);
  }

  const eligible: EligibleEvent[] = [...allEvents.values()]
    .filter(
      (event) =>
        !usedIds.has(event.id) &&
        event.category !== 'chain' &&
        event.category !== 'travel',
    )
    .map((event) => ({ event, heroes: eligibleHeroes(state, event) }))
    .filter(({ heroes }) => heroes.length > 0);

  // 2. Weighted draw per category budget: one post/season slot, one faction/hero slot.
  const budgets: string[][] = [
    ['post', 'season'],
    ['faction', 'hero'],
  ];
  for (const categories of budgets) {
    if (selected.length >= max) break;
    const drawn = draw(
      state,
      eligible.filter(({ event }) => categories.includes(event.category)),
      usedIds,
      rng,
    );
    if (drawn) selected.push(drawn);
  }

  // 3. Guarantee at least one event fires.
  if (selected.length < TUNING.events.minPerTurn) {
    const fallback = draw(state, eligible, usedIds, rng);
    if (fallback) selected.push(fallback);
  }

  // 4. Travel events: up to one per expedition, on top of the post budgets.
  const travelPool = [...allEvents.values()].filter((e) => e.category === 'travel');
  for (const expedition of state.expeditions) {
    if (rng.next() >= paceEventChance(expedition.pace)) continue;
    const travel = travelContextFor(expedition, { locationDefs, mapRegionDefs, mapFeatureDefs });
    if (!travel) continue;
    const party = travel.expedition.heroIds
      .map((id) => state.heroes.find((hero) => hero.id === id))
      .filter((hero): hero is Hero => hero !== undefined && hero.status === 'active');
    const candidates: EligibleEvent[] = travelPool
      .filter((event) => !usedIds.has(event.id))
      .map((event) => ({ event, heroes: eligibleHeroes(state, event, travel, party) }))
      .filter(({ heroes }) => heroes.length > 0);
    if (candidates.length === 0) continue;
    const weights = candidates.map(({ event }) => eventWeight(state, event));
    const candidate = rng.weightedPick(candidates, weights);
    const { event } = candidate;
    const hero = bindHero(state, event, rng, candidate.heroes);
    if (!hero) continue;
    selected.push({ eventId: event.id, heroId: hero.id, expeditionId: expedition.id });
    usedIds.add(event.id);
  }

  return selected;
}

function draw(
  state: GameState,
  pool: EligibleEvent[],
  usedIds: Set<string>,
  rng: Rng,
): ActiveEvent | null {
  const candidates = pool.filter(({ event }) => !usedIds.has(event.id));
  if (candidates.length === 0) return null;
  const weights = candidates.map(({ event }) => eventWeight(state, event));
  const candidate = rng.weightedPick(candidates, weights);
  const { event } = candidate;
  const hero = bindHero(state, event, rng, candidate.heroes);
  if (!hero) return null;
  usedIds.add(event.id);
  return { eventId: event.id, heroId: hero.id };
}
