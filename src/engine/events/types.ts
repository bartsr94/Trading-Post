// Event data model (spec §9). Content files export GameEvent constants;
// the engine only ever consumes them.

import type {
  AxisId,
  FactionId,
  GameState,
  GoodId,
  Season,
  SkillId,
  StatId,
  TraitId,
} from '../types';

export type EventCategory = 'post' | 'travel' | 'faction' | 'hero' | 'season' | 'chain';

// ---------- Conditions (world-state predicates gating eligibility) ----------

export type Condition =
  | { type: 'minTurn'; value: number }
  | { type: 'maxTurn'; value: number }
  | { type: 'season'; value: Season }
  | { type: 'silverAtLeast'; value: number }
  | { type: 'silverBelow'; value: number }
  | { type: 'goodAtLeast'; good: GoodId; qty: number }
  | { type: 'goodBelow'; good: GoodId; qty: number }
  | { type: 'heroInParty'; heroId: string }
  | { type: 'heroWithTrait'; trait: TraitId }
  | { type: 'anyHeroStressAtLeast'; value: number }
  | { type: 'anyHeroSkillAtLeast'; skill: SkillId; value: number }
  | { type: 'standingAtLeast'; faction: FactionId; value: number }
  | { type: 'standingAtMost'; faction: FactionId; value: number }
  | { type: 'axisAtLeast'; axis: AxisId; value: number }
  | { type: 'axisAtMost'; axis: AxisId; value: number }
  | { type: 'flag'; flag: string }
  | { type: 'notFlag'; flag: string }
  | { type: 'partySizeAtLeast'; value: number };

// ---------- Hero binding (which hero the event features) ----------

export type HeroBinding =
  | { type: 'random' }
  | { type: 'highestSkill'; skill: SkillId }
  | { type: 'lowestSkill'; skill: SkillId }
  | { type: 'highestStat'; stat: StatId }
  | { type: 'withTrait'; trait: TraitId }
  | { type: 'withoutTrait'; trait: TraitId }
  | { type: 'highestStress' }
  | { type: 'specific'; heroId: string };

// ---------- Outcomes (typed effects) ----------

export type Outcome =
  | { type: 'silver'; delta: number }
  | { type: 'good'; good: GoodId; delta: number }
  | { type: 'standing'; faction: FactionId; delta: number }
  | { type: 'axis'; axis: AxisId; delta: number }
  | { type: 'addTrait'; trait: TraitId }
  | { type: 'removeTrait'; trait: TraitId }
  | { type: 'health'; delta: number }
  | { type: 'stress'; delta: number; allHeroes?: boolean }
  | { type: 'queueEvent'; eventId: string; delayTurns: number; sameHero?: boolean }
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'priceShock'; good: GoodId; mod: number }
  | { type: 'heroDeparts' }
  | { type: 'history'; text: string };

/** Narrative text + effects for one result tier. */
export interface TierResult {
  text: string;
  outcomes: Outcome[];
}

export interface EventCheck {
  skill: SkillId;
  stat: StatId;
  difficulty: number | ((state: GameState) => number);
  /** Tags matched against trait check-modifiers, e.g. 'strangers', 'intimidation'. */
  tags?: string[];
}

export interface Choice {
  label: string;
  /** Unmet requirements show the choice locked. */
  requires?: Condition[];
  check?: EventCheck;
  outcomes: {
    critSuccess?: TierResult;
    success: TierResult;
    failure?: TierResult;
    critFailure?: TierResult;
  };
}

export interface GameEvent {
  id: string;
  category: EventCategory;
  illustration: string; // asset key; flat placeholder panels in v1
  title: string;
  /** Body text; supports {hero} and {post} interpolation. */
  text: string;
  conditions: Condition[];
  weight: number | ((state: GameState) => number);
  once?: boolean;
  cooldownTurns?: number;
  binding?: HeroBinding;
  choices: Choice[];
}
