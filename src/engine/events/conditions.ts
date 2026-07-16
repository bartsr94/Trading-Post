import { livingHeroes, seasonOfTurn } from '../types';
import type { GameState } from '../types';
import type { Condition } from './types';

export function evalCondition(state: GameState, cond: Condition): boolean {
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
  }
}

export function evalConditions(state: GameState, conds: readonly Condition[]): boolean {
  return conds.every((c) => evalCondition(state, c));
}
