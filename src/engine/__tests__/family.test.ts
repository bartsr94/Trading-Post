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
import { isEligible } from '../events/selection';
import {
  addChild,
  childAncestry,
  childGender,
  childrenComingOfAge,
  comeOfAge,
  dependantHeritageBreakdown,
  dependantHeritageGroupCounts,
  eligiblePartners,
  formHeroUnion,
  formUnion,
  grownKinCount,
  isMarried,
  isMixed,
  mixedHeritageLabel,
  nodePeoples,
  removeDependant,
  spouseCount,
  spousesOf,
  unionError,
} from '../family';
import { Rng } from '../rng';
import { freshResidents } from '../residents';
import { advancePendingEvent, advanceTurn, resolveChoice, resolveTurn } from '../turn';
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

describe('formHeroUnion — two heroes marry each other', () => {
  it('links both heroes as spouses of each other, symmetrically', () => {
    const s = testState(); // p1 imanian male, p4 Sela kiswani female
    expect(formHeroUnion(s, 'p1', 'p4')).toBe(true);
    expect(spousesOf(s, 'p1').map((n) => n.id)).toEqual(['p4']);
    expect(spousesOf(s, 'p4').map((n) => n.id)).toEqual(['p1']);
    expect(isMarried(s, 'p1')).toBe(true);
    expect(isMarried(s, 'p4')).toBe(true);
  });

  it('creates no Dependant — neither hero stops working or gets fed as a new mouth', () => {
    const s = testState();
    const before = s.dependants.length;
    formHeroUnion(s, 'p1', 'p4');
    expect(s.dependants).toHaveLength(before);
  });

  it('sets bloodline on both heads from the pairing (mixed if either side is native)', () => {
    const s = testState(); // p1 imanian, p4 kiswani
    formHeroUnion(s, 'p1', 'p4');
    expect(getHero(s, 'p1').bloodline).toBe('mixed');
    expect(getHero(s, 'p4').bloodline).toBe('mixed');
  });

  it('two homeland heroes marrying read as a pure line on both sides', () => {
    const s = testState(); // p1 and p2 are both imanian
    formHeroUnion(s, 'p1', 'p2');
    expect(getHero(s, 'p1').bloodline).toBe('pure');
    expect(getHero(s, 'p2').bloodline).toBe('pure');
  });

  it('refuses to marry a hero to themselves, or past the spouse cap', () => {
    const s = testState();
    expect(formHeroUnion(s, 'p1', 'p1')).toBe(false);
    for (let i = 0; i < TUNING.family.maxSpousesPerHero; i++) {
      formUnion(s, 'p1', { source: 'informal', heritage: 'kiswani', name: `S${i}` });
    }
    expect(formHeroUnion(s, 'p1', 'p4')).toBe(false);
    expect(spouseCount(s, 'p1')).toBe(TUNING.family.maxSpousesPerHero);
  });

  it('does not nudge the culture axis — no outsider is drawn in', () => {
    const s = testState();
    const before = s.axes.culture;
    formHeroUnion(s, 'p1', 'p4');
    expect(s.axes.culture).toBe(before);
  });

  it('a spouse leaving via removeDependant does not touch a hero-hero marriage', () => {
    // recomputeBloodline is called with headId from removeDependant only for
    // dependant-linked households; confirm a hero-hero union is unaffected by
    // unrelated dependant churn elsewhere.
    const s = testState();
    formHeroUnion(s, 'p1', 'p4');
    formUnion(s, 'p2', { source: 'informal', heritage: 'hanjoda', name: 'Kessa' });
    const otherSpouse = s.dependants.find((d) => d.parentId === 'p2')!;
    removeDependant(s, otherSpouse.id);
    expect(isMarried(s, 'p1')).toBe(true);
    expect(getHero(s, 'p1').bloodline).toBe('mixed');
  });
});

describe('eligiblePartners & partnerAvailable', () => {
  it('finds unmarried, opposite-gender, present active heroes', () => {
    const s = testState(); // p1 imanian male, p2 imanian female, p4 kiswani female
    const ids = eligiblePartners(s, 'p1').map((h) => h.id);
    expect(ids).toContain('p2');
    expect(ids).toContain('p4');
    expect(ids).not.toContain('p1'); // never self
  });

  it('excludes an already-married candidate once they hit the spouse cap', () => {
    const s = testState();
    for (let i = 0; i < TUNING.family.maxSpousesPerHero; i++) {
      formUnion(s, 'p2', { source: 'informal', heritage: 'kiswani', name: `S${i}` });
    }
    expect(eligiblePartners(s, 'p1').map((h) => h.id)).not.toContain('p2');
  });

  it('excludes a hero who is away on an expedition', () => {
    const s = testState();
    s.expeditions.push({
      id: 'exp_1',
      kind: 'caravan',
      heroIds: ['p2'],
      leg: 'outbound',
      turnsLeft: 2,
      cargo: {},
      silver: 0,
      buyOrders: {},
    });
    expect(eligiblePartners(s, 'p1').map((h) => h.id)).not.toContain('p2');
  });

  it('partnerAvailable reflects eligiblePartners', () => {
    const s = testState(undefined, ['p1']); // only one hero — no one to marry
    expect(evalCondition(s, { type: 'partnerAvailable', heroId: 'p1' })).toBe(false);
    expect(evalCondition(s, { type: 'partnerAvailable' }, { heroId: 'p1' })).toBe(false);
  });

  it('partnerAvailable is false with no heroId anywhere, even in a full party', () => {
    const s = testState();
    expect(evalCondition(s, { type: 'partnerAvailable' })).toBe(false);
  });
});

