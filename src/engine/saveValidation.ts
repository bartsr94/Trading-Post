import { TUNING } from '../content/tuning';
import { residentTotal } from './residents';
import {
  ACTIVITY_IDS,
  DEPENDANT_KINDS,
  DISCOVERY_STATES,
  DIPLOMACY_MISSION_TYPES,
  DIPLOMACY_PACTS,
  DIPLOMACY_TRIBUTE_MODES,
  FACTION_IDS,
  GOOD_IDS,
  HERITAGES,
  RESIDENT_ROLES,
  SKILL_IDS,
  STAT_IDS,
  TRIBUTE_DIRECTIONS,
  TRANSIENT_KINDS,
} from './types';
import type { GameState } from './types';

type UnknownRecord = Record<string, unknown>;

const PHASES = ['assignment', 'event', 'report', 'gameover'] as const;
const HERO_STATUSES = ['active', 'dead', 'departed'] as const;
const GENDERS = ['male', 'female'] as const;
const BLOODLINES = ['pure', 'mixed'] as const;
const EXPEDITION_KINDS = ['caravan', 'explore', 'diplomacy', 'labor', 'courtship', 'raid'] as const;
const EXPEDITION_PACES = ['fast', 'normal', 'slow'] as const;
const EXPEDITION_LEGS = ['outbound', 'returning'] as const;
const CHECK_TIERS = ['critSuccess', 'success', 'failure', 'critFailure'] as const;
const AXIS_IDS = ['integration', 'communal', 'culture'] as const;
const GAME_OVER_KINDS = ['bankrupt', 'brokenCompany', 'charterRevoked', 'destroyed'] as const;
const RAID_SEVERITIES = ['probe', 'raid', 'warband'] as const;
const RAID_MANEUVERS = ['skirmish', 'charge', 'evade'] as const;
const RAID_ATTACK_GOALS = ['plunder', 'burn', 'bloody', 'cow'] as const;

function invalid(path: string, detail = 'is invalid'): never {
  throw new Error(`Not a valid Trading Post save: ${path} ${detail}.`);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(path, 'must be an object');
  return value as UnknownRecord;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) invalid(path, 'must be a non-empty string');
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path, 'must be finite');
  return value;
}

function integer(value: unknown, path: string): number {
  const n = finite(value, path);
  if (!Number.isInteger(n)) invalid(path, 'must be an integer');
  return n;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const n = integer(value, path);
  if (n < 0) invalid(path, 'must be non-negative');
  return n;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path, 'must be boolean');
  return value;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, 'must be an array');
  return value;
}

function enumValue(value: unknown, allowed: readonly string[], path: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) invalid(path);
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  return array(value, path).map((item, index) => string(item, `${path}[${index}]`));
}

function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) invalid(path, 'contains duplicate IDs');
}

function validateNumericRecord(
  value: unknown,
  keys: readonly string[],
  path: string,
  count = false,
): void {
  const obj = record(value, path);
  for (const key of keys) {
    if (!(key in obj)) invalid(`${path}.${key}`, 'is missing');
    if (count) nonNegativeInteger(obj[key], `${path}.${key}`);
    else finite(obj[key], `${path}.${key}`);
  }
}

function validateStringRecord(value: unknown, allowed: readonly string[], path: string): void {
  const obj = record(value, path);
  for (const [key, entry] of Object.entries(obj)) enumValue(entry, allowed, `${path}.${key}`);
}

function validateBooleanRecord(value: unknown, path: string): void {
  const obj = record(value, path);
  for (const [key, entry] of Object.entries(obj)) boolean(entry, `${path}.${key}`);
}

function validateIntegerRecord(value: unknown, path: string, nonNegative = false): void {
  const obj = record(value, path);
  for (const [key, entry] of Object.entries(obj)) {
    if (nonNegative) nonNegativeInteger(entry, `${path}.${key}`);
    else integer(entry, `${path}.${key}`);
  }
}

