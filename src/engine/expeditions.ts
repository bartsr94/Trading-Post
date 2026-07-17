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
import { priceAt } from './economy';
import type { GoodDef } from './economy';
import { Rng } from './rng';
import {
  awayHeroIds,
  clamp,
  discoveryAtLeast,
  getHero,
  nextDiscovery,
} from './types';
import type {
  ExpeditionKind,
  ExpeditionState,
  GameState,
  GoodId,
  Hero,
  LocationDef,
  LocationId,
  SkillId,
  TraitDef,
} from './types';

/** The slice of TurnContext expedition resolution needs. */
export interface ExpeditionContext {
  goodDefs: ReadonlyMap<GoodId, GoodDef>;
  traitDefs: ReadonlyMap<string, TraitDef>;
  goodNames: ReadonlyMap<GoodId, string>;
  locationDefs: ReadonlyMap<LocationId, LocationDef>;
}

export interface DispatchParams {
  kind: ExpeditionKind;
  destination: LocationId;
  heroIds: string[];
  cargo?: Partial<Record<GoodId, number>>;
  silver?: number;
  buyOrders?: Partial<Record<GoodId, number>>;
}

export function cargoUnits(cargo: Partial<Record<GoodId, number>>): number {
  return Object.values(cargo).reduce((sum: number, qty) => sum + (qty ?? 0), 0);
}

export function cargoCapacity(heroCount: number): number {
  return heroCount * TUNING.map.cargoCapacityPerHero;
}

/** Why this dispatch is invalid, or null when it may proceed. */
export function dispatchError(
  state: GameState,
  params: DispatchParams,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
): string | null {
  const def = locationDefs.get(params.destination);
  if (!def) return 'Unknown destination.';
  if (def.id === TUNING.map.homeLocationId) return 'The party is already there.';

  const { heroIds } = params;
  if (heroIds.length < 1) return 'Someone has to go.';
  if (heroIds.length > TUNING.map.maxExpeditionHeroes) {
    return `At most ${TUNING.map.maxExpeditionHeroes} heroes per expedition.`;
  }
  const away = awayHeroIds(state);
  for (const heroId of heroIds) {
    const hero = state.heroes.find((h) => h.id === heroId);
    if (!hero || hero.status !== 'active') return 'That hero cannot travel.';
    if (away.has(heroId)) return `${hero.name} is already away.`;
  }

  const discovery = state.locations[def.id]?.discovery ?? def.initialDiscovery;
  if (params.kind === 'explore') {
    if (!discoveryAtLeast(discovery, 'rumored')) return 'You have heard of no such place.';
    if (discovery === 'known') return 'There is nothing left to learn there.';
  } else if (params.kind === 'diplomacy') {
    if (!def.faction) return 'There is no one there to treat with.';
    if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way there yet.';
  } else {
    if (!def.hasMarket) return 'There is no market there.';
    if (!discoveryAtLeast(discovery, 'visited')) return 'No one knows the way to that market yet.';
  }

  const cargo = params.cargo ?? {};
  if (cargoUnits(cargo) > cargoCapacity(heroIds.length)) return 'The party cannot carry that much.';
  for (const [good, qty] of Object.entries(cargo) as [GoodId, number][]) {
    if (qty < 0 || !Number.isInteger(qty)) return 'Invalid cargo.';
    if ((state.goods[good] ?? 0) < qty) return 'Not enough stock for that cargo.';
  }
  const silver = params.silver ?? 0;
  if (silver < 0 || !Number.isInteger(silver)) return 'Invalid silver.';
  if (state.silver < silver) return 'Not enough silver on hand.';

  return null;
}

