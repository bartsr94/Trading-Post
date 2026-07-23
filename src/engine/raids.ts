// Raiding — two-way warfare (RAIDING_SPEC.md). Pure: selectors + a deterministic
// battle resolver taking/returning RNG state for both incoming and outgoing
// encounters.
// No React, no content knowledge beyond TUNING; display names/goodDefs arrive
// via RaidContext, mirroring TurnContext.

import { TUNING } from '../content/tuning';
import { bestGoverningStat, checkBreakdown, isSuccess, resolveCheck } from './checks';
import { buildingEffect } from './buildings';
import {
  applyDiplomacyShiftById,
  diplomacySeatStateById,
  diplomacySeatsForFaction,
  effectiveDiplomacyStanding,
  setDiplomacyPactById,
} from './diplomacy';
import { stockValue } from './economy';
import type { GoodDef } from './economy';
import {
  loseResidentEscort,
  loseResidents,
  postDefense,
  residentTotal,
  residentsAvailable,
  transientEffect,
} from './residents';
import type { Rng } from './rng';
import { clamp, FACTION_IDS, heroesAtPost, RAID_MANEUVERS } from './types';
import type {
  BuildingId,
  DiplomacySeatState,
  ExpeditionState,
  FactionId,
  GameState,
  GoodId,
  Hero,
  LocationDef,
  PendingIncomingRaid,
  PendingOutgoingRaid,
  RaidDefendGoal,
  RaidAttackGoal,
  RaidManeuver,
  RaidSeverity,
  TributeRelationship,
} from './types';

/** Content the resolver needs for prose + wealth math, injected to stay pure. */
export interface RaidContext {
  goodDefs: ReadonlyMap<GoodId, GoodDef>;
  goodNames: ReadonlyMap<GoodId, string>;
  buildingNames: ReadonlyMap<BuildingId, string>;
}

/** The player's defence choices for an incoming raid. */
export interface RaidDefenseParams {
  goal: RaidDefendGoal;
  maneuver: RaidManeuver;
  /** Whether to attempt a pre-battle rally (a leadership check). */
  rally?: boolean;
}

export interface RaidAttackParams {
  goal: RaidAttackGoal;
  maneuver: RaidManeuver;
  /** Whether to attempt a pre-battle rally (a leadership check). */
  rally?: boolean;
}

export interface RaidResolution {
  direction: 'incoming' | 'outgoing';
  outcome: 'repelled' | 'held' | 'sacked' | 'drivenOff' | 'plundered' | 'bloodied' | 'cowed';
  log: string[];
  /** True when this raid triggered the `destroyed` cascade game-over. */
  gameOver: boolean;
}

export interface DefenderForceBreakdown {
  guards: number;
  fortifications: number;
  transients: number;
  post: number;
  heroes: number;
  muster: number;
  total: number;
}

export interface RaidingForceBreakdown {
  heroes: number;
  guards: number;
  porters: number;
  cargoCapacity: number;
  ally: number;
  distancePenalty: number;
  total: number;
}

export function tributeFor(
  state: GameState,
  faction: FactionId,
): TributeRelationship | undefined {
  return state.tributes.find((tribute) => tribute.faction === faction);
}

export function clearTribute(state: GameState, faction: FactionId): boolean {
  const before = state.tributes.length;
  state.tributes = state.tributes.filter((tribute) => tribute.faction !== faction);
  return state.tributes.length !== before;
}

export function setTribute(state: GameState, tribute: TributeRelationship): void {
  const goods = Object.fromEntries(
    Object.entries(tribute.goods).filter(([, qty]) => (qty ?? 0) > 0),
  ) as Partial<Record<GoodId, number>>;
  if (tribute.silver <= 0 && Object.keys(goods).length === 0) {
    clearTribute(state, tribute.faction);
    return;
  }
  clearTribute(state, tribute.faction);
  state.tributes.push({ ...tribute, goods });
}

export function raidTargetFaction(
  def: Pick<LocationDef, 'faction' | 'tags'>,
): FactionId | null {
  if (def.faction) return def.faction;
  return def.tags.includes('beastfolk') ? 'BEASTFOLK' : null;
}

