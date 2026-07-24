// Save/load (spec §2): JSON serialization with a saveVersion and a migration
// stub from day one. localStorage autosave each turn + manual export/import.

import { TUNING } from '../content/tuning';
import { freshClaim, freshHerd } from './claim';
import { createDiplomacySeatStates } from './diplomacy';
import { emptyRoles, freshResidents, residentTotal } from './residents';
import { journeyTurns, mapKnowledgeFromDiscovery, mergeSurveyCells } from './map';
import { createLocationStates } from './state';
import { validateGameState } from './saveValidation';
import { defaultSubPeople, discoveryAtLeast } from './types';
import type {
  FactionId,
  Gender,
  GameState,
  Heritage,
  LocationDef,
  LocationId,
  MapFeatureDef,
  MapRegionDef,
  RaidManeuver,
  RaidSeverity,
} from './types';

/** Content the migrations need; injected so the engine stays content-free. */
export interface MigrationContext {
  locationDefs: readonly LocationDef[];
  mapRegionDefs?: readonly MapRegionDef[];
  mapFeatureDefs?: readonly MapFeatureDef[];
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
  const raw: unknown = JSON.parse(json);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || typeof (raw as { saveVersion?: unknown }).saveVersion !== 'number') {
    throw new Error('Not a valid Trading Post save.');
  }
  return validateGameState(migrate(raw as GameState, ctx));
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
      case 11:
        current = migrateV11toV12(current, ctx);
        break;
      case 12:
        current = migrateV12toV13(current, ctx);
        break;
      case 13:
        current = migrateV13toV14(current);
        break;
      case 14:
        current = migrateV14toV15(current);
        break;
      case 15:
        current = migrateV15toV16(current);
        break;
      case 16:
        current = migrateV16toV17(current, ctx);
        break;
      case 17:
        current = migrateV17toV18(current, ctx);
        break;
      case 18:
        current = migrateV18toV19(current, ctx);
        break;
      case 19:
        current = migrateV19toV20(current, ctx);
        break;
      case 20:
        current = migrateV20toV21(current);
        break;
      case 21:
        current = migrateV21toV22(current);
        break;
      case 22:
        current = migrateV22toV23(current);
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

/** v12 replaces the abstract node graph with spatial travel and fog knowledge. */
function migrateV11toV12(save: GameState, ctx?: MigrationContext): GameState {
  const locations = ctx?.locationDefs ?? [];
  const byId = new Map(locations.map((location) => [location.id, location]));
  const home = byId.get(TUNING.map.homeLocationId);
  const migrated: GameState = {
    ...save,
    saveVersion: 12,
    mapKnowledge: { surveyedCells: [] },
    expeditions: save.expeditions.map((expedition) => {
      const destination = expedition.destination ? byId.get(expedition.destination) : undefined;
      const target = expedition.target ?? destination?.mapPoint ?? home?.mapPoint ?? { x: 0.5, y: 0.5 };
      const spatialTurns = home ? journeyTurns(home.mapPoint, target, 'normal') : expedition.turnsLeft;
      return {
        ...expedition,
        target,
        pace: expedition.pace ?? 'normal',
        legTurns: expedition.legTurns ?? Math.max(1, expedition.turnsLeft, spatialTurns),
      };
    }),
  };
  migrated.mapKnowledge = mapKnowledgeFromDiscovery(
    migrated,
    locations,
    ctx?.mapRegionDefs ?? [],
    ctx?.mapFeatureDefs ?? [],
  );
  return migrated;
}

/** v13 refreshes authored map anchors, initial discoveries, and familiar terrain. */
function migrateV12toV13(save: GameState, ctx?: MigrationContext): GameState {
  const locations = ctx?.locationDefs ?? [];
  const baseline = createLocationStates(locations);
  const nextLocations = { ...save.locations };
  for (const def of locations) {
    const current = nextLocations[def.id] ?? baseline[def.id];
    if (!current) continue;
    nextLocations[def.id] = discoveryAtLeast(current.discovery, def.initialDiscovery)
      ? current
      : { ...current, discovery: def.initialDiscovery };
  }

  const byId = new Map(locations.map((location) => [location.id, location]));
  const migrated: GameState = {
    ...save,
    saveVersion: 13,
    locations: nextLocations,
    expeditions: save.expeditions.map((expedition) => ({
      ...expedition,
      ...(expedition.destination && byId.has(expedition.destination)
        ? { target: byId.get(expedition.destination)!.mapPoint }
        : {}),
    })),
  };
  const baselineKnowledge = mapKnowledgeFromDiscovery(
    migrated,
    locations,
    ctx?.mapRegionDefs ?? [],
    ctx?.mapFeatureDefs ?? [],
  );
  migrated.mapKnowledge = {
    surveyedCells: mergeSurveyCells(
      save.mapKnowledge?.surveyedCells ?? [],
      baselineKnowledge.surveyedCells,
    ),
  };
  return migrated;
}

/**
 * v14 adds raiding (RAIDING_SPEC.md): the pending-raid slot plus the cadence and
 * cascade bookkeeping. All absent/zero on an old save — no aggressor knows the
 * post yet, and the grace period is measured from `turn`, so a loaded game
 * simply starts its raid clock from wherever it is.
 */
function migrateV13toV14(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 14,
    pendingRaid: null,
    lastRaidTurn: 0,
    lastSackedTurn: 0,
  };
}

/** v15 adds the standing tribute relationships for raiding Phase B. */
function migrateV14toV15(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 15,
    tributes: [],
  };
}

