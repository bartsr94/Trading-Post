import { discoveryAtLeast, livingHeroes, seasonOfTurn } from '../types';
import { cargoUnits } from '../expeditions';
import type { GameState } from '../types';
import type { Condition, TravelContext } from './types';

export function evalCondition(
  state: GameState,
  cond: Condition,
  travel?: TravelContext,
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
      return livingHeroes(state).some((h) => h.id === cond.heroId);
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
    case 'axisAtLeast':
      return state.axes[cond.axis] >= cond.value;
    case 'axisAtMost':
      return state.axes[cond.axis] <= cond.value;
    case 'flag':
      return state.flags[cond.flag] === true;
    case 'notFlag':
      return state.flags[cond.flag] !== true;
    case 'partySizeAtLeast':
      return livingHeroes(state).length >= cond.value;
    case 'locationDiscovery': {
      const loc = state.locations[cond.location];
      return loc !== undefined && discoveryAtLeast(loc.discovery, cond.atLeast);
    }
    case 'expeditionKind':
      return travel !== undefined && travel.expedition.kind === cond.kind;
    case 'expeditionLeg':
      return travel !== undefined && travel.expedition.leg === cond.leg;
    case 'destinationIs':
      return travel !== undefined && travel.destination.id === cond.location;
    case 'destinationTag':
      return travel !== undefined && travel.destination.tags.includes(cond.tag);
    case 'cargoUnitsAtLeast':
      return travel !== undefined && cargoUnits(travel.expedition.cargo) >= cond.qty;
  }
}

export function evalConditions(
  state: GameState,
  conds: readonly Condition[],
  travel?: TravelContext,
): boolean {
  return conds.every((c) => evalCondition(state, c, travel));
}
