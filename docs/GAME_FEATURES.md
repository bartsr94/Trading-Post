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

One turn = two weeks; 24 turns/year in 4 seasons of 6 turns each. The player
sets standing-order assignments per hero that persist between turns rather
than requiring re-entry each time.

`resolveTurn` (`src/engine/turn.ts`) resolves, in order: market price drift →
food/upkeep/bankruptcy check → Charter quota (season end) → resident wages
(season end) → expedition advancement → per-hero activity resolution →
craftsfolk passive build progress → construction completion → event
selection. `GameState.phase` is `'assignment' | 'event' | 'report' |
'gameover'` (`PHASES` in `types.ts`). The player resolves `pendingEvents` one
at a time via `resolveChoice` + `advancePendingEvent`, then a report phase,
then `advanceTurn` (season-end skill growth every 6th turn).

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
`_talks` → `_close`, 3 stages, `content/events/beastfolkEvents.ts`, gated on
`beast_wilds` discovery.

## 4. Economy & goods

9 goods (furs, hides, grain [displayed as **"Food"**, id unchanged], salt,
tools, cloth, timber, amber, herbs), each with seasonal price modifiers
(`src/content/goods.ts`). Per-market price drift: `basePrice × seasonalMod ×
supply/demand × event mod`. The post's own market lives on `GameState.market`;
each `LocationState` carries its own independent `market`. The `trade`
activity buys/sells at the post; caravans (an `ExpeditionKind`) carry goods to
other markets over multiple turns.

## 5. Factions, diplomacy & the Charter quota

Six factions (`FACTION_IDS`): `RIVER_CLANS` ("The Tributary Towns"),
`HILL_TRIBES` ("The Hanjoda Nomads"), `OLD_PEOPLE` ("The Bejasi Hills Folk"),
`CHARTER_COMPANY` ("The Ansberry Company"), `KNIGHTS_EIRWEN` (seated at
Pemba-Jasiri, an Imanian sub-power), and `BEASTFOLK` ("The Greenskins",
seatless — see §10). Standing runs −100..+100 with stance bands.

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
capacity) and guards (arrival-check bonus) — they leave `roles` at dispatch,
still count for upkeep while away, and rejoin on homecoming.

**Transients** (`GameState.transients`) are outsiders the post neither feeds
nor pays: `companyAgents` (indefinite, spawned on a missed Charter quota,
cleared on a met one), `visitorGuards` (on a successful envoy arrival),
`supplierCrew` (via a content event). `transientEffect` sums their
defense/contentment-pressure/cargo effects purely into `postDefense`/
`updateContentment`/caravan cargo.

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
discovered native faction).

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
never counted in `residentTotal`.

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
peoples), `union` (source), and `comeOfAge`.

Three union sources, all via `formUnion`: **homeland** (a `courtship`
expedition to Thornwatch — pays `homelandBridePrice` up front, bumps
Company standing on arrival); **alliance** (an event chain with a Friendly+
native faction, standing + culture-Frontier + a union trait); **informal**
(a cheap at-post event, no faction boost, culture nudge only).
`recomputeBloodline` marks a household `mixed` if any native blood is under
the roof, else `pure`. Multiple spouses per hero are allowed
(`maxSpousesPerHero`, 3).

