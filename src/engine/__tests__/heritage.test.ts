// Heritage & the cultural character of the post (HERITAGE_SPEC.md Phase A):
// the culture axis, the resident heritage tally, culture drift, and the new
// event vocabulary. (Local hiring and the Thornwatch labor run were retired by
// TULA_SETTLEMENT_SPEC.md in favour of Invite Settlers.)

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { evalCondition } from '../events/conditions';
import { applyOutcomes } from '../events/outcomes';
import type { OutcomeContext } from '../events/outcomes';
import { advanceExpeditions, dispatchExpedition } from '../expeditions';
import type { ExpeditionContext } from '../expeditions';
import { formHeroUnion, formUnion } from '../family';
import {
  addResidents,
  applyCultureDrift,
  applyDesertion,
  freshResidents,
  loseResidents,
  nativeShare,
  reallocate,
  residentTotal,
} from '../residents';
import { Rng } from '../rng';
import { resolveTurn } from '../turn';
import { partyHeritageShare } from '../types';
import type { GameState } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const noop = () => {};

/** Runs a turn and drops any pending events without resolving them
 *  (mirrors transients.test.ts's `tick`). Leaves a game-over state as-is
 *  rather than clobbering `phase`/`turn` past it. */
function tick(s: GameState): void {
  resolveTurn(s, TEST_CONTENT);
  if (s.gameOver) return;
  s.pendingEvents = [];
  s.phase = 'assignment';
  s.turn += 1;
}

/** The heritage tally must always sum to the number of heads the post feeds. */
function expectTallyInvariant(s: GameState): void {
  const h = s.residents.heritage;
  expect(h.homeland + h.native).toBe(residentTotal(s));
}

function outcomeCtx(state: GameState): OutcomeContext {
  return {
    heroId: state.heroes[0].id,
    goodNames: new Map(),
    factionNames: new Map(),
    traitNames: new Map(),
    locationNames: new Map(),
    locationDefs: TEST_CONTENT.locationDefs,
    buildingNames: new Map(),
    recruitDefs: new Map(),
    factionFigureDefs: new Map(),
    dependantName: () => 'Test',
  };
}

/** Runs expeditions to completion (both legs), returning turns elapsed. */
function runToHomecoming(s: GameState, ctx: ExpeditionContext): number {
  let turns = 0;
  const rng = new Rng(1);
  while (s.expeditions.length > 0 && turns < 40) {
    advanceExpeditions(s, ctx, rng, noop);
    turns += 1;
  }
  return turns;
}

describe('the heritage tally', () => {
  it('starts empty and stays summed-equal to the pool', () => {
    const s = testState();
    s.residents = freshResidents();
    expect(s.residents.heritage).toEqual({ homeland: 0, native: 0 });
    expect(nativeShare(s)).toBe(0);
    expectTallyInvariant(s);
  });

  it('records origin on add and debits proportionally on loss', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'farmers', 4, 'settlers', 'homeland');
    addResidents(s, 'guards', 4, 'kiswani', 'native');
    expect(s.residents.heritage).toEqual({ homeland: 4, native: 4 });
    expectTallyInvariant(s);
    expect(nativeShare(s)).toBe(0.5);

    // Proportional loss (50/50) removes evenly.
    loseResidents(s, undefined, 4);
    expectTallyInvariant(s);
    expect(s.residents.heritage.homeland).toBe(2);
    expect(s.residents.heritage.native).toBe(2);
  });

  it('can bias loss to a group', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'farmers', 3, 'settlers', 'homeland');
    addResidents(s, 'guards', 3, 'kiswani', 'native');
    loseResidents(s, undefined, 3, 'native');
    expect(s.residents.heritage.native).toBe(0);
    expect(s.residents.heritage.homeland).toBe(3);
    expectTallyInvariant(s);
  });

  it('reallocation never changes the tally; escorts stay counted while away', () => {
    const s = testState();
    addResidents(s, 'guards', 2, 'kiswani', 'native');
    addResidents(s, 'porters', 2, 'settlers', 'homeland');
    const before = { ...s.residents.heritage };

    reallocate(s, 'guards', 'idle', 1);
    expect(s.residents.heritage).toEqual(before);
    expectTallyInvariant(s);

    // Second a porter onto a caravan — still ours, still on the tally.
    dispatchExpedition(
      s,
      { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'], residents: { porters: 1 } },
      TEST_CONTENT.locationDefs,
    );
    expect(s.residents.heritage).toEqual(before);
    expectTallyInvariant(s);

    runToHomecoming(s, TEST_CONTENT);
    expect(s.residents.heritage).toEqual(before);
    expectTallyInvariant(s);
  });

  it('desertion debits the tally', () => {
    const s = testState();
    addResidents(s, 'farmers', 4, 'settlers', 'homeland');
    s.residents.contentment = 0; // force unrest
    const lost = applyDesertion(s);
    expect(lost).toBeGreaterThan(0);
    expectTallyInvariant(s);
  });
});

