// Marriage, partners, children & the family line (FAMILY_SPEC.md). Gender on
// named people, the three union sources, dual-parentage children, coming of age
// into grown kin, and the courtship expedition.

import { describe, expect, it } from 'vitest';
import { LOCATION_DEFS } from '../../content/locations';
import { TUNING } from '../../content/tuning';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { dispatchExpedition, advanceExpeditions } from '../expeditions';
import {
  addChild,
  childAncestry,
  childGender,
  childrenComingOfAge,
  comeOfAge,
  formUnion,
  grownKinCount,
  isMarried,
  isMixed,
  nodePeoples,
  removeDependant,
  spousesOf,
  unionError,
} from '../family';
import { Rng } from '../rng';
import { freshResidents } from '../residents';
import { advanceTurn, resolveTurn } from '../turn';
import { getHero } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const noop = () => {};

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

describe('gender on named people', () => {
  it('stamps gender on founding heroes from their portrait pool', () => {
    const s = testState(); // p1 imanian male, p4 Sela kiswani female
    expect(getHero(s, 'p1').gender).toBe('male');
    expect(getHero(s, 'p4').gender).toBe('female');
  });
});

describe('formUnion', () => {
  it('a homeland union of an Imanian hero reads as a pure line', () => {
    const s = testState();
    const cultureBefore = s.axes.culture;
    const spouse = formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' });
    expect(spouse).not.toBeNull();
    expect(spouse!.gender).toBe('female'); // opposite the male hero
    expect(spouse!.spouseId).toBe('p1');
    expect(spouse!.union).toBe('homeland');
    expect(isMarried(s, 'p1')).toBe(true);
    expect(getHero(s, 'p1').bloodline).toBe('pure');
    expect(s.axes.culture).toBeLessThan(cultureBefore); // nudged Homeland
  });

  it('a native union reads as a mixed line and nudges culture Frontier', () => {
    const s = testState();
    const cultureBefore = s.axes.culture;
    const spouse = formUnion(s, 'p1', { source: 'alliance', heritage: 'kiswani', name: 'Nia' });
    expect(spouse!.heritage).toBe('kiswani');
    expect(getHero(s, 'p1').bloodline).toBe('mixed');
    expect(s.axes.culture).toBeGreaterThan(cultureBefore); // nudged Frontier
  });

  it('allows multiple spouses up to the cap, then refuses', () => {
    const s = testState();
    for (let i = 0; i < TUNING.family.maxSpousesPerHero; i++) {
      expect(formUnion(s, 'p1', { source: 'informal', heritage: 'kiswani', name: `S${i}` })).not.toBeNull();
    }
    expect(unionError(s, 'p1')).not.toBeNull();
    expect(formUnion(s, 'p1', { source: 'informal', heritage: 'kiswani', name: 'Extra' })).toBeNull();
    expect(spousesOf(s, 'p1')).toHaveLength(TUNING.family.maxSpousesPerHero);
  });
});

describe('children — dual-parentage heritage', () => {
  it('a child of an Imanian × Kiswani union descends from both peoples', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'alliance', heritage: 'kiswani', name: 'Nia' });
    const rng = new Rng(7);
    const child = addChild(s, 'p1', {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      rand: () => rng.next(),
    });
    expect(child).not.toBeNull();
    expect(new Set(nodePeoples(child!))).toEqual(new Set(['imanian', 'kiswani']));
    expect(isMixed(child!)).toBe(true);
    expect(child!.parentIds).toHaveLength(2);
    expect(child!.bornTurn).toBe(s.turn);
  });

  it('childAncestry dedupes a pure line and childGender skews daughters on mixed unions', () => {
    const s = testState();
    const imanianHero = getHero(s, 'p1');
    const kiswaniHero = getHero(s, 'p4');
    expect(childAncestry(imanianHero, imanianHero).peoples).toEqual(['imanian']);

    const rng = new Rng(99);
    const rand = () => rng.next();
    let pureFemale = 0;
    let mixedFemale = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      if (childGender(imanianHero, imanianHero, rand) === 'female') pureFemale++;
      if (childGender(imanianHero, kiswaniHero, rand) === 'female') mixedFemale++;
    }
    // Mixed unions skew toward daughters more than pure ones.
    expect(mixedFemale).toBeGreaterThan(pureFemale);
  });

  it('can target a specific spouse as the other parent', () => {
    const s = testState();
    const homeland = formUnion(s, 'p1', {
      source: 'homeland',
      heritage: 'imanian',
      name: 'Ada',
    })!;
    const native = formUnion(s, 'p1', {
      source: 'alliance',
      heritage: 'kiswani',
      name: 'Nia',
    })!;

    applyOutcomes(
      s,
      [{ type: 'addDependant', kind: 'child', parentId: 'p1', otherParentId: native.id }],
      outcomeCtx(s),
    );
    const child = s.dependants.find((d) => d.kind === 'child')!;
    expect(child.parentIds).toEqual(['p1', native.id]);
    expect(child.parentIds).not.toContain(homeland.id);
    expect(new Set(child.ancestry?.peoples)).toEqual(new Set(['imanian', 'kiswani']));
  });

  it('rejects an explicit other parent who is not the subject spouse', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' });
    const before = s.dependants.length;
    const child = addChild(s, 'p1', {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      partnerId: 'p2',
      rand: () => 0.5,
    });
    expect(child).toBeNull();
    expect(s.dependants).toHaveLength(before);
  });
});