describe('pickPartner / formHeroUnion outcomes', () => {
  function ctx(state: GameState): OutcomeContext {
    return { ...outcomeCtx(state), rng: new Rng(1) };
  }

  it('pickPartner stashes an eligible partner id as a chain var', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'family_party_spark', heroId: 'p1' }];
    applyOutcomes(s, [{ type: 'pickPartner' }], { ...ctx(s), heroId: 'p1' });
    const partnerId = s.pendingEvents[0].vars?.partnerId;
    expect(typeof partnerId).toBe('string');
    expect(partnerId).not.toBe('p1');
  });

  it('pickPartner no-ops when no one is eligible', () => {
    const s = testState(undefined, ['p1']);
    s.pendingEvents = [{ eventId: 'family_party_spark', heroId: 'p1' }];
    applyOutcomes(s, [{ type: 'pickPartner' }], { ...ctx(s), heroId: 'p1' });
    expect(s.pendingEvents[0].vars).toBeUndefined();
  });

  it('formHeroUnion reads partnerId from the chain var by default', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'family_party_spark_ask', heroId: 'p1', vars: { partnerId: 'p2' } }];
    applyOutcomes(s, [{ type: 'formHeroUnion' }], { ...ctx(s), heroId: 'p1' });
    expect(isMarried(s, 'p1')).toBe(true);
    expect(spousesOf(s, 'p1').map((n) => n.id)).toEqual(['p2']);
  });

  it('formHeroUnion accepts an explicit partnerId override', () => {
    const s = testState();
    applyOutcomes(s, [{ type: 'formHeroUnion', partnerId: 'p4' }], { ...ctx(s), heroId: 'p1' });
    expect(spousesOf(s, 'p1').map((n) => n.id)).toEqual(['p4']);
  });

  it('formHeroUnion accepts an explicit subjectId, independent of ctx.heroId — the cheat console path', () => {
    const s = testState();
    // Acting hero (ctx.heroId) is p2, but subjectId names p1 as the one marrying p4.
    applyOutcomes(
      s,
      [{ type: 'formHeroUnion', subjectId: 'p1', partnerId: 'p4' }],
      { ...ctx(s), heroId: 'p2' },
    );
    expect(spousesOf(s, 'p1').map((n) => n.id)).toEqual(['p4']);
    expect(isMarried(s, 'p2')).toBe(false); // the acting hero itself is untouched
  });

  it('formHeroUnion no-ops with no partnerId anywhere', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'family_party_spark_ask', heroId: 'p1' }];
    applyOutcomes(s, [{ type: 'formHeroUnion' }], { ...ctx(s), heroId: 'p1' });
    expect(isMarried(s, 'p1')).toBe(false);
  });
});

