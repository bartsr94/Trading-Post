# Documentation Update Protocol

We have just completed a piece of work in this conversation. Your job is to
reflect what was built or changed in the relevant existing documentation.
Update only what changed — do not rewrite docs from scratch, and do not do a
general audit of unrelated content.

This file (`docs.md`) holds the full protocol. The related commands —
`/update`, `/update-file`, `/diff`, `/changelog`, `/summary`, `/commands` —
each run a specific slice of it; see `.claude/commands/commands.md` for the
menu. Running `/docs` on its own does step 1 only: scan and report, no edits.

## Step 1: Review the work

Look back over this conversation for what actually changed: code written,
decisions made, patterns established, config changed, commands added or
removed, backlog items closed.

## Step 2: Identify affected docs

Use this project's actual doc set and the routing guide below — don't guess
at files that don't exist, and don't touch `docs/EVENT_CATALOG.md` (it's
regenerated, never hand-edited — see `docs/ADDING_EVENTS.md`).

### File Routing Guide

| Change type | File to update |
|---|---|
| A feature/mechanic shipped, or existing behavior changed | `docs/GAME_FEATURES.md` — add or update its section. This is the only file under `docs/` actually tracked in git (see Gotchas below) and is the always-current "what's true now" reference. |
| A backlog item got closed by this work | `docs/TODO_FEATURES.md` — remove or check off the closed item. |
| Open design questions changed for a feature still in progress | The matching `docs/<FEATURE>_SPEC.md` (e.g. `FAMILY_PHASE_D_SPEC.md`, `TRADING_ECONOMY_SPEC.md`, `TURN_CADENCE_SPEC.md`, `ARCHITECTURE_CLEANUP_SPEC.md`). Trim it to only what's still genuinely open — once a feature fully ships, fold the built version into `GAME_FEATURES.md` and either delete the spec file or cut it down further. Don't let the two duplicate each other. |
| A new cross-cutting architecture pattern, gotcha, or hard rule with no other home (not a feature description) | `CLAUDE.md` — keep it short; feature behavior belongs in `GAME_FEATURES.md`, not here. |
| The event-authoring checklist or convention changed | `docs/ADDING_EVENTS.md`. |
| Stack, setup steps, npm commands, or the high-level project description changed | `README.md`. |
| New Ashmark-region lore/worldbuilding was authored (rare — most content work doesn't touch this) | `docs/lore/*.md`. |

### Gotchas that affect how you stage changes (not what you write)

- Everything under `docs/` is gitignored **except** `docs/GAME_FEATURES.md`
  (see the repo's `.gitignore`). Update the working copies of the other spec/
  backlog files as usual — Bartosz keeps them local — just don't expect or
  force them into a commit.
- `CLAUDE.md` is also gitignored. Never `git add`/commit it, even though it
  reads like a checked-in file.

## Step 3: Propose changes

For each affected file, state:
- The section to update and why
- The new content to add
- Anything now outdated that should be removed or corrected

## Step 4: Wait for approval, then update one file at a time

Don't batch-edit. Apply one file, move to the next.

## Rules

- Only update what the completed work actually affects — no general audit
- Match the existing tone, voice, and formatting of each document
- Do not add sections that don't already exist unless explicitly asked
- Keep updates concise — reflect the change, don't over-document it
- If something was removed or deprecated, remove or strike it from the docs too
- Never describe a feature in `CLAUDE.md` — that belongs in `GAME_FEATURES.md`