/** Applies a validated dispatch. Returns false (untouched state) if invalid. */
export function dispatchExpedition(
  state: GameState,
  params: DispatchParams,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
): boolean {
  if (dispatchError(state, params, locationDefs) !== null) return false;
  const def = locationDefs.get(params.destination);
  if (!def) return false;

  const cargo: Partial<Record<GoodId, number>> = {};
  for (const [good, qty] of Object.entries(params.cargo ?? {}) as [GoodId, number][]) {
    if (qty <= 0) continue;
    state.goods[good] -= qty;
    cargo[good] = qty;
  }
  const silver = params.silver ?? 0;
  state.silver -= silver;

  state.expeditions.push({
    id: `exp_${state.nextExpeditionId}`,
    kind: params.kind,
    destination: def.id,
    heroIds: [...params.heroIds],
    leg: 'outbound',
    turnsLeft: Math.max(1, def.travelTurns),
    cargo,
    silver,
    buyOrders: { ...(params.buyOrders ?? {}) },
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
    const def = ctx.locationDefs.get(exp.destination);
    if (!def) {
      finished.push(exp.id);
      continue;
    }

    // A party with no one left standing never comes home.
    exp.heroIds = exp.heroIds.filter((id) => {
      const hero = state.heroes.find((h) => h.id === id);
      return hero !== undefined && hero.status === 'active';
    });
    if (exp.heroIds.length === 0) {
      report('🕯️', `No one returns from the ${def.name} ${exp.kind}. The cargo is lost with them.`);
      finished.push(exp.id);
      continue;
    }

    exp.turnsLeft -= 1;
    const names = partyNames(state, exp);

    if (exp.turnsLeft > 0) {
      report(
        '🧭',
        exp.leg === 'outbound'
          ? `${names}: ${exp.turnsLeft} turn${exp.turnsLeft === 1 ? '' : 's'} from ${def.name}.`
          : `${names}: ${exp.turnsLeft} turn${exp.turnsLeft === 1 ? '' : 's'} from home.`,
      );
      continue;
    }

    if (exp.leg === 'outbound') {
      if (exp.kind === 'caravan') resolveCaravanArrival(state, ctx, exp, def, rng, report);
      else if (exp.kind === 'explore') resolveExploreArrival(state, ctx, exp, def, rng, report);
      else resolveDiplomacyArrival(state, ctx, exp, def, rng, report);
      exp.leg = 'returning';
      exp.turnsLeft = Math.max(1, def.travelTurns);
    } else {
      resolveHomecoming(state, ctx, exp, def, report);
      finished.push(exp.id);
    }
  }

  state.expeditions = state.expeditions.filter((e) => !finished.includes(e.id));
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
  const mods = traitModifiers(hero, ctx.traitDefs, 'bargain', tags);
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
  let capacityLeft = cargoCapacity(exp.heroIds.length);
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
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const hero = leadHero(state, exp, 'survival');
  const tags = ['exploration', ...def.tags];
  const mods = traitModifiers(hero, ctx.traitDefs, 'survival', tags);
  const stat = bestGoverningStat(hero, 'survival');
  const check = resolveCheck(rng, hero, 'survival', stat, TUNING.map.exploreCheckDifficulty, mods);

  const loc = state.locations[def.id];
  if (isSuccess(check.tier)) {
    markSkill(hero, 'survival');
    const steps = check.tier === 'critSuccess' ? 2 : 1;
    for (let i = 0; i < steps; i++) loc.discovery = nextDiscovery(loc.discovery);
    if (discoveryAtLeast(loc.discovery, 'visited')) spreadRumors(state, def, ctx.locationDefs);
    report(
      '🗺️',
      `${hero.name} scouts ${def.name}: ${checkBreakdown(check)}. It is now ${loc.discovery}.`,
    );
    for (const id of exp.heroIds) {
      getHero(state, id).history.push(`Explored ${def.name} (turn ${state.turn}).`);
    }
  } else {
    const stressGain = check.tier === 'critFailure' ? 2 : 1;
    for (const id of exp.heroIds) {
      const h = getHero(state, id);
      h.stress = clamp(h.stress + stressGain, 0, TUNING.condition.maxStress);
      if (check.tier === 'critFailure') {
        h.health = clamp(h.health - 1, 0, TUNING.condition.maxHealth);
      }
    }
    report(
      '🗺️',
      `${hero.name} scouts ${def.name}: ${checkBreakdown(check)}. Bad ground and worse weather — the party learns little.`,
    );
  }
}

function resolveDiplomacyArrival(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const dip = TUNING.diplomacy;
  const hero = leadHero(state, exp, 'diplomacy');
  const tags = ['diplomacy', ...def.tags, ...(def.faction ? [def.faction] : [])];
  const mods = traitModifiers(hero, ctx.traitDefs, 'diplomacy', tags);
  const stat = bestGoverningStat(hero, 'diplomacy');
  const check = resolveCheck(rng, hero, 'diplomacy', stat, dip.expeditionCheckDifficulty, mods);
  if (isSuccess(check.tier)) markSkill(hero, 'diplomacy');

  let delta = 0;
  if (check.tier === 'critSuccess') delta = dip.expeditionStandingGainCrit;
  else if (check.tier === 'success') delta = dip.expeditionStandingGainSuccess;
  else if (check.tier === 'failure') delta = -dip.expeditionStandingLossFailure;
  else delta = -dip.expeditionStandingLossCritFailure;

  if (def.faction) {
    const faction = state.factions[def.faction];
    faction.standing = clamp(faction.standing + delta, -100, 100);
  }

  if (!isSuccess(check.tier)) {
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
      `Standing ${delta >= 0 ? '+' : ''}${delta}.`,
  );
}

/** Word of neighbouring places reaches the party once a node is truly visited. */
function spreadRumors(
  state: GameState,
  def: LocationDef,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
): void {
  for (const neighborId of def.connections) {
    if (!locationDefs.has(neighborId)) continue;
    const neighbor = state.locations[neighborId];
    if (neighbor && neighbor.discovery === 'unknown') neighbor.discovery = 'rumored';
  }
}

function resolveHomecoming(
  state: GameState,
  ctx: ExpeditionContext,
  exp: ExpeditionState,
  def: LocationDef,
  report: (icon: string, text: string) => void,
): void {
  state.silver += exp.silver;
  const goodsBrought: string[] = [];
  for (const [good, qty] of Object.entries(exp.cargo) as [GoodId, number][]) {
    if (!qty) continue;
    state.goods[good] = (state.goods[good] ?? 0) + qty;
    goodsBrought.push(`${qty} ${ctx.goodNames.get(good) ?? good}`);
  }

  const haul: string[] = [];
  if (exp.silver > 0) haul.push(`${exp.silver} silver`);
  if (goodsBrought.length > 0) haul.push(goodsBrought.join(', '));
  const tail =
    haul.length > 0 ? ` with ${haul.join(' and ')}.` : exp.kind === 'diplomacy' ? '.' : ' with empty hands.';
  report(
    '🏠',
    `${partyNames(state, exp)} return${exp.heroIds.length === 1 ? 's' : ''} from ${def.name}${tail}`,
  );
}
