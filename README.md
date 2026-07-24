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
npm run catalog  # regenerates docs/EVENT_CATALOG.md (also runs as part of `npm test`)
```

Progress autosaves to localStorage each turn; saves can also be exported and imported as JSON files.

## How a turn plays

One turn is two weeks; six turns make a season, four seasons a year. Each turn you review your **standing orders** (assignments persist — a well-running post advances in seconds), confirm, and watch the resolution: prices drift, the company eats, activities pay off, expeditions move a leg closer to home or away, and one or two story events fire — plus a possible travel event for any party on the road. Events are where the game lives: choices phrased as intentions, resolved by open dice, with outcomes that ripple through heroes, factions, and the post itself.

## The map

The Ashmark is a continuous **illustrated spatial map**, not a node graph.
Explorers can target any reachable coordinate; distance and Fast/Normal/Slow
pace determine how long the outward and return legs take. A 64×48 fog grid
records surveyed country, while authored places separately progress through
`unknown → rumored → visited → known`. Rumors indicate deterministic search
areas; visited and known places use exact markers. Distant regions remain
blocked until monotonic route checkpoints open them, while the settled Black
River corridor begins familiar. Survey results only enter the map when the
party returns—if everyone is lost, their knowledge is lost too.

Known destinations still anchor caravans, envoys, invite/negotiate-land runs,
courtship, and raid expeditions. Every expedition stores its exact target and
pace and can trigger travel events bound only to its own heroes. The Map and
Market screens share the same spatial journey calculation. Discovering a
faction's seat — or any other market town — for the first time doesn't just
quietly reveal it: it fires **first contact**, a proper story event where you
choose how to approach them, before they ever show up on the Communities tab.

## Diplomacy & the Charter

Faction standing moves two ways: a hero on the **Diplomacy** standing order hosts the Ansberry Company's factor at the post each turn (Company standing only), or a party can be sent as an **envoy** to any faction's seat for a bigger, riskier swing with that faction specifically. Separately, the Company expects a profit shipment every season (quarterly) — pay it and standing nudges up; miss it and the consequences escalate turn over turn: standing losses compound, the company grows more stressed, and persistent non-payment eventually gets silver seized outright.

## The company & its roster

The named characters are more than the six on active duty at any one moment. The **active party** — up to six — are the heroes you assign to work, send on expeditions, and who star in events. Everyone else who has thrown in with the post waits on a **reserve bench**: they live at the post, eating and drawing a retainer, but take no orders until you call them up. From the **Characters** screen you swap freely between the active party and the reserve between turns, so the six who define your post can change across a long campaign. New characters arrive through **recruitment events** — a renowned trader who steps off the supply boat, a river-town clan-mother's daughter who would rather keep your books than shout at them from the wharf — never a menu purchase.

## Families & the line

Your heroes put down roots the frontier did not have before. A character can take a **spouse** three ways, and the *way* is the whole choice: send a party down to Thornwatch on a **courtship** run to bring a certified **homeland** bride upriver — dear and slow, but the Company approves and the bloodline stays Imanian; wed into a friendly river town in a **tribal alliance** that seals a standing bond between two peoples; or keep an informal **hearth-companion** by frontier custom — cheap, quiet, and unblessed. A hero may keep more than one household. Unions and their children move the post's cultural character, and a mixed household is one the Company's factor eyes more warily than a pure one.

Marriages bear **children** on a Communal, contented post — each a person of *both* parents' peoples, so a child of an Imanian father and a Kiswani mother is genuinely of a mixed line. Children cost food but no work, and in a couple of years **come of age**: they stay named kin at the post, able in their turn to marry and raise children of their own. Over a long campaign a founder's line branches down the generations — visible as a **family tree** you open from any character, spouses and descendants shown with their portraits, mixed lines marked as such. It is the *King of Dragon Pass* "your clan grows across the years" payoff for a post that chooses to become a home.

## The post's people

Beyond the named company, the post gathers an **unnamed population** — farmers, herders, hunters, porters, guards, and craftsfolk you feed, pay, and put to work. It's a pool you shape rather than a roster you command: farmers work the cropland, herders tend the pasture herd, hunters bring in food from the wildland, porters haul more cargo when seconded to a caravan, guards steady a party on the road and hold the palisade, craftsfolk keep the place mended. A new post doesn't start from bare tents — a handful of founding hands come with you. Grow the population further by sending a party to **Invite Settlers** at any neighbouring town you've discovered, native or homeland alike, and assign idle newcomers to a trade. They eat every turn and draw wages every season; let either run short and **contentment** slides from content to grumbling to open unrest — output falls, then people desert. Manage them from the **Outpost Overview**, the landing screen.

The post also draws **outsiders** it neither feeds nor pays, passing through for a time: a faction honour-guard that rides home with a successful envoy and helps hold the walls, a supplier crew that lends its backs to your caravans for a few nights, or Company inspectors who post themselves at the gate when a profit shipment goes unpaid — and quietly sour the mood until the debt is settled. Those same residents now matter directly in war: guards strengthen the post against incoming raids, guard escorts add force to outbound strikes, and porters raise how much loot a raiding party can carry home.

## The Concession

The post sits on a **Concession** of land, measured in chains, apportioned between cropland, pasture, and wildland. There's no hard population ceiling any more — the Concession simply sets how many people it comfortably supports; run past that and it's mounting discontent, not a wall you can't cross. Cropland pays off once a season as a harvest (with its own share of bad-year risk), pasture carries a herd for milk and hides, and wildland trickles in food every turn through your hunters. When the land itself runs short, send a party to **Negotiate Land** with a neighbouring seat and grow the Concession outright.

## Raiding

The frontier can now turn violent in both directions. Hostile neighbours may
**raid the post** after the early grace period, and you can also send an
outbound **raid expedition** of your own against hostile camps or rival seats.
Both use a focused, KoDP-style encounter screen: when raiders arrive you choose
how to meet them, and when your own party reaches its mark you give the final
order there rather than auto-resolving the clash off-screen.

Defence reads the whole settlement: resident guards, walls and towers, visiting
honour-guards, heroes currently at the post, and even a capped fyrd levy of
farmers and idle hands. Outbound raids weigh the party's fighters, any resident
guard escort, ally support, stealth on the approach, march fatigue, and how
many porters came to haul the loot home. Results can bring back silver and
goods, force tribute, sour faction standing, wound or kill named heroes, burn
buildings, or in the worst case help push a hollowed post toward destruction.

A raid from the river towns or the wilds carries one more risk: a sacked post
can have a man **taken captive** instead of hurt or killed. Most captivities
resolve themselves — a quiet release within a turn or two, or word eventually
reaching the post that he's been let go — but a captor slow to release him
calls for the player to act: send an envoy to **ransom** him, or send an
outbound raid with **rescue**, rather than plunder, as its goal. Wait too
long — the better part of a year — and a recovery attempt can instead learn
he's chosen to stay with the family he's since made among his captors. Rarely,
a hero recovered after a long captivity is followed home by that family
wanting to join the post outright.

## Whose post is it becoming

Everyone at the post belongs to a **people** of the Ashmark — your Imanian countrymen from the homeland, or the native Kiswani and Hanjoda, each with their own tribes and river-towns — and the balance of them becomes the post's **cultural character**, a third settlement dial running from *Imanian* to *Sauromatian*. It's set by who you settle: every discovered neighbour, homeland or native, is a destination for an **Invite Settlers** run, and every native hire tilts the post toward the frontier while every homeland one holds it Imanian. Lean hard toward the frontier and the Ansberry Company starts to see a foothold gone native — *dangerously compromised* rather than *loyal countrymen bringing civilization*. (The teeth behind that judgment — standing pressure that reads your own party's makeup, and a charter that can be **revoked** outright — are the next layer; see the roadmap.)

Beyond the Ashmark's human peoples, two more powers can enter the post's life. The **Weri**, underground miners and metalworkers neither colonist nor Sauromatian native, never settle as residents — you meet them only as a recruited hero or through events, and court their allies the **Knights of Saint Eirwen** as their own faction. And out in the wilds, **Orcs and Goblins** hold their own camps: hostile at first, they can be paid tribute, fought, or — at high enough standing — welcomed into the post as residents or even by marriage.

## Raising the post

The post itself grows from a clearing of tents into a walled settlement. You raise **buildings** — a storehouse, a palisade, a trade hall, a common house, a workshop — one project at a time: pay the silver and timber up front, then set heroes to **Build** and watch a Craft check each turn drive the work toward completion. Your **craftsfolk** pitch in too, pressing whatever project is underway forward on their own each turn alongside any heroes you assign. Finished buildings pull their weight quietly — more room for residents, defence behind the walls, better trade, easier upkeep, deeper prosperity. And when the right walls stand and the strongbox holds, the post can **come of age**: a narrative moment — *raising the palisade* — with a real check, not a silent upgrade, that carries the clearing up to a proper Post. It's all run from the **Buildings** screen.

## Interface

The game runs as a fixed full-viewport shell, King of Dragon Pass style: a
left sidebar (title, screen navigation, save actions), a slim top bar (turn
and silver), a content pane for the active screen, and a bottom
hero bar — every active-party hero as a portrait tile, hover for condition and
status, click to open their sheet. Portraits are painted art where it exists
and fall back to a deterministic placeholder tile otherwise, so new heroes
never render blank.

The home screen is the **Outpost Overview** — a dashboard of the outpost's
character, its trade and standing, its settlement, and its people, laid out in
four columns beneath a painted banner, with the Concession's land and herd
controls in a strip below. A guiding rule: **a screen should never scroll**,
because a scrollbar hides information — so where a view has more than fits, it
becomes its own screen rather than a scrolling one. That's why construction
still lives on its own dedicated **Buildings** screen, while day-to-day people
management (hands, idle reassignment, land allocation) is folded directly into
the landing screen rather than requiring a trip elsewhere.

## Project layout

```
src/
  engine/      # pure game logic — no React, fully unit-tested
    checks.ts      # 2d6 skill check resolution
    turn.ts        # turn pipeline: economy → expeditions → activities → events
    economy.ts     # prices, drift, trade math (post market + per-location markets)
    map.ts         # pure geometry, access checkpoints, fog, rumors, survey helpers
    expeditions.ts # caravan, explore, envoy, invite/negotiate-land, courtship & raid resolution
    residents.ts   # unnamed population: roles, contentment, upkeep, escorts
    claim.ts       # the Concession: land, allocation, harvest, herd
    roster.ts      # named-character roster: active party ↔ reserve bench, recruitment
    family.ts      # the family graph: unions, children, ancestry, coming of age
    buildings.ts   # construction projects, building effects, tier advancement
    raids.ts       # incoming/outgoing raid battle math, tribute
    captivity.ts   # abduction risk, capture, ransom/rescue resolution
    events/        # event selection, conditions, hero binding, outcomes
    rng.ts         # seeded PRNG (runs are reproducible)
    save.ts        # versioned JSON saves + migrations
  content/     # pure data — incl. normalized locations and map regions/features
  ui/          # React screens & components
    components/    # Sidebar, HeroBar, Portrait, Icon, ConditionBars, Illustration, RaidModal
    screens/       # one component per Screen (Post, Assignments, Map, Market, Hero Sheet, ...)
    portraits.ts    # portraitKey → bundled asset URL registry (see assets/portraits/)
  assets/
    portraits/   # <race>/<race>_<gender>_<NN>.webp — dropped in by key, no code changes needed
  store/       # Zustand store wrapping the serializable GameState
