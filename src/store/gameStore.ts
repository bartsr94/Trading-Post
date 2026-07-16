// Zustand store wrapping the serializable GameState. All mutations go through
// these actions; components never touch state directly. Each action clones the
// game state, runs pure engine functions on the draft, and commits.

import { create } from 'zustand';
import { STARTING_STANDINGS } from '../content/factions';
import { HERO_POOL, createHero } from '../content/heroes';
import { CONTENT } from '../content/registry';
import { buyGood, sellGood } from '../engine/economy';
import { evalConditions } from '../engine/events/conditions';
import { autosave, clearAutosave, deserialize, loadAutosave, serialize } from '../engine/save';
import { createInitialState } from '../engine/state';
import {
  advancePendingEvent,
  advanceTurn,
  resolveChoice,
  resolveTurn,
} from '../engine/turn';
import type { ChoiceResolution } from '../engine/turn';
import type { ActivityId, GameState, GoodId } from '../engine/types';

export type Screen = 'post' | 'assignments' | 'heroes';

interface GameStore {
  game: GameState | null;
  screen: Screen;
  /** Hero sheet modal target. */
  selectedHeroId: string | null;
  /** Result of the current event choice, shown until Continue. */
  lastResolution: ChoiceResolution | null;
  /** Season-end skill growth lines, shown once on the next assignment phase. */
  growthLines: string[];

  hasAutosave: () => boolean;
  newGame: (heroIds: string[]) => void;
  continueGame: () => void;
  abandonGame: () => void;
  exportSave: () => string | null;
  importSave: (json: string) => string | null;

  setScreen: (screen: Screen) => void;
  selectHero: (heroId: string | null) => void;

  setAssignment: (heroId: string, activity: ActivityId) => void;
  confirmTurn: () => void;
  chooseOption: (choiceIndex: number) => void;
  continueEvent: () => void;
  finishReport: () => void;

  buy: (good: GoodId, qty: number) => void;
  sell: (good: GoodId, qty: number) => void;
}

function draft(game: GameState): GameState {
  return structuredClone(game);
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  screen: 'post',
  selectedHeroId: null,
  lastResolution: null,
  growthLines: [],

  hasAutosave: () => loadAutosave() !== null,

  newGame: (heroIds) => {
    const heroes = heroIds
      .map((id) => HERO_POOL.find((t) => t.id === id))
      .filter((t) => t !== undefined)
      .map(createHero);
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const game = createInitialState({ seed, heroes, startingStandings: STARTING_STANDINGS });
    for (const hero of heroes) game.assignments[hero.id] = 'trade';
    autosave(game);
    set({ game, screen: 'assignments', lastResolution: null, growthLines: [] });
  },

  continueGame: () => {
    const game = loadAutosave();
    if (game) set({ game, screen: 'post', lastResolution: null, growthLines: [] });
  },

  abandonGame: () => {
    clearAutosave();
    set({ game: null, screen: 'post', selectedHeroId: null, lastResolution: null });
  },

  exportSave: () => {
    const { game } = get();
    return game ? serialize(game) : null;
  },

  importSave: (json) => {
    try {
      const game = deserialize(json);
      autosave(game);
      set({ game, screen: 'post', lastResolution: null, growthLines: [] });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not read that save file.';
    }
  },

  setScreen: (screen) => set({ screen }),
  selectHero: (selectedHeroId) => set({ selectedHeroId }),

  setAssignment: (heroId, activity) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return;
    const next = draft(game);
    next.assignments[heroId] = activity;
    set({ game: next });
  },

  confirmTurn: () => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return;
    const next = draft(game);
    resolveTurn(next, CONTENT);
    autosave(next);
    set({ game: next, growthLines: [], lastResolution: null });
  },

  chooseOption: (choiceIndex) => {
    const { game } = get();
    if (!game || game.phase !== 'event' || game.pendingEvents.length === 0) return;
    const active = game.pendingEvents[0];
    const event = CONTENT.events.get(active.eventId);
    if (!event) return;
    const next = draft(game);
    const resolution = resolveChoice(next, CONTENT, event, choiceIndex, active.heroId);
    set({ game: next, lastResolution: resolution });
  },

  continueEvent: () => {
    const { game } = get();
    if (!game) return;
    const next = draft(game);
    advancePendingEvent(next);
    autosave(next);
    set({ game: next, lastResolution: null });
  },

  finishReport: () => {
    const { game } = get();
    if (!game || game.phase !== 'report') return;
    const next = draft(game);
    const growthLines = advanceTurn(next);
    autosave(next);
    set({ game: next, growthLines, screen: 'assignments' });
  },

  buy: (good, qty) => {
    const { game } = get();
    if (!game) return;
    const def = CONTENT.goodDefs.get(good);
    if (!def) return;
    const next = draft(game);
    if (buyGood(next, def, qty)) set({ game: next });
  },

  sell: (good, qty) => {
    const { game } = get();
    if (!game) return;
    const def = CONTENT.goodDefs.get(good);
    if (!def) return;
    const next = draft(game);
    if (sellGood(next, def, qty)) set({ game: next });
  },
}));

/** Whether a choice's requirements are met right now (locked choices show why). */
export function choiceAvailable(game: GameState, requires?: Parameters<typeof evalConditions>[1]) {
  return !requires || evalConditions(game, requires);
}
