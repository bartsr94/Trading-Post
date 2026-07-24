import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TUNING } from '../content/tuning';
import { testState } from '../engine/__tests__/helpers';
import type { ChoiceResolution } from '../engine/turn';
import { flushAutosave, useGameStore } from './gameStore';

function makeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => void data.clear(),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  useGameStore.setState({
    game: null,
    screen: 'post',
    selectedHeroId: null,
    lastResolution: null,
    growthLines: [],
    cheatModeEnabled: false,
    cheatConsoleOpen: false,
  });
});

describe('gameStore', () => {
  it('setAssignment edits assignments only during assignment phase', () => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    const s = testState(101, ['p1']);
    const heroId = s.heroes[0].id;
    s.phase = 'assignment';
    useGameStore.setState({ game: s });

    useGameStore.getState().setAssignment(heroId, 'rest');
    expect(useGameStore.getState().game!.assignments[heroId]).toBe('rest');

    useGameStore.setState({ game: { ...useGameStore.getState().game!, phase: 'event' as const } });
    useGameStore.getState().setAssignment(heroId, 'trade');
    expect(useGameStore.getState().game!.assignments[heroId]).toBe('rest');

    // Settle the debounced autosave scheduled above so its timer doesn't
    // linger into a later test.
    flushAutosave();
  });

  it('newGame seeds + sets initial screen and assignments', () => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    vi.spyOn(Date, 'now').mockReturnValue(123);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    useGameStore.getState().newGame(['p1', 'p2']);
    const { game, screen } = useGameStore.getState();

    expect(screen).toBe('assignments');
    expect(game).not.toBeNull();
    expect(game!.seed).toBe((123 ^ (0.5 * 0xffffffff)) >>> 0);

    for (const hero of game!.heroes) {
      expect(game!.assignments[hero.id]).toBe('trade');
    }
  });

  it('autosaves on newGame and can continue from autosave', () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal('localStorage', localStorage);
    vi.spyOn(Date, 'now').mockReturnValue(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.25);

    useGameStore.getState().newGame(['p1']);
    expect(localStorage.getItem(TUNING.save.autosaveKey)).toBeTruthy();

    useGameStore.setState({ game: null, screen: 'post' });
    useGameStore.getState().continueGame();
    expect(useGameStore.getState().game).not.toBeNull();
    expect(useGameStore.getState().screen).toBe('post');
  });

  it('exports and imports saves', () => {
    const s = testState(42, ['p1']);
    useGameStore.setState({ game: s });

    const json = useGameStore.getState().exportSave();
    expect(json).toBeTruthy();

    useGameStore.setState({ game: null });
    const err = useGameStore.getState().importSave(json!);
    expect(err).toBeNull();
    expect(useGameStore.getState().game).not.toBeNull();
  });

  it('startConstruction and cancelConstruction mutate the game only during assignment phase', () => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    const s = testState(7, ['p1']);
    s.phase = 'assignment';
    s.silver = 200;
    s.goods.timber = 50;
    useGameStore.setState({ game: s });

    expect(useGameStore.getState().startConstruction('storehouse')).toBe(true);
    const afterStart = useGameStore.getState().game!;
    const def = TUNING.building.defs.storehouse;
    expect(afterStart.construction?.building).toBe('storehouse');
    expect(afterStart.silver).toBe(200 - def.cost.silver);
    expect(afterStart.goods.timber).toBe(50 - (def.cost.goods?.timber ?? 0));

    useGameStore.getState().cancelConstruction();
    expect(useGameStore.getState().game!.construction).toBeNull();

    useGameStore.setState({ game: { ...afterStart, phase: 'event' as const, construction: null } });
    expect(useGameStore.getState().startConstruction('storehouse')).toBe(false);

    flushAutosave();
  });

  it('confirmTurn advances the game and clears transient UI fields', () => {
    const s = testState(9, ['p1', 'p2']);
    s.phase = 'assignment';
    const resolution: ChoiceResolution = {
      check: null,
      tier: 'success',
      resultText: 'x',
      log: [],
    };
    useGameStore.setState({ game: s, lastResolution: resolution, growthLines: ['y'] });

    useGameStore.getState().confirmTurn();
    const { game, lastResolution: lastResolutionAfter, growthLines } = useGameStore.getState();

    expect(game).not.toBeNull();
    expect(game!.phase).not.toBe('assignment');
    expect(lastResolutionAfter).toBeNull();
    expect(growthLines).toEqual([]);
  });

  it('forceFireEvent + chooseOption + continueEvent drive an immediate event choice flow', () => {
    const s = testState(202, ['p1']);
    const heroId = s.heroes[0].id;
    useGameStore.setState({ game: s });

    expect(useGameStore.getState().forceFireEvent('post_drifter', heroId)).toBe(true);
    expect(useGameStore.getState().game!.phase).toBe('event');

    useGameStore.getState().chooseOption(0);
    expect(useGameStore.getState().lastResolution).not.toBeNull();
    expect(useGameStore.getState().game!.flags.drifter_resolved).toBe(true);

    useGameStore.getState().continueEvent();
    expect(useGameStore.getState().lastResolution).toBeNull();
  });

  it('chooseOption autosaves immediately, like the other turn-phase-boundary actions', () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal('localStorage', localStorage);
    const s = testState(203, ['p1']);
    const heroId = s.heroes[0].id;
    useGameStore.setState({ game: s });

    useGameStore.getState().forceFireEvent('post_drifter', heroId);
    // Isolate chooseOption's own save from forceFireEvent's.
    localStorage.removeItem(TUNING.save.autosaveKey);

    useGameStore.getState().chooseOption(0);
    expect(localStorage.getItem(TUNING.save.autosaveKey)).toBeTruthy();
  });

  it('setAssignment schedules a debounced autosave', () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal('localStorage', localStorage);
    const s = testState(204, ['p1']);
    const heroId = s.heroes[0].id;
    s.phase = 'assignment';
    useGameStore.setState({ game: s });

    useGameStore.getState().setAssignment(heroId, 'rest');
    // Debounced: nothing written until the timer (or a flush) fires.
    expect(localStorage.getItem(TUNING.save.autosaveKey)).toBeNull();

    flushAutosave();
    expect(localStorage.getItem(TUNING.save.autosaveKey)).toBeTruthy();
  });

  it('setCheatMode persists and disables the overlay when locked', () => {
    const localStorage = makeLocalStorage();
    vi.stubGlobal('localStorage', localStorage);

    useGameStore.getState().setCheatMode(true);
    expect(localStorage.getItem('tp_cheat_mode')).toBe('true');
    expect(useGameStore.getState().cheatModeEnabled).toBe(true);

    useGameStore.setState({ cheatConsoleOpen: true });
    useGameStore.getState().setCheatMode(false);
    expect(localStorage.getItem('tp_cheat_mode')).toBe('false');
    expect(useGameStore.getState().cheatModeEnabled).toBe(false);
    expect(useGameStore.getState().cheatConsoleOpen).toBe(false);
  });

  it('applyCheatOutcomes applies outcomes against a draft and returns log lines', () => {
    const s = testState(303, ['p1']);
    const heroId = s.heroes[0].id;
    s.silver = 10;
    useGameStore.setState({ game: s });

    const log = useGameStore.getState().applyCheatOutcomes([{ type: 'silver', delta: 5 }], heroId);
    expect(useGameStore.getState().game!.silver).toBe(15);
    expect(log.length).toBeGreaterThan(0);
  });
});
