// Expeditions (spec §7, §10): caravans and exploration parties. A dispatch
// takes 1–2 heroes off the board; each turn the party moves, may catch a
// travel event, resolves its business at the destination, and walks home.

import { TUNING } from '../content/tuning';
import {
  bestGoverningStat,
  checkBreakdown,
  isSuccess,
  markSkill,
  resolveCheck,
  traitModifiers,
} from './checks';
import type { CheckModifier } from './checks';
import {
  applyDiplomacyShift,
  ensureDiplomacySeat,
  setDiplomacyPact,
} from './diplomacy';
import type { TravelContext } from './events/types';
import { priceAt } from './economy';
import type { GoodDef } from './economy';
import { canWed, formUnion, unionError } from './family';
import { canCallRaidAlly, createOutgoingRaid, raidTargetFaction } from './raids';
import {
  addResidents,
  addTransientGroup,
  loseResidentEscort,
  nudgeCulture,
  residentCap,
  residentsAvailable,
  residentTotal,
  transientEffect,
} from './residents';
import { Rng } from './rng';
import {
  discoveryAfterSurvey,
  filterCellsToUnlocked,
  journeyTurns,
  locationIdsInCells,
  locationIdsInDetectionRadius,
  mapCellIndex,
  mergeSurveyCells,
  paceCheckModifier,
  pointReachable,
  regionAt,
  routeUnlocked,
  surveyCells,
  tagsAt,
} from './map';
import {
  awayHeroIds,
  clamp,
  discoveryAtLeast,
  getHero,
  oppositeGender,
  RESIDENT_ROLES,
} from './types';
import type {
  DiplomacyMissionType,
  DiplomacyTributeMode,
  ExpeditionKind,
  ExpeditionPace,
  ExpeditionState,
  FactionId,
  GameState,
  Gender,
  GoodId,
  Heritage,
  Hero,
  LocationDef,
  LocationId,
  MapFeatureDef,
  MapPoint,
  MapRegionDef,
  RaidAttackGoal,
  RaidManeuver,
  ResidentRole,
  SkillId,
  TraitDef,
} from './types';

/** The slice of TurnContext expedition resolution needs. */
export interface ExpeditionContext {
  goodDefs: ReadonlyMap<GoodId, GoodDef>;
  traitDefs: ReadonlyMap<string, TraitDef>;
  goodNames: ReadonlyMap<GoodId, string>;
  locationDefs: ReadonlyMap<LocationId, LocationDef>;
  mapRegionDefs?: readonly MapRegionDef[];
  mapFeatureDefs?: readonly MapFeatureDef[];
  /** A dependant name for a people + gender, for a homeland courtship spouse. */
  dependantName: (heritage: Heritage, gender: Gender, seed: number) => string;
}

export interface DispatchParams {
  kind: ExpeditionKind;
  destination?: LocationId;
  target?: MapPoint;
  pace?: ExpeditionPace;
  heroIds: string[];
  cargo?: Partial<Record<GoodId, number>>;
  silver?: number;
  buyOrders?: Partial<Record<GoodId, number>>;
  /** Residents seconded to the party (porters add cargo, guards add escort). */
  residents?: Partial<Record<ResidentRole, number>>;
  /** For `labor` runs: homeland hands to fetch from Thornwatch (HERITAGE_SPEC.md §5.2). */
  laborCount?: number;
  /** For `courtship` runs: the graph-node id to wed (defaults to heroIds[0]). */
  courtshipFor?: string;
  /** For `raid` runs: how the party means to fight once it reaches the target. */
  raidGoal?: RaidAttackGoal;
  raidManeuver?: RaidManeuver;
  raidRally?: boolean;
  raidAlly?: FactionId;
  /** For `diplomacy` runs: the purpose of the envoy. */
  diplomacyMission?: { type: DiplomacyMissionType; mode?: DiplomacyTributeMode };
}

export function cargoUnits(cargo: Partial<Record<GoodId, number>>): number {
  return Object.values(cargo).reduce((sum: number, qty) => sum + (qty ?? 0), 0);
}

/** Homeland laborers currently in flight (reserve cap so runs can't overflow). */
export function inFlightHomelandLabor(state: GameState): number {
  return state.expeditions.reduce((sum, e) => sum + (e.homelandLabor ?? 0), 0);
}

/** Total silver a labor run of `count` hands costs up front. */
export function laborRunCost(count: number): number {
  return TUNING.heritage.homelandCostPerHead * count;
}

export function cargoCapacity(
  heroCount: number,
  escort?: Partial<Record<ResidentRole, number>>,
): number {
  const porters = escort?.porters ?? 0;
  return heroCount * TUNING.map.cargoCapacityPerHero + porters * TUNING.residents.effects.cargoPerPorter;
}

/** Check bonus a guard escort lends to a caravan/explore/envoy arrival check. */
function escortMods(exp: ExpeditionState): CheckModifier[] {
  const guards = exp.residentEscort?.guards ?? 0;
  if (guards <= 0) return [];
  return [{ label: `Escort of ${guards}`, value: TUNING.residents.effects.guardEscortBonus }];
}

