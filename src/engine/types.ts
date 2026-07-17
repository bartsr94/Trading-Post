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

export type AxisId = 'integration' | 'communal'; // Aloof(−)↔Integrated(+), Mercantile(−)↔Communal(+)

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

export type ExpeditionKind = 'caravan' | 'explore' | 'diplomacy';

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
}

export type FactionStance = 'Hostile' | 'Wary' | 'Neutral' | 'Friendly' | 'Allied';

export type HeroStatus = 'active' | 'dead' | 'departed';

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
  kind: 'bankrupt' | 'brokenCompany';
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
  assignments: Record<string, ActivityId>; // heroId -> standing order
  silver: number;
  goods: Record<GoodId, number>;
  market: Record<GoodId, MarketGoodState>;
  locations: Record<LocationId, LocationState>;
  expeditions: ExpeditionState[];
  /** Monotonic counter for expedition ids. */
  nextExpeditionId: number;
  factions: Record<FactionId, FactionState>;
  axes: Record<AxisId, number>; // −10..+10
  postTier: number; // 1–4
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

export function livingHeroes(state: GameState): Hero[] {
  return state.heroes.filter((h) => h.status === 'active');
}

/** Hero ids currently away on an expedition. */
export function awayHeroIds(state: GameState): Set<string> {
  return new Set(state.expeditions.flatMap((e) => e.heroIds));
}

/** Living heroes present at the post (assignable, bindable by post events). */
export function heroesAtPost(state: GameState): Hero[] {
  const away = awayHeroIds(state);
  return livingHeroes(state).filter((h) => !away.has(h.id));
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
