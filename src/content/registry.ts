// Assembles all content into the TurnContext the engine consumes.

import type { TurnContext } from '../engine/turn';
import { EVENT_MAP } from './events';
import { GOOD_DEFS, GOOD_NAMES } from './goods';
import { FACTION_NAMES } from './factions';
import { TRAIT_DEFS, TRAIT_NAMES } from './traits';

export const CONTENT: TurnContext = {
  events: EVENT_MAP,
  goodDefs: GOOD_DEFS,
  traitDefs: TRAIT_DEFS,
  goodNames: GOOD_NAMES,
  factionNames: FACTION_NAMES,
  traitNames: TRAIT_NAMES,
};
