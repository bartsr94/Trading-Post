// Recruit templates (CHARACTERS_SPEC.md §6): named characters who join the
// reserve through event chains — never a menu purchase. Shaped as engine
// `RecruitDef`s (content-only; the engine builds the runtime Hero from these,
// injected via TurnContext like good names). Ashmark grounding per
// docs/ASHMARK_LORE_SPEC.md. Includes the "renowned trader" the spec calls for.

import type { RecruitDef } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

export const RECRUITS: RecruitDef[] = [
  {
    id: 'renowned_trader',
    name: 'Odren',
    epithet: 'the Renowned Trader',
    portraitKey: 'imanian_male_07',
    heritage: 'imanian',
    gender: 'male',
    bio: 'A Port Iron name that opens doors and empties rivals’ warehouses. He has grown bored of safe money and smells opportunity in your little post on the edge of the map.',
    stats: { might: 1, agility: 2, wits: 4, charm: 5, resolve: 3 },
    skills: { bargain: 4, diplomacy: 2, leadership: 1 },
    traits: ['silver_tongued'],
    joinFlag: 'trader_guild_contact',
  },
  {
    id: 'river_daughter',
    name: 'Naru',
    epithet: 'the River-Town Trader',
    portraitKey: 'kiswani_female_02',
    heritage: 'kiswani',
    gender: 'female',
    bio: 'A clan-mother’s daughter of the Tributary Towns who learned Ansberrian ledgers to keep her people from being cheated. She would rather do it from inside your counting house than outside it.',
    stats: { might: 2, agility: 3, wits: 4, charm: 3, resolve: 3 },
    skills: { bargain: 2, diplomacy: 3, survival: 1 },
    traits: ['friend_river_clans'],
  },
  {
    id: 'drylands_outrider',
    name: 'Teshka',
    epithet: 'the Outrider',
    portraitKey: 'hanjoda_male_01',
    heritage: 'hanjoda',
    subPeople: 'dustwalker',
    gender: 'male',
    bio: 'A Hanjoda horseman of the Dustwalker tribe who rode escort for a caravan that never paid him. He keeps the horse and the grudge, and hires his spear to those who settle their debts.',
    stats: { might: 4, agility: 4, wits: 2, charm: 2, resolve: 3 },
    skills: { combat: 3, survival: 2, leadership: 1 },
    traits: ['brave'],
  },
  {
    id: 'company_deserter',
    name: 'Ilse',
    epithet: 'the Deserter',
    portraitKey: 'imanian_female_04',
    heritage: 'imanian',
    gender: 'female',
    bio: 'She walked away from a Company garrison the night before it did something she could not stomach. The Ansberry ledger lists her as a deserter; she calls it the first honest choice she ever made.',
    stats: { might: 3, agility: 3, wits: 3, charm: 2, resolve: 4 },
    skills: { combat: 2, survival: 2, craft: 1 },
    traits: ['iron_willed'],
  },
  {
    id: 'grove_speaker',
    name: 'Vessa',
    epithet: 'the Grove-Speaker',
    portraitKey: 'kiswani_female_04',
    heritage: 'kiswani',
    subPeople: 'bejasi_hills',
    gender: 'female',
    bio: 'She speaks for the Bejasi Hills folk to outsiders, a rare and dangerous office among the Kiswani who dwell in the ruined hills. Whether she came to your post to bridge the two worlds or to watch you for her elders, she has not said.',
    stats: { might: 1, agility: 2, wits: 4, charm: 3, resolve: 4 },
    skills: { lore: 3, diplomacy: 2, survival: 1 },
    traits: [],
  },
  {
    id: 'weri_smith',
    name: 'Durvan',
    epithet: 'the Deep-Smith',
    portraitKey: 'weri_male_01',
    heritage: 'weri',
    subPeople: 'weri',
    gender: 'male',
    bio: 'A Weri metalworker who came down from the Stormwall tunnels to Pemba-Jasiri, then further still to your post. His people are few and do not wander idly; he will not say what drove him to the open sky, only that your forges are wasted on the hands that hold them.',
    stats: { might: 3, agility: 2, wits: 4, charm: 2, resolve: 4 },
    skills: { craft: 4, lore: 2, combat: 1 },
    traits: [],
    joinFlag: 'knights_eirwen_contact',
  },
  {
    id: 'freed_carpenter',
    name: 'Boram',
    epithet: 'the Carpenter',
    portraitKey: 'imanian_male_08',
    heritage: 'imanian',
    gender: 'male',
    bio: 'Worked off an indenture raising half the roofs in Thornwatch and arrived at your post with his tools and no master. He measures twice, speaks once, and never leaves a joint loose.',
    stats: { might: 3, agility: 3, wits: 3, charm: 2, resolve: 3 },
    skills: { craft: 4, survival: 1, combat: 1 },
    traits: [],
  },
];

/** templateId → RecruitDef, injected into the engine via TurnContext. */
export const RECRUIT_DEFS: ReadonlyMap<string, RecruitDef> = uniqueIdMap('recruit', RECRUITS);
