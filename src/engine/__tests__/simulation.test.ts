// End-to-end engine smoke test: play whole seasons headlessly with random
// (seeded) choices — the MVP 1 "survive the first season" loop, sans UI.

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { constructionError, startConstruction } from '../buildings';
import { evalConditions } from '../events/conditions';
import { dispatchExpedition } from '../expeditions';
import { addChild, canWed, childrenOf, formUnion, isMarried, spousesOf } from '../family';
import type { TravelContext } from '../events/types';
import { Rng } from '../rng';
import {
  hireResidents,
  reallocate,
  residentCap,
  residentsAvailable,
  residentTotal,
} from '../residents';
import { advancePendingEvent, advanceTurn, resolveChoice, resolveTurn } from '../turn';
import { discoveryAtLeast, heroesAtPost, RESIDENT_ROLES } from '../types';
import type { ActiveEvent, GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

function travelCtxOf(state: GameState, active: ActiveEvent): TravelContext | undefined {
  if (!active.expeditionId) return undefined;
  const expedition = state.expeditions.find((e) => e.id === active.expeditionId);
  if (!expedition) return undefined;
  const destination = TEST_CONTENT.locationDefs.get(expedition.destination);
  return destination ? { expedition, destination } : undefined;
}

/** Every few turns, send whoever can be spared out into the world. */
function maybeDispatch(state: GameState, rng: Rng): void {
  const atPost = heroesAtPost(state);
  if (state.turn % 3 !== 0 || atPost.length < 4) return;
  const heroIds = [atPost[0].id, atPost[1].id];
  const defs = [...TEST_CONTENT.locationDefs.values()];
  const caravanTargets = defs.filter((d) => {
    const loc = state.locations[d.id];
    return d.hasMarket && d.id !== 'post' && loc && discoveryAtLeast(loc.discovery, 'visited');
  });
  const exploreTargets = defs.filter((d) => {
    const loc = state.locations[d.id];
    return d.id !== 'post' && loc && (loc.discovery === 'rumored' || loc.discovery === 'visited');
  });
  const envoyTargets = defs.filter((d) => {
    const loc = state.locations[d.id];
    return d.faction !== undefined && loc && discoveryAtLeast(loc.discovery, 'visited');
  });
  const laborTarget = defs.find((d) => {
    const loc = state.locations[d.id];
    return d.faction === 'CHARTER_COMPANY' && loc && discoveryAtLeast(loc.discovery, 'visited');
  });
  const roll = rng.next();
  if (
    roll < 0.15 &&
    laborTarget &&
    state.silver > 120 &&
    residentTotal(state) < residentCap(state)
  ) {
    dispatchExpedition(
      state,
      { kind: 'labor', destination: laborTarget.id, heroIds: [heroIds[0]], laborCount: 1 },
      TEST_CONTENT.locationDefs,
    );
  } else if (roll < 0.4 && caravanTargets.length > 0) {
    dispatchExpedition(
      state,
      {
        kind: 'caravan',
        destination: rng.pick(caravanTargets).id,
        heroIds,
        cargo: { tools: Math.min(2, state.goods.tools), salt: Math.min(2, state.goods.salt) },
        buyOrders: { furs: 3 },
        silver: Math.min(20, state.silver),
        residents: {
          porters: Math.min(2, residentsAvailable(state, 'porters')),
          guards: Math.min(1, residentsAvailable(state, 'guards')),
        },
      },
      TEST_CONTENT.locationDefs,
    );
  } else if (roll < 0.7 && envoyTargets.length > 0) {
    dispatchExpedition(
      state,
      { kind: 'diplomacy', destination: rng.pick(envoyTargets).id, heroIds },
      TEST_CONTENT.locationDefs,
    );
  } else if (exploreTargets.length > 0) {
    dispatchExpedition(
      state,
      { kind: 'explore', destination: rng.pick(exploreTargets).id, heroIds },
      TEST_CONTENT.locationDefs,
    );
  }
}

/** Exercise the family system: courtship runs, informal unions, and births. */
function maybeFamily(state: GameState, rng: Rng): void {
  const atPost = heroesAtPost(state);
  if (atPost.length === 0) return;
  const roll = rng.next();

  // A homeland courtship run, if the landing is reachable and coin allows.
  if (state.turn % 5 === 0 && roll < 0.2 && state.silver > TUNING.family.homelandBridePrice + 60) {
    const loc = state.locations.charter_landing;
    const subject = atPost.find((h) => canWed(state, h.id));
    if (subject && loc && discoveryAtLeast(loc.discovery, 'visited')) {
      dispatchExpedition(
        state,
        { kind: 'courtship', destination: 'charter_landing', heroIds: [subject.id], courtshipFor: subject.id },
        TEST_CONTENT.locationDefs,
      );
      return;
    }
  }

  // An informal union for an unwed hero at the post.
  const unwed = atPost.find((h) => !isMarried(state, h.id) && canWed(state, h.id));
  if (unwed && roll < 0.45) {
    formUnion(state, unwed.id, { source: 'informal', heritage: 'kiswani', name: 'Companion' });
    return;
  }

  // A child to a married hero whose family is not already large.
  const wed = atPost.find((h) => isMarried(state, h.id) && childrenOf(state, h.id).length < 3);
  if (wed && roll > 0.6) {
    addChild(state, wed.id, {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, state.nextDependantId),
      rand: () => rng.next(),
    });
  }
}

