// GameState factory. Content (heroes, standings, locations) is injected by the
// caller so the engine never imports content beyond tuning numbers.

import { TUNING } from '../content/tuning';
import { GOOD_IDS, FACTION_IDS } from './types';
import type {
  FactionId,
  FactionState,
  GameState,
  GoodId,
  Hero,
  LocationDef,
  LocationId,
  LocationState,
  MarketGoodState,
} from './types';

export interface NewGameOptions {
  seed: number;
  heroes: Hero[];
  startingStandings?: Partial<Record<FactionId, number>>;
  locationDefs?: readonly LocationDef[];
}

function freshMarket(): Record<GoodId, MarketGoodState> {
  const market = {} as Record<GoodId, MarketGoodState>;
  for (const id of GOOD_IDS) market[id] = { supplyDemandMod: 1, eventMod: 1 };
  return market;
}

/**
 * Builds location state from defs. The post's market lives on
 * `GameState.market`, so the home location gets none here.
 */
export function createLocationStates(
  defs: readonly LocationDef[],
): Record<LocationId, LocationState> {
  const locations: Record<LocationId, LocationState> = {};
  for (const def of defs) {
    locations[def.id] = {
      discovery: def.initialDiscovery,
      ...(def.hasMarket && def.id !== TUNING.map.homeLocationId ? { market: freshMarket() } : {}),
    };
  }
  return locations;
}

export function createInitialState(options: NewGameOptions): GameState {
  const goods = {} as Record<GoodId, number>;
  for (const id of GOOD_IDS) {
    goods[id] = TUNING.start.goods[id] ?? 0;
  }

  const factions = {} as Record<FactionId, FactionState>;
  for (const id of FACTION_IDS) {
    factions[id] = { standing: options.startingStandings?.[id] ?? 0 };
  }

  const assignments: Record<string, never> = {};

  return {
    saveVersion: TUNING.save.version,
    seed: options.seed,
    rngState: options.seed,
    turn: 1,
    phase: 'assignment',
    heroes: options.heroes,
    assignments,
    silver: TUNING.start.silver,
    goods,
    market: freshMarket(),
    locations: createLocationStates(options.locationDefs ?? []),
    expeditions: [],
    nextExpeditionId: 1,
    factions,
    axes: { integration: 0, communal: 0 },
    postTier: 1,
    flags: {},
    firedEvents: [],
    cooldowns: {},
    queuedEvents: [],
    pendingEvents: [],
    bankruptcyClock: 0,
    report: { turn: 1, lines: [], silverDelta: 0, goodsDelta: {} },
    gameOver: null,
  };
}
