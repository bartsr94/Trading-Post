// Turn resolution pipeline (spec §3): economy tick → activity results →
// event selection. Event choices resolve interactively, then the turn
// advances (with season-end skill growth every 6th turn).

import { TUNING } from '../content/tuning';
import {
  bestGoverningStat,
  checkBreakdown,
  isSuccess,
  markSkill,
  resolveCheck,
  traitModifiers,
} from './checks';
import type { CheckResult } from './checks';
import {
  addBuildProgress,
  buildingEffect,
  completeConstructionIfDone,
} from './buildings';
import { driftMarket, priceOf, prosperity } from './economy';
import type { GoodDef } from './economy';
import { advanceExpeditions, travelContextFor } from './expeditions';
import {
  addTransientGroup,
  applyAxisArrivals,
  applyCraftsfolkConstruction,
  applyCultureDrift,
  applyDesertion,
  applyGrowth,
  outputMultiplier,
  removeTransients,
  residentsAvailable,
  residentTotal,
  updateContentment,
} from './residents';
import { applyOutcomes } from './events/outcomes';
import type { OutcomeContext } from './events/outcomes';
import { evalConditions } from './events/conditions';
import { childrenComingOfAge, comeOfAge, grownKinCount } from './family';
import { dependantCount, reconcileRoster } from './roster';
import { selectEvents } from './events/selection';
import type { Choice, GameEvent, TierResult } from './events/types';
import { Rng } from './rng';
import { paceCheckModifier } from './map';
import {
  clamp,
  getHero,
  heroesAtPost,
  isSeasonEnd,
  livingHeroes,
  reserveHeroes,
} from './types';
import type {
  BuildingId,
  ExpeditionState,
  GameState,
  Gender,
  GoodId,
  Heritage,
  Hero,
  LocationDef,
  LocationId,
  MapFeatureDef,
  MapRegionDef,
  RecruitDef,
  TraitDef,
} from './types';

export { bestGoverningStat } from './checks';

export interface TurnContext {
  events: ReadonlyMap<string, GameEvent>;
  goodDefs: ReadonlyMap<GoodId, GoodDef>;
  traitDefs: ReadonlyMap<string, TraitDef>;
  goodNames: ReadonlyMap<GoodId, string>;
  factionNames: ReadonlyMap<string, string>;
  traitNames: ReadonlyMap<string, string>;
  locationDefs: ReadonlyMap<LocationId, LocationDef>;
  mapRegionDefs: readonly MapRegionDef[];
  mapFeatureDefs: readonly MapFeatureDef[];
  locationNames: ReadonlyMap<LocationId, string>;
  buildingNames: ReadonlyMap<BuildingId, string>;
  recruitDefs: ReadonlyMap<string, RecruitDef>;
  /** A dependant name for a people + gender, picked deterministically by seed. */
  dependantName: (heritage: Heritage, gender: Gender, seed: number) => string;
}

export function outcomeCtx(
  ctx: TurnContext,
  heroId: string,
  expedition?: ExpeditionState,
  rng?: Rng,
): OutcomeContext {
  return {
    heroId,
    expedition,
    goodNames: ctx.goodNames,
    factionNames: ctx.factionNames,
    traitNames: ctx.traitNames,
    locationNames: ctx.locationNames,
    buildingNames: ctx.buildingNames,
    recruitDefs: ctx.recruitDefs,
    dependantName: ctx.dependantName,
    rng,
  };
}

// ---------------------------------------------------------------- resolution

/**
 * Runs the resolution phase for the current turn. Mutates `state` in place
 * (callers work on a cloned draft) and leaves it in the event phase.
 */
