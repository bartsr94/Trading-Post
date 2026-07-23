# AGENTS.md (Codex)

This repo is **The Trading Post**: a KoDP-inspired narrative frontier-trading game built with **Vite + React + TypeScript (strict)**.

## Read-first / source of truth

- Primary agent guide: `CLAUDE.md` (repo root, **gitignored / local-only**).
- Design + lore specs: `docs/*.md` (also **gitignored / local-only**). If these are missing in your checkout, ask Bartosz before making design or lore decisions.
- Serena’s project summary (local-only): `.serena/memories/project_overview.md`.

## Hard rules (project constraints)

1. `src/engine/` stays **pure**: no React imports, no DOM, and no content knowledge beyond `src/content/tuning.ts`.
2. Content (events/traits/heroes/goods/etc.) lives in `src/content/` only; engine changes should add **generic** mechanisms (new condition/outcome variants), not per-event special cases.
3. Balance numbers belong in `src/content/tuning.ts` (no magic numbers in engine).
4. RNG is seeded in the engine; don’t use `Math.random()` in engine code.
5. Ask before adding new tracked systems not in the spec.

## Guardrails (keep these in sync)

- `src/engine/saveValidation.ts` is the runtime invariant checker for `GameState` and saves; if you change state shape, migrations, or turn resolution invariants, update this and its tests.
- Content registries expect unique `id`s for authored content; add new content via `src/content/` and keep the unique-id checks passing.
- Event selection/choice resolution is strict about candidate context (bound heroes) and locked choice validation; avoid relying on implicit/global hero context in conditions/outcomes.
- New portrait/illustration source art lands at full camera resolution (multi-MB); run `node scripts/optimize-images.mjs` before committing it — it resizes to the largest on-screen box and converts portraits to WebP.

## Repo map (high-signal)

- `src/engine/`: pure game logic + save/migrations + turn resolution
- `src/content/`: data definitions (events, tuning, heroes, names, goods, factions, locations, buildings, recruits)
- `src/store/`: Zustand store + screen state
- `src/ui/`: React UI (screens, components)
- `e2e/`: Playwright tests (includes no-scroll checks)

## Spatial map (current)

- The old node graph is gone. `src/engine/map.ts` owns pure normalized geometry,
  distance/pace travel, checkpoint access, the 64×48 fog grid, surveys, and rumors.
- `src/content/map.ts` owns region/feature polygons; `src/content/locations.ts`
  owns exact place anchors. Do not infer coordinates from pixels at runtime.
- Exploration accepts reachable free coordinates. Knowledge commits only when
  explorers return; party loss discards pending `surveyResult` data.
- Save version is **21** (see `CLAUDE.md`'s per-feature notes for the full
  v12→v21 migration history — spatial state, raiding, diplomacy seats, the
  Concession/claim system, etc.). Don't hardcode an older version number from
  memory; check `TUNING.save.version` in `src/content/tuning.ts` if unsure.
- Map functionality is covered by `map.test.ts`, `map-functional.test.ts`,
  expedition/save tests, deterministic simulations, and focused Playwright tests.
- **Perf (2026-07-23):** the fog grid (up to 3072 cells) renders through a
  `React.memo`'d `FogLayers` subcomponent in `MapScreen.tsx`. Both pointer
  handlers on the map SVG are rAF-throttled to one `setState` per animation
  frame — drag-to-pan first, then wheel-zoom the same day (wheel-zoom's
  listener also had to move off a JSX `onWheel` to a manual, non-passive
  `addEventListener` so `preventDefault()` wouldn't warn) — because raw
  pointer/wheel events fire faster than the screen repaints and each one
  triggering its own `setState` re-diffs the whole fog grid. Don't
  reintroduce an unthrottled `setState` in that file's pointer/wheel handlers.

## Common commands

- Dev server: `npm run dev`
- Unit tests: `npm test` (Vitest)
- E2E: `npm run test:e2e` (Playwright)
- Build: `npm run build` (tsc -b + vite)

## Git hygiene (important)

The following are intentionally **not committed** (see `.gitignore`): `docs/`, `CLAUDE.md`, `.serena/`, `dist/`, `node_modules/`, Playwright artifacts.
