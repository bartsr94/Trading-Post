// Event selection (spec §9): queued chains take priority, then a weighted
// draw per category budget. At least one event fires every turn so pacing
// never goes flat. Travel events are extra: up to one per expedition en route.

import { TUNING } from '../../content/tuning';
import { paceEventChance } from '../map';
import { travelContextFor } from '../expeditions';
import { getHero } from '../types';
import type { ActiveEvent, GameState, LocationDef, LocationId, MapFeatureDef, MapRegionDef } from '../types';
import type { Rng } from '../rng';
import { bindHero } from './binding';
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
  if (event.once && state.firedEvents.includes(event.id)) return false;
  const readyTurn = state.cooldowns[event.id];
  if (readyTurn !== undefined && state.turn < readyTurn) return false;
  if (eventWeight(state, event) <= 0) return false;
  return evalConditions(state, event.conditions, travel);
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
      ? state.heroes.find((h) => h.id === queued.heroId && h.status === 'active') ?? null
      : bindHero(state, event, rng);
    if (!hero) continue;
    selected.push({ eventId: event.id, heroId: hero.id });
    usedIds.add(event.id);
  }

  const eligible = [...allEvents.values()].filter(
    (e) =>
      !usedIds.has(e.id) &&
      e.category !== 'chain' &&
      e.category !== 'travel' &&
      isEligible(state, e),
  );

  // 2. Weighted draw per category budget: one post/season slot, one faction/hero slot.
  const budgets: string[][] = [
    ['post', 'season'],
    ['faction', 'hero'],
  ];
  for (const categories of budgets) {
    if (selected.length >= max) break;
    const drawn = draw(state, eligible.filter((e) => categories.includes(e.category)), usedIds, rng);
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
    const candidates = travelPool.filter(
      (e) => !usedIds.has(e.id) && isEligible(state, e, travel),
    );
    if (candidates.length === 0) continue;
    const weights = candidates.map((e) => eventWeight(state, e));
    const event = rng.weightedPick(candidates, weights);
    const party = expedition.heroIds.map((id) => getHero(state, id));
    const hero = bindHero(state, event, rng, party);
    if (!hero) continue;
    selected.push({ eventId: event.id, heroId: hero.id, expeditionId: expedition.id });
    usedIds.add(event.id);
  }

  return selected;
}

function draw(
  state: GameState,
  pool: GameEvent[],
  usedIds: Set<string>,
  rng: Rng,
): ActiveEvent | null {
  const candidates = pool.filter((e) => !usedIds.has(e.id));
  if (candidates.length === 0) return null;
  const weights = candidates.map((e) => eventWeight(state, e));
  const event = rng.weightedPick(candidates, weights);
  const hero = bindHero(state, event, rng);
  if (!hero) return null;
  usedIds.add(event.id);
  return { eventId: event.id, heroId: hero.id };
}