describe('dependant removal', () => {
  it('recomputes the household bloodline after a spouse leaves', () => {
    const s = testState();
    const spouse = formUnion(s, 'p1', {
      source: 'alliance',
      heritage: 'kiswani',
      name: 'Nia',
    })!;
    expect(getHero(s, 'p1').bloodline).toBe('mixed');

    expect(removeDependant(s, spouse.id)).toBe(true);
    expect(getHero(s, 'p1').bloodline).toBeUndefined();
  });
});

describe('coming of age', () => {
  it('a child past comeOfAgeTurns becomes named grown kin', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'alliance', heritage: 'kiswani', name: 'Nia' });
    const rng = new Rng(3);
    const child = addChild(s, 'p1', {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      rand: () => rng.next(),
    })!;
    child.bornTurn = 0;
    s.turn = TUNING.family.comeOfAgeTurns;
    expect(childrenComingOfAge(s).map((d) => d.id)).toContain(child.id);
    const grown = comeOfAge(s, child.id);
    expect(grown!.kind).toBe('kin');
    expect(grown!.comeOfAge).toBe(true);
    expect(grownKinCount(s)).toBe(1);
  });

  it('the season-end sweep ages children and reports it', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' });
    const rng = new Rng(5);
    const child = addChild(s, 'p1', {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      rand: () => rng.next(),
    })!;
    child.bornTurn = 0;
    s.turn = TUNING.family.comeOfAgeTurns; // old enough, and a season end (48 % 6 === 0)
    s.phase = 'report';
    const lines = advanceTurn(s);
    expect(s.dependants.find((d) => d.id === child.id)!.kind).toBe('kin');
    expect(lines.some((l) => l.includes('comes of age'))).toBe(true);
  });
});

describe('courtship expedition', () => {
  it('dispatch pays the bride-price up front and records who is to be wed', () => {
    const s = testState();
    const silverBefore = s.silver;
    const ok = dispatchExpedition(
      s,
      { kind: 'courtship', destination: 'charter_landing', heroIds: ['p1'], courtshipFor: 'p1' },
      LOCATION_DEFS,
    );
    expect(ok).toBe(true);
    expect(s.silver).toBe(silverBefore - TUNING.family.homelandBridePrice);
    const exp = s.expeditions.find((e) => e.kind === 'courtship');
    expect(exp?.courtshipFor).toBe('p1');
  });

  it('homecoming weds the subject to a homeland spouse (pure line)', () => {
    const s = testState();
    s.expeditions.push({
      id: 'exp_1',
      kind: 'courtship',
      destination: 'charter_landing',
      heroIds: ['p1'],
      leg: 'returning',
      turnsLeft: 1,
      cargo: {},
      silver: 0,
      buyOrders: {},
      courtshipFor: 'p1',
    });
    advanceExpeditions(s, TEST_CONTENT, new Rng(1), noop);
    expect(isMarried(s, 'p1')).toBe(true);
    expect(getHero(s, 'p1').bloodline).toBe('pure');
    const spouse = spousesOf(s, 'p1')[0];
    expect('union' in spouse && spouse.union).toBe('homeland');
    expect(s.expeditions).toHaveLength(0); // the run is finished
  });
});

describe('family outcomes & conditions', () => {
  it('formUnion / addDependant(child) / comeOfAge outcomes chain into a family', () => {
    const s = testState();
    applyOutcomes(s, [{ type: 'formUnion', source: 'alliance', heritage: 'kiswani' }], outcomeCtx(s));
    expect(isMarried(s, s.heroes[0].id)).toBe(true);

    applyOutcomes(s, [{ type: 'addDependant', kind: 'child' }], outcomeCtx(s));
    const child = s.dependants.find((d) => d.kind === 'child');
    expect(child).toBeDefined();

    applyOutcomes(s, [{ type: 'comeOfAge', dependantId: child!.id }], outcomeCtx(s));
    expect(s.dependants.find((d) => d.id === child!.id)!.kind).toBe('kin');
  });

  it('heroHasSpouse / heroUnmarried read the graph', () => {
    const s = testState();
    expect(evalCondition(s, { type: 'heroUnmarried', heroId: 'p1' })).toBe(true);
    expect(evalCondition(s, { type: 'heroHasSpouse', heroId: 'p1' })).toBe(false);
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' });
    expect(evalCondition(s, { type: 'heroHasSpouse', heroId: 'p1' })).toBe(true);
    expect(evalCondition(s, { type: 'heroUnmarried', heroId: 'p1' })).toBe(false);
  });

  it('grown kin draw a retainer at season end', () => {
    const s = testState(2);
    s.residents = freshResidents();
    s.dependants.push({
      id: 'd1',
      name: 'Grown',
      kind: 'kin',
      parentId: 'p1',
      gender: 'male',
      comeOfAge: true,
    });
    s.turn = 6; // season end
    s.silver = 1000;
    resolveTurn(s, TEST_CONTENT);
    const wageLine = s.report.lines.find((l) => l.text.includes('wages'));
    expect(wageLine?.text).toContain(`${TUNING.family.grownKinRetainer} silver`);
  });
});