/** Builds the generic event destination for authored and free-coordinate trips. */
export function travelContextFor(
  expedition: ExpeditionState,
  ctx: Pick<ExpeditionContext, 'locationDefs' | 'mapRegionDefs' | 'mapFeatureDefs'>,
): TravelContext | undefined {
  const def = expedition.destination ? ctx.locationDefs.get(expedition.destination) : undefined;
  const point = expedition.target ?? def?.mapPoint;
  if (!point) return undefined;
  const spatialTags = tagsAt(point, ctx.mapRegionDefs ?? [], ctx.mapFeatureDefs ?? []);
  return {
    expedition,
    destination: {
      point,
      ...(def ? { locationId: def.id } : {}),
      name: def?.name ?? regionAt(point, ctx.mapRegionDefs ?? [])?.name ?? 'the frontier',
      tags: [...new Set([...spatialTags, ...(def?.tags ?? [])])],
    },
    paceCheckModifier: paceCheckModifier(expedition.pace),
  };
}

function paceMods(exp: ExpeditionState): CheckModifier[] {
  const value = paceCheckModifier(exp.pace);
  return value === 0 ? [] : [{ label: `${exp.pace ?? 'normal'} pace`, value }];
}

function expeditionTarget(
  params: DispatchParams,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
): { def?: LocationDef; point?: MapPoint } {
  const def = params.destination ? locationDefs.get(params.destination) : undefined;
  return { def, point: def?.mapPoint ?? params.target };
}

/** Why this dispatch is invalid, or null when it may proceed. */
export function dispatchError(
  state: GameState,
  params: DispatchParams,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
  mapRegionDefs: readonly MapRegionDef[] = [],
): string | null {
  const { def, point } = expeditionTarget(params, locationDefs);
  if (params.destination && !def) return 'Unknown destination.';
  if (params.kind !== 'explore' && !def) return 'Choose a known destination.';
  if (!point) return 'Choose a point on the map.';
  const home = locationDefs.get(TUNING.map.homeLocationId);
  if (!home) return 'The post is missing from the map.';
  if (!pointReachable(state, point, mapRegionDefs)) return 'That country lies beyond your known routes.';
  const discovery = def ? state.locations[def.id]?.discovery ?? def.initialDiscovery : 'unknown';
  const knownRoute = def !== undefined && discoveryAtLeast(discovery, 'visited');
  if (!knownRoute && !routeUnlocked(state, home.mapPoint, point, mapRegionDefs)) {
    return 'No known way crosses the country between here and there.';
  }
  const targetCell = mapCellIndex(point);
  if (
    params.kind === 'explore' &&
    state.expeditions.some((exp) => exp.kind === 'explore' && exp.target && mapCellIndex(exp.target) === targetCell)
  ) {
    return 'Another party is already searching that country.';
  }

  const { heroIds } = params;
  if (heroIds.length < 1) return 'Someone has to go.';
  if (heroIds.length > TUNING.map.maxExpeditionHeroes) {
    return `At most ${TUNING.map.maxExpeditionHeroes} heroes per expedition.`;
  }
  if (new Set(heroIds).size !== heroIds.length) return 'Choose each hero only once.';
  const away = awayHeroIds(state);
  const activeParty = new Set(state.activePartyIds);
  for (const heroId of heroIds) {
    const hero = state.heroes.find((h) => h.id === heroId);
    if (!hero || hero.status !== 'active' || !activeParty.has(heroId)) {
      return 'That hero cannot travel.';
    }
    if (away.has(heroId)) return `${hero.name} is already away.`;
  }

  if (params.kind === 'explore') {
    if (def && def.id !== TUNING.map.homeLocationId && !discoveryAtLeast(discovery, 'rumored')) {
      return 'You have heard of no such place.';
    }
  } else if (params.kind === 'diplomacy') {
    if (!def) return 'Choose a known destination.';
    if (!def.faction) return 'There is no one there to treat with.';
    if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way there yet.';
    const mission = params.diplomacyMission?.type ?? 'talks';
    const giftValue = cargoUnits(params.cargo ?? {}) + (params.silver ?? 0);
    if ((mission === 'gift' || mission === 'peace') && giftValue <= 0) {
      return mission === 'gift'
        ? 'Bring silver or goods worth presenting.'
        : 'Peace talks need terms to offer.';
    }
    if (mission === 'tribute') {
      return 'Tribute negotiations are not ready yet.';
    }
  } else if (params.kind === 'labor') {
    if (!def) return 'Choose a known destination.';
    if (def.faction !== 'CHARTER_COMPANY') return 'Only the Company garrison hires out homeland hands.';
    if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to the garrison yet.';
    const count = params.laborCount ?? 0;
    if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
      return 'Send for at least one whole hand.';
    }
    if (state.silver < laborRunCost(count)) return "Not enough silver for the recruiters' fee.";
    if (residentTotal(state) + inFlightHomelandLabor(state) + count > residentCap(state)) {
      return 'No room to house them yet.';
    }
  } else if (params.kind === 'courtship') {
    if (!def) return 'Choose a known destination.';
    if (def.faction !== 'CHARTER_COMPANY') return 'Homeland matches are arranged only through the Company landing.';
    if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to the garrison yet.';
    const subjectId = params.courtshipFor ?? heroIds[0];
    const err = unionError(state, subjectId);
    if (err) return err;
    if (state.silver < TUNING.family.homelandBridePrice) return 'Not enough silver for the bride-price.';
  } else if (params.kind === 'raid') {
    if (!def) return 'Choose a known destination.';
    if (!discoveryAtLeast(discovery, 'rumored')) return 'You have no lead worth raiding yet.';
    const targetFaction = raidTargetFaction(def);
    if (!targetFaction) return 'There is no camp or rival there worth raiding.';
    if (params.silver && params.silver > 0) return 'A raid does not march out carrying silver.';
    if (cargoUnits(params.cargo ?? {}) > 0) return 'A raid leaves with empty packs and hopes to fill them later.';
    if (Object.values(params.buyOrders ?? {}).some((qty) => (qty ?? 0) > 0)) {
      return 'A raid cannot leave standing buy orders behind it.';
    }
    if (params.raidAlly && !canCallRaidAlly(state, params.raidAlly, targetFaction)) {
      return 'That ally will not ride on this raid.';
    }
  } else {
    if (!def) return 'Choose a known destination.';
    if (!def.hasMarket) return 'There is no market there.';
    if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to that market yet.';
  }

  const escort = params.residents ?? {};
  for (const role of Object.keys(escort)) {
    if (!(RESIDENT_ROLES as readonly string[]).includes(role)) return 'Invalid escort.';
  }
  for (const role of RESIDENT_ROLES) {
    const qty = escort[role] ?? 0;
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) return 'Invalid escort.';
    if (qty > residentsAvailable(state, role)) return `Not enough ${role} to spare.`;
  }

  const cargo = params.cargo ?? {};
  if (cargoUnits(cargo) > cargoCapacity(heroIds.length, escort)) {
    return 'The party cannot carry that much.';
  }
  for (const [good, qty] of Object.entries(cargo) as [GoodId, number][]) {
    if (!(good in state.goods)) return 'Unknown cargo.';
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) return 'Invalid cargo.';
    if ((state.goods[good] ?? 0) < qty) return 'Not enough stock for that cargo.';
  }
  for (const [good, qty] of Object.entries(params.buyOrders ?? {}) as [GoodId, number][]) {
    if (!(good in state.goods)) return 'Unknown buy order.';
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) return 'Invalid buy order.';
  }
  const silver = params.silver ?? 0;
  if (!Number.isFinite(silver) || silver < 0 || !Number.isInteger(silver)) return 'Invalid silver.';
  if (state.silver < silver) return 'Not enough silver on hand.';

  return null;
}

