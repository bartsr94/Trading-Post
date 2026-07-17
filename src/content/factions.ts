// Factions (spec §8). Ashmark grounding per docs/ASHMARK_LORE_SPEC.md.

import type { FactionId } from '../engine/types';

export interface FactionDef {
  id: FactionId;
  name: string;
  blurb: string;
  startingStanding: number;
}

export const FACTIONS: FactionDef[] = [
  {
    id: 'RIVER_CLANS',
    name: 'The Tributary Towns',
    blurb:
      'Independent Kiswani river towns strung along the tributary above Thornwatch — Njaro-Matu chief among them. Trade-friendly, matriarchal, quick to deal and quicker to feud.',
    startingStanding: 10,
  },
  {
    id: 'HILL_TRIBES',
    name: 'The Dustwalkers',
    blurb:
      'A Hanjoda-descended nomadic tribe, horse-herders ranging the drylands west of the tributary. Wary of every outside power and answerable to none — they broker the overland trade routes by right of mobility, not walls.',
    startingStanding: -10,
  },
  {
    id: 'OLD_PEOPLE',
    name: 'The Bejasi Hills Folk',
    blurb:
      'Isolated settlements — Themba\'s Town chief among them — built among pre-Sauromatian ruins deep in the jungle interior. Ritual, riddles, and the only known amber workings.',
    startingStanding: 0,
  },
  {
    id: 'CHARTER_COMPANY',
    name: 'The Ansberry Company',
    blurb:
      'Your charter sponsor, seated at the Thornwatch garrison downriver. They want profit shipments and send inspectors to make sure.',
    startingStanding: 25,
  },
];

export const FACTION_DEFS: ReadonlyMap<FactionId, FactionDef> = new Map(
  FACTIONS.map((f) => [f.id, f]),
);
export const FACTION_NAMES: ReadonlyMap<string, string> = new Map(
  FACTIONS.map((f) => [f.id, f.name]),
);
export const STARTING_STANDINGS: Partial<Record<FactionId, number>> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f.startingStanding]),
);
