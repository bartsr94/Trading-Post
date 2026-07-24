# CLAUDE.md

Guidance for agents working on **The Trading Post** — a KoDP-inspired narrative
trading game (Vite + React + TypeScript, strict mode).

## Read this first

**`docs/GAME_FEATURES.md` is the authoritative reference for what the game
currently does** — read it for any question about current mechanics. This
file (`CLAUDE.md`) stays focused on *how the codebase is organized* —
architecture, conventions, gotchas, hard rules — and should stay short. **Do
not re-describe a feature here.** If you ship something, add/update its
section in `docs/GAME_FEATURES.md` (and `docs/TODO_FEATURES.md` if it closes
a backlog item); only add to this file if it's a genuine cross-cutting
architecture pattern, gotcha, or convention with no other home.

Other docs in `docs/` (all gitignored — Bartosz keeps them local, don't
commit them or remove the ignore rule; ask him if they're missing from your
checkout before making design/lore calls):
- `docs/TODO_FEATURES.md` — the open design/feature backlog, organized by
  system. This and `GAME_FEATURES.md` are the only two places tracking
  shipped-vs-open status; don't duplicate that bookkeeping here.
- `docs/*_SPEC.md` (a handful remain, e.g. `FAMILY_PHASE_D_SPEC.md`) — hold
  **only** still-open design for their area, not full specs to cross-check
  shipped behavior against.
- `docs/lore/` — pure Ashmark-region worldbuilding reference (`Ashmark.md`,
  `Ansberry Company.md`, `World of Palusteria.md`, `Sauromatia.md`, etc.),
  never a feature spec. Fully consumed into `src/content/` already.
- `docs/ADDING_EVENTS.md` — the event-authoring checklist (trigger
  mechanism, id/binding conventions, cataloging metadata, lore grounding).
- `docs/EVENT_CATALOG.md` — auto-generated, never hand-edit it (see the
  Event cataloging note below).

**Current status:** MVP 1 complete; MVP 2 underway. `docs/GAME_FEATURES.md`
lists everything shipped; `docs/TODO_FEATURES.md` lists everything still
open (including the unwired `charterRevoked` ending and the buildings/
Beastfolk/Family backlogs). For a live event count, run `npm run catalog`
rather than trusting a hand-tracked number.

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
   difficulty modes, etc. are open questions (`docs/TODO_FEATURES.md`),
   not invitations.

## Architecture notes

Each bullet below is a pattern, gotcha, or file pointer — not a feature
description. For what a system *does*, follow the `docs/GAME_FEATURES.md`
cross-reference.

- **State**: one serializable `GameState` (`engine/types.ts`). The Zustand
  store (`store/gameStore.ts`) clones via `structuredClone`, mutates the
  draft with pure engine functions, commits. Components never mutate state
  directly.
- **RNG**: mulberry32; the stream position lives in `GameState.rngState`.
  Every engine function that rolls takes/returns RNG state (via the `Rng`
  wrapper). Never use `Math.random()` in engine code — UI-only animation
  (`DiceRoll.tsx` tumbling) is the one sanctioned exception.
- **Turn flow & autosave** (`engine/turn.ts`, `store/gameStore.ts`; full
  `resolveTurn` pipeline in `docs/GAME_FEATURES.md` §1): new mutating store
  actions must pick the right autosave tier — immediate `autosave` for
  turn-phase-boundary actions, the 400ms-debounced `scheduleAutosave` for
  anything a player can fire repeatedly in a burst (buy/sell, dispatch,
  activate/bench, construction, land/resident reallocation, assignment
  changes). Route new assignment-phase actions through the existing
  `assignmentAction` wrapper in `gameStore.ts` rather than hand-rolling the
  phase-guard → clone → mutate → autosave → commit sequence again.
  `flushAutosave` is exported for tests that touch a debounced action and
  need a deterministic write instead of racing the timer.
