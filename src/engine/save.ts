// Save/load (spec §2): JSON serialization with a saveVersion guard. The game
// is pre-release and carries no save-migration system — a save whose version
// doesn't match the current schema is simply rejected (validateGameState),
// never migrated. localStorage autosave each turn + manual export/import.

import { TUNING } from '../content/tuning';
import { validateGameState } from './saveValidation';
import type { GameState } from './types';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const raw: unknown = JSON.parse(json);
  if (
    typeof raw !== 'object' ||
    raw === null ||
    Array.isArray(raw) ||
    typeof (raw as { saveVersion?: unknown }).saveVersion !== 'number'
  ) {
    throw new Error('Not a valid Trading Post save.');
  }
  // No migration: validateGameState rejects any save whose version isn't current.
  return validateGameState(raw);
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
