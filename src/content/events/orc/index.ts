// Orcs (BEASTFOLK_SPEC.md), on the shared BEASTFOLK standing track: low
// standing brings demand/tribute pressure (never a raid — that stays a
// deliberately separate, not-yet-built system, spec §1); high standing opens
// a voluntary path, since Orcs have no chief who can be courted the
// traditional way — individuals approach the post themselves. Tone per
// CLAUDE.md: second person, terse, 60–120 words, choices as intentions.
//
// This directory also still holds the content genuinely about BOTH Orcs and
// Goblins together (settlement.ts, most of flavor.ts) — it doesn't split
// cleanly by people, so it stays here as the joint/default home rather than
// living in ../goblin/ or nowhere. Goblin-only content moved out to
// ../goblin/ (2026-07-27, EVENT_ORGANIZATION_SPEC.md addendum) precisely
// because Goblins needed their own tone; this directory was renamed from
// `beastfolk/` to `orc/` at the same time to reflect that it's now Orcs'
// primary home (plus that leftover joint content).
//
// Orc/goblin peoples are new, game-specific lore being actively built out —
// not yet consolidated into docs/lore/, so these events intentionally carry
// no `loreRef` (nothing to point at yet). Confirmed with Bartosz 2026-07-24:
// the naming overlap with docs/lore/World of Palusteria.md's unrelated
// "Beastfolk" (the Al'Rakasha hybrid races) is fine as-is, and beast_wilds
// sitting inside the Ashmark.md/Western Nomadic Tribes.md Hanjoda/Cult
// region is not a conflict to resolve. Add a `loreRef` here once this
// worldbuilding gets written down properly.
//
// Split by narrative arc across this directory (EVENT_ORGANIZATION_SPEC.md)
// rather than one growing file — see the per-file headers for what each arc
// covers, and each event's `arc` field for the cross-file grouping tag.

import type { GameEvent } from '../../../engine/events/types';
import { ORC_FIRST_ENCOUNTER_EVENTS } from './firstEncounter';
import { ORC_FLAVOR_EVENTS } from './flavor';
import { ORC_INTEGRATION_EVENTS } from './integration';
import { ORC_MATCH_EVENTS } from './match';
import { ORC_SETTLEMENT_EVENTS } from './settlement';
import { ORC_TRIBUTE_EVENTS } from './tribute';

export const ORC_EVENTS: GameEvent[] = [
  ...ORC_TRIBUTE_EVENTS,
  ...ORC_MATCH_EVENTS,
  ...ORC_SETTLEMENT_EVENTS,
  ...ORC_FIRST_ENCOUNTER_EVENTS,
  ...ORC_INTEGRATION_EVENTS,
  ...ORC_FLAVOR_EVENTS,
];
