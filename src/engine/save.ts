// Save/load (spec §2): JSON serialization with a saveVersion and a migration
// stub from day one. localStorage autosave each turn + manual export/import.

import { TUNING } from '../content/tuning';
import { freshResidents, residentTotal } from './residents';
import { createLocationStates } from './state';
import { defaultSubPeople } from './types';
import type { Gender, GameState, Heritage, LocationDef } from './types';

/** Content the migrations need; injected so the engine stays content-free. */
export interface MigrationContext {
  locationDefs: readonly LocationDef[];
  /** hero id → heritage, so v6→v7 can backfill each living hero (HERITAGE_SPEC.md §10). */
  heroHeritage?: ReadonlyMap<string, Heritage>;
  /** hero id → gender, so v7→v8 can backfill each hero (FAMILY_SPEC.md §12). */
  heroGender?: ReadonlyMap<string, Gender>;
  /** hero id → tribe/region, so v8→v9 can backfill each hero (PEOPLES_SPEC.md §11). */
  heroSubPeople?: ReadonlyMap<string, string>;
}

/** v9 two-tier people remap: Dustwalker folds into the Hanjoda people, and the
 *  Bejasi Hills folk are Kiswani (their region survives as `subPeople`). */
function remapPeople(h: string): Heritage {
  if (h === 'dustwalker') return 'hanjoda';
  if (h === 'bejasi') return 'kiswani';
  return h as Heritage;
}

/** The tribe/region for a pre-v9 heritage value (PEOPLES_SPEC.md §11). */
function subPeopleFromLegacy(h: string): string {
  return h === 'bejasi' ? 'bejasi_hills' : defaultSubPeople(remapPeople(h));
}

/** Remap a mixed-line's peoples and drop now-redundant duplicates (§11). */
function remapAncestry(peoples: Heritage[]): Heritage[] {
  const out: Heritage[] = [];
  for (const p of peoples) {
    const r = remapPeople(p);
    if (!out.includes(r)) out.push(r);
  }
  return out;
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
      case 8:
        current = migrateV8toV9(current, ctx);
        break;
      case 9:
        current = migrateV9toV10(current);
        break;
      case 10:
        current = migrateV10toV11(current);
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

/**
 * v9 restructures peoples to the two-tier model (PEOPLES_SPEC.md): the `Heritage`
 * enum becomes the true peoples (Dustwalker→Hanjoda, Bejasi Hills folk→Kiswani),
 * every named person gains a `subPeople` tribe/region, and the Knights of Saint
 * Eirwen join as a faction. The resident tally is unchanged (Weri are native,
 * heroes-only — no new bucket). Hero tribes come from the injected map, falling
 * back to the legacy heritage.
 */
function migrateV8toV9(save: GameState, ctx?: MigrationContext): GameState {
  return {
    ...save,
    saveVersion: 9,
    factions: {
      ...save.factions,
      KNIGHTS_EIRWEN: save.factions.KNIGHTS_EIRWEN ?? { standing: 0 },
    },
    heroes: save.heroes.map((h) => ({
      ...h,
      heritage: remapPeople(h.heritage),
      subPeople: h.subPeople ?? ctx?.heroSubPeople?.get(h.id) ?? subPeopleFromLegacy(h.heritage),
    })),
    dependants: save.dependants.map((d) => ({
      ...d,
      heritage: d.heritage ? remapPeople(d.heritage) : undefined,
      subPeople: d.subPeople ?? (d.heritage ? subPeopleFromLegacy(d.heritage) : undefined),
      ancestry: d.ancestry ? { peoples: remapAncestry(d.ancestry.peoples) } : undefined,
    })),
  };
}

/**
 * v10 adds the Beastfolk (BEASTFOLK_SPEC.md): a new `BEASTFOLK` faction, and
 * `orc`/`goblin` join `Heritage` as native-group peoples. Nothing existing is
 * restructured — `orc`/`goblin` are new enum values a save simply never had
 * before, so heroes/dependants/residents need no backfill. The only missing
 * key on a pre-v10 save is the faction standing itself.
 */
function migrateV9toV10(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 10,
    factions: {
      ...save.factions,
      BEASTFOLK: save.factions.BEASTFOLK ?? { standing: -60 },
    },
  };
}

/**
 * v11 makes resident flavor tags countable, not just present. Pre-v11 `tags`
 * was a presence-only `string[]` (pushed once, never incremented or
 * decremented) — the People screen had no way to show how many of a coarse
 * 'native' bucket were, say, Kiswani vs Beastfolk. There is no true
 * historical count to recover from a `string[]`, so each existing tag
 * backfills to 1 — the only honest floor, not a fabricated guess.
 */
function migrateV10toV11(save: GameState): GameState {
  const rawTags = save.residents.tags as unknown;
  let tags: Record<string, number>;
  if (Array.isArray(rawTags)) {
    tags = {};
    for (const t of rawTags as string[]) tags[t] = 1;
  } else {
    // Already object-shaped (e.g. a save built directly in the new shape by
    // a test fixture) — nothing to convert.
    tags = rawTags as Record<string, number>;
  }
  return {
    ...save,
    saveVersion: 11,
    residents: { ...save.residents, tags },
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
