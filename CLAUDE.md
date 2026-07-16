# CLAUDE.md

Guidance for agents working on **The Trading Post** — a KoDP-inspired narrative
trading game (Vite + React + TypeScript, strict mode).

## Read this first

The authoritative design document is `docs/TRADING_POST_SPEC.md`. **`docs/` is
gitignored on purpose** (Bartosz keeps design docs local — don't commit them,
and don't remove that ignore rule). If the spec file is missing in your
checkout, ask Bartosz for it before making design decisions.

Current status: **MVP 1 complete** (core loop, heroes, visible dice checks,
event engine, post market, saves). Next milestone is **MVP 2** (spec §12):
map + caravans, buildings + tier advancement, full faction diplomacy +
Charter quota, roster churn + recruitment chains, event count toward ~60.

## Hard rules (from the spec, §14)

1. **`src/engine/` stays pure.** No React imports, no DOM, no content
   knowledge beyond `content/tuning.ts`. Everything in engine must be
   unit-testable without rendering. Content (names, events, hero data) is
   injected via `TurnContext` (see `engine/turn.ts`) — keep it that way.
2. **Content never grows inside engine files.** A new event, trait, hero, or
   good is a data entry in `src/content/` only. If an engine change seems
   needed for one event, add a generic mechanism (new `Condition`/`Outcome`
   variant), never a special case.
3. **All balance numbers live in `content/tuning.ts`.** No magic numbers in
   engine code — if you add a tunable, add it there.
4. **Ask Bartosz before adding systems not in the spec.** Bond values,
   difficulty modes, etc. are open questions (spec §13), not invitations.

## Architecture notes

- **State**: one serializable `GameState` (`engine/types.ts`). The Zustand
  store (`store/gameStore.ts`) clones via `structuredClone`, mutates the draft
  with pure engine functions, commits. Components never mutate state.
- **RNG**: mulberry32; the stream position lives in `GameState.rngState`.
  Every engine function that rolls takes/returns RNG state (via the `Rng`
  wrapper). Never use `Math.random()` in engine code — UI-only animation
  (e.g. `DiceRoll.tsx` tumbling) is the one sanctioned exception.
- **Turn flow**: `resolveTurn` (economy tick → activities → event selection)
  → player resolves `pendingEvents` one at a time via `resolveChoice` +
  `advancePendingEvent` → report phase → `advanceTurn` (season-end skill
  growth every 6th turn). Autosave happens in store actions, once per phase
  transition.
- **Events**: typed data (`engine/events/types.ts`). Known deviation from the
  spec's interface: each result tier is `{ text, outcomes }` (`TierResult`),
  so tiers carry narrative text — deliberate, keep it. Missing tiers fall
  back crit→normal, failure→success. Chain events use `weight: 0` +
  `queueEvent` outcomes; the breakdown event id is referenced from
  `tuning.stress.breakdownEventId`.
- **Saves**: `saveVersion` + migration stub in `engine/save.ts`. Any change
  to the `GameState` shape requires bumping `TUNING.save.version` and adding
  a migration case — the tests enforce that unknown versions throw.

## Conventions

- Content event ids are prefixed by category: `post_`, `hero_`, `season_`.
  Hero-hook events embed the pool id (`hero_p5_poachers`) and gate on
  `{ type: 'heroInParty', heroId: 'p5' }`.
- Event writing tone (spec §9): second person, terse, concrete, 60–120 words
  of body text; choices phrased as intentions ("Offer the chief your own
  sword"), never mechanics ("+2 standing"). `{hero}` interpolates the bound
  hero's name. Check tags (`'intimidation'`, `'hunting'`, `'gamble'`,
  `'ritual'`, `'strangers'`, `'natives'`, faction ids) hook trait modifiers —
  reuse existing tags before inventing new ones.
- Anything marked `[PALUSTERIA LORE]` (hero names/bios, faction identities,
  the `herbs` good) is a placeholder Bartosz will replace. Keep the markers.
- Tests live in `src/engine/__tests__/`; shared fixtures in `helpers.ts`.
  `simulation.test.ts` plays whole seeded years headlessly — extend it when
  adding mechanics; it's the cheapest way to catch loop-breaking regressions.
  Every event must always leave at least one choice available (the simulation
  asserts this).

## Commands

```sh
npm run dev    # dev server, http://localhost:5173
npm test       # Vitest engine suite — keep it green
npm run build  # tsc -b && vite build — must pass before pushing
```

Gotcha: `TUNING` is `as const`, so its literals narrow — annotate accumulator
variables (`let x: number = TUNING...`) when arithmetic follows.

## Git

- Repo: https://github.com/bartsr94/Trading-Post (branch `main`).
- Windows machine; git warns about LF→CRLF on every commit — harmless, ignore.
- Run `npm test` and `npm run build` before pushing.