export function resolveTurn(state: GameState, ctx: TurnContext): void {
  const rng = new Rng(state.rngState);
  const silverBefore = state.silver;
  const goodsBefore = { ...state.goods };
  state.report = { turn: state.turn, lines: [], silverDelta: 0, goodsDelta: {} };
  const report = (icon: string, text: string) => state.report.lines.push({ icon, text });

  // 1. Economy tick: price drift, then food + upkeep + the Charter quota.
  driftMarket(state, rng);
  const missedFood = payUpkeep(state, ctx, report);

  if (state.bankruptcyClock >= TUNING.economy.bankruptcyTurns) {
    declareGameOver(state, 'bankrupt');
    state.rngState = rng.getState();
    return;
  }

  payCharterQuota(state, report);
  const missedWages = payResidentWages(state, report);

  // 2. Expeditions move (and may resolve) before at-post activities.
  advanceExpeditions(state, ctx, rng, report);

  // 3. Activity results for heroes present at the post.
  for (const hero of heroesAtPost(state)) {
    resolveActivity(state, ctx, hero, rng, report);
  }

  // 3a. Craftsfolk press any active build forward on their own (mood-scaled).
  const crewGain = applyCraftsfolkConstruction(state);
  if (crewGain > 0 && state.construction) {
    const name = ctx.buildingNames.get(state.construction.building) ?? state.construction.building;
    report('🔨', `The craftsfolk press on with the ${name} — +${crewGain} progress.`);
  }

  // 3b. A construction project that reached its mark opens for use.
  const finished = completeConstructionIfDone(state);
  if (finished) {
    const name = ctx.buildingNames.get(finished) ?? finished;
    report('🏗️', `The ${name} is finished and stands ready.`);
  }

  // 3c. The resident society settles: mood, desertion, growth, arrivals.
  resolveResidentSociety(state, ctx, rng, report, { missedFood, missedWages });

  // 4. Stress breakdowns queue their event for immediate selection
  //    (heroes away break down once they are home to do it).
  for (const hero of heroesAtPost(state)) {
    if (
      hero.stress >= TUNING.stress.breakdownThreshold &&
      !state.queuedEvents.some((q) => q.heroId === hero.id)
    ) {
      state.queuedEvents.push({
        eventId: TUNING.stress.breakdownEventId,
        fireOnTurn: state.turn,
        heroId: hero.id,
      });
      report('💢', `${hero.name} is at the breaking point.`);
    }
  }

  // 5. Event selection.
  // Permanently impossible pinned chains cannot ever become bindable again.
  state.queuedEvents = state.queuedEvents.filter(
    (queued) =>
      queued.heroId === undefined ||
      state.heroes.some((hero) => hero.id === queued.heroId && hero.status === 'active'),
  );
  const selected = selectEvents(
    state,
    ctx.events,
    ctx.locationDefs,
    rng,
    ctx.mapRegionDefs,
    ctx.mapFeatureDefs,
  );
  state.pendingEvents = selected;
  const remainingQueued = [...state.queuedEvents];
  for (const active of selected) {
    const event = ctx.events.get(active.eventId);
    if (!event) continue;
    if (event.once) state.firedEvents.push(event.id);
    state.cooldowns[event.id] = state.turn + (event.cooldownTurns ?? TUNING.events.defaultCooldown);
    const queuedIndex = remainingQueued.findIndex(
      (queued) =>
        queued.eventId === active.eventId &&
        queued.fireOnTurn <= state.turn &&
        (queued.heroId === undefined || queued.heroId === active.heroId),
    );
    if (queuedIndex >= 0) remainingQueued.splice(queuedIndex, 1);
  }
  state.queuedEvents = remainingQueued;

  state.report.silverDelta = state.silver - silverBefore;
  for (const [good, qty] of Object.entries(state.goods) as [GoodId, number][]) {
    const delta = qty - goodsBefore[good];
    if (delta !== 0) state.report.goodsDelta[good] = delta;
  }

  state.phase = state.pendingEvents.length > 0 ? 'event' : 'report';
  state.rngState = rng.getState();
}