- **Events**: typed data (`engine/events/types.ts`); chain-event mechanics
  (`queueEvent`/`continueChain`/`ChainVars`) are in `docs/GAME_FEATURES.md`
  §3. Two gotchas not covered there: `bindHero` takes an optional pool
  override so travel events only bind heroes in that expedition's party,
  and `TravelContext` must be threaded through `evalConditions`/
  `applyOutcomes` anywhere a choice might be evaluated outside the event
  panel (e.g. `simulation.test.ts`) — omit it and travel-only conditions
  silently evaluate false.
- **Event cataloging metadata** (`docs/ADDING_EVENTS.md` has the full
  authoring checklist): `GameEvent` carries three optional, engine-never-
  reads-them fields — `peoples`/`factions`/`loreRef` — for tracking which
  people/faction/lore doc an event is centrally about.
  `src/content/events/eventCatalog.generate.test.ts` rebuilds
  `docs/EVENT_CATALOG.md` from the live registry every `npm test` run
  (also runnable standalone via `npm run catalog`); its "Needs metadata"/
  "Structural oddities" sections are a soft self-check, deliberately not a
  build-time gate.
- **Spatial map & expeditions** (`engine/map.ts`, `engine/expeditions.ts`;
  see `docs/GAME_FEATURES.md` §6): perf gotchas not covered there — the fog
  grid can hit ~3072 `<polygon>`s, so if the map ever feels sluggish check
  `FogLayers`' `React.memo` and the rAF-coalesced wheel-zoom/drag-pan
  handlers in `MapScreen.tsx` before assuming it's the background image.
  The invisible `.map-node-hit` click target is `r=15` in the 1000×750 SVG
  viewBox. `map.test.ts` covers calibration/lifecycle; `map-functional.test.ts`
  holds the exhaustive geometry/access/grid/discovery matrix — split by
  design, not history.
- **Diplomacy & the Charter quota** (`engine/turn.ts`, `engine/expeditions.ts`;
  see `docs/GAME_FEATURES.md` §5): the Map screen cross-links into the
  Diplomacy/Market screens via a small generic store-level pattern
  (`openDiplomacy(seatId)`/`diplomacySeatFocus`/`clearDiplomacySeatFocus`,
  mirrored by `openMarket`/`marketDestinationFocus`) — copy this
  `*Focus`/`open*`/`clear*Focus` trio in `gameStore.ts` if a third screen
  ever needs the same "deep link with a preselected target" pattern.
- **Diplomacy discovery & first contact** (`engine/diplomacy.ts`; see
  `docs/GAME_FEATURES.md` §5): engine threading for `post_first_contact` —
  `QueuedEvent`/`ActiveEvent` gained an optional `locationId` (and
  `OutcomeContext` too) so `communityStanding`/`communityGrievance`/
  `communityPact` outcomes can default their `location` from it;
  `TextContext` gained `factionName`; `LocationDef` gained an optional
  `startingStanding` as a generic per-seat override (not a special case).
- **Residents** (`engine/residents.ts`; see `docs/GAME_FEATURES.md` §7):
  pure module — selectors (`residentTotal`/`residentCap`/`residentsAvailable`/
  `postDefense`/`contentmentBand`/`outputMultiplier`/`residentTagCounts`)
  and mutators (`addResidents`/`loseResidents`/`reallocate`/
  `updateContentment`/`applyDesertion`/`applyGrowth`/`applyAxisArrivals`)
  called from `turn.ts` and the store. `tags` is `Record<string, number>` —
  a genuine count, not presence-only (fixed 2026-07-21) — keep
  `debitTags`/`debitHeritage`'s proportional-split math in sync if you
  touch either.
- **Raiding** (`engine/raids.ts`; see `docs/GAME_FEATURES.md` §11 — no
  dedicated spec file for this ever shipped, the code + that section are the
  source of truth, so ask Bartosz before rebalancing rather than assuming
  the current numbers are deliberate): pure battle math + selectors, no
  content knowledge beyond an injected `RaidContext` (mirrors
  `TurnContext`). `defenderForceBreakdown` calls the shared `postDefense`
  rather than reimplementing it — keep it that way if the formula changes.