export function canCallRaidAlly(
  state: GameState,
  faction: FactionId,
  targetFaction?: FactionId | null,
): boolean {
  if (faction === targetFaction) return false;
  const seats = diplomacySeatsForFaction(state, faction);
  if (seats.some(([, seat]) => seat.pact === 'alliance')) return true;
  const bestStanding =
    seats.length > 0
      ? seats.reduce(
          (best, [, seat]) => Math.max(best, effectiveDiplomacyStanding(state, seat)),
          -100,
        )
      : state.factions[faction].standing;
  return bestStanding >= TUNING.raid.allyStandingRequired;
}

// ------------------------------------------------------------- force selectors

/** Rural hands answer the Company's call to arms — cheaper than a warrior,
 *  capped. Farmers, herders, hunters, and idle folk all take up a spear
 *  (TULA_SETTLEMENT_SPEC.md §3). */
export function companyMuster(state: GameState): number {
  const r = TUNING.raid;
  const roles = state.residents.roles;
  const heads = roles.farmers + roles.herders + roles.hunters + state.residents.idle;
  return Math.min(r.musterMax, heads * r.musterValuePerHead);
}

export function defenderForceBreakdown(state: GameState): DefenderForceBreakdown {
  const guards =
    residentsAvailable(state, 'guards') * TUNING.residents.effects.postDefensePerGuard;
  const fortifications = buildingEffect(state, 'defenseBonus');
  const transients = transientEffect(state, 'defenseBonus');
  const post = guards + fortifications + transients;
  const heroes = heroesAtPost(state).reduce(
    (sum, hero) => sum + hero.skills.combat * TUNING.raid.heroCombatWeight,
    0,
  );
  const muster = companyMuster(state);
  return {
    guards,
    fortifications,
    transients,
    post,
    heroes,
    muster,
    total: post + heroes + muster,
  };
}

/** Total defensive strength of the post (RAIDING_SPEC.md §3.1). */
export function defenderForce(state: GameState): number {
  return defenderForceBreakdown(state).total;
}

// ----------------------------------------------------- eligibility & cadence

/** How hostile a faction is toward the post (negative standing → positive threat). */
function hostilityOf(state: GameState, faction: FactionId): number {
  const seats = diplomacySeatsForFaction(state, faction);
  if (seats.length === 0) return Math.max(0, -state.factions[faction].standing);
  return seats.reduce((maxThreat, [, seat]) => Math.max(maxThreat, communityRaidThreat(state, seat)), 0);
}

/** Factions that may raid the post right now (RAIDING_SPEC.md §6). */
function communityRaidThreat(state: GameState, seat: DiplomacySeatState): number {
  let threat =
    Math.max(0, -effectiveDiplomacyStanding(state, seat)) +
    seat.grievances * TUNING.diplomacy.raidThreatPerGrievance;
  if (seat.pact === 'truce') {
    threat = Math.max(0, threat - TUNING.diplomacy.truceRaidThreatReduction);
  } else if (seat.pact === 'alliance') {
    threat = Math.max(0, threat - TUNING.diplomacy.allianceRaidThreatReduction);
  }
  return threat;
}

function primaryAggressorSeatId(
  state: GameState,
  faction: FactionId,
): LocationDef['id'] | undefined {
  const seats = diplomacySeatsForFaction(state, faction);
  if (seats.length === 0) return undefined;
  return seats.reduce((best, candidate) =>
    communityRaidThreat(state, candidate[1]) > communityRaidThreat(state, best[1]) ? candidate : best,
  )[0];
}

function applyAggressorStandingShift(
  state: GameState,
  faction: FactionId,
  delta: number,
): void {
  const seatId = primaryAggressorSeatId(state, faction);
  if (seatId) {
    applyDiplomacyShiftById(state, seatId, delta);
    return;
  }
  state.factions[faction].standing = clamp(state.factions[faction].standing + delta, -100, 100);
}

export function eligibleAggressors(state: GameState): FactionId[] {
  const r = TUNING.raid;
  const threatThreshold = Math.max(0, -r.hostileStandingThreshold);
  return FACTION_IDS.filter((f) => {
    if (f === 'CHARTER_COMPANY') return false; // your own charter never raids you
    if (tributeFor(state, f)) return false; // tribute is an oath of peace in either direction
    if (hostilityOf(state, f) >= threatThreshold) return true;
    const standing = state.factions[f].standing;
    // The Beastfolk are wild raiders: a laxer band than the seated factions.
    return f === 'BEASTFOLK' && r.beastfolkAlwaysEligible && standing < 0;
  });
}

/** The angriest eligible aggressor's hostility (0 when none). */
export function maxHostility(state: GameState): number {
  return eligibleAggressors(state).reduce((m, f) => Math.max(m, hostilityOf(state, f)), 0);
}