interface LegacyPendingIncomingRaid {
  faction: FactionId;
  severity: RaidSeverity;
  attackerForce: number;
  attackerManeuver: RaidManeuver;
  spotted: boolean;
  band: string;
}

/** v16 broadens the pending raid slot from incoming-only to a typed encounter union. */
function migrateV15toV16(save: GameState): GameState {
  const pendingRaid = save.pendingRaid as unknown as LegacyPendingIncomingRaid | null;
  return {
    ...save,
    saveVersion: 16,
    pendingRaid:
      pendingRaid === null
        ? null
        : {
            kind: 'incoming',
            faction: pendingRaid.faction,
            severity: pendingRaid.severity,
            attackerForce: pendingRaid.attackerForce,
            attackerManeuver: pendingRaid.attackerManeuver,
            spotted: pendingRaid.spotted,
            band: pendingRaid.band,
      },
  };
}

/** v17 refreshes the authored route zones and the baseline surveyed coastline. */
function migrateV16toV17(save: GameState, ctx?: MigrationContext): GameState {
  const locations = ctx?.locationDefs ?? [];
  const baselineKnowledge = mapKnowledgeFromDiscovery(
    save,
    locations,
    ctx?.mapRegionDefs ?? [],
    ctx?.mapFeatureDefs ?? [],
  );
  return {
    ...save,
    saveVersion: 17,
    mapKnowledge: {
      surveyedCells: mergeSurveyCells(
        save.mapKnowledge?.surveyedCells ?? [],
        baselineKnowledge.surveyedCells,
      ),
    },
  };
}

/** v18 removes the old auto-charted starter routes from fresh, unplayed campaigns. */
function migrateV17toV18(save: GameState, ctx?: MigrationContext): GameState {
  const locations = ctx?.locationDefs ?? [];
  const baselineKnowledge = mapKnowledgeFromDiscovery(
    save,
    locations,
    ctx?.mapRegionDefs ?? [],
    ctx?.mapFeatureDefs ?? [],
  );
  const shouldRefreshFreshStart =
    save.turn === 1 &&
    save.phase === 'assignment' &&
    save.expeditions.length === 0 &&
    save.pendingEvents.length === 0;
  return {
    ...save,
    saveVersion: 18,
    mapKnowledge: shouldRefreshFreshStart
      ? baselineKnowledge
      : {
          surveyedCells: mergeSurveyCells(
            save.mapKnowledge?.surveyedCells ?? [],
            baselineKnowledge.surveyedCells,
          ),
        },
  };
}

/** v19 adds community-level diplomacy state on top of faction sentiment. */
function migrateV18toV19(save: GameState, ctx?: MigrationContext): GameState {
  const locations = ctx?.locationDefs ?? [];
  return {
    ...save,
    saveVersion: 19,
    diplomacySeats: createDiplomacySeatStates(
      locations,
      Object.fromEntries(
        Object.entries(save.factions).map(([id, faction]) => [id, faction.standing]),
      ) as Partial<Record<FactionId, number>>,
    ),
    expeditions: save.expeditions.map((expedition) =>
      expedition.kind === 'diplomacy' && !expedition.diplomacyMission
        ? { ...expedition, diplomacyMission: { type: 'talks' } }
        : expedition,
    ),
  };
}

/** v20 records each diplomacy seat's parent faction for downstream systems. */
function migrateV19toV20(save: GameState, ctx?: MigrationContext): GameState {
  const locations = ctx?.locationDefs ?? [];
  const seeded = createDiplomacySeatStates(
    locations,
    Object.fromEntries(
      Object.entries(save.factions).map(([id, faction]) => [id, faction.standing]),
    ) as Partial<Record<FactionId, number>>,
  );
  for (const [seatId, seat] of Object.entries(save.diplomacySeats ?? {})) {
    const seededSeat = seeded[seatId as LocationId];
    if (!seededSeat) continue;
    seeded[seatId as LocationId] = {
      ...seededSeat,
      ...(seat as Partial<typeof seededSeat>),
      faction: seededSeat.faction,
    };
  }
  return {
    ...save,
    saveVersion: 20,
    diplomacySeats: seeded,
  };
}

/**
 * v21 adds the Concession, herd, and the two new resident roles
 * (TULA_SETTLEMENT_SPEC.md §10). Population is now uncapped, so old
 * role counts carry over unchanged — nothing needs a population conversion.
 * The starting Concession is seeded fresh; herders/hunters backfill to 0.
 */
function migrateV20toV21(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 21,
    claim: save.claim ?? freshClaim(),
    herd: save.herd ?? freshHerd(),
    residents: {
      ...save.residents,
      roles: { ...emptyRoles(), ...save.residents.roles },
    },
  };
}

/**
 * v22 adds hero-to-hero marriage (`Hero.spouseIds`) and personality flavor
 * tags (`Hero.temperament`) — FAMILY_PHASE_D_SPEC.md §2. Both are optional
 * and additive; no old hero had either, so nothing needs backfilling beyond
 * leaving them absent (same pattern `subPeople` used at v9).
 */
function migrateV21toV22(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 22,
  };
}

/**
 * v23 adds the abduction/captivity mechanic: `'captive'` joins `HeroStatus`
 * and an optional `Hero.captivity` field. Both are additive; no old hero was
 * ever captive, so nothing needs backfilling beyond leaving it absent.
 */
function migrateV22toV23(save: GameState): GameState {
  return {
    ...save,
    saveVersion: 23,
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
