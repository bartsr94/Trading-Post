import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { advancePendingEvent, advanceTurn, resolveChoice, resolveTurn } from '../turn';
import { freshResidents } from '../residents';
import { isSeasonEnd, livingHeroes, seasonOfTurn, yearOfTurn } from '../types';
import { TEST_CONTENT, testState } from './helpers';

describe('turn cadence (TUNING.time)', () => {
  it('turnsPerSeason/turnsPerYear are 3/12', () => {
    expect(TUNING.time.turnsPerSeason).toBe(3);
    expect(TUNING.time.turnsPerYear).toBe(12);
  });

  it('walks spring/summer/autumn/winter in 3-turn blocks across a year', () => {
    const expected = [
      'spring', 'spring', 'spring',
      'summer', 'summer', 'summer',
      'autumn', 'autumn', 'autumn',
      'winter', 'winter', 'winter',
    ];
    for (let turn = 1; turn <= 12; turn++) {
      expect(seasonOfTurn(turn)).toBe(expected[turn - 1]);
    }
  });

  it('rolls over into year 2 at turn 13, repeating the season cycle', () => {
    expect(yearOfTurn(12)).toBe(1);
    expect(yearOfTurn(13)).toBe(2);
    expect(seasonOfTurn(13)).toBe('spring');
    expect(seasonOfTurn(24)).toBe('winter');
    expect(yearOfTurn(24)).toBe(2);
    expect(yearOfTurn(25)).toBe(3);
  });

  it('isSeasonEnd is true only on the 3rd turn of each season', () => {
    expect(isSeasonEnd(1)).toBe(false);
    expect(isSeasonEnd(2)).toBe(false);
    expect(isSeasonEnd(3)).toBe(true);
    expect(isSeasonEnd(4)).toBe(false);
    expect(isSeasonEnd(6)).toBe(true);
    expect(isSeasonEnd(12)).toBe(true);
  });
});

