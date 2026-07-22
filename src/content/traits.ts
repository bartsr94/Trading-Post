// Trait definitions (spec §4): tags with mechanical hooks. ~20 for v1.
// Check tags used by events: 'strangers', 'intimidation', 'hunting', 'trade',
// 'gamble', 'ritual', 'natives', plus faction ids as tags for faction dealings.

import type { TraitDef } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

export const TRAITS: TraitDef[] = [
  {
    id: 'scarred',
    name: 'Scarred',
    description: 'Old wounds that unsettle strangers — and lend weight to threats.',
    checkMods: [
      { tag: 'strangers', value: -1, label: 'Scarred' },
      { tag: 'intimidation', value: 1, label: 'Scarred' },
    ],
  },
  {
    id: 'drunkard',
    name: 'Drunkard',
    description: 'The bottle takes the edge off — and the edge was the useful part.',
    checkMods: [{ skill: 'diplomacy', value: -1, label: 'Drunkard' }],
    recoverable: true,
  },
  {
    id: 'renowned_hunter',
    name: 'Renowned Hunter',
    description: 'Game falls to them, and frontier folk know the name.',
    checkMods: [{ tag: 'hunting', value: 2, label: 'Renowned Hunter' }],
  },
  {
    id: 'grieving',
    name: 'Grieving',
    description: 'A recent loss sits heavy; leading others feels hollow.',
    checkMods: [{ skill: 'leadership', value: -1, label: 'Grieving' }],
    recoverable: true,
  },
  {
    id: 'brave',
    name: 'Brave',
    description: 'Steps forward when others step back.',
    checkMods: [{ skill: 'combat', value: 1, label: 'Brave' }],
  },
  {
    id: 'craven',
    name: 'Craven',
    description: 'Finds urgent business elsewhere when blades come out.',
    checkMods: [
      { skill: 'combat', value: -1, label: 'Craven' },
      { skill: 'stealth', value: 1, label: 'Craven' },
    ],
  },
  {
    id: 'silver_tongued',
    name: 'Silver-Tongued',
    description: 'Could sell salt to the sea.',
    checkMods: [{ skill: 'bargain', value: 1, label: 'Silver-Tongued' }],
  },
  {
    id: 'bookish',
    name: 'Bookish',
    description: 'Carries more books than clothes.',
    checkMods: [{ skill: 'lore', value: 1, label: 'Bookish' }],
  },
  {
    id: 'brawler',
    name: 'Brawler',
    description: 'Talks with fists first, which is a kind of fluency.',
    checkMods: [
      { tag: 'intimidation', value: 1, label: 'Brawler' },
      { skill: 'diplomacy', value: -1, label: 'Brawler' },
    ],
  },
  {
    id: 'kindhearted',
    name: 'Kindhearted',
    description: 'Cannot walk past someone in need. People remember.',
    checkMods: [
      { skill: 'diplomacy', value: 1, label: 'Kindhearted' },
      { tag: 'intimidation', value: -1, label: 'Kindhearted' },
    ],
  },
  {
    id: 'ruthless',
    name: 'Ruthless',
    description: 'Gets it done. Nobody asks how twice.',
    checkMods: [
      { tag: 'intimidation', value: 1, label: 'Ruthless' },
      { tag: 'natives', value: -1, label: 'Ruthless' },
    ],
  },
  {
    id: 'wanderer',
    name: 'Wanderer',
    description: 'Has slept under a hundred skies.',
    checkMods: [{ skill: 'survival', value: 1, label: 'Wanderer' }],
  },
  {
    id: 'homesick',
    name: 'Homesick',
    description: 'Half of them never left the homeland.',
    checkMods: [{ skill: 'leadership', value: -1, label: 'Homesick' }],
    recoverable: true,
  },
  {
    id: 'lucky',
    name: 'Lucky',
    description: 'The dice love them. Until they don’t.',
    checkMods: [{ tag: 'gamble', value: 1, label: 'Lucky' }],
  },
  {
    id: 'cursed',
    name: 'Cursed',
    description: 'The Bejasi Hills folk look at them and make signs.',
    checkMods: [
      { tag: 'gamble', value: -1, label: 'Cursed' },
      { tag: 'ritual', value: 1, label: 'Cursed' },
    ],
  },
  {
    id: 'iron_willed',
    name: 'Iron-Willed',
    description: 'Bends for nothing and no one.',
    checkMods: [{ skill: 'leadership', value: 1, label: 'Iron-Willed' }],
  },
  {
    id: 'frail',
    name: 'Frail',
    description: 'The frontier is hard on a body not built for it.',
    checkMods: [
      { skill: 'combat', value: -1, label: 'Frail' },
      { skill: 'survival', value: -1, label: 'Frail' },
    ],
  },
  {
    id: 'pious',
    name: 'Pious',
    description: 'Keeps the observances, even out here.',
    checkMods: [{ tag: 'ritual', value: 1, label: 'Pious' }],
  },
  {
    id: 'shaken',
    name: 'Shaken',
    description: 'Something cracked and has not yet set.',
    checkMods: [
      { skill: 'leadership', value: -1, label: 'Shaken' },
      { skill: 'combat', value: -1, label: 'Shaken' },
    ],
    recoverable: true,
  },
  {
    id: 'friend_river_clans',
    name: 'Friend of the Tributary Towns',
    description: 'Welcome at their fires; watched by their rivals.',
    checkMods: [
      { tag: 'RIVER_CLANS', value: 2, label: 'Friend of the Tributary Towns' },
      { tag: 'HILL_TRIBES', value: -1, label: 'Friend of the Tributary Towns' },
    ],
  },
  {
    id: 'friend_hill_tribes',
    name: 'Friend of the Dustwalkers',
    description: 'Welcome at their fires; watched on the river.',
    checkMods: [
      { tag: 'HILL_TRIBES', value: 2, label: 'Friend of the Dustwalkers' },
      { tag: 'RIVER_CLANS', value: -1, label: 'Friend of the Dustwalkers' },
    ],
  },

  // Union traits (FAMILY_SPEC.md §5.4): flavor markers content reads for in-law
  // chains and reactions. No standing check-mods in v1.
  {
    id: 'wed',
    name: 'Wed',
    description: 'Married to a certified homeland spouse, brought upriver from Thornwatch.',
    checkMods: [],
  },
  {
    id: 'wed_river',
    name: 'Wed to the Tributary Towns',
    description: 'Married into the river towns — an alliance sealed the old way.',
    checkMods: [{ tag: 'RIVER_CLANS', value: 2, label: 'Wed to the Tributary Towns' }],
  },
  {
    id: 'wed_hills',
    name: 'Wed to the Dustwalkers',
    description: 'Married into the drylands clans — kin now, by the matriarchs’ leave.',
    checkMods: [{ tag: 'HILL_TRIBES', value: 2, label: 'Wed to the Dustwalkers' }],
  },
  {
    id: 'wed_bejasi',
    name: 'Wed to the Old People',
    description: 'Married into the Bejasi hills — a rare and watched-over bond.',
    checkMods: [{ tag: 'OLD_PEOPLE', value: 2, label: 'Wed to the Old People' }],
  },
  {
    id: 'informal_household',
    name: 'Hearth-Companion',
    description: 'Keeps an informal household by frontier custom — no ceremony, no Company blessing.',
    checkMods: [],
  },
  {
    id: 'wed_orc',
    name: 'Wed to a War-Band',
    description: 'Married into an orc war-band by its own reckoning — an alliance most factors would rather not hear about.',
    checkMods: [{ tag: 'BEASTFOLK', value: 2, label: 'Wed to a War-Band' }],
  },
  {
    id: 'wed_goblin',
    name: 'Wed to a Goblin Clan',
    description: 'Married into a goblin clan — chosen, not taken, and rarer for it.',
    checkMods: [{ tag: 'BEASTFOLK', value: 2, label: 'Wed to a Goblin Clan' }],
  },
];

export const TRAIT_DEFS: ReadonlyMap<string, TraitDef> = uniqueIdMap('trait', TRAITS);
export const TRAIT_NAMES: ReadonlyMap<string, string> = new Map(
  [...TRAIT_DEFS].map(([id, trait]) => [id, trait.name]),
);
