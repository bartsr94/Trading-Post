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
  applyDiplomacyShiftById,
  diplomacySeatStateOrDefault,
  effectiveDiplomacyStanding,
  ensureDiplomacySeat,
  isFirstContact,
  queueFirstContact,
  setDiplomacyPact,
} from './diplomacy';
import type { TravelContext } from './events/types';
import { priceAt } from './economy';
import type { GoodDef } from './economy';
import { addClaim } from './claim';
import { buildingEffect } from './buildings';
import { canWed, formUnion, unionError } from './family';
import { canCallRaidAlly, createOutgoingRaid, raidTargetFaction } from './raids';
import { hasCaptiveHeldBy, maybeQueueKinArrival, rollAbductionRisk } from './captivity';
import { departCharacter } from './roster';
import {
  addResidents,
  addTransientGroup,
  contentmentBand,
  loseResidentEscort,
  nudgeCulture,
  residentsAvailable,
  transientEffect,
} from './residents';
import { addThralls } from './thralls';
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
  clampStanding,
  discoveryAtLeast,
  getHero,
  heritageGroup,
  isActiveHeroId,
  oppositeGender,
  RESIDENT_ROLES,
  stanceOf,
} from './types';
import type {
  DiplomacyMissionType,
  DiplomacyTributeMode,
  DiscoveryState,
  ExpeditionKind,
  ExpeditionPace,
  ExpeditionState,
  FactionId,
  GameState,
  Gender,
  GoodId,
  Heritage,
  Hero,
  InviteOffer,
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
  /** For `invite` runs (TULA_SETTLEMENT_SPEC.md §5.1): the community to invite
   *  from (key into hireSources), how lavish the offer, and how many are hoped for. */
  inviteSource?: string;
  inviteOffer?: InviteOffer;
  inviteCount?: number;
  /** For `concession` runs (§5.2): chains of land to negotiate for. */
  concessionAsk?: number;
  /** For `courtship` runs: the graph-node id to wed (defaults to heroIds[0]). */
  courtshipFor?: string;
  /** For `raid` runs: how the party means to fight once it reaches the target. */
  raidGoal?: RaidAttackGoal;
  raidManeuver?: RaidManeuver;
  raidRally?: boolean;
  raidAlly?: FactionId;
  /** For `diplomacy` runs: the purpose of the envoy. */
  diplomacyMission?: { type: DiplomacyMissionType; mode?: DiplomacyTributeMode };
  /** For a `diplomacy` run with mission type `thralls`: headcount asked for
   *  (THRALLS_SPEC.md Acquisition §3). */
  thrallPurchaseCount?: number;
}

export function cargoUnits(cargo: Partial<Record<GoodId, number>>): number {
  return Object.values(cargo).reduce((sum: number, qty) => sum + (qty ?? 0), 0);
}

/** Up-front silver an Invite Settlers run costs (paid regardless of turnout, §5.1). */
export function inviteRunCost(count: number, offer: InviteOffer): number {
  const inv = TUNING.claim.invite;
  return Math.round(count * inv.baseCostPerHead * (inv.offerTierMultiplier[offer] ?? 1));
}

/** Up-front silver a Negotiate Land run costs (scales with chains asked, §5.2). */
export function negotiateLandSilverCost(ask: number): number {
  return ask * TUNING.claim.negotiateLand.silverCostPerLandUnit;
}

/** Goods a Negotiate Land run must carry as a land-clearing gift (scales with ask). */
export function negotiateLandGoodsCost(ask: number): Partial<Record<GoodId, number>> {
  const per = TUNING.claim.negotiateLand.goodsCostPerLandUnit;
  const goods: Partial<Record<GoodId, number>> = {};
  for (const [good, qty] of Object.entries(per) as [GoodId, number][]) {
    goods[good] = qty * ask;
  }
  return goods;
}

export function cargoCapacity(
  heroCount: number,
  escort?: Partial<Record<ResidentRole, number>>,
): number {
  const porters = escort?.porters ?? 0;
  return heroCount * TUNING.map.cargoCapacityPerHero + porters * TUNING.residents.effects.cargoPerPorter;
}

