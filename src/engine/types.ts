// Core shared types for the engine. Pure — no React, no content imports.

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
] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

// Aloof(−)↔Integrated(+), Mercantile(−)↔Communal(+), Homeland/Imanian(−)↔Frontier/Sauromatian(+)
export type AxisId = 'integration' | 'communal' | 'culture';

/** Peoples of the Ashmark (HERITAGE_SPEC.md §2). Reuses the portrait "race"
 *  pools, promoted to a mechanical type carried by named people & the resident
 *  tally. `imanian` = the Company's homeland folk; the rest are native. */
export const HERITAGES = ['imanian', 'kiswani', 'dustwalker', 'bejasi'] as const;
export type Heritage = (typeof HERITAGES)[number];

/** The coarse origin split the culture axis & Company care about. */
export type HeritageGroup = 'homeland' | 'native';

export function heritageGroup(h: Heritage): HeritageGroup {
  return h === 'imanian' ? 'homeland' : 'native';
}

export function isNativeHeritage(h: Heritage): boolean {
  return h !== 'imanian';
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

/** Unnamed-population roles (spec: RESIDENTS_SPEC.md §2). */
export const RESIDENT_ROLES = ['farmers', 'porters', 'guards', 'craftsfolk'] as const;
export type ResidentRole = (typeof RESIDENT_ROLES)[number];

/** Transient outsiders we neither feed nor pay (RESIDENTS_SPEC.md §3, Phase B). */
export const TRANSIENT_KINDS = ['visitorGuards', 'companyAgents', 'supplierCrew'] as const;
export type TransientKind = (typeof TRANSIENT_KINDS)[number];

export const DISCOVERY_STATES = ['unknown', 'rumored', 'visited', 'known'] as const;
export type DiscoveryState = (typeof DISCOVERY_STATES)[number];

/** A map node (spec §10). Content provides instances; engine only consumes. */
export interface LocationDef {
  id: LocationId;
  name: string;
  blurb: string;
  /** Faction seat, if any — standing there gates trade and events. */
  faction?: FactionId;
  hasMarket: boolean;
  /** Static local price multiplier per good (what's cheap or dear here). */
  priceBias?: Partial<Record<GoodId, number>>;
  /** One-way travel turns from the post. */
  travelTurns: number;
  initialDiscovery: DiscoveryState;
  /** Adjacent nodes; exploring here turns unknown neighbours to rumored. */
  connections: LocationId[];
  /** Matched by travel event conditions and trait check tags. */
  tags: string[];
  /** Map screen position, 0–100 in both axes. */
  mapX: number;
  mapY: number;
}

export interface LocationState {
  discovery: DiscoveryState;
  /** Per-good market state; only for locations with a market (not the post — that's `GameState.market`). */
  market?: Record<GoodId, MarketGoodState>;
}

export type ExpeditionKind = 'caravan' | 'explore' | 'diplomacy' | 'labor';

export interface ExpeditionState {
  id: string;
  kind: ExpeditionKind;
  destination: LocationId;
  heroIds: string[]; // 1–2 heroes, away from the post while en route
  leg: 'outbound' | 'returning';
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
   * Homeland (Imanian) laborers a `labor` run is bringing home from Thornwatch
   * (HERITAGE_SPEC.md §5.2). Paid for at dispatch; added to the pool on
   * homecoming. Optional so non-labor / pre-v7 expeditions deserialize cleanly.
   */
  homelandLabor?: number;
}

export type FactionStance = 'Hostile' | 'Wary' | 'Neutral' | 'Friendly' | 'Allied';

/** Life state of a named character (NOT party membership — see `activePartyIds`). */
export type HeroStatus = 'active' | 'dead' | 'departed';

/** Named, non-working family attached to a character (CHARACTERS_SPEC.md). */
export const DEPENDANT_KINDS = ['spouse', 'child', 'kin'] as const;
export type DependantKind = (typeof DEPENDANT_KINDS)[number];

export interface Dependant {
  id: string;
  name: string;
  kind: DependantKind;
  /** The living named character this dependant belongs to. */
  parentId: string;
  /** Optional portrait asset key; falls back to the hash-hue tile. */
  portraitKey?: string;
  /** People this dependant belongs to; defaults to the parent's (HERITAGE_SPEC.md §3.3). */
  heritage?: Heritage;
  /** Turn a child was born, for aging (forward hook, Phase C). */
  bornTurn?: number;
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
  /** Composition flavor for conditions/text (e.g. 'native-kin', 'settlers'). */
  tags: string[];
  /**
   * Coarse origin tally kept summed-equal to residentTotal(state)
   * (HERITAGE_SPEC.md §3.2). Homeland = Imanian company folk; native =
   * Kiswani/Dustwalker/Bejasi combined. Specific peoples ride `tags`.
   */
  heritage: Record<HeritageGroup, number>;
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
  residentCapBonus: number;
  defenseBonus: number;
  prosperityBonus: number;
  tradeIncomeBonus: number;
  stressReliefBonus: number;
  craftReliefBonus: number;
  upkeepSilver: number;
  storageBonus: number; // reserved; unused until storage caps land (Phase C)
}

/** A building's cost, effort, prerequisites, and effects (TUNING.building.defs). */
export interface BuildingDefData {
  cost: { silver: number; goods?: Partial<Record<GoodId, number>> };
  /** Hero-turns of Build work needed to complete it. */
  buildProgress: number;
  prerequisites: BuildingId[];
  effects: Partial<BuildingEffects>;
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

export interface QueuedEvent {
  eventId: string;
  fireOnTurn: number;
  /** Optionally pin the bound hero (e.g. breakdown events). */
  heroId?: string;
}

/** An event instance selected for this turn, with its hero binding resolved. */
export interface ActiveEvent {
  eventId: string;
  heroId: string;
  /** Set for travel events: the expedition this event happened to. */
  expeditionId?: string;
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

export type GamePhase = 'assignment' | 'event' | 'report' | 'gameover';

export interface GameOverInfo {
  kind: 'bankrupt' | 'brokenCompany' | 'charterRevoked';
  title: string;
  text: string;
}

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
  expeditions: ExpeditionState[];
  /** Monotonic counter for expedition ids. */
  nextExpeditionId: number;
  factions: Record<FactionId, FactionState>;
  /** Named family attached to characters (CHARACTERS_SPEC.md §3). */
  dependants: Dependant[];
  /** Monotonic counter for dependant ids. */
  nextDependantId: number;
  /** The post's unnamed population (RESIDENTS_SPEC.md). */
  residents: ResidentState;
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
  report: TurnReport;
  gameOver: GameOverInfo | null;
}

export function seasonOfTurn(turn: number): Season {
  return SEASONS[Math.floor(((turn - 1) % 24) / 6)];
}

export function yearOfTurn(turn: number): number {
  return Math.floor((turn - 1) / 24) + 1;
}

/** True when `turn` is the last turn of a season (skill growth rolls fire). */
export function isSeasonEnd(turn: number): boolean {
  return turn % 6 === 0;
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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
