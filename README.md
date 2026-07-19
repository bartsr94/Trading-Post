# The Trading Post

A single-player, browser-based narrative management game inspired by *King of Dragon Pass*, set on the Ashmark frontier of the world of Palusteria. You lead a company of six named heroes founding a trading post in the wilderness — assigning them to work each turn, resolving illustrated story events with visible dice rolls, and shaping what the post becomes: aloof or integrated with the native peoples, a pure trading venture or a living settlement.

**Working title. Early development (MVP 2 underway).**

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
npm run test:e2e # browser UI smoke tests (Playwright)
```

Progress autosaves to localStorage each turn; saves can also be exported and imported as JSON files.

## How a turn plays

One turn is two weeks; six turns make a season, four seasons a year. Each turn you review your **standing orders** (assignments persist — a well-running post advances in seconds), confirm, and watch the resolution: prices drift, the company eats, activities pay off, expeditions move a leg closer to home or away, and one or two story events fire — plus a possible travel event for any party on the road. Events are where the game lives: choices phrased as intentions, resolved by open dice, with outcomes that ripple through heroes, factions, and the post itself.

## The map

The post sits at the center of a **node graph** of ten locations — four faction seats and five wilderness sites, each with a one-way travel time from the post. Places start `unknown`, `rumored`, or `visited`; sending an **Explore** party (1–2 heroes, from the Map screen) rolls Survival to push discovery forward and spreads rumors of a place's immediate neighbours. Once a market is **visited**, the Market screen's caravan planner can send a party there with cargo, a buy order, and carried silver — profit (or loss) happens on the road, resolved by a Bargain check on arrival, and the party walks home with whatever it earned. Once a faction seat is **visited**, the Map screen's "Send Envoy" section can send a party there instead to treat directly with that faction, resolved by a Diplomacy check on arrival. All three kinds of expedition can trigger **travel events** along the way — fords washed out, tolls demanded, wolves at dusk — bound only to heroes in that party.

## Diplomacy & the Charter

Faction standing moves two ways: a hero on the **Diplomacy** standing order hosts the Ansberry Company's factor at the post each turn (Company standing only), or a party can be sent as an **envoy** to any faction's seat for a bigger, riskier swing with that faction specifically. Separately, the Company expects a profit shipment every season (quarterly) — pay it and standing nudges up; miss it and the consequences escalate turn over turn: standing losses compound, the company grows more stressed, and persistent non-payment eventually gets silver seized outright.

## The company & its roster

The named characters are more than the six on active duty at any one moment. The **active party** — up to six — are the heroes you assign to work, send on expeditions, and who star in events. Everyone else who has thrown in with the post waits on a **reserve bench**: they live at the post, eating and drawing a retainer, but take no orders until you call them up. From the **Characters** screen you swap freely between the active party and the reserve between turns, so the six who define your post can change across a long campaign as heroes are recruited, wounded, or set aside. (The recruitment chains that fill the bench, and the marriage and childbirth events that give characters named families — spouses and children who cost food but do no work — are the next layer; see the roadmap.)

## The post's people

Beyond the named company, the post gathers an **unnamed population** — farmers, porters, guards, and craftsfolk you feed, pay, and put to work. It's a pool you shape rather than a roster you command: farmers grow grain, porters haul more cargo when seconded to a caravan, guards steady a party on the road and hold the palisade, craftsfolk keep the place mended. Hire hands from the neighbouring towns, draw them in as the post prospers or as it grows more integrated with the native peoples, and assign idle newcomers to a trade. They eat every turn and draw wages every season; let either run short and **contentment** slides from content to grumbling to open unrest — output falls, then people desert. Manage them from the **People** screen.

## Raising the post

The post itself grows from a clearing of tents into a walled settlement. You raise **buildings** — a storehouse, a palisade, a trade hall, a common house, a workshop — one project at a time: pay the silver and timber up front, then set heroes to **Build** and watch a Craft check each turn drive the work toward completion. Finished buildings pull their weight quietly — more room for residents, defence behind the walls, better trade, easier upkeep, deeper prosperity. And when the right walls stand and the strongbox holds, the post can **come of age**: a narrative moment — *raising the palisade* — with a real check, not a silent upgrade, that carries the clearing up to a proper Post. It's all run from the **Buildings** screen.

## Interface

The game runs as a fixed full-viewport shell, King of Dragon Pass style: a
left sidebar (title, screen navigation, save actions), a slim top bar (turn
and silver), a content pane for the active screen, and a bottom
hero bar — every active-party hero as a portrait tile, hover for condition and
status, click to open their sheet. Portraits are painted art where it exists
and fall back to a deterministic placeholder tile otherwise, so new heroes
never render blank.

The home screen is the **Outpost Overview** — a read-at-a-glance dashboard
(the outpost's character, its trade and standing, and its settlement) laid out
in three columns beneath a painted banner. A guiding rule: **a screen should
never scroll**, because a scrollbar hides information — so where a view has more
than fits, it becomes its own screen rather than a scrolling one. That's why the
hands-on management lives on dedicated **Buildings** and **People** screens,
linked from the overview, instead of piling onto it.

## Project layout

```
src/
  engine/      # pure game logic — no React, fully unit-tested
    checks.ts      # 2d6 skill check resolution
    turn.ts        # turn pipeline: economy → expeditions → activities → events
    economy.ts     # prices, drift, trade math (post market + per-location markets)
    expeditions.ts # caravan, explore & envoy dispatch and per-turn resolution
    residents.ts   # unnamed population: roles, contentment, upkeep, escorts
    roster.ts      # named-character roster: active party ↔ reserve bench, dependants
    buildings.ts   # construction projects, building effects, tier advancement
    events/        # event selection, conditions, hero binding, outcomes
    rng.ts         # seeded PRNG (runs are reproducible)
    save.ts        # versioned JSON saves + migrations
  content/     # pure data — heroes, traits, goods, factions, locations, events, tuning
  ui/          # React screens & components
    components/    # Sidebar, HeroBar, Portrait, Icon, ConditionBars, Illustration
    screens/       # one component per Screen (Post, Assignments, Map, Market, Hero Sheet, ...)
    portraits.ts    # portraitKey → bundled asset URL registry (see assets/portraits/)
  assets/
    portraits/   # <race>/<race>_<gender>_<NN>.png — dropped in by key, no code changes needed
  store/       # Zustand store wrapping the serializable GameState
```

The engine never hardcodes content: new events, heroes, traits, or locations are data entries in `src/content/`, and every balance number lives in [`src/content/tuning.ts`](src/content/tuning.ts).

## Roadmap

- **MVP 1 — the loop works** *(complete)*: core turn loop, heroes, visible checks, event engine, post market, saves.
- **MVP 2 — the world exists** *(current)*: map, caravans & exploration ✅; faction diplomacy & the Charter quota ✅; the unnamed resident population ✅; the active-party ↔ reserve character roster ✅; buildings, construction & tier 1→2 advancement ✅; still open — the rest of the buildings & post tiers 2→4, settlement axes in full, recruitment chains & marriage/dependant events, event count to ~60 (28 so far), failure states with narrative endings.
- **MVP 3 — it's a game**: balance pass, seasonal content, endgame variants, art, audio, onboarding.

Hero names, cultures, faction identities, and location names are grounded in the Ashmark region of Palusteria; a handful of minor wilderness-node names and one trait name are still open.