/** Check bonus a guard escort (and a Stables' mounts) lend to a caravan/
 *  explore/envoy arrival check. */
function escortMods(state: GameState, exp: ExpeditionState): CheckModifier[] {
  const mods: CheckModifier[] = [];
  const guards = exp.residentEscort?.guards ?? 0;
  if (guards > 0) {
    mods.push({ label: `Escort of ${guards}`, value: TUNING.residents.effects.guardEscortBonus });
  }
  const stables = buildingEffect(state, 'travelCheckBonus');
  if (stables > 0) {
    mods.push({ label: 'Stabled mounts', value: stables });
  }
  return mods;
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

/** One expedition kind's destination-specific dispatch validation. Shared
 *  target/route/party/escort/cargo checks live in `dispatchError` itself;
 *  each of these only covers what's particular to that kind. */
type DispatchKindError = (
  state: GameState,
  params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
  heroIds: string[],
) => string | null;

function dispatchErrorExplore(
  _state: GameState,
  _params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
): string | null {
  if (def && def.id !== TUNING.map.homeLocationId && !discoveryAtLeast(discovery, 'rumored')) {
    return 'You have heard of no such place.';
  }
  return null;
}

function dispatchErrorDiplomacy(
  state: GameState,
  params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
): string | null {
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
  if (mission === 'ransom' && !hasCaptiveHeldBy(state, def.faction)) {
    return 'There is no one of yours held here.';
  }
  if (mission === 'thralls') {
    const seat = diplomacySeatStateOrDefault(state, def);
    if (effectiveDiplomacyStanding(state, seat) < TUNING.thralls.purchase.nativeMinStanding) {
      return 'They do not trust you enough yet to sell you people.';
    }
    const count = params.thrallPurchaseCount ?? 0;
    if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
      return 'Ask for at least one thrall.';
    }
    if (state.silver < count * TUNING.thralls.purchase.nativeSilverPerHead) {
      return 'Not enough silver to buy that many.';
    }
  }
  return null;
}

function dispatchErrorInvite(
  state: GameState,
  params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
): string | null {
  if (!def) return 'Choose a known destination.';
  if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to their people yet.';
  const source = params.inviteSource;
  const src = source ? TUNING.heritage.hireSources[source] : undefined;
  if (!src) return 'Choose a people to invite.';
  if (src.seat !== def.id) return 'That is not where their people are.';
  if (stanceOf(state.factions[src.faction].standing) === 'Hostile') {
    return 'They will not answer an invitation from you.';
  }
  const offer = params.inviteOffer ?? 'generous';
  const count = params.inviteCount ?? 0;
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
    return 'Invite at least one household.';
  }
  if (state.silver < inviteRunCost(count, offer)) return 'Not enough silver for the invitation.';
  return null;
}

function dispatchErrorConcession(
  state: GameState,
  params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
): string | null {
  if (!def) return 'Choose a known destination.';
  if (!def.faction) return 'There is no one there to grant you land.';
  if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to their people yet.';
  if (stanceOf(state.factions[def.faction].standing) === 'Hostile') {
    return 'They will cede you no land while hostile.';
  }
  const ask = params.concessionAsk ?? 0;
  if (!Number.isFinite(ask) || !Number.isInteger(ask) || ask < 1) {
    return 'Ask for at least one chain of land.';
  }
  if (ask > TUNING.claim.negotiateLand.maxAsk) {
    return `They will not consider more than ${TUNING.claim.negotiateLand.maxAsk} chains at once.`;
  }
  if (state.silver < negotiateLandSilverCost(ask)) return 'Not enough silver for the land-price.';
  for (const [good, qty] of Object.entries(negotiateLandGoodsCost(ask)) as [GoodId, number][]) {
    if ((state.goods[good] ?? 0) < qty) return `Not enough ${good} for the land-gift.`;
  }
  return null;
}

function dispatchErrorCourtship(
  state: GameState,
  params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
  heroIds: string[],
): string | null {
  if (!def) return 'Choose a known destination.';
  if (def.faction !== 'CHARTER_COMPANY') {
    return 'Homeland matches are arranged only through the Company landing.';
  }
  if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to the garrison yet.';
  const subjectId = params.courtshipFor ?? heroIds[0];
  const err = unionError(state, subjectId);
  if (err) return err;
  if (state.silver < TUNING.family.homelandBridePrice) return 'Not enough silver for the bride-price.';
  return null;
}

