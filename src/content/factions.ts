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
    name: 'The Hanjoda Nomads',
    blurb:
      'The Hanjoda horse-tribes of the drylands — Dustwalker, Sunspear, and Redsand — who coordinate but bow to none. Determinedly neutral between Company and Cult, they broker the overland routes by right of mobility, not walls.',
    startingStanding: -10,
  },
  {
    id: 'OLD_PEOPLE',
    name: 'The Bejasi Hills Folk',
    blurb:
      'Kiswani settlements — Themba\'s Town chief among them — built among pre-Sauromatian ruins deep in the jungle interior. Ritual, riddles, and the only known amber workings.',
    startingStanding: 0,
  },
  {
    id: 'CHARTER_COMPANY',
    name: 'The Ansberry Company',
    blurb:
      'Your charter sponsor, seated at the Thornwatch garrison downriver. They want profit shipments and send inspectors to make sure.',
    startingStanding: 25,
  },
  {
    id: 'KNIGHTS_EIRWEN',
    name: 'The Knights of Saint Eirwen',
    blurb:
      'An Imanian holy order holding the Stormwall pass at Pemba-Jasiri, where the rare Weri metalworkers keep their forges. Allied to the Company in the broad Imanian cause, but their own power, with their own price.',
    startingStanding: 0,
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