scripts/
  optimize-images.mjs # resizes/recompresses new source art before it's committed
```

The engine never hardcodes content: new events, heroes, traits, or locations are data entries in `src/content/`, and every balance number lives in [`src/content/tuning.ts`](src/content/tuning.ts).

## Engine guardrails

- `src/engine/saveValidation.ts` validates runtime invariants for `GameState` and saves; keep it in sync with state shape, migrations, and turn-resolution invariants.
- Authored content `id`s are expected to be unique (see `src/content/uniqueIdMap.ts`); if you add content and tests fail, fix collisions rather than working around them.
- Event selection/choice resolution is strict about candidate context (bound heroes) and locked choice validation; avoid relying on implicit/global hero context in conditions/outcomes.
- New portrait/illustration art lands at full camera resolution — run `node scripts/optimize-images.mjs` before committing it (resizes to the largest on-screen box and converts to WebP; see CLAUDE.md's Portraits note for details).

## Roadmap

- **MVP 1 — the loop works** *(complete)*: core turn loop, heroes, visible checks, event engine, post market, saves.
- **MVP 2 — the world exists** *(current)*: map, caravans & exploration ✅, with discovery-gated first contact ✅; faction diplomacy & the Charter quota ✅; the unnamed resident population ✅, with its transient outsiders & craftsfolk build-crews ✅; the active-party ↔ reserve character roster ✅ and recruitment chains ✅; buildings, construction & tier 1→2 advancement ✅; the peoples of the Ashmark & the post's cultural character — heritage, the culture axis, the Weri and the Knights of Saint Eirwen ✅; marriage, partners, children & the multi-generational family tree ✅; Orcs and Goblins as the Ashmark's first non-human peoples ✅; two-way raiding with tribute, destruction cascade, and encounter screens ✅, including abduction/captivity with ransom and rescue ✅; same-sitting chain events ✅; **the Concession** — uncapped population, land allocation, herds, and settlers/land won through travel expeditions rather than an instant hire menu ✅; still open — the rest of the buildings & post tiers 2→4, the Company's reaction to a compromised post (standing pressure, the charter-revoked ending, and its read of a household's bloodline), and event count to ~60 (~47 so far).
- **MVP 3 — it's a game**: balance pass, seasonal content, endgame variants, art, audio, onboarding.

Hero names, cultures, faction identities, and location names are grounded in the Ashmark region of Palusteria; a handful of minor wilderness-node names and one trait name are still open.
