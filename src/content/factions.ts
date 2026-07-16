// Factions (spec §8). Names and cultures are [PALUSTERIA LORE] placeholders.

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
    name: 'The River Clans', // [PALUSTERIA LORE]
    blurb: 'Trade-friendly boat people of the lowland rivers. Quick to deal, quicker to feud.',
    startingStanding: 10,
  },
  {
    id: 'HILL_TRIBES',
    name: 'The Hill Tribes', // [PALUSTERIA LORE]
    blurb: 'Wary, martial herders of the high country. They control the fur routes.',
    startingStanding: -10,
  },
  {
    id: 'OLD_PEOPLE',
    name: 'The Old People', // [PALUSTERIA LORE]
    blurb: 'A remnant folk of the deep woods. Ritual, riddles, and the only known amber.',
    startingStanding: 0,
  },
  {
    id: 'CHARTER_COMPANY',
    name: 'The Charter Company',
    blurb: 'Your homeland sponsors. They want profit shipments and send inspectors to make sure.',
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