function dispatchErrorRaid(
  state: GameState,
  params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
): string | null {
  if (!def) return 'Choose a known destination.';
  if (!discoveryAtLeast(discovery, 'rumored')) return 'You have no lead worth raiding yet.';
  const targetFaction = raidTargetFaction(def);
  if (!targetFaction) return 'There is no camp or rival there worth raiding.';
  if (params.silver && params.silver > 0) return 'A raid does not march out carrying silver.';
  if (cargoUnits(params.cargo ?? {}) > 0) {
    return 'A raid leaves with empty packs and hopes to fill them later.';
  }
  if (Object.values(params.buyOrders ?? {}).some((qty) => (qty ?? 0) > 0)) {
    return 'A raid cannot leave standing buy orders behind it.';
  }
  if (params.raidAlly && !canCallRaidAlly(state, params.raidAlly, targetFaction)) {
    return 'That ally will not ride on this raid.';
  }
  if (params.raidGoal === 'rescue' && !hasCaptiveHeldBy(state, targetFaction)) {
    return 'There is no one of yours held there.';
  }
  if (params.raidGoal === 'enslave' && (params.residents?.guards ?? 0) < 1) {
    return 'You cannot march captives home unescorted — bring at least one guard.';
  }
  return null;
}

function dispatchErrorCaravan(
  _state: GameState,
  _params: DispatchParams,
  def: LocationDef | undefined,
  discovery: DiscoveryState,
): string | null {
  if (!def) return 'Choose a known destination.';
  if (!def.hasMarket) return 'There is no market there.';
  if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to that market yet.';
  return null;
}

