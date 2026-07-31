# Game Features — The Trading Post

This is the single reference for **what the game currently does**, consolidated
2026-07-24 from the per-feature design specs that used to live in `docs/`.
Those specs were written as forward-looking proposals; most of what they
proposed has since shipped, verified line-for-line against the actual code in
this pass. Rather than maintain N stale "here's the plan" documents next to
the code that plan produced, this file is the living "here's what's built"
reference, organized by system.

Genuinely still-open design work (unbuilt features, unresolved questions)
stays in the trimmed per-topic spec files that remain in `docs/` — each now
holds only its backlog, not a re-description of what already shipped. See the
bottom of this file for the current list.

`CLAUDE.md` (repo root) remains the authoritative doc for *how the codebase is
organized* — architecture, conventions, gotchas, hard rules for agents. This
file is the authoritative doc for *what the game does* — read both.

---

## 1. Core loop & turn structure

One turn = one month; 12 turns/year in 4 seasons of 3 turns each (shortened
2026-07-25 from 2 weeks/24 turns/6-per-season — see `TURN_CADENCE_SPEC.md`).
The player sets standing-order assignments per hero that persist between
turns rather than requiring re-entry each time.

`resolveTurn` (`src/engine/turn.ts`) resolves, in order: market price drift →
food/upkeep/bankruptcy check → Charter quota (season end) → resident wages
(season end) → expedition advancement → per-hero activity resolution →
craftsfolk passive build progress → construction completion → event
selection. `GameState.phase` is `'assignment' | 'event' | 'report' |
'gameover'` (`PHASES` in `types.ts`). The player resolves `pendingEvents` one
at a time via `resolveChoice` + `advancePendingEvent`, then a report phase,
then `advanceTurn` (season-end skill growth every 3rd turn).

Six assignment activities: `trade`, `explore`, `diplomacy`, `build`,
`provision`, `rest`, plus `unassigned` for returning heroes.

Autosave fires immediately at turn-phase-boundary actions
(`confirmTurn`/`chooseOption`/`continueEvent`/`finishReport`/`resolveRaid`/
`newGame`/`importSave`); actions a player can fire repeatedly in a burst
(buy/sell, dispatch, activate/bench, construction, land allocation, resident
reallocation, assignment changes) go through a 400ms-debounced
`scheduleAutosave` instead. A `beforeunload` listener flushes any pending
debounced save.

## 2. Heroes: stats, skills, checks, condition

Five stats (`might`/`agility`/`wits`/`charm`/`resolve`, 1–5) and eight skills
(`bargain`/`diplomacy`/`combat`/`survival`/`leadership`/`lore`/`craft`/
`stealth`, 0–5), each skill paired to a governing stat (`SKILL_GOVERNING`).

Checks (`src/engine/checks.ts`, `resolveCheck`/`checkBreakdown`): `2d6 + skill
+ stat + situational mods` vs. a difficulty, with natural-2/natural-12
clamping and four result tiers by margin — critSuccess (≥+5), success (0–4),
failure (−1…−4), critFailure (≤−5). `EventPanel` renders a human-readable
breakdown string.

Health/stress run 0–10; stress hitting 10 triggers a breakdown event
(`TUNING.stress.breakdownEventId`). Heroes can be permanently incapacitated
(becoming a named resident, never folded into the unnamed pool) or depart.
The curated hero pool (`HERO_POOL`, `src/content/heroes.ts`) has 12 entries;
Party Select drafts 6 into the initial active party. Traits are tag-based,
matched by skill or tag (`traitModifiers`) to modify checks.

## 3. Events engine

Typed data in `src/engine/events/`. Categories: `post`/`travel`/`faction`/
`hero`/`season`/`chain`. Each result tier is `{ text, outcomes }`
(`TierResult`) — tiers carry their own narrative text; missing tiers fall
back crit→normal, failure→success. Conditions/weight/`once`/`cooldownTurns`/
`binding`/tiered outcomes are all live. Weighted per-category selection
budgets plus chain priority drive `selectEvents`. Every choice must always
leave at least one option available — enforced by `simulation.test.ts`.

Travel events (`category: 'travel'`) fire at most once per expedition per
turn, outside the normal per-turn budget, and only bind heroes within that
expedition's party.

**Chain events — same-sitting continuation & chain-scoped state.** Two ways
one event leads to another:
- `queueEvent` (original) — waits `delayTurns` and crosses a turn boundary.
- `continueChain` (`{ type: 'continueChain'; eventId; heroId? }`) — splices
  the next event straight into `state.pendingEvents[1]` the instant the
  player clicks Continue, no turn boundary. `EventPanel`/`advancePendingEvent`
  needed no change since they already just operate on index 0.

Branch memory is chain-scoped, not global: `setChainVar` merges a
`string|number|boolean` into `state.pendingEvents[0].vars` (an optional
`ChainVars` field on `ActiveEvent`/`QueuedEvent`, not `state.flags`); the
`chainVar` condition reads it back. `vars` rides forward automatically
through both `continueChain` and `queueEvent`, so a chain can mix
same-sitting and delayed hops without losing state. No save-version bump —
both fields are optional/additive.

Known, accepted limitation: a `continueChain`-spliced event never goes
through `resolveTurn`'s selection pass, so its `once` flag (if any) is never
recorded into `firedEvents`. Inert today since `category: 'chain'` events
never enter the weighted-draw pool or get queued on their own — no shipped
chain stage relies on `once`. If a future *convergent* chain (multiple
branches funnel into one shared once-only epilogue) needs this, the fix is
threading an `events` lookup map into `OutcomeContext`; not built because
nothing needs it yet.

Shipped example: "A Patrol at the Treeline" — `beastfolk_first_encounter` →
`_talks` → `_close`, 3 stages, `content/events/orc/firstEncounter.ts`, gated
on `beast_wilds` discovery (orc-only since the Goblin split, §10 — the
Goblin equivalent is `content/events/goblin/firstEncounter.ts`'s
independently-structured `goblin_first_encounter`, also §10).

**Hero binding** (`HeroBinding`, `engine/events/binding.ts`): besides the
deterministic `highestStat`/`highestSkill`/`lowestSkill`/`highestStress`/
`withTrait`/`withoutTrait`/`specific`/`random` variants, `weightedStat`
(added 2026-07-27 for the Orc strength/cunning theme, §10) picks
probabilistically — weight = the hero's stat value plus
`TUNING.events.weightedStatFloor` — so a high-stat hero is favored without
being guaranteed, unlike `highestStat`'s always-the-top pick. Use it for
"this people tends to notice/respect X" flavor rather than a hard rule.

**Text interpolation & pronoun tokens** (`engine/events/text.ts`). Besides
`{hero}`/`{post}`/`{destination}`/`{faction}`/`{partner}`, `interpolate` takes
an optional `TextContext.heroGender` and resolves `{he}`/`{him}`/`{his}`/
`{himself}` (and capitalized `{He}`/`{Him}`/`{His}`/`{Himself}` for
sentence-initial use) to the bound hero's actual pronouns — `EventPanel.tsx`
is the only call site and threads `hero.gender` through. Falls back to
`'male'` when `heroGender` is omitted, so old fixed-gender NPC flavor text
(a trader, a stranger, a captor's kin — never the bound `{hero}`) needs no
changes. Use these tokens for any pronoun referring to the *bound* hero
whenever the binding isn't locked to a single fixed-gender pool hero (i.e.
not `binding: { type: 'specific', heroId: 'pN' }` for one of the always-male
p1/p3/p7 legacy heroes) — hardcoding "he"/"his"/"him" there reads wrong for a
female-bound hero (fixed 2026-07-24: `thrallEvents.ts`'s river-clans offer
and five `beastfolk/` events — the treeline patrol chain, the
livestock-thief chase, and the orc's-dare challenge — all bind by
`highestStat`/`highestSkill` and had leftover hardcoded male pronouns).

## 4. Economy & goods

9 goods (furs, hides, grain [displayed as **"Food"**, id unchanged], salt,
tools, cloth, timber, amber, herbs), each with seasonal price modifiers
(`src/content/goods.ts`). Price = `basePrice × seasonalMod × supplyDemandMod ×
eventMod × priceBias` (`engine/economy.ts`). The post's own market lives on
`GameState.market`; each `LocationState` carries its own independent `market`.
The `trade` activity buys/sells at the post; caravans (an `ExpeditionKind`)
carry goods to other markets over multiple turns.

**Trading as a viable income (TRADING_ECONOMY_SPEC).** The four multipliers
have distinct, legible jobs so a deliberate trade route is a "strong side
income", not a rounding error:
- **Structural identity** — `LocationDef.priceBias` (permanent, ~0.5–1.7):
  each market clearly produces some goods cheap and pays dear for others
  (native furs/hides ↔ Company garrisons; Company/Weri tools & cloth ↔
  natives; Bejasi amber & Greyleaf ↔ Company). Known once a market is
  discovered. This is *where* to trade.
- **Drift** — `supplyDemandMod` mean-reverts toward 1.0 each turn
  (`TUNING.economy.supplyDemandReversion`) then jitters, so structural spreads
  stay the reliable signal and this layer is just short-run texture.
- **Shocks** — `GameState.marketShocks: MarketShock[]` drive `eventMod`
  entirely (`resolveShocks` in `economy.ts`, called from `resolveTurn`; the
  old exponential `eventMod` decay is retired). A shock is rumored for `lead`
  turns (no price effect, shown on the Ledger) then bites for `duration` turns.
  Content spawns them via the generic `marketShock` **outcome** (generalizes
  the old post-only `priceShock`); the `market_*` events in
  `content/events/marketEvents.ts` are the first batch (garrison salt
  shortage, fur glut, hill-tribe tool demand, river-fever Greyleaf spike,
  Shackle amber craze, badland grain dearth). This is *when* to trade.
- **Bargain ceiling** — the caravan arrival check swings the sale/purchase
  price by up to `caravanPriceMultMax` (1.5) at `caravanMarginRate` (0.03/margin
  point), so a skilled trader hero matters.

Calibration target (checked by a route-profitability test in
`expeditions.test.ts`): a full informed run (2 heroes, full load, no shock)
nets well above the ~144-silver opportunity cost of parking those heroes on
at-post `trade`; a caught shock is a bigger payday.

**The Ledger** (`ui/screens/LedgerScreen.tsx`, its own nav screen) is the
price-intel board: a goods × markets grid of the last prices parties actually
saw, recorded at any market arrival into `LocationState.priceIntel` and
coloured against the live post price (green = sells dear, red = cheap to buy).
Observations dim as they age; a market known only by character (never priced in
person) shows a `~` structural estimate (`structuralPrice`); active/rumored
shocks flag affected cells (▲/▼, faded `?` while only rumored).

## 5. Factions, diplomacy & the Charter quota

Seven factions (`FACTION_IDS`): `RIVER_CLANS` ("The Tributary Towns"),
`HILL_TRIBES` ("The Hanjoda Nomads"), `OLD_PEOPLE` ("The Bejasi Hills Folk"),
`CHARTER_COMPANY` ("The Ansberry Company"), `KNIGHTS_EIRWEN` (seated at
Pemba-Jasiri, an Imanian sub-power), `BEASTFOLK` ("The Greenskins",
seatless — see §10), and `HARPY` ("The Harpies", seatless — see §19).
Standing runs −100..+100 with stance bands.

**Faction discovery** (TERRITORY_DISCOVERY_SPEC.md §5). `GameState.factionsKnown`
tracks which factions the post has actually made contact with. A faction
becomes known once a location that reveals it reaches `visited`: its seat
(`LocationDef.faction`), or — for a seatless people (Beastfolk/Harpy) — a
non-seat discovery node (`LocationDef.discoversFaction`, set on the two
Beastfolk camps and the Harpy eyrie). It's pure and monotonic, reconciled from
location discovery at game start and after each turn's homecomings
(`reconcileFactionsKnown`/`isFactionKnown` in `engine/diplomacy.ts`); the
`factionKnown`/`factionUnknown` conditions gate content on it. **Seatless
factions stay hidden until met** — the Outpost Overview's faction list omits an
undiscovered seatless faction (seated ones always show).

Diplomacy splits the same way trade (post market) vs. caravans (travel)
does: an at-post `diplomacy` **activity** hosts the Ansberry Company's
factor each turn and only moves `CHARTER_COMPANY` standing; the `diplomacy`
**`ExpeditionKind`** sends an envoy to any faction seat and is resolved like
a caravan arrival against that faction's standing. Dispatch UI lives only on
the Diplomacy screen's "Send Envoy" panel (mission choice talks/gift/
alliance/peace, gifts, party) — there is no duplicate one-click envoy
shortcut on the Map screen; instead a small generic store-level
"focus-and-deep-link" handoff (`openDiplomacy(seatId)` / `diplomacySeatFocus`
/ `clearDiplomacyFocus`, mirrored by `openMarket`/`marketDestinationFocus` for
caravan planning) lets the Map screen cross-link into a preselected seat/
destination on the Diplomacy/Market screens.