/** Food + post upkeep for heroes and residents. Returns whether food ran short. */
function payUpkeep(
  state: GameState,
  ctx: TurnContext,
  report: (icon: string, text: string) => void,
): boolean {
  const party = livingHeroes(state);
  const res = TUNING.residents;

  // Farmers work their plots before the post eats (mood scales the yield).
  const farmers = residentsAvailable(state, 'farmers');
  const grown = Math.round(farmers * res.effects.grainPerFarmerPerTurn * outputMultiplier(state));
  if (grown > 0) {
    state.goods.grain += grown;
    report('🌾', `The fields yield ${grown} grain.`);
  }

  const mouths = residentTotal(state);
  // Named characters (active + reserve) eat as heroes; dependants eat too.
  const grainNeeded =
    party.length * TUNING.economy.grainPerHeroPerTurn +
    mouths * res.grainPerResidentPerTurn +
    dependantCount(state) * TUNING.dependants.grainPerDependantPerTurn;
  const grainDef = ctx.goodDefs.get('grain');
  let missed = false;
  let missedFood = false;

  if (state.goods.grain >= grainNeeded) {
    state.goods.grain -= grainNeeded;
    report('🍞', `The post eats ${grainNeeded} grain.`);
  } else if (grainDef) {
    const shortfall = grainNeeded - state.goods.grain;
    const cost = shortfall * priceOf(state, grainDef);
    if (state.silver >= cost) {
      state.goods.grain = 0;
      state.silver -= cost;
      report('🍞', `Grain ran short; bought ${shortfall} for ${cost} silver.`);
    } else {
      state.goods.grain = 0;
      missed = true;
      missedFood = true;
      report('⚠️', 'Not enough food. Bellies are empty and tempers fray.');
    }
  }

  // Craftsfolk (and the Workshop) keep the place mended, easing the silver upkeep;
  // each building carries its own maintenance on top of the tier-1 base.
  const craftsfolk = residentsAvailable(state, 'craftsfolk');
  const relief =
    Math.round(craftsfolk * res.effects.upkeepReliefPerCraftsperson * outputMultiplier(state)) +
    buildingEffect(state, 'craftReliefBonus');
  const upkeep = Math.max(
    0,
    TUNING.economy.postUpkeepSilver + buildingEffect(state, 'upkeepSilver') - relief,
  );

  if (!missed && state.silver >= upkeep) {
    state.silver -= upkeep;
  } else if (!missed) {
    missed = true;
    report('⚠️', 'The post’s upkeep goes unpaid.');
  }

  if (missed) {
    state.bankruptcyClock += 1;
    for (const hero of party) {
      hero.stress = clamp(hero.stress + TUNING.economy.missedUpkeepStress, 0, TUNING.condition.maxStress);
    }
    report(
      '🕰️',
      `Unpaid upkeep: ${state.bankruptcyClock} of ${TUNING.economy.bankruptcyTurns} turns before ruin.`,
    );
  } else {
    state.bankruptcyClock = 0;
  }

  return missedFood;
}

/** Quarterly (season-end) wages for the resident pool. Returns whether they went short. */
function payResidentWages(
  state: GameState,
  report: (icon: string, text: string) => void,
): boolean {
  if (!isSeasonEnd(state.turn)) return false;
  const total = residentTotal(state);
  const reserve = reserveHeroes(state).length;
  // Residents draw a wage; reserve characters draw a retainer; grown kin draw a
  // lighter retainer (FAMILY_SPEC.md §11). Active heroes (partners in the venture),
  // spouses, and children draw none.
  const bill =
    total * TUNING.residents.seasonWagePerResident +
    reserve * TUNING.roster.retainerWagePerReserve +
    grownKinCount(state) * TUNING.family.grownKinRetainer;
  if (bill === 0) return false;

  if (state.silver >= bill) {
    state.silver -= bill;
    report('🪙', `The season's wages (${bill} silver) go out to the post's people.`);
    return false;
  }

  state.silver = 0;
  report('⚠️', `Wages go unpaid this season — an empty strongbox and unhappy hands.`);
  return true;
}

/** Mood, desertion, growth, and axis-driven arrivals for the resident pool. */
function resolveResidentSociety(
  state: GameState,
  ctx: TurnContext,
  rng: Rng,
  report: (icon: string, text: string) => void,
  flags: { missedFood: boolean; missedWages: boolean },
): void {
  advanceTransients(state, report);
  if (residentTotal(state) === 0) return;

  updateContentment(state, flags);

  const deserted = applyDesertion(state);
  if (deserted > 0) {
    report('🚪', `${deserted} resident${deserted === 1 ? '' : 's'} desert the post in the unrest.`);
  }

  const grew = applyGrowth(state, rng, prosperity(state, ctx.goodDefs));
  if (grew > 0) report('👪', 'A new pair of hands drifts in to join the post.');

  if (isSeasonEnd(state.turn)) {
    for (const arrival of applyAxisArrivals(state)) {
      report(
        arrival.group === 'native' ? '🪶' : '🏡',
        arrival.group === 'native'
          ? `Native kin settle at the post (${arrival.count}).`
          : `Settler families put down roots (${arrival.count}).`,
      );
    }
    const drift = applyCultureDrift(state);
    if (Math.abs(drift) >= TUNING.heritage.axisDriftReportThreshold) {
      report(
        '🧭',
        drift > 0
          ? 'The post takes on a more Sauromatian character.'
          : 'The post holds to its Imanian ways.',
      );
    }
  }
}

