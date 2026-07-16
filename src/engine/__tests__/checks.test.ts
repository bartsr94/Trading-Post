import { describe, expect, it } from 'vitest';
import { TRAIT_DEFS } from '../../content/traits';
import { checkBreakdown, resolveCheck, traitModifiers } from '../checks';
import { Rng } from '../rng';
import type { Hero } from '../types';

function hero(overrides: Partial<Hero> = {}): Hero {
  return {
    id: 'test',
    name: 'Testa',
    epithet: 'the Tested',
    bio: '',
    stats: { might: 2, agility: 2, wits: 3, charm: 2, resolve: 2 },
    skills: {
      bargain: 3,
      diplomacy: 0,
      combat: 1,
      survival: 0,
      leadership: 0,
      lore: 0,
      craft: 0,
      stealth: 0,
    },
    skillMarks: [],
    traits: [],
    health: 10,
    stress: 0,
    status: 'active',
    history: [],
    ...overrides,
  };
}

/** Finds an RNG seed whose next two d6 rolls sum to `target`. */
function seedForNatural(target: number): number {
  for (let seed = 1; seed < 100000; seed++) {
    const rng = new Rng(seed);
    if (rng.d6() + rng.d6() === target) return seed;
  }
  throw new Error(`no seed found for natural ${target}`);
}

describe('check resolution', () => {
  it('computes total = 2d6 + skill + stat + mods and margin vs difficulty', () => {
    const rng = new Rng(1);
    const r = resolveCheck(rng, hero(), 'bargain', 'charm', 10, [{ label: 'Test', value: 1 }]);
    expect(r.total).toBe(r.d1 + r.d2 + 3 + 2 + 1);
    expect(r.margin).toBe(r.total - 10);
  });

  it('maps margins to the four tiers', () => {
    // Fixed natural 7 (find a seed), then vary difficulty to hit each band.
    const seed = seedForNatural(7);
    const h = hero(); // 7 + 3 + 2 = 12 total
    expect(resolveCheck(new Rng(seed), h, 'bargain', 'charm', 7).tier).toBe('critSuccess'); // +5
    expect(resolveCheck(new Rng(seed), h, 'bargain', 'charm', 12).tier).toBe('success'); // 0
    expect(resolveCheck(new Rng(seed), h, 'bargain', 'charm', 13).tier).toBe('failure'); // −1
    expect(resolveCheck(new Rng(seed), h, 'bargain', 'charm', 17).tier).toBe('critFailure'); // −5
  });

  it('natural 2 is never better than a failure', () => {
    const seed = seedForNatural(2);
    // 2 + 3 + 2 = 7 vs difficulty 2 would be margin +5 (crit success) — downgraded.
    const r = resolveCheck(new Rng(seed), hero(), 'bargain', 'charm', 2);
    expect(r.natural).toBe(2);
    expect(r.tier).toBe('failure');
  });

  it('natural 12 is never worse than a success', () => {
    const seed = seedForNatural(12);
    // 12 + 3 + 2 = 17 vs difficulty 30 would be crit failure — upgraded.
    const r = resolveCheck(new Rng(seed), hero(), 'bargain', 'charm', 30);
    expect(r.natural).toBe(12);
    expect(r.tier).toBe('success');
  });

  it('trait modifiers match by skill and by tag', () => {
    const h = hero({ traits: ['silver_tongued', 'scarred'] });
    const bySkill = traitModifiers(h, TRAIT_DEFS, 'bargain', []);
    expect(bySkill).toEqual([{ label: 'Silver-Tongued', value: 1 }]);

    const byTag = traitModifiers(h, TRAIT_DEFS, 'combat', ['intimidation']);
    expect(byTag).toEqual([{ label: 'Scarred', value: 1 }]);

    const both = traitModifiers(h, TRAIT_DEFS, 'bargain', ['strangers']);
    expect(both).toHaveLength(2);
  });

  it('renders a readable breakdown line', () => {
    const rng = new Rng(1);
    const r = resolveCheck(rng, hero(), 'bargain', 'charm', 11);
    const line = checkBreakdown(r);
    expect(line).toContain(`${r.d1}+${r.d2}`);
    expect(line).toContain('+Bargain 3');
    expect(line).toContain('+Charm 2');
    expect(line).toContain('vs 11');
  });
});