describe('turn resolution pipeline', () => {
  it('consumes grain for the party and pays post upkeep', () => {
    const s = testState();
    s.residents = freshResidents(); // isolate hero food from the founding hands
    for (const h of s.heroes) s.assignments[h.id] = 'rest';
    resolveTurn(s, TEST_CONTENT);
    // 6 heroes × 1 grain, minus whatever events did (rest turns touch no goods pre-event).
    expect(s.report.lines.some((l) => l.text.includes('eats 6 food'))).toBe(true);
    expect(s.bankruptcyClock).toBe(0);
    expect(s.phase).toBe('event');
    expect(s.pendingEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('missed upkeep stresses heroes and advances the bankruptcy clock', () => {
    const s = testState();
    s.silver = 0;
    s.goods.grain = 0;
    resolveTurn(s, TEST_CONTENT);
    expect(s.bankruptcyClock).toBe(1);
    for (const h of livingHeroes(s)) {
      expect(h.stress).toBeGreaterThanOrEqual(TUNING.economy.missedUpkeepStress);
    }
  });

  it('bankruptcyTurns missed upkeeps end the game in bankruptcy', () => {
    const s = testState();
    s.silver = 0;
    s.goods.grain = 0;
    s.bankruptcyClock = TUNING.economy.bankruptcyTurns;
    resolveTurn(s, TEST_CONTENT);
    expect(s.gameOver?.kind).toBe('bankrupt');
    expect(s.phase).toBe('gameover');
  });

  it('trade brings silver in; provision brings food in; rest recovers', () => {
    const s = testState();
    s.residents = freshResidents();
    const [trader, hunter, rester] = livingHeroes(s);
    rester.stress = 6;
    rester.health = 5;
    s.assignments[trader.id] = 'trade';
    s.assignments[hunter.id] = 'provision';
    s.assignments[rester.id] = 'rest';
    const grainBefore = s.goods.grain;
    resolveTurn(s, TEST_CONTENT);
    const tradeLine = s.report.lines.find((l) => l.text.includes('runs the market'));
    const huntLine = s.report.lines.find((l) => l.text.includes('hunts and forages'));
    expect(tradeLine).toBeDefined();
    expect(huntLine).toBeDefined();
    // Consumption is 6, provision yields at least 1.
    expect(s.goods.grain).toBeGreaterThanOrEqual(grainBefore - 6);
    expect(rester.stress).toBeLessThan(6);
    expect(rester.health).toBeGreaterThan(5);
  });

  it('a hero at breaking-point stress gets the breakdown event immediately', () => {
    const s = testState();
    const hero = livingHeroes(s)[0];
    hero.stress = 10;
    resolveTurn(s, TEST_CONTENT);
    expect(s.pendingEvents[0]).toEqual({ eventId: 'hero_breakdown', heroId: hero.id });
  });

  it('is fully deterministic for the same seed', () => {
    const run = () => {
      const s = testState(777);
      for (const h of s.heroes) s.assignments[h.id] = 'trade';
      resolveTurn(s, TEST_CONTENT);
      return s;
    };
    expect(run()).toEqual(run());
  });

  it('settles tribute at season end', () => {
    const s = testState();
    s.turn = 6;
    s.tributes = [{ faction: 'BEASTFOLK', direction: 'receive', silver: 18, goods: { grain: 2 } }];
    resolveTurn(s, TEST_CONTENT);
    expect(s.report.lines.some((l) => l.text.includes('Tribute comes in from The Greenskins'))).toBe(true);
    expect(s.tributes).toHaveLength(1);
  });

  it('breaks tribute if the post cannot pay it', () => {
    const s = testState();
    s.turn = 6;
    s.silver = 0;
    s.goods.grain = 0;
    s.tributes = [{ faction: 'BEASTFOLK', direction: 'pay', silver: 99, goods: { grain: 4 } }];
    resolveTurn(s, TEST_CONTENT);
    expect(s.tributes).toEqual([]);
    expect(s.report.lines.some((l) => l.text.includes('Peace with The Greenskins is broken'))).toBe(true);
  });
});

describe('event choice resolution', () => {
  it('applies outcomes for the rolled tier and marks the skill on success', () => {
    const s = testState();
    const event = TEST_CONTENT.events.get('post_charter_letter')!;
    const hero = livingHeroes(s)[0];
    const res = resolveChoice(s, TEST_CONTENT, event, 1, hero.id); // "draft a report" (check)
    expect(res.check).not.toBeNull();
    expect(res.resultText.length).toBeGreaterThan(0);
    if (res.check!.tier === 'success' || res.check!.tier === 'critSuccess') {
      expect(hero.skillMarks).toContain('diplomacy');
      expect(s.factions.CHARTER_COMPANY.standing).toBeGreaterThan(25);
    } else {
      expect(s.factions.CHARTER_COMPANY.standing).toBeLessThan(25);
    }
  });

  it('checkless choices resolve as plain success', () => {
    const s = testState();
    const event = TEST_CONTENT.events.get('post_drifter')!;
    const res = resolveChoice(s, TEST_CONTENT, event, 0, livingHeroes(s)[0].id);
    expect(res.check).toBeNull();
    expect(res.tier).toBe('success');
    expect(s.flags.odd_hired).toBe(true);
    expect(s.silver).toBe(190);
  });

  it('a forcedTier skips the roll entirely and applies that tier\'s outcomes (debug console)', () => {
    const s = testState();
    const event = TEST_CONTENT.events.get('post_charter_letter')!;
    const hero = livingHeroes(s)[0];
    const rngBefore = s.rngState;
    const res = resolveChoice(s, TEST_CONTENT, event, 1, hero.id, undefined, undefined, 'critFailure');
    expect(res.check).toBeNull();
    expect(res.tier).toBe('critFailure');
    expect(s.factions.CHARTER_COMPANY.standing).toBeLessThan(25);
    // No dice rolled, so no RNG stream was consumed.
    expect(s.rngState).toBe(rngBefore);
  });

  it('a forcedTier of critSuccess still marks the skill, same as a real success roll would', () => {
    const s = testState();
    const event = TEST_CONTENT.events.get('post_charter_letter')!;
    const hero = livingHeroes(s)[0];
    expect(hero.skillMarks).not.toContain('diplomacy');
    resolveChoice(s, TEST_CONTENT, event, 1, hero.id, undefined, undefined, 'critSuccess');
    expect(hero.skillMarks).toContain('diplomacy');
  });

  it('advancePendingEvent moves to report after the last event', () => {
    const s = testState();
    s.phase = 'event';
    s.pendingEvents = [
      { eventId: 'post_wolves', heroId: 'p1' },
      { eventId: 'post_fire', heroId: 'p1' },
    ];
    advancePendingEvent(s);
    expect(s.phase).toBe('event');
    advancePendingEvent(s);
    expect(s.phase).toBe('report');
  });
});

describe('turn advance & skill growth', () => {
  it('rolls growth for marked skills only at season end and clears marks', () => {
    const s = testState(4);
    s.turn = 6; // season end
    s.phase = 'report';
    const hero = livingHeroes(s)[0];
    hero.skills.bargain = 0;
    hero.skillMarks = ['bargain'];
    advanceTurn(s);
    // 2d6 vs 7+0: often succeeds; either way marks are cleared and turn advanced.
    expect(hero.skillMarks).toEqual([]);
    expect([0, 1]).toContain(hero.skills.bargain);
    expect(s.turn).toBe(7);
    expect(s.phase).toBe('assignment');
  });

  it('does not roll growth mid-season', () => {
    const s = testState();
    s.turn = 2;
    const hero = livingHeroes(s)[0];
    hero.skillMarks = ['bargain'];
    advanceTurn(s);
    expect(hero.skillMarks).toEqual(['bargain']); // kept until season end
  });

  it('never grows a skill past the cap', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = testState(seed);
      s.turn = 6;
      const hero = livingHeroes(s)[0];
      hero.skills.combat = TUNING.skillGrowth.maxSkill;
      hero.skillMarks = ['combat'];
      advanceTurn(s);
      expect(hero.skills.combat).toBe(TUNING.skillGrowth.maxSkill);
    }
  });

  it('losing every hero ends the game as a broken company', () => {
    const s = testState();
    for (const h of s.heroes) h.status = 'dead';
    advanceTurn(s);
    expect(s.gameOver?.kind).toBe('brokenCompany');
    expect(s.phase).toBe('gameover');
  });

  it('drops dead heroes from the assignment board but keeps standing orders', () => {
    const s = testState();
    const [dead, alive] = s.heroes;
    s.assignments[dead.id] = 'trade';
    s.assignments[alive.id] = 'provision';
    dead.status = 'dead';
    advanceTurn(s);
    expect(s.assignments[dead.id]).toBeUndefined();
    expect(s.assignments[alive.id]).toBe('provision');
  });
});
