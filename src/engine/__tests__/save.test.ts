import { describe, expect, it } from 'vitest';
import { deserialize, migrate, serialize } from '../save';
import type { GameState } from '../types';
import { TEST_LOCATIONS, testState } from './helpers';

describe('saves', () => {
  it('round-trips the full game state through JSON', () => {
    const s = testState(2024);
    s.turn = 9;
    s.flags.odd_hired = true;
    s.queuedEvents.push({ eventId: 'post_amber_find', fireOnTurn: 11, heroId: 'p3' });
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('rejects garbage', () => {
    expect(() => deserialize('{"hello":"world"}')).toThrow();
    expect(() => deserialize('not json')).toThrow();
  });

  it('rejects saves from a newer game version', () => {
    const s = testState();
    s.saveVersion = 999;
    expect(() => migrate(s)).toThrow(/newer/);
  });

  it('has no migration gaps from unknown old versions', () => {
    const s = testState();
    s.saveVersion = 0;
    expect(() => migrate(s)).toThrow(/No migration path/);
  });

  it('migrates v1 saves all the way to current: map state added, everything else intact', () => {
    const v1 = testState(555) as Partial<GameState>;
    delete v1.locations;
    delete v1.expeditions;
    delete v1.nextExpeditionId;
    delete v1.charterMissedStreak;
    v1.saveVersion = 1;
    v1.silver = 123;

    const migrated = deserialize(JSON.stringify(v1), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(3);
    expect(migrated.silver).toBe(123);
    expect(migrated.expeditions).toEqual([]);
    expect(migrated.locations.river_meet.discovery).toBe('visited');
    expect(migrated.locations.river_meet.market).toBeDefined();
    expect(migrated.charterMissedStreak).toBe(0);
  });

  it('migrates v2 saves: Charter quota clock added, everything else intact', () => {
    const v2 = testState(556) as Partial<GameState>;
    delete v2.charterMissedStreak;
    v2.saveVersion = 2;
    v2.silver = 77;

    const migrated = deserialize(JSON.stringify(v2), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(3);
    expect(migrated.silver).toBe(77);
    expect(migrated.charterMissedStreak).toBe(0);
  });
});
