// Building prose — names + blurbs (spec §9 voice). All balance numbers (cost,
// effort, prerequisites, effects) live in TUNING.building.defs, keyed by the
// same ids (BUILDINGS_SPEC.md §5). The engine never imports this file.

import type { BuildingId } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

export interface BuildingInfo {
  id: BuildingId;
  name: string;
  blurb: string;
  /** Presentation-only grouping for the Buildings panel; the engine never reads it. */
  category?: 'core' | 'culture' | 'prestige';
}

export const BUILDINGS: BuildingInfo[] = [
  {
    id: 'storehouse',
    name: 'Storehouse',
    blurb:
      'A dry roof and raised staging for the stockpile — room to keep more, and more hands willing to stay where the goods are safe.',
    category: 'core',
  },
  {
    id: 'palisade',
    name: 'Palisade',
    blurb:
      'A ring of sharpened timber and a gate that bars. The frontier stops being able to simply walk in at night.',
    category: 'core',
  },
  {
    id: 'trade_hall',
    name: 'Trade Hall',
    blurb:
      'A proper floor to haggle on, out of the weather. Caravans linger longer when there is somewhere warm to strike a bargain.',
    category: 'core',
  },
  {
    id: 'common_house',
    name: 'Common House',
    blurb:
      'A hearth big enough for everyone, and bunks besides. Somewhere to gather takes the edge off a hard season.',
    category: 'core',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    blurb:
      'Benches, a forge, and tools that stay put. Raw goods come out the far end worth more than they went in.',
    category: 'core',
  },
  // -------------------------------------------------------------- Phase B: tier-2 upgrades
  {
    id: 'storehouse_ii',
    name: 'Grand Storehouse',
    blurb:
      'A second floor and a longer roofline. What used to spill into the yard now has a shelf of its own — and word of the room draws people willing to fill it.',
    category: 'core',
  },
  {
    id: 'palisade_ii',
    name: 'Stone Rampart',
    blurb:
      'Timber gives way to dressed stone where the guards have earned the labor to lay it. A wall that outlasts the men who raised it.',
    category: 'core',
  },
  {
    id: 'workshop_ii',
    name: 'Foundry',
    blurb:
      'A second forge, a deeper bellows, and craftsfolk enough to keep both lit day and night. What the Workshop mends, the Foundry remakes.',
    category: 'core',
  },
  // -------------------------------------------------------------- Phase B: base set (cont.)
  {
    id: 'infirmary',
    name: 'Infirmary',
    blurb:
      'Clean linens, a stocked cabinet, and someone who knows what to do with both. The difference between a wound that heals and one that festers.',
    category: 'core',
  },
  {
    id: 'watchtower',
    name: 'Watchtower',
    blurb:
      'A platform above the palisade line, manned in shifts. Trouble on the tree line gets seen long before it reaches the gate.',
    category: 'core',
  },
  // -------------------------------------------------------------- Phase B: culture-tied
  {
    id: 'river_shrine',
    name: 'Rivermeet Shrine',
    blurb:
      'A modest shrine raised in the Kiswani way, its posts carved with river-marks. The native families at the post finally have somewhere of their own to keep.',
    category: 'culture',
  },
  {
    id: 'goblin_warren',
    name: 'Goblin Warren',
    blurb:
      "A warren of tunnels and lean-tos dug into the yard's edge, thick with goblin ingenuity and goblin clutter. The post's goblins finally have a place that is theirs, not borrowed.",
    category: 'culture',
  },
  {
    id: 'orc_longhouse',
    name: 'Orc Longhouse',
    blurb:
      'A long, low hall built to orc scale and orc custom — heavy timbers, a central fire, benches enough for a whole clan. It stands as proof the wilds and the post can share ground.',
    category: 'culture',
  },
  // -------------------------------------------------------------- Phase B: wealth-gated
  {
    id: 'counting_house',
    name: 'Counting House',
    blurb:
      "A vault, a ledger-room, and a clerk who trusts no one's arithmetic but his own. Only a post already flush with silver has any real use for one.",
    category: 'prestige',
  },
  // -------------------------------------------------------------- Phase B: trade-route pair
  {
    id: 'dock',
    name: 'Dock',
    blurb:
      'Pilings driven into the bank and a landing wide enough for two barges abreast. A caravan that used to wade its cargo ashore now simply walks it off.',
    category: 'core',
  },
  {
    id: 'stables',
    name: 'Stables',
    blurb:
      'Stalls, feed, and a farrier who keeps every shoe sound. A party riding out on fresh, well-shod mounts makes better time and a better impression than one that walked.',
    category: 'core',
  },
];

export const BUILDING_INFO: ReadonlyMap<BuildingId, BuildingInfo> = uniqueIdMap(
  'building',
  BUILDINGS,
);
export const BUILDING_NAMES = new Map<BuildingId, string>(
  [...BUILDING_INFO].map(([id, building]) => [id, building.name]),
);