- **Characters & roster** (`engine/roster.ts`; see `docs/GAME_FEATURES.md`
  §8): key seam to remember — `livingHeroes` means *all* living named
  characters (feeds grain, drives `brokenCompany`), while `heroesAtPost` is
  `activeHeroes − away`, so event-protagonist binding and assignments
  exclude the reserve through that one selector alone. Don't reintroduce a
  second "who's actually workable" filter elsewhere.
- **Families** (`engine/family.ts`; see `docs/GAME_FEATURES.md` §8): pure
  graph module — selectors (`graphNode`/`spousesOf`/`childrenOf`/`isMixed`/
  `nodePeoples`/`dominantHeritage`/`marriageableKin`/`grownKinCount`/
  `canWed`/`unionError`) and mutators (`addDependant`/`removeDependant`/
  `formUnion`/`addChild`/`comeOfAge`/`recomputeBloodline`). Names come from
  `content/names.ts` (gender+heritage aware, deterministic by a
  dependant-id seed) via `TurnContext.dependantName`.
- **Buildings & construction** (`engine/buildings.ts`; see
  `docs/GAME_FEATURES.md` §12 for the full building list/effects): effects
  are **derived, never stored** — `buildingEffect(state, field)` sums a
  named field across the completed set purely, so a balance tweak in
  `TUNING.building.defs` never needs a migration. Generic vocabulary to
  reuse rather than special-case: outcomes `advanceTier`/`completeBuilding`/
  `addBuildProgress`; conditions `postTierAtLeast`/`postTierAtMost`/
  `hasBuilding`/`lacksBuilding`/`constructionActive`/`canAdvanceTier`;
  gating fields `minTier`/`prerequisites`/`requiresResidents`/
  `requiresHeritageGroup`/`requiresTag`/`requiresStanding`/`minSilverHeld`.
- **The Concession** (`engine/claim.ts`; see `docs/GAME_FEATURES.md` §7):
  pure — land selectors (`landChains`/`croplandCapacity`/`pastureCapacity`/
  `wildlandCapacity`/`herdCarryingCapacity`), `setLandAllocation`, per-turn
  farming (`accrueCropProgress`/`wildlandTrickle`/`growHerd`), the
  season-end `resolveHarvest`, and `addClaim`/`addHerd`. Generic
  vocabulary: outcomes `addClaim`/`setLandAllocation`/`addHerd`/`loseHerd`;
  conditions `claimAtLeast`/`claimBelow`/`herdAtLeast`/`overClaim`.
- **Peoples** (`engine/types.ts`; see `docs/GAME_FEATURES.md` §9):
  `subPeople` is free-form flavor/hire-routing only — the engine never
  branches on it, same discipline as location `tags`. Don't add a third
  `HeritageGroup` bucket without asking (a locked call — see §9).
- **Beastfolk** (see `docs/GAME_FEATURES.md` §10): added as a near-total
  content-only extension of the existing Heritage/faction/family
  machinery — no new engine mechanism. This is the pattern to follow for
  any future non-human or non-seated people.
- **Chain events** (see `docs/GAME_FEATURES.md` §3): `EventPanel.tsx`/
  `advancePendingEvent` needed no change for `continueChain` since both
  already just operate on `pendingEvents[0]`. `ConditionContext` gained one
  optional `chainVars` field, threaded at its two `choice.requires` call
  sites (`resolveChoice` in `turn.ts`, `EventPanel.tsx`).
- **UI shell** (`App.tsx`, `Sidebar.tsx`, `HeroBar.tsx`; see
  `docs/GAME_FEATURES.md` §13): **hard design rule (Bartosz) — no screen may
  scroll**, because a scrollbar hides information; split into a new screen
  instead. `e2e/no-scroll.spec.ts` enforces this at a 1280×720 floor across
  every screen and expanded state — keep new screens/states under that bar.
- **Icons** (`ui/components/Icon.tsx`): single-color stroke SVGs
  (`currentColor`), never emoji, for nav/expedition-kind/hero-bar chrome —
  add new glyphs to the `PATHS` map + `IconName` union. Emoji are fine in
  illustrative body copy (event/illustration placeholder text), just not in
  chrome components.