`payCharterQuota` fires every season end and ships `TUNING.charter.
quotaSilver` to the Company if affordable; missing it escalates
(`GameState.charterMissedStreak`) into compounding standing loss, hero
stress, and eventually silver seizure. This is deliberate ongoing economic
pressure, not a new failure state — see §14.

**The Company's judgment (CHARTER_REVOKED_SPEC.md).** `evaluateCharterJudgment`
runs immediately after `payCharterQuota` each season end (`engine/turn.ts`) and
reads whether the post itself, not just its ledger, still looks like the
Company's foothold. The `culture` settlement axis (§9) past
`TUNING.heritage.compromiseThreshold` costs `CHARTER_COMPANY` standing every
season, dampened and partly offset when the *active party's own heritage*
reads loyal (`partyHeritageShare(state, 'homeland') ≥ partyLoyalShare`) — who
leads the post signals loyalty as loudly as who works it. A wed active hero
extends the same signal from the family side (§8): `bloodline: 'pure'`
reassures, `bloodline: 'mixed'` adds to the compromise read, weighted heavier
for an informal union than an alliance one and heavier still for a
multi-spouse mixed household. A mixed active party (both homeland and native
heroes present) also earns a small standing gain with every non-hostile
faction in `TUNING.heritage.nativeFactions`. A season where the post reads
compromised (`culture` past threshold, or a non-empty active party with zero
homeland heroes — a "total break") **and** `CHARTER_COMPANY`'s stance is
already `Hostile` increments `GameState.charterCompromisedStreak`; any other
season resets it to zero — note that paying the quota alone does not reset
it, only standing actually climbing clear of Hostile does. Reaching
`TUNING.heritage.revokeStreak` (3) declares the `charterRevoked` ending
(§15); each season before that, escalating inspector-ultimatum report lines
count down to it.

**Diplomacy discovery & first contact.** Faction seats — and, more broadly,
any market community (`isCommunity(def)`: `hasMarket && id !== homeLocationId`,
not just faction seats) — stay off the Diplomacy screen's Communities tab
until physically discovered (`visited`+): an undiscovered seat shows no row,
no name; a faction with zero discovered seats drops out of the tab entirely.
The moment discovery first reaches `visited` (checked in `resolveHomecoming`'s
survey loop and the `discover` outcome, both via one shared `isFirstContact`
helper) queues a single generic, interactive `post_first_contact` chain event
instead of a silent reveal: approach in peace / show strength / keep your
distance, each an ordinary check-driven choice affecting `communityStanding`/
`communityGrievance`. A faction-less community still fires this event as
one-time flavor — but its outcomes silently no-op (no `diplomacySeats` entry
to hold them), it never gets a Communities-tab row, and it can never receive
an ongoing envoy. **This is a deliberately locked scope boundary, not an
oversight** — making it a full tracked relationship would need
`DiplomacySeatState.faction` to go optional and a non-faction Communities
section; that's a real design expansion to ask about, not a bug.

