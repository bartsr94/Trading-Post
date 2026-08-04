// Harpies (TERRITORY_DISCOVERY_SPEC.md §6) — the Ashmark's winged people of the
// high Stormwall crags. A full settleable people, seatless like the Beastfolk:
// no aerie speaks for the rest, so standing moves only through events, and the
// same low→high arc applies — tribute pressure at hostile standing, a voluntary
// union as trust rises, settlement at the top, then the slow work of settling
// in. Gated on the Windward Crags (harpy_eyrie) being discovered; content
// mirrors the Beastfolk set beat-for-beat (see ../beastfolk/).
//
// Harpy lore is game-specific and not yet written down in docs/lore/, so these
// events carry no `loreRef` (nothing to point at yet) — add one once it lands.
//
// Split by narrative arc across this directory (EVENT_ORGANIZATION_SPEC.md),
// mirroring ../beastfolk/'s layout. No flavor arc yet — add new arc files
// here as they land. `firstEncounter.ts` is the discovery-moment chain
// (WILDS_FIRST_ENCOUNTER_SPEC.md), directly queued via `harpy_eyrie`'s
// `LocationDef.discoveryEventId`, not drawn by the weighted pool.

import type { GameEvent } from '../../../engine/events/types';
import { HARPY_FIRST_ENCOUNTER_EVENTS } from './firstEncounter';
import { HARPY_INTEGRATION_EVENTS } from './integration';
import { HARPY_MATCH_EVENTS } from './match';
import { HARPY_SETTLEMENT_EVENTS } from './settlement';
import { HARPY_TRIBUTE_EVENTS } from './tribute';

export const HARPY_EVENTS: GameEvent[] = [
  ...HARPY_FIRST_ENCOUNTER_EVENTS,
  ...HARPY_TRIBUTE_EVENTS,
  ...HARPY_MATCH_EVENTS,
  ...HARPY_SETTLEMENT_EVENTS,
  ...HARPY_INTEGRATION_EVENTS,
];