/** The raid cooldown has elapsed (or no raid has ever fired). */
export function raidCooldownElapsed(state: GameState): boolean {
  return state.lastRaidTurn === 0 || state.turn - state.lastRaidTurn >= TUNING.raid.minTurnsBetweenRaids;
}

/** Whether an incoming raid may be considered this turn (grace + aggressor + cooldown). */
export function raidEligible(state: GameState): boolean {
  return (
    state.gameOver === null &&
    state.pendingRaid === null &&
    state.turn >= TUNING.raid.graceTurns &&
    raidCooldownElapsed(state) &&
    eligibleAggressors(state).length > 0
  );
}

/** A raid threat looms (grace elapsed + an aggressor exists) — for content gating. */
export function raidThreatActive(state: GameState): boolean {
  return state.turn >= TUNING.raid.graceTurns && eligibleAggressors(state).length > 0;
}

/** Per-turn probability an eligible post is raided (RAIDING_SPEC.md §6). */
export function raidChance(state: GameState, prosperityScore: number): number {
  const c = TUNING.raid.raidChance;
  const chance =
    c.base +
    c.perProsperity * Math.max(0, prosperityScore) +
    c.perHostility * maxHostility(state) -
    c.perDefense * postDefense(state);
  return clamp(chance, 0, c.max);
}

// ------------------------------------------------------- building an incoming raid

function pickSeverity(hostility: number, rng: Rng): RaidSeverity {
  const r = TUNING.raid;
  if (hostility >= r.warbandHostility && rng.next() < 0.5) return 'warband';
  if (hostility >= r.raidHostility) return 'raid';
  return 'probe';
}

/** The band's committed maneuver, by faction temperament. */
function pickAttackerManeuver(faction: FactionId, rng: Rng): RaidManeuver {
  if (faction === 'BEASTFOLK') return rng.next() < 0.6 ? 'charge' : 'skirmish';
  return RAID_MANEUVERS[rng.int(0, RAID_MANEUVERS.length - 1)];
}

function bandLabel(faction: FactionId, rng: Rng): string {
  if (faction === 'BEASTFOLK') return rng.next() < 0.5 ? 'an orc war-band' : 'a goblin raiding party';
  return 'a raiding party';
}

function bestInParty(
  state: GameState,
  expedition: ExpeditionState,
  skill: 'combat' | 'leadership' | 'stealth',
): Hero | null {
  const heroes = expedition.heroIds
    .map((id) => state.heroes.find((hero) => hero.id === id))
    .filter((hero): hero is Hero => hero !== undefined && hero.status === 'active');
  if (heroes.length === 0) return null;
  return heroes.reduce((a, b) => (b.skills[skill] > a.skills[skill] ? b : a));
}

function raidCargoCapacity(expedition: ExpeditionState): number {
  const porters = expedition.residentEscort?.porters ?? 0;
  return (
    expedition.heroIds.length * TUNING.map.cargoCapacityPerHero +
    porters * TUNING.residents.effects.cargoPerPorter
  );
}

function cargoUnits(cargo: Partial<Record<GoodId, number>>): number {
  return Object.values(cargo).reduce((sum, qty) => sum + (qty ?? 0), 0);
}

function fillRaidLoot(
  expedition: ExpeditionState,
  units: number,
  rng: Rng,
): Partial<Record<GoodId, number>> {
  const looted: Partial<Record<GoodId, number>> = {};
  const capLeft = Math.max(0, raidCargoCapacity(expedition) - cargoUnits(expedition.cargo));
  const toTake = Math.max(0, Math.min(capLeft, units));
  for (let i = 0; i < toTake; i++) {
    const good = rng.pick(TUNING.raid.lootGoods as GoodId[]);
    expedition.cargo[good] = (expedition.cargo[good] ?? 0) + 1;
    looted[good] = (looted[good] ?? 0) + 1;
  }
  return looted;
}

function lootSummary(
  loot: Partial<Record<GoodId, number>>,
  goodNames: ReadonlyMap<GoodId, string>,
): string {
  return Object.entries(loot)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([good, qty]) => `${qty} ${goodNames.get(good as GoodId) ?? good}`)
    .join(', ');
}

function targetDefenseForce(
  target: Pick<LocationDef, 'faction' | 'hasMarket' | 'tags'>,
): number {
  return raidTargetFaction(target) || target.hasMarket
    ? TUNING.raid.outgoingSeatDefense
    : TUNING.raid.outgoingWildDefense;
}