describe('"Two Hearts at the Post" chain', () => {
  it('is eligible when at least one unmarried hero has an eligible partner', () => {
    const s = testState();
    const entry = TEST_CONTENT.events.get('family_party_spark')!;
    expect(isEligible(s, entry)).toBe(true);
  });

  it('is ineligible with only one hero at the post — no one to marry', () => {
    const s = testState(undefined, ['p1']);
    const entry = TEST_CONTENT.events.get('family_party_spark')!;
    expect(isEligible(s, entry)).toBe(false);
  });

  it('walks "let it be known" through the ask to a successful marriage', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'family_party_spark', heroId: 'p1' }];
    for (const hero of s.heroes) hero.stats.charm = 10;

    resolveChoice(s, TEST_CONTENT, TEST_CONTENT.events.get('family_party_spark')!, 0, 'p1');
    expect(s.pendingEvents).toHaveLength(2);
    advancePendingEvent(s);
    const stage2 = s.pendingEvents[0];
    expect(stage2.eventId).toBe('family_party_spark_ask');
    const partnerId = stage2.vars?.partnerId as string;
    expect(typeof partnerId).toBe('string');

    const ask = TEST_CONTENT.events.get('family_party_spark_ask')!;
    resolveChoice(s, TEST_CONTENT, ask, 0, stage2.heroId, undefined, stage2.locationId);
    expect(isMarried(s, 'p1')).toBe(true);
    expect(spousesOf(s, 'p1').map((n) => n.id)).toEqual([partnerId]);
    expect(getHero(s, 'p1').traits).toContain('wed_party');
    expect(getHero(s, 'p1').history.some((line) => line.includes(getHero(s, partnerId).name))).toBe(
      true,
    );
  });

  it('"say nothing" ends the encounter without a continuation', () => {
    const s = testState();
    s.pendingEvents = [{ eventId: 'family_party_spark', heroId: 'p1' }];
    resolveChoice(s, TEST_CONTENT, TEST_CONTENT.events.get('family_party_spark')!, 1, 'p1');
    expect(s.pendingEvents).toHaveLength(1);
    expect(isMarried(s, 'p1')).toBe(false);
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

  it('without an explicit partner, a multi-spouse household draws the mother at random — not always the first-wed', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' }); // wed first
    formUnion(s, 'p1', { source: 'alliance', heritage: 'kiswani', name: 'Nia' });
    formUnion(s, 'p1', { source: 'informal', heritage: 'hanjoda', name: 'Kessa' });
    const rng = new Rng(4);
    const mothers = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const child = addChild(s, 'p1', {
        nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
        rand: () => rng.next(),
      });
      expect(child).not.toBeNull();
      mothers.add(child!.parentIds!.find((id) => id !== 'p1')!);
    }
    // Every spouse should turn up as a mother at least once across 40 births —
    // the old behaviour always picked the first-wed spouse (Ada) alone.
    expect(mothers.size).toBe(3);
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

describe('mixedHeritageLabel & dependantHeritageBreakdown', () => {
  // Spouses are single-heritage (formUnion sets ancestry to just the outside
  // partner's people) — only a dual-parentage child can actually be mixed.
  function bearChild(s: GameState, heroId: string, spouseHeritage: 'kiswani' | 'hanjoda') {
    formUnion(s, heroId, { source: 'alliance', heritage: spouseHeritage, name: 'Partner' });
    const rng = new Rng(3);
    return addChild(s, heroId, {
      nameFor: (g, h) => TEST_CONTENT.dependantName(h, g, s.nextDependantId),
      rand: () => rng.next(),
    })!;
  }

  it('Imanian × native is Townborn', () => {
    const s = testState();
    const child = bearChild(s, 'p1', 'kiswani'); // p1 is imanian
    expect(mixedHeritageLabel(child)).toBe('townborn');
  });

  it('native × native (no Imanian) is Sauro', () => {
    const s = testState();
    const child = bearChild(s, 'p4', 'hanjoda'); // p4 Sela is kiswani
    expect(mixedHeritageLabel(child)).toBe('sauro');
  });

  it('a pure-line dependant has no mixed label', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' });
    const spouse = s.dependants.find((d) => d.kind === 'spouse')!;
    expect(mixedHeritageLabel(spouse)).toBeUndefined();
  });

  it('breakdown buckets by mixed label or pure heritage, separate from the resident tally', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' }); // pure
    bearChild(s, 'p2', 'kiswani'); // p2 Maela is imanian → townborn child
    const breakdown = dependantHeritageBreakdown(s);
    expect(breakdown.total).toBe(3); // Ada (spouse), Nia (spouse), child
    expect(breakdown.counts.imanian).toBe(1); // Ada
    expect(breakdown.counts.kiswani).toBe(1); // the spouse herself, pure kiswani
    expect(breakdown.counts.townborn).toBe(1); // the child
    // Dependants never touch the unnamed resident tally (still just the
    // seeded starting residents, untouched by any of the unions/births above).
    const startingTotal = s.residents.heritage.homeland + s.residents.heritage.native;
    expect(startingTotal).toBe(s.residents.roles.farmers + s.residents.roles.guards);
  });

  it('dependantHeritageGroupCounts folds pure-homeland vs any-native-blood into the coarse split', () => {
    const s = testState();
    formUnion(s, 'p1', { source: 'homeland', heritage: 'imanian', name: 'Ada' }); // pure homeland
    bearChild(s, 'p2', 'kiswani'); // townborn — carries native blood
    const groups = dependantHeritageGroupCounts(s);
    expect(groups.homeland).toBe(1); // Ada only
    expect(groups.native).toBe(2); // the outside kiswani spouse + the townborn child
    expect(groups.homeland + groups.native).toBe(s.dependants.length);
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

  it('heroGender reads the explicit heroId or falls back to ctx.heroId', () => {
    const s = testState(); // p1 imanian male, p4 Sela kiswani female
    expect(evalCondition(s, { type: 'heroGender', gender: 'male', heroId: 'p1' })).toBe(true);
    expect(evalCondition(s, { type: 'heroGender', gender: 'female', heroId: 'p1' })).toBe(false);
    expect(evalCondition(s, { type: 'heroGender', gender: 'female' }, { heroId: 'p4' })).toBe(true);
    expect(evalCondition(s, { type: 'heroGender', gender: 'male' })).toBe(false); // no heroId anywhere
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