// 'caravan' doubles as the default branch for any kind without its own entry
// (matches the original if/else-if chain's trailing `else`).
const DISPATCH_KIND_ERRORS: Partial<Record<ExpeditionKind, DispatchKindError>> = {
  explore: dispatchErrorExplore,
  diplomacy: dispatchErrorDiplomacy,
  invite: dispatchErrorInvite,
  concession: dispatchErrorConcession,
  courtship: dispatchErrorCourtship,
  raid: dispatchErrorRaid,
  caravan: dispatchErrorCaravan,
};

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

  const kindError = DISPATCH_KIND_ERRORS[params.kind] ?? dispatchErrorCaravan;
  const kindErrorMsg = kindError(state, params, def, discovery, heroIds);
  if (kindErrorMsg) return kindErrorMsg;

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
  if (cargoUnits(cargo) > cargoCapacity(heroIds.length, escort) + buildingEffect(state, 'cargoCapacityBonus')) {
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

  // An Invite Settlers run pays for the invitation's effort/gifts up front —
  // no refund on a poor turnout (§5.1).
  if (params.kind === 'invite') {
    const offer = params.inviteOffer ?? 'generous';
    state.silver -= inviteRunCost(params.inviteCount ?? 0, offer);
  }

  // A Negotiate Land run pays the land-price and the land-gift up front (§5.2).
  if (params.kind === 'concession') {
    const ask = params.concessionAsk ?? 0;
    state.silver -= negotiateLandSilverCost(ask);
    for (const [good, qty] of Object.entries(negotiateLandGoodsCost(ask)) as [GoodId, number][]) {
      state.goods[good] = Math.max(0, (state.goods[good] ?? 0) - qty);
    }
  }

  // A thralls-purchase envoy pays the asking price up front, same as an
  // Invite Settlers run (THRALLS_SPEC.md Acquisition §3).
  if (params.kind === 'diplomacy' && params.diplomacyMission?.type === 'thralls') {
    state.silver -= (params.thrallPurchaseCount ?? 0) * TUNING.thralls.purchase.nativeSilverPerHead;
  }

  // A courtship run pays the bride-price up front and records who is to be wed.
  let courtshipFor: string | undefined;
  if (params.kind === 'courtship') {
    state.silver -= TUNING.family.homelandBridePrice;
    courtshipFor = params.courtshipFor ?? params.heroIds[0];
  }
  if (params.kind === 'raid' && params.raidAlly) {
    const ally = state.factions[params.raidAlly];
    ally.standing = clampStanding(ally.standing - TUNING.raid.allyStandingCost);
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
    ...(params.kind === 'invite'
      ? {
          inviteSource: params.inviteSource,
          inviteOffer: params.inviteOffer ?? 'generous',
          inviteCount: params.inviteCount ?? 0,
        }
      : {}),
    ...(params.kind === 'concession' ? { concessionAsk: params.concessionAsk ?? 0 } : {}),
    ...(courtshipFor !== undefined ? { courtshipFor } : {}),
    ...(params.kind === 'diplomacy'
      ? {
          diplomacyMission: { ...(params.diplomacyMission ?? { type: 'talks' as const }) },
          ...(params.diplomacyMission?.type === 'thralls'
            ? { thrallPurchaseCount: params.thrallPurchaseCount ?? 0 }
            : {}),
        }
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
    exp.heroIds = exp.heroIds.filter((id) => isActiveHeroId(state, id));
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
      const abductionLine = rollAbductionRisk(state, exp, def, rng);
      if (abductionLine) {
        report('🔒', abductionLine);
        if (exp.heroIds.length === 0) {
          loseResidentEscort(state, exp.residentEscort);
          finished.push(exp.id);
          continue;
        }
      }
      if (exp.kind === 'caravan' && def) resolveCaravanArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'explore') resolveExploreArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'diplomacy' && def) resolveDiplomacyArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'invite' && def) resolveInviteArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'concession' && def)
        resolveConcessionArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'raid' && def) {
        if (queueRaidArrival(state, exp, def, rng, report)) continue;
        exp.leg = 'returning';
        exp.turnsLeft = Math.max(1, exp.legTurns);
        continue;
      } else if (exp.kind === 'courtship' && def) resolveCourtshipArrival(state, exp, def, report);
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
    ...escortMods(state, exp),
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
    cargoCapacity(exp.heroIds.length, exp.residentEscort) +
    transientEffect(state, 'cargoBonus') +
    buildingEffect(state, 'cargoCapacityBonus');
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
    faction.standing = clampStanding(faction.standing + TUNING.map.caravanStandingGain);
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
    ...escortMods(state, exp),
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

/** An envoy reaches a faction seat: resolves the chosen mission (talks/gift/
 *  alliance/peace) against that seat's standing, applying the diplomacy check
 *  result to standing/grievances and, on success, an escort transient. */
function resolveDiplomacyArrival(
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
    ...escortMods(state, exp),
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
    case 'ransom': {
      const abd = TUNING.abduction;
      const captorFaction = def.faction;
      const held = captorFaction
        ? state.heroes
            .filter((h) => h.status === 'captive' && h.captivity?.faction === captorFaction)
            .sort((a, b) => (a.captivity?.capturedTurn ?? 0) - (b.captivity?.capturedTurn ?? 0))
        : [];
      const captive = held[0];
      exp.cargo = {};
      exp.silver = 0;
      if (!captive || !captorFaction) {
        missionLine = ' But there is no one of ours held here any longer.';
        break;
      }
      if (check.tier === 'critSuccess') delta = dip.expeditionStandingGainSuccess;
      else if (check.tier === 'success') delta = Math.max(1, giftSteps);
      else if (check.tier === 'failure') delta = -dip.expeditionStandingLossFailure;
      else {
        delta = -dip.expeditionStandingLossCritFailure;
        grievanceDelta = dip.grievanceOnCritFailure;
      }
      if (isSuccess(check.tier)) {
        const capturedTurn = captive.captivity?.capturedTurn ?? state.turn;
        const turnsHeld = state.turn - capturedTurn;
        const refuses = turnsHeld >= abd.refuseReturnThresholdTurns && rng.next() < abd.refusesReturnChance;
        if (refuses) {
          departCharacter(state, captive.id);
          missionLine = ` But ${captive.name} will not come — he has a family among ${def.name} now.`;
        } else {
          captive.status = 'active';
          delete captive.captivity;
          maybeQueueKinArrival(state, captive, captorFaction, capturedTurn, rng);
          missionLine = ` ${captive.name} is ransomed free and rides back with the party.`;
        }
      } else {
        missionLine = ` ${captive.name} remains held.`;
      }
      break;
    }
    case 'thralls': {
      const requested = exp.thrallPurchaseCount ?? 0;
      const frac = TUNING.thralls.purchase.baseFractionByCheckTier[check.tier] ?? 0;
      const acquired = Math.round(requested * frac);
      if (acquired > 0) {
        const source = Object.values(TUNING.heritage.hireSources).find((src) => src.seat === def.id);
        const tag = source?.people;
        addThralls(state, 'idle', acquired, tag, tag ? heritageGroup(tag) : 'native');
        missionLine = ` ${acquired} thrall${acquired === 1 ? '' : 's'} are brought back, bound for the march home.`;
      } else {
        missionLine = ' But none are handed over for the price offered.';
      }
      if (check.tier === 'critFailure') {
        grievanceDelta = dip.grievanceOnCritFailure;
      }
      delta = 0;
      break;
    }
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
          : mission === 'ransom'
            ? 'seeks to ransom a captive from'
            : mission === 'thralls'
              ? 'seeks to buy thralls from'
              : 'treats with';
  report(
    '🤝',
    `${hero.name} ${verb} ${def.name}: ${checkBreakdown(check)}. ` +
      `Standing ${delta >= 0 ? '+' : ''}${delta}.${missionLine}${pactLine}${escortLine}`,
  );
}

