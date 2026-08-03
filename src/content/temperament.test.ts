import { describe, expect, it } from 'vitest';
import { pickDependantTemperament } from './temperament';

describe('pickDependantTemperament', () => {
  it('is deterministic for a given seed', () => {
    expect(pickDependantTemperament('d7')).toEqual(pickDependantTemperament('d7'));
  });

  it('always returns exactly two tags', () => {
    for (const seed of ['d1', 'd2', 'd3', 'd42', 'p1-spouse']) {
      expect(pickDependantTemperament(seed)).toHaveLength(2);
    }
  });

  it('varies across different seeds', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `d${i}`);
    const picks = new Set(seeds.map((s) => pickDependantTemperament(s).join('/')));
    expect(picks.size).toBeGreaterThan(1);
  });
});
