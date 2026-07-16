import { describe, expect, it } from 'vitest';
import { deserialize, migrate, serialize } from '../save';
import { testState } from './helpers';

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
});