/** The raw strength a raiding party brings before battle-goal and rally effects. */
export function raidingForce(state: GameState, expedition: ExpeditionState): number {
  return raidingForceBreakdown(state, expedition).total;
}

export function raidingForceBreakdown(
  state: GameState,
  expedition: ExpeditionState,
): RaidingForceBreakdown {
  const party = expedition.heroIds
    .map((id) => state.heroes.find((hero) => hero.id === id))
    .filter((hero): hero is Hero => hero !== undefined && hero.status === 'active');
  const heroes = party.reduce(
    (sum, hero) => sum + hero.skills.combat * TUNING.raid.heroCombatWeight,
    0,
  );
  const guards = expedition.residentEscort?.guards ?? 0;
  const porters = expedition.residentEscort?.porters ?? 0;
  const ally = expedition.raidAlly ? TUNING.raid.allyForceBonus : 0;
  const distancePenalty =
    (expedition.legTurns ?? expedition.turnsLeft) * TUNING.raid.outgoingDistancePenaltyPerTurn;
  return {
    heroes,
    guards: guards * TUNING.raid.guardEscortForce,
    porters,
    cargoCapacity: raidCargoCapacity(expedition),
    ally,
    distancePenalty,
    total: Math.max(
      1,
      Math.round(heroes + guards * TUNING.raid.guardEscortForce + ally - distancePenalty),
    ),
  };
}

/**
 * Rolls a fresh incoming raid from the angriest eligible aggressor. Does not
 * mutate state beyond nothing — the caller stores the returned PendingRaid and
 * stamps `lastRaidTurn`.
 */
export function createIncomingRaid(
  state: GameState,
  rng: Rng,
  opts: { faction?: FactionId; severity?: RaidSeverity } = {},
): PendingIncomingRaid | null {
  let faction = opts.faction;
  if (!faction) {
    const aggressors = eligibleAggressors(state);
    if (aggressors.length === 0) return null;
    // The angriest faction leads the raid.
    faction = aggressors.reduce((a, b) => (hostilityOf(state, b) > hostilityOf(state, a) ? b : a));
  }
  const hostility = hostilityOf(state, faction);
  const severity = opts.severity ?? pickSeverity(hostility, rng);
  const sev = TUNING.raid.severity[severity];

  const raw = sev.baseForce + hostility * TUNING.raid.forcePerHostility;
  const spread = 1 + (rng.next() * 2 - 1) * TUNING.raid.forceSpread;
  const attackerForce = Math.max(1, Math.round(raw * spread));

  const spotChance = clamp(
    TUNING.raid.spotChanceBase + TUNING.raid.spotChancePerDefense * postDefense(state) + sev.spotOffset,
    0.05,
    0.95,
  );
  const spotted = rng.next() < spotChance;

  return {
    kind: 'incoming',
    faction,
    severity,
    attackerForce,
    attackerManeuver: pickAttackerManeuver(faction, rng),
    spotted,
    band: bandLabel(faction, rng),
  };
}

/** Rolls the approach and opposition for an outgoing raid that has reached its mark. */
export function createOutgoingRaid(
  state: GameState,
  expedition: ExpeditionState,
  target: LocationDef,
  rng: Rng,
): PendingOutgoingRaid | null {
  const targetFaction = raidTargetFaction(target);
  const sneak = bestInParty(state, expedition, 'stealth');
  if (!targetFaction || !sneak) return null;

  const guards = expedition.residentEscort?.guards ?? 0;
  const stealthStat = bestGoverningStat(sneak, 'stealth');
  const stealthDifficulty =
    TUNING.raid.outgoingStealthDifficulty +
    expedition.heroIds.length * TUNING.raid.outgoingStealthPartyPenalty +
    guards * TUNING.raid.outgoingStealthGuardPenalty +
    (expedition.raidAlly ? TUNING.raid.outgoingStealthAllyPenalty : 0) +
    (target.faction || target.hasMarket ? 1 : 0);
  const stealth = resolveCheck(rng, sneak, 'stealth', stealthStat, stealthDifficulty);
  const spotted = !isSuccess(stealth.tier);

  return {
    kind: 'outgoing',
    expeditionId: expedition.id,
    faction: targetFaction,
    targetName: target.name,
    defenderForce:
      targetDefenseForce(target) + (spotted ? TUNING.raid.outgoingDetectedDefenseBonus : 0),
    defenderManeuver:
      targetFaction ? pickAttackerManeuver(targetFaction, rng) : rng.pick(RAID_MANEUVERS),
    spotted,
    goal: expedition.raidGoal ?? 'plunder',
    maneuver: expedition.raidManeuver ?? 'skirmish',
    rally: expedition.raidRally ?? false,
    ...(expedition.raidAlly ? { ally: expedition.raidAlly } : {}),
  };
}