**Children & coming of age.** `addChild` computes dual-parentage ancestry
and a heritage-skewed gender roll. A season-end sweep
(`childrenComingOfAge`) turns a `child` dependant into a `kind:'kin'` grown
adult — still named, marriageable, drawing a lighter retainer — which is
what makes the family tree genuinely multi-generational.

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
only through event outcomes. Discovery node `beast_wilds` ("The Gnawback
Camp") is pure exploration/event territory.

Content: demand/tribute events at low standing (pay, haggle, refuse — all
non-violent, in silver/goods/standing/stress); voluntary union at rising
standing (reuses `formUnion(source: 'alliance')` verbatim, plus `wed_orc`/
`wed_goblin` traits); settlement at high standing (reuses `addResidents`,
split into two calls so orc/goblin counts stay distinct in the Origins tag
breakdown). Mixed orc/goblin × human children fall out of the existing
`Ancestry.peoples`/`bloodline` logic with no new code.

**Raiding intersection** (raiding shipped separately, after this content):
`BEASTFOLK` is one of several possible incoming-raid aggressors, with a
laxer eligibility rule than seated factions (`beastfolkAlwaysEligible`
bypasses the normal hostile-standing-threshold gate, reflecting "wild
raiders"). A Beastfolk-flavored raid-threat event exists in
`raidEvents.ts` — this is genuine raid content the original Beastfolk pass
explicitly deferred; it arrived later as part of the general raiding system,
not a revision to the Beastfolk events above.

**Save shape:** v10 (the only backfill needed was seeding
`factions.BEASTFOLK` — new `Heritage`/`TransientKind` literals need no
migration).

## 11. Raiding — two-way warfare

*(No dedicated spec file for this ever shipped in this checkout — this
section is sourced from the codebase directly.)*

Pure battle math + selectors live in `src/engine/raids.ts`, content-free
beyond an injected `RaidContext` (goodDefs/goodNames/buildingNames),
mirroring `TurnContext`.

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

**16 buildings currently exist:** `storehouse`, `palisade`, `trade_hall`,
`common_house`, `workshop` (tier 1); `storehouse_ii` (Grand Storehouse),
`palisade_ii` (Stone Rampart), `workshop_ii` (Foundry), `infirmary`,
`watchtower`, `river_shrine`, `goblin_warren`, `orc_longhouse`,
`counting_house`, `dock`, `stables` (all minTier 2). Effect fields wired:
`foodStorageBonus`, `defenseBonus`, `prosperityBonus`, `tradeIncomeBonus`,
`stressReliefBonus` + `healingBonus`, `craftReliefBonus`, `upkeepSilver`,
`contentmentBonus`, `cargoCapacityBonus`, `travelCheckBonus`. Gating
vocabulary: `minTier`, `prerequisites`, `requiresResidents`,
`requiresHeritageGroup`, `requiresTag`, `requiresStanding`, `minSilverHeld`.

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
  Assignments, Diplomacy, Characters, Buildings, Map, Market — plus Export
  Save / Abandon / Settings (cheat-mode toggle) pinned to the bottom. Icons
  are single-color stroke SVGs (`Icon.tsx`), never emoji.
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
name).

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

## 14. Cheat console

An off-by-default testing tool (`CheatConsole.tsx`, toggled via
`SettingsMenu.tsx`'s "Cheat mode" checkbox, persisted to `localStorage`, not
`GameState`/save). Adds **no new engine mechanism** — every button builds an
`Outcome[]` (the same union every event outcome already uses) and runs it
through the real, unmodified `applyOutcomes`. Can also force-fire any
non-travel event directly, bypassing `once`/cooldown/`firedEvents`
bookkeeping (deliberately — only `resolveTurn`'s normal selection pass
touches those).

## 15. Failure states

Four `GAME_OVER_KINDS`: `bankrupt` (3 consecutive missed-upkeep turns),
`brokenCompany` (all heroes dead/departed — a captive hero is **not** counted
as lost, since they may yet be ransomed or rescued, §17), `destroyed` (raid
cascade, §11),
and `charterRevoked` — this last one **exists only as a type literal**, with
no code path anywhere that ever sets it. The Company's read of `culture` +
`partyHeritageShare` + `bloodline`/multi-spouse composition that was meant
to feed it is seeded in the save schema (v7) but not wired into
`payCharterQuota`. See `docs/TODO_FEATURES.md` for the unbuilt
mechanism as originally specced.

## 16. Save versioning

`saveVersion` + migrations live in `engine/save.ts`; any `GameState` shape
change bumps `TUNING.save.version` and adds a migration case (tests enforce
unknown versions throw). Current version: **v23**. Rough history: v5 roster/
reserve split; v6 buildings; v7 heritage/culture; v8 gender/family; v9
peoples restructure (Hanjoda/Weri, KNIGHTS_EIRWEN); v10 Beastfolk; v11
resident tag counts fixed; v13→v16 raiding; v19→v20 diplomacy discovery;
v20→v21 the Concession (claim/herd, hard cap removed); v22 hero-to-hero
marriage (`spouseIds`/`temperament`); v23 captivity (§17).

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

**Two triggers**, both in the new pure `engine/captivity.ts` (shared, so
neither `raids.ts` nor `expeditions.ts` duplicates the logic): an incoming
raid that sacks the post rolls capture *before* the ordinary wound/death
branch for each qualifying hero (`raids.ts`); every expedition arrival at a
risky-faction destination rolls the same way (`expeditions.ts`'s
`advanceExpeditions`), with escorted guards reducing the chance — the
player's lever for lowering risk. A `raidGoal: 'rescue'` raid skips its own
roll (no minting a second captive en route to freeing the first).

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
Beastfolk's remaining content (named recruit, travel toll, second
settlement flavor, visitor transient, sub-clan depth), and a separate
engineering backlog (store-mutation helper, `SaveResult`/autosave warnings,
lint tooling, test-coverage gaps, an unaudited content-file pass).
