// The pregenerated 12-hero pool (spec §4). Ashmark grounding per
// docs/ASHMARK_LORE_SPEC.md. Each hero's hookHint teases their personal
// event chain without spelling it out.

import type { Hero, SkillId, StatId } from '../engine/types';

export interface HeroTemplate {
  id: string;
  name: string;
  epithet: string;
  bio: string;
  hookHint: string;
  /** Portrait asset key (<race>_<gender>_<NN>, see src/ui/portraits.ts).
   *  UI-only — never copied onto the runtime Hero (that lives in GameState
   *  and would force a save migration). */
  portraitKey: string;
  stats: Record<StatId, number>;
  skills: Partial<Record<SkillId, number>>;
  traits: string[];
}

const NO_SKILLS: Record<SkillId, number> = {
  bargain: 0,
  diplomacy: 0,
  combat: 0,
  survival: 0,
  leadership: 0,
  lore: 0,
  craft: 0,
  stealth: 0,
};

/** Helper constructor: instantiate a fresh Hero from a pool template. */
export function createHero(template: HeroTemplate): Hero {
  return {
    id: template.id,
    name: template.name,
    epithet: template.epithet,
    bio: template.bio,
    stats: { ...template.stats },
    skills: { ...NO_SKILLS, ...template.skills },
    skillMarks: [],
    traits: [...template.traits],
    health: 10,
    stress: 0,
    status: 'active',
    history: [],
  };
}

