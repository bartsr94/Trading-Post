// Named-character roster (CHARACTERS_SPEC.md Phase A): active party ↔ reserve
// bench, swap validation, reserve upkeep (grain + retainer wages), dependant
// food, and the broken-company semantics.

import { describe, expect, it } from 'vitest';
import { createHero, HERO_POOL } from '../../content/heroes';
import {
  activateError,
  activateHero,
  benchError,
  benchHero,
  dependantCount,
  reconcileRoster,
} from '../roster';
import { freshResidents } from '../residents';
import { resolveTurn, advanceTurn } from '../turn';
import { activeHeroes, heroesAtPost, livingHeroes, reserveHeroes } from '../types';
import type { GameState, Hero } from '../types';
import { TEST_CONTENT, testState } from './helpers';

/** Add a living hero to the roster on the reserve bench (not in active party). */
function addReserve(s: GameState, templateId: string): Hero {
  const hero = createHero(HERO_POOL.find((t) => t.id === templateId)!);
  s.heroes.push(hero);
  return hero;
}

describe('roster selectors', () => {
  it('splits living heroes into active party and reserve by activePartyIds', () => {
    const s = testState(); // 6 heroes, all active
    expect(activeHeroes(s)).toHaveLength(6);
    expect(reserveHeroes(s)).toHaveLength(0);

    benchHero(s, 'p6');
    expect(activeHeroes(s).map((h) => h.id)).not.toContain('p6');
    expect(reserveHeroes(s).map((h) => h.id)).toEqual(['p6']);
    // Still alive — reserve is a party axis, not a life state.
    expect(livingHeroes(s)).toHaveLength(6);
  });

  it('heroesAtPost is the active party minus those away — never the reserve', () => {
    const s = testState();
    benchHero(s, 'p6');
    expect(heroesAtPost(s).map((h) => h.id)).not.toContain('p6');
    expect(heroesAtPost(s)).toHaveLength(5);
  });

  it('activeHeroes preserves activePartyIds order and drops dead ids', () => {
    const s = testState();
    s.heroes.find((h) => h.id === 'p2')!.status = 'dead';
    expect(activeHeroes(s).map((h) => h.id)).not.toContain('p2');
  });
});

describe('activate / bench', () => {
  it('benches an active hero, clearing their assignment', () => {
    const s = testState();
    s.assignments['p6'] = 'trade';
    expect(benchHero(s, 'p6')).toBe(true);
    expect(s.activePartyIds).not.toContain('p6');
    expect(s.assignments['p6']).toBeUndefined();
  });

  it('refuses to bench a hero who is away on an expedition', () => {
    const s = testState();
    s.expeditions.push({
      id: 'exp_1',
      kind: 'caravan',
      destination: 'river_meet',
      heroIds: ['p1'],
      leg: 'outbound',
      turnsLeft: 1,
      cargo: {},
      silver: 0,
      buyOrders: {},
    });
    expect(benchError(s, 'p1')).toBe('They are away — recall them first.');
    expect(benchHero(s, 'p1')).toBe(false);
  });

  it('enforces the active-party cap when activating a reserve character', () => {
    const s = testState(); // 6 active = cap
    addReserve(s, 'p7');
    expect(activateError(s, 'p7')).toBe('The party is full — bench someone first.');
    expect(activateHero(s, 'p7')).toBe(false);

    benchHero(s, 'p1'); // frees a slot
    expect(activateError(s, 'p7')).toBeNull();
    expect(activateHero(s, 'p7')).toBe(true);
    expect(activeHeroes(s).map((h) => h.id)).toContain('p7');
    expect(activeHeroes(s)).toHaveLength(6);
  });

  it('rejects activating a dead or already-active hero', () => {
    const s = testState();
    expect(activateError(s, 'p1')).toBe('Already in the active party.');
    const ghost = addReserve(s, 'p7');
    ghost.status = 'dead';
    expect(activateError(s, 'p7')).toBe('They are not here to call up.');
  });

  it('reconcileRoster drops dead/departed heroes from the active party', () => {
    const s = testState();
    s.heroes.find((h) => h.id === 'p3')!.status = 'dead';
    reconcileRoster(s);
    expect(s.activePartyIds).not.toContain('p3');
    expect(s.activePartyIds).toHaveLength(5);
  });
});

describe('reserve upkeep and dependant food in the turn pipeline', () => {
  it('reserve characters still eat grain (benching does not change the mouth count)', () => {
    const s = testState(1);
    s.residents = freshResidents();
    benchHero(s, 'p6'); // 5 active + 1 reserve, still 6 living mouths
    resolveTurn(s, TEST_CONTENT);
    const eatLine = s.report.lines.find((l) => l.text.includes('eats'));
    expect(eatLine?.text).toContain('6 food');
  });

  it('dependants add to the grain the post eats', () => {
    const s = testState(1);
    s.residents = freshResidents();
    s.dependants.push({ id: 'd1', name: 'Anele', kind: 'spouse', parentId: 'p1', gender: 'female' });
    expect(dependantCount(s)).toBe(1);
    resolveTurn(s, TEST_CONTENT);
    const eatLine = s.report.lines.find((l) => l.text.includes('eats'));
    // 6 heroes + 1 dependant = 7 grain.
    expect(eatLine?.text).toContain('7 food');
  });

  it('reserve characters draw a retainer at season end; active heroes do not', () => {
    const s = testState(2);
    s.residents = freshResidents();
    s.turn = 6; // season end
    s.silver = 1000;
    benchHero(s, 'p6'); // 1 reserve → 8 silver retainer, no residents
    resolveTurn(s, TEST_CONTENT);
    const wageLine = s.report.lines.find((l) => l.text.includes('wages'));
    expect(wageLine?.text).toContain('8 silver');
  });
});

describe('broken company vs an empty active party', () => {
  it('an empty active party with living reserve is NOT game over', () => {
    const s = testState();
    for (const id of [...s.activePartyIds]) benchHero(s, id);
    expect(activeHeroes(s)).toHaveLength(0);
    expect(heroesAtPost(s)).toHaveLength(0);
    expect(livingHeroes(s)).toHaveLength(6);

    s.phase = 'report';
    advanceTurn(s);
    expect(s.gameOver).toBeNull();
  });

  it('is game over only when no named character is left alive', () => {
    const s = testState();
    for (const h of s.heroes) h.status = 'dead';
    s.phase = 'report';
    advanceTurn(s);
    expect(s.gameOver?.kind).toBe('brokenCompany');
  });
});
