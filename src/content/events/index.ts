// Event registry: all content events in one map for the engine.

import type { GameEvent } from '../../engine/events/types';
import { GENERIC_HERO_EVENTS, HERO_EVENTS } from './heroEvents';
import { POST_EVENTS } from './postEvents';
import { SEASON_EVENTS } from './seasonEvents';
import { TRAVEL_EVENTS } from './travelEvents';

export const ALL_EVENTS: GameEvent[] = [
  ...POST_EVENTS,
  ...HERO_EVENTS,
  ...GENERIC_HERO_EVENTS,
  ...SEASON_EVENTS,
  ...TRAVEL_EVENTS,
];

export const EVENT_MAP: ReadonlyMap<string, GameEvent> = new Map(
  ALL_EVENTS.map((e) => [e.id, e]),
);

// Fail fast in dev if content references a missing chain event.
for (const event of ALL_EVENTS) {
  for (const choice of event.choices) {
    for (const tier of Object.values(choice.outcomes)) {
      for (const outcome of tier.outcomes) {
        if (outcome.type === 'queueEvent' && !EVENT_MAP.has(outcome.eventId)) {
          throw new Error(`Event ${event.id} queues unknown event ${outcome.eventId}`);
        }
      }
    }
  }
}
