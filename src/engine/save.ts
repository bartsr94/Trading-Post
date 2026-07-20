// Save/load (spec §2): JSON serialization with a saveVersion and a migration
// stub from day one. localStorage autosave each turn + manual export/import.

import { TUNING } from '../content/tuning';
import { freshResidents, residentTotal } from './residents';
import { createLocationStates } from './state';
import type { Gender, GameState, Heritage, LocationDef } from './types';

/** Content the migrations need; injected so the engine stays content-free. */
export interface MigrationContext {
  locationDefs: readonly LocationDef[];
  /** hero id → heritage, so v6→v7 can backfill each living hero (HERITAGE_SPEC.md §10). */
  heroHeritage?: ReadonlyMap<string, Heritage>;
  /** hero id → gender, so v7→v8 can backfill each hero (FAMILY_SPEC.md §12). */
  heroGender?: ReadonlyMap<string, Gender>;
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
      case 5:
        current = migrateV5toV6(current);
        break;
      case 6:
        current = migrateV6toV7(current, ctx);
        break;
      case 7:
        current = migrateV7toV8(current, ctx);
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

/** v6 adds buildings + the (empty) construction slot. postTier already exists. */
function migrateV5toV6(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 6,
    buildings: [],
    construction: null,
  };
}

/**
 * v7 adds the heritage system (HERITAGE_SPEC.md): the `culture` axis, the
 * resident heritage tally, per-hero heritage, and the compromise streak.
 * Pre-feature residents are treated as homeland founders; the tally self-corrects
 * as the pool churns. Hero heritage comes from the injected content map.
 */
function migrateV6toV7(save: GameState, ctx?: MigrationContext): GameState {
  return {
    ...save,
    saveVersion: 7,
    axes: { ...save.axes, culture: 0 },
    charterCompromisedStreak: 0,
    residents: {
      ...save.residents,
      heritage: { homeland: residentTotal(save), native: 0 },
    },
    heroes: save.heroes.map((h) => ({
      ...h,
      heritage: ctx?.heroHeritage?.get(h.id) ?? 'imanian',
    })),
  };
}

/**
 * v8 adds families (FAMILY_SPEC.md): gender on every named person, the recruit-id
 * counter, and the richer relationship-carrying dependant. Hero gender comes from
 * the injected content map (falling back to 'male'); bloodline stays undefined
 * (unwed). Pre-v8 dependants (none in practice) default gender 'female' and derive
 * ancestry from their single heritage.
 */
function migrateV7toV8(save: GameState, ctx?: MigrationContext): GameState {
  return {
    ...save,
    saveVersion: 8,
    nextCharacterId: save.nextCharacterId ?? 1,
    heroes: save.heroes.map((h) => ({
      ...h,
      gender: h.gender ?? ctx?.heroGender?.get(h.id) ?? 'male',
    })),
    dependants: save.dependants.map((d) => ({
      ...d,
      gender: d.gender ?? 'female',
      ancestry: d.ancestry ?? (d.heritage ? { peoples: [d.heritage] } : undefined),
    })),
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
