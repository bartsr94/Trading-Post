// Named faction figures (NAMED_NPCS_SPEC.md): met via introduceFigure, then
// resolved one-shot via recruitFigure/marryFigure/ransomFigure, or escalated
// via captureFigure/figureCounter. Mirrors recruit.test.ts's shape.

import { describe, expect, it } from 'vitest';
import { FACTION_FIGURE_DEFS } from '../../content/factionFigures';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const FIGURE_ID = 'goblin_tallykeeper';

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
    factionFigureDefs: TEST_CONTENT.factionFigureDefs,
    dependantName: TEST_CONTENT.dependantName,
  };
}

function introduce(s: GameState) {
  applyOutcomes(s, [{ type: 'introduceFigure', figureDefId: FIGURE_ID }], outcomeCtx(s));
}

describe('introduceFigure', () => {
  it('instantiates the def into state.factionFigures', () => {
    const s = testState();
    introduce(s);
    const figure = s.factionFigures[FIGURE_ID];
    expect(figure).toBeDefined();
    expect(figure.name).toBe(FACTION_FIGURE_DEFS.get(FIGURE_ID)!.name);
    expect(figure.heritage).toBe('goblin');
    expect(figure.faction).toBe('BEASTFOLK');
  });

  it('is idempotent — a second introduce does not reset counters', () => {
    const s = testState();
    introduce(s);
    applyOutcomes(s, [{ type: 'figureCounter', figureId: FIGURE_ID, key: 'grudge', delta: 2 }], outcomeCtx(s));
    introduce(s);
    expect(s.factionFigures[FIGURE_ID].counters?.grudge).toBe(2);
  });
});

describe('figureCounter / figure conditions', () => {
  it('increments and clamps at 0', () => {
    const s = testState();
    introduce(s);
    applyOutcomes(s, [{ type: 'figureCounter', figureId: FIGURE_ID, key: 'grudge', delta: -5 }], outcomeCtx(s));
    expect(s.factionFigures[FIGURE_ID].counters?.grudge).toBe(0);
    applyOutcomes(s, [{ type: 'figureCounter', figureId: FIGURE_ID, key: 'grudge', delta: 3 }], outcomeCtx(s));
    expect(evalCondition(s, { type: 'figureCounterAtLeast', figureId: FIGURE_ID, key: 'grudge', value: 3 })).toBe(true);
    expect(evalCondition(s, { type: 'figureCounterAtMost', figureId: FIGURE_ID, key: 'grudge', value: 2 })).toBe(false);
  });

  it('figureExists / figureNotExists read presence in state.factionFigures', () => {
    const s = testState();
    expect(evalCondition(s, { type: 'figureNotExists', figureId: FIGURE_ID })).toBe(true);
    introduce(s);
    expect(evalCondition(s, { type: 'figureExists', figureId: FIGURE_ID })).toBe(true);
    expect(evalCondition(s, { type: 'figureNotExists', figureId: FIGURE_ID })).toBe(false);
  });
});

describe('captureFigure / ransomFigure', () => {
  it('captureFigure sets heldByPost; ransomFigure pays silver and resolves the arc', () => {
    const s = testState();
    introduce(s);
    applyOutcomes(s, [{ type: 'captureFigure', figureId: FIGURE_ID }], outcomeCtx(s));
    expect(s.factionFigures[FIGURE_ID].heldByPost?.capturedTurn).toBe(s.turn);
    expect(evalCondition(s, { type: 'figureHeldByPost', figureId: FIGURE_ID })).toBe(true);

    const silverBefore = s.silver;
    applyOutcomes(s, [{ type: 'ransomFigure', figureId: FIGURE_ID, silver: 60 }], outcomeCtx(s));
    expect(s.silver).toBe(silverBefore + 60);
    expect(s.factionFigures[FIGURE_ID]).toBeUndefined();
  });

  it('ransomFigure no-ops if the figure is not currently held', () => {
    const s = testState();
    introduce(s);
    const silverBefore = s.silver;
    applyOutcomes(s, [{ type: 'ransomFigure', figureId: FIGURE_ID, silver: 60 }], outcomeCtx(s));
    expect(s.silver).toBe(silverBefore);
    expect(s.factionFigures[FIGURE_ID]).toBeDefined();
  });
});

describe('recruitFigure', () => {
  it('promotes the figure into a real roster Hero and clears the entry', () => {
    const s = testState();
    introduce(s);
    applyOutcomes(s, [{ type: 'recruitFigure', figureId: FIGURE_ID }], outcomeCtx(s));
    expect(s.factionFigures[FIGURE_ID]).toBeUndefined();
    const joined = s.heroes.find((h) => h.name === 'Yikka');
    expect(joined).toBeDefined();
    expect(joined!.status).toBe('active');
    expect(joined!.heritage).toBe('goblin');
    expect(joined!.gender).toBe('female');
  });

  it('joins the active party when toActive is set and there is room', () => {
    const s = testState();
    introduce(s);
    s.activePartyIds = s.activePartyIds.slice(0, 5); // free a slot under the cap
    applyOutcomes(s, [{ type: 'recruitFigure', figureId: FIGURE_ID, toActive: true }], outcomeCtx(s));
    const joined = s.heroes.find((h) => h.name === 'Yikka')!;
    expect(s.activePartyIds).toContain(joined.id);
  });
});

describe('marryFigure', () => {
  it('marries the figure into the bound hero\'s household and resolves the arc', () => {
    const s = testState();
    introduce(s);
    const ctx = { ...outcomeCtx(s), heroId: 'p1' }; // p1 is male in the default pool
    applyOutcomes(s, [{ type: 'marryFigure', figureId: FIGURE_ID }], ctx);
    expect(s.factionFigures[FIGURE_ID]).toBeUndefined();
    const spouse = s.dependants.find((d) => d.name === 'Yikka');
    expect(spouse).toBeDefined();
    expect(spouse!.spouseId).toBe('p1');
  });
});
