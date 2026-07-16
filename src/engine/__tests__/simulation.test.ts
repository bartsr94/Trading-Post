// End-to-end engine smoke test: play whole seasons headlessly with random
// (seeded) choices — the MVP 1 "survive the first season" loop, sans UI.

import { describe, expect, it } from 'vitest';
import { evalConditions } from '../events/conditions';
import { Rng } from '../rng';
import { advancePendingEvent, advanceTurn, resolveChoice, resolveTurn } from '../turn';
import { livingHeroes } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

function playTurns(state: GameState, turns: number, choiceRng: Rng): void {
  for (let i = 0; i < turns; i++) {
    if (state.gameOver) return;
    // Standing orders: a sensible default spread.
    const party = livingHeroes(state);
    party.forEach((hero, idx) => {
      state.assignments[hero.id] = idx % 3 === 0 ? 'provision' : idx % 3 === 1 ? 'trade' : 'rest';
    });
    resolveTurn(state, TEST_CONTENT);
    while (state.phase === 'event' && state.pendingEvents.length > 0) {
      const active = state.pendingEvents[0];
      const event = TEST_CONTENT.events.get(active.eventId)!;
      const openChoices = event.choices
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => !c.requires || evalConditions(state, c.requires));
      expect(openChoices.length).toBeGreaterThan(0); // every event must stay answerable
      const pick = openChoices[choiceRng.int(0, openChoices.length - 1)];
      resolveChoice(state, TEST_CONTENT, event, pick.idx, active.heroId);
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
