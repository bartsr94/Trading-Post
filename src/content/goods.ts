// Goods (spec §7). Pure data.

import type { GoodDef } from '../engine/economy';
import type { GoodId } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

export const GOODS: GoodDef[] = [
  {
    id: 'furs',
    name: 'Furs',
    basePrice: 12,
    seasonalMods: { spring: 1.0, summer: 0.7, autumn: 1.1, winter: 1.4 },
    note: 'Frontier staple. Native supply, prized in winter.',
  },
  {
    id: 'hides',
    name: 'Hides',
    basePrice: 5,
    seasonalMods: { spring: 1.0, summer: 1.0, autumn: 1.1, winter: 1.0 },
    note: 'Bulk goods, low margin.',
  },
  {
    id: 'grain',
    name: 'Grain',
    basePrice: 3,
    seasonalMods: { spring: 1.2, summer: 1.0, autumn: 0.7, winter: 1.4 },
    note: 'Food. The post consumes it every turn.',
  },
  {
    id: 'salt',
    name: 'Salt',
    basePrice: 8,
    seasonalMods: { spring: 1.0, summer: 1.0, autumn: 1.1, winter: 1.0 },
    note: 'Preservative. Steady demand everywhere.',
  },
  {
    id: 'tools',
    name: 'Tools',
    basePrice: 15,
    seasonalMods: { spring: 1.1, summer: 1.0, autumn: 1.0, winter: 0.9 },
    note: 'Imported from the homeland. The natives want them.',
  },
  {
    id: 'cloth',
    name: 'Cloth',
    basePrice: 14,
    seasonalMods: { spring: 1.0, summer: 1.0, autumn: 1.0, winter: 1.1 },
    note: 'Imported status good.',
  },
  {
    id: 'timber',
    name: 'Timber',
    basePrice: 4,
    seasonalMods: { spring: 1.0, summer: 0.9, autumn: 1.0, winter: 1.2 },
    note: 'Local. Feeds construction.',
  },
  {
    id: 'amber',
    name: 'Amber',
    basePrice: 40,
    seasonalMods: { spring: 1.0, summer: 1.0, autumn: 1.0, winter: 1.0 },
    note: 'Luxury. Jungle resin dug from old workings; the Bejasi Hills folk know its sources.',
  },
  {
    id: 'herbs',
    name: 'Greyleaf',
    basePrice: 20,
    seasonalMods: { spring: 1.2, summer: 1.0, autumn: 0.8, winter: 1.1 },
    note: 'A bitter marsh herb from the Black Mere margins; rivermen chew it against fever.',
  },
];

export const GOOD_DEFS: ReadonlyMap<GoodId, GoodDef> = uniqueIdMap('good', GOODS);
export const GOOD_NAMES: ReadonlyMap<GoodId, string> = new Map(
  [...GOOD_DEFS].map(([id, good]) => [id, good.name]),
);