/** Every so often, break ground on whatever the post can afford to build. */
function maybeBuild(state: GameState): void {
  if (state.construction || state.turn % 4 !== 0) return;
  for (const id of ['storehouse', 'palisade', 'common_house']) {
    if (constructionError(state, id) === null) {
      startConstruction(state, id);
      return;
    }
  }
}

function playTurns(state: GameState, turns: number, choiceRng: Rng): void {
  for (let i = 0; i < turns; i++) {
    if (state.gameOver) return;
    // Take on a few hands when there's room and coin, and put idle ones to work.
    if (state.turn % 2 === 0 && state.silver > 80 && residentTotal(state) < residentCap(state)) {
      // Local hire is gated on native standing/discovery; a no-op when unmet.
      hireResidents(state, choiceRng.next() < 0.5 ? 'farmers' : 'porters', 1, 'kiswani');
    }
    if (state.residents.idle > 0) reallocate(state, 'idle', 'guards', state.residents.idle);
    maybeDispatch(state, choiceRng);
    maybeBuild(state);
    maybeFamily(state, choiceRng);
    // Standing orders: a sensible default spread.
    const party = heroesAtPost(state);
    party.forEach((hero, idx) => {
      state.assignments[hero.id] =
        idx % 4 === 0 ? 'provision' : idx % 4 === 1 ? 'trade' : idx % 4 === 2 ? 'rest' : 'diplomacy';
    });
    // If something's under construction, put a hand on it.
    if (state.construction && party.length > 0) {
      state.assignments[party[party.length - 1].id] = 'build';
    }
    resolveTurn(state, TEST_CONTENT);
    while (state.phase === 'event' && state.pendingEvents.length > 0) {
      const active = state.pendingEvents[0];
      const event = TEST_CONTENT.events.get(active.eventId)!;
      const travel = travelCtxOf(state, active);
      const openChoices = event.choices
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => !c.requires || evalConditions(state, c.requires, travel));
      expect(openChoices.length).toBeGreaterThan(0); // every event must stay answerable
      const pick = openChoices[choiceRng.int(0, openChoices.length - 1)];
      resolveChoice(state, TEST_CONTENT, event, pick.idx, active.heroId, active.expeditionId);
      if (state.gameOver) return;
      advancePendingEvent(state);
    }
    if (state.phase === 'report') advanceTurn(state);
  }
}

