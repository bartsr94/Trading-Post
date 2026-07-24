import { activeHeroes, discoveryAtLeast, livingHeroes, reserveHeroes, seasonOfTurn } from '../types';
import { canAdvanceTier, hasBuilding } from '../buildings';
import { isOverClaim } from '../claim';
import { cargoUnits } from '../expeditions';
import { eligiblePartners, isMarried } from '../family';
import { diplomacySeatStateById } from '../diplomacy';
import { frictionFor, heritageCount, nativeShare, postDefense, residentCount } from '../residents';
import { raidThreatActive } from '../raids';
import { thrallCount } from '../thralls';
import type { ChainVars, GameState } from '../types';
import type { Condition, TravelContext } from './types';

export interface ConditionContext {
  /** The event's candidate/bound hero for implicit hero-scoped predicates. */
  heroId?: string;
  travel?: TravelContext;
  /** Chain-scoped branch memory from the in-flight event (CHAIN_EVENTS_SPEC.md §3). */
  chainVars?: ChainVars;
}

export function evalCondition(
  state: GameState,
  cond: Condition,
  ctx: ConditionContext = {},
): boolean {
  switch (cond.type) {
    case 'minTurn':
      return state.turn >= cond.value;
    case 'maxTurn':
      return state.turn <= cond.value;
    case 'season':
      return seasonOfTurn(state.turn) === cond.value;
    case 'silverAtLeast':
      return state.silver >= cond.value;
    case 'silverBelow':
      return state.silver < cond.value;
    case 'goodAtLeast':
      return state.goods[cond.good] >= cond.qty;
    case 'goodBelow':
      return state.goods[cond.good] < cond.qty;
    case 'heroInParty':
      return activeHeroes(state).some((h) => h.id === cond.heroId);
    case 'heroWithTrait':
      return livingHeroes(state).some((h) => h.traits.includes(cond.trait));
    case 'anyHeroStressAtLeast':
      return livingHeroes(state).some((h) => h.stress >= cond.value);
    case 'anyHeroSkillAtLeast':
      return livingHeroes(state).some((h) => h.skills[cond.skill] >= cond.value);
    case 'standingAtLeast':
      return state.factions[cond.faction].standing >= cond.value;
    case 'standingAtMost':
      return state.factions[cond.faction].standing <= cond.value;
    case 'communityStandingAtLeast':
      return (diplomacySeatStateById(state, cond.location)?.standing ?? 0) >= cond.value;
    case 'communityStandingAtMost':
      return (diplomacySeatStateById(state, cond.location)?.standing ?? 0) <= cond.value;
    case 'communityGrievanceAtLeast':
      return (diplomacySeatStateById(state, cond.location)?.grievances ?? 0) >= cond.value;
    case 'communityGrievanceAtMost':
      return (diplomacySeatStateById(state, cond.location)?.grievances ?? 0) <= cond.value;
    case 'communityPactIs':
      return (diplomacySeatStateById(state, cond.location)?.pact ?? 'none') === cond.pact;
    case 'axisAtLeast':
      return state.axes[cond.axis] >= cond.value;
    case 'axisAtMost':
      return state.axes[cond.axis] <= cond.value;
    case 'flag':
      return state.flags[cond.flag] === true;
    case 'notFlag':
      return state.flags[cond.flag] !== true;
    case 'partySizeAtLeast':
      return activeHeroes(state).length >= cond.value;
    case 'rosterAtLeast':
      return rosterCount(state, cond.scope) >= cond.value;
    case 'rosterBelow':
      return rosterCount(state, cond.scope) < cond.value;
    case 'heroHasSpouse':
      return (cond.heroId ?? ctx.heroId) !== undefined
        ? isMarried(state, (cond.heroId ?? ctx.heroId)!)
        : false;
    case 'heroUnmarried':
      return (cond.heroId ?? ctx.heroId) !== undefined
        ? !isMarried(state, (cond.heroId ?? ctx.heroId)!)
        : false;
    case 'heroGender': {
      const heroId = cond.heroId ?? ctx.heroId;
      if (heroId === undefined) return false;
      const hero = state.heroes.find((h) => h.id === heroId);
      return hero !== undefined && hero.gender === cond.gender;
    }
    case 'partnerAvailable': {
      const heroId = cond.heroId ?? ctx.heroId;
      return heroId !== undefined && eligiblePartners(state, heroId).length > 0;
    }
    case 'residentsAtLeast':
      return residentCount(state, cond.role) >= cond.value;
    case 'residentsBelow':
      return residentCount(state, cond.role) < cond.value;
    case 'contentmentAtLeast':
      return state.residents.contentment >= cond.value;
    case 'contentmentAtMost':
      return state.residents.contentment <= cond.value;
    case 'thrallsAtLeast':
      return thrallCount(state, cond.role) >= cond.value;
    case 'thrallsBelow':
      return thrallCount(state, cond.role) < cond.value;
    case 'thrallRestivenessAtLeast':
      return state.thralls.restiveness >= cond.value;
    case 'thrallRestivenessAtMost':
      return state.thralls.restiveness <= cond.value;
    case 'frictionAtLeast':
      return frictionFor(state, cond.heritage) >= cond.value;
    case 'frictionAtMost':
      return frictionFor(state, cond.heritage) <= cond.value;
    case 'residentTagAtLeast':
      return (state.residents.tags[cond.tag] ?? 0) >= cond.value;
    case 'nativeShareAtLeast':
      return nativeShare(state) >= cond.value;
    case 'nativeShareAtMost':
      return nativeShare(state) <= cond.value;
    case 'claimAtLeast':
      return state.claim.size >= cond.value;
    case 'claimBelow':
      return state.claim.size < cond.value;
    case 'herdAtLeast':
      return state.herd.count >= cond.value;
    case 'overClaim':
      return isOverClaim(state);
    case 'heritageCountAtLeast':
      return heritageCount(state, cond.group) >= cond.value;
    case 'heroHeritageInParty':
      return activeHeroes(state).some((h) => h.heritage === cond.heritage);
    case 'postTierAtLeast':
      return state.postTier >= cond.value;
    case 'postTierAtMost':
      return state.postTier <= cond.value;
    case 'postDefenseAtLeast':
      return postDefense(state) >= cond.value;
    case 'postDefenseAtMost':
      return postDefense(state) <= cond.value;
    case 'raidReady':
      return raidThreatActive(state);
    case 'raidedRecently':
      return state.lastSackedTurn > 0 && state.turn - state.lastSackedTurn <= cond.turns;
    case 'hasBuilding':
      return hasBuilding(state, cond.building);
    case 'lacksBuilding':
      return !hasBuilding(state, cond.building);
    case 'constructionActive':
      return (state.construction !== null) === cond.value;
    case 'canAdvanceTier':
      return canAdvanceTier(state);
    case 'locationDiscovery': {
      const loc = state.locations[cond.location];
      return loc !== undefined && discoveryAtLeast(loc.discovery, cond.atLeast);
    }
    case 'chainVar':
      return ctx.chainVars?.[cond.key] === cond.value;
    case 'expeditionKind':
      return ctx.travel !== undefined && ctx.travel.expedition.kind === cond.kind;
    case 'expeditionLeg':
      return ctx.travel !== undefined && ctx.travel.expedition.leg === cond.leg;
    case 'destinationIs':
      return ctx.travel !== undefined && ctx.travel.destination.locationId === cond.location;
    case 'destinationTag':
      return ctx.travel !== undefined && ctx.travel.destination.tags.includes(cond.tag);
    case 'cargoUnitsAtLeast':
      return ctx.travel !== undefined && cargoUnits(ctx.travel.expedition.cargo) >= cond.qty;
  }
}

function rosterCount(state: GameState, scope: 'active' | 'reserve' | 'living'): number {
  switch (scope) {
    case 'active':
      return activeHeroes(state).length;
    case 'reserve':
      return reserveHeroes(state).length;
    case 'living':
      return livingHeroes(state).length;
  }
}

export function evalConditions(
  state: GameState,
  conds: readonly Condition[],
  ctx: ConditionContext = {},
): boolean {
  return conds.every((c) => evalCondition(state, c, ctx));
}
