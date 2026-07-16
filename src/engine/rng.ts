// Seeded PRNG (mulberry32). The numeric state lives in GameState so runs are
// reproducible and every save captures the exact stream position.

export interface RngStep {
  value: number; // float in [0, 1)
  state: number;
}

export function rngNext(state: number): RngStep {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: s };
}

/**
 * Mutable wrapper used inside a single action; read the state out with
 * `getState()` and store it back on GameState when done.
 */
export class Rng {
  private s: number;

  constructor(state: number) {
    this.s = state | 0;
  }

  getState(): number {
    return this.s;
  }

  next(): number {
    const step = rngNext(this.s);
    this.s = step.state;
    return step.value;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  d6(): number {
    return this.int(1, 6);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() from empty array');
    return items[this.int(0, items.length - 1)];
  }

  /** Weighted pick; weights must be non-negative and not all zero. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new Error('weightedPick() with no positive weights');
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  }
}