describe('full-season simulation', () => {
  it('plays the first season (6 turns) across many seeds without crashing', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = testState(seed);
      playTurns(s, 6, new Rng(seed * 31));
      if (!s.gameOver) {
        expect(s.turn).toBe(7);
        expect(s.phase).toBe('assignment');
      }
      // Invariants that must hold whatever happened:
      expect(s.silver).toBeGreaterThanOrEqual(0);
      for (const qty of Object.values(s.goods)) expect(qty).toBeGreaterThanOrEqual(0);
      for (const h of s.heroes) {
        expect(h.health).toBeGreaterThanOrEqual(0);
        expect(h.health).toBeLessThanOrEqual(10);
        expect(h.stress).toBeGreaterThanOrEqual(0);
        expect(h.stress).toBeLessThanOrEqual(10);
      }
      // No hero is ever on two expeditions at once.
      const awayIds = s.expeditions.flatMap((e) => e.heroIds);
      expect(new Set(awayIds).size).toBe(awayIds.length);
      for (const exp of s.expeditions) {
        expect(exp.silver).toBeGreaterThanOrEqual(0);
        for (const qty of Object.values(exp.cargo)) expect(qty).toBeGreaterThanOrEqual(0);
      }
      // Resident pool invariants: non-negative, within cap, mood in band.
      for (const role of RESIDENT_ROLES) expect(s.residents.roles[role]).toBeGreaterThanOrEqual(0);
      expect(s.residents.idle).toBeGreaterThanOrEqual(0);
      expect(residentTotal(s)).toBeLessThanOrEqual(residentCap(s));
      expect(s.residents.contentment).toBeGreaterThanOrEqual(0);
      expect(s.residents.contentment).toBeLessThanOrEqual(10);
      // Heritage tally stays non-negative and summed-equal to the pool; culture in band.
      expect(s.residents.heritage.homeland).toBeGreaterThanOrEqual(0);
      expect(s.residents.heritage.native).toBeGreaterThanOrEqual(0);
      expect(s.residents.heritage.homeland + s.residents.heritage.native).toBe(residentTotal(s));
      expect(s.axes.culture).toBeGreaterThanOrEqual(-10);
      expect(s.axes.culture).toBeLessThanOrEqual(10);
      // Buildings & tier invariants: tier in range, at most one live project.
      expect(s.postTier).toBeGreaterThanOrEqual(1);
      expect(s.postTier).toBeLessThanOrEqual(4);
      if (s.construction) expect(s.construction.progress).toBeGreaterThanOrEqual(0);
      // Transient invariants: positive head counts, at most one inspector group.
      for (const t of s.transients) expect(t.count).toBeGreaterThan(0);
      expect(s.transients.filter((t) => t.kind === 'companyAgents').length).toBeLessThanOrEqual(1);
      // Family invariants: every dependant has a gender, no one parents themselves,
      // the spouse cap holds, and dependants never inflate the residents cap.
      for (const d of s.dependants) {
        expect(d.gender === 'male' || d.gender === 'female').toBe(true);
        expect(d.parentIds?.includes(d.id) ?? false).toBe(false);
      }
      for (const h of s.heroes) {
        expect(spousesOf(s, h.id).length).toBeLessThanOrEqual(TUNING.family.maxSpousesPerHero);
      }
      expect(residentTotal(s)).toBeLessThanOrEqual(residentCap(s)); // dependants excluded from the pool
    }
  });

  it('survives a full year (24 turns) on at least some seeds', () => {
    let survived = 0;
    for (let seed = 100; seed < 112; seed++) {
      const s = testState(seed);
      playTurns(s, 24, new Rng(seed));
      if (!s.gameOver) survived++;
    }
    expect(survived).toBeGreaterThan(0);
  });

  it('identical seeds and choices give identical year-long runs', () => {
    const run = () => {
      const s = testState(4242);
      playTurns(s, 24, new Rng(4242));
      return s;
    };
    expect(run()).toEqual(run());
  });
});