/** Applies a validated dispatch. Returns false (untouched state) if invalid. */
export function dispatchExpedition(
  state: GameState,
  params: DispatchParams,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
  mapRegionDefs: readonly MapRegionDef[] = [],
): boolean {
  if (dispatchError(state, params, locationDefs, mapRegionDefs) !== null) return false;
  const { def, point } = expeditionTarget(params, locationDefs);
  const home = locationDefs.get(TUNING.map.homeLocationId);
  if (!point || !home) return false;
  const pace = params.pace ?? 'normal';
  const legTurns = journeyTurns(home.mapPoint, point, pace);

  const cargo: Partial<Record<GoodId, number>> = {};
  for (const [good, qty] of Object.entries(params.cargo ?? {}) as [GoodId, number][]) {
    if (qty <= 0) continue;
    state.goods[good] -= qty;
    cargo[good] = qty;
  }
  const silver = params.silver ?? 0;
  state.silver -= silver;

  // A labor run pays the recruiters' fee up front and reserves its hands.
  let homelandLabor: number | undefined;
  if (params.kind === 'labor') {
    const count = params.laborCount ?? 0;
    state.silver -= laborRunCost(count);
    homelandLabor = count;
  }

  // A courtship run pays the bride-price up front and records who is to be wed.
  let courtshipFor: string | undefined;
  if (params.kind === 'courtship') {
    state.silver -= TUNING.family.homelandBridePrice;
    courtshipFor = params.courtshipFor ?? params.heroIds[0];
  }
  if (params.kind === 'raid' && params.raidAlly) {
    const ally = state.factions[params.raidAlly];
    ally.standing = clamp(ally.standing - TUNING.raid.allyStandingCost, -100, 100);
  }

  // Second residents onto the party: they leave the post pool until homecoming.
  const escort: Partial<Record<ResidentRole, number>> = {};
  for (const role of RESIDENT_ROLES) {
    const qty = params.residents?.[role] ?? 0;
    if (qty <= 0) continue;
    state.residents.roles[role] -= qty;
    escort[role] = qty;
  }

  state.expeditions.push({
    id: `exp_${state.nextExpeditionId}`,
    kind: params.kind,
    ...(def ? { destination: def.id } : {}),
    target: { ...point },
    pace,
    legTurns,
    heroIds: [...params.heroIds],
    leg: 'outbound',
    turnsLeft: legTurns,
    cargo,
    silver,
    buyOrders: { ...(params.buyOrders ?? {}) },
    residentEscort: escort,
    ...(homelandLabor !== undefined ? { homelandLabor } : {}),
    ...(courtshipFor !== undefined ? { courtshipFor } : {}),
    ...(params.kind === 'diplomacy'
      ? { diplomacyMission: { ...(params.diplomacyMission ?? { type: 'talks' as const }) } }
      : {}),
    ...(params.kind === 'raid'
      ? {
          raidGoal: params.raidGoal ?? 'plunder',
          raidManeuver: params.raidManeuver ?? 'skirmish',
          raidRally: params.raidRally ?? false,
          ...(params.raidAlly ? { raidAlly: params.raidAlly } : {}),
        }
      : {}),
  });
  state.nextExpeditionId += 1;
  return true;
}

