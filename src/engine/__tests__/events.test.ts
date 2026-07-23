import { describe, expect, it } from 'vitest';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import { isEligible, selectEvents } from '../events/selection';
import { interpolate } from '../events/text';
import type { GameEvent } from '../events/types';
import { formUnion } from '../family';
import { Rng } from '../rng';
import { resolveChoice, resolveTurn } from '../turn';
import { TEST_CONTENT, testState } from './helpers';

const NAME_CTX = {
  goodNames: TEST_CONTENT.goodNames,
  factionNames: TEST_CONTENT.factionNames,
  traitNames: TEST_CONTENT.traitNames,
  locationNames: TEST_CONTENT.locationNames,
  locationDefs: TEST_CONTENT.locationDefs,
  buildingNames: TEST_CONTENT.buildingNames,
  recruitDefs: TEST_CONTENT.recruitDefs,
  dependantName: TEST_CONTENT.dependantName,
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
      const selected = selectEvents(s, TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(seed));
      expect(selected.length).toBeGreaterThanOrEqual(1);
      expect(selected.length).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic for the same seed and state', () => {
    const a = selectEvents(testState(99), TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(99));
    const b = selectEvents(testState(99), TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(99));
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
    const selected = selectEvents(s, TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(1));
    expect(selected[0]).toEqual({ eventId: 'hero_breakdown', heroId: 'p3' });
  });

  it('carries a due queued event\'s chain vars across the turn boundary', () => {
    const s = testState();
    s.queuedEvents.push({
      eventId: 'hero_breakdown',
      fireOnTurn: 1,
      heroId: 'p3',
      vars: { approach: 'force' },
    });
    const selected = selectEvents(s, TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(1));
    expect(selected[0]).toEqual({ eventId: 'hero_breakdown', heroId: 'p3', vars: { approach: 'force' } });
  });

  it('does not fire queued events before their turn', () => {
    const s = testState();
    s.queuedEvents.push({ eventId: 'post_amber_find', fireOnTurn: 3 });
    const selected = selectEvents(s, TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(1));
    expect(selected.some((e) => e.eventId === 'post_amber_find')).toBe(false);
  });

  it('never selects weight-0 chain events from the random pool', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = testState(seed);
      const selected = selectEvents(s, TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(seed));
      expect(selected.some((e) => e.eventId === 'post_amber_find')).toBe(false);
      expect(selected.some((e) => e.eventId === 'hero_breakdown')).toBe(false);
    }
  });

  it('binds hero-scoped conditions to the selected event hero', () => {
    const s = testState();
    const married = s.heroes.find((h) => h.id === 'p1')!;
    const unmarried = s.heroes.find((h) => h.id === 'p2')!;
    for (const hero of s.heroes) hero.stats.charm = 0;
    married.stats.charm = 5;
    unmarried.stats.charm = 4;
    expect(
      formUnion(s, married.id, {
        source: 'homeland',
        heritage: 'imanian',
        name: 'Ada',
      }),
    ).not.toBeNull();

    const event: GameEvent = {
      id: 'test_unmarried_binding',
      category: 'post',
      illustration: 'test',
      title: 'Test',
      text: '{hero}',
      conditions: [{ type: 'heroUnmarried' }],
      weight: 1,
      binding: { type: 'highestStat', stat: 'charm' },
      choices: [{ label: 'Continue', outcomes: { success: { text: 'Done', outcomes: [] } } }],
    };

    const selected = selectEvents(
      s,
      new Map([[event.id, event]]),
      TEST_CONTENT.locationDefs,
      new Rng(1),
    );
    expect(selected).toEqual([{ eventId: event.id, heroId: unmarried.id }]);
  });

  it('leaves over-budget same-id queued events for a later turn', () => {
    const s = testState();
    s.queuedEvents = ['p1', 'p2', 'p3'].map((heroId) => ({
      eventId: 'hero_breakdown',
      fireOnTurn: s.turn,
      heroId,
    }));

    resolveTurn(s, TEST_CONTENT);

    expect(s.pendingEvents.map((event) => event.heroId)).toEqual(['p1', 'p2']);
    expect(s.queuedEvents).toEqual([
      { eventId: 'hero_breakdown', fireOnTurn: 1, heroId: 'p3' },
    ]);
  });

  it('removes impossible dead-hero queues but keeps active reserve queues', () => {
    const s = testState();
    s.heroes.find((hero) => hero.id === 'p1')!.status = 'dead';
    s.activePartyIds = s.activePartyIds.filter((id) => id !== 'p2');
    s.queuedEvents = [
      { eventId: 'hero_breakdown', fireOnTurn: 1, heroId: 'p1' },
      { eventId: 'hero_breakdown', fireOnTurn: 1, heroId: 'p2' },
    ];

    resolveTurn(s, TEST_CONTENT);

    expect(s.queuedEvents).toEqual([
      { eventId: 'hero_breakdown', fireOnTurn: 1, heroId: 'p2' },
    ]);
  });

  it('rejects a directly invoked locked choice without mutating state', () => {
    const s = testState();
    const event: GameEvent = {
      id: 'test_locked_choice',
      category: 'post',
      illustration: 'test',
      title: 'Test',
      text: 'Test',
      conditions: [],
      weight: 1,
      choices: [
        {
          label: 'Spend what is not there',
          requires: [{ type: 'silverAtLeast', value: s.silver + 1 }],
          outcomes: {
            success: { text: 'Impossible', outcomes: [{ type: 'silver', delta: 100 }] },
          },
        },
      ],
    };
    const before = structuredClone(s);

    expect(() => resolveChoice(s, TEST_CONTENT, event, 0, 'p1')).toThrow(/not available/);
    expect(s).toEqual(before);
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

  it('queueEvent carries the current pending event vars forward', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'post_drifter', heroId: 'p3', vars: { approach: 'force' } }];
    applyOutcomes(
      s,
      [{ type: 'queueEvent', eventId: 'post_amber_find', delayTurns: 2, sameHero: true }],
      { heroId: 'p3', ...NAME_CTX },
    );
    expect(s.queuedEvents).toEqual([
      { eventId: 'post_amber_find', fireOnTurn: 3, heroId: 'p3', vars: { approach: 'force' } },
    ]);
  });

  it('defaults community outcomes to ctx.locationId when no location is given', () => {
    const s = testState();
    const before = s.diplomacySeats.hill_fort.standing;
    applyOutcomes(s, [{ type: 'communityStanding', delta: 5 }], {
      heroId: 'p1',
      locationId: 'hill_fort',
      ...NAME_CTX,
    });
    expect(s.diplomacySeats.hill_fort.standing).toBe(before + 5);
    applyOutcomes(s, [{ type: 'communityGrievance', delta: 2 }], {
      heroId: 'p1',
      locationId: 'hill_fort',
      ...NAME_CTX,
    });
    expect(s.diplomacySeats.hill_fort.grievances).toBe(2);
  });

  it('leaves community outcomes inert when no location can be resolved', () => {
    const s = testState();
    const before = { ...s.diplomacySeats.hill_fort };
    applyOutcomes(s, [{ type: 'communityStanding', delta: 5 }], { heroId: 'p1', ...NAME_CTX });
    expect(s.diplomacySeats.hill_fort).toEqual(before);
  });
});

