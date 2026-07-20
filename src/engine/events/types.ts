// Event data model (spec §9). Content files export GameEvent constants;
// the engine only ever consumes them.

import type {
  AxisId,
  BuildingId,
  DependantKind,
  DiscoveryState,
  ExpeditionKind,
  ExpeditionState,
  FactionId,
  GameState,
  Gender,
  GoodId,
  Heritage,
  HeritageGroup,
  LocationDef,
  LocationId,
  ResidentRole,
  Season,
  SkillId,
  StatId,
  TraitId,
  TransientKind,
  UnionSource,
} from '../types';

/** Present while evaluating travel events: the expedition they happen to. */
export interface TravelContext {
  expedition: ExpeditionState;
  destination: LocationDef;
}

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
  | { type: 'partySizeAtLeast'; value: number }
  | { type: 'rosterAtLeast'; scope: 'active' | 'reserve' | 'living'; value: number }
  | { type: 'rosterBelow'; scope: 'active' | 'reserve' | 'living'; value: number }
  | { type: 'heroHasSpouse'; heroId?: string }
  | { type: 'heroUnmarried'; heroId?: string }
  | { type: 'residentsAtLeast'; role?: ResidentRole; value: number }
  | { type: 'residentsBelow'; role?: ResidentRole; value: number }
  | { type: 'contentmentAtLeast'; value: number }
  | { type: 'contentmentAtMost'; value: number }
  | { type: 'nativeShareAtLeast'; value: number }
  | { type: 'nativeShareAtMost'; value: number }
  | { type: 'heritageCountAtLeast'; group: HeritageGroup; value: number }
  | { type: 'heroHeritageInParty'; heritage: Heritage }
  | { type: 'postTierAtLeast'; value: number }
  | { type: 'postTierAtMost'; value: number }
  | { type: 'hasBuilding'; building: BuildingId }
  | { type: 'lacksBuilding'; building: BuildingId }
  | { type: 'constructionActive'; value: boolean }
  | { type: 'canAdvanceTier' }
  | { type: 'locationDiscovery'; location: LocationId; atLeast: DiscoveryState }
  // Travel-only conditions (false outside an expedition context):
  | { type: 'expeditionKind'; kind: ExpeditionKind }
  | { type: 'expeditionLeg'; leg: 'outbound' | 'returning' }
  | { type: 'destinationIs'; location: LocationId }
  | { type: 'destinationTag'; tag: string }
  | { type: 'cargoUnitsAtLeast'; qty: number };

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
  | {
      type: 'addResidents';
      role: ResidentRole | 'idle';
      count: number;
      tag?: string;
      group?: HeritageGroup;
    }
  | { type: 'loseResidents'; role?: ResidentRole; count: number; group?: HeritageGroup }
  | { type: 'contentment'; delta: number }
  | { type: 'addTransient'; kind: TransientKind; count: number; turns: number }
  | { type: 'advanceTier' }
  | { type: 'completeBuilding'; building: BuildingId }
  | { type: 'addBuildProgress'; delta: number }
  | { type: 'heroDeparts' }
  /** Recruit a named character from a template (CHARACTERS_SPEC.md §6). */
  | { type: 'recruitCharacter'; templateId: string; toActive?: boolean }
  /** A named character leaves the frontier; defaults to the bound hero. */
  | { type: 'departCharacter'; heroId?: string }
  /** Add a family member (FAMILY_SPEC.md §9). parentId/otherParentId default to
   *  the bound hero; unset heritage/gender resolve from parents + union rules. */
  | {
      type: 'addDependant';
      kind: DependantKind;
      parentId?: string;
      otherParentId?: string;
      union?: UnionSource;
      heritage?: Heritage;
      gender?: Gender;
    }
  | { type: 'removeDependant'; parentId?: string; kind?: DependantKind; dependantId?: string }
  /** Form a union for a subject (defaults to the bound hero): spouse + bloodline
   *  + culture nudge + union trait (FAMILY_SPEC.md §9). */
  | { type: 'formUnion'; subjectId?: string; source: UnionSource; heritage?: Heritage }
  /** A child comes of age (FAMILY_SPEC.md §7); grown kin by default. */
  | { type: 'comeOfAge'; dependantId: string; promoteToRecruit?: boolean }
  | { type: 'history'; text: string }
  /** Advance a location's discovery (default: the expedition's destination). */
  | { type: 'discover'; location?: LocationId; to?: DiscoveryState }
  // Travel-only outcomes (fall back to post stock/silver outside an expedition):
  | { type: 'cargo'; good: GoodId; delta: number }
  | { type: 'expeditionSilver'; delta: number }
  | { type: 'delayExpedition'; turns: number };

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