// ------------------------------------------------------------- battle resolution

/** Maneuver rock-paper-scissors: skirmish>charge>evade>skirmish. */
function defenderManeuverBeats(defender: RaidManeuver, attacker: RaidManeuver): boolean {
  return (
    (defender === 'skirmish' && attacker === 'charge') ||
    (defender === 'charge' && attacker === 'evade') ||
    (defender === 'evade' && attacker === 'skirmish')
  );
}

function maneuverMod(defender: RaidManeuver, attacker: RaidManeuver): number {
  if (defender === attacker) return 0;
  return defenderManeuverBeats(defender, attacker) ? TUNING.raid.maneuverSwing : -TUNING.raid.maneuverSwing;
}

/** The at-post hero best able to lead a check of `skill`, or null if none home. */
function bestAtPost(state: GameState, skill: 'combat' | 'leadership'): Hero | null {
  const heroes = heroesAtPost(state);
  if (heroes.length === 0) return null;
  return heroes.reduce((a, b) => (b.skills[skill] > a.skills[skill] ? b : a));
}

function declareDestroyed(state: GameState): void {
  state.gameOver = {
    kind: 'destroyed',
    title: 'The Post Falls',
    text: 'They come through the broken palisade at dawn and there is no one left with the strength to hold them. What little the storehouse held goes onto their backs; the rest goes up in smoke. By the time word reaches Thornwatch, the frontier has already closed over the place as if it were never there.',
  };
  state.phase = 'gameover';
}

