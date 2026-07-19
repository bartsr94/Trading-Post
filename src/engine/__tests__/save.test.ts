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

  it('migrates v1 saves all the way to current: map + residents + roster added, everything else intact', () => {
    const v1 = testState(555) as Partial<GameState>;
    delete v1.locations;
    delete v1.expeditions;
    delete v1.nextExpeditionId;
    delete v1.charterMissedStreak;
    delete v1.residents;
    delete v1.transients;
    delete v1.nextTransientId;
    delete v1.activePartyIds;
    delete v1.dependants;
    delete v1.nextDependantId;
    delete v1.buildings;
    delete v1.construction;
    v1.saveVersion = 1;
    v1.silver = 123;

    const migrated = deserialize(JSON.stringify(v1), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(6);
    expect(migrated.silver).toBe(123);
    expect(migrated.expeditions).toEqual([]);
    expect(migrated.locations.river_meet.discovery).toBe('visited');
    expect(migrated.locations.river_meet.market).toBeDefined();
    expect(migrated.charterMissedStreak).toBe(0);
    expect(migrated.residents.roles.farmers).toBe(0);
    expect(migrated.transients).toEqual([]);
    // Every living hero becomes the active party.
    expect(migrated.activePartyIds).toEqual(migrated.heroes.map((h) => h.id));
    expect(migrated.dependants).toEqual([]);
    expect(migrated.buildings).toEqual([]);
    expect(migrated.construction).toBeNull();
  });

  it('migrates v2 saves: Charter quota clock + residents added, everything else intact', () => {
    const v2 = testState(556) as Partial<GameState>;
    delete v2.charterMissedStreak;
    delete v2.residents;
    delete v2.transients;
    delete v2.nextTransientId;
    delete v2.activePartyIds;
    delete v2.dependants;
    delete v2.nextDependantId;
    delete v2.buildings;
    delete v2.construction;
    v2.saveVersion = 2;
    v2.silver = 77;

    const migrated = deserialize(JSON.stringify(v2), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(6);
    expect(migrated.silver).toBe(77);
    expect(migrated.charterMissedStreak).toBe(0);
    expect(migrated.residents.contentment).toBeGreaterThan(0);
  });

  it('migrates v3 saves: resident population added, everything else intact', () => {
    const v3 = testState(557) as Partial<GameState>;
    delete v3.residents;
    delete v3.transients;
    delete v3.nextTransientId;
    delete v3.activePartyIds;
    delete v3.dependants;
    delete v3.nextDependantId;
    delete v3.buildings;
    delete v3.construction;
    v3.saveVersion = 3;
    v3.silver = 88;

    const migrated = deserialize(JSON.stringify(v3), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(6);
    expect(migrated.silver).toBe(88);
    expect(migrated.residents.idle).toBe(0);
    expect(migrated.nextTransientId).toBe(1);
  });

  it('migrates v4 saves: active-party roster + dependant layer added, everything else intact', () => {
    const v4 = testState(558) as Partial<GameState>;
    delete v4.activePartyIds;
    delete v4.dependants;
    delete v4.nextDependantId;
    delete v4.buildings;
    delete v4.construction;
    v4.saveVersion = 4;
    v4.silver = 99;

    const migrated = deserialize(JSON.stringify(v4), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(6);
    expect(migrated.silver).toBe(99);
    expect(migrated.activePartyIds).toEqual(migrated.heroes.map((h) => h.id));
    expect(migrated.dependants).toEqual([]);
    expect(migrated.nextDependantId).toBe(1);
  });

  it('migrates v5 saves: buildings + construction slot added, everything else intact', () => {
    const v5 = testState(559) as Partial<GameState>;
    delete v5.buildings;
    delete v5.construction;
    v5.saveVersion = 5;
    v5.silver = 111;

    const migrated = deserialize(JSON.stringify(v5), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(6);
    expect(migrated.silver).toBe(111);
    expect(migrated.buildings).toEqual([]);
    expect(migrated.construction).toBeNull();
    expect(migrated.postTier).toBe(1);
  });
});