describe('chain events (CHAIN_EVENTS_SPEC.md)', () => {
  it('setChainVar merges onto the current pending event', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'post_drifter', heroId: 'p1' }];
    applyOutcomes(s, [{ type: 'setChainVar', key: 'approach', value: 'peace' }], {
      heroId: 'p1',
      ...NAME_CTX,
    });
    expect(s.pendingEvents[0].vars).toEqual({ approach: 'peace' });

    applyOutcomes(s, [{ type: 'setChainVar', key: 'outcome', value: 3 }], {
      heroId: 'p1',
      ...NAME_CTX,
    });
    expect(s.pendingEvents[0].vars).toEqual({ approach: 'peace', outcome: 3 });
  });

  it('setChainVar no-ops safely when there is no pending event', () => {
    const s = testState();
    expect(() =>
      applyOutcomes(s, [{ type: 'setChainVar', key: 'x', value: true }], { heroId: 'p1', ...NAME_CTX }),
    ).not.toThrow();
    expect(s.pendingEvents).toEqual([]);
  });

  it('continueChain splices the next event right after the current one, copying vars', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'post_drifter', heroId: 'p1', vars: { approach: 'peace' } }];
    applyOutcomes(s, [{ type: 'continueChain', eventId: 'post_wolves' }], { heroId: 'p1', ...NAME_CTX });
    expect(s.pendingEvents).toEqual([
      { eventId: 'post_drifter', heroId: 'p1', vars: { approach: 'peace' } },
      { eventId: 'post_wolves', heroId: 'p1', vars: { approach: 'peace' } },
    ]);
  });

  it('continueChain pushes onto an empty pendingEvents array', () => {
    const s = testState();
    applyOutcomes(s, [{ type: 'continueChain', eventId: 'post_wolves' }], { heroId: 'p1', ...NAME_CTX });
    expect(s.pendingEvents).toEqual([{ eventId: 'post_wolves', heroId: 'p1' }]);
  });

  it('continueChain respects an explicit heroId override', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'post_drifter', heroId: 'p1' }];
    applyOutcomes(s, [{ type: 'continueChain', eventId: 'post_wolves', heroId: 'p2' }], {
      heroId: 'p1',
      ...NAME_CTX,
    });
    expect(s.pendingEvents[1].heroId).toBe('p2');
  });

  it('evaluates the chainVar condition against ConditionContext.chainVars', () => {
    const s = testState();
    expect(
      evalCondition(s, { type: 'chainVar', key: 'approach', value: 'peace' }, { chainVars: { approach: 'peace' } }),
    ).toBe(true);
    expect(
      evalCondition(s, { type: 'chainVar', key: 'approach', value: 'force' }, { chainVars: { approach: 'peace' } }),
    ).toBe(false);
    expect(evalCondition(s, { type: 'chainVar', key: 'approach', value: 'peace' })).toBe(false);
  });

  it('resolveChoice gates a chainVar-locked choice using the current pending event', () => {
    const s = testState();
    const event: GameEvent = {
      id: 'test_chain_gate',
      category: 'chain',
      illustration: 'test',
      title: 'Test',
      text: 'Test',
      conditions: [],
      weight: 0,
      choices: [
        {
          label: 'Peace path',
          requires: [{ type: 'chainVar', key: 'approach', value: 'peace' }],
          outcomes: { success: { text: 'Done', outcomes: [] } },
        },
      ],
    };

    s.pendingEvents = [{ eventId: event.id, heroId: 'p1', vars: { approach: 'force' } }];
    expect(() => resolveChoice(s, TEST_CONTENT, event, 0, 'p1')).toThrow(/not available/);

    s.pendingEvents = [{ eventId: event.id, heroId: 'p1', vars: { approach: 'peace' } }];
    expect(() => resolveChoice(s, TEST_CONTENT, event, 0, 'p1')).not.toThrow();
  });
});

describe('text interpolation', () => {
  it('replaces {hero} everywhere', () => {
    expect(interpolate('{hero} nods. {hero} leaves.', { heroName: 'Sela' })).toBe(
      'Sela nods. Sela leaves.',
    );
  });

  it('replaces {faction}, falling back when absent', () => {
    expect(interpolate('the {faction} watch', { heroName: 'Sela', factionName: 'River Clans' })).toBe(
      'the River Clans watch',
    );
    expect(interpolate('the {faction} watch', { heroName: 'Sela' })).toBe('the this people watch');
  });
});