/** Transient outsiders count down and leave (Phase B spawns them). */
function advanceTransients(
  state: GameState,
  report: (icon: string, text: string) => void,
): void {
  const leaving: string[] = [];
  for (const t of state.transients) {
    if (t.turnsLeft < 0) continue; // indefinite
    t.turnsLeft -= 1;
    if (t.turnsLeft <= 0) leaving.push(t.id);
  }
  if (leaving.length > 0) {
    state.transients = state.transients.filter((t) => !leaving.includes(t.id));
    report('👋', 'Visitors take their leave of the post.');
  }
}

/** Quarterly (season-end) profit shipment to the Ansberry Company (spec §8). */
function payCharterQuota(
  state: GameState,
  report: (icon: string, text: string) => void,
): void {
  if (!isSeasonEnd(state.turn)) return;
  const c = TUNING.charter;
  const faction = state.factions.CHARTER_COMPANY;

  if (state.silver >= c.quotaSilver) {
    state.silver -= c.quotaSilver;
    state.charterMissedStreak = 0;
    faction.standing = clamp(faction.standing + c.metStandingGain, -100, 100);
    report('📦', `The season's profit shipment (${c.quotaSilver} silver) goes out to Thornwatch.`);
    if (removeTransients(state, 'companyAgents') > 0) {
      report('📜', 'The Company inspectors, satisfied, withdraw from the post.');
    }
    return;
  }

  state.charterMissedStreak += 1;
  const loss = Math.round(
    c.standingLossPerMiss * c.streakEscalation ** (state.charterMissedStreak - 1),
  );
  faction.standing = clamp(faction.standing - loss, -100, 100);
  for (const hero of livingHeroes(state)) {
    hero.stress = clamp(hero.stress + c.missedQuotaStress, 0, TUNING.condition.maxStress);
  }
  report(
    '📜',
    `No profit shipment for Thornwatch — the charter quota goes unmet ` +
      `(${state.charterMissedStreak} season${state.charterMissedStreak === 1 ? '' : 's'} running). Standing -${loss}.`,
  );

  // Inspectors post themselves at the post while the debt stands, souring the mood.
  if (!state.transients.some((t) => t.kind === 'companyAgents')) {
    addTransientGroup(state, 'companyAgents', TUNING.residents.transients.companyAgentCount, -1);
    report('👁️', 'Company inspectors arrive to watch over the post until the quota is paid.');
  }

  if (state.charterMissedStreak >= c.seizureStreakThreshold) {
    const seized = Math.round(state.silver * c.seizureFraction);
    if (seized > 0) {
      state.silver -= seized;
      report('⚠️', `Company inspectors seize ${seized} silver from the stores in lieu of payment.`);
    }
  }
}