- **Portraits** (`ui/portraits.ts`, `ui/components/Portrait.tsx`; see
  `docs/GAME_FEATURES.md` §13 for the child-portrait pool/fallback
  behavior, and the Conventions section below for the filename grammar):
  dropping in a correctly-named image is the entire integration, no code
  changes needed. **Run new source art through
  `node scripts/optimize-images.mjs` before committing** — it resizes to
  `.hero-sheet-portrait`'s box (164×205, 2× via the script's
  `PORTRAIT_HEIGHT` constant — bump both together if that CSS box ever
  resizes) and converts to WebP; it also recompresses
  `assets/ui/ashmark_map.jpg` to the map SVG's stretched resolution as a
  side effect (harmless — comment out the script's `optimizeMap()` call
  for a run where that's an unwanted diff).
- **Cheat console** (`ui/components/CheatConsole.tsx`; see
  `docs/GAME_FEATURES.md` §14): adds no new engine mechanism — every button
  builds an `Outcome[]` and runs it through the real `applyOutcomes` via
  the exported `outcomeCtx` helper from `turn.ts`. Force-firing an event
  deliberately skips `once`/cooldown/`firedEvents` bookkeeping and excludes
  `category: 'travel'` events (no `TravelContext` available).
- **Saves**: `saveVersion` + migrations in `engine/save.ts` (version
  history: `docs/GAME_FEATURES.md` §16). Any `GameState` shape change bumps
  `TUNING.save.version` and adds a migration case — tests enforce unknown
  versions throw. Migrations that need content take an optional
  `MigrationContext`; thread it through `deserialize`/`loadAutosave` call
  sites when adding one.
- **Captivity** (`engine/captivity.ts`; see `docs/GAME_FEATURES.md` §17):
  the pattern to follow for any future orthogonal `HeroStatus`-like value —
  two real engine bugs this surfaced, worth re-checking next time: the
  due-chain binder in `events/selection.ts` resolves a pinned hero via
  `heroesAtPost`, and `advanceTurn` prunes non-`'active'`-hero
  `QueuedEvent`s assuming "not active" only ever meant dead/departed. Both
  now also accept `'captive'` — re-check both call sites if a 5th status is
  ever added.
- **Reusable helpers from past cleanup passes** (nothing left to do here,
  just don't re-derive these): `activeHeroesById`/`isActiveHeroId` (not a
  fresh copy of the "resolve ids to living active heroes" filter) and
  `clampStanding` (not a raw `clamp(x, -100, 100)`), both in `types.ts`.
  Several enum-like unions are named `const` arrays with derived types
  (`AXIS_IDS`, `GENDERS`, `BLOODLINES`, `HERO_STATUSES`, `PHASES`,
  `GAME_OVER_KINDS`, `EXPEDITION_KINDS`/`_PACES`/`_LEGS`, `CHECK_TIERS` in
  `checks.ts`) so `saveValidation.ts` imports them instead of hand-copying —
  extend that list rather than adding a parallel one.

## Conventions

- Content event ids are prefixed by category: `post_`, `hero_`, `season_`,
  `travel_`, `beastfolk_`, `family_`, `raid_`, `recruit_`, `captive_` (one
  file per prefix under `content/events/`). Travel events typically gate on
  `destinationTag`/`expeditionKind`/`expeditionLeg` rather than a specific
  location id, so they fire at any matching node.
- **New hero-personal events should not lock to one pool hero.** A handful of
  legacy events (`hero_p1_debt`/`p3_letters`/`p5_poachers`/`p7_game` in
  `heroEvents.ts`) gate on `{ type: 'heroInParty', heroId: 'pN' }` +
  `binding: { type: 'specific', heroId: 'pN' }` — kept intentionally as bonus
  flavor for whoever drafts that hero, but since Party Select only picks 6 of
  12, each has roughly even odds of never firing in a given game. Don't add
  more like them. `GENERIC_HERO_EVENTS` in the same file is the pattern to
  follow instead: same story beats, no `heroInParty` gate, bound via
  `highestSkill`/`highestStat` (whoever best fits the moment) so the event
  fires regardless of party composition — the `HeroBinding` union already
  supports this, no engine change needed.
- Location ids are lowercase snake_case, referenced from event conditions
  (`destinationIs`, `locationDiscovery`) and outcomes (`discover`). Tags on
  `LocationDef.tags` (e.g. `'river'`, `'hills'`, `'ruin'`) double as trait
  check-modifier tags — reuse existing ones before adding new.
- Event writing tone (spec §9): second person, terse, concrete, 60–120 words
  of body text; choices phrased as intentions ("Offer the chief your own
  sword"), never mechanics ("+2 standing"). `{hero}` interpolates the bound
  hero's name. Check tags (`'intimidation'`, `'hunting'`, `'gamble'`,
  `'ritual'`, `'strangers'`, `'natives'`, faction ids) hook trait modifiers —
  reuse existing tags before inventing new ones.
- Faction identities, location names, the hero pool's bios, and goods are
  grounded in the Ashmark (source lore in `docs/lore/`) — no more
  `[PALUSTERIA LORE]` placeholders remain in `src/content/`. Internal ids
  (`RIVER_CLANS`, `river_meet`, hero `p1`–`p12`, etc.) are stable and
  intentionally don't match the in-fiction names anymore (e.g. `RIVER_CLANS`
  displays as "The Tributary Towns") — don't rename ids to "fix" this, it'd
  force a save migration for no reason. The post's own proper name and the
  Cult-pressure trait's name are still open (see
  `docs/TODO_FEATURES.md`'s open questions) if you're adding content
  that touches them.
