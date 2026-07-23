// GameState factory. Content (heroes, standings, locations) is injected by the
// caller so the engine never imports content beyond tuning numbers.

import { TUNING } from '../content/tuning';
import { freshClaim, freshHerd } from './claim';
import { createDiplomacySeatStates } from './diplomacy';
import { freshResidents } from './residents';
import { mapKnowledgeFromDiscovery } from './map';
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
  MapFeatureDef,
  MapRegionDef,
  ResidentRole,
} from './types';

export interface NewGameOptions {
  seed: number;
  heroes: Hero[];
  startingStandings?: Partial<Record<FactionId, number>>;
  locationDefs?: readonly LocationDef[];
  mapRegionDefs?: readonly MapRegionDef[];
  mapFeatureDefs?: readonly MapFeatureDef[];
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

  const residents = freshResidents();
  for (const [role, count] of Object.entries(TUNING.residents.startingRoles)) {
    if (!count) continue;
    residents.roles[role as ResidentRole] += count;
    residents.heritage.homeland += count; // founding hands are Imanian homeland stock
  }

  const state: GameState = {
    saveVersion: TUNING.save.version,
    seed: options.seed,
    rngState: options.seed,
    turn: 1,
    phase: 'assignment',
    heroes: options.heroes,
    activePartyIds: options.heroes.map((h) => h.id),
    assignments,
    silver: TUNING.start.silver,
    goods,
    market: freshMarket(),
    locations: createLocationStates(options.locationDefs ?? []),
    mapKnowledge: { surveyedCells: [] },
    expeditions: [],
    nextExpeditionId: 1,
    factions,
    diplomacySeats: createDiplomacySeatStates(options.locationDefs ?? [], options.startingStandings),
    dependants: [],
    nextDependantId: 1,
    nextCharacterId: 1,
    residents,
    claim: freshClaim(),
    herd: freshHerd(),
    transients: [],
    nextTransientId: 1,
    axes: { integration: 0, communal: 0, culture: 0 },
    postTier: 1,
    buildings: [],
    construction: null,
    flags: {},
    firedEvents: [],
    cooldowns: {},
    queuedEvents: [],
    pendingEvents: [],
    bankruptcyClock: 0,
    charterMissedStreak: 0,
    charterCompromisedStreak: 0,
    pendingRaid: null,
    lastRaidTurn: 0,
    lastSackedTurn: 0,
    tributes: [],
    report: { turn: 1, lines: [], silverDelta: 0, goodsDelta: {} },
    gameOver: null,
  };
  state.mapKnowledge = mapKnowledgeFromDiscovery(
    state,
    options.locationDefs ?? [],
    options.mapRegionDefs ?? [],
    options.mapFeatureDefs ?? [],
  );
  return state;
}