// ------------------------------------------------------------------ per turn

/**
 * Moves every expedition one turn along: travel, arrival business, the walk
 * home, and the homecoming deposit. Called from `resolveTurn`.
 */
export function advanceExpeditions(
  state: GameState,
  ctx: ExpeditionContext,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const finished: string[] = [];

  for (const exp of state.expeditions) {
    const def = exp.destination ? ctx.locationDefs.get(exp.destination) : undefined;
    const home = ctx.locationDefs.get(TUNING.map.homeLocationId);
    const target = exp.target ?? def?.mapPoint;
    if (!home || !target || (!def && exp.kind !== 'explore')) {
      returnResidentEscort(state, exp);
      finished.push(exp.id);
      continue;
    }
    exp.target = target;
    exp.pace ??= 'normal';
    exp.legTurns ??= journeyTurns(home.mapPoint, target, exp.pace);
    const destinationName =
      def?.name ?? regionAt(target, ctx.mapRegionDefs ?? [])?.name ?? 'the frontier';

    // A party with no one left standing never comes home.
    exp.heroIds = exp.heroIds.filter((id) => {
      const hero = state.heroes.find((h) => h.id === id);
      return hero !== undefined && hero.status === 'active';
    });
    if (exp.heroIds.length === 0) {
      report('🕯️', `No one returns from ${destinationName}. The cargo is lost with them.`);
      loseResidentEscort(state, exp.residentEscort);
      finished.push(exp.id);
      continue;
    }

    exp.turnsLeft -= 1;
    const names = partyNames(state, exp);

    if (exp.turnsLeft > 0) {
      report(
        '🧭',
        exp.leg === 'outbound'
          ? `${names}: ${exp.turnsLeft} turn${exp.turnsLeft === 1 ? '' : 's'} from ${destinationName}.`
          : `${names}: ${exp.turnsLeft} turn${exp.turnsLeft === 1 ? '' : 's'} from home.`,
      );
      continue;
    }

    if (exp.leg === 'outbound') {
      if (exp.kind === 'caravan' && def) resolveCaravanArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'explore') resolveExploreArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'diplomacy' && def) resolveDiplomacyArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'labor' && def) resolveLaborArrival(state, exp, def, report);
      else if (exp.kind === 'raid' && def) {
        if (queueRaidArrival(state, exp, def, rng, report)) continue;
        exp.leg = 'returning';
        exp.turnsLeft = Math.max(1, exp.legTurns);
        continue;
      } else if (def) resolveCourtshipArrival(state, exp, def, report);
      exp.leg = 'returning';
      exp.turnsLeft = Math.max(1, exp.legTurns);
    } else {
      resolveHomecoming(state, ctx, exp, def, report);
      finished.push(exp.id);
    }
  }

  state.expeditions = state.expeditions.filter((e) => !finished.includes(e.id));
}

function queueRaidArrival(
  state: GameState,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): boolean {
  const raid = createOutgoingRaid(state, exp, def, rng);
  if (!raid) {
    report('⚔️', `${partyNames(state, exp)} reach ${def.name}, but the chance to strike slips away.`);
    return false;
  }
  state.pendingRaid = raid;
  report('⚔️', `${partyNames(state, exp)} reach ${def.name} and wait on your word.`);
  return true;
}

function partyNames(state: GameState, exp: ExpeditionState): string {
  return exp.heroIds.map((id) => getHero(state, id).name).join(' & ');
}

/** The expedition hero best suited to lead a check of this skill. */
function leadHero(state: GameState, exp: ExpeditionState, skill: SkillId): Hero {
  const heroes = exp.heroIds.map((id) => getHero(state, id));
  return heroes.reduce((a, b) => (b.skills[skill] > a.skills[skill] ? b : a));
}

function resolveCaravanArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const map = TUNING.map;
  const hero = leadHero(state, exp, 'bargain');
  const tags = ['trade', ...def.tags, ...(def.faction ? [def.faction] : [])];
  const mods = [
    ...traitModifiers(hero, ctx.traitDefs, 'bargain', tags),
    ...escortMods(exp),
    ...paceMods(exp),
  ];
  const stat = bestGoverningStat(hero, 'bargain');
  const check = resolveCheck(rng, hero, 'bargain', stat, map.caravanCheckDifficulty, mods);
  if (isSuccess(check.tier)) markSkill(hero, 'bargain');

  const mult = clamp(
    1 + check.margin * map.caravanMarginRate,
    map.caravanPriceMultMin,
    map.caravanPriceMultMax,
  );

  // Sell everything carried at local prices, swung by the bargaining.
  let sale = 0;
  for (const [good, qty] of Object.entries(exp.cargo) as [GoodId, number][]) {
    const goodDef = ctx.goodDefs.get(good);
    if (!goodDef || !qty) continue;
    sale += Math.round(priceAt(state, goodDef, def) * mult) * qty;
  }
  exp.cargo = {};
  exp.silver += sale;

  // Fill buy orders with what silver and backs can carry.
  let spent = 0;
  const bought: string[] = [];
  // A supplier crew passing through lends extra backs to haul the load home.
  let capacityLeft =
    cargoCapacity(exp.heroIds.length, exp.residentEscort) + transientEffect(state, 'cargoBonus');
  for (const [good, qty] of Object.entries(exp.buyOrders) as [GoodId, number][]) {
    const goodDef = ctx.goodDefs.get(good);
    if (!goodDef || !qty) continue;
    const unitCost = Math.max(1, Math.round(priceAt(state, goodDef, def) / mult));
    const affordable = Math.min(qty, Math.floor(exp.silver / unitCost), capacityLeft);
    if (affordable <= 0) continue;
    exp.silver -= affordable * unitCost;
    spent += affordable * unitCost;
    capacityLeft -= affordable;
    exp.cargo[good] = (exp.cargo[good] ?? 0) + affordable;
    bought.push(`${affordable} ${ctx.goodNames.get(good) ?? good}`);
  }
  exp.buyOrders = {};

  if (def.faction && isSuccess(check.tier)) {
    const faction = state.factions[def.faction];
    faction.standing = clamp(faction.standing + TUNING.map.caravanStandingGain, -100, 100);
  }

  const deals: string[] = [];
  if (sale > 0) deals.push(`sold for ${sale} silver`);
  if (bought.length > 0) deals.push(`bought ${bought.join(', ')} (${spent} silver)`);
  report(
    '🐴',
    `${hero.name} bargains at ${def.name}: ${checkBreakdown(check)}. ` +
      (deals.length > 0 ? `The caravan ${deals.join(' and ')}.` : 'Nothing changes hands.'),
  );
}

function resolveExploreArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef | undefined,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const target = exp.target;
  const home = ctx.locationDefs.get(TUNING.map.homeLocationId);
  if (!target || !home) return;
  const hero = leadHero(state, exp, 'survival');
  const spatialTags = tagsAt(target, ctx.mapRegionDefs ?? [], ctx.mapFeatureDefs ?? []);
  const tags = ['exploration', ...spatialTags, ...(def?.tags ?? [])];
  const mods = [
    ...traitModifiers(hero, ctx.traitDefs, 'survival', tags),
    ...escortMods(exp),
    ...paceMods(exp),
  ];
  const stat = bestGoverningStat(hero, 'survival');
  const check = resolveCheck(rng, hero, 'survival', stat, TUNING.map.exploreCheckDifficulty, mods);

  if (isSuccess(check.tier)) markSkill(hero, 'survival');
  else {
    const stressGain =
      check.tier === 'critFailure'
        ? TUNING.map.exploreCritFailureStress
        : TUNING.map.exploreFailureStress;
    for (const id of exp.heroIds) {
      const h = getHero(state, id);
      h.stress = clamp(h.stress + stressGain, 0, TUNING.condition.maxStress);
      if (check.tier === 'critFailure') {
        h.health = clamp(
          h.health - TUNING.map.exploreCritFailureHealthLoss,
          0,
          TUNING.condition.maxHealth,
        );
      }
    }
  }

  const pace = exp.pace ?? 'normal';
  const rawCells = surveyCells(home.mapPoint, target, pace, check.tier);
  const cells = filterCellsToUnlocked(state, rawCells, ctx.mapRegionDefs ?? []);
  const locations = [...ctx.locationDefs.values()];
  const visible = new Set(locationIdsInCells(locations, cells));
  const detected = new Set(
    isSuccess(check.tier)
      ? locationIdsInDetectionRadius(locations, target, pace, check.tier)
      : [],
  );
  const discoveredLocationIds: LocationId[] = [];
  const knownLocationIds: LocationId[] = [];
  for (const locationId of new Set([...visible, ...detected])) {
    const location = state.locations[locationId];
    const locationDef = ctx.locationDefs.get(locationId);
    if (!location || !locationDef) continue;
    if (!pointReachable(state, locationDef.mapPoint, ctx.mapRegionDefs ?? [])) continue;
    const canDetect = visible.has(locationId) || isSuccess(check.tier);
    if (!canDetect) continue;
    const next = discoveryAfterSurvey(location.discovery, check.tier, exp.destination === locationId);
    if (next === 'known' && location.discovery !== 'known') knownLocationIds.push(locationId);
    else if (next === 'visited' && !discoveryAtLeast(location.discovery, 'visited')) {
      discoveredLocationIds.push(locationId);
    }
  }
  exp.surveyResult = {
    tier: check.tier,
    surveyedCells: cells,
    discoveredLocationIds,
    knownLocationIds,
  };

  const destinationName =
    def?.name ?? regionAt(target, ctx.mapRegionDefs ?? [])?.name ?? 'the frontier';
  report(
    '🗺️',
    `${hero.name} surveys ${destinationName}: ${checkBreakdown(check)}. The party turns for home.`,
  );
}

function resolveDiplomacyArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  return resolveDiplomacyMissionArrival(state, ctx, exp, def, rng, report);
  const dip = TUNING.diplomacy;
  const hero = leadHero(state, exp, 'diplomacy');
  const legacyFactionTags: string[] = [];
  if (def.faction) legacyFactionTags.push(def.faction as FactionId);
  const tags = ['diplomacy', ...def.tags, ...legacyFactionTags];
  const mods = [
    ...traitModifiers(hero, ctx.traitDefs, 'diplomacy', tags),
    ...escortMods(exp),
    ...paceMods(exp),
  ];
  const stat = bestGoverningStat(hero, 'diplomacy');
  const check = resolveCheck(rng, hero, 'diplomacy', stat, dip.expeditionCheckDifficulty, mods);
  if (isSuccess(check.tier)) markSkill(hero, 'diplomacy');

  let delta = 0;
  if (check.tier === 'critSuccess') delta = dip.expeditionStandingGainCrit;
  else if (check.tier === 'success') delta = dip.expeditionStandingGainSuccess;
  else if (check.tier === 'failure') delta = -dip.expeditionStandingLossFailure;
  else delta = -dip.expeditionStandingLossCritFailure;

  const legacyFactionId = def.faction;
  if (legacyFactionId) {
    const faction = state.factions[legacyFactionId as FactionId];
    faction.standing = clamp(faction.standing + delta, -100, 100);
  }

  let escortLine = '';
  if (isSuccess(check.tier)) {
    // A pleased faction sends an honour-guard back with the envoy for a time.
    const tr = TUNING.residents.transients;
    addTransientGroup(state, 'visitorGuards', tr.visitorGuardCount, tr.visitorGuardTurns);
    escortLine = ` A ${def.name} honour-guard rides back with the party.`;
  } else {
    const stressGain =
      check.tier === 'critFailure' ? dip.expeditionCritFailureStress : dip.expeditionFailureStress;
    for (const id of exp.heroIds) {
      const h = getHero(state, id);
      h.stress = clamp(h.stress + stressGain, 0, TUNING.condition.maxStress);
    }
  }

  report(
    '🤝',
    `${hero.name} treats with ${def.name}: ${checkBreakdown(check)}. ` +
      `Standing ${delta >= 0 ? '+' : ''}${delta}.${escortLine}`,
  );
}

/** A labor run reaches Thornwatch: the Company notes your investment in homeland
 *  hands (HERITAGE_SPEC.md §5.2). The hands themselves are added on homecoming. */
function resolveDiplomacyMissionArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const dip = TUNING.diplomacy;
  const mission = exp.diplomacyMission?.type ?? 'talks';
  const seat = ensureDiplomacySeat(state, def);
  const hero = leadHero(state, exp, 'diplomacy');
  const factionTags: string[] = def.faction ? [def.faction] : [];
  const tags = ['diplomacy', ...def.tags, ...factionTags];
  const relationshipMods: CheckModifier[] = [];
  const standingMod = Math.trunc(seat.standing / 20);
  if (standingMod !== 0) relationshipMods.push({ label: 'standing', value: standingMod });
  if (def.faction) {
    const factionMod = Math.trunc(state.factions[def.faction].standing / 25);
    if (factionMod !== 0) relationshipMods.push({ label: 'faction mood', value: factionMod });
  }
  if (mission === 'alliance' && seat.standing < dip.allianceStandingThreshold) {
    relationshipMods.push({
      label: 'not yet trusted',
      value: -Math.max(1, Math.ceil((dip.allianceStandingThreshold - seat.standing) / 15)),
    });
  }
  if (mission === 'peace' && seat.grievances > 0) {
    relationshipMods.push({ label: 'old grievances', value: -Math.ceil(seat.grievances / 2) });
  }
  const mods = [
    ...traitModifiers(hero, ctx.traitDefs, 'diplomacy', tags),
    ...relationshipMods,
    ...escortMods(exp),
    ...paceMods(exp),
  ];
  const stat = bestGoverningStat(hero, 'diplomacy');
  const check = resolveCheck(rng, hero, 'diplomacy', stat, dip.expeditionCheckDifficulty, mods);
  if (isSuccess(check.tier)) markSkill(hero, 'diplomacy');

  let giftValue = exp.silver;
  for (const [good, qty] of Object.entries(exp.cargo) as [GoodId, number][]) {
    const goodDef = ctx.goodDefs.get(good);
    if (!goodDef || qty <= 0) continue;
    giftValue += goodDef.basePrice * qty;
  }
  const giftSteps = Math.floor(giftValue / dip.giftValuePerStep);

  let delta = 0;
  let grievanceDelta = 0;
  let missionLine = '';
  let pactLine = '';
  switch (mission) {
    case 'gift':
      if (check.tier === 'critSuccess') delta = dip.expeditionStandingGainCrit + giftSteps;
      else if (check.tier === 'success') delta = dip.expeditionStandingGainSuccess + Math.max(1, giftSteps);
      else if (check.tier === 'failure') delta = Math.max(1, giftSteps);
      else delta = Math.max(0, giftSteps - 1);
      exp.cargo = {};
      exp.silver = 0;
      missionLine =
        giftValue > 0 ? ` Gifts worth about ${giftValue} silver change hands.` : ' Gifts are presented.';
      break;
    case 'alliance':
      if (check.tier === 'critSuccess') {
        delta = dip.expeditionStandingGainSuccess + 2;
        setDiplomacyPact(state, def, 'alliance');
        pactLine = ` ${def.name} agrees to an alliance.`;
      } else if (check.tier === 'success') {
        delta = dip.expeditionStandingGainSuccess;
        setDiplomacyPact(state, def, 'alliance');
        pactLine = ` ${def.name} agrees to an alliance.`;
      } else if (check.tier === 'failure') {
        delta = -dip.expeditionStandingLossFailure;
        grievanceDelta = dip.grievanceOnFailure;
      } else {
        delta = -dip.expeditionStandingLossCritFailure;
        grievanceDelta = dip.grievanceOnCritFailure;
      }
      break;
    case 'peace':
      if (check.tier === 'critSuccess') {
        delta = dip.expeditionStandingGainSuccess;
        grievanceDelta = -dip.peaceGrievanceReliefCrit;
        setDiplomacyPact(state, def, 'truce');
        pactLine = ` A truce is sworn with ${def.name}.`;
      } else if (check.tier === 'success') {
        delta = dip.expeditionStandingGainSuccess - 1;
        grievanceDelta = -dip.peaceGrievanceReliefSuccess;
        setDiplomacyPact(state, def, 'truce');
        pactLine = ` A truce is sworn with ${def.name}.`;
      } else if (check.tier === 'failure') {
        delta = -dip.expeditionStandingLossFailure;
        grievanceDelta = dip.grievanceOnFailure;
      } else {
        delta = -dip.expeditionStandingLossCritFailure;
        grievanceDelta = dip.grievanceOnCritFailure;
      }
      exp.cargo = {};
      exp.silver = 0;
      missionLine = giftValue > 0 ? ` Terms worth about ${giftValue} silver are offered.` : '';
      break;
    default:
      if (check.tier === 'critSuccess') delta = dip.expeditionStandingGainCrit;
      else if (check.tier === 'success') delta = dip.expeditionStandingGainSuccess;
      else if (check.tier === 'failure') delta = -dip.expeditionStandingLossFailure;
      else delta = -dip.expeditionStandingLossCritFailure;
      break;
  }

  applyDiplomacyShift(state, ctx.locationDefs, def.id, delta, grievanceDelta);

  let escortLine = '';
  if (isSuccess(check.tier)) {
    if (mission === 'talks' || mission === 'alliance') {
      const tr = TUNING.residents.transients;
      addTransientGroup(state, 'visitorGuards', tr.visitorGuardCount, tr.visitorGuardTurns);
      escortLine = ` A ${def.name} honour-guard rides back with the party.`;
    }
  } else {
    const stressGain =
      check.tier === 'critFailure' ? dip.expeditionCritFailureStress : dip.expeditionFailureStress;
    for (const id of exp.heroIds) {
      const h = getHero(state, id);
      h.stress = clamp(h.stress + stressGain, 0, TUNING.condition.maxStress);
    }
  }

  const verb =
    mission === 'gift'
      ? 'bears gifts to'
      : mission === 'alliance'
        ? 'seeks alliance with'
        : mission === 'peace'
          ? 'seeks peace with'
          : 'treats with';
  report(
    'ðŸ¤',
    `${hero.name} ${verb} ${def.name}: ${checkBreakdown(check)}. ` +
      `Standing ${delta >= 0 ? '+' : ''}${delta}.${missionLine}${pactLine}${escortLine}`,
  );
}

function resolveLaborArrival(
  state: GameState,
  exp: ExpeditionState,
  def: LocationDef,
  report: (icon: string, text: string) => void,
): void {
  const count = exp.homelandLabor ?? 0;
  const factionId = def.faction;
  if (factionId) {
    const faction = state.factions[factionId];
    faction.standing = clamp(faction.standing + TUNING.heritage.homelandArrivalStanding, -100, 100);
  }
  report(
    '📜',
    `${partyNames(state, exp)} sign on ${count} homeland hand${count === 1 ? '' : 's'} at ${def.name}.`,
  );
}

/** A courtship run reaches Thornwatch: the Company approves of its people marrying
 *  its people (FAMILY_SPEC.md §5.1). The match itself is sealed on homecoming. */
function resolveCourtshipArrival(
  state: GameState,
  exp: ExpeditionState,
  def: LocationDef,
  report: (icon: string, text: string) => void,
): void {
  if (def.faction) {
    const faction = state.factions[def.faction];
    faction.standing = clamp(faction.standing + TUNING.family.homelandMatchStanding, -100, 100);
  }
  report(
    '💍',
    `${partyNames(state, exp)} arrange a homeland match at ${def.name}, and start for home.`,
  );
}

