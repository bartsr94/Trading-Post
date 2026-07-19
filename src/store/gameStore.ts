// Zustand store wrapping the serializable GameState. All mutations go through
// these actions; components never touch state directly. Each action clones the
// game state, runs pure engine functions on the draft, and commits.

import { create } from 'zustand';
import { STARTING_STANDINGS } from '../content/factions';
import { HERO_POOL, createHero } from '../content/heroes';
import { LOCATIONS } from '../content/locations';
import { CONTENT } from '../content/registry';
import {
  cancelConstruction as cancelConstructionFn,
  startConstruction as startConstructionFn,
} from '../engine/buildings';
import { buyGood, sellGood } from '../engine/economy';
import { dispatchExpedition } from '../engine/expeditions';
import type { DispatchParams } from '../engine/expeditions';
import { hireResidents, reallocate } from '../engine/residents';
import { activateHero, benchHero } from '../engine/roster';
import { evalConditions } from '../engine/events/conditions';
import type { TravelContext } from '../engine/events/types';
import { autosave, clearAutosave, deserialize, loadAutosave, serialize } from '../engine/save';
import { createInitialState } from '../engine/state';
import {
  advancePendingEvent,
  advanceTurn,
  resolveChoice,
  resolveTurn,
} from '../engine/turn';
import type { ChoiceResolution } from '../engine/turn';
import type {
  ActiveEvent,
  ActivityId,
  BuildingId,
  GameState,
  GoodId,
  ResidentRole,
} from '../engine/types';

export type Screen = 'post' | 'assignments' | 'characters' | 'map' | 'market';

const MIGRATION_CTX = { locationDefs: LOCATIONS };

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
  /** Dispatch a caravan or explore party. Returns false if the dispatch is invalid. */
  dispatch: (params: DispatchParams) => boolean;
  /** Promote a reserve character into the active party. Returns false if invalid. */
  activate: (heroId: string) => boolean;
  /** Send an active-party character to the reserve bench. Returns false if invalid. */
  bench: (heroId: string) => boolean;
  /** Begin a construction project (deducts cost up front). Returns false if invalid. */
  startConstruction: (buildingId: BuildingId) => boolean;
  /** Abandon the active project — paid costs are forfeit. */
  cancelConstruction: () => void;
  /** Hire residents of a role from the neighbouring towns. Returns false if invalid. */
  hire: (role: ResidentRole, count: number) => boolean;
  /** Move residents between roles/idle at the post. Returns false if invalid. */
  reallocateResidents: (
    from: ResidentRole | 'idle',
    to: ResidentRole | 'idle',
    count: number,
  ) => boolean;
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

  hasAutosave: () => loadAutosave(MIGRATION_CTX) !== null,

  newGame: (heroIds) => {
    const heroes = heroIds
      .map((id) => HERO_POOL.find((t) => t.id === id))
      .filter((t) => t !== undefined)
      .map(createHero);
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const game = createInitialState({
      seed,
      heroes,
      startingStandings: STARTING_STANDINGS,
      locationDefs: LOCATIONS,
    });
    for (const hero of heroes) game.assignments[hero.id] = 'trade';
    autosave(game);
    set({ game, screen: 'assignments', lastResolution: null, growthLines: [] });
  },

  continueGame: () => {
    const game = loadAutosave(MIGRATION_CTX);
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
      const game = deserialize(json, MIGRATION_CTX);
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
    const resolution = resolveChoice(
      next,
      CONTENT,
      event,
      choiceIndex,
      active.heroId,
      active.expeditionId,
    );
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

  dispatch: (params) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!dispatchExpedition(next, params, CONTENT.locationDefs)) return false;
    autosave(next);
    set({ game: next });
    return true;
  },

  activate: (heroId) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!activateHero(next, heroId)) return false;
    autosave(next);
    set({ game: next });
    return true;
  },

  bench: (heroId) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!benchHero(next, heroId)) return false;
    autosave(next);
    set({ game: next });
    return true;
  },

  startConstruction: (buildingId) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!startConstructionFn(next, buildingId)) return false;
    autosave(next);
    set({ game: next });
    return true;
  },

  cancelConstruction: () => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return;
    const next = draft(game);
    cancelConstructionFn(next);
    autosave(next);
    set({ game: next });
  },

  hire: (role, count) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!hireResidents(next, role, count)) return false;
    autosave(next);
    set({ game: next });
    return true;
  },

  reallocateResidents: (from, to, count) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!reallocate(next, from, to, count)) return false;
    autosave(next);
    set({ game: next });
    return true;
  },
}));

/** Travel context for the active event, so travel conditions can evaluate. */
export function travelContextOf(game: GameState, active: ActiveEvent): TravelContext | undefined {
  if (!active.expeditionId) return undefined;
  const expedition = game.expeditions.find((e) => e.id === active.expeditionId);
  if (!expedition) return undefined;
  const destination = CONTENT.locationDefs.get(expedition.destination);
  return destination ? { expedition, destination } : undefined;
}

/** Whether a choice's requirements are met right now (locked choices show why). */
export function choiceAvailable(
  game: GameState,
  requires?: Parameters<typeof evalConditions>[1],
  travel?: TravelContext,
) {
  return !requires || evalConditions(game, requires, travel);
}