function resolveActivity(
  state: GameState,
  ctx: TurnContext,
  hero: Hero,
  rng: Rng,
  report: (icon: string, text: string) => void,
): void {
  const activity = state.assignments[hero.id] ?? 'unassigned';

  switch (activity) {
    case 'trade': {
      const eco = TUNING.economy;
      const stat = bestGoverningStat(hero, 'bargain');
      const mods = traitModifiers(hero, ctx.traitDefs, 'bargain', ['trade']);
      const check = resolveCheck(rng, hero, 'bargain', stat, eco.tradeCheckDifficulty, mods);
      const prosMult =
        1 + prosperity(state, ctx.goodDefs) * eco.prosperityTradeBonus +
        buildingEffect(state, 'tradeIncomeBonus');
      let income = 0;
      if (isSuccess(check.tier)) {
        income = Math.round(eco.tradeBaseIncome * prosMult + check.margin * eco.tradeMarginSilver);
        markSkill(hero, 'bargain');
      } else if (check.tier === 'failure') {
        income = Math.round(
          eco.tradeBaseIncome * prosMult * eco.tradeFailureIncomeMultiplier,
        );
      }
      state.silver += income;
      report('💰', `${hero.name} runs the market: ${checkBreakdown(check)}. +${income} silver.`);
      break;
    }
    case 'provision': {
      const prov = TUNING.provision;
      const stat = bestGoverningStat(hero, 'survival');
      const mods = traitModifiers(hero, ctx.traitDefs, 'survival', ['hunting']);
      const check = resolveCheck(rng, hero, 'survival', stat, prov.checkDifficulty, mods);
      let yieldGrain: number = prov.failureYield;
      if (check.tier === 'critSuccess') yieldGrain = prov.critYield;
      else if (check.tier === 'success') yieldGrain = prov.successYield;
      if (isSuccess(check.tier)) markSkill(hero, 'survival');
      state.goods.grain += yieldGrain;
      report('🏹', `${hero.name} hunts and forages: ${checkBreakdown(check)}. +${yieldGrain} food.`);
      break;
    }
    case 'rest': {
      const cond = TUNING.condition;
      // A Common House makes rest go further; an Infirmary heals faster too.
      const stressRecovery = cond.restStressRecovery + buildingEffect(state, 'stressReliefBonus');
      const healthRecovery = cond.restHealthRecovery + buildingEffect(state, 'healingBonus');
      hero.health = clamp(hero.health + healthRecovery, 0, cond.maxHealth);
      hero.stress = clamp(hero.stress - stressRecovery, 0, cond.maxStress);
      let line = `${hero.name} rests and recovers.`;
      if (rng.next() < cond.restTraitRecoveryChance) {
        const recoverable = hero.traits.filter((t) => {
          const def = ctx.traitDefs.get(t);
          return def !== undefined && def.recoverable === true;
        });
        if (recoverable.length > 0) {
          const trait = rng.pick(recoverable);
          hero.traits = hero.traits.filter((t) => t !== trait);
          const name = ctx.traitNames.get(trait) ?? trait;
          hero.history.push(`Shook off ${name} in turn ${state.turn}.`);
          line = `${hero.name} rests — and finally shakes off ${name}.`;
        }
      }
      report('🛌', line);
      break;
    }
    case 'diplomacy': {
      const dip = TUNING.diplomacy;
      const stat = bestGoverningStat(hero, 'diplomacy');
      const mods = traitModifiers(hero, ctx.traitDefs, 'diplomacy', ['diplomacy', 'CHARTER_COMPANY']);
      const check = resolveCheck(rng, hero, 'diplomacy', stat, dip.atPostCheckDifficulty, mods);
      const faction = state.factions.CHARTER_COMPANY;
      let delta = 0;
      if (check.tier === 'critSuccess') delta = dip.atPostStandingGainCrit;
      else if (check.tier === 'success') delta = dip.atPostStandingGainSuccess;
      else if (check.tier === 'failure') delta = -dip.atPostStandingLossFailure;
      else delta = -dip.atPostStandingLossCritFailure;
      if (isSuccess(check.tier)) markSkill(hero, 'diplomacy');
      faction.standing = clamp(faction.standing + delta, -100, 100);
      report(
        '🤝',
        `${hero.name} hosts the Company's factor: ${checkBreakdown(check)}. ` +
          `Ansberry standing ${delta >= 0 ? '+' : ''}${delta}.`,
      );
      break;
    }
    case 'build': {
      const b = TUNING.building;
      if (!state.construction) {
        report('🔨', `${hero.name} has no project to build — start one on the Post screen.`);
        break;
      }
      const stat = bestGoverningStat(hero, 'craft');
      const mods = traitModifiers(hero, ctx.traitDefs, 'craft', ['build']);
      const check = resolveCheck(rng, hero, 'craft', stat, b.buildCheckDifficulty, mods);
      const gain = b.buildProgressYield[check.tier] ?? 0;
      addBuildProgress(state, gain);
      if (isSuccess(check.tier)) markSkill(hero, 'craft');
      const name = ctx.buildingNames.get(state.construction.building) ?? state.construction.building;
      report('🔨', `${hero.name} works the ${name}: ${checkBreakdown(check)}. +${gain} progress.`);
      break;
    }
    case 'unassigned':
      report('❔', `${hero.name} idles about the post.`);
      break;
    default:
      report('❔', `${hero.name} has nothing to do (${activity} not yet available).`);
      break;
  }
}

// ------------------------------------------------------------ event choices

export interface ChoiceResolution {
  check: CheckResult | null;
  tier: keyof Choice['outcomes'];
  resultText: string;
  log: string[];
}