export const HERO_POOL: HeroTemplate[] = [
  {
    id: 'p1',
    name: 'Berrin',
    epithet: 'the Old Sergeant',
    portraitKey: 'imanian_male_02',
    bio: 'Twenty years in Ansberry auxiliary service, most of them patrolling the Bleak Hills line against the Cult of the Black Sun. Mustered out with a limp and a pension he drank. The frontier is his last posting, and he knows it.',
    hookHint: 'Someone from the old campaigns remembers what he owes.',
    stats: { might: 4, agility: 2, wits: 3, charm: 2, resolve: 4 },
    skills: { combat: 3, leadership: 2, survival: 1 },
    traits: ['scarred'],
  },
  {
    id: 'p2',
    name: 'Maela',
    epithet: "the Factor's Daughter",
    portraitKey: 'imanian_female_01',
    bio: 'Raised over a Port Iron counting house, fluent in three tongues and every kind of ledger. Came out here to prove she is more than her father’s name.',
    hookHint: 'The Ansberry Company takes an unusual interest in her reports.',
    stats: { might: 1, agility: 2, wits: 4, charm: 4, resolve: 3 },
    skills: { bargain: 3, diplomacy: 2, lore: 1 },
    traits: ['silver_tongued'],
  },
  {
    id: 'p3',
    name: 'Tobin',
    epithet: 'the Homesick Scholar',
    portraitKey: 'imanian_male_03',
    bio: 'Signed on to write the definitive natural history of the Ashmark for the Brotherhood of the Sacred Word. Weeps over his letters home to Imani, then fills the margins with brilliant observations.',
    hookHint: 'His letters home may matter more than he knows.',
    stats: { might: 1, agility: 2, wits: 5, charm: 2, resolve: 2 },
    skills: { lore: 3, craft: 2, diplomacy: 1 },
    traits: ['bookish', 'homesick'],
  },
  {
    id: 'p4',
    name: 'Sela',
    epithet: 'the River Guide',
    portraitKey: 'kiswani_female_01',
    bio: 'Born on the tributary to a Kiswani clan-mother of Njaro-Matu and an Ansberrian trader. Both worlds claim her; neither fully trusts her.',
    hookHint: 'Her mother’s kin in Njaro-Matu will come asking for things.',
    stats: { might: 2, agility: 4, wits: 3, charm: 3, resolve: 2 },
    skills: { survival: 3, stealth: 2, diplomacy: 1 },
    traits: ['friend_river_clans'],
  },
  {
    id: 'p5',
    name: 'Dagny',
    epithet: 'the Huntress',
    portraitKey: 'dustwalker_female_01',
    bio: 'Dustwalker-born, she left the horse-herds young to hunt alone. Took her first elk at eleven and has fed whole villages since. Distrusts walls, ledgers, and anyone who smiles while bargaining.',
    hookHint: 'The drylands hold hunters less honest than she is.',
    stats: { might: 3, agility: 4, wits: 3, charm: 1, resolve: 3 },
    skills: { survival: 3, combat: 2, stealth: 1 },
    traits: ['renowned_hunter'],
  },
  {
    id: 'p6',
    name: 'Corvin',
    epithet: 'the Quartermaster',
    portraitKey: 'imanian_male_04',
    bio: 'Kept an Ansberry garrison fed through a two-year siege on the Bleak Hills line by counting everything twice and trusting no one once. Retired, allegedly.',
    hookHint: 'Old habits: he keeps a second ledger nobody has seen.',
    stats: { might: 2, agility: 2, wits: 4, charm: 2, resolve: 4 },
    skills: { craft: 3, bargain: 2, leadership: 1 },
    traits: [],
  },
  {
    id: 'p7',
    name: 'Jusk',
    epithet: 'the Gambler',
    portraitKey: 'imanian_male_06',
    bio: 'Charming, quick-fingered, and one bad night from ruin at all times. Owes the Emerald Syndicate more than he has told anyone. Swears the frontier is his fresh start. He has said that before.',
    hookHint: 'His luck draws games, and games draw trouble.',
    stats: { might: 2, agility: 3, wits: 3, charm: 4, resolve: 1 },
    skills: { bargain: 2, stealth: 2, diplomacy: 1 },
    traits: ['drunkard', 'lucky'],
  },
  {
    id: 'p8',
    name: 'Wren',
    epithet: 'the Chaplain',
    portraitKey: 'imanian_female_02',
    bio: 'Tends the company’s souls and its wounds with the same steady hands, in the name of the Brotherhood of the Sacred Word. Believes the frontier is a test set for her personally.',
    hookHint: 'The Bejasi Hills folk’s rites trouble her sleep — and call to her.',
    stats: { might: 1, agility: 2, wits: 3, charm: 3, resolve: 4 },
    skills: { lore: 3, diplomacy: 2, leadership: 1 },
    traits: ['pious', 'kindhearted'],
  },
  {
    id: 'p9',
    name: 'Halvar',
    epithet: 'the Brawler',
    portraitKey: 'imanian_male_01',
    bio: 'Port Iron dockside enforcer who got on the wrong boat on purpose. Loyal as a hound to anyone who feeds him and doesn’t lie to him.',
    hookHint: 'The Emerald Syndicate does not consider the account settled.',
    stats: { might: 5, agility: 3, wits: 2, charm: 2, resolve: 3 },
    skills: { combat: 3, craft: 1, survival: 1 },
    traits: ['brawler', 'brave'],
  },
  {
    id: 'p10',
    name: 'Isolde',
    epithet: 'the Widow',
    portraitKey: 'imanian_female_03',
    bio: 'Her husband’s Port Iron trading house died with him; his Company partners saw to that. She sold the rings, bought passage, and intends to build something they can’t take.',
    hookHint: 'Grief is patient. So are her husband’s partners.',
    stats: { might: 2, agility: 1, wits: 3, charm: 4, resolve: 4 },
    skills: { leadership: 3, diplomacy: 2, bargain: 1 },
    traits: ['grieving', 'iron_willed'],
  },
  {
    id: 'p11',
    name: 'Fenn',
    epithet: 'the Scout',
    portraitKey: 'imanian_male_05',
    bio: 'Poached the royal forests of Imani until the king’s foresters made the homeland unhealthy. Moves like smoke, talks like fog.',
    hookHint: 'He recognizes places out here he has never been. He hates that.',
    stats: { might: 2, agility: 5, wits: 3, charm: 1, resolve: 2 },
    skills: { stealth: 3, survival: 2, combat: 1 },
    traits: ['wanderer', 'craven'],
  },
  {
    id: 'p12',
    name: 'Ashka',
    epithet: 'the Outcast Ritualist',
    portraitKey: 'bejasi_female_01',
    bio: 'Cast out of Mandaro, in the Bejasi Hills, for a transgression she will not name. Knows the jungle’s courtesies and the jungle’s prices better than anyone living among strangers.',
    hookHint: 'Her people have not finished with her.',
    stats: { might: 1, agility: 3, wits: 4, charm: 2, resolve: 3 },
    skills: { lore: 3, survival: 2, stealth: 1 },
    traits: ['cursed'],
  },
];

/** heroId → portrait asset key, for UI lookup at render time. Heroes without
 *  an entry (future recruits) fall back to hashing their id. */
export const PORTRAIT_KEYS: Map<string, string> = new Map(
  HERO_POOL.map((t) => [t.id, t.portraitKey]),
);
