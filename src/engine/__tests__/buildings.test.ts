// Buildings, construction, and tier advancement (BUILDINGS_SPEC.md).

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import {
  advanceTier,
  buildingEffect,
  canAdvanceTier,
  cancelConstruction,
  completeConstructionIfDone,
  constructionError,
  hasBuilding,
  startConstruction,
} from '../buildings';
import { prosperity } from '../economy';
import { evalConditions } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { postDefense, residentCap } from '../residents';
import { advancePendingEvent, advanceTurn, resolveChoice, resolveTurn } from '../turn';
import { heroesAtPost } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

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

/** Play turns with everyone on Build until the project completes (or the cap). */
function runBuildTurns(s: GameState, maxTurns = 24): void {
  for (let i = 0; i < maxTurns && s.construction && !s.gameOver; i++) {
    for (const h of heroesAtPost(s)) s.assignments[h.id] = 'build';
    resolveTurn(s, TEST_CONTENT);
    while (s.phase === 'event' && s.pendingEvents.length > 0) {
      const active = s.pendingEvents[0];
      const event = TEST_CONTENT.events.get(active.eventId)!;
      const open = event.choices
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => !c.requires || evalConditions(s, c.requires));
      resolveChoice(s, TEST_CONTENT, event, open[0].idx, active.heroId, active.expeditionId);
      if (s.gameOver) return;
      advancePendingEvent(s);
    }
    if (s.phase === 'report') advanceTurn(s);
  }
}

describe('construction validation', () => {
  it('accepts a startable building and rejects the impossible ones', () => {
    const s = testState();
    s.silver = 500;
    s.goods.timber = 100;
    s.goods.tools = 100;

    expect(constructionError(s, 'storehouse')).toBeNull();
    expect(constructionError(s, 'trade_hall')).toMatch(/storehouse/i); // prerequisite
    expect(constructionError(s, 'no_such_building')).toBeTruthy();

    s.silver = 0;
    expect(constructionError(s, 'storehouse')).toMatch(/silver/i);
  });

  it('rejects goods shortfall and already-built', () => {
    const s = testState();
    s.silver = 500;
    s.goods.timber = 0;
    expect(constructionError(s, 'storehouse')).toMatch(/timber/i);
    s.buildings.push('storehouse');
    expect(constructionError(s, 'storehouse')).toMatch(/already/i);
  });
});

describe('starting and cancelling a project', () => {
  it('deducts cost up front, opens the slot, and blocks a second project', () => {
    const s = testState();
    s.silver = 200;
    s.goods.timber = 50;
    const silver0 = s.silver;
    const timber0 = s.goods.timber;

    expect(startConstruction(s, 'storehouse')).toBe(true);
    expect(s.silver).toBe(silver0 - 40);
    expect(s.goods.timber).toBe(timber0 - 10);
    expect(s.construction).toEqual({ building: 'storehouse', progress: 0 });

    expect(constructionError(s, 'palisade')).toMatch(/current project/i);
    expect(startConstruction(s, 'palisade')).toBe(false);
  });

  it('cancel forfeits the paid cost (no refund)', () => {
    const s = testState();
    s.silver = 200;
    s.goods.timber = 50;
    startConstruction(s, 'storehouse');
    const silverAfterStart = s.silver;
    cancelConstruction(s);
    expect(s.construction).toBeNull();
    expect(s.silver).toBe(silverAfterStart); // costs are NOT returned
  });
});

describe('the Build activity raises a project', () => {
  it('heroes on Build accumulate progress until the building completes', () => {
    const s = testState(7);
    s.silver = 2000;
    s.goods.grain = 2000;
    s.goods.timber = 100;
    startConstruction(s, 'storehouse');
    runBuildTurns(s);
    expect(s.construction).toBeNull();
    expect(hasBuilding(s, 'storehouse')).toBe(true);
  });

  it('completeConstructionIfDone finishes only at the threshold', () => {
    const s = testState();
    s.construction = { building: 'palisade', progress: 5 }; // buildProgress 6
    expect(completeConstructionIfDone(s)).toBeNull();
    s.construction.progress = 6;
    expect(completeConstructionIfDone(s)).toBe('palisade');
    expect(s.construction).toBeNull();
    expect(hasBuilding(s, 'palisade')).toBe(true);
  });
});

