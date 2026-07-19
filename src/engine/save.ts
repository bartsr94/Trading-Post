// Save/load (spec §2): JSON serialization with a saveVersion and a migration
// stub from day one. localStorage autosave each turn + manual export/import.

import { TUNING } from '../content/tuning';
import { freshResidents } from './residents';
import { createLocationStates } from './state';
import type { GameState, LocationDef } from './types';

/** Content the migrations need; injected so the engine stays content-free. */
export interface MigrationContext {
  locationDefs: readonly LocationDef[];
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string, ctx?: MigrationContext): GameState {
  const raw = JSON.parse(json) as GameState;
  if (typeof raw !== 'object' || raw === null || typeof raw.saveVersion !== 'number') {
    throw new Error('Not a valid Trading Post save.');
  }
  return migrate(raw, ctx);
}

/** Migration chain: bump TUNING.save.version and add a case when the shape changes. */
export function migrate(save: GameState, ctx?: MigrationContext): GameState {
  let current = save;
  while (current.saveVersion < TUNING.save.version) {
    switch (current.saveVersion) {
      case 1:
        current = migrateV1toV2(current, ctx);
        break;
      case 2:
        current = migrateV2toV3(current);
        break;
      case 3:
        current = migrateV3toV4(current);
        break;
      case 4:
        current = migrateV4toV5(current);
        break;
      default:
        throw new Error(`No migration path from save version ${current.saveVersion}.`);
    }
  }
  if (current.saveVersion > TUNING.save.version) {
    throw new Error('Save is from a newer version of the game.');
  }
  return current;
}

/** v2 adds the map: locations, expeditions, and the expedition id counter. */
function migrateV1toV2(save: GameState, ctx?: MigrationContext): GameState {
  return {
    ...save,
    saveVersion: 2,
    locations: createLocationStates(ctx?.locationDefs ?? []),
    expeditions: [],
    nextExpeditionId: 1,
  };
}

/** v3 adds the Charter Company profit-quota clock. */
function migrateV2toV3(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 3,
    charterMissedStreak: 0,
  };
}

/** v4 adds the resident population and the (empty) transient layer. */
function migrateV3toV4(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 4,
    residents: freshResidents(),
    transients: [],
    nextTransientId: 1,
  };
}

/** v5 adds the active-party roster and the (empty) dependant layer. */
function migrateV4toV5(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 5,
    // Every existing living hero was, by definition, the active party.
    activePartyIds: save.heroes.filter((h) => h.status === 'active').map((h) => h.id),
    dependants: [],
    nextDependantId: 1,
  };
}

export function autosave(state: GameState): void {
  try {
    localStorage.setItem(TUNING.save.autosaveKey, serialize(state));
  } catch {
    // Storage full or unavailable — a lost autosave should never crash a turn.
  }
}

export function loadAutosave(ctx?: MigrationContext): GameState | null {
  try {
    const json = localStorage.getItem(TUNING.save.autosaveKey);
    return json ? deserialize(json, ctx) : null;
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