export function resolveOutgoingRaid(
  state: GameState,
  raid: PendingOutgoingRaid,
  params: RaidAttackParams,
  rng: Rng,
  ctx: RaidContext,
): RaidResolution {
  const expedition = state.expeditions.find((exp) => exp.id === raid.expeditionId);
  if (!expedition) {
    state.pendingRaid = null;
    return {
      direction: 'outgoing',
      outcome: 'drivenOff',
      log: ['The raiding party is already gone from the road.'],
      gameOver: false,
    };
  }

  const goalId = params.goal;
  const goal = TUNING.raid.attackGoals[goalId] ?? TUNING.raid.attackGoals.plunder;
  const maneuver = params.maneuver;
  const targetFaction = raid.faction;
  const log: string[] = [];
  const party = expedition.heroIds
    .map((id) => state.heroes.find((hero) => hero.id === id))
    .filter((hero): hero is Hero => hero !== undefined && hero.status === 'active');
  if (party.length === 0) {
    expedition.heroIds = [];
    log.push('No one is left to strike the raid.');
    transitionRaidExpedition(state, expedition, log);
    state.pendingRaid = null;
    return { direction: 'outgoing', outcome: 'drivenOff', log, gameOver: false };
  }

  const leader = bestInParty(state, expedition, 'combat') ?? party[0];
  const guards = expedition.residentEscort?.guards ?? 0;

  let rallyBonus = 0;
  if (params.rally) {
    const rallyLeader = bestInParty(state, expedition, 'leadership') ?? leader;
    const stat = bestGoverningStat(rallyLeader, 'leadership');
    const rally = resolveCheck(rng, rallyLeader, 'leadership', stat, TUNING.raid.rallyCheckDifficulty);
    if (isSuccess(rally.tier)) {
      rallyBonus = TUNING.raid.rallyForceBonus;
      log.push(`${rallyLeader.name} steels the party before the strike — ${checkBreakdown(rally)}.`);
    } else {
      log.push(`${rallyLeader.name} cannot keep the raid light on its feet — ${checkBreakdown(rally)}.`);
    }
  }
  const A = Math.max(
    1,
    Math.round(raidingForce(state, expedition) + rallyBonus + goal.forceMod),
  );
  const D = raid.defenderForce;
  const maneuverEdge = maneuverMod(raid.defenderManeuver, maneuver);
  const leaderBonus =
    leader.skills.combat + Math.max(leader.stats.might, leader.stats.agility);
  const margin =
    A +
    rng.d6() +
    rng.d6() +
    leaderBonus +
    (raid.spotted ? 0 : TUNING.raid.outgoingSurpriseForce) -
    D -
    maneuverEdge;

  const tributeBroken = clearTribute(state, targetFaction);
  log.push(
    raid.spotted
      ? `The raiders are seen before they can strike ${raid.targetName}.`
      : `The party slips in toward ${raid.targetName} under cover, unseen until the blow falls.`,
  );
  if (raid.ally) {
    log.push('Allied warriors ride with the party, adding weight but little quiet.');
  }

  const targetSeatId =
    expedition.destination &&
    diplomacySeatStateById(state, expedition.destination)?.faction === targetFaction
      ? expedition.destination
      : undefined;
  const diplomaticLoss =
    goal.factionStandingLoss + (tributeBroken ? TUNING.raid.tributeBrokenStandingLoss : 0);
  if (targetSeatId) {
    applyDiplomacyShiftById(state, targetSeatId, -diplomaticLoss);
    setDiplomacyPactById(state, targetSeatId, 'none');
  } else {
    state.factions[targetFaction].standing = clamp(
      state.factions[targetFaction].standing - diplomaticLoss,
      -100,
      100,
    );
  }
  if (tributeBroken) {
    log.push(`The old tribute oath with ${raid.targetName} is broken by blood.`);
  }

  state.factions.CHARTER_COMPANY.standing = clamp(
    state.factions.CHARTER_COMPANY.standing - goal.companyStandingLoss,
    -100,
    100,
  );

  if (margin < 0) {
    const deficit = Math.max(1, -margin);
    const guardLosses = Math.min(
      guards,
      Math.round(deficit * TUNING.raid.outgoingGuardCasualtyPerMargin * goal.casualtyMult),
    );
    if (guardLosses > 0) {
      expedition.residentEscort ??= {};
      expedition.residentEscort.guards = Math.max(0, guards - guardLosses);
      log.push(`${guardLosses} escort guard${guardLosses === 1 ? '' : 's'} do not come clear of the rout.`);
    }
    for (const hero of party) {
      if (rng.next() < TUNING.raid.heroWoundChance * goal.casualtyMult * 0.5) {
        hero.health = clamp(hero.health - TUNING.raid.heroWoundHealth, 0, TUNING.condition.maxHealth);
        hero.stress = clamp(hero.stress + TUNING.raid.heroWoundStress, 0, TUNING.condition.maxStress);
        if (hero.health === 0 && hero.status === 'active') {
          hero.status = 'dead';
          hero.history.push(`Fell on a raid against ${raid.targetName} in turn ${state.turn}.`);
          log.push(`☠ ${hero.name} falls in the raid on ${raid.targetName}.`);
        } else {
          log.push(`${hero.name} comes away wounded.`);
        }
      }
    }
    log.unshift(`The raid on ${raid.targetName} is beaten off and the party turns for home empty-handed.`);
    log.push(`Word reaches Thornwatch as well. Company standing ${signed(-goal.companyStandingLoss)}.`);
    transitionRaidExpedition(state, expedition, log);
    state.pendingRaid = null;
    return { direction: 'outgoing', outcome: 'drivenOff', log, gameOver: false };
  }

  const silverLoot = Math.max(
    0,
    Math.round(Math.max(1, margin) * TUNING.raid.outgoingSilverPerMargin * goal.lootSilverMult),
  );
  expedition.silver += silverLoot;
  const goodsUnits = Math.max(
    0,
    Math.round(
      TUNING.raid.outgoingGoodsBase * goal.lootGoodsMult +
        Math.max(0, margin) * TUNING.raid.outgoingGoodsPerMargin * goal.lootGoodsMult,
    ),
  );
  const goodsLoot = fillRaidLoot(expedition, goodsUnits, rng);
  const goodsLine = lootSummary(goodsLoot, ctx.goodNames);

  let outcome: RaidResolution['outcome'] =
    goalId === 'cow' ? 'cowed' : goalId === 'bloody' ? 'bloodied' : 'plundered';
  if (goalId === 'cow') {
    setTribute(state, {
      faction: targetFaction,
      direction: 'receive',
      silver: goal.tributeSilver,
      goods: {},
    });
    log.push(`The people of ${raid.targetName} yield and agree to send ${goal.tributeSilver} silver each season.`);
  } else if (goalId === 'burn') {
    log.push(`Fires are left behind in ${raid.targetName}.`);
  }

  const haul = [
    silverLoot > 0 ? `${silverLoot} silver` : '',
    goodsLine,
  ].filter(Boolean).join(' and ');
  log.unshift(
    raid.spotted
      ? `The raid on ${raid.targetName} meets resistance, but the party breaks through.`
      : `The raid on ${raid.targetName} lands cleanly before the alarm can spread.`,
  );
  if (haul) log.push(`The party comes away with ${haul}.`);
  log.push(`Company standing ${signed(-goal.companyStandingLoss)}.`);
  transitionRaidExpedition(state, expedition, log);
  state.pendingRaid = null;
  return { direction: 'outgoing', outcome, log, gameOver: false };
}

