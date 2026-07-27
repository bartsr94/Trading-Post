// Goblins — a chaotic, whimsical lot: a nuisance to plan around, not a
// threat like the Orcs (BEASTFOLK_SPEC.md). Mechanically still on the same
// BEASTFOLK standing track as Orcs (same faction, same low/high arc: tribute
// pressure at hostile standing, a voluntary match as trust rises), but given
// their own directory (2026-07-27, EVENT_ORGANIZATION_SPEC.md) so their tone
// can diverge cleanly from the Orc content in ../orc/ — see
// firstEncounter.ts for the clearest example (a comedic branching scene vs.
// beastfolk_first_encounter's grim standoff).
//
// Ids are a mix: legacy events kept their original `beastfolk_goblin_*` id
// when relocated here (no renames — see CLAUDE.md's stable-id convention),
// while new content (firstEncounter.ts) uses the `goblin_` prefix, mirroring
// `harpy_`.
//
// Goblin lore is game-specific and not yet written down in docs/lore/, so
// these events intentionally carry no `loreRef` — same status as Orc/Harpy
// content (see ../orc/index.ts).

import type { GameEvent } from '../../../engine/events/types';
import { GOBLIN_FIRST_ENCOUNTER_EVENTS } from './firstEncounter';
import { GOBLIN_INTEGRATION_EVENTS } from './integration';
import { GOBLIN_MATCH_EVENTS } from './match';
import { GOBLIN_TRIBUTE_EVENTS } from './tribute';

export const GOBLIN_EVENTS: GameEvent[] = [
  ...GOBLIN_TRIBUTE_EVENTS,
  ...GOBLIN_MATCH_EVENTS,
  ...GOBLIN_FIRST_ENCOUNTER_EVENTS,
  ...GOBLIN_INTEGRATION_EVENTS,
];