describe('building effects feed derived selectors', () => {
  it('sums cap, defense, and prosperity across the completed set', () => {
    const s = testState();
    const cap0 = residentCap(s);
    const def0 = postDefense(s);
    const pros0 = prosperity(s, TEST_CONTENT.goodDefs);

    s.buildings.push('storehouse'); // +2 cap, +1 prosperity
    s.buildings.push('palisade'); // +3 defense, +1 prosperity

    expect(buildingEffect(s, 'residentCapBonus')).toBe(2);
    expect(buildingEffect(s, 'defenseBonus')).toBe(3);
    expect(residentCap(s)).toBe(cap0 + 2);
    expect(postDefense(s)).toBe(def0 + 3);
    expect(prosperity(s, TEST_CONTENT.goodDefs)).toBeCloseTo(pros0 + 2, 5);
  });

  it('a building adds its silver upkeep each turn', () => {
    const base = testState(3);
    base.silver = 1000;
    base.goods.grain = 1000;
    for (const h of base.heroes) base.assignments[h.id] = 'rest';
    const withB = structuredClone(base);
    withB.buildings.push('storehouse'); // upkeepSilver 1, no craftsfolk relief here

    resolveTurn(base, TEST_CONTENT);
    resolveTurn(withB, TEST_CONTENT);

    const baseSpent = 1000 - base.silver;
    const withSpent = 1000 - withB.silver;
    expect(withSpent - baseSpent).toBe(TUNING.building.defs.storehouse.effects.upkeepSilver);
  });
});

describe('tier advancement', () => {
  it('gates on buildings + silver, then bumps the tier and pays the cost', () => {
    const s = testState();
    s.postTier = 1;
    expect(canAdvanceTier(s)).toBe(false);

    s.buildings.push('storehouse', 'palisade');
    s.silver = 50;
    expect(canAdvanceTier(s)).toBe(false); // short silver

    s.silver = 120;
    expect(canAdvanceTier(s)).toBe(true);
    expect(advanceTier(s)).toBe(2);
    expect(s.postTier).toBe(2);
    expect(s.silver).toBe(20); // 120 − 100 recipe cost

    // No tier-3 ladder yet — advancing again is a no-op.
    expect(canAdvanceTier(s)).toBe(false);
    expect(advanceTier(s)).toBeNull();
  });
});

describe('event vocabulary', () => {
  it('applies building outcomes and evaluates building conditions', () => {
    const s = testState();
    const ctx = outcomeCtx(s);

    applyOutcomes(s, [{ type: 'completeBuilding', building: 'storehouse' }], ctx);
    expect(hasBuilding(s, 'storehouse')).toBe(true);

    expect(evalConditions(s, [{ type: 'hasBuilding', building: 'storehouse' }])).toBe(true);
    expect(evalConditions(s, [{ type: 'lacksBuilding', building: 'palisade' }])).toBe(true);
    expect(evalConditions(s, [{ type: 'postTierAtLeast', value: 1 }])).toBe(true);
    expect(evalConditions(s, [{ type: 'postTierAtMost', value: 1 }])).toBe(true);
    expect(evalConditions(s, [{ type: 'constructionActive', value: false }])).toBe(true);

    s.construction = { building: 'palisade', progress: 0 };
    applyOutcomes(s, [{ type: 'addBuildProgress', delta: 3 }], ctx);
    expect(s.construction.progress).toBe(3);
    expect(evalConditions(s, [{ type: 'constructionActive', value: true }])).toBe(true);

    s.construction = null;
    s.buildings.push('palisade');
    s.silver = 120;
    expect(evalConditions(s, [{ type: 'canAdvanceTier' }])).toBe(true);
    applyOutcomes(s, [{ type: 'advanceTier' }], ctx);
    expect(s.postTier).toBe(2);
  });
});