/** The party best suited to lead an invitation/negotiation — bargain or
 *  leadership, whichever any single hero is strongest in (§5.1). */
function bestNegotiator(state: GameState, exp: ExpeditionState): { hero: Hero; skill: SkillId } {
  const heroes = exp.heroIds.map((id) => getHero(state, id));
  let best = { hero: heroes[0], skill: 'bargain' as SkillId };
  for (const hero of heroes) {
    for (const skill of ['bargain', 'leadership'] as SkillId[]) {
      if (hero.skills[skill] > best.hero.skills[best.skill]) best = { hero, skill };
    }
  }
  return best;
}

/**
 * An Invite Settlers run reaches a community (§5.1): a hero-led Bargain/
 * Leadership check, the offer tier, and the post's own mood together set how
 * many households actually agree to come. The count is rolled here and the
 * settlers land on homecoming.
 */
function resolveInviteArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const inv = TUNING.claim.invite;
  const src = exp.inviteSource ? TUNING.heritage.hireSources[exp.inviteSource] : undefined;
  const offer = exp.inviteOffer ?? 'generous';
  const wanted = exp.inviteCount ?? 0;
  const { hero, skill } = bestNegotiator(state, exp);
  const tags = ['strangers', ...def.tags, ...(def.faction ? [def.faction] : [])];
  const mods = [
    ...traitModifiers(hero, ctx.traitDefs, skill, tags),
    ...escortMods(state, exp),
    ...paceMods(exp),
    { label: 'offer', value: inv.offerTierRollBonus[offer] ?? 0 },
  ];
  const stat = bestGoverningStat(hero, skill);
  const check = resolveCheck(rng, hero, skill, stat, inv.checkDifficulty, mods);
  if (isSuccess(check.tier)) markSkill(hero, skill);

  const band = contentmentBand(state);
  const raw =
    wanted *
    (inv.baseFractionByCheckTier[check.tier] ?? 0) *
    (inv.offerTierMultiplier[offer] ?? 1) *
    (inv.contentmentMult[band] ?? 1);
  const ceiling = check.tier === 'critSuccess' ? wanted + inv.overflowBonus : wanted;
  const actual = clamp(Math.round(raw), 0, ceiling);
  exp.inviteArrivals = actual;

  if (isSuccess(check.tier) && src) {
    const faction = state.factions[src.faction];
    faction.standing = clampStanding(faction.standing + inv.arrivalStandingGain);
  }

  report(
    '📣',
    `${hero.name} presses the case at ${def.name}: ${checkBreakdown(check)}. ` +
      (actual > 0
        ? `${actual} household${actual === 1 ? '' : 's'} agree to come.`
        : 'None will make the move.'),
  );
}

