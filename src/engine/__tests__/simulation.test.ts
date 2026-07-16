// End-to-end engine smoke test: play whole seasons headlessly with random
// (seeded) choices — the MVP 1 "survive the first season" loop, sans UI.

import { describe, expect, it } from 'vitest';
import { evalConditions } from '../events/conditions';
import { dispatchExpedition } from '../expeditions';
import type { TravelContext } from '../events/types';
import { Rng } from '../rng';
import { advancePendingEvent, advanceTurn, resolveChoice, resolveTurn } from '../turn';
import { discoveryAtLeast, heroesAtPost } from '../types';
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
  if (rng.next() < 0.5 && caravanTargets.length > 0) {
    dispatchExpedition(
      state,
      {
        kind: 'caravan',
        destination: rng.pick(caravanTargets).id,
        heroIds,
        cargo: { tools: Math.min(2, state.goods.tools), salt: Math.min(2, state.goods.salt) },
        buyOrders: { furs: 3 },
        silver: Math.min(20, state.silver),
      },
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

function playTurns(state: GameState, turns: number, choiceRng: Rng): void {
  for (let i = 0; i < turns; i++) {
    if (state.gameOver) return;
    maybeDispatch(state, choiceRng);
    // Standing orders: a sensible default spread.
    const party = heroesAtPost(state);
    party.forEach((hero, idx) => {
      state.assignments[hero.id] = idx % 3 === 0 ? 'provision' : idx % 3 === 1 ? 'trade' : 'rest';
    });
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
