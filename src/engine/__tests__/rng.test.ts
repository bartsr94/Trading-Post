import { describe, expect, it } from 'vitest';
import { Rng, rngNext } from '../rng';

describe('seeded RNG', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('resumes exactly from a saved state', () => {
    const a = new Rng(7);
    a.next();
    a.next();
    const saved = a.getState();
    const resumed = new Rng(saved);
    expect(resumed.next()).toBe(a.next());
  });

  it('produces values in [0, 1)', () => {
    let state = 999;
    for (let i = 0; i < 1000; i++) {
      const step = rngNext(state);
      state = step.state;
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(1);
    }
  });

  it('d6 stays in 1..6 and hits every face', () => {
    const rng = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const roll = rng.d6();
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
      seen.add(roll);
    }
    expect(seen.size).toBe(6);
  });

  it('weightedPick never returns zero-weight items', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 100; i++) {
      expect(rng.weightedPick(['a', 'b', 'c'], [0, 1, 0])).toBe('b');
    }
  });
});
