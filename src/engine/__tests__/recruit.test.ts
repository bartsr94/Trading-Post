// Recruitment (CHARACTERS_SPEC.md §6, Phase B): named characters join the
// reserve via the recruitCharacter mutator/outcome; departCharacter removes them
// and their dependants; rosterAtLeast/Below gate content.

import { describe, expect, it } from 'vitest';
import { RECRUIT_DEFS } from '../../content/recruits';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { benchHero, departCharacter, recruitCharacter } from '../roster';
import { activeHeroes, reserveHeroes } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

function outcomeCtx(state: GameState): OutcomeContext {
  return {
    heroId: state.heroes[0].id,
    goodNames: TEST_CONTENT.goodNames,
    factionNames: TEST_CONTENT.factionNames,
    traitNames: TEST_CONTENT.traitNames,
    locationNames: TEST_CONTENT.locationNames,
    locationDefs: TEST_CONTENT.locationDefs,
    buildingNames: TEST_CONTENT.buildingNames,
    recruitDefs: TEST_CONTENT.recruitDefs,
    dependantName: TEST_CONTENT.dependantName,
  };
}

describe('recruitCharacter / departCharacter', () => {
  it('adds a recruit to the reserve bench with a minted id + join flag', () => {
    const s = testState();
    const def = RECRUIT_DEFS.get('renowned_trader')!;
    const hero = recruitCharacter(s, def);
    expect(hero.id).toBe('c1');
    expect(hero.heritage).toBe('imanian');
    expect(hero.gender).toBe('male');
    expect(reserveHeroes(s).map((h) => h.id)).toContain('c1');
    expect(activeHeroes(s).map((h) => h.id)).not.toContain('c1');
    expect(s.flags.trader_guild_contact).toBe(true);
    expect(s.nextCharacterId).toBe(2);
  });

  it('joins the active party when there is room and toActive is set', () => {
    const s = testState();
    benchHero(s, 'p6'); // frees a slot under the cap
    const def = RECRUIT_DEFS.get('river_daughter')!;
    const hero = recruitCharacter(s, def, true);
    expect(activeHeroes(s).map((h) => h.id)).toContain(hero.id);
    expect(s.assignments[hero.id]).toBe('unassigned');
  });

  it('mints sequential ids for successive recruits', () => {
    const s = testState();
    const a = recruitCharacter(s, RECRUIT_DEFS.get('renowned_trader')!);
    const b = recruitCharacter(s, RECRUIT_DEFS.get('freed_carpenter')!);
    expect([a.id, b.id]).toEqual(['c1', 'c2']);
  });

  it('departs a character, dropping them from the party and taking their dependants', () => {
    const s = testState();
    const hero = recruitCharacter(s, RECRUIT_DEFS.get('renowned_trader')!, true);
    s.dependants.push({ id: 'd1', name: 'Anele', kind: 'spouse', parentId: hero.id, gender: 'female' });
    expect(departCharacter(s, hero.id)).toBe(true);
    expect(s.heroes.find((h) => h.id === hero.id)!.status).toBe('departed');
    expect(s.activePartyIds).not.toContain(hero.id);
    expect(s.dependants).toHaveLength(0);
  });

  it('recruitCharacter outcome adds the templated character', () => {
    const s = testState();
    applyOutcomes(s, [{ type: 'recruitCharacter', templateId: 'river_daughter' }], outcomeCtx(s));
    expect(s.heroes.some((h) => h.name === 'Naru')).toBe(true);
  });
});

describe('roster conditions', () => {
  it('rosterAtLeast / rosterBelow read the active/reserve/living scopes', () => {
    const s = testState(); // 6 active, 0 reserve, 6 living
    expect(evalCondition(s, { type: 'rosterAtLeast', scope: 'active', value: 6 })).toBe(true);
    expect(evalCondition(s, { type: 'rosterBelow', scope: 'reserve', value: 1 })).toBe(true);
    expect(evalCondition(s, { type: 'rosterBelow', scope: 'living', value: 9 })).toBe(true);
    recruitCharacter(s, RECRUIT_DEFS.get('renowned_trader')!);
    expect(evalCondition(s, { type: 'rosterAtLeast', scope: 'reserve', value: 1 })).toBe(true);
    expect(evalCondition(s, { type: 'rosterAtLeast', scope: 'living', value: 7 })).toBe(true);
  });
});
