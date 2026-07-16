# The Trading Post

A single-player, browser-based narrative management game inspired by *King of Dragon Pass*, set in the frontier world of Palusteria. You lead a company of six named heroes founding a trading post in the wilderness — assigning them to work each turn, resolving illustrated story events with visible dice rolls, and shaping what the post becomes: aloof or integrated with the native peoples, a pure trading venture or a living settlement.

**Working title. Early development (MVP 1).**

## Design pillars

1. **Characters first.** The six heroes are the emotional core — they gain traits, skills, scars, and reputations from your choices. Events feature specific heroes, never a faceless colony.
2. **The post is a character too.** It grows from a clearing with tents toward whatever your decisions make of it — and it can fail: raiders, bankruptcy, abandonment.
3. **Consequences over optimization.** No correct build. Decisions close doors and open others; runs are meant to be replayed.
4. **Visible drama.** Skill checks roll on screen — dice, modifiers, and margin, math never hidden:
   `🎲 4+3 +Bargain 3 +Charm 2 = 12 vs 11 — Success`

## Running it

Requires Node 20+.

```sh
npm install
npm run dev      # play at http://localhost:5173
npm test         # engine test suite (Vitest)
npm run build    # type-check + production build
```

Progress autosaves to localStorage each turn; saves can also be exported and imported as JSON files.

## How a turn plays

One turn is two weeks; six turns make a season, four seasons a year. Each turn you review your **standing orders** (assignments persist — a well-running post advances in seconds), confirm, and watch the resolution: prices drift, the company eats, activities pay off, and one or two story events fire. Events are where the game lives: choices phrased as intentions, resolved by open dice, with outcomes that ripple through heroes, factions, and the post itself.

## Project layout

```
src/
  engine/      # pure game logic — no React, fully unit-tested
    checks.ts      # 2d6 skill check resolution
    turn.ts        # turn pipeline: economy → activities → events
    economy.ts     # prices, drift, trade math
    events/        # event selection, conditions, hero binding, outcomes
    rng.ts         # seeded PRNG (runs are reproducible)
    save.ts        # versioned JSON saves + migration stub
  content/     # pure data — heroes, traits, goods, factions, events, tuning
  ui/          # React screens & components
  store/       # Zustand store wrapping the serializable GameState
```

The engine never hardcodes content: new events, heroes, or traits are data entries in `src/content/`, and every balance number lives in [`src/content/tuning.ts`](src/content/tuning.ts).

## Roadmap

- **MVP 1 — the loop works** *(current)*: core turn loop, heroes, visible checks, event engine, post market, saves.
- **MVP 2 — the world exists**: factions & diplomacy, the map, caravans & exploration, buildings & post tiers, settlement axes in full, roster churn & recruitment, ~60 events, failure states with narrative endings.
- **MVP 3 — it's a game**: balance pass, seasonal content, endgame variants, art, audio, onboarding.

Current hero names, cultures, and faction identities are placeholders pending Palusteria lore.
