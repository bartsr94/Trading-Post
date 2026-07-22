// Zustand store wrapping the serializable GameState. All mutations go through
// these actions; components never touch state directly. Each action clones the
// game state, runs pure engine functions on the draft, and commits.

import { create } from 'zustand';
import { STARTING_STANDINGS } from '../content/factions';
import { HERO_POOL, createHero, genderOf, heritageOf, subPeopleOf } from '../content/heroes';
import { LOCATIONS } from '../content/locations';
import { MAP_FEATURES, MAP_REGIONS } from '../content/map';
import { CONTENT } from '../content/registry';
import {
  cancelConstruction as cancelConstructionFn,
  startConstruction as startConstructionFn,
} from '../engine/buildings';
import { buyGood, sellGood } from '../engine/economy';
import { dispatchExpedition, travelContextFor } from '../engine/expeditions';
import type { DispatchParams } from '../engine/expeditions';
import { resolveIncomingRaid, resolveOutgoingRaid } from '../engine/raids';
import type { RaidAttackParams, RaidDefenseParams, RaidResolution } from '../engine/raids';
import { Rng } from '../engine/rng';
import { hireResidents, reallocate } from '../engine/residents';
import { activateHero, benchHero } from '../engine/roster';
import { evalConditions } from '../engine/events/conditions';
import { applyOutcomes } from '../engine/events/outcomes';
import type { Outcome } from '../engine/events/types';
import type { TravelContext } from '../engine/events/types';
import { autosave, clearAutosave, deserialize, loadAutosave, serialize } from '../engine/save';
import { createInitialState } from '../engine/state';
import {
  advancePendingEvent,
  advanceTurn,
  outcomeCtx,
  resolveChoice,
  resolveTurn,
} from '../engine/turn';
import type { ChoiceResolution } from '../engine/turn';
import { livingHeroes } from '../engine/types';
import type {
  ActiveEvent,
  ActivityId,
  BuildingId,
  GameState,
  GoodId,
  ResidentRole,
} from '../engine/types';

const CHEAT_MODE_KEY = 'tp_cheat_mode';

export type Screen =
  | 'post'
  | 'assignments'
  | 'diplomacy'
  | 'characters'
  | 'buildings'
  | 'people'
  | 'map'
  | 'market';

const MIGRATION_CTX = {
  locationDefs: LOCATIONS,
  mapRegionDefs: MAP_REGIONS,
  mapFeatureDefs: MAP_FEATURES,
  heroHeritage: new Map(HERO_POOL.map((t) => [t.id, heritageOf(t)] as const)),
  heroGender: new Map(HERO_POOL.map((t) => [t.id, genderOf(t)] as const)),
  heroSubPeople: new Map(HERO_POOL.map((t) => [t.id, subPeopleOf(t)] as const)),
};

interface GameStore {
  game: GameState | null;
  screen: Screen;
  /** Hero sheet modal target. */
  selectedHeroId: string | null;
  /** Result of the current event choice, shown until Continue. */
  lastResolution: ChoiceResolution | null;
  /** Result of the last resolved raid, shown in the raid modal until Continue. */
  lastRaidResolution: RaidResolution | null;
  /** Season-end skill growth lines, shown once on the next assignment phase. */
  growthLines: string[];
  /** Whether the cheat console is unlocked (persisted; off by default). */
  cheatModeEnabled: boolean;
  /** Whether the cheat console overlay is currently open. */
  cheatConsoleOpen: boolean;

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
  /** Resolve the pending raid encounter with the player's chosen battle plan. */
  resolveRaid: (params: RaidDefenseParams | RaidAttackParams) => void;
  /** Dismiss the resolved-raid result and let the turn proceed. */
  continueRaid: () => void;

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
  /** Hire native residents of a role from a local source (tribe/region). Returns false if invalid. */
  hire: (role: ResidentRole, count: number, source: string) => boolean;
  /** Move residents between roles/idle at the post. Returns false if invalid. */
  reallocateResidents: (
    from: ResidentRole | 'idle',
    to: ResidentRole | 'idle',
    count: number,
  ) => boolean;

  /** Unlock/lock the cheat console (persisted across reloads). */
  setCheatMode: (enabled: boolean) => void;
  setCheatConsoleOpen: (open: boolean) => void;
  /** Apply arbitrary testing outcomes against a cloned draft. Returns the log lines. */
  applyCheatOutcomes: (outcomes: Outcome[], heroId: string) => string[];
  /** Force a non-travel event to fire immediately, bypassing selection/eligibility.
   *  Returns false if the event/hero is invalid. */
  forceFireEvent: (eventId: string, heroId: string) => boolean;
}