function validateChainVars(value: unknown, path: string): void {
  const obj = record(value, path);
  for (const [key, entry] of Object.entries(obj)) {
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) invalid(`${path}.${key}`, 'must be finite');
    } else if (typeof entry !== 'string' && typeof entry !== 'boolean') {
      invalid(`${path}.${key}`, 'must be a string, number, or boolean');
    }
  }
}

function validateGoodCounts(value: unknown, path: string, partial: boolean): void {
  const obj = record(value, path);
  for (const key of Object.keys(obj)) {
    if (!(GOOD_IDS as readonly string[]).includes(key)) invalid(`${path}.${key}`, 'is an unknown good');
    nonNegativeInteger(obj[key], `${path}.${key}`);
  }
  if (!partial) {
    for (const good of GOOD_IDS) if (!(good in obj)) invalid(`${path}.${good}`, 'is missing');
  }
}

function validateMarket(value: unknown, path: string): void {
  const obj = record(value, path);
  for (const good of GOOD_IDS) {
    const market = record(obj[good], `${path}.${good}`);
    finite(market.supplyDemandMod, `${path}.${good}.supplyDemandMod`);
    finite(market.eventMod, `${path}.${good}.eventMod`);
  }
}

function validateMapPoint(value: unknown, path: string): void {
  const point = record(value, path);
  const x = finite(point.x, `${path}.x`);
  const y = finite(point.y, `${path}.y`);
  if (x < 0 || x > 1 || y < 0 || y > 1) invalid(path, 'must be normalized');
}

function validateHero(value: unknown, path: string): string {
  const hero = record(value, path);
  const id = string(hero.id, `${path}.id`);
  string(hero.name, `${path}.name`);
  string(hero.epithet, `${path}.epithet`);
  if (typeof hero.bio !== 'string') invalid(`${path}.bio`, 'must be a string');
  validateNumericRecord(hero.stats, STAT_IDS, `${path}.stats`);
  validateNumericRecord(hero.skills, SKILL_IDS, `${path}.skills`);
  for (const [index, skill] of array(hero.skillMarks, `${path}.skillMarks`).entries()) {
    enumValue(skill, SKILL_IDS, `${path}.skillMarks[${index}]`);
  }
  stringArray(hero.traits, `${path}.traits`);
  finite(hero.health, `${path}.health`);
  finite(hero.stress, `${path}.stress`);
  enumValue(hero.status, HERO_STATUSES, `${path}.status`);
  enumValue(hero.heritage, HERITAGES, `${path}.heritage`);
  enumValue(hero.gender, GENDERS, `${path}.gender`);
  if (hero.bloodline !== undefined) enumValue(hero.bloodline, BLOODLINES, `${path}.bloodline`);
  stringArray(hero.history, `${path}.history`);
  return id;
}

function validateDependant(value: unknown, path: string): string {
  const dep = record(value, path);
  const id = string(dep.id, `${path}.id`);
  string(dep.name, `${path}.name`);
  enumValue(dep.kind, DEPENDANT_KINDS, `${path}.kind`);
  string(dep.parentId, `${path}.parentId`);
  enumValue(dep.gender, GENDERS, `${path}.gender`);
  if (dep.parentIds !== undefined) stringArray(dep.parentIds, `${path}.parentIds`);
  if (dep.spouseId !== undefined) string(dep.spouseId, `${path}.spouseId`);
  if (dep.heritage !== undefined) enumValue(dep.heritage, HERITAGES, `${path}.heritage`);
  if (dep.bornTurn !== undefined) nonNegativeInteger(dep.bornTurn, `${path}.bornTurn`);
  if (dep.comeOfAge !== undefined) boolean(dep.comeOfAge, `${path}.comeOfAge`);
  if (dep.ancestry !== undefined) {
    const ancestry = record(dep.ancestry, `${path}.ancestry`);
    const peoples = array(ancestry.peoples, `${path}.ancestry.peoples`);
    peoples.forEach((people, index) =>
      enumValue(people, HERITAGES, `${path}.ancestry.peoples[${index}]`),
    );
  }
  return id;
}