function transitionRaidExpedition(
  state: GameState,
  expedition: ExpeditionState,
  log: string[],
): void {
  expedition.heroIds = expedition.heroIds.filter((id) => {
    const hero = state.heroes.find((candidate) => candidate.id === id);
    return hero !== undefined && hero.status === 'active';
  });
  if (expedition.heroIds.length === 0) {
    loseResidentEscort(state, expedition.residentEscort);
    expedition.residentEscort = {};
    expedition.cargo = {};
    expedition.silver = 0;
    state.expeditions = state.expeditions.filter((candidate) => candidate.id !== expedition.id);
    log.push('No one survives to bring the tale home.');
    return;
  }
  expedition.leg = 'returning';
  expedition.turnsLeft = Math.max(1, expedition.legTurns ?? 1);
}

/**
 * Resolves the pending incoming raid against the player's chosen defence.
 * Mutates state (loot, casualties, standing, building damage, the `destroyed`
 * cascade) and clears `state.pendingRaid`. Returns the outcome + log lines.
 */
export function resolveIncomingRaid(
  state: GameState,
  params: RaidDefenseParams,
  rng: Rng,
  ctx: RaidContext,
): RaidResolution {
  const raid = state.pendingRaid;
  const log: string[] = [];
  if (!raid || raid.kind !== 'incoming') {
    return { direction: 'incoming', outcome: 'repelled', log, gameOver: false };
  }
  const r = TUNING.raid;
  const goal = r.defendGoals[params.goal] ?? r.defendGoals.driveoff;

  // Pre-battle rally: a leadership check adds force on success.
  let rallyBonus = 0;
  if (params.rally) {
    const leader = bestAtPost(state, 'leadership');
    if (leader) {
      const stat = bestGoverningStat(leader, 'leadership');
      const check = resolveCheck(rng, leader, 'leadership', stat, r.rallyCheckDifficulty);
      if (isSuccess(check.tier)) {
        rallyBonus = r.rallyForceBonus;
        log.push(`${leader.name} rallies the defenders — ${checkBreakdown(check)}.`);
      } else {
        log.push(`${leader.name} cannot steady the line — ${checkBreakdown(check)}.`);
      }
    }
  }

  const D = defenderForce(state) + rallyBonus + goal.forceMod;
  const A = raid.attackerForce + (raid.spotted ? 0 : r.surpriseForce);
  const mMod = maneuverMod(params.maneuver, raid.attackerManeuver);
  const leaderHero = bestAtPost(state, 'combat');
  const leaderBonus = leaderHero
    ? leaderHero.skills.combat + Math.max(leaderHero.stats.might, leaderHero.stats.agility)
    : 0;
  const d1 = rng.d6();
  const d2 = rng.d6();
  const margin = D + d1 + d2 + leaderBonus + mMod - A;

  const sev = r.severity[raid.severity];
  const spotNote = raid.spotted ? 'The patrols cry the alarm in time.' : 'They are on the wall before the alarm sounds.';

  let outcome: RaidResolution['outcome'];
  if (margin >= r.outcome.repelledMargin) outcome = 'repelled';
  else if (margin <= r.outcome.sackMargin) outcome = 'sacked';
  else outcome = 'held';

  if (outcome === 'repelled') {
    if (goal.bloody) {
      applyAggressorStandingShift(state, raid.faction, -r.bloodyStandingLoss);
      log.push(`${cap(raid.band)} is thrown back with heavy losses. ${spotNote} They will not forget it.`);
    } else {
      applyAggressorStandingShift(state, raid.faction, r.repelStandingGain);
      log.push(`${cap(raid.band)} is driven off. ${spotNote} They melt back into the country empty-handed.`);
    }
    // A sally recovers a little from the field even on a clean win.
    if (goal.recover > 0) {
      const gain = Math.round(A * goal.recover);
      if (gain > 0) {
        state.silver += gain;
        log.push(`The sally strips ${gain} silver of goods from the raiders' baggage.`);
      }
    }
    state.pendingRaid = null;
    return { direction: 'incoming', outcome, log, gameOver: false };
  }

  // A loss: loot is carried off, and blood is spilled.
  const deficit = Math.max(1, -margin);
  const sacked = outcome === 'sacked';
  const intensity = sacked ? 1 : clamp(deficit / 12, 0.2, 0.8);
  const scale = intensity * sev.loot;

  // Silver & goods plundered.
  const silverLost = Math.round(state.silver * r.lootSilverFraction * scale);
  if (silverLost > 0) {
    state.silver = Math.max(0, state.silver - silverLost);
    log.push(`−${silverLost} silver, carried off.`);
  }
  for (const good of r.lootGoods as GoodId[]) {
    const stock = state.goods[good] ?? 0;
    const taken = Math.round(stock * r.lootGoodFraction * scale);
    if (taken > 0) {
      state.goods[good] = Math.max(0, stock - taken);
      log.push(`−${taken} ${ctx.goodNames.get(good) ?? good}.`);
    }
  }

  // Guard casualties.
  const guardsLost = Math.round(deficit * r.guardCasualtyPerMargin * sev.casualtyMult * goal.casualtyMult);
  if (guardsLost > 0) {
    const lost = loseResidents(state, 'guards', guardsLost);
    if (lost > 0) log.push(`${lost} of the post's guards fall defending the wall.`);
  }

  // A sack spills over into the general population and wounds those who stood.
  if (sacked) {
    const extra = loseResidents(state, undefined, Math.max(1, Math.round(deficit * 0.2)));
    if (extra > 0) log.push(`${extra} of the post's people are lost in the sack.`);
    for (const hero of heroesAtPost(state)) {
      if (rng.next() < r.heroWoundChance) {
        hero.health = clamp(hero.health - r.heroWoundHealth, 0, TUNING.condition.maxHealth);
        hero.stress = clamp(hero.stress + r.heroWoundStress, 0, TUNING.condition.maxStress);
        if (hero.health === 0 && hero.status === 'active') {
          hero.status = 'dead';
          hero.history.push(`Fell defending the post in turn ${state.turn}.`);
          log.push(`☠ ${hero.name} falls defending the post.`);
        } else {
          log.push(`${hero.name} is wounded in the fighting.`);
        }
      }
    }
  }

  // Building & construction damage.
  if (state.construction && state.construction.progress > 0) {
    const before = state.construction.progress;
    state.construction.progress = Math.max(0, before - Math.round(r.constructionDamage * scale));
    const lost = before - state.construction.progress;
    if (lost > 0) {
      const name = ctx.buildingNames.get(state.construction.building) ?? state.construction.building;
      log.push(`The works on the ${name} are set back (−${lost} progress).`);
    }
  }
  if (sacked && state.buildings.length > 0 && rng.next() < r.buildingBurnChance) {
    const idx = rng.int(0, state.buildings.length - 1);
    const burned = state.buildings[idx];
    state.buildings.splice(idx, 1);
    log.push(`The ${ctx.buildingNames.get(burned) ?? burned} is put to the torch.`);
  }

  // Standing: a sack emboldens the raiders (they hold the post in contempt).
  if (sacked) applyAggressorStandingShift(state, raid.faction, -r.sackStandingLoss);

  log.unshift(
    sacked
      ? `${cap(raid.band)} overruns the post. ${spotNote}`
      : `${cap(raid.band)} breaks through and takes what it can. ${spotNote}`,
  );

  // The `destroyed` cascade: a hollowed post sacked twice in quick succession.
  let gameOver = false;
  if (sacked) {
    const priorSack = state.lastSackedTurn;
    const d = r.destroyed;
    const wealth = state.silver + stockValue(state, ctx.goodDefs);
    const hollow = residentTotal(state) <= d.residentFloor && wealth <= d.wealthFloor;
    const recentPriorSack = priorSack > 0 && state.turn - priorSack <= d.cascadeWindow;
    state.lastSackedTurn = state.turn;
    if (hollow && recentPriorSack) {
      declareDestroyed(state);
      gameOver = true;
    }
  }

  state.pendingRaid = null;
  return { direction: 'incoming', outcome, log, gameOver };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
