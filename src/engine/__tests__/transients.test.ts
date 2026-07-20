// Transient outsiders (RESIDENTS_SPEC.md Phase B) and craftsfolk build-crews
// (Phase C): live effects, spawn/expire lifecycle, the Charter-inspector and
// envoy-escort hooks, and passive construction by craftsfolk.

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { startConstruction } from '../buildings';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { dispatchExpedition } from '../expeditions';
import {
  addTransientGroup,
  applyCraftsfolkConstruction,
  postDefense,
  removeTransients,
  transientEffect,
  updateContentment,
} from '../residents';
import { resolveTurn } from '../turn';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const DEFS = TEST_CONTENT.locationDefs;

function outcomeCtx(state: GameState): OutcomeContext {
  return {
    heroId: state.heroes[0].id,
    goodNames: TEST_CONTENT.goodNames,
    factionNames: TEST_CONTENT.factionNames,
    traitNames: TEST_CONTENT.traitNames,
    locationNames: TEST_CONTENT.locationNames,
    buildingNames: TEST_CONTENT.buildingNames,
    recruitDefs: TEST_CONTENT.recruitDefs,
    dependantName: TEST_CONTENT.dependantName,
  };
}

/** Runs a turn and drops any pending events without resolving them. */
function tick(s: GameState): void {
  resolveTurn(s, TEST_CONTENT);
  s.pendingEvents = [];
  s.phase = 'assignment';
  s.turn += 1;
}

describe('transient effects', () => {
  it('sums an effect field across groups, weighted by head count', () => {
    const s = testState();
    addTransientGroup(s, 'visitorGuards', 3, 3);
    addTransientGroup(s, 'supplierCrew', 2, 2);
    expect(transientEffect(s, 'defenseBonus')).toBe(
      3 * TUNING.residents.transients.effects.visitorGuards.defenseBonus,
    );
    expect(transientEffect(s, 'cargoBonus')).toBe(
      2 * TUNING.residents.transients.effects.supplierCrew.cargoBonus,
    );
  });

  it('visiting guards bolster post defense', () => {
    const s = testState();
    const before = postDefense(s);
    addTransientGroup(s, 'visitorGuards', 2, 3);
    expect(postDefense(s)).toBe(before + 2 * TUNING.residents.transients.effects.visitorGuards.defenseBonus);
  });

  it('company inspectors weigh on contentment while present', () => {
    const s = testState();
    s.residents.roles.farmers = 2; // a pool to have a mood
    s.residents.contentment = 7;
    addTransientGroup(s, 'companyAgents', 1, -1);
    // Fed, paid, roomy — the only pressure is the inspectors.
    updateContentment(s, { missedFood: false, missedWages: false });
    expect(s.residents.contentment).toBeLessThan(7);
  });
});

describe('transient lifecycle', () => {
  it('addTransientGroup assigns a unique id and bumps the counter', () => {
    const s = testState();
    const nextBefore = s.nextTransientId;
    addTransientGroup(s, 'supplierCrew', 2, 3);
    expect(s.transients).toHaveLength(1);
    expect(s.transients[0].id).toBe(`tr_${nextBefore}`);
    expect(s.nextTransientId).toBe(nextBefore + 1);
  });

  it('the addTransient outcome spawns a group', () => {
    const s = testState();
    applyOutcomes(s, [{ type: 'addTransient', kind: 'supplierCrew', count: 2, turns: 3 }], outcomeCtx(s));
    expect(s.transients).toHaveLength(1);
    expect(s.transients[0].kind).toBe('supplierCrew');
  });

  it('removeTransients drops every group of a kind', () => {
    const s = testState();
    addTransientGroup(s, 'companyAgents', 1, -1);
    addTransientGroup(s, 'visitorGuards', 3, 3);
    expect(removeTransients(s, 'companyAgents')).toBe(1);
    expect(s.transients.map((t) => t.kind)).toEqual(['visitorGuards']);
  });

  it('timed groups count down and leave; indefinite ones stay', () => {
    const s = testState();
    addTransientGroup(s, 'supplierCrew', 2, 1); // gone after one turn
    addTransientGroup(s, 'companyAgents', 1, -1); // posted indefinitely
    tick(s);
    const kinds = s.transients.map((t) => t.kind);
    expect(kinds).toContain('companyAgents');
    expect(kinds).not.toContain('supplierCrew');
  });
});