Per-seat `startingStanding` overrides exist on `LocationDef` (e.g.
Kalasha-Tora starts at 30, friendlier than `RIVER_CLANS`' faction baseline).

## 6. Map, knowledge & expeditions

Two independent, monotonic knowledge layers: `GameState.mapKnowledge.
surveyedCells` (a 64×48 fog grid index) drives what terrain has been *seen*;
`GameState.locations[id].discovery` (`unknown → rumored → visited → known`)
tracks what's been *identified*. Both only advance, never regress, and both
commit only on an expedition's homecoming — a lost party reports nothing.

Explore may target any reachable coordinate, not just authored locations.
`scaledMapDistance` (4:3 aspect-corrected), `pointInPolygon`/`regionAt`/
`mapRegionUnlocked`/`pointReachable`/`routeUnlocked` gate checkpoint-locked
`MapRegionDef` polygons on monotonic requirements (flags/tier/discovery
only); `tagsAt` merges region+feature tags for travel-event conditions;
`journeyTurns`/`paceCheckModifier`/`paceEventChance` implement Fast/Normal/
Slow pace against spatial distance; `surveyCells`/`rumorArea` place
exploration footprints and rumor ellipses via deterministic hash-seeded
jitter (never touching live RNG).

`dispatchExpedition` validates via `dispatchError` (a lookup table of one
small validator per `ExpeditionKind`, never throws) before moving cargo/
silver off the post's books. An `explore` arrival stores a provisional
`surveyResult`; homecoming merges cells, advances discovery, and reports
newly-named places. `TravelContext` gives `destinationTag`/`destinationIs`/
`{destination}` interpolation for both authored and free-coordinate targets.
Heroes away are derived by expedition membership, never separately tracked.

Expedition kinds beyond plain `explore`/`caravan` all reuse this same
dispatch/travel/homecoming spine: `diplomacy` (§5), `courtship` (§8),
`invite`/`concession` (§7), `raid` (§11). The old `labor` kind (homeland
hiring) is retired — kept only as an inert optional field on old
`ExpeditionState` saves, never dispatched by current code.

Map UI (`MapScreen.tsx`) is a 4:3 SVG viewport with fog/locked veils, exact/
rumored markers, pan/zoom, and a mode-based dispatch panel (Explore / Place /
On the Road). `FogLayers` is `React.memo`'d against the fog arrays, and both
wheel-zoom and drag-pan are rAF-coalesced, so panning/zooming doesn't
re-diff thousands of fog polygons per input event. A normalized-coordinate
toolbar readout is still present as a **temporary calibration aid** — it was
meant to be removed or dev-gated once map coordinates stabilized and never
was; harmless, but a known loose end.

Calibrated anchors include Trading Post `(0.590, 0.164)`, Njaro-Matu
`(0.710, 0.154)`, Shackle Station `(0.910, 0.322)`, Thornwatch `(0.900,
0.491)`. Shackle Station starts known; the Black River corridor (`x ≥
0.82`) starts surveyed while checkpoint-locked southern country stays
fogged.

**People/faction territories** (TERRITORY_DISCOVERY_SPEC.md §3). Each people
holds a range on the map, traced from the artist's overlay
(`src/assets/ui/The Ashmark - Racial distribution.jpg`, same 4:3 framing so
normalized coords line up 1:1) into `content/map.ts` `MapFeatureDef` polygons
tagged with a lowercase people tag (`orc`/`goblin`/`harpy`/`knights`/
`kiswani`/`hanjoda`/`company`). Since `tagsAt` already feeds `destinationTag`,
travel/exploration events gate to a people's own country for free — orc content
only in orc range, etc. Orc and Goblin ranges both also keep the shared
`beastfolk` tag (so the pooled `travel_beastfolk_toll` still fires); they
replaced the single old `beast_wilds` overlay box.

The Knights of St. Eirwen hold **two** separate `knights`-tagged polygons, not
one: their main `knights_range` territory, plus a second, smaller
`knights_enclave` hand-placed in the goblin/harpy borderland — deliberately
below the overlay auto-tracer's noise floor and confirmed (Bartosz) as a real
second enclave, not tracing artifact.

## 7. Residents & the Concession (settlement and farming)

The post's unnamed population is a **typed role pool**
(`GameState.residents`, `src/engine/residents.ts`), distinct from named
`Hero`s (an incapacitated hero becomes a *named* resident, never a pool
tick). Six roles: `farmers`, `porters`, `guards`, `craftsfolk`, `herders`,
`hunters`, plus an `idle` bucket.

**Contentment** is a 0–10 pool-wide mood (`updateContentment`), driven by
missed food/wages, idle-tolerance overflow, transient pressure, building
bonuses, and over-claim pressure (below). Three bands — content (≥7) /
grumbling (4–6) / unrest (≤3) — set an output multiplier (1 / 0.75 / 0.4) on
farmer/hunter/herder/craftsfolk yields, and gate desertion/growth.

**Upkeep** splits like the Charter quota: grain is charged every turn
(`payUpkeep`, residents + heroes + dependants; farmers yield grain first,
craftsfolk ease silver upkeep, both scaled by the output multiplier); wages
are paid at season end (`payResidentWages`; residents draw a wage, reserve
heroes a retainer, grown kin a lighter retainer).

**Escorts.** Dispatching an expedition can second porters (raise cargo
capacity) and guards (arrival-check bonus via `escortMods` — a flat
`+2` per escorted guard, folded into every arrival check regardless of
expedition kind) — they leave `roles` at dispatch, still count for upkeep
while away, and rejoin on homecoming. `MapScreen.tsx`'s dispatch panel
exposes the porter/guard quantity inputs for every non-`courtship` purpose
(explore, invite, concession, raid) — only `raid` gets the fuller
`raid-escort-planner` block (goal/maneuver context, loot capacity readout);
the others get a compact single-row `.compact-field` per role to stay
within the no-scroll budget (2026-07-24 — the inputs previously existed in
the engine and on `MarketScreen.tsx`'s caravan planner but were never
wired into the Explore/Invite/Concession paths of the Map dispatch panel).
`expeditions.test.ts`'s "a guard escort raises the exploration arrival
check tier and never lowers it" runs matched escorted/unescorted explore
dispatches through `advanceExpeditions` off identical seeds (`old_road`
carries no faction/beastfolk tag, so `rollAbductionRisk` never perturbs the
shared dice sequence) and asserts the escort's tier is never lower, and
strictly better in at least one seed — the general escort/check-bonus
pattern this exercises applies the same way to invite/concession/caravan/
diplomacy arrivals.

**Transients** (`GameState.transients`) are outsiders the post neither feeds
nor pays: `companyAgents` (indefinite, spawned on a missed Charter quota,
cleared on a met one), `visitorGuards` (on a successful envoy arrival),
`supplierCrew` (via a content event), `beastfolkVisitors` (a "testing the
waters" content beat, §10). `transientEffect` sums their
defense/contentment-pressure/cargo effects purely into `postDefense`/
`updateContentment`/caravan cargo.

**Integration friction** (`ResidentState.friction`, distinct from pool-wide
`contentment`): a 0–10 value per settled `Heritage`, tracking how much
lasting tension a specific newcomer group still carries with the rest of the
pool. `frictionFor`/`frictionBand`/`adjustFriction` are the selector/
mutator; `frictionContentmentPressure` folds any heritage currently in the
`'volatile'` band into `updateContentment` (mirrors `transientEffect`'s
pattern, but per group rather than per head); `driftFriction` settles it
passively toward 0 each turn absent event intervention. Generic — any
heritage could carry a value — but only Beastfolk settlement content sets
one today (§10). Two new event primitives read/write it:
`frictionAtLeast`/`frictionAtMost` conditions, a `friction` outcome; a
`residentTagAtLeast` condition (reading `ResidentState.tags`) gates the
arc's closing event on the group actually being present. **Save shape: v24**
(`migrateV23toV24`, backfills `residents.friction = {}` — no old save ever
had a settled group under tension).

**Craftsfolk build-crews.** `applyCraftsfolkConstruction` adds build
progress to any active construction project *passively* each turn
(mood-scaled), ticked before `completeConstructionIfDone` — craftsfolk
advance a project with no hero assigned to Build.

**The Concession — a soft, claim-based capacity (replaces the old hard
cap).** `GameState.claim` (`src/engine/claim.ts`) holds `size` in **chains**,
a `cropland`/`pasture`/`wildland` `allocation` (validated to sum 100 via
`setLandAllocation`), accumulating `cropProgress`, and an optional
negotiated `landholder`. `claimCapacity = size × residentsPerChain` (6 per
chain, doubled from 3 in a 2026-07-23 tuning pass — 10 starting chains now
support 60) is a threshold residents may freely exceed — `addResidents`
never refuses on space. Exceeding it costs contentment (`overClaimPenalty`
per head over) and nudges standing down each turn with
`overClaimStandingTarget` (the negotiated landholder, else the nearest
discovered native faction). Held thralls (§18) occupy the same land — the
pressure check weighs `residentTotal + thrallTotal` (`claimedPopulation`)
against `claimCapacity`, not residents alone.

Farmers accrue `cropProgress` each turn, becoming a lump seasonal harvest
with ordinary variance plus a rare true crop-failure branch
(`resolveHarvest`). Herders grow a `herd` toward pasture carrying capacity
and yield milk-and-hide Food each season without ever eating the herd down.
Hunters give a continuous small per-turn Food trickle, stacking with the
hero `provision` activity. `storehouse`/`storehouse_ii` grant
`foodStorageBonus` (added to harvests); `common_house` grants a
`contentmentBonus` — both repurposed from their old `residentCapBonus`.

**Recruitment is two travel expeditions** (the old instant `hireResidents`
and the `labor` expedition kind are both fully retired): **Invite Settlers**
(`kind: 'invite'`) pays up front, rolls a Bargain/Leadership check whose tier
× offer tier × contentment band sets actual turnout, settling arrivals idle
across all six roles; **Negotiate Land** (`kind: 'concession'`) costs scale
with chains requested, and success grows `claim.size` and sets
`claim.landholder`. `TUNING.heritage.hireSources` (see §9) supplies the
target seat list for Invite Settlers, keyed by `subPeople`/source — Kiswani
(`tributary`/`kalasha_tora`/`bejasi_hills`), Hanjoda (`dustwalker`/
`sunspear`/`redsand`), homeland (`homeland`/`shackle_station`).

New games seed `TUNING.residents.startingRoles` (`{ farmers: 2, guards: 2 }`,
tallied as `heritage.homeland`) instead of an empty pool — old-save
migrations never backfill this.

**Residents heritage tally.** `ResidentState.heritage` is a coarse `{
homeland, native }` count, kept invariant-equal to `residentTotal` by every
head-count mutator. Finer per-people breakdown rides `ResidentState.tags`
(`Record<string, number>`, a genuinely *counted* partial breakdown — fixed
2026-07-21 after being found presence-only) — `residentTagCounts` is the
selector, shown in the "Origins" row.

**Files:** `src/engine/residents.ts` (roles/contentment/transients/
build-crew), `src/engine/claim.ts` (land/harvest/herd),
`src/engine/turn.ts` (`payUpkeep`, `payResidentWages`,
`resolveResidentSociety`, `resolveClaimSeason`, `resolveOverClaimPressure`),
`src/engine/expeditions.ts` (`resolveInviteArrival`,
`resolveConcessionArrival`), `src/content/tuning.ts` (`TUNING.residents`,
`TUNING.claim`). **Save shape: v21** (v11 fixed the `tags` count bug; v21
added `claim`/`herd` and removed the hard cap).

## 8. Named characters: roster, recruitment & family

Named characters split into an **active party** (≤6,
`GameState.activePartyIds`) and a **reserve bench** — a separate axis from
`Hero.status` (active/dead/departed, life-state only). `heroesAtPost =
activeHeroes − away`; event-protagonist binding and assignments read this,
so the reserve is excluded. `livingHeroes` still means *all* living named
characters (feeds grain, drives the broken-company game-over). Swaps
(`activate`/`bench`) are free and instant during the assignment phase.
Reserve characters eat grain and draw a season retainer; active heroes draw
neither.

**Dependants** (`GameState.dependants`) are named non-working family
(spouse/child/kin) attached to a character — food only, no wages, uncapped,
never counted in `residentTotal`. A mixed-heritage dependant gets its own
display label (`mixedHeritageLabel`, `engine/family.ts`): Imanian × any native
people reads as **"Townborn"**; two-or-more native peoples with no Imanian
blood reads as **"Sauro"** (orc/goblin descent is never mixed, per the
matrilineal-pure rule, so it never produces either label).
`dependantHeritageBreakdown` buckets every dependant by this label (falling back to
plain `Heritage` when pure) for the Outpost Overview's People column — a
"Dependants" row (`ResidentsPanel.tsx`) shows the total plus the per-label
breakdown, deliberately separate from `ResidentState.heritage`'s own tally
(dependants stay outside `residentTotal`, so folding them in would break that
field's sum-equals-`residentTotal` invariant). A parallel
`dependantHeritageGroupCounts` folds dependants into the coarse homeland/
native split for the same column's "Makeup" row (any native blood at all
reads native, the same convention `recomputeBloodline` uses for the household
bloodline marker).

**Recruitment.** `RecruitDef` (content, `src/content/recruits.ts`, 7
templates), injected via `TurnContext.recruitDefs`. `recruitCharacter`
mints a fresh runtime id, builds a full `Hero`, optionally slots into the
active party. `departCharacter` takes a character's dependants with them.
Conditions `rosterAtLeast`/`rosterBelow` (scope active/reserve/living).
**Only 2 of the 7 templates have an event chain reaching them**
(`renowned_trader`, `river_daughter`) — the rest, including `weri_smith` (the
Weri's only documented recruitment path), are defined but currently
unreachable outside the cheat console.

**Family graph** (`src/engine/family.ts`): a graph over named people — heroes
(roots) plus dependants (spouses/children/grown kin) — linked by
`parentIds` and `spouseId`. Both `Hero` and `Dependant` carry a runtime
`gender`; `Hero` gains an optional `bloodline` (`pure`/`mixed`); `Dependant`
gains `ancestry.peoples` (dual-parentage: the deduped union of both parents'
peoples), `union` (source), and `comeOfAge`. A wed active hero's `bloodline`
feeds the Company's judgment every season end (§5/§15,
CHARTER_REVOKED_SPEC.md) — `worstNativeSpouseUnion` (`family.ts`) reads the
"worst" (most compromising) union source among a `mixed` hero's native-blood
spouses (`informal` outweighs `alliance`), and `spouseCount` flags a
multi-spouse mixed household for a heavier weight still. `Hero` also carries
an optional
`temperament?: string[]` — free-form personality-flavor tags (e.g.
`steadfast`/`guarded`, `ambitious`/`sharp-tongued`), authored on 4 of the 12
pool heroes (`content/heroes.ts`) and validated on save; not yet read by any
condition, check, or binding — staged flavor data ahead of mechanical use.

Four union sources. Three via `formUnion`, a hero marrying an outsider who
joins as a new `Dependant`: **homeland** (a `courtship` expedition to
Thornwatch — pays `homelandBridePrice` up front, bumps Company standing on
arrival); **alliance** (an event chain with a Friendly+ native faction,
standing + culture-Frontier + a union trait); **informal** (a cheap at-post
event, no faction boost, culture nudge only). `recomputeBloodline` marks a
household `mixed` if any native blood is under the roof, else `pure`.
Multiple spouses per hero are allowed (`maxSpousesPerHero`, 3).

The fourth, **hero-to-hero marriage** (`formHeroUnion`), is different in
kind: two already-active roster heroes marry each other directly, with no
new `Dependant` created — neither stops working or starts eating an extra
ration, since both were already counted in `livingHeroes`. Each keeps their
own household head (dependants are never re-parented); `recomputeBloodline`
runs for both sides. `eligiblePartners(state, heroId)` finds other present,
opposite-gender, `canWed`-eligible active heroes as candidates; the
`partnerAvailable` condition gates on that list being non-empty. Content
reaches it via the `pickPartner` outcome (stashes a random eligible partner's
id as the chain var `formHeroUnion`'s `partnerId` defaults to) and the
`{partner}` text token. Shipped example: **"Two Hearts at the Post"**
(`family_party_spark` → `_ask`, `content/events/familyEvents.ts`) — a
2-stage same-sitting chain where a successful ask marries the pair and grants
the `wed_party` trait.

**Children & coming of age.** `addChild` computes dual-parentage ancestry
and a heritage-skewed gender roll. A season-end sweep
(`childrenComingOfAge`) turns a `child` dependant into a `kind:'kin'` grown
adult — still named, marriageable, drawing a lighter retainer — which is
what makes the family tree genuinely multi-generational.

**Birth rate by heritage** (Bartosz, 2026-07-24): three parallel post-category
events cover `family_first_child` — the baseline (weight 8) and two higher-
weight variants, `family_first_child_orc` (weight 12, ~1.5x) and
`family_first_child_goblin` (weight 16, ~2x), gated by the new
`heroSpouseHeritage`/`heroSpouseNotHeritage` conditions (`engine/events/
conditions.ts`, reading `spousesOf`/`nodePeoples` from `family.ts`) so the
baseline event excludes orc/goblin spouses and the two variants require
them — no double-firing for the same household. Pure content + one generic
condition pair, no engine mechanism beyond that; the matrilineal-pure
daughter-only rule (`childAncestry`) already applied regardless of which of
the three events fires the birth.

**UI:** `CharactersScreen.tsx` (active/reserve/dependant family strip) and
`FamilyTree.tsx` (the multi-generational tree modal).

**Save shape:** v5 added the roster/reserve split + dependants; v8 added
`gender`/`bloodline`/`ancestry`/`union`/`comeOfAge`.

## 9. Peoples & heritage

`Heritage` = `imanian | kiswani | hanjoda | weri | orc | goblin`. `imanian`
is the Company's homeland folk; every other value is `native`
(`heritageGroup`/`isNativeHeritage`) — a strict two-way split, **no third
"foreign" bucket** (a locked call: Weri and Beastfolk are both `native`,
since "anything not Imanian is suspect to the Company" applies to them too).
Each `Heritage` carries an optional free-form `subPeople` tribe/region
string (`dustwalker`/`sunspear`/`redsand` for Hanjoda, `tributary`/
`bejasi_hills` for Kiswani, `ansberrian`/`creole` for Imanian, plus `weri`/
`orc`/`goblin`), defaulted per-people by `defaultSubPeople()` — flavor and
hire-map routing only, the engine never branches on it.

**The `culture` settlement axis** (a third `AxisId` alongside `integration`/
`communal`): Homeland/Imanian (−10) ↔ Frontier/Sauromatian (+10),
independent of `integration` (posture vs. demographics). Moved by direct
event outcomes, per-head hire nudges, and a season-end self-correcting drift
(`applyCultureDrift`, pulling toward the residents' native/homeland
balance, capped per season). `applyAxisArrivals` also reads `culture`
thresholds to draw native-vs-homeland settlers.

**Group-targeted desertion** (CHARTER_REVOKED_SPEC.md §3): unrest desertion
(`applyDesertion`, §7) ordinarily debits the heritage tally proportionally,
but once `integration` sits at or below
`TUNING.residents.desertion.aloofIntegrationThreshold` (a post reading Aloof)
it biases the loss toward native residents first, via `loseResidents`'s
existing `group` parameter — no new mechanism, just a threshold check wired
to a bias that already existed.

**Hiring.** `TUNING.heritage.hireSources` is one lookup table keyed by
`subPeople` → `{ people, faction, seat }`, letting one people supply from
multiple seats. This table now feeds only the Concession-era `invite`/
`concession` expeditions (§7) — the original instant per-neighbour hire and
the Thornwatch `labor` expedition it once fed are both retired. Weri have no
hire entry — they arrive only via the `weri_smith` recruit (currently
unreachable, see §8) or events.

`FACTION_IDS` includes `KNIGHTS_EIRWEN` (seat Pemba-Jasiri, starts neutral).
Hanjoda gained two extra seats, Blackstone Plateau (Sunspear) and Redsand
Range (Redsand), both under `HILL_TRIBES`.

**Save shape:** v7 introduced `culture` + the heritage tally; v9 restructured
the taxonomy (`dustwalker`→`hanjoda`, `bejasi`→`kiswani`), added
`subPeople`, seeded `KNIGHTS_EIRWEN`; v10 added `orc`/`goblin` (Beastfolk,
§10).

## 10. Beastfolk — Orcs & Goblins

The Ashmark's first non-human peoples, built entirely as content on
existing generic mechanisms. `Heritage` gains `orc`/`goblin`, both `native`.
A seatless `BEASTFOLK` faction ("The Greenskins", starts at −60) has **no
map seat** — no "Send Envoy" path, no local hire-menu entry; standing moves
only through event outcomes. Two discovery nodes are pure exploration/event
territory, one per people: `beast_wilds` ("The Gnawback Camp," orc) and
`goblin_wilds` ("The Tangle," goblin) — split out from a single shared node
in a later pass (BEASTFOLK_CAMPS_SPEC.md, since folded in here). Neither is
a diplomacy seat; both carry `beastfolk` plus their own `orc`/`goblin` tag.
Content written for one people alone (tribute/match/dare/first-encounter)
gates on that people's own camp; content genuinely about both (settlement,
livestock raids, pilfering, the mid-standing visitor beat) gates on a
generic `locationDiscoveryAny` condition (`engine/events/conditions.ts`/
`types.ts`) — true once *either* listed location clears the discovery
threshold, the first "any of N locations" condition the engine has needed.
The shared `beast_wilds` `MapFeatureDef` terrain overlay
(`content/map.ts`, distinct from the locations) was reshaped to bracket
both camps' new coordinates so free-coordinate exploring nearby still reads
as beastfolk country. No new `FactionId`, no new diplomacy seat, no save
migration — `LocationState` only ever stored `discovery`/`market`, and
`goblin_wilds` needs no backfill for old saves, matching the precedent that
`beast_wilds` itself was never backfilled when v10 shipped it.

Content: demand/tribute events at low standing (pay, haggle, refuse — all
non-violent, in silver/goods/standing/stress); voluntary union at rising
standing (reuses `formUnion(source: 'alliance')`, plus `wed_orc`/`wed_goblin`
traits — the orc version is now a 3-stage chain, see below); settlement at
high standing (reuses `addResidents`,
split into two calls so orc/goblin counts stay distinct in the Origins tag
breakdown) in two flavors — guards (`beastfolk_settlement`) or craftsfolk/
porters (`beastfolk_settlement_workers`). The guards flavor is now a 2-stage
chain (reworked 2026-07-28): taking the band in queues `beastfolk_settlement_
claim` 4 turns later, paying off the "no war-band will vouch for them" line
in the arrival text — they're deserters, and the band they deserted comes to
collect, offering a stand-and-defend check (`friction`/`standing`/
`contentment` swing on the result), a straight silver+goods payoff, or handing
the guards back (`loseResidents`, standing/contentment hit). The workers
flavor (`beastfolk_settlement_workers`) got its own 2-stage follow-up the same
day, deliberately shaped differently: `beastfolk_settlement_temptation` fires
4 turns later with an old contact trying to talk a settled worker into
smuggling goods out through routes only they know — confront the pair (a
check), stay hands-off, or quietly set a watch. Purely internal to the post
(`friction`/`contentment`/`loseResidents`), no `standing` swing at all — the
guards arc is an external claim settled by force, this one's an internal
temptation with no faction stakes.
Mixed orc/goblin × human children
fall out of the existing `Ancestry.peoples`/`bloodline` logic with no new
code.

**Raiding intersection** (raiding shipped separately, after this content):
`BEASTFOLK` is one of several possible incoming-raid aggressors, with a
laxer eligibility rule than seated factions (`beastfolkAlwaysEligible`
bypasses the normal hostile-standing-threshold gate, reflecting "wild
raiders"). A Beastfolk-flavored raid-threat event exists in
`raidEvents.ts` — this is genuine raid content the original Beastfolk pass
explicitly deferred; it arrived later as part of the general raiding system,
not a revision to the Beastfolk events above.

**Integration friction** (a second content pass, 2026-07-24 — see §7 for the
mechanism itself): either settlement event now sets `friction` to 7 for
`orc`/`goblin`. While a heritage sits in the volatile band (≥7), recurring
mediation events (`beastfolk_integration_orc`/`_goblin`) let a hero step in
(a check that moves friction down hard on success, up on failure) or leave
it to fester (guaranteed small rise); once friction settles to ≤2, a
once-only closing event (`beastfolk_integration_settled_orc`/`_goblin`)
marks the group as fully integrated with a small permanent standing/
contentment reward. Passive `driftFriction` means even an ignored arc
eventually resolves on its own, just slower and with more contentment cost
paid along the way.

**General mischief** — a lower-stakes, higher-frequency tier than the
standing-gated tribute events, deliberately not gated on hostile standing
alone (`standingAtMost 40`, a much looser band than tribute's −20): a
livestock raid (`beastfolk_livestock_raid`, track-them-down or write off the
loss), storehouse pilfering (`beastfolk_pilfering`, set a watch or absorb
it), and a shouted contest-of-strength dare from an orc youth
(`beastfolk_dare`, no standing gate at all — bravado, not policy). All are
ordinary weighted-pool events on the existing outcome vocabulary
(`loseHerd`/`good`/`silver`/`standing`/`stress`/`health`).

**Orcs respect strength and cunning** (2026-07-27): `beastfolk_dare` now
gates on `heroGender: 'male'` (an orc youth specifically testing a man's
strength) and binds via `weightedStat: 'might'` instead of the old
deterministic `highestStat` — the post's strongest man is *favored* to be
challenged, not guaranteed to be, so a lower-Might hero can still get pulled
in. A new counterpart, `orc_battle_of_wits` (`content/events/orc/
flavor.ts`), covers the other half of that respect: an orc tactician wagers
a game of knucklebones against whoever the wilds judge sharpest
(`binding: { type: 'weightedStat', stat: 'wits' }`, check `skill: 'lore'`),
gender-neutral since cunning isn't given the same masculine framing as the
physical dare. Both reward a strong showing with standing and a stiff
silver cost for losing badly — "orcs warm to those who prove themselves,
by strength or by wit" is the throughline, not "orcs only respect men."

**Sharper abduction identity** (`TUNING.abduction`, `engine/captivity.ts`/
`raids.ts` — see §17 for the shared mechanism): BEASTFOLK now rolls captures
more readily than RIVER_CLANS on both triggers —
`incomingCaptureChanceByFaction`/`expeditionCaptureChanceBaseByFaction` are
per-faction override maps (falling back to the shared base for any faction
absent from them) set higher for BEASTFOLK (0.45 incoming / 0.12 expedition,
vs. shared bases of 0.35 / 0.08) — read alongside the pre-existing
`quickReleaseChance` asymmetry (0.1 for BEASTFOLK vs. 0.55 for RIVER_CLANS,
already meant they held captives far less predictably). A pure TUNING
change; no new engine mechanism, no captive-event content touched.

**A "testing the waters" visitor beat** (`beastfolk_visitors`, mid-standing
band 0–25, between the tribute and settlement thresholds): spawns a
`beastfolkVisitors` transient (a small ongoing `contentmentPressure`, no
defense/cargo effect) instead of settling anyone — flavor + a light
systemic cost for a faction still deciding whether to trust the post.

**A travel-toll variant** (`travel_beastfolk_toll` in `content/events/
travelEvents.ts`, gated on `destinationTag: 'beastfolk'`): mirrors
`travel_hill_toll`'s pay/haggle/push-through shape against the `beast_wilds`
tag rather than a hill-tribes seat.

**Save shape:** v10 seeded `factions.BEASTFOLK` (the only backfill a new
`Heritage`/`TransientKind` literal ever needs); v24 added `residents.friction`
(§7).

**Goblins got their own content directory and tone** (2026-07-27,
`EVENT_ORGANIZATION_SPEC.md`): goblin-specific events (`beastfolk_goblin_
tribute`/`_match`/`_integration`/`_integration_settled`) moved verbatim from
`content/events/beastfolk/` (since renamed to `content/events/orc/`, see below)
into `content/events/goblin/`, still on the same
`BEASTFOLK` faction/standing track — a content/tone split, not an engine
one. `beastfolk_first_encounter`/`_talks`/`_close` narrowed from
`locationDiscoveryAny([beast_wilds, goblin_wilds])` to `beast_wilds` only
and became orc-exclusive (retextured, ids unchanged), and a new
goblin-only `goblin_first_encounter` chain (`content/events/goblin/
firstEncounter.ts`) took its place for `goblin_wilds` — deliberately
structured *not* like the orc chain: three real choices each `continueChain`
straight to their own self-contained ending (no shared `_talks`/`_close`
checkpoint), whimsical and low-stakes in tone (a goblin committee squabbling
over a prank rig) rather than a grim standoff, reflecting Goblins as a
nuisance rather than a threat. New goblin-only content uses the `goblin_`
id prefix (mirroring `harpy_`); relocated legacy events kept their original
`beastfolk_goblin_*` ids. `arc` cataloging tags were split to match
(`orc_tribute`/`goblin_tribute`, `orc_match`/`goblin_match`, `orc_
integration`/`goblin_integration`, `orc_first_encounter`/`goblin_
first_encounter`); `beastfolk_settlement`/`beastfolk_flavor` stayed joint
since neither splits cleanly by people.

**`content/events/beastfolk/` renamed to `content/events/orc/`** (same day):
now that Goblins have their own directory, this one is Orcs' primary home —
plus the leftover joint content (`settlement.ts`, most of `flavor.ts`) that
still can't split cleanly by people, kept here as the default/joint home.
Exported array names followed (`BEASTFOLK_EVENTS` → `ORC_EVENTS`, etc.);
event ids, the `BEASTFOLK` `FactionId`, and illustration keys were untouched
— this was a pure directory/identifier rename, not a content change.

**Goblin match reworked into a 3-stage group-marriage chain**
(`goblin_match_skulking` → `_intrusion` → `_offer`, `content/events/goblin/
match.ts`; the old single-stage `beastfolk_goblin_match` was retired
outright, not kept as an alias — no save migration system to preserve it
against, §16): mirrors `orc/match.ts`'s `queueEvent`/`sameHero`/`chainVar
impression` shape, but diverges in two ways. First, it's a **group
proposal**: a whole goblin band, not one suitor, joins the household at
once by repeating the `formUnion` outcome (`source: 'informal'`) once per
bride in stage 3's tier outcomes — `formUnion` already re-checks `canWed`
independently on every call, so no engine change was needed to marry
several spouses in one outcome list. The whole chain gates on
`heroUnmarried` (not Orc's `heroCanMarry`) — goblin logic, per Bartosz: a
hero with no existing wife has no reason to turn any of them down. Second,
each stage is gated by a **Company building the goblins are impressed
by**, not a goblin-built one: stage 1 (`goblin_match_skulking`) needs
`palisade` as a normal top-level `conditions` entry (it's drawn from the
weighted post pool, so that's checked every turn); stage 2
(`goblin_match_intrusion`) needs `common_house`, but as a **choice-level
`requires`** instead, since a chain-target event's top-level `conditions`
are never re-evaluated once it's reached via `queueEvent` (confirmed
against `selection.ts`'s queued-event branch). Stage 2 has a third,
always-available "let them linger" choice that just re-queues itself —
this is how the chain **hangs** until `common_house` goes up, rather than
either firing dead or force-ending. Stage 1's `critFailure` on either
check path can end in a real abduction rather than a stress tick — the
first content to use the new `captureHero` outcome (§17).

**New generic engine capability: the `captureHero` outcome** (`engine/
events/outcomes.ts`, `engine/events/types.ts`): before this, no content
event could capture a hero — `engine/captivity.ts`'s `captureHero()` was
only ever called from two engine-internal sites (raid resolution,
expedition arrival). The new `Outcome` variant `{ type: 'captureHero';
heroId?; faction }` calls the same function with a widened `source` —
`'raid' | 'expedition' | 'event'` (also widened on `Hero.captivity.source`
and `saveValidation.ts`'s allow-list; bumped `TUNING.save.version` 29→30
since a previously-invalid value becomes valid). The existing
`captive_quick_release`/`captive_check_in` resolution chain needed no
change — it doesn't branch on `source`. Any future event wanting to
threaten/execute a capture should reach for this outcome rather than
inventing a second mechanism.

**The orc match event became a 3-stage courtship chain** (2026-07-27,
`ORC_MATCH_CHAIN_SPEC.md`, now folded in here): `beastfolk_orc_match`
(single-shot, decided in one roll) was replaced outright by
`orc_match_watched` → `orc_match_trading` → `orc_match_returns`
(`content/events/orc/match.ts`, arc `orc_match`), earning the union across
several turns instead of deciding it on the spot. Stage 1 fires from the
weighted `post` pool when a male hero eligible to marry is assigned to the
Provisioning task; stages 2 and 3 are `category: 'chain'` (weight 0),
reached only via a pinned, cross-turn `queueEvent(sameHero: true)` once
that same hero is back at the post — no new mechanism needed there, since a
pinned `QueuedEvent` already only fires on a turn its hero resolves via
`heroesAtPost` (`selection.ts`), simply waiting rather than firing without
him or dropping. An `impression` chain var (`'strong'`/`'weak'`, carried via
`QueuedEvent.vars`/`ActiveEvent.vars` across the turn boundary — the same
`ChainVars` mechanism same-sitting chains use) accumulates across stages 1
and 2 and gates whether stage 3 offers the marriage choice at all; failing
that check (or the stage-3 might check itself) always falls back to her
joining as a plain resident, never a hard no.

Two new generic `Condition`s, both reusable well beyond this chain:
- **`heroAssignment`** (`{ activity: ActivityId; heroId? }`) — true when
  `state.assignments[heroId]` matches, for any future "hero currently doing
  job X" gate.
- **`heroCanMarry`** (`{ heroId? }`) — wraps the existing `canWed`/spouse-cap
  check (`family.ts`), unlike `heroUnmarried` (which requires zero spouses).
  Since orcs are polygamous (`maxSpousesPerHero`, 3, §8), an already-married
  hero is still a valid candidate here — `heroUnmarried` would have wrongly
  excluded him.

One new `TextContext` field, `spouseRank` (`engine/events/text.ts`,
`{spouseRank}` token) — "first wife"/"second wife"/"third wife", computed
from the existing `spouseCount` selector in `EventPanel.tsx` and always
populated (even for a first marriage), so authored text can just say "as
his {spouseRank}" without any conditional grammar.

**New generic engine capability: persistent per-hero counters**
(`Hero.counters`, `engine/events/types.ts`/`conditions.ts`/`outcomes.ts` —
formerly `TRAVEL_AMBUSH_SPEC.md`, now folded in here): before this, the only
persistent event bookkeeping was global (`state.flags`, booleans only);
`ChainVars` are richer but scoped to one chain run and gone once it
resolves. Nothing could ask "how many times has *this specific hero* failed
*this specific kind of check*, ever?" `Hero.counters?: Record<string,
number>` is a free-form named counter bag, same idiom as `state.flags`/
`ChainVars` (content invents keys, the engine never branches on a specific
one) but hero-scoped and permanent — absent key reads as 0, and there's
deliberately no "forgive a failure" outcome; the two new `Condition`s
(`heroCounterAtLeast`/`heroCounterAtMost`, `key`/`value`/optional `heroId`
defaulting to the bound hero, same `resolveHeroId` pattern as
`heroGender`/`heroAssignment`) and one new `Outcome`
(`heroCounter`, `key`/`delta`/optional `heroId`, clamped at 0) are the only
way to read or write one. Bumped `TUNING.save.version` 30→31 (a new `Hero`
field); `saveValidation.ts` validates it with the same
`validateIntegerRecord` used for `residents.tags`. Escalating content that
needs this reads it on **separate root events gated by a counter range**,
not by branching inside one event's tiered outcomes — a `TierResult`'s
outcomes are a static list, and chain-spliced/queued events never re-check
`conditions` when they fire (confirmed against `selection.ts`), so
per-tier branching has to live at the top level, one event per tier.

**Shipped example: the goblin travel-ambush chain**
(`content/events/goblin/ambush.ts`, arc `goblin_ambush`, counter key
`goblin_ambush_fails`): three mutually-exclusive `category: 'travel'`
events, all gated on `destinationTag: 'goblin'` (narrower than
`travel_beastfolk_toll`'s shared `beastfolk` tag), each escalating the same
hidden `survival`/`wits` "watch the treeline" check's flavor by how many
times *that specific hero* has already failed it —
`travel_goblin_ambush` (first time, `heroCounterAtMost` 0, ordinary
robbery), `travel_goblin_ambush_again` (`heroCounterAtLeast` 1 `AtMost` 3,
the goblins recognize and mock him by name), `travel_goblin_ambush_tired`
(`heroCounterAtLeast` 4, they've decided he's stalling on purpose and
`captureHero` him instead of robbing him, reusing the existing captivity
system rather than a new one). Only the check's `failure`/`critFailure`
increments the counter; a no-check "push on and pretend not to notice"
alternative always takes a smaller guaranteed loss without touching it, so
declining to try never counts against him. Binding is plain `{ type:
'random' }` on all three — the candidate pool is already pre-filtered to
heroes meeting that tier's counter range before binding runs, so it
naturally features whichever party member has the matching history.

**Resolution arc — beating the goblins into a truce:** a second per-hero
counter, `goblin_ambush_wins`, tracks the mirror image — only the "Turn the
tables" reaction choice (in each tier's `_react` companion) increments it,
and only on `success`/`critSuccess`, i.e. actually out-ambushing them, not
just spotting or declining the ambush. Once any hero's counter reaches 4,
`travel_goblin_ambush_surrender` (`once: true`) becomes eligible: the
goblins concede and offer a truce. Accepting sets the global flag
`goblin_ambush_truce`, which the three ambush-tier events all gate off via
`notFlag` and the new `travel_goblin_trade` event gates on via `flag` — so
the shift from ambush to peaceful bartering is party-wide and permanent,
not scoped to whichever hero earned it, unlike the counters that trigger
it. Declining the truce leaves the flag unset (the ambush chain continues
indefinitely); the surrender scene itself only ever plays once either way.

**Still open** (`docs/TODO_FEATURES.md`): a named Beastfolk recruit (orc
smith/goblin scout) and sub-clan/war-band depth (named war-bands under
`subPeople`) — both deferred, since either needs an invented character/name
concept rather than a mechanical decision.

## 11. Raiding — two-way warfare

*(No dedicated spec file for this ever shipped in this checkout — this
section is sourced from the codebase directly.)*

Pure battle math + selectors live in `src/engine/raids.ts`, content-free
beyond an injected `RaidContext` (goodDefs/goodNames/buildingNames/
locationDefs — the last one added for `targetHeritageFor`'s per-location
thrall-heritage lookup, see §18), mirroring `TurnContext`.

**Incoming raids:** each turn, `resolveIncomingRaids` rolls eligibility
(`raidEligible`/`eligibleAggressors`/`raidChance`, gated on a grace period +
per-aggressor cooldown); on a hit, `createIncomingRaid` pre-rolls attacker
force/maneuver/spotted into `GameState.pendingRaid`, holding the turn in the
`event` phase until the player responds.

**Outgoing raids** are a `raid` `ExpeditionKind` — dispatched empty-handed —
that on arrival at a target with a faction or the `beastfolk` tag rolls the
target's defense/maneuver into the same `pendingRaid` slot
(`createOutgoingRaid`).

Both paths render through one `RaidModal.tsx` overlay: a force breakdown,
then the player picks a battle goal + maneuver + optional rally (a
leadership check) before `resolveIncomingRaid`/`resolveOutgoingRaid` run the
battle math — force margin (base force + 2d6 + leader bonus + surprise −
opposing force − maneuver rock-paper-scissors swing) picks an outcome tier.
Losses cascade into guard/hero casualties, goods/silver loot, standing
shifts, building/construction damage, and optionally a standing
`TributeRelationship` (pay or receive, settled seasonally, cleared by a
broken raid).

A post that's hollow (low residents + low wealth) and sacked twice within a
window hits the `destroyed` game-over.

`postDefense` (guards + building `defenseBonus` + transient `defenseBonus`)
is the same selector residents (§7) already compute — raids just read it.

**Captivity integration** (shipped later, as its own feature — see §17):
against a risky-faction aggressor (`RIVER_CLANS`/`BEASTFOLK`), a sacking
incoming raid rolls capture for each qualifying male hero *before* the
ordinary wound/death branch, taking them instead of hurting or killing them.
On the outgoing side, a `rescue` attack goal (gated on the target currently
holding one of our captives) frees every captive that faction holds on a
win, in place of the usual loot. Neither changes the underlying force-margin
battle math.

**Save shape:** v13→v16 across the feature's own rollout (pending-raid slot
+ cooldown bookkeeping, tributes, the incoming/outgoing pendingRaid union).

**Thralls integration** (shipped later — see §18): a new `enslave` attack
goal converts an outgoing win's spoils into captured thralls instead of the
usual loot (requires an escort guard); an incoming sack's population-loss
line is reflavored as enthrallment, mechanically unchanged. Neither touches
the force-margin battle math.

## 12. Buildings & construction

The post raises buildings one project at a time. `GameState.buildings` is
the completed-id set; `GameState.construction` is a single `{ building,
progress } | null` slot. Any hero on the **Build** activity rolls a Craft
check each turn, adding progress by result tier; craftsfolk build-crews
(§7) add passive progress too. All balance (cost, `buildProgress`,
prerequisites, effects, gating) lives in `TUNING.building.defs`, keyed by
id — `content/buildings.ts` holds only name/blurb. Effects are **derived,
never stored**: `buildingEffect(state, field)` sums a named field across the
completed set, so a balance tweak needs no migration.

**17 buildings currently exist:** `storehouse`, `palisade`, `trade_hall`,
`common_house`, `workshop` (tier 1); `storehouse_ii` (Grand Storehouse),
`palisade_ii` (Stone Rampart), `workshop_ii` (Foundry), `infirmary`,
`watchtower`, `river_shrine`, `goblin_warren`, `orc_longhouse`,
`counting_house`, `dock`, `stables`, `bathhouse` (all minTier 2). Effect
fields wired: `foodStorageBonus`, `defenseBonus`, `prosperityBonus`,
`tradeIncomeBonus`, `stressReliefBonus` + `healingBonus`, `craftReliefBonus`,
`upkeepSilver`, `contentmentBonus`, `cargoCapacityBonus`, `travelCheckBonus`,
`frictionReliefBonus`. Gating vocabulary: `minTier`, `prerequisites`,
`requiresResidents`, `requiresHeritageGroup`, `requiresTag`,
`requiresStanding`, `minSilverHeld`.

**Bathhouse** (2026-07-28): a universal (no heritage gate) tier-2 amenity,
prereq `common_house` — deliberately the first building with more than one
"soft" effect at once: `contentmentBonus: 2` (double `common_house`'s),
`stressReliefBonus: 1`, and a new generic field, `frictionReliefBonus`,
added to `passiveDecayPerTurn` inside `driftFriction` (`residents.ts`) — a
building-driven boost to how fast settled-heritage integration friction
(§7/§10) cools on its own, on top of whatever mediation events already do.
Not people-specific and no new gating vocabulary; `frictionReliefBonus` is
just another summed `Partial<BuildingEffects>` field like the rest.

**The Dock/Stables trade-route pair** (2026-07-24): the last clearly-scoped
building pair from the original Phase B list. Both gate on
`requiresResidents` (Dock needs 3 porters, Stables 2 guards — the
requirement mirrors what the building's own effect amplifies) plus
`trade_hall`/`storehouse` prerequisites respectively. **Dock** grants
`cargoCapacityBonus`, a flat addition to `cargoCapacity()` — wired into
every place that reads it: the `dispatchExpedition` cargo-validation cap,
the caravan-arrival buy-order capacity (alongside the existing supplier-crew
`transientEffect('cargoBonus')`), and `raidCargoCapacity` (so a raiding
party can also haul more loot home; this doesn't touch the force-margin
battle math, only the loot cap). **Stables** grants `travelCheckBonus`, a
flat `CheckModifier` folded into `escortMods` (renamed in spirit, not code —
the function now returns a guard-escort bonus *and* an unconditional Stables
bonus) at every expedition-arrival check site: caravan, explore, diplomacy,
Invite Settlers, and Negotiate Land. No new save fields — both are ordinary
`Partial<BuildingEffects>` entries, derived like every other building
effect.

**Tier advancement is a narrative event, not silent.** `postTier` currently
advances **1→2** (`post_raise_palisade`: needs palisade+storehouse, 100
silver) and **2→3** (`post_found_settlement`: needs trade_hall+workshop+
common_house, 250 silver), both gated on `canAdvanceTier` and resolved by
the `advanceTier` outcome.

**UI:** a dedicated Buildings screen (`BuildingsScreen.tsx` →
`BuildingsPanel.tsx`) — completed-building chips, active project + progress
bar + cancel, a tier-advancement callout, a "Coming Later" locked-chip rail
for ordinary tier upgrades, and a build-menu of everything structurally
eligible.

**Save shape: v6** introduced the system.

*(What's still unbuilt here — tier 4, true axis-gated buildings, storage
caps — is tracked in `docs/TODO_FEATURES.md`.)*

## 13. UI shell

A fixed, full-viewport app shell (`App.tsx`) renders only once a game is
active; `PartySelect`/`GameOver` use a separate centered layout. Four
regions:
- **Sidebar** (`Sidebar.tsx`): title, then icon+label nav — Outpost,
  Assignments, Diplomacy, Characters, Buildings, Map, Market, Ledger — plus
  Export Save / Abandon / Settings (cheat-mode toggle) pinned to the bottom.
  Icons are single-color stroke SVGs (`Icon.tsx`), never emoji.
- **Top bar:** season/turn + silver chips.
- **Content pane:** the one nominally-scrollable region — but **no screen is
  actually allowed to scroll**, a hard design rule. `e2e/no-scroll.spec.ts`
  measures `.content` overflow at a 1280×720 floor across every screen,
  including expanded states, and fails above 1px.
- **Hero bar** (`HeroBar.tsx`): every living hero as a portrait tile (away
  heroes dimmed with an expedition-kind marker); click opens `HeroSheet`.

**The Outpost Overview** (`PostOverview.tsx`, the landing screen) is a
dashboard: a photo banner, a **4-column grid** (`.overview-grid-4`: The
Outpost / Trade & Standing / The Settlement / The People) plus a full-width
Concession strip below it (land allocation, herd, visitors — pulled from
`ResidentsPanel.tsx`'s `ConcessionStrip`). The People column
(`PeopleOverviewColumn`) holds population/mood/makeup/upkeep plus the hands
list and idle-hand reassignment. **There is no standalone People screen** —
it was merged into this dashboard 2026-07-23; `Screen` has no `'people'`
value and the nav item was removed. The Buildings screen is unaffected and
remains its own dedicated screen for construction. `MarketScreen` keeps its
own separate 3-column layout (`.overview-grid-3`, still its own CSS class —
not shared with the Outpost Overview's 4-column grid despite the similar
name). **The Ledger** (`LedgerScreen.tsx`) is its own screen too — the
read-only price-intel board (§4); the Market screen stays where you *act*.

**Portraits** (`ui/portraits.ts`, `Portrait.tsx`): art lives in
`src/assets/portraits/<race>/<race>_<gender>_<NN>.webp`, globbed at build
time (`import.meta.glob`); an unpainted key falls back to a deterministic
hash-hue initial tile, so new heroes never render blank. New source art
should be run through `node scripts/optimize-images.mjs` before committing
— it resizes to the largest on-screen portrait box (`.hero-sheet-portrait`,
currently 164×205, 2× for retina) and converts to WebP; it also recompresses
the map background JPEG to the map SVG's stretched resolution.

**Child dependant portraits** (2026-07-24): a `child`-kind dependant draws
from its own art pool, `<race>_[<ethnicity>_]<gender>_child_<NN>.webp`
(e.g. `imanian_male_child_01.webp`), dropped into the same race folder as
the adult art. `pickDependantPortraitKey` tries the child pool first and
falls back to the adult pool when no child art exists yet for that
race/gender/ethnicity combo, so unpainted pools never go blank. Coming of
age switches the art automatically — the lookup reads the dependant's live
`kind` on every render, no caching, no engine change needed.

**Event illustrations** (`ui/eventArt.ts`, `Illustration.tsx`, 2026-07-27):
same eager-glob/basename-lookup pattern as Portraits, one folder over — art
lives in `src/assets/events/<illustration-key>.webp` (or `.png`/`.jpg`),
where `<illustration-key>` is the exact string in the event's `illustration`
field (e.g. `orc_demand.webp` for the `beastfolk_orc_tribute` event, whose
`illustration: 'orc_demand'`). An unpainted key falls back to the original
flat hash-hue placeholder panel with the key's text on it, so events with no
art yet render fine. Several `illustration` keys are deliberately shared
across multiple event ids (e.g. `beastfolk_friction` covers both
`beastfolk_integration_orc` and `beastfolk_integration_goblin`) — painting
one shows it on every event that references that key. Run new source art
through `node scripts/optimize-images.mjs` before committing.

**Per-choice and per-tier illustration override** (2026-07-31): an event's
illustration can now vary by *what the player picked* and *how it turned
out*, not just by event id. Two independent, stackable override points,
both optional:
- `Choice.illustration?: string` — overrides the event's base image once
  that choice is picked, regardless of which tier it resolves to (e.g.
  three different reactions to the same setup each showing their own art).
- `TierResult.illustration?: string` — overrides *that* one further, for
  one specific `critSuccess`/`success`/`failure`/`critFailure` result of a
  single choice (e.g. "spotted the ambush" vs. "got ambushed" showing
  different art for the *same* choice).

Resolution order is `tier.illustration ?? choice.illustration ?? event.
illustration`, computed once in `engine/turn.ts`'s `resolveChoice` and
carried on `ChoiceResolution.illustration`; `EventPanel.tsx` shows it as
soon as a choice is picked (`resolution?.illustration ?? event.
illustration`), replacing the event's base image for the rest of that
event's resolution. Both fields live on the real `Choice`/`TierResult`
engine types (`engine/events/types.ts`), not a helper-only concept, so any
event/choice/tier can use them whether authored via `eventHelpers.ts`'s
`makeChoiceEvent`/`ChoiceSpec` (which threads `Choice.illustration` through
on both the `'checked'` and `'flat'` variants, and passes `TierResult`
objects straight through so their `illustration` needs no extra plumbing)
or a raw object literal. `resolveChoice` is the single function every
choice resolution goes through — normal play and cheat-console forced-tier
alike — and `EventPanel.tsx` is the only UI surface that renders a
`GameEvent`'s illustration, so there's no second path to keep in sync.

**Worked example — the full goblin ambush chain**
(`content/events/goblin/ambush.ts`): each of the three escalation tiers'
"Watch the treeline" check keeps its base image (`goblin_mischief`/
`goblin_encounter_01`/`goblin_arrival`) on critSuccess/success ("spotted
it"), but overrides to `goblin_ambush_caught` on failure/critFailure
("got ambushed") — a per-tier override on the *same* choice. The
always-available "push on and pretend not to notice" choice never spots
anything either, so it carries the same `goblin_ambush_caught` override at
the choice level. One further distinction: the tired tier's critFailure is
the actual `captureHero` outcome (the hero is carried off), a materially
different beat from an ordinary robbery, so it gets its own key
(`goblin_ambush_captured`) rather than reusing `goblin_ambush_caught`. Each
`_react` companion's three reaction choices (Turn the tables/Leave them to
it/Spring it back) use choice-level overrides (`goblin_shakedown`/
`goblin_standoff`/`goblin_tumble`), shared across all three escalation
tiers rather than re-keyed per tier. None of `goblin_ambush_caught`/
`goblin_ambush_captured`/`goblin_shakedown`/`goblin_standoff`/
`goblin_tumble` are painted yet — they fall back to the hash-hue
placeholder like any unpainted key (§13 above).

**Event cast portraits** (`EventCast.tsx`, `EventPanel.tsx`,
2026-07-30 — formerly `EVENT_CAST_PORTRAITS_SPEC.md`): a small chip strip
overlaid on the illustration's bottom-left corner, one `Portrait` + name per
hero the event is actually about, so `{hero}`/`{partner}` in the prose has a
face on screen rather than just a name. Purely presentational, no engine
change — `EventPanel` already resolved both `hero` (`active.heroId`) and
`partner` (`active.vars?.partnerId`, the one chain that names a second hero
today: the hero-to-hero marriage chain in `familyEvents.ts`) to interpolate
text, so the cast list is just those two reshaped into `Hero[]` (protagonist
first, partner appended only if present and distinct). Always shows at least
the one protagonist chip, even on ordinary single-hero events. A future
antagonist/NPC portrait (a named raid leader, a captor with a face) is
explicitly not built — there's no entity to point at yet (raiders are
aggregate math in `raids.ts`, a captor is just a `FactionId`) — see
`docs/TODO_FEATURES.md` if that's picked up later.

## 14. Cheat console

An off-by-default testing tool (`CheatConsole.tsx`, toggled via
`SettingsMenu.tsx`'s "Cheat mode" checkbox, persisted to `localStorage`, not
`GameState`/save). Nearly every button builds an `Outcome[]` (the same union
every event outcome already uses) and runs it through the real, unmodified
`applyOutcomes`. Can also force-fire **any** event directly (including
travel — the category exclusion was lifted once forcing one no longer needed
a real expedition, see below), bypassing `once`/cooldown/`firedEvents`
bookkeeping (deliberately — only `resolveTurn`'s normal selection pass
touches those). A forced travel event runs with no real expedition: cargo/
silver outcomes fall back to post stock (their existing non-travel
fallback), and any `{destination}` text or pace check modifiers simply don't
apply.

**Force Event's dropdown groups by `arc`** (`optgroup`, `CheatConsole.tsx`'s
`groupByArc`) so a multi-stage chain's events sit together instead of
scattered in file/definition order; events without an authored `arc` fall
into a trailing "(no arc)" group.

**"Fire & Resolve" forces a specific check result** (added alongside the
goblin ambush chain, §10, to test its fail-count escalation without grinding
real dice): picks one of the event's choices and, optionally, a tier
(`critSuccess`/`success`/`failure`/`critFailure`) to skip the roll and jump
straight to that outcome — "Auto" rolls for real, same as plain "Fire Now".
The one genuine engine touch this relies on: `resolveChoice`
(`engine/turn.ts`) gained an optional trailing `forcedTier` param that, when
set, skips `resolveCheck` entirely (no dice, no RNG consumed) and applies
that tier's outcomes directly — `ChoiceResolution.check` comes back `null` in
this case, so `EventPanel` shows the result text immediately with no dice
animation (it already treats `check === null` as "show the result now," the
same path a checkless choice takes). The store's `forceFireAndResolveEvent`
queues the event and calls this in one step, unlike plain `forceFireEvent`
(still `Outcome`-only) which just queues and leaves resolution to the normal
`chooseOption` flow.

**Queued Events panel** (2026-07-27, `fireQueuedEvent` in `gameStore.ts`):
lists everything currently in `GameState.queuedEvents` (title, pinned hero
if any, turns until due) with a **Fire Now** button that promotes that exact
entry into `pendingEvents` right now — unlike Force Event, which always
starts a fresh var-less instance, this preserves the queued entry's real
pinned hero and chain vars (falls back to `bindHero` only for the rare
unpinned queued event). This is the tool for stepping through a multi-stage
`queueEvent`/`sameHero` chain (e.g. the orc match chain, §10) one stage at a
time without ending turns or losing branch state — play a stage for real,
then Fire Now the queued follow-up instead of waiting out its `delayTurns`.

**Event Chain Viewer** (2026-07-31, `EventChainViewer.tsx`, opened via an
"Event Chains" button in the console's header — same `cheatModeEnabled`
gate, its own `eventChainViewerOpen` store flag): answers "what does this
authored chain actually look like, and what art does each branch need,"
which `docs/EVENT_CATALOG.md`'s "Arcs" section only shows as a flat id list.
Modeled directly on `FamilyTree.tsx`'s recursive-branch overlay (same
`ft-overlay`/`ft-modal`/`ft-canvas` shell and cycle-guard discipline) rather
than a graph-layout library — a chain is a small tree, same shape as a
family branch. `content/events/chainGraph.ts` (pure, no UI/test
dependencies) is the shared source of truth for both this tool and the
catalog generator's unreachable-event check: `chainTargetIds` traces every
`continueChain`/`queueEvent` outcome (the catalog generator used to keep its
own copy of this — now imports it), and `buildArcGraphs` additionally
resolves each choice/tier's edge — target event, illustration key (tier ??
choice ?? event, the same fallback `engine/turn.ts` uses), and whether that
illustration diverges from the node's own base image. One arc can render the
same target event more than once if multiple tiers of one choice
`continueChain` to it (e.g. both `critSuccess` and `success` on a "Watch the
treeline" check) — each edge draws its own branch rather than deduping
targets, so you see exactly which tier leads where. This is a **different**
arc-grouper from Force Event's `groupByArc` above: that one buckets *every*
event (including a trailing "no arc" catch-all) for a flat dropdown menu,
while `buildArcGraphs` only covers `arc`-tagged events and additionally
builds the edge graph — kept separate rather than merged since the two
consumers need different shapes.

## 15. Failure states

Four `GAME_OVER_KINDS`: `bankrupt` (2 consecutive missed-upkeep turns,
halved from 3 alongside the `turnsPerSeason` 6→3 cadence change — §1),
`brokenCompany` (all heroes dead/departed — a captive hero is **not** counted
as lost, since they may yet be ransomed or rescued, §17), `destroyed` (raid
cascade, §11), and `charterRevoked` — the Company's judgment on a post it
reads as lost to the frontier; see §5 for the mechanism (culture drift, the
active party's own heritage, and the bloodline-marriage signal all feed it)
and CHARTER_REVOKED_SPEC.md for the design record.

## 16. Save versioning

`saveVersion` lives in `engine/save.ts` as a **schema guard only** — the game
is pre-release and the **save-migration system was removed 2026-07-26** (it was
never used against real saves). `deserialize` validates and nothing more;
`validateGameState` rejects any save whose version isn't `TUNING.save.version`,
so a stale autosave just fails to load and the player starts fresh. On any
`GameState` shape change, **bump `TUNING.save.version`** so stale saves are
cleanly rejected — there is no migration function to add, and no
`MigrationContext`. Current version: **v29**. (Historic bumps once carried
migrations — roster/reserve split, buildings, heritage/culture, gender/family,
peoples restructure, Beastfolk, raiding, the Concession, captivity, thralls,
price intel, market shocks; v28 the Harpies, v29 faction discovery, v30
`Hero.captivity.source` widened to allow `'event'` — but those migration
paths no longer exist, only the version numbers they landed at.)

## 17. Captivity — abduction & ransom

Named heroes can be taken captive, reflecting the lore of `RIVER_CLANS`
(the in-fiction Sauromatians, matriarchal, `docs/lore/Sauromatia.md`) and
`BEASTFOLK` — the two `TUNING.abduction.riskyFactions`. Only **male** heroes
can be captured (the entire lore basis: these peoples lack men). `captive`
is a 4th `HeroStatus` (alongside `active`/`dead`/`departed`) — every existing
selector keyed on `status === 'active'` (`livingHeroes`, `activeHeroes`,
`heroesAtPost`, `isActiveHeroId`, `reconcileRoster`) excludes a captive hero
for free, exactly like death already does, so captivity needed no per-call-site
plumbing. An optional `Hero.captivity` (`{ faction, capturedTurn, source }`)
is the only new state; severity/escalation is derived from
`state.turn - capturedTurn` against `TUNING.abduction`, never stored.

**Two rolled triggers**, both in the pure `engine/captivity.ts` (shared, so
neither `raids.ts` nor `expeditions.ts` duplicates the logic): an incoming
raid that sacks the post rolls capture *before* the ordinary wound/death
branch for each qualifying hero (`raids.ts`); every expedition arrival at a
risky-faction destination rolls the same way (`expeditions.ts`'s
`advanceExpeditions`), with escorted guards reducing the chance — the
player's lever for lowering risk. A `raidGoal: 'rescue'` raid skips its own
roll (no minting a second captive en route to freeing the first).

**A third, authored trigger** (added 2026-07-27 for the goblin match
chain, §10): the `captureHero` `Outcome` (`engine/events/outcomes.ts`) lets
any event choice's tier outcome capture a hero directly, rather than only
via the two rolled triggers above — `source: 'event'` on `Hero.captivity`
distinguishes it. Same underlying `captureHero()` function, same
resolution chain; reach for this outcome before inventing a second
event-driven capture mechanism.

**Resolution reuses the existing chain-event mechanism** (§3) directly —
`captureHero` hand-builds a `QueuedEvent` (there's no authored-event context
at either capture call site to route through the `queueEvent` *outcome*
type) pinned via `heroId`, rolling a per-faction "quick release" chance first
(common for `RIVER_CLANS`, rare for `BEASTFOLK`); the rest fall into a
longer "held" check-in — the grim-warning beat, with one further long-odds
passive check afterward so a captivity is never permanently stuck absent
player action. **Two player-driven recoveries**, both new but reusing
existing machinery: a `ransom` `DiplomacyMissionType` (dispatchable only
against a faction currently holding a captive — `hasCaptiveHeldBy`) and a
`rescue` `RaidAttackGoal` (same gate, frees every captive held by the raided
faction on a win, no-ops on a loss). Both share one twist: past
`TUNING.abduction.refuseReturnThresholdTurns` (~a year), a successful
recovery can instead resolve as the hero **refusing to return** — reusing
the existing `'departed'` status via `departCharacter` (its guard widened
to also accept `'captive'`, alongside the `heroDeparts` outcome). Rarely,
recovering a long-held captive queues a follow-up event where the captor's
own family follows them home — reusing `formUnion`/`addDependant` (`kind:
'kin'`, already-grown so no `bornTurn` extension needed) exactly like the
existing Beastfolk voluntary-match content does.

**Content**: `content/events/captiveEvents.ts` (`captive_` prefix — a
new one), all `category: 'chain'` (their `conditions` are decorative, never
re-checked once queued, same as every other chain-only event; the real
gates are per-choice `requires`). **Two real engine bugs this surfaced and
fixed**, worth knowing for any future 4th-`HeroStatus`-style addition: the
due-chain binder in `events/selection.ts` looked a pinned hero up via
`heroesAtPost` (which a captive can never be in), and `advanceTurn`
permanently *deleted* any `heroId`-pinned `QueuedEvent` for a non-`'active'`
hero every turn (written when "not active" only ever meant dead/departed) —
both now also accept `'captive'`. A new `freeCaptive` outcome (mirrors
`heroDeparts`'s simplicity) clears captivity. UI: a captive-only
`CharactersScreen` section, a `HeroSheet` status line, and conditionally-shown
options on `RaidModal`/`MapScreen` (rescue) and `DiplomacyScreen` (ransom).
Save shape → **v23** (`migrateV22toV23`, a no-op passthrough — both new
fields are optional/additive, no old save ever had either).

## 18. Thralls — forced labor as a risk/reward alternative

*(THRALLS_SPEC.md — trimmed to open questions only, since none remain; the
design record for *why* it looks this way still lives there.)*

A second, parallel unnamed population — `GameState.thralls: ThrallState`
(`src/engine/thralls.ts`) — mirroring `ResidentState`'s shape (`roles`/
`idle`/`tags`/`heritage`) but never merged into it: no silver wage, a
`restiveness` 0–10 track instead of `contentment`, and `guards` never
populated (thralls can never be armed). Sauromatians call it thraldom, the
Company calls it "indentured labor" (`docs/lore/Ansberry Company.md`'s
Beastfolk Labor Contracting) — same mechanism, display text only differs by
acquisition channel. **Named-hero captivity (§17) is unrelated and
unchanged** — this system is only about the unnamed pool.

**Four risk levers, all live simultaneously:**
- **Output penalty, offset by guards.** `thrallOutputMultiplier` reads the
  free-resident guard:thrall ratio — below `guardRatioForFullOutput`, thralls
  work at `unguardedOutputMult` (0.5); above it, `guardedOutputMult` (0.9,
  still short of a free resident's 1.0). Thralls in `farmers`/`hunters`/
  `herders`/`craftsfolk` fill whatever land/build capacity free residents
  leave spare (`claim.ts`'s `accrueCropProgress`/`wildlandTrickle`/
  `growHerd`, `residents.ts`'s `applyCraftsfolkConstruction`), at this
  multiplier.
- **Escape & revolt.** `updateRestiveness` rises with the thrall:free-resident
  ratio and missed food, falls with guards present. In the `restive` band
  (≥7), `applyEscape` passively bleeds a fraction each turn (permanent loss,
  guard-suppressed, mirrors `applyDesertion`); a `thrall_revolt` content
  event (`content/events/thrallEvents.ts`) becomes eligible via the new
  `thrallsAtLeast`/`thrallRestivenessAtLeast` conditions, resolved with
  ordinary `loseThralls`/`loseResidents`/`contentment`/`stress`/`health`
  outcomes — no new battle system.
- **Free-resident contentment pressure.** `thrallContentmentPressure` scales
  with the thrall:free-resident ratio, folded into `updateContentment`
  alongside friction pressure (§7) — living alongside a held population
  unsettles the free pool.
- **Standing / Company judgment.** Season-end, while any thralls are held:
  a flat standing loss against every non-hostile faction in
  `TUNING.thralls.holding.nativeFactions` (deliberately not per-origin), plus
  a `culture`-axis nudge toward Frontier (`applyHoldingPressure`) —
  deliberately the input the still-unbuilt `charterRevoked` mechanism
  (`TODO_FEATURES.md`) would read, without building that mechanism. The
  Company's own purchase channel carries no separate penalty — holding
  thralls at all is what counts, not which euphemism they were bought under.

**Acquisition — four vectors:**
1. **Outgoing raid** — a new `enslave` `RaidAttackGoal` (§11), requiring at
   least one escort guard (`dispatchErrorRaid`) — "you cannot march captives
   home unescorted." Higher `factionStandingLoss` than `plunder`. Captured
   heads are held on the expedition (`ExpeditionState.thrallsCaptured`/
   `thrallsCapturedHeritage`) like cargo/silver and only land in
   `thralls.idle` on homecoming (`resolveHomecoming`), not at battle
   resolution — lost with the rest of the haul if the party never makes it
   home (fixed 2026-07-24; used to call `addThralls` immediately at arrival,
   before the return leg's travel time had elapsed). Tagged by the raided
   *location's* people via `targetHeritageFor`: the location's own tag wins
   first (`beast_wilds` 'orc', `goblin_wilds` 'goblin', `pemba_jasiri`
   'weri', etc. — fixes both a BEASTFOLK-faction 50/50 coinflip that ignored
   which camp was actually hit, and seatless/unmapped factions silently
   defaulting to 'imanian'), then that seat's `hireSources` entry, then any
   `hireSources` entry for the faction, then the BEASTFOLK coinflip as a
   last-resort fallback (unreachable today — both beastfolk camps already
   carry an explicit tag), then 'imanian'.
2. **Incoming raid — reflavor only.** A sack's existing population-loss line
   now reads "N of the post's people are taken as thralls by `<aggressor>`."
   No new mechanic, no rescue path — mirrors §17's captivity being
   reflavor-only for the reverse case.
3. **Purchase**, two channels: a native `thralls` `DiplomacyMissionType`
   (envoy mission, gated Friendly+ standing, silver scales with headcount
   requested, turnout scales by check tier like every other envoy mission —
   `DiplomacyScreen.tsx`, tagged by the seat's `hireSources` entry); and the
   Company's "indentured labor" channel, a silver-only
   `purchaseCompanyThralls` store action surfaced on the Diplomacy screen's
   Company-seat detail (no envoy/turn needed), gated on `CHARTER_COMPANY`
   standing not being Hostile. The envoy channel shares the outgoing-raid
   fix above — purchased heads ride home on the expedition and only join
   `thralls.idle` at homecoming, not at arrival.
4. **Via event** — `thrall_river_clans_offer` (`thrallEvents.ts`) using the
   generic `addThralls`/`loseThralls` outcome vocabulary; any future event
   can offer/cost thralls the same way.

**Manumission** — the counter-play. `manumitThralls(state, role, count)`
moves heads from `thralls` into `residents` (same role or idle), carrying
`tags`/`heritage` proportionally, for `TUNING.thralls.manumission.
silverPerHead` — plus a one-time standing gain with every non-hostile native
faction and a small culture nudge back toward Homeland (the mirror of the
holding-pressure lever). Freed heads immediately draw a wage like any other
resident. Store action `freeThralls` (assignmentAction, debounced autosave);
UI is a "Free" button alongside the Outpost Overview's Idle Thralls controls.

**Concession capacity is combined**: `claimedPopulation = residentTotal +
thrallTotal` is what's weighed against `claimCapacity` (`isOverClaim`,
`updateContentment`'s over-Concession pressure, `resolveOverClaimPressure`)
— thralls occupy the same land. Thralls still eat grain (`payUpkeep`), no
silver wage.

**Files:** `src/engine/thralls.ts` (new — selectors/mutators, deliberately
importing nothing from `residents.ts`/`claim.ts` to avoid a cycle; those
modules import from it instead), `content/tuning.ts` (`TUNING.thralls`),
`engine/raids.ts` (`enslave` goal + branch, incoming reflavor),
`engine/expeditions.ts` (`thralls` mission dispatch/arrival, escort gate),
`engine/events/{types,conditions,outcomes}.ts` (`thrallsAtLeast`/
`thrallRestivenessAtLeast` conditions; `addThralls`/`loseThralls`/
`thrallRestiveness` outcomes), `content/events/thrallEvents.ts`,
`store/gameStore.ts` (`reallocateThralls`/`freeThralls`/
`purchaseCompanyThralls`), UI (`ResidentsPanel.tsx`'s Thralls block on
Outpost Overview — includes a Makeup row (`thrallHeritageCount`, homeland
vs. native head count) and an Origins row (`thrallTagCounts`, finer
flavor-tag breakdown) mirroring the free-resident pool's equivalent rows,
`DiplomacyScreen.tsx`, `RaidModal.tsx`/`MapScreen.tsx`'s `enslave` goal
option, a `CheatConsole.tsx` Thralls section for testing).
**Save shape: v25** (`migrateV24toV25`, backfills `thralls: freshThralls()`
— no old save ever had one).

**Test coverage for the heritage/timing fix:** `raids.test.ts`'s "an enslave
raid tags thralls by the raided camp and only seats them on homecoming"
(goblin_wilds → 'goblin', beast_wilds → 'orc', asserting `thrallTotal` is 0
right after battle resolution and only reflects the capture after
`advanceExpeditions` runs the party all the way home) and "...tags thralls
by that seat, not the faction default" (river_meet → 'kiswani', not a bare
faction-level lookup); `diplomacy.test.ts`'s "a thralls-purchase envoy only
seats thralls on homecoming, not at arrival" covers the same timing fix for
the purchase channel.

## 19. Harpies — the crag people

*(TERRITORY_DISCOVERY_SPEC.md — the newest people, built the same way the
Beastfolk were: a near-total content extension of the existing Heritage/
faction/family machinery, §10 is the template.)*

The Ashmark's winged people of the high Stormwall crags. `Heritage` gains
`harpy` (native group, like orc/goblin/weri; it hybridizes normally —
`isMatrilinealPure` stays orc/goblin-only). A seatless `HARPY` faction ("The
Harpies", starts −60) has **no map seat** — no Send-Envoy path, no local hire
entry; standing moves only through events, exactly like `BEASTFOLK`.

Discovered by exploring to **The Windward Crags** (`harpy_eyrie`), a non-market
discovery node inside the Harpy territory and behind the `stormwall`
checkpoint (`old_road` + `hill_fort` visited), so Harpies are a deep-frontier
find. It starts `initialDiscovery: 'unknown'` and carries `discoversFaction:
'HARPY'`, so reaching it makes the faction known (§5).

Content (`content/events/harpy/`, `harpy_` prefix) mirrors the
Beastfolk standing arc gated on the eyrie's discovery: `harpy_tribute` (hostile
band, pay/refuse), `harpy_match` (rising standing — a harpy comes down to wed a
hero via `formUnion(source:'alliance', heritage:'harpy')` + the `wed_harpy`
trait), `harpy_settlement` (high standing — a flight settles as guards/hunters,
setting `friction` 7), and the `harpy_integration`/`_settled` friction arc.
A `travel_harpy_toll` (`destinationTag: 'harpy'`) mirrors the beastfolk toll
as an aerial sky-toll. Harpy names live in `content/names.ts`; the portrait
pool (`src/assets/portraits/harpy/`) isn't painted yet, so harpy faces use the
hash-tile fallback (§13) — dropping art in later needs no code.

**Still open:** an in-fiction faction/eyrie name is placeholder-final ("The
Harpies"/"The Windward Crags"); the Harpy raid profile uses the shared bases
(no distinct `beastfolkAlwaysEligible`-style bypass or per-faction abduction
identity yet); and lore (`docs/lore/`) + portrait art are deferred, so
`harpy_` events carry no `loreRef`.

## 20. Named faction figures — a person inside the abstraction

*(NAMED_NPCS_SPEC.md — closes the long-standing gap where every faction/
people was a standing number and a camp/seat, with nobody in it the player
could point to. Piloted on a single Goblin figure; the engine mechanism
itself is generic, per CLAUDE.md rule #2.)*

**Data model.** `FactionFigure` (`engine/types.ts`) is deliberately *not*
folded into `Hero`/`HeroStatus` — doing so would need every `status ===
'active'` selector (`livingHeroes`, grain, `brokenCompany`, ...) to carve out
"exists, but isn't really here." Instead `GameState.factionFigures: Record<
string, FactionFigure>` is a separate bucket, empty until a figure is met.
Content provides `FactionFigureDef`s (`content/factionFigures.ts`, injected
via `TurnContext.factionFigureDefs`, same split as `RecruitDef`), and the
engine builds the runtime `FactionFigure` from one via the `introduceFigure`
outcome — the "meet in world" moment. A figure carries the same
stats/skills/traits/health shape as a `Hero`, a free-form `counters` bag (the
personal antagonize/rapport track, same idiom as `Hero.counters`, entirely
separate from faction `standing`), and an optional `heldByPost` flag (an
antagonize-escalation capture, mirroring `Hero.captivity` in reverse — the
post is the captor).

**Four resolutions, all one-shot** (recruiting/marrying/ransoming a figure
removes it from `factionFigures` for good — no successor mechanism; a
resolved people simply has no named figure for the rest of that
playthrough):
- **Recruit** — the `recruitFigure` outcome promotes a figure into a real
  roster `Hero` via `recruitFactionFigure` (`engine/roster.ts`), carrying
  over its *current* identity/condition rather than template defaults
  (unlike `recruitCharacter`'s always-fresh-from-template build).
- **Antagonize → capture** — day-to-day friction moves the personal
  `figureCounter` outcome (read via `figureCounterAtLeast`/`AtMost`) and
  never touches faction standing; the `captureFigure` outcome (an
  antagonize-escalation beat) sets `heldByPost` without resolving the arc,
  since ransom still needs the figure to exist.
- **Ransom** — `ransomFigure` pays silver to the post and resolves the arc;
  this is the capture payoff (Bartosz, 2026-07-30 — a cash resource, not a
  diplomacy-leverage token or a unique thrall).
- **Marry/ally** — `marryFigure` calls the existing `formUnion` alliance path
  using the figure's own identity; an outsider who marries in always becomes
  a `Dependant`, never a `Hero` (per `Hero.spouseIds`'s existing doc
  comment), so this is a third, distinct promotion path alongside recruit
  (→ `Hero`) and capture (→ `heldByPost`, no roster entry at all).

Big resolution beats (recruit/capture/ransom/marry) also carry an ordinary
`standing` outcome alongside the figure-specific one, authored the same way
any other named-character event does — a content convention, not a new
mechanism (Bartosz, 2026-07-30: personal counters stay personal, but big
beats nudge standing too).

**New generic engine vocabulary**: outcomes `introduceFigure`/
`figureCounter`/`recruitFigure`/`captureFigure`/`ransomFigure`/`marryFigure`;
conditions `figureExists`/`figureNotExists`/`figureCounterAtLeast`/
`figureCounterAtMost`/`figureHeldByPost`. All figure-scoped conditions take
an explicit `figureId` rather than resolving one via any `HeroBinding`-style
mechanism — with only one figure in play for the pilot, a figure-binding
system would be pure speculative generality; add one only once a second
concurrent figure actually ships.

**Goblin pilot**: Yikka the Tallykeeper (`content/factionFigures.ts`,
`content/events/goblin/tallykeeper.ts`, arc `goblin_tallykeeper`) — the one
who keeps the tally stick behind the goblin road's running ambush game
(ambush.ts's `goblin_ambush_fails`/`goblin_ambush_wins` counters, §10).
`goblin_tallykeeper_reveal` (post, once, gated on `goblin_wilds` reaching
`visited`) introduces her by name; `goblin_tallykeeper_dealings` (travel,
repeatable, gated on `destinationTag: 'goblin'` + `figureExists`) offers
hunt-her-down (→ capture), win-her-over (→ recruit), court-her (→ marry,
choice-gated on `heroGender: 'male'` + `heroCanMarry`), or walk away;
`goblin_tallykeeper_retaliates` (post, once, gated on her grudge counter
reaching 3) escalates an ignored antagonize track into a `startRaid`;
`goblin_tallykeeper_ransom` (post, gated on `figureHeldByPost`) is the
capture payoff. All four are pure additions — no edits to the shipped
`ambush.ts`/`firstEncounter.ts` chains they build on.

**UI**: none — purely event-text driven (Bartosz, 2026-07-30), matching how
the rest of Beastfolk content works.

**Save shape:** v32 (`GameState.factionFigures`, additive, no migration —
per the current Saves policy a stale save simply fails validation).

**Still open** (not blockers, just not decided yet): rolling this out to
other peoples/factions beyond the Goblin pilot; whether cardinality should
ever go beyond one named figure per people.

---

## 21. Reputation traits — a hero's history following them around

*(REPUTATION_TRAITS_SPEC.md — Bartosz, 2026-07-31: heroes who keep getting
ambushed by goblins should earn a bad reputation for it; heroes who
repeatedly turn the tables or make friends of it should earn the opposite.
Needed no engine changes at all — every piece (traits, per-hero counters,
threshold-gated events, trait-aware binding) already existed and is reused
as-is, per CLAUDE.md rule #2.)*

**The mechanism, in full, is existing vocabulary:** `Outcome: addTrait`/
`removeTrait` grant/revoke a `TraitId` (already real, e.g. `shaken`,
`wed_orc`); `Hero.counters` + `Outcome: heroCounter` +
`Condition: heroCounterAtLeast`/`heroCounterAtMost` are the persistent
per-hero memory `ambush.ts` already used for its own escalating tiers;
`HeroBinding: withTrait`/`withoutTrait` binds an event only to (or
excluding) a hero already carrying a trait, returning no eligible hero
otherwise — confirmed in `selection.ts`/`binding.ts` that a counter-gated
condition is evaluated per candidate *before* binding, so a `{ type:
'random' }`-bound, counter-gated event already self-narrows to only
qualifying heroes (exactly how the pre-existing `travel_goblin_ambush_tired`/
`travel_goblin_ambush_surrender` tiers behave). A **reputation axis** is
just a set of `TraitId`s that are mutually exclusive by content convention
— nothing enforces this beyond every grant site removing the other poles.

**One new generic helper**, `exclusiveTrait(grant, others)`
(`content/events/eventHelpers.ts`, alongside a plain `outcome.addTrait`/
`removeTrait`): returns `[...removeTrait(others), addTrait(grant)]`.
Domain-agnostic — takes trait ids as parameters, no knowledge of which axis
or people they belong to — so any future reputation axis reuses it as-is.

**Goblin pilot**: a "goblin reputation" axis of three traits
(`content/traits.ts`) — `easy_target` (BEASTFOLK −2, the victim pole),
`goblin_shakedown_artist` (BEASTFOLK +2, the extortionist pole),
`friend_of_goblins` (BEASTFOLK +1 / intimidation −1, the bonded pole).
Grant sites, all in `ambush.ts`:
- `easy_target` slots into the existing `travel_goblin_ambush_tired`
  failure/critFailure branches (already gated `goblin_ambush_fails ≥ 4`,
  already per-candidate) — no new event needed.
- `goblin_shakedown_artist`/`friend_of_goblins` each get a small new travel
  event (`travel_goblin_ambush_feared`/`travel_goblin_ambush_bond`), gated
  on their own threshold (`goblin_ambush_wins ≥ 3`, and a new
  `goblin_ambush_kindness` counter ≥ 3, incremented on the existing
  "spring it back" reaction choice). Both compete in the normal weighted
  travel-event draw alongside the base tiers, same as the pre-existing
  `travel_goblin_ambush_surrender`/`travel_goblin_trade` already do — no
  extra "already granted" bookkeeping needed, since `addTrait` is
  idempotent and these counters never decrease.
- **Reversible**: since every grant calls `exclusiveTrait`, a hero later
  crossing a *different* axis's own threshold flips cleanly to the new
  pole, regardless of which one they held before.

**Consuming the reputation elsewhere** — three `withTrait`-gated variants,
each layered alongside an existing event (higher weight, same conditions
plus the trait binding) rather than editing the original:
- `goblin_tallykeeper_dealings_easy_target`/`_shakedown`/`_friend`
  (`tallykeeper.ts`) — Yikka literally keeps a tally of every name, so all
  three poles get a variant here.
- `goblin_tallykeeper_reveal_easy_target` — only the victim pole; a rarer,
  one-shot payoff (guarded by `figureNotExists` so it can't double-fire
  after the original reveal already has).
- `goblin_match_skulking_friend` (`match.ts`) — only the bonded pole fits
  the courtship opener naturally; shares the same downstream chain
  (`goblin_match_intrusion`/`goblin_match_offer`) as the untouched
  original, the two competing for the hero pool via their own bindings
  (`weightedStat` vs. `withTrait`) and each gated by its own independent
  `once`.

**UI**: none — a plain `TraitDef`, shown wherever traits already render
(e.g. the Hero Sheet).

**Save shape**: unchanged — new `TraitId`s and `Hero.counters` keys are both
free-form/content-defined already (`TraitId = string`,
`Record<string, number>`), so no save-version bump.

**Still open**: rolling the pattern out to a second reputation axis or
people beyond this Goblin pilot.

---

## What's still open

The full backlog lives in **`docs/TODO_FEATURES.md`** — one consolidated
file (merged 2026-07-24 from what were briefly eight separate trimmed spec
files, one per area) covering: master-level open questions (bond values,
difficulty modes, art pipeline, Cult-pressure mechanic, tier-4 endgame,
in-fiction naming gaps), the Concession's land-conflict/forced-reallocation
event content, buildings backlog (tier 4, true axis-gated buildings, storage
caps, `activeCapBonus`), the unwired `charterRevoked`
Company-judgment mechanism (heritage + family sides both), Peoples Phase C
Company-town content, Family's remaining forks (matrilineal marry-out,
per-people alliance flavor, dependant mortality, bride-price income),
Beastfolk's remaining content (sub-clan depth — the named-recruit gap
closed 2026-07-30, §20), the
Harpies' remaining content (in-fiction faction/eyrie naming, a distinct
raid/abduction identity, lore + portrait art), and a separate engineering
backlog (store-mutation helper, `SaveResult`/autosave warnings, lint
tooling, test-coverage gaps, an unaudited content-file pass).
