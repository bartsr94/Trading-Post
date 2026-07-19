// Building prose — names + blurbs (spec §9 voice). All balance numbers (cost,
// effort, prerequisites, effects) live in TUNING.building.defs, keyed by the
// same ids (BUILDINGS_SPEC.md §5). The engine never imports this file.

import type { BuildingId } from '../engine/types';

export interface BuildingInfo {
  id: BuildingId;
  name: string;
  blurb: string;
}

export const BUILDINGS: BuildingInfo[] = [
  {
    id: 'storehouse',
    name: 'Storehouse',
    blurb:
      'A dry roof and raised staging for the stockpile — room to keep more, and more hands willing to stay where the goods are safe.',
  },
  {
    id: 'palisade',
    name: 'Palisade',
    blurb:
      'A ring of sharpened timber and a gate that bars. The frontier stops being able to simply walk in at night.',
  },
  {
    id: 'trade_hall',
    name: 'Trade Hall',
    blurb:
      'A proper floor to haggle on, out of the weather. Caravans linger longer when there is somewhere warm to strike a bargain.',
  },
  {
    id: 'common_house',
    name: 'Common House',
    blurb:
      'A hearth big enough for everyone, and bunks besides. Somewhere to gather takes the edge off a hard season.',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    blurb:
      'Benches, a forge, and tools that stay put. Raw goods come out the far end worth more than they went in.',
  },
];

export const BUILDING_NAMES = new Map<BuildingId, string>(BUILDINGS.map((b) => [b.id, b.name]));
export const BUILDING_INFO = new Map<BuildingId, BuildingInfo>(BUILDINGS.map((b) => [b.id, b]));