function validateSurvey(value: unknown, path: string, maxCell: number): void {
  const survey = record(value, path);
  enumValue(survey.tier, CHECK_TIERS, `${path}.tier`);
  validateCells(survey.surveyedCells, `${path}.surveyedCells`, maxCell);
  stringArray(survey.discoveredLocationIds, `${path}.discoveredLocationIds`);
  stringArray(survey.knownLocationIds, `${path}.knownLocationIds`);
}

function validateCells(value: unknown, path: string, maxCell: number): void {
  const cells = array(value, path).map((cell, index) => nonNegativeInteger(cell, `${path}[${index}]`));
  if (cells.some((cell) => cell >= maxCell)) invalid(path, 'contains an out-of-range cell');
  if (new Set(cells).size !== cells.length) invalid(path, 'contains duplicate cells');
}

function validateExpedition(
  value: unknown,
  path: string,
  heroIds: ReadonlySet<string>,
  maxCell: number,
): { id: string; heroIds: string[] } {
  const exp = record(value, path);
  const id = string(exp.id, `${path}.id`);
  enumValue(exp.kind, EXPEDITION_KINDS, `${path}.kind`);
  if (exp.destination !== undefined) string(exp.destination, `${path}.destination`);
  validateMapPoint(exp.target, `${path}.target`);
  enumValue(exp.pace, EXPEDITION_PACES, `${path}.pace`);
  if (integer(exp.legTurns, `${path}.legTurns`) < 1) invalid(`${path}.legTurns`, 'must be positive');
  const party = stringArray(exp.heroIds, `${path}.heroIds`);
  if (party.length < 1 || party.length > TUNING.map.maxExpeditionHeroes) invalid(`${path}.heroIds`);
  unique(party, `${path}.heroIds`);
  for (const heroId of party) if (!heroIds.has(heroId)) invalid(`${path}.heroIds`, 'references an unknown hero');
  enumValue(exp.leg, EXPEDITION_LEGS, `${path}.leg`);
  integer(exp.turnsLeft, `${path}.turnsLeft`);
  validateGoodCounts(exp.cargo, `${path}.cargo`, true);
  nonNegativeInteger(exp.silver, `${path}.silver`);
  validateGoodCounts(exp.buyOrders, `${path}.buyOrders`, true);
  if (exp.residentEscort !== undefined) {
    const escort = record(exp.residentEscort, `${path}.residentEscort`);
    for (const [role, count] of Object.entries(escort)) {
      if (!(RESIDENT_ROLES as readonly string[]).includes(role)) invalid(`${path}.residentEscort.${role}`);
      nonNegativeInteger(count, `${path}.residentEscort.${role}`);
    }
  }
  if (exp.homelandLabor !== undefined) nonNegativeInteger(exp.homelandLabor, `${path}.homelandLabor`);
  if (exp.courtshipFor !== undefined) string(exp.courtshipFor, `${path}.courtshipFor`);
  if (exp.raidGoal !== undefined) enumValue(exp.raidGoal, RAID_ATTACK_GOALS, `${path}.raidGoal`);
  if (exp.raidManeuver !== undefined) enumValue(exp.raidManeuver, RAID_MANEUVERS, `${path}.raidManeuver`);
  if (exp.raidRally !== undefined) boolean(exp.raidRally, `${path}.raidRally`);
  if (exp.raidAlly !== undefined) enumValue(exp.raidAlly, FACTION_IDS, `${path}.raidAlly`);
  if (exp.diplomacyMission !== undefined) {
    const mission = record(exp.diplomacyMission, `${path}.diplomacyMission`);
    const type = enumValue(mission.type, DIPLOMACY_MISSION_TYPES, `${path}.diplomacyMission.type`);
    if (type === 'tribute') {
      enumValue(mission.mode, DIPLOMACY_TRIBUTE_MODES, `${path}.diplomacyMission.mode`);
    } else if (mission.mode !== undefined) {
      enumValue(mission.mode, DIPLOMACY_TRIBUTE_MODES, `${path}.diplomacyMission.mode`);
    }
  }
  if (exp.surveyResult !== undefined) validateSurvey(exp.surveyResult, `${path}.surveyResult`, maxCell);
  return { id, heroIds: party };
}

