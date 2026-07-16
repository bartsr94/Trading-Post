import { describe, expect, it } from 'vitest';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import { isEligible, selectEvents } from '../events/selection';
import { interpolate } from '../events/text';
import { Rng } from '../rng';
import { TEST_CONTENT, testState } from './helpers';

const NAME_CTX = {
  goodNames: TEST_CONTENT.goodNames,
  factionNames: TEST_CONTENT.factionNames,
  traitNames: TEST_CONTENT.traitNames,
};

describe('condition evaluation', () => {
  it('evaluates turn, silver, goods, season conditions', () => {
    const s = testState();
    s.turn = 5;
    s.silver = 50;
    expect(evalCondition(s, { type: 'minTurn', value: 5 })).toBe(true);
    expect(evalCondition(s, { type: 'minTurn', value: 6 })).toBe(false);
    expect(evalCondition(s, { type: 'silverAtLeast', value: 50 })).toBe(true);
    expect(evalCondition(s, { type: 'silverBelow', value: 50 })).toBe(false);
    expect(evalCondition(s, { type: 'goodAtLeast', good: 'grain', qty: 30 })).toBe(true);
    expect(evalCondition(s, { type: 'season', value: 'spring' })).toBe(true);
    expect(evalCondition(s, { type: 'season', value: 'winter' })).toBe(false);
  });

  it('evaluates hero conditions against living heroes only', () => {
    const s = testState();
    expect(evalCondition(s, { type: 'heroInParty', heroId: 'p1' })).toBe(true);
    expect(evalCondition(s, { type: 'heroInParty', heroId: 'p12' })).toBe(false);
    s.heroes.find((h) => h.id === 'p1')!.status = 'dead';
    expect(evalCondition(s, { type: 'heroInParty', heroId: 'p1' })).toBe(false);
    expect(evalCondition(s, { type: 'heroWithTrait', trait: 'silver_tongued' })).toBe(true);
  });

  it('evaluates flags and standings', () => {
    const s = testState();
    expect(evalCondition(s, { type: 'notFlag', flag: 'x' })).toBe(true);
    s.flags.x = true;
    expect(evalCondition(s, { type: 'flag', flag: 'x' })).toBe(true);
    expect(
      evalCondition(s, { type: 'standingAtLeast', faction: 'CHARTER_COMPANY', value: 25 }),
    ).toBe(true);
  });
});

describe('event selection', () => {
  it('always selects at least one event', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = testState(seed);
      const selected = selectEvents(s, TEST_CONTENT.events, new Rng(seed));
      expect(selected.length).toBeGreaterThanOrEqual(1);
      expect(selected.length).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic for the same seed and state', () => {
    const a = selectEvents(testState(99), TEST_CONTENT.events, new Rng(99));
    const b = selectEvents(testState(99), TEST_CONTENT.events, new Rng(99));
    expect(a).toEqual(b);
  });

  it('respects once and cooldowns', () => {
    const s = testState();
    const drifter = TEST_CONTENT.events.get('post_drifter')!;
    expect(isEligible(s, drifter)).toBe(true);
    s.firedEvents.push('post_drifter');
    expect(isEligible(s, drifter)).toBe(false);

    const wolves = TEST_CONTENT.events.get('post_wolves')!;
    s.cooldowns.post_wolves = 5;
    s.turn = 4;
    expect(isEligible(s, wolves)).toBe(false);
    s.turn = 5;
    expect(isEligible(s, wolves)).toBe(true);
  });

  it('fires due queued chain events first, pinned to their hero', () => {
    const s = testState();
    s.queuedEvents.push({ eventId: 'hero_breakdown', fireOnTurn: 1, heroId: 'p3' });
    const selected = selectEvents(s, TEST_CONTENT.events, new Rng(1));
    expect(selected[0]).toEqual({ eventId: 'hero_breakdown', heroId: 'p3' });
  });

  it('does not fire queued events before their turn', () => {
    const s = testState();
    s.queuedEvents.push({ eventId: 'post_amber_find', fireOnTurn: 3 });
    const selected = selectEvents(s, TEST_CONTENT.events, new Rng(1));
    expect(selected.some((e) => e.eventId === 'post_amber_find')).toBe(false);
  });

  it('never selects weight-0 chain events from the random pool', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = testState(seed);
      const selected = selectEvents(s, TEST_CONTENT.events, new Rng(seed));
      expect(selected.some((e) => e.eventId === 'post_amber_find')).toBe(false);
      expect(selected.some((e) => e.eventId === 'hero_breakdown')).toBe(false);
    }
  });
});

describe('outcome application', () => {
  it('applies silver, goods, standing, axis, and trait deltas', () => {
    const s = testState();
    const log = applyOutcomes(
      s,
      [
        { type: 'silver', delta: -20 },
        { type: 'good', good: 'furs', delta: 4 },
        { type: 'standing', faction: 'RIVER_CLANS', delta: 5 },
        { type: 'axis', axis: 'integration', delta: 2 },
        { type: 'addTrait', trait: 'shaken' },
      ],
      { heroId: 'p1', ...NAME_CTX },
    );
    expect(s.silver).toBe(180);
    expect(s.goods.furs).toBe(4);
    expect(s.factions.RIVER_CLANS.standing).toBe(15);
    expect(s.axes.integration).toBe(2);
    expect(s.heroes.find((h) => h.id === 'p1')!.traits).toContain('shaken');
    expect(log.length).toBeGreaterThan(0);
  });

  it('kills a hero at 0 health, permanently', () => {
    const s = testState();
    const hero = s.heroes.find((h) => h.id === 'p1')!;
    hero.health = 2;
    const log = applyOutcomes(s, [{ type: 'health', delta: -3 }], { heroId: 'p1', ...NAME_CTX });
    expect(hero.health).toBe(0);
    expect(hero.status).toBe('dead');
    expect(log.join(' ')).toContain('died');
  });

  it('clamps axes to ±10 and standings to ±100', () => {
    const s = testState();
    applyOutcomes(s, [{ type: 'axis', axis: 'communal', delta: 99 }], { heroId: 'p1', ...NAME_CTX });
    applyOutcomes(s, [{ type: 'standing', faction: 'HILL_TRIBES', delta: -999 }], {
      heroId: 'p1',
      ...NAME_CTX,
    });
    expect(s.axes.communal).toBe(10);
    expect(s.factions.HILL_TRIBES.standing).toBe(-100);
  });

  it('queues chain events with sameHero pinning', () => {
    const s = testState();
    applyOutcomes(
      s,
      [{ type: 'queueEvent', eventId: 'post_amber_find', delayTurns: 2, sameHero: true }],
      { heroId: 'p3', ...NAME_CTX },
    );
    expect(s.queuedEvents).toEqual([
      { eventId: 'post_amber_find', fireOnTurn: 3, heroId: 'p3' },
    ]);
  });
});

describe('text interpolation', () => {
  it('replaces {hero} everywhere', () => {
    expect(interpolate('{hero} nods. {hero} leaves.', { heroName: 'Sela' })).toBe(
      'Sela nods. Sela leaves.',
    );
  });
});
