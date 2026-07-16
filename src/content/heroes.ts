// The pregenerated 12-hero pool (spec §4). Names/bios are [PALUSTERIA LORE]
// placeholders (P1–P12); Bartosz supplies final identities. Each hero's
// hookHint teases their personal event chain without spelling it out.

import type { Hero, SkillId, StatId } from '../engine/types';

export interface HeroTemplate {
  id: string;
  name: string;
  epithet: string;
  bio: string;
  hookHint: string;
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
    name: 'Berrin', // [P1]
    epithet: 'the Old Sergeant',
    bio: 'Twenty years under the Charter banner, mustered out with a limp and a pension he drank. The frontier is his last posting, and he knows it.',
    hookHint: 'Someone from the old campaigns remembers what he owes.',
    stats: { might: 4, agility: 2, wits: 3, charm: 2, resolve: 4 },
    skills: { combat: 3, leadership: 2, survival: 1 },
    traits: ['scarred'],
  },
  {
    id: 'p2',
    name: 'Maela', // [P2]
    epithet: "the Factor's Daughter",
    bio: 'Raised over a counting house, fluent in three tongues and every kind of ledger. Came out here to prove she is more than her father’s name.',
    hookHint: 'The Charter Company takes an unusual interest in her reports.',
    stats: { might: 1, agility: 2, wits: 4, charm: 4, resolve: 3 },
    skills: { bargain: 3, diplomacy: 2, lore: 1 },
    traits: ['silver_tongued'],
  },
  {
    id: 'p3',
    name: 'Tobin', // [P3]
    epithet: 'the Homesick Scholar',
    bio: 'Signed on to write the definitive natural history of Palusteria. Weeps over his letters, then fills the margins with brilliant observations.',
    hookHint: 'His letters home may matter more than he knows.',
    stats: { might: 1, agility: 2, wits: 5, charm: 2, resolve: 2 },
    skills: { lore: 3, craft: 2, diplomacy: 1 },
    traits: ['bookish', 'homesick'],
  },
  {
    id: 'p4',
    name: 'Sela', // [P4]
    epithet: 'the River Guide',
    bio: 'Born on the water to a clan mother and a homeland trader. Both worlds claim her; neither fully trusts her.',
    hookHint: 'Her river kin will come asking for things.',
    stats: { might: 2, agility: 4, wits: 3, charm: 3, resolve: 2 },
    skills: { survival: 3, stealth: 2, diplomacy: 1 },
    traits: ['friend_river_clans'],
  },
  {
    id: 'p5',
    name: 'Dagny', // [P5]
    epithet: 'the Huntress',
    bio: 'Took her first elk at eleven and has fed whole villages since. Distrusts walls, ledgers, and anyone who smiles while bargaining.',
    hookHint: 'The hills hold hunters less honest than she is.',
    stats: { might: 3, agility: 4, wits: 3, charm: 1, resolve: 3 },
    skills: { survival: 3, combat: 2, stealth: 1 },
    traits: ['renowned_hunter'],
  },
  {
    id: 'p6',
    name: 'Corvin', // [P6]
    epithet: 'the Quartermaster',
    bio: 'Kept a garrison fed through a two-year siege by counting everything twice and trusting no one once. Retired, allegedly.',
    hookHint: 'Old habits: he keeps a second ledger nobody has seen.',
    stats: { might: 2, agility: 2, wits: 4, charm: 2, resolve: 4 },
    skills: { craft: 3, bargain: 2, leadership: 1 },
    traits: [],
  },
  {
    id: 'p7',
    name: 'Jusk', // [P7]
    epithet: 'the Gambler',
    bio: 'Charming, quick-fingered, and one bad night from ruin at all times. Swears the frontier is his fresh start. He has said that before.',
    hookHint: 'His luck draws games, and games draw trouble.',
    stats: { might: 2, agility: 3, wits: 3, charm: 4, resolve: 1 },
    skills: { bargain: 2, stealth: 2, diplomacy: 1 },
    traits: ['drunkard', 'lucky'],
  },
  {
    id: 'p8',
    name: 'Wren', // [P8]
    epithet: 'the Chaplain',
    bio: 'Tends the company’s souls and its wounds with the same steady hands. Believes the frontier is a test set for her personally.',
    hookHint: 'The Old People’s rites trouble her sleep — and call to her.',
    stats: { might: 1, agility: 2, wits: 3, charm: 3, resolve: 4 },
    skills: { lore: 3, diplomacy: 2, leadership: 1 },
    traits: ['pious', 'kindhearted'],
  },
  {
    id: 'p9',
    name: 'Halvar', // [P9]
    epithet: 'the Brawler',
    bio: 'Dockside enforcer who got on the wrong boat on purpose. Loyal as a hound to anyone who feeds him and doesn’t lie to him.',
    hookHint: 'The people he worked for do not consider the account settled.',
    stats: { might: 5, agility: 3, wits: 2, charm: 2, resolve: 3 },
    skills: { combat: 3, craft: 1, survival: 1 },
    traits: ['brawler', 'brave'],
  },
  {
    id: 'p10',
    name: 'Isolde', // [P10]
    epithet: 'the Widow',
    bio: 'Her husband’s trading house died with him; his partners saw to that. She sold the rings, bought passage, and intends to build something they can’t take.',
    hookHint: 'Grief is patient. So are her husband’s partners.',
    stats: { might: 2, agility: 1, wits: 3, charm: 4, resolve: 4 },
    skills: { leadership: 3, diplomacy: 2, bargain: 1 },
    traits: ['grieving', 'iron_willed'],
  },
  {
    id: 'p11',
    name: 'Fenn', // [P11]
    epithet: 'the Scout',
    bio: 'Poached the king’s forests until the king’s foresters made the homeland unhealthy. Moves like smoke, talks like fog.',
    hookHint: 'He recognizes places out here he has never been. He hates that.',
    stats: { might: 2, agility: 5, wits: 3, charm: 1, resolve: 2 },
    skills: { stealth: 3, survival: 2, combat: 1 },
    traits: ['wanderer', 'craven'],
  },
  {
    id: 'p12',
    name: 'Ashka', // [P12]
    epithet: 'the Outcast Ritualist',
    bio: 'Cast out of the Old People for a transgression she will not name. Knows the woods’ courtesies and the woods’ prices better than anyone living among strangers.',
    hookHint: 'Her people have not finished with her.',
    stats: { might: 1, agility: 3, wits: 4, charm: 2, resolve: 3 },
    skills: { lore: 3, survival: 2, stealth: 1 },
    traits: ['cursed'],
  },
];