/**
 * A Negotiate Land run reaches a neighbouring people's seat (§5.2): a hero-led
 * check against their patience. Success grants the chains asked for (settled on
 * homecoming); failure costs the gift and leaves a grievance.
 */
function resolveConcessionArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const neg = TUNING.claim.negotiateLand;
  const ask = exp.concessionAsk ?? 0;
  const { hero, skill } = bestNegotiator(state, exp);
  const tags = ['bargain', ...def.tags, ...(def.faction ? [def.faction] : [])];
  const mods = [
    ...traitModifiers(hero, ctx.traitDefs, skill, tags),
    ...escortMods(state, exp),
    ...paceMods(exp),
  ];
  const stat = bestGoverningStat(hero, skill);
  const check = resolveCheck(rng, hero, skill, stat, neg.checkDifficulty, mods);

  if (isSuccess(check.tier)) {
    markSkill(hero, skill);
    exp.concessionGranted = ask;
    if (def.faction) applyDiplomacyShiftById(state, def.id, neg.successStandingGain, 0);
    report(
      '📐',
      `${hero.name} treats for land at ${def.name}: ${checkBreakdown(check)}. ` +
        `${ask} chain${ask === 1 ? '' : 's'} are ceded to the post.`,
    );
  } else {
    exp.concessionGranted = 0;
    if (def.faction) applyDiplomacyShiftById(state, def.id, 0, neg.failureGrievance);
    report(
      '📐',
      `${hero.name} treats for land at ${def.name}: ${checkBreakdown(check)}. ` +
        'They cede nothing, and the asking rankles.',
    );
  }
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
    faction.standing = clampStanding(faction.standing + TUNING.family.homelandMatchStanding);
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
        const priorDiscovery = location.discovery;
        location.discovery = 'visited';
        learned.push(ctx.locationDefs.get(locationId)?.name ?? locationId);
        const seatDef = ctx.locationDefs.get(locationId);
        if (seatDef && isFirstContact(seatDef, priorDiscovery)) {
          queueFirstContact(state, seatDef, leadHero(state, exp, 'diplomacy').id);
        }
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

  // Invited settlers put down roots — the population is uncapped now (§5.1), so
  // all who agreed to come do. Homeland arrivals pull culture Homeland-ward,
  // native ones Frontier-ward.
  let settleLine = '';
  if (exp.kind === 'invite' && exp.inviteArrivals && exp.inviteArrivals > 0) {
    const src = exp.inviteSource ? TUNING.heritage.hireSources[exp.inviteSource] : undefined;
    const group = src ? heritageGroup(src.people) : 'homeland';
    const settled = addResidents(state, 'idle', exp.inviteArrivals, src?.people, group);
    const nudge = TUNING.heritage.hireAxisNudge * settled;
    nudgeCulture(state, group === 'native' ? nudge : -nudge);
    settleLine = ` ${settled} newcomer${settled === 1 ? '' : 's'} settle in.`;
  }

  // Negotiated land is added to the Concession; its grantor becomes the
  // over-Concession standing target (§5.2).
  let landLine = '';
  if (exp.kind === 'concession' && exp.concessionGranted && exp.concessionGranted > 0) {
    addClaim(state, exp.concessionGranted);
    if (def?.faction) state.claim.landholder = def.faction;
    landLine = ` The Concession grows by ${exp.concessionGranted} chain${
      exp.concessionGranted === 1 ? '' : 's'
    }.`;
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
      : exp.kind === 'diplomacy' ||
          exp.kind === 'invite' ||
          exp.kind === 'concession' ||
          exp.kind === 'courtship'
        ? '.'
        : ' with empty hands.';
  const destinationName =
    def?.name ??
    (exp.target ? regionAt(exp.target, ctx.mapRegionDefs ?? [])?.name : undefined) ??
    'the frontier';
  report(
    '🏠',
    `${partyNames(state, exp)} return${exp.heroIds.length === 1 ? 's' : ''} from ${destinationName}${tail}${surveyLine}${settleLine}${landLine}${matchLine}`,
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