function resolveHomecoming(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef | undefined,
  report: (icon: string, text: string) => void,
): void {
  state.silver += exp.silver;
  let surveyLine = '';
  if (exp.surveyResult) {
    state.mapKnowledge ??= { surveyedCells: [] };
    const before = state.mapKnowledge.surveyedCells.length;
    state.mapKnowledge.surveyedCells = mergeSurveyCells(
      state.mapKnowledge.surveyedCells,
      exp.surveyResult.surveyedCells,
    );
    const learned: string[] = [];
    for (const locationId of exp.surveyResult.discoveredLocationIds) {
      const location = state.locations[locationId];
      if (!location) continue;
      if (!discoveryAtLeast(location.discovery, 'visited')) {
        location.discovery = 'visited';
        learned.push(ctx.locationDefs.get(locationId)?.name ?? locationId);
      }
    }
    for (const locationId of exp.surveyResult.knownLocationIds) {
      const location = state.locations[locationId];
      if (!location) continue;
      if (location.discovery !== 'known') {
        location.discovery = 'known';
        learned.push(ctx.locationDefs.get(locationId)?.name ?? locationId);
      }
    }
    const mapped = state.mapKnowledge.surveyedCells.length - before;
    surveyLine = mapped > 0 ? ` They chart ${mapped} new map sections.` : ' They add detail to familiar country.';
    if (learned.length > 0) surveyLine += ` They fix ${learned.join(', ')} on the map.`;
    const exploredName =
      def?.name ??
      (exp.target ? regionAt(exp.target, ctx.mapRegionDefs ?? [])?.name : undefined) ??
      'the frontier';
    for (const id of exp.heroIds) {
      getHero(state, id).history.push(`Explored ${exploredName} (turn ${state.turn}).`);
    }
  }
  const goodsBrought: string[] = [];
  for (const [good, qty] of Object.entries(exp.cargo) as [GoodId, number][]) {
    if (!qty) continue;
    state.goods[good] = (state.goods[good] ?? 0) + qty;
    goodsBrought.push(`${qty} ${ctx.goodNames.get(good) ?? good}`);
  }

  // Seconded residents rejoin the post pool.
  returnResidentEscort(state, exp);

  // Homeland hands fetched from Thornwatch settle in (HERITAGE_SPEC.md §5.2).
  let laborLine = '';
  if (exp.homelandLabor && exp.homelandLabor > 0) {
    const wanted = exp.homelandLabor;
    const settled = addResidents(state, 'idle', wanted, 'settlers', 'homeland');
    if (settled > 0) nudgeCulture(state, -TUNING.heritage.hireAxisNudge * settled);
    const overflow = wanted - settled;
    if (overflow > 0) {
      const refund = laborRunCost(overflow);
      state.silver += refund;
      laborLine = ` ${settled} homeland hand${settled === 1 ? '' : 's'} settle in; ${overflow} turned away for want of room (${refund} silver refunded).`;
    } else {
      laborLine = ` ${settled} homeland hand${settled === 1 ? '' : 's'} settle in.`;
    }
  }

  // A courtship run brings a certified homeland spouse home to wed (FAMILY_SPEC.md §5.1).
  let matchLine = '';
  if (exp.kind === 'courtship' && exp.courtshipFor) {
    const subject = state.heroes.find((h) => h.id === exp.courtshipFor);
    if (subject && canWed(state, subject.id)) {
      const spouseGender: Gender = oppositeGender(subject.gender);
      const heritage: Heritage = 'imanian';
      const spouse = formUnion(state, subject.id, {
        source: 'homeland',
        heritage,
        name: ctx.dependantName(heritage, spouseGender, state.nextDependantId),
      });
      if (spouse) {
        subject.history.push(`Wed ${spouse.name}, brought upriver from Thornwatch (turn ${state.turn}).`);
        matchLine = ` ${subject.name} weds ${spouse.name}, newly come upriver.`;
      }
    } else {
      matchLine = ' But the match came to nothing.';
    }
  }

  const haul: string[] = [];
  if (exp.silver > 0) haul.push(`${exp.silver} silver`);
  if (goodsBrought.length > 0) haul.push(goodsBrought.join(', '));
  const tail =
    haul.length > 0
      ? ` with ${haul.join(' and ')}.`
      : exp.kind === 'diplomacy' || exp.kind === 'labor' || exp.kind === 'courtship'
        ? '.'
        : ' with empty hands.';
  const destinationName =
    def?.name ??
    (exp.target ? regionAt(exp.target, ctx.mapRegionDefs ?? [])?.name : undefined) ??
    'the frontier';
  report(
    '🏠',
    `${partyNames(state, exp)} return${exp.heroIds.length === 1 ? 's' : ''} from ${destinationName}${tail}${surveyLine}${laborLine}${matchLine}`,
  );
}

/** Return seconded residents exactly once when an expedition reaches home. */
function returnResidentEscort(state: GameState, exp: ExpeditionState): void {
  if (!exp.residentEscort) return;
  for (const role of RESIDENT_ROLES) {
    const qty = exp.residentEscort[role] ?? 0;
    if (qty > 0) state.residents.roles[role] += qty;
  }
  exp.residentEscort = {};
}