describe('company inspectors follow the Charter quota', () => {
  it('arrive when a season-end quota goes unpaid, and do not double up', () => {
    const s = testState();
    s.turn = 6; // a season end
    s.silver = 0; // cannot pay the quota
    s.goods.grain = 200; // but the post is fed, to isolate the quota miss
    resolveTurn(s, TEST_CONTENT);
    expect(s.transients.filter((t) => t.kind === 'companyAgents')).toHaveLength(1);

    // Another unpaid season must not stack a second set of inspectors.
    s.pendingEvents = [];
    s.phase = 'assignment';
    s.turn = 12;
    s.silver = 0;
    s.goods.grain = 200;
    resolveTurn(s, TEST_CONTENT);
    expect(s.transients.filter((t) => t.kind === 'companyAgents')).toHaveLength(1);
  });

  it('withdraw once the quota is met', () => {
    const s = testState();
    addTransientGroup(s, 'companyAgents', 1, -1);
    s.turn = 6;
    s.silver = TUNING.charter.quotaSilver + 500; // pay the quota comfortably
    s.goods.grain = 200;
    resolveTurn(s, TEST_CONTENT);
    expect(s.transients.some((t) => t.kind === 'companyAgents')).toBe(false);
  });
});

describe('visiting guards ride back with a successful envoy', () => {
  it('guards appear exactly when the envoy succeeds', () => {
    let sawSuccess = false;
    let sawFailure = false;

    for (let seed = 1; seed <= 24; seed++) {
      const s = testState(seed);
      const faction = 'RIVER_CLANS';
      const before = s.factions[faction].standing;
      dispatchExpedition(s, { kind: 'diplomacy', destination: 'river_meet', heroIds: ['p1'] }, DEFS);

      let guardsSeen = false;
      for (let i = 0; i < 5 && s.expeditions.length > 0; i++) {
        tick(s);
        if (s.transients.some((t) => t.kind === 'visitorGuards')) guardsSeen = true;
      }
      const delta = s.factions[faction].standing - before;
      if (delta > 0) {
        sawSuccess = true;
        expect(guardsSeen).toBe(true); // success ⇒ honour-guard rode back
      } else if (delta < 0) {
        sawFailure = true;
        expect(guardsSeen).toBe(false); // failure ⇒ no escort
      }
    }

    // The scenario must have exercised both directions to be meaningful.
    expect(sawSuccess).toBe(true);
    expect(sawFailure).toBe(true);
  });
});

describe('craftsfolk build-crews', () => {
  it('add progress while a project is underway, scaled by mood', () => {
    const s = testState();
    s.silver = 1000;
    s.goods.timber = 100;
    s.goods.tools = 100;
    startConstruction(s, 'storehouse');
    s.residents.roles.craftsfolk = 3;

    s.residents.contentment = 8; // content → full output
    const gain = applyCraftsfolkConstruction(s);
    expect(gain).toBe(3 * TUNING.residents.effects.crewYieldPerCraftsperson);
    expect(s.construction!.progress).toBe(gain);

    // Unrest throttles the crew's output.
    s.residents.contentment = 1;
    const throttled = applyCraftsfolkConstruction(s);
    expect(throttled).toBeLessThan(gain);
  });

  it('do nothing without a project or without craftsfolk', () => {
    const s = testState();
    expect(applyCraftsfolkConstruction(s)).toBe(0); // no project

    s.silver = 1000;
    s.goods.timber = 100;
    s.goods.tools = 100;
    startConstruction(s, 'storehouse');
    expect(applyCraftsfolkConstruction(s)).toBe(0); // project, but no craftsfolk
  });

  it('carry a project to completion on their own over turns', () => {
    const s = testState();
    s.silver = 1000;
    s.goods.timber = 100;
    s.goods.tools = 100;
    startConstruction(s, 'storehouse');
    s.residents.roles.craftsfolk = 4;
    s.residents.contentment = 8;
    s.goods.grain = 500; // keep the post fed through the build

    for (let i = 0; i < 30 && s.construction; i++) tick(s);
    expect(s.construction).toBeFalsy();
    expect(s.buildings).toContain('storehouse');
  });
});
