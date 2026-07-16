import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { priceAt, priceOf } from '../economy';
import { dispatchError, dispatchExpedition } from '../expeditions';
import { selectEvents } from '../events/selection';
import { Rng } from '../rng';
import { resolveTurn } from '../turn';
import { heroesAtPost } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const DEFS = TEST_CONTENT.locationDefs;

function dispatchCaravan(s: GameState, overrides: Partial<Parameters<typeof dispatchExpedition>[1]> = {}) {
  return dispatchExpedition(
    s,
    {
      kind: 'caravan',
      destination: 'river_meet',
      heroIds: ['p1', 'p2'],
      cargo: { tools: 2, salt: 2 },
      ...overrides,
    },
    DEFS,
  );
}

/** Runs resolveTurn and clears pending events without resolving choices. */
function tick(s: GameState): void {
  resolveTurn(s, TEST_CONTENT);
  s.pendingEvents = [];
  s.phase = 'assignment';
  s.turn += 1;
}

describe('location state', () => {
  it('initializes discovery and markets from defs', () => {
    const s = testState();
    expect(s.locations.post.discovery).toBe('known');
    expect(s.locations.river_meet.discovery).toBe('visited');
    expect(s.locations.black_mere.discovery).toBe('unknown');
    expect(s.locations.river_meet.market).toBeDefined();
    expect(s.locations.old_road.market).toBeUndefined();
    expect(s.locations.post.market).toBeUndefined(); // the post uses GameState.market
  });

  it('applies location price bias', () => {
    const s = testState();
    const furs = TEST_CONTENT.goodDefs.get('furs')!;
    const hillFort = DEFS.get('hill_fort')!;
    // Same drift state at start, so the 0.6 bias must show through.
    expect(priceAt(s, furs, hillFort)).toBeLessThan(priceOf(s, furs));
  });
});

describe('dispatch validation', () => {
  it('rejects bad dispatches with a reason', () => {
    const s = testState();
    expect(dispatchError(s, { kind: 'caravan', destination: 'nowhere', heroIds: ['p1'] }, DEFS)).toBeTruthy();
    expect(dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: [] }, DEFS)).toBeTruthy();
    expect(
      dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1', 'p2', 'p3'] }, DEFS),
    ).toBeTruthy();
    // hill_fort starts rumored: no caravans until visited.
    expect(dispatchError(s, { kind: 'caravan', destination: 'hill_fort', heroIds: ['p1'] }, DEFS)).toBeTruthy();
    // explore to a known place is pointless; to an unknown place impossible.
    expect(dispatchError(s, { kind: 'explore', destination: 'black_mere', heroIds: ['p1'] }, DEFS)).toBeTruthy();
    // cargo beyond stock or capacity fails.
    expect(
      dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], cargo: { tools: 99 } }, DEFS),
    ).toBeTruthy();
    // valid dispatches pass.
    expect(dispatchError(s, { kind: 'explore', destination: 'hill_fort', heroIds: ['p1'] }, DEFS)).toBeNull();
    expect(dispatchError(s, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'] }, DEFS)).toBeNull();
  });

  it('rejects double-booking a hero', () => {
    const s = testState();
    expect(dispatchCaravan(s)).toBe(true);
    expect(dispatchError(s, { kind: 'explore', destination: 'old_road', heroIds: ['p1'] }, DEFS)).toBeTruthy();
  });

  it('moves cargo and silver out of the post stock on dispatch', () => {
    const s = testState();
    const toolsBefore = s.goods.tools;
    const silverBefore = s.silver;
    expect(dispatchCaravan(s, { silver: 50 })).toBe(true);
    expect(s.goods.tools).toBe(toolsBefore - 2);
    expect(s.silver).toBe(silverBefore - 50);
    expect(s.expeditions).toHaveLength(1);
    expect(heroesAtPost(s).map((h) => h.id)).not.toContain('p1');
  });
});

describe('expedition lifecycle', () => {
  it('caravan sells at the destination and brings silver home', () => {
    const s = testState(777);
    const silverAfterDispatch = () => s.silver;
    dispatchCaravan(s, { cargo: { tools: 4 } });
    const before = silverAfterDispatch();

    // river_meet is 2 turns out: outbound 2, arrival on 2nd, return 2.
    tick(s); // 1 turn out
    expect(s.expeditions[0].leg).toBe('outbound');
    tick(s); // arrival: cargo sold
    expect(s.expeditions[0].leg).toBe('returning');
    expect(s.expeditions[0].silver).toBeGreaterThan(0);
    tick(s);
    tick(s); // homecoming
    expect(s.expeditions).toHaveLength(0);
    expect(s.silver).toBeGreaterThan(before);
    expect(heroesAtPost(s).map((h) => h.id)).toContain('p1');
  });

  it('explore pushes discovery forward and spreads rumors', () => {
    // Across seeds, at least one run should succeed on the check and reveal
    // hill_fort's neighbours (high_pass starts unknown).
    let advanced = 0;
    let rumored = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = testState(seed);
      dispatchExpedition(s, { kind: 'explore', destination: 'hill_fort', heroIds: ['p1', 'p4'] }, DEFS);
      for (let i = 0; i < 8 && s.expeditions.length > 0; i++) tick(s);
      if (s.locations.hill_fort.discovery !== 'rumored') advanced++;
      if (s.locations.high_pass.discovery === 'rumored') rumored++;
    }
    expect(advanced).toBeGreaterThan(0);
    expect(rumored).toBeGreaterThan(0);
  });

  it('loses the expedition when the whole party dies en route', () => {
    const s = testState();
    dispatchCaravan(s, { heroIds: ['p1'], cargo: { tools: 3 } });
    const toolsAfterDispatch = s.goods.tools;
    s.heroes.find((h) => h.id === 'p1')!.status = 'dead';
    tick(s);
    expect(s.expeditions).toHaveLength(0);
    expect(s.goods.tools).toBe(toolsAfterDispatch); // cargo lost, not returned
  });
});

describe('travel events', () => {
  it('only binds heroes from the travelling party', () => {
    let travelSeen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = testState(seed);
      expect(dispatchCaravan(s, { cargo: { tools: 3, salt: 3 } })).toBe(true);
      const selected = selectEvents(s, TEST_CONTENT.events, DEFS, new Rng(seed));
      for (const active of selected) {
        const event = TEST_CONTENT.events.get(active.eventId)!;
        if (event.category === 'travel') {
          travelSeen++;
          expect(active.expeditionId).toBe(s.expeditions[0].id);
          expect(['p1', 'p2']).toContain(active.heroId);
        } else {
          expect(['p1', 'p2']).not.toContain(active.heroId);
        }
      }
    }
    expect(travelSeen).toBeGreaterThan(0);
  });

  it('never fires travel events with no expedition out', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = testState(seed);
      const selected = selectEvents(s, TEST_CONTENT.events, DEFS, new Rng(seed));
      for (const active of selected) {
        expect(TEST_CONTENT.events.get(active.eventId)!.category).not.toBe('travel');
      }
    }
  });
});

describe('tuning sanity', () => {
  it('home location id exists in content', () => {
    expect(DEFS.has(TUNING.map.homeLocationId)).toBe(true);
  });

  it('all connections are symmetric and known', () => {
    for (const def of DEFS.values()) {
      for (const other of def.connections) {
        const target = DEFS.get(other);
        expect(target, `${def.id} connects to unknown ${other}`).toBeDefined();
        expect(target!.connections, `${other} should connect back to ${def.id}`).toContain(def.id);
      }
    }
  });
});
