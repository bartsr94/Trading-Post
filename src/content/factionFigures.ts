// Named faction figures (NAMED_NPCS_SPEC.md): individuals belonging to a
// faction/people, met through events rather than recruited from a menu.
// Shaped as engine `FactionFigureDef`s (content-only; the engine builds the
// runtime `FactionFigure` from these, injected via TurnContext like
// `RecruitDef`). Goblins are the pilot people — see
// content/events/goblin/tallykeeper.ts for the event chain that introduces,
// antagonizes, recruits, or marries her out.

import type { FactionFigureDef } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

export const FACTION_FIGURES: FactionFigureDef[] = [
  {
    id: 'goblin_tallykeeper',
    name: 'Yikka',
    epithet: 'the Tallykeeper',
    portraitKey: 'goblin_female_02',
    heritage: 'goblin',
    gender: 'female',
    faction: 'BEASTFOLK',
    bio: 'The one who keeps the tally stick for every snare sprung on the goblin road — less a chieftain than a self-appointed record-keeper, though nobody in the band argues with her about it anymore. She remembers every name scored into that stick, and lately, one in particular.',
    stats: { might: 1, agility: 4, wits: 5, charm: 3, resolve: 3 },
    skills: { stealth: 3, bargain: 2, survival: 2 },
    traits: [],
  },
];

/** id → FactionFigureDef, injected into the engine via TurnContext. */
export const FACTION_FIGURE_DEFS: ReadonlyMap<string, FactionFigureDef> = uniqueIdMap(
  'factionFigure',
  FACTION_FIGURES,
);
