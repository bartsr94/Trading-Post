// Save/load (spec §2): JSON serialization with a saveVersion and a migration
// stub from day one. localStorage autosave each turn + manual export/import.

import { TUNING } from '../content/tuning';
import type { GameState } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const raw = JSON.parse(json) as GameState;
  if (typeof raw !== 'object' || raw === null || typeof raw.saveVersion !== 'number') {
    throw new Error('Not a valid Trading Post save.');
  }
  return migrate(raw);
}

/** Migration stub: bump TUNING.save.version and add a case when the shape changes. */
export function migrate(save: GameState): GameState {
  let current = save;
  while (current.saveVersion < TUNING.save.version) {
    switch (current.saveVersion) {
      // case 1: current = migrateV1toV2(current); break;
      default:
        throw new Error(`No migration path from save version ${current.saveVersion}.`);
    }
  }
  if (current.saveVersion > TUNING.save.version) {
    throw new Error('Save is from a newer version of the game.');
  }
  return current;
}

export function autosave(state: GameState): void {
  try {
    localStorage.setItem(TUNING.save.autosaveKey, serialize(state));
  } catch {
    // Storage full or unavailable — a lost autosave should never crash a turn.
  }
}

export function loadAutosave(): GameState | null {
  try {
    const json = localStorage.getItem(TUNING.save.autosaveKey);
    return json ? deserialize(json) : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(TUNING.save.autosaveKey);
  } catch {
    // ignore
  }
}
