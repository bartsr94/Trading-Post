// GameState factory. Content (heroes, standings) is injected by the caller so
// the engine never imports content beyond tuning numbers.

import { TUNING } from '../content/tuning';
import { GOOD_IDS, FACTION_IDS } from './types';
import type {
  FactionId,
  FactionState,
  GameState,
  GoodId,
  Hero,
  MarketGoodState,
} from './types';

export interface NewGameOptions {
  seed: number;
  heroes: Hero[];
  startingStandings?: Partial<Record<FactionId, number>>;
}

export function createInitialState(options: NewGameOptions): GameState {
  const goods = {} as Record<GoodId, number>;
  const market = {} as Record<GoodId, MarketGoodState>;
  for (const id of GOOD_IDS) {
    goods[id] = TUNING.start.goods[id] ?? 0;
    market[id] = { supplyDemandMod: 1, eventMod: 1 };
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
    market,
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