/** Resolves a player's event choice: roll the check (if any), apply outcomes. */
export function resolveChoice(
  state: GameState,
  ctx: TurnContext,
  event: GameEvent,
  choiceIndex: number,
  heroId: string,
  expeditionId?: string,
): ChoiceResolution {
  const hero = getHero(state, heroId);
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`Event ${event.id} has no choice ${choiceIndex}`);
  const expedition = expeditionId
    ? state.expeditions.find((e) => e.id === expeditionId)
    : undefined;
  const travel = expedition ? travelContextFor(expedition, ctx) : undefined;
  if (choice.requires && !evalConditions(state, choice.requires, { heroId, travel })) {
    throw new Error(`Choice ${choiceIndex} is not available for event ${event.id}.`);
  }
  const rng = new Rng(state.rngState);

  let check: CheckResult | null = null;
  let tier: keyof Choice['outcomes'] = 'success';

  if (choice.check) {
    const difficulty =
      typeof choice.check.difficulty === 'function'
        ? choice.check.difficulty(state)
        : choice.check.difficulty;
    const mods = traitModifiers(hero, ctx.traitDefs, choice.check.skill, choice.check.tags ?? []);
    if (event.category === 'travel' && expedition) {
      const value = paceCheckModifier(expedition.pace);
      if (value !== 0) mods.push({ label: `${expedition.pace ?? 'normal'} pace`, value });
    }
    check = resolveCheck(rng, hero, choice.check.skill, choice.check.stat, difficulty, mods);
    tier = check.tier;
    if (isSuccess(check.tier)) markSkill(hero, choice.check.skill);
  }

  const result = pickTierResult(choice, tier);
  const log = applyOutcomes(state, result.outcomes, outcomeCtx(ctx, heroId, expedition, rng));

  state.rngState = rng.getState();
  checkBrokenCompany(state);

  return { check, tier, resultText: result.text, log };
}

/** Missing tiers fall back sensibly: crit→normal, failure→success. */
function pickTierResult(choice: Choice, tier: keyof Choice['outcomes']): TierResult {
  const o = choice.outcomes;
  switch (tier) {
    case 'critSuccess':
      return o.critSuccess ?? o.success;
    case 'success':
      return o.success;
    case 'failure':
      return o.failure ?? o.success;
    case 'critFailure':
      return o.critFailure ?? o.failure ?? o.success;
  }
}

/** Removes the current pending event; moves to report when none remain. */
export function advancePendingEvent(state: GameState): void {
  state.pendingEvents = state.pendingEvents.slice(1);
  if (state.gameOver) return;
  if (state.pendingEvents.length === 0 && state.phase === 'event') {
    state.phase = 'report';
  }
}

// -------------------------------------------------------------- turn advance

/** Ends the report phase: season-end skill growth, then the next turn begins. */
export function advanceTurn(state: GameState): string[] {
  const growthLines: string[] = [];
  const rng = new Rng(state.rngState);

  if (isSeasonEnd(state.turn)) {
    for (const hero of livingHeroes(state)) {
      for (const skill of hero.skillMarks) {
        const current = hero.skills[skill];
        if (current >= TUNING.skillGrowth.maxSkill) continue;
        const roll = rng.d6() + rng.d6();
        if (roll >= TUNING.skillGrowth.baseDifficulty + current) {
          hero.skills[skill] = current + 1;
          growthLines.push(`${hero.name}'s ${skill} improves to ${current + 1}.`);
          hero.history.push(`Improved ${skill} to ${current + 1} (turn ${state.turn}).`);
        }
      }
      hero.skillMarks = [];
    }

    // Children old enough become named grown kin — the family line continues
    // (FAMILY_SPEC.md §7). Grown kin stay in the tree, marriageable and fertile.
    for (const child of childrenComingOfAge(state)) {
      const grown = comeOfAge(state, child.id);
      if (grown) growthLines.push(`${grown.name} comes of age at the post.`);
    }
  }

  // Standing orders persist; dead/departed heroes drop off the board and out
  // of the active party (a freed slot can be filled from the reserve).
  for (const hero of state.heroes) {
    if (hero.status !== 'active') delete state.assignments[hero.id];
  }
  reconcileRoster(state);

  state.turn += 1;
  state.phase = 'assignment';
  state.rngState = rng.getState();
  checkBrokenCompany(state);
  return growthLines;
}

function checkBrokenCompany(state: GameState): void {
  if (!state.gameOver && livingHeroes(state).length === 0) {
    declareGameOver(state, 'brokenCompany');
  }
}

function declareGameOver(state: GameState, kind: 'bankrupt' | 'brokenCompany'): void {
  state.gameOver =
    kind === 'bankrupt'
      ? {
          kind,
          title: 'The Ledger Closes',
          text: 'Three turns without pay or provisions. The laborers drift away first, then the heroes. One grey morning the post is simply empty — a clearing with tents rotting back into the frontier, and a debt entered in an Ansberry Company ledger far away.',
        }
      : {
          kind,
          title: 'The Broken Company',
          text: 'No one is left to keep the fire. The goods sit in their crates until the natives, or the wolves, or the winter claims them. In the homeland, the venture becomes a cautionary tale told over wine.',
        };
  state.phase = 'gameover';
}