- Portrait asset keys are `<race>_[<ethnicity>_]<gender>[_child]_<NN>` (e.g.
  `imanian_male_02`, `kiswani_bayuk_female_01`, `imanian_male_child_01`),
  race pools grouped by the folder they live in
  (`src/assets/portraits/<race>/`). Current pools: `imanian` (Ansberrian/
  Imanian company folk — one shared visual pool), `kiswani`, `hanjoda`,
  `weri`, `orc`, `goblin`. Reuse an existing race pool before adding a new
  one; only fork a new pool for a genuinely distinct people. `child` is a
  reserved life-stage token, not a free-form ethnicity segment — see the
  Portraits architecture note above and `docs/GAME_FEATURES.md` §13.
- Tests live in `src/engine/__tests__/`; shared fixtures in `helpers.ts`
  (`testState()` now seeds `locations` from `content/locations.ts` via
  `TEST_LOCATIONS`). `simulation.test.ts` plays whole seeded years headlessly
  and now also dispatches caravans/explore parties periodically — extend it
  when adding mechanics; it's the cheapest way to catch loop-breaking
  regressions. Every event must always leave at least one choice available
  (the simulation asserts this). `expeditions.test.ts` covers dispatch
  validation, the caravan/explore lifecycle, and travel-event binding.

## Commands

```sh
npm run dev      # dev server, http://localhost:5173
npm test         # Vitest engine suite — keep it green
npm run build    # tsc -b && vite build — must pass before pushing
npm run test:e2e # Playwright UI smoke tests (e2e/), headless Chromium — spins
                 # up its own dev server on :5183 via playwright.config.ts
npm run catalog  # regenerates docs/EVENT_CATALOG.md standalone (also runs as
                 # part of `npm test`); see docs/ADDING_EVENTS.md
```

Gotcha: `TUNING` is `as const`, so its literals narrow — annotate accumulator
variables (`let x: number = TUNING...`) when arithmetic follows.

Gotcha: `npm run test:e2e` starts its own Vite dev server on port 5183
(`playwright.config.ts`'s `webServer`) and reuses one already listening there —
it won't collide with a `npm run dev` you have open on 5173. Add new e2e specs
under `e2e/*.spec.ts` when a UI change is worth a real-browser check; keep them
few and focused on flows engine tests can't reach (dispatch UI, multi-screen
navigation), not a substitute for Vitest coverage of engine logic.

## Git

- Repo: https://github.com/bartsr94/Trading-Post (branch `main`).
- Windows machine; git warns about LF→CRLF on every commit — harmless, ignore.
- Run `npm test` and `npm run build` before pushing; also run
  `npm run test:e2e` when the change touches UI or dispatch flows.