describe('culture drift', () => {
  it('moves toward the tally-implied target, capped per season', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'guards', 4, 'kiswani', 'native'); // all native → target +10
    s.axes.culture = 0;
    const delta = applyCultureDrift(s);
    expect(delta).toBe(TUNING.heritage.axisDriftPerSeason);
    expect(s.axes.culture).toBe(TUNING.heritage.axisDriftPerSeason);
  });

  it('is a no-op with no residents', () => {
    const s = testState();
    s.residents = freshResidents();
    s.axes.culture = 3;
    expect(applyCultureDrift(s)).toBe(0);
    expect(s.axes.culture).toBe(3);
  });
});

describe('party heritage & new event vocabulary', () => {
  it('partyHeritageShare reads the active party', () => {
    const s = testState(); // p1..p6; p4 kiswani, p5 dustwalker are native
    const native = partyHeritageShare(s, 'native');
    const homeland = partyHeritageShare(s, 'homeland');
    expect(native + homeland).toBeCloseTo(1);
    expect(native).toBeGreaterThan(0); // Sela + Dagny
  });

  it('evaluates the heritage conditions', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'guards', 3, 'kiswani', 'native');
    addResidents(s, 'farmers', 1, 'settlers', 'homeland');
    expect(evalCondition(s, { type: 'nativeShareAtLeast', value: 0.5 })).toBe(true);
    expect(evalCondition(s, { type: 'nativeShareAtMost', value: 0.5 })).toBe(false);
    expect(evalCondition(s, { type: 'heritageCountAtLeast', group: 'native', value: 3 })).toBe(true);
    expect(evalCondition(s, { type: 'heroHeritageInParty', heritage: 'kiswani' })).toBe(true);
    expect(evalCondition(s, { type: 'heroHeritageInParty', heritage: 'weri' })).toBe(false);
  });

  it('honors the group param on addResidents / loseResidents outcomes', () => {
    const s = testState();
    applyOutcomes(
      s,
      [{ type: 'addResidents', role: 'idle', count: 2, tag: 'kiswani', group: 'native' }],
      outcomeCtx(s),
    );
    expect(s.residents.heritage.native).toBe(2);
    applyOutcomes(s, [{ type: 'loseResidents', count: 1, group: 'native' }], outcomeCtx(s));
    expect(s.residents.heritage.native).toBe(1);
    expectTallyInvariant(s);
  });
});

describe('group-targeted desertion (CHARTER_REVOKED_SPEC.md §3)', () => {
  // Porters, not guards, for the native group — guards raise postDefense and
  // suppress the desertion rate, which would confound the count asserted on.
  it('biases desertion toward native residents once the post sits Aloof', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'farmers', 6, 'settlers', 'homeland');
    addResidents(s, 'porters', 6, 'kiswani', 'native');
    s.residents.contentment = 0; // force the unrest band
    s.axes.integration = TUNING.residents.desertion.aloofIntegrationThreshold; // at the Aloof threshold

    const lost = applyDesertion(s);
    expect(lost).toBeGreaterThan(0);
    expectTallyInvariant(s);
    // Natives absorb the loss first; homeland stays untouched until natives run out.
    expect(s.residents.heritage.native).toBe(6 - lost);
    expect(s.residents.heritage.homeland).toBe(6);
  });

  it('splits proportionally when the post is not Aloof', () => {
    const s = testState();
    s.residents = freshResidents();
    addResidents(s, 'farmers', 6, 'settlers', 'homeland');
    addResidents(s, 'porters', 6, 'kiswani', 'native');
    s.residents.contentment = 0;
    s.axes.integration = TUNING.residents.desertion.aloofIntegrationThreshold + 1; // just short of Aloof

    applyDesertion(s);
    expectTallyInvariant(s);
    expect(s.residents.heritage.homeland).toBeLessThan(6);
  });
});