function draft(game: GameState): GameState {
  return structuredClone(game);
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  screen: 'post',
  selectedHeroId: null,
  lastResolution: null,
  lastRaidResolution: null,
  growthLines: [],
  cheatModeEnabled: typeof localStorage !== 'undefined' && localStorage.getItem(CHEAT_MODE_KEY) === 'true',
  cheatConsoleOpen: false,

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
      mapRegionDefs: MAP_REGIONS,
      mapFeatureDefs: MAP_FEATURES,
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
      active.locationId,
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

  resolveRaid: (params) => {
    const { game } = get();
    if (!game || !game.pendingRaid) return;
    const next = draft(game);
    const pendingRaid = next.pendingRaid;
    if (!pendingRaid) return;
    const rng = new Rng(next.rngState);
    const resolution =
      pendingRaid.kind === 'incoming'
        ? resolveIncomingRaid(next, params as RaidDefenseParams, rng, {
            goodDefs: CONTENT.goodDefs,
            goodNames: CONTENT.goodNames,
            buildingNames: CONTENT.buildingNames,
          })
        : resolveOutgoingRaid(next, pendingRaid, params as RaidAttackParams, rng, {
            goodDefs: CONTENT.goodDefs,
            goodNames: CONTENT.goodNames,
            buildingNames: CONTENT.buildingNames,
          });
    next.rngState = rng.getState();
    // Fold the battle narrative into the turn report.
    for (const line of resolution.log) next.report.lines.push({ icon: '⚔️', text: line });
    // If the post survived and this raid arose mid-turn (event/report phase), let
    // the turn continue; a cheat-triggered raid during assignment stays put.
    if (!next.gameOver && (next.phase === 'event' || next.phase === 'report')) {
      next.phase = next.pendingEvents.length > 0 ? 'event' : 'report';
    }
    autosave(next);
    set({ game: next, lastRaidResolution: resolution });
  },

  continueRaid: () => set({ lastRaidResolution: null }),

  buy: (good, qty) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return;
    const def = CONTENT.goodDefs.get(good);
    if (!def) return;
    const next = draft(game);
    if (buyGood(next, def, qty)) {
      autosave(next);
      set({ game: next });
    }
  },

  sell: (good, qty) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return;
    const def = CONTENT.goodDefs.get(good);
    if (!def) return;
    const next = draft(game);
    if (sellGood(next, def, qty)) {
      autosave(next);
      set({ game: next });
    }
  },

  dispatch: (params) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!dispatchExpedition(next, params, CONTENT.locationDefs, CONTENT.mapRegionDefs)) return false;
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

  hire: (role, count, source) => {
    const { game } = get();
    if (!game || game.phase !== 'assignment') return false;
    const next = draft(game);
    if (!hireResidents(next, role, count, source)) return false;
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

  setCheatMode: (enabled) => {
    localStorage.setItem(CHEAT_MODE_KEY, enabled ? 'true' : 'false');
    set({ cheatModeEnabled: enabled, cheatConsoleOpen: enabled ? get().cheatConsoleOpen : false });
  },

  setCheatConsoleOpen: (open) => set({ cheatConsoleOpen: open }),

  applyCheatOutcomes: (outcomes, heroId) => {
    const { game } = get();
    if (!game) return [];
    const next = draft(game);
    const log = applyOutcomes(next, outcomes, outcomeCtx(CONTENT, heroId));
    autosave(next);
    set({ game: next });
    return log;
  },

  forceFireEvent: (eventId, heroId) => {
    const { game } = get();
    if (!game) return false;
    const event = CONTENT.events.get(eventId);
    if (!event || event.category === 'travel') return false;
    if (!livingHeroes(game).some((h) => h.id === heroId)) return false;
    const next = draft(game);
    next.pendingEvents = [{ eventId, heroId }, ...next.pendingEvents];
    next.phase = 'event';
    autosave(next);
    set({ game: next, lastResolution: null });
    return true;
  },
}));

/** Travel context for the active event, so travel conditions can evaluate. */
export function travelContextOf(game: GameState, active: ActiveEvent): TravelContext | undefined {
  if (!active.expeditionId) return undefined;
  const expedition = game.expeditions.find((e) => e.id === active.expeditionId);
  if (!expedition) return undefined;
  return travelContextFor(expedition, CONTENT);
}

/** Whether a choice's requirements are met right now (locked choices show why). */
export function choiceAvailable(
  game: GameState,
  requires?: Parameters<typeof evalConditions>[1],
  travel?: TravelContext,
  heroId?: string,
) {
  return !requires || evalConditions(game, requires, { travel, heroId });
}
