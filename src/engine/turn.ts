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
import { driftMarket, priceOf, prosperity } from './economy';
import type { GoodDef } from './economy';
import { advanceExpeditions } from './expeditions';
import { applyOutcomes } from './events/outcomes';
import type { OutcomeContext } from './events/outcomes';
import { selectEvents } from './events/selection';
import type { Choice, GameEvent, TierResult } from './events/types';
import { Rng } from './rng';
import {
  clamp,
  getHero,
  heroesAtPost,
  isSeasonEnd,
  livingHeroes,
} from './types';
import type {
  ExpeditionState,
  GameState,
  GoodId,
  Hero,
  LocationDef,
  LocationId,
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
  locationNames: ReadonlyMap<LocationId, string>;
}

function outcomeCtx(
  ctx: TurnContext,
  heroId: string,
  expedition?: ExpeditionState,
): OutcomeContext {
  return {
    heroId,
    expedition,
    goodNames: ctx.goodNames,
    factionNames: ctx.factionNames,
    traitNames: ctx.traitNames,
    locationNames: ctx.locationNames,
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

  // 1. Economy tick: price drift, then food + upkeep.
  driftMarket(state, rng);
  payUpkeep(state, ctx, report);

  if (state.bankruptcyClock >= TUNING.economy.bankruptcyTurns) {
    declareGameOver(state, 'bankrupt');
    state.rngState = rng.getState();
    return;
  }

  // 2. Expeditions move (and may resolve) before at-post activities.
  advanceExpeditions(state, ctx, rng, report);

  // 3. Activity results for heroes present at the post.
  for (const hero of heroesAtPost(state)) {
    resolveActivity(state, ctx, hero, rng, report);
  }

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
  const selected = selectEvents(state, ctx.events, ctx.locationDefs, rng);
  state.pendingEvents = selected;
  for (const active of selected) {
    const event = ctx.events.get(active.eventId);
    if (!event) continue;
    if (event.once) state.firedEvents.push(event.id);
    state.cooldowns[event.id] = state.turn + (event.cooldownTurns ?? TUNING.events.defaultCooldown);
    state.queuedEvents = state.queuedEvents.filter(
      (q) => !(q.eventId === active.eventId && q.fireOnTurn <= state.turn),
    );
  }

  state.report.silverDelta = state.silver - silverBefore;
  for (const [good, qty] of Object.entries(state.goods) as [GoodId, number][]) {
    const delta = qty - goodsBefore[good];
    if (delta !== 0) state.report.goodsDelta[good] = delta;
  }

  state.phase = state.pendingEvents.length > 0 ? 'event' : 'report';
  state.rngState = rng.getState();
}

function payUpkeep(
  state: GameState,
  ctx: TurnContext,
  report: (icon: string, text: string) => void,
): void {
  const party = livingHeroes(state);
  const grainNeeded = party.length * TUNING.economy.grainPerHeroPerTurn;
  const grainDef = ctx.goodDefs.get('grain');
  let missed = false;

  if (state.goods.grain >= grainNeeded) {
    state.goods.grain -= grainNeeded;
    report('🍞', `The company eats ${grainNeeded} grain.`);
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
      report('⚠️', 'Not enough food. Bellies are empty and tempers fray.');
    }
  }

  if (!missed && state.silver >= TUNING.economy.postUpkeepSilver) {
    state.silver -= TUNING.economy.postUpkeepSilver;
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
      const prosMult = 1 + prosperity(state, ctx.goodDefs) * eco.prosperityTradeBonus;
      let income = 0;
      if (isSuccess(check.tier)) {
        income = Math.round(eco.tradeBaseIncome * prosMult + check.margin * eco.tradeMarginSilver);
        markSkill(hero, 'bargain');
      } else if (check.tier === 'failure') {
        income = Math.round((eco.tradeBaseIncome * prosMult) / 2);
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
      hero.health = clamp(hero.health + cond.restHealthRecovery, 0, cond.maxHealth);
      hero.stress = clamp(hero.stress - cond.restStressRecovery, 0, cond.maxStress);
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
    case 'unassigned':
      report('❔', `${hero.name} idles about the post.`);
      break;
    default:
      // explore / diplomacy / build arrive with MVP 2; UI keeps them locked.
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
  const rng = new Rng(state.rngState);
  const hero = getHero(state, heroId);
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`Event ${event.id} has no choice ${choiceIndex}`);
  const expedition = expeditionId
    ? state.expeditions.find((e) => e.id === expeditionId)
    : undefined;

  let check: CheckResult | null = null;
  let tier: keyof Choice['outcomes'] = 'success';

  if (choice.check) {
    const difficulty =
      typeof choice.check.difficulty === 'function'
        ? choice.check.difficulty(state)
        : choice.check.difficulty;
    const mods = traitModifiers(hero, ctx.traitDefs, choice.check.skill, choice.check.tags ?? []);
    check = resolveCheck(rng, hero, choice.check.skill, choice.check.stat, difficulty, mods);
    tier = check.tier;
    if (isSuccess(check.tier)) markSkill(hero, choice.check.skill);
  }

  const result = pickTierResult(choice, tier);
  const log = applyOutcomes(state, result.outcomes, outcomeCtx(ctx, heroId, expedition));

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
  }

  // Standing orders persist; dead/departed heroes drop off the board.
  for (const hero of state.heroes) {
    if (hero.status !== 'active') delete state.assignments[hero.id];
  }

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