describe("the Company's judgment & the charterRevoked ending (CHARTER_REVOKED_SPEC.md)", () => {
  it('a sustained compromised-and-hostile streak revokes the charter', () => {
    // Both native heroes: homelandShare 0 keeps party reassurance out of the
    // way, so the culture-driven compromise (and the "total break" read) is
    // the only thing moving the streak.
    const s = testState(1, ['p4', 'p5']);
    s.silver = 1_000_000; // always affords the quota — keep that noise out
    s.axes.culture = 10; // deep Frontier, past compromiseThreshold (5)
    s.factions.CHARTER_COMPANY.standing = -60; // already Hostile

    tick(s); // turn 1 — not a season end
    tick(s); // turn 2 — not a season end
    expect(s.charterCompromisedStreak).toBe(0);

    tick(s); // turn 3 — season end #1
    expect(s.charterCompromisedStreak).toBe(1);
    expect(s.gameOver).toBeNull();

    tick(s);
    tick(s);
    tick(s); // turn 6 — season end #2
    expect(s.charterCompromisedStreak).toBe(2);
    expect(s.gameOver).toBeNull();

    tick(s);
    tick(s);
    tick(s); // turn 9 — season end #3: revokeStreak reached
    expect(s.gameOver?.kind).toBe('charterRevoked');
    expect(s.phase).toBe('gameover');
  });

  it('resets the streak once standing climbs clear of Hostile, not merely from paying the quota', () => {
    const s = testState(1, ['p4', 'p5']);
    s.silver = 1_000_000;
    s.axes.culture = 10;
    s.factions.CHARTER_COMPANY.standing = -60;

    tick(s);
    tick(s);
    tick(s); // turn 3
    expect(s.charterCompromisedStreak).toBe(1);

    s.factions.CHARTER_COMPANY.standing = -60; // still Hostile despite the quota paid every season
    tick(s);
    tick(s);
    tick(s); // turn 6
    expect(s.charterCompromisedStreak).toBe(2);

    s.factions.CHARTER_COMPANY.standing = 0; // climbs clear of Hostile
    tick(s);
    tick(s);
    tick(s); // turn 9
    expect(s.charterCompromisedStreak).toBe(0);
    expect(s.gameOver).toBeNull();
  });

  it('weighs an informal native marriage heavier than an alliance one', () => {
    const build = () => {
      const s = testState(1, ['p1']); // one homeland hero, unwed until formUnion below
      s.silver = 1_000_000;
      s.axes.culture = 0; // isolate the bloodline signal from culture-driven compromise
      s.factions.CHARTER_COMPANY.standing = -60;
      return s;
    };

    const informal = build();
    formUnion(informal, 'p1', { source: 'informal', heritage: 'kiswani', name: 'Nia' });
    tick(informal);
    tick(informal);
    tick(informal); // turn 3

    const alliance = build();
    formUnion(alliance, 'p1', { source: 'alliance', heritage: 'kiswani', name: 'Nia' });
    tick(alliance);
    tick(alliance);
    tick(alliance); // turn 3

    expect(informal.factions.CHARTER_COMPANY.standing).toBeLessThan(
      alliance.factions.CHARTER_COMPANY.standing,
    );
  });

  it('weighs a hero-to-hero marriage heavier than an alliance one (§2)', () => {
    const build = () => {
      const s = testState(1, ['p1', 'p4']); // p1 homeland, p4 kiswani (native) — both must exist to wed
      s.activePartyIds = ['p1']; // isolate the bloodline signal to p1 alone, as in the informal/alliance case
      s.silver = 1_000_000;
      s.axes.culture = 0;
      s.factions.CHARTER_COMPANY.standing = -60;
      return s;
    };

    const partyMarriage = build();
    formHeroUnion(partyMarriage, 'p1', 'p4');
    tick(partyMarriage);
    tick(partyMarriage);
    tick(partyMarriage); // turn 3

    const alliance = build();
    formUnion(alliance, 'p1', { source: 'alliance', heritage: 'kiswani', name: 'Nia' });
    tick(alliance);
    tick(alliance);
    tick(alliance); // turn 3

    expect(partyMarriage.factions.CHARTER_COMPANY.standing).toBeLessThan(
      alliance.factions.CHARTER_COMPANY.standing,
    );
  });
});