/** Validate a migrated current-version save before it enters the store. */
export function validateGameState(value: unknown): GameState {
  const state = record(value, 'save');
  if (integer(state.saveVersion, 'save.saveVersion') !== TUNING.save.version) {
    invalid('save.saveVersion', 'is not current');
  }
  integer(state.seed, 'save.seed');
  integer(state.rngState, 'save.rngState');
  if (integer(state.turn, 'save.turn') < 1) invalid('save.turn', 'must be positive');
  enumValue(state.phase, PHASES, 'save.phase');

  const heroList = array(state.heroes, 'save.heroes');
  const heroIdList = heroList.map((hero, index) => validateHero(hero, `save.heroes[${index}]`));
  unique(heroIdList, 'save.heroes');
  const heroIds = new Set(heroIdList);

  const activePartyIds = stringArray(state.activePartyIds, 'save.activePartyIds');
  unique(activePartyIds, 'save.activePartyIds');
  for (const id of activePartyIds) if (!heroIds.has(id)) invalid('save.activePartyIds', 'references an unknown hero');
  validateStringRecord(state.assignments, ACTIVITY_IDS, 'save.assignments');
  for (const id of Object.keys(record(state.assignments, 'save.assignments'))) {
    if (!heroIds.has(id)) invalid(`save.assignments.${id}`, 'references an unknown hero');
  }

  nonNegativeInteger(state.silver, 'save.silver');
  validateGoodCounts(state.goods, 'save.goods', false);
  validateMarket(state.market, 'save.market');

  const locations = record(state.locations, 'save.locations');
  for (const [id, locationValue] of Object.entries(locations)) {
    const location = record(locationValue, `save.locations.${id}`);
    enumValue(location.discovery, DISCOVERY_STATES, `save.locations.${id}.discovery`);
    if (location.market !== undefined) validateMarket(location.market, `save.locations.${id}.market`);
  }
  const locationIds = new Set(Object.keys(locations));

  const maxCell = TUNING.map.fogGrid.width * TUNING.map.fogGrid.height;
  const knowledge = record(state.mapKnowledge, 'save.mapKnowledge');
  validateCells(knowledge.surveyedCells, 'save.mapKnowledge.surveyedCells', maxCell);

  const expeditionList = array(state.expeditions, 'save.expeditions');
  const expeditionInfo = expeditionList.map((expedition, index) =>
    validateExpedition(expedition, `save.expeditions[${index}]`, heroIds, maxCell),
  );
  unique(expeditionInfo.map(({ id }) => id), 'save.expeditions');
  const allAway = expeditionInfo.flatMap(({ heroIds: party }) => party);
  unique(allAway, 'save.expeditions.heroIds');
  nonNegativeInteger(state.nextExpeditionId, 'save.nextExpeditionId');

  const factions = record(state.factions, 'save.factions');
  for (const faction of FACTION_IDS) {
    const entry = record(factions[faction], `save.factions.${faction}`);
    finite(entry.standing, `save.factions.${faction}.standing`);
  }

  const diplomacySeats = record(state.diplomacySeats, 'save.diplomacySeats');
  for (const [seatId, seatValue] of Object.entries(diplomacySeats)) {
    const seat = record(seatValue, `save.diplomacySeats.${seatId}`);
    enumValue(seat.faction, FACTION_IDS, `save.diplomacySeats.${seatId}.faction`);
    finite(seat.standing, `save.diplomacySeats.${seatId}.standing`);
    nonNegativeInteger(seat.grievances, `save.diplomacySeats.${seatId}.grievances`);
    enumValue(seat.pact, DIPLOMACY_PACTS, `save.diplomacySeats.${seatId}.pact`);
    nonNegativeInteger(seat.lastContactTurn, `save.diplomacySeats.${seatId}.lastContactTurn`);
  }

  const dependantIds = array(state.dependants, 'save.dependants').map((dep, index) =>
    validateDependant(dep, `save.dependants[${index}]`),
  );
  unique(dependantIds, 'save.dependants');
  nonNegativeInteger(state.nextDependantId, 'save.nextDependantId');
  nonNegativeInteger(state.nextCharacterId, 'save.nextCharacterId');

  const residents = record(state.residents, 'save.residents');
  validateNumericRecord(residents.roles, RESIDENT_ROLES, 'save.residents.roles', true);
  nonNegativeInteger(residents.idle, 'save.residents.idle');
  finite(residents.contentment, 'save.residents.contentment');
  validateIntegerRecord(residents.tags, 'save.residents.tags', true);
  validateNumericRecord(residents.heritage, ['homeland', 'native'], 'save.residents.heritage', true);

  const transientIds = array(state.transients, 'save.transients').map((entry, index) => {
    const transient = record(entry, `save.transients[${index}]`);
    const id = string(transient.id, `save.transients[${index}].id`);
    enumValue(transient.kind, TRANSIENT_KINDS, `save.transients[${index}].kind`);
    nonNegativeInteger(transient.count, `save.transients[${index}].count`);
    integer(transient.turnsLeft, `save.transients[${index}].turnsLeft`);
    return id;
  });
  unique(transientIds, 'save.transients');
  nonNegativeInteger(state.nextTransientId, 'save.nextTransientId');

  validateNumericRecord(state.axes, AXIS_IDS, 'save.axes');
  const tier = integer(state.postTier, 'save.postTier');
  if (tier < 1 || tier > 4) invalid('save.postTier', 'must be between 1 and 4');
  unique(stringArray(state.buildings, 'save.buildings'), 'save.buildings');
  if (state.construction !== null) {
    const construction = record(state.construction, 'save.construction');
    string(construction.building, 'save.construction.building');
    nonNegativeInteger(construction.progress, 'save.construction.progress');
  }

  validateBooleanRecord(state.flags, 'save.flags');
  unique(stringArray(state.firedEvents, 'save.firedEvents'), 'save.firedEvents');
  validateIntegerRecord(state.cooldowns, 'save.cooldowns', true);
  array(state.queuedEvents, 'save.queuedEvents').forEach((entry, index) => {
    const queued = record(entry, `save.queuedEvents[${index}]`);
    string(queued.eventId, `save.queuedEvents[${index}].eventId`);
    nonNegativeInteger(queued.fireOnTurn, `save.queuedEvents[${index}].fireOnTurn`);
    if (queued.heroId !== undefined && !heroIds.has(string(queued.heroId, `save.queuedEvents[${index}].heroId`))) {
      invalid(`save.queuedEvents[${index}].heroId`, 'references an unknown hero');
    }
    if (
      queued.locationId !== undefined &&
      !locationIds.has(string(queued.locationId, `save.queuedEvents[${index}].locationId`))
    ) {
      invalid(`save.queuedEvents[${index}].locationId`, 'references an unknown location');
    }
    if (queued.vars !== undefined) validateChainVars(queued.vars, `save.queuedEvents[${index}].vars`);
  });
  array(state.pendingEvents, 'save.pendingEvents').forEach((entry, index) => {
    const pending = record(entry, `save.pendingEvents[${index}]`);
    string(pending.eventId, `save.pendingEvents[${index}].eventId`);
    const heroId = string(pending.heroId, `save.pendingEvents[${index}].heroId`);
    if (!heroIds.has(heroId)) invalid(`save.pendingEvents[${index}].heroId`, 'references an unknown hero');
    if (pending.expeditionId !== undefined) string(pending.expeditionId, `save.pendingEvents[${index}].expeditionId`);
    if (
      pending.locationId !== undefined &&
      !locationIds.has(string(pending.locationId, `save.pendingEvents[${index}].locationId`))
    ) {
      invalid(`save.pendingEvents[${index}].locationId`, 'references an unknown location');
    }
    if (pending.vars !== undefined) validateChainVars(pending.vars, `save.pendingEvents[${index}].vars`);
  });

  nonNegativeInteger(state.bankruptcyClock, 'save.bankruptcyClock');
  nonNegativeInteger(state.charterMissedStreak, 'save.charterMissedStreak');
  nonNegativeInteger(state.charterCompromisedStreak, 'save.charterCompromisedStreak');
  nonNegativeInteger(state.lastRaidTurn, 'save.lastRaidTurn');
  nonNegativeInteger(state.lastSackedTurn, 'save.lastSackedTurn');
  const tributes = array(state.tributes, 'save.tributes');
  const tributeFactions = tributes.map((entry, index) => {
    const tribute = record(entry, `save.tributes[${index}]`);
    enumValue(tribute.faction, FACTION_IDS, `save.tributes[${index}].faction`);
    enumValue(tribute.direction, TRIBUTE_DIRECTIONS, `save.tributes[${index}].direction`);
    nonNegativeInteger(tribute.silver, `save.tributes[${index}].silver`);
    validateGoodCounts(tribute.goods, `save.tributes[${index}].goods`, true);
    return tribute.faction as string;
  });
  unique(tributeFactions, 'save.tributes');
  if (state.pendingRaid !== null) {
    const raid = record(state.pendingRaid, 'save.pendingRaid');
    const kind = enumValue(raid.kind, ['incoming', 'outgoing'], 'save.pendingRaid.kind');
    enumValue(raid.faction, FACTION_IDS, 'save.pendingRaid.faction');
    boolean(raid.spotted, 'save.pendingRaid.spotted');
    if (kind === 'incoming') {
      enumValue(raid.severity, RAID_SEVERITIES, 'save.pendingRaid.severity');
      enumValue(raid.attackerManeuver, RAID_MANEUVERS, 'save.pendingRaid.attackerManeuver');
      nonNegativeInteger(raid.attackerForce, 'save.pendingRaid.attackerForce');
      string(raid.band, 'save.pendingRaid.band');
    } else {
      string(raid.expeditionId, 'save.pendingRaid.expeditionId');
      string(raid.targetName, 'save.pendingRaid.targetName');
      nonNegativeInteger(raid.defenderForce, 'save.pendingRaid.defenderForce');
      enumValue(raid.defenderManeuver, RAID_MANEUVERS, 'save.pendingRaid.defenderManeuver');
      enumValue(raid.goal, RAID_ATTACK_GOALS, 'save.pendingRaid.goal');
      enumValue(raid.maneuver, RAID_MANEUVERS, 'save.pendingRaid.maneuver');
      boolean(raid.rally, 'save.pendingRaid.rally');
      if (raid.ally !== undefined) {
        enumValue(raid.ally, FACTION_IDS, 'save.pendingRaid.ally');
      }
    }
  }
  const report = record(state.report, 'save.report');
  nonNegativeInteger(report.turn, 'save.report.turn');
  array(report.lines, 'save.report.lines').forEach((entry, index) => {
    const line = record(entry, `save.report.lines[${index}]`);
    if (typeof line.icon !== 'string') invalid(`save.report.lines[${index}].icon`, 'must be a string');
    if (typeof line.text !== 'string') invalid(`save.report.lines[${index}].text`, 'must be a string');
  });
  integer(report.silverDelta, 'save.report.silverDelta');
  const goodsDelta = record(report.goodsDelta, 'save.report.goodsDelta');
  for (const [good, delta] of Object.entries(goodsDelta)) {
    if (!(GOOD_IDS as readonly string[]).includes(good)) invalid(`save.report.goodsDelta.${good}`);
    integer(delta, `save.report.goodsDelta.${good}`);
  }
  if (state.gameOver !== null) {
    const gameOver = record(state.gameOver, 'save.gameOver');
    enumValue(gameOver.kind, GAME_OVER_KINDS, 'save.gameOver.kind');
    string(gameOver.title, 'save.gameOver.title');
    string(gameOver.text, 'save.gameOver.text');
  }

  const validated = state as unknown as GameState;
  const heritageTotal = validated.residents.heritage.homeland + validated.residents.heritage.native;
  if (heritageTotal !== residentTotal(validated)) invalid('save.residents.heritage', 'does not match resident total');
  return validated;
}
