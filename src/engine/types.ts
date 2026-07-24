// Core shared types for the engine. Pure — no React or DOM; tuning is the only
// permitted content dependency.

import { TUNING } from '../content/tuning';

export const STAT_IDS = ['might', 'agility', 'wits', 'charm', 'resolve'] as const;
export type StatId = (typeof STAT_IDS)[number];

export const SKILL_IDS = [
  'bargain',
  'diplomacy',
  'combat',
  'survival',
  'leadership',
  'lore',
  'craft',
  'stealth',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/** Stats that may govern each skill; an event's check names which one applies. */
export const SKILL_GOVERNING: Record<SkillId, StatId[]> = {
  bargain: ['charm', 'wits'],
  diplomacy: ['charm'],
  combat: ['might', 'agility'],
  survival: ['wits', 'agility'],
  leadership: ['charm', 'resolve'],
  lore: ['wits'],
  craft: ['wits', 'might'],
  stealth: ['agility', 'wits'],
};

export const GOOD_IDS = [
  'furs',
  'hides',
  'grain',
  'salt',
  'tools',
  'cloth',
  'timber',
  'amber',
  'herbs',
] as const;
export type GoodId = (typeof GOOD_IDS)[number];

export const FACTION_IDS = [
  'RIVER_CLANS',
  'HILL_TRIBES',
  'OLD_PEOPLE',
  'CHARTER_COMPANY',
  'KNIGHTS_EIRWEN',
  'BEASTFOLK',
] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export const DIPLOMACY_PACTS = ['none', 'alliance', 'truce'] as const;
export type DiplomacyPact = (typeof DIPLOMACY_PACTS)[number];

export const DIPLOMACY_MISSION_TYPES = ['talks', 'gift', 'alliance', 'peace', 'tribute', 'ransom'] as const;
export type DiplomacyMissionType = (typeof DIPLOMACY_MISSION_TYPES)[number];

export const DIPLOMACY_TRIBUTE_MODES = ['offer', 'demand_end', 'demand_continue'] as const;
export type DiplomacyTributeMode = (typeof DIPLOMACY_TRIBUTE_MODES)[number];

export interface DiplomacySeatState {
  faction: FactionId;
  standing: number; // -100..+100
  grievances: number;
  pact: DiplomacyPact;
  lastContactTurn: number;
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

// Aloof(−)↔Integrated(+), Mercantile(−)↔Communal(+), Homeland/Imanian(−)↔Frontier/Sauromatian(+)
export const AXIS_IDS = ['integration', 'communal', 'culture'] as const;
export type AxisId = (typeof AXIS_IDS)[number];

/** Peoples of the Ashmark (PEOPLES_SPEC.md §2) — the two-tier "people" level.
 *  Promoted to a mechanical type carried by named people & the resident tally.
 *  `imanian` = the Company's homeland folk; everyone else (Kiswani, Hanjoda,
 *  Weri, and — BEASTFOLK_SPEC.md — Orcs/Goblins) is native — anything not
 *  Imanian is suspect to the Company. The tribe/region (Dustwalker/Sunspear/
 *  Redsand; Tributary/Bejasi Hills) is the separate free-form `subPeople`
 *  flavor, not an enum the engine branches on. Orcs and Goblins are distinct
 *  *species* (not sub-tribes of one people), so they get their own values
 *  here rather than a shared `beastfolk` value + subPeople. */
export const HERITAGES = ['imanian', 'kiswani', 'hanjoda', 'weri', 'orc', 'goblin'] as const;
export type Heritage = (typeof HERITAGES)[number];

/** The coarse origin split the culture axis & Company care about. */
export type HeritageGroup = 'homeland' | 'native';

export function heritageGroup(h: Heritage): HeritageGroup {
  return h === 'imanian' ? 'homeland' : 'native';
}

export function isNativeHeritage(h: Heritage): boolean {
  return h !== 'imanian';
}

/** Orcs and goblins don't hybridize with other peoples — any union involving
 *  one always produces pure offspring of that people (`childAncestry`/
 *  `childGender` in `family.ts` special-case this). */
export function isMatrilinealPure(h: Heritage): boolean {
  return h === 'orc' || h === 'goblin';
}

/** The per-people default tribe/region when a `subPeople` is unset (PEOPLES_SPEC.md §2). */
export function defaultSubPeople(h: Heritage): string {
  switch (h) {
    case 'imanian':
      return 'ansberrian';
    case 'kiswani':
      return 'tributary';
    case 'hanjoda':
      return 'dustwalker';
    case 'weri':
      return 'weri';
    case 'orc':
      return 'orc';
    case 'goblin':
      return 'goblin';
  }
}

/** A named person's gender (FAMILY_SPEC.md §3.1). Drives marriage, child gender,
 *  and the bloodline read — mechanical, so it rides the runtime Hero (like
 *  heritage), not just the content-only portraitKey. */
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const BLOODLINES = ['pure', 'mixed'] as const;
export type Bloodline = (typeof BLOODLINES)[number];

export function oppositeGender(g: Gender): Gender {
  return g === 'male' ? 'female' : 'male';
}

/** How a union was formed (FAMILY_SPEC.md §2.2). Set on the spouse record.
 *  'party' is two heroes already at the post marrying each other
 *  (FAMILY_PHASE_D_SPEC.md §2) — no new Dependant is created for it, so it
 *  never actually appears on a spouse *record*, only in `unionCultureNudge`. */
export type UnionSource = 'homeland' | 'alliance' | 'informal' | 'party';

/** A named person's descent (FAMILY_SPEC.md §3.3). One people = a pure line;
 *  two or more = mixed. Only dependants carry this; heroes stay single-heritage. */
export interface Ancestry {
  /** The peoples this person descends from, deduped, dominant-first. */
  peoples: Heritage[];
}

export const ACTIVITY_IDS = [
  'trade',
  'explore',
  'diplomacy',
  'build',
  'provision',
  'rest',
  'unassigned',
] as const;
export type ActivityId = (typeof ACTIVITY_IDS)[number];

export type TraitId = string; // trait ids are defined by content

export type LocationId = string; // location ids are defined by content

/** Unnamed-population roles (RESIDENTS_SPEC.md §2; herders/hunters added by
 *  TULA_SETTLEMENT_SPEC.md §3 to work pasture/wildland). */
export const RESIDENT_ROLES = [
  'farmers',
  'porters',
  'guards',
  'craftsfolk',
  'herders',
  'hunters',
] as const;
export type ResidentRole = (typeof RESIDENT_ROLES)[number];

/** The three ways the Concession's land can be put to use (TULA_SETTLEMENT_SPEC.md §2.2). */
export const LAND_USES = ['cropland', 'pasture', 'wildland'] as const;
export type LandUse = (typeof LAND_USES)[number];

/** How lavish an Invite Settlers offer is — raises turnout and cost (§5.1). */
export const INVITE_OFFERS = ['modest', 'generous', 'lavish'] as const;
export type InviteOffer = (typeof INVITE_OFFERS)[number];

/**
 * The Concession — land the Charter Company has ceded the post to settle
 * (TULA_SETTLEMENT_SPEC.md §2). Measured in chains; supports a population
 * without resistance but is a soft threshold, not a hard cap. The engine field
 * stays `claim`; the in-fiction display term is "the Concession".
 */
export interface ClaimState {
  /** Total chains under claim; grows only via a successful Negotiate Land run. */
  size: number;
  /** % of `size` given to each use; sums to 100. Player-adjustable between turns. */
  allocation: Record<LandUse, number>;
  /** Accrues farmer effort each turn; converts to a Food harvest at season end. */
  cropProgress: number;
  /** People whose land was most recently negotiated — the over-Concession
   *  standing target (§2.1). Unset until the first successful Negotiate Land run. */
  landholder?: FactionId;
}

/** The post's abstracted livestock, tended by herders (TULA_SETTLEMENT_SPEC.md §4.2). */
export interface HerdState {
  count: number;
}

/** Transient outsiders we neither feed nor pay (RESIDENTS_SPEC.md §3, Phase B). */
export const TRANSIENT_KINDS = [
  'visitorGuards',
  'companyAgents',
  'supplierCrew',
  'beastfolkVisitors',
] as const;
export type TransientKind = (typeof TRANSIENT_KINDS)[number];

export const DISCOVERY_STATES = ['unknown', 'rumored', 'visited', 'known'] as const;
export type DiscoveryState = (typeof DISCOVERY_STATES)[number];

/** Normalized point on the 4:3 Ashmark map. */
export interface MapPoint {
  x: number;
  y: number;
}

export type MapRegionId = string;

/** Monotonic checkpoint which can make a map region reachable. */
export type MapAccessRequirement =
  | { type: 'flag'; flag: string }
  | { type: 'postTierAtLeast'; tier: number }
  | { type: 'locationDiscovery'; location: LocationId; atLeast: DiscoveryState };

/** Authored access zone. Instances live in content/map.ts. */
export interface MapRegionDef {
  id: MapRegionId;
  name: string;
  polygon: MapPoint[];
  requires: MapAccessRequirement[];
  tags: string[];
}

/** Coarse terrain/event overlay; several features may overlap. */
export interface MapFeatureDef {
  id: string;
  polygon: MapPoint[];
  tags: string[];
  /** Familiar terrain which begins clear of fog on a new or migrated game. */
  initiallySurveyed?: boolean;
}

export interface MapKnowledge {
  /** Sorted unique indexes into the tuned fog grid. */
  surveyedCells: number[];
}

/** A map node (spec §10). Content provides instances; engine only consumes. */
export interface LocationDef {
  id: LocationId;
  name: string;
  blurb: string;
  /** Faction seat, if any — standing there gates trade and events. */
  faction?: FactionId;
  /** Seat-level standing override at game start; falls back to the faction default (spec §8). */
  startingStanding?: number;
  hasMarket: boolean;
  /** Static local price multiplier per good (what's cheap or dear here). */
  priceBias?: Partial<Record<GoodId, number>>;
  initialDiscovery: DiscoveryState;
  /** Matched by travel event conditions and trait check tags. */
  tags: string[];
  /** Exact point on the illustrated map. */
  mapPoint: MapPoint;
  mapRegion: MapRegionId;
}

export interface LocationState {
  discovery: DiscoveryState;
  /** Per-good market state; only for locations with a market (not the post — that's `GameState.market`). */
  market?: Record<GoodId, MarketGoodState>;
}

export const EXPEDITION_KINDS = [
  'caravan',
  'explore',
  'diplomacy',
  'courtship',
  'raid',
  'invite',
  'concession',
] as const;
export type ExpeditionKind = (typeof EXPEDITION_KINDS)[number];
export const EXPEDITION_PACES = ['fast', 'normal', 'slow'] as const;
export type ExpeditionPace = (typeof EXPEDITION_PACES)[number];
export const EXPEDITION_LEGS = ['outbound', 'returning'] as const;
export type ExpeditionLeg = (typeof EXPEDITION_LEGS)[number];

export interface SurveyResult {
  tier: 'critSuccess' | 'success' | 'failure' | 'critFailure';
  surveyedCells: number[];
  discoveredLocationIds: LocationId[];
  knownLocationIds: LocationId[];
}

export interface ExpeditionState {
  id: string;
  kind: ExpeditionKind;
  /** Authored destination; absent for a free-coordinate exploration. */
  destination?: LocationId;
  /** Exact destination for spatial travel. Optional only for pre-v12/test fixtures. */
  target?: MapPoint;
  /** Selected travel pace. Optional only for pre-v12/test fixtures. */
  pace?: ExpeditionPace;
  /** Planned turns per leg before delays. Optional only for pre-v12/test fixtures. */
  legTurns?: number;
  heroIds: string[]; // 1–2 heroes, away from the post while en route
  leg: ExpeditionLeg;
  turnsLeft: number; // turns left in the current leg
  /** Goods carried (caravan cargo; explore finds ride home here too). */
  cargo: Partial<Record<GoodId, number>>;
  /** Silver carried (buy-order funds out, sale proceeds home). */
  silver: number;
  /** Standing buy orders filled at the destination market. */
  buyOrders: Partial<Record<GoodId, number>>;
  /**
   * Residents seconded to the party (porters add cargo, guards add escort).
   * Removed from `residents.roles` at dispatch and returned on homecoming;
   * still count for upkeep while away (RESIDENTS_SPEC.md §8). Optional so
   * pre-v4 in-flight expeditions deserialize without migration.
   */
  residentEscort?: Partial<Record<ResidentRole, number>>;
  /**
   * Retired `labor`-run field (Thornwatch homeland hands). Kept optional so a
   * pre-TULA save with an in-flight labor run still deserializes; no live code
   * reads it any more — Invite Settlers replaced the mechanism.
   */
  homelandLabor?: number;
  /** Invite Settlers (§5.1): source key into hireSources, offer tier, and the
   *  headcount asked for — set at dispatch. */
  inviteSource?: string;
  inviteOffer?: InviteOffer;
  inviteCount?: number;
  /** How many actually agreed to come, rolled at arrival, settled on homecoming. */
  inviteArrivals?: number;
  /** Negotiate Land (§5.2): chains asked for, set at dispatch. */
  concessionAsk?: number;
  /** Chains actually granted (0 on a failed negotiation), rolled at arrival. */
  concessionGranted?: number;
  /**
   * Graph-node id a `courtship` run is bringing a homeland spouse home to wed
   * (FAMILY_SPEC.md §3.5). Optional so non-courtship / pre-v8 expeditions
   * deserialize cleanly.
   */
  courtshipFor?: string;
  /** Outgoing raid battle goal chosen at dispatch (RAIDING_SPEC.md Phase B). */
  raidGoal?: RaidAttackGoal;
  /** Outgoing raid maneuver chosen at dispatch (RAIDING_SPEC.md Phase B). */
  raidManeuver?: RaidManeuver;
  /** Whether the party means to rally itself before striking. */
  raidRally?: boolean;
  /** Friendly faction asked to lend warriors to the raid, if any. */
  raidAlly?: FactionId;
  /** Diplomacy mission payload; absent on older saves / generic envoys. */
  diplomacyMission?: { type: DiplomacyMissionType; mode?: DiplomacyTributeMode };
  /** Survey knowledge carried home by an exploration party. */
  surveyResult?: SurveyResult;
}

export type FactionStance = 'Hostile' | 'Wary' | 'Neutral' | 'Friendly' | 'Allied';

/** Life state of a named character (NOT party membership — see `activePartyIds`).
 *  `captive` is a 4th, orthogonal state (like `dead`/`departed`, not party
 *  membership): a hero held by a captor faction, see `Hero.captivity`. */
export const HERO_STATUSES = ['active', 'dead', 'departed', 'captive'] as const;
export type HeroStatus = (typeof HERO_STATUSES)[number];

/** Named, non-working family attached to a character (CHARACTERS_SPEC.md). */
export const DEPENDANT_KINDS = ['spouse', 'child', 'kin'] as const;
export type DependantKind = (typeof DEPENDANT_KINDS)[number];

export interface Dependant {
  id: string;
  name: string;
  kind: DependantKind;
  /**
   * Household head this member is displayed under and fed against — the
   * founding/oldest hero of their branch. For a child, inherited from the parent
   * that heads the household (FAMILY_SPEC.md §3.2).
   */
  parentId: string;
  /** Required going forward (FAMILY_SPEC.md §3.1). */
  gender: Gender;
  /**
   * Biological parents (0–2 graph-node ids: Hero or Dependant). A married-in
   * spouse has none; a child has both its parents. Drives the family tree
   * (FAMILY_SPEC.md §3.2).
   */
  parentIds?: string[];
  /** The partner this person is united with (a graph-node id), if any. */
  spouseId?: string;
  /** Set on the spouse record of a union: how it was formed. */
  union?: UnionSource;
  /** Descent — the source of "mixed" (FAMILY_SPEC.md §3.3). Absent → derive from `heritage`. */
  ancestry?: Ancestry;
  /** Optional portrait asset key; falls back to the hash-hue tile. */
  portraitKey?: string;
  /** People this dependant belongs to; defaults to the parent's (HERITAGE_SPEC.md §3.3). */
  heritage?: Heritage;
  /** Tribe/region within the people (PEOPLES_SPEC.md §2); defaults to the parent's. */
  subPeople?: string;
  /** Turn a child was born, for aging (FAMILY_SPEC.md §7). */
  bornTurn?: number;
  /** False until coming-of-age promotes a child to grown kin; then true (FAMILY_SPEC.md §7). */
  comeOfAge?: boolean;
}

/**
 * Data to instantiate a recruited named character (CHARACTERS_SPEC.md §6). Content
 * provides instances (content/recruits.ts); the engine builds the runtime Hero,
 * so the engine stays content-free (injected via TurnContext, like good names).
 */
export interface RecruitDef {
  /** Template id, e.g. 'renowned_trader'. Runtime hero ids are minted separately. */
  id: string;
  name: string;
  epithet: string;
  bio: string;
  heritage: Heritage;
  /** Tribe/region within the people (PEOPLES_SPEC.md §2); defaults per-people. */
  subPeople?: string;
  gender: Gender;
  stats: Record<StatId, number>;
  skills: Partial<Record<SkillId, number>>;
  traits: TraitId[];
  /** Optional portrait asset key; falls back to the hash-hue tile. */
  portraitKey?: string;
  /** World flag set on join (an access unlock, CHARACTERS_SPEC.md §6). */
  joinFlag?: string;
}

export interface Hero {
  id: string;
  name: string;
  epithet: string;
  bio: string;
  stats: Record<StatId, number>; // 1–5
  skills: Record<SkillId, number>; // 0–5
  /** Skills marked by successful checks this season; rolled for growth at season end. */
  skillMarks: SkillId[];
  traits: TraitId[];
  health: number; // 0–10, 0 = death
  stress: number; // 0–10, 10 = breakdown
  status: HeroStatus;
  /** The people this character belongs to (HERITAGE_SPEC.md §3.3). Feeds the
   *  Company's read of the active party; runtime because recruits set it live. */
  heritage: Heritage;
  /** Tribe/region within the people (PEOPLES_SPEC.md §2), e.g. 'dustwalker',
   *  'bejasi_hills', 'tributary'. Flavor + hire-source routing; absent → a
   *  per-people default. Never branched on by the engine. */
  subPeople?: string;
  /** Gender (FAMILY_SPEC.md §3.1). Mechanical (marriage, child gender), so runtime. */
  gender: Gender;
  /** Set when a hero heads a union household (FAMILY_SPEC.md §3.4): 'pure' = only
   *  homeland blood under the roof; 'mixed' = any native partner/descendant.
   *  Absent = unwed. The lean marker the Company reads — not a floating meter. */
  bloodline?: Bloodline;
  /**
   * Other heroes this hero is married to (FAMILY_PHASE_D_SPEC.md §2.3) — the
   * only place a hero-to-hero union is recorded; no Dependant is created for
   * it, since neither party stops working or starts eating an extra ration.
   * A hero's spouses who are *outsiders* still live entirely on `Dependant`
   * (`spouseId` back-link), untouched by this field. Symmetric: forming the
   * union pushes each hero's id into the other's `spouseIds`.
   */
  spouseIds?: string[];
  /**
   * Free-form personality flavor tags (FAMILY_PHASE_D_SPEC.md §2.2), e.g.
   * 'warm', 'aloof', 'ambitious' — content-authored, like `subPeople`. The
   * engine never branches on specific values; it exists so event content can
   * write a hero-to-hero courtship that feels like it fits these two people.
   */
  temperament?: string[];
  /** Set while `status === 'captive'`: who holds them and since when. Severity/
   *  escalation is derived from `state.turn - capturedTurn` against
   *  `TUNING.abduction`, not stored redundantly. Cleared on release/departure. */
  captivity?: { faction: FactionId; capturedTurn: number; source?: 'raid' | 'expedition' };
  /** Auto-appended log of notable events for the Hero Sheet. */
  history: string[];
}

/** A trait definition (content provides instances; engine only consumes). */
export interface TraitDef {
  id: TraitId;
  name: string;
  description: string;
  /** Modifiers applied to checks when the skill or a check tag matches. */
  checkMods: TraitCheckMod[];
  /** Negative traits a Rest turn has a chance to shed. */
  recoverable?: boolean;
}

export interface TraitCheckMod {
  /** Applies when the check uses this skill... */
  skill?: SkillId;
  /** ...or when the check carries this tag (events tag checks, e.g. 'strangers'). */
  tag?: string;
  value: number;
  label: string;
}

export interface MarketGoodState {
  /** Random-walk local supply/demand multiplier, clamped to tuning band. */
  supplyDemandMod: number;
  /** Multiplier pushed by event outcomes; decays toward 1 each turn. */
  eventMod: number;
}

export interface FactionState {
  standing: number; // −100..+100
}

/** The post's unnamed population (RESIDENTS_SPEC.md §3). */
export interface ResidentState {
  /** Per-role counts of residents doing that standing work (excludes away escorts). */
  roles: Record<ResidentRole, number>;
  /** Arrived-but-unassigned residents; eat & are paid, produce nothing. */
  idle: number;
  /** Pool-wide mood, 0–10. Gates output, growth, desertion, unrest events. */
  contentment: number;
  /**
   * Per-flavor head counts (e.g. 'kiswani', 'orc', 'goblin', 'native-kin') —
   * a finer, partial breakdown *within* the coarse `heritage` bucket a tag's
   * heads belong to. Partial by design: untagged residents (organic growth,
   * unlabeled hires) simply have no entry here, so counts need not sum to
   * `residentTotal`. Free-form strings, not an enum the engine branches on
   * (same discipline as location/composition tags elsewhere).
   */
  tags: Record<string, number>;
  /**
   * Coarse origin tally kept summed-equal to residentTotal(state)
   * (HERITAGE_SPEC.md §3.2). Homeland = Imanian company folk; native =
   * Kiswani/Dustwalker/Bejasi combined. Specific peoples ride `tags`.
   */
  heritage: Record<HeritageGroup, number>;
  /**
   * Integration friction, 0–10, per `Heritage` — how much lasting tension a
   * settled group of newcomers still carries with the rest of the pool
   * (distinct from pool-wide `contentment`). Absent entries mean no friction
   * ever accrued for that heritage. Generic: any heritage could carry a value,
   * but in practice only Beastfolk settlement content sets one today.
   */
  friction: Partial<Record<Heritage, number>>;
}

/** A transient group of outsiders present at the post (Phase B). */
export interface TransientGroup {
  id: string;
  kind: TransientKind;
  count: number;
  /** Turns until they leave; -1 = indefinite (e.g. Charter-imposed agents). */
  turnsLeft: number;
}

/** Building ids are defined by content (like LocationId/TraitId). Prose lives
 *  in `content/buildings.ts`; all balance numbers live in `TUNING.building`. */
export type BuildingId = string;

/** Passive numeric effects a completed building contributes (summed by selectors). */
export interface BuildingEffects {
  defenseBonus: number;
  prosperityBonus: number;
  tradeIncomeBonus: number;
  stressReliefBonus: number;
  craftReliefBonus: number;
  upkeepSilver: number;
  /** Bonus Food kept from each seasonal harvest — a storehouse eases spoilage
   *  now that food arrives in lumps (TULA_SETTLEMENT_SPEC.md §7). */
  foodStorageBonus: number;
  contentmentBonus: number;
  healingBonus: number; // extra health recovery on a Rest turn, alongside stressReliefBonus
  /** Extra cargo units any expedition can carry, on top of party size + porter
   *  escort (a Dock's river barges) — added wherever `cargoCapacity`/
   *  `raidCargoCapacity` is read. */
  cargoCapacityBonus: number;
  /** Flat check bonus on any expedition arrival check (a Stables' mounts),
   *  applied alongside the resident guard-escort bonus regardless of whether
   *  guards actually came along. */
  travelCheckBonus: number;
}

/** A building's cost, effort, prerequisites, and effects (TUNING.building.defs). */
export interface BuildingDefData {
  cost: { silver: number; goods?: Partial<Record<GoodId, number>> };
  /** Hero-turns of Build work needed to complete it. */
  buildProgress: number;
  prerequisites: BuildingId[];
  effects: Partial<BuildingEffects>;
  /** Availability gate: postTier must be at least this (BUILDINGS_SPEC.md Phase B). */
  minTier?: number;
  /** Needs at least this many residents in a role present at the post. */
  requiresResidents?: { role: ResidentRole; value: number };
  /** Needs at least this many residents of a coarse origin (HERITAGE_SPEC.md). */
  requiresHeritageGroup?: { group: HeritageGroup; value: number };
  /** Needs at least this many residents carrying a specific composition tag
   *  (e.g. 'orc'/'goblin'/'kiswani' — ResidentState.tags). */
  requiresTag?: { tag: string; value: number };
  /** Needs a faction's standing at least this high. */
  requiresStanding?: { faction: FactionId; value: number };
  /** Needs this much silver currently on hand (a wealth gate, distinct from cost). */
  minSilverHeld?: number;
}

/** A tier-advancement recipe (TUNING.building.tierLadder, BUILDINGS_SPEC.md §7). */
export interface TierRequirement {
  tier: number; // the tier you advance INTO
  requiredBuildings: BuildingId[];
  silverCost: number;
  advanceEventId: string;
}

/** The single in-flight construction project (BUILDINGS_SPEC.md §4). */
export interface ConstructionState {
  building: BuildingId;
  /** Accumulated build progress toward the def's buildProgress. */
  progress: number;
}

/** Chain-scoped branch memory (CHAIN_EVENTS_SPEC.md §3.1): small values that
 *  ride on one event/queued-event's own instance rather than the global
 *  `flags` bag, so concurrent or future chains can't collide and nothing
 *  needs cleanup once the chain ends. */
export type ChainVarValue = string | number | boolean;
export type ChainVars = Record<string, ChainVarValue>;

export interface QueuedEvent {
  eventId: string;
  fireOnTurn: number;
  /** Optionally pin the bound hero (e.g. breakdown events). */
  heroId?: string;
  /** Optionally pin a location (e.g. first-contact events). */
  locationId?: LocationId;
  /** Carried forward from the chain stage that queued this one, if any. */
  vars?: ChainVars;
}

/** An event instance selected for this turn, with its hero binding resolved. */
export interface ActiveEvent {
  eventId: string;
  heroId: string;
  /** Set for travel events: the expedition this event happened to. */
  expeditionId?: string;
  /** Set for first-contact events: the seat this event happened to. */
  locationId?: LocationId;
  /** Chain-scoped branch memory (CHAIN_EVENTS_SPEC.md §3.1). */
  vars?: ChainVars;
}

export interface ReportLine {
  icon: string;
  text: string;
}

export interface TurnReport {
  turn: number;
  lines: ReportLine[];
  silverDelta: number;
  goodsDelta: Partial<Record<GoodId, number>>;
}

export const PHASES = ['assignment', 'event', 'report', 'gameover'] as const;
export type GamePhase = (typeof PHASES)[number];

export const GAME_OVER_KINDS = ['bankrupt', 'brokenCompany', 'charterRevoked', 'destroyed'] as const;

export interface GameOverInfo {
  kind: (typeof GAME_OVER_KINDS)[number];
  title: string;
  text: string;
}

// ---------------------------------------------------------------- raiding
// Two-way warfare (RAIDING_SPEC.md). Phase A wires the incoming side.

export const RAID_SEVERITIES = ['probe', 'raid', 'warband'] as const;
export type RaidSeverity = (typeof RAID_SEVERITIES)[number];

export const RAID_MANEUVERS = ['skirmish', 'charge', 'evade'] as const;
export type RaidManeuver = (typeof RAID_MANEUVERS)[number];

/** Defender battle goals (incoming raids). */
export const RAID_DEFEND_GOALS = ['driveoff', 'stand', 'sally', 'hold'] as const;
export type RaidDefendGoal = (typeof RAID_DEFEND_GOALS)[number];

/** Attacker battle goals (outgoing raids, Phase B). `rescue` only dispatchable
 *  against a faction currently holding one of our captives. */
export const RAID_ATTACK_GOALS = ['plunder', 'burn', 'bloody', 'cow', 'rescue'] as const;
export type RaidAttackGoal = (typeof RAID_ATTACK_GOALS)[number];

export type RaidGoal = RaidDefendGoal | RaidAttackGoal;

export const TRIBUTE_DIRECTIONS = ['pay', 'receive'] as const;
export type TributeDirection = (typeof TRIBUTE_DIRECTIONS)[number];

/** A standing tribute oath between the post and a faction, settled each season. */
export interface TributeRelationship {
  faction: FactionId;
  direction: TributeDirection;
  silver: number;
  goods: Partial<Record<GoodId, number>>;
}

/** An incoming raid awaiting the player's defence (RAIDING_SPEC.md §3). */
export interface PendingIncomingRaid {
  kind: 'incoming';
  /** The aggressor faction (BEASTFOLK, or any faction ground to Hostile). */
  faction: FactionId;
  severity: RaidSeverity;
  /** Pre-rolled attacker force, so resolution is deterministic given the roll. */
  attackerForce: number;
  /** The band's committed maneuver (temperament-driven), for the RPS layer. */
  attackerManeuver: RaidManeuver;
  /** False when the raiders slipped past the patrols (surprise on the attacker). */
  spotted: boolean;
  /** Short descriptive label, e.g. "an orc war-band". */
  band: string;
}

/** An outgoing raid that has reached its target and awaits the player's orders. */
export interface PendingOutgoingRaid {
  kind: 'outgoing';
  expeditionId: string;
  faction: FactionId;
  targetName: string;
  /** Pre-rolled target strength, so the encounter is deterministic once reached. */
  defenderForce: number;
  /** The target's committed maneuver for the RPS layer. */
  defenderManeuver: RaidManeuver;
  /** True when the target spotted the raiders on the approach. */
  spotted: boolean;
  /** Dispatch defaults the player may revise on the encounter screen. */
  goal: RaidAttackGoal;
  maneuver: RaidManeuver;
  rally: boolean;
  ally?: FactionId;
}

export type PendingRaid = PendingIncomingRaid | PendingOutgoingRaid;

export interface GameState {
  saveVersion: number;
  seed: number;
  rngState: number;
  turn: number; // 1-based; 24 turns per year, 6 per season
  phase: GamePhase;
  heroes: Hero[];
  /**
   * Ordered ids of the active party (≤ TUNING.roster.activeCap). Every id is a
   * living hero; the remaining living heroes are the reserve bench
   * (CHARACTERS_SPEC.md §3). Party membership is a separate axis from `status`.
   */
  activePartyIds: string[];
  assignments: Record<string, ActivityId>; // heroId -> standing order
  silver: number;
  goods: Record<GoodId, number>;
  market: Record<GoodId, MarketGoodState>;
  locations: Record<LocationId, LocationState>;
  /** Spatial terrain knowledge, distinct from per-location discovery. */
  mapKnowledge: MapKnowledge;
  expeditions: ExpeditionState[];
  /** Monotonic counter for expedition ids. */
  nextExpeditionId: number;
  factions: Record<FactionId, FactionState>;
  /** Per-community diplomacy state for authored seats with a faction. */
  diplomacySeats: Record<LocationId, DiplomacySeatState>;
  /** Named family attached to characters (CHARACTERS_SPEC.md §3). */
  dependants: Dependant[];
  /** Monotonic counter for dependant ids. */
  nextDependantId: number;
  /** Monotonic counter for recruited-character runtime ids (CHARACTERS_SPEC.md §3.1). */
  nextCharacterId: number;
  /** The post's unnamed population (RESIDENTS_SPEC.md). */
  residents: ResidentState;
  /** Land under settlement — the Concession (TULA_SETTLEMENT_SPEC.md §2). */
  claim: ClaimState;
  /** Abstracted livestock, tended by herders (TULA_SETTLEMENT_SPEC.md §4.2). */
  herd: HerdState;
  /** Transient outsiders (Phase B); empty until spawn hooks land. */
  transients: TransientGroup[];
  /** Monotonic counter for transient group ids. */
  nextTransientId: number;
  axes: Record<AxisId, number>; // −10..+10
  postTier: number; // 1–4
  /** Completed buildings (ids). Presence is what matters; effects are derived. */
  buildings: BuildingId[];
  /** The single active construction project, or null (BUILDINGS_SPEC.md §4). */
  construction: ConstructionState | null;
  /** World flags set by event outcomes, checked by conditions. */
  flags: Record<string, boolean>;
  /** Ids of `once` events that have fired. */
  firedEvents: string[];
  /** eventId -> turn it may fire again (cooldowns). */
  cooldowns: Record<string, number>;
  /** Scheduled chain events. */
  queuedEvents: QueuedEvent[];
  /** Events selected this turn, resolved one at a time in the event phase. */
  pendingEvents: ActiveEvent[];
  /** Consecutive turns upkeep went unpaid; 3 = bankruptcy. */
  bankruptcyClock: number;
  /** Consecutive seasons the Charter Company's profit quota went unmet. */
  charterMissedStreak: number;
  /**
   * Consecutive season-ends the post read as compromised to a hostile Company
   * (HERITAGE_SPEC.md §6). Drives the `charterRevoked` ending. Used in Phase B;
   * seeded here so Phase A's v7 migration is the only one needed.
   */
  charterCompromisedStreak: number;
  /** An incoming raid awaiting the player's defence, or null (RAIDING_SPEC.md). */
  pendingRaid: PendingRaid | null;
  /** Turn the last incoming raid fired (0 = never); drives the raid cooldown. */
  lastRaidTurn: number;
  /** Turn the post was last sacked (0 = never); the `destroyed` cascade window. */
  lastSackedTurn: number;
  /** Ongoing tribute oaths with neighbouring factions (RAIDING_SPEC.md Phase B). */
  tributes: TributeRelationship[];
  report: TurnReport;
  gameOver: GameOverInfo | null;
}

export function seasonOfTurn(turn: number): Season {
  return SEASONS[
    Math.floor(
      ((turn - 1) % TUNING.time.turnsPerYear) / TUNING.time.turnsPerSeason,
    )
  ];
}

export function yearOfTurn(turn: number): number {
  return Math.floor((turn - 1) / TUNING.time.turnsPerYear) + 1;
}

/** True when `turn` is the last turn of a season (skill growth rolls fire). */
export function isSeasonEnd(turn: number): boolean {
  return turn % TUNING.time.turnsPerSeason === 0;
}

export function stanceOf(standing: number): FactionStance {
  if (standing <= -50) return 'Hostile';
  if (standing <= -15) return 'Wary';
  if (standing < 15) return 'Neutral';
  if (standing < 50) return 'Friendly';
  return 'Allied';
}

/** All living named characters — active party AND reserve bench. */
export function livingHeroes(state: GameState): Hero[] {
  return state.heroes.filter((h) => h.status === 'active');
}

/** The active party, in `activePartyIds` order (dead/missing ids dropped). */
export function activeHeroes(state: GameState): Hero[] {
  const byId = new Map(livingHeroes(state).map((h) => [h.id, h]));
  return state.activePartyIds
    .map((id) => byId.get(id))
    .filter((h): h is Hero => h !== undefined);
}

/** Fraction of the active party belonging to a heritage group (0 when empty).
 *  Feeds the Company's read of the post (HERITAGE_SPEC.md §6). */
export function partyHeritageShare(state: GameState, group: HeritageGroup): number {
  const party = activeHeroes(state);
  if (party.length === 0) return 0;
  const n = party.filter((h) => heritageGroup(h.heritage) === group).length;
  return n / party.length;
}

/** Living heroes not in the active party — the reserve bench. */
export function reserveHeroes(state: GameState): Hero[] {
  const active = new Set(state.activePartyIds);
  return livingHeroes(state).filter((h) => !active.has(h.id));
}

/** Named characters currently held captive by a faction. */
export function captiveHeroes(state: GameState): Hero[] {
  return state.heroes.filter((h) => h.status === 'captive');
}

/** Hero ids currently away on an expedition. */
export function awayHeroIds(state: GameState): Set<string> {
  return new Set(state.expeditions.flatMap((e) => e.heroIds));
}

/** Active-party heroes present at the post (assignable, bindable by post events). */
export function heroesAtPost(state: GameState): Hero[] {
  const away = awayHeroIds(state);
  return activeHeroes(state).filter((h) => !away.has(h.id));
}

/** True when `state` is at least as far along as `atLeast` on the discovery ladder. */
export function discoveryAtLeast(state: DiscoveryState, atLeast: DiscoveryState): boolean {
  return DISCOVERY_STATES.indexOf(state) >= DISCOVERY_STATES.indexOf(atLeast);
}

/** The next discovery state up the ladder (known stays known). */
export function nextDiscovery(state: DiscoveryState): DiscoveryState {
  const idx = DISCOVERY_STATES.indexOf(state);
  return DISCOVERY_STATES[Math.min(idx + 1, DISCOVERY_STATES.length - 1)];
}

export function getHero(state: GameState, heroId: string): Hero {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error(`Unknown hero: ${heroId}`);
  return hero;
}

/** Resolves an id list (e.g. an expedition/raid party) to the living, active
 *  heroes among them — dead/departed/reserve ids and unresolvable ids drop out. */
export function activeHeroesById(state: GameState, heroIds: readonly string[]): Hero[] {
  return heroIds
    .map((id) => state.heroes.find((h) => h.id === id))
    .filter((hero): hero is Hero => hero !== undefined && hero.status === 'active');
}

/** Whether a single hero id currently resolves to a living, active hero. */
export function isActiveHeroId(state: GameState, heroId: string): boolean {
  return activeHeroesById(state, [heroId]).length > 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Standing (faction/diplomacy-seat) is always bounded to this range. */
export function clampStanding(value: number): number {
  return clamp(value, -100, 100);
}
