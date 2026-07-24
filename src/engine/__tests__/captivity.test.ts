import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { captureHero, hasCaptiveHeldBy, maybeQueueKinArrival, rollAbductionRisk } from '../captivity';
import { applyOutcomes } from '../events/outcomes';
import { selectEvents } from '../events/selection';
import { dispatchError, dispatchExpedition, advanceExpeditions } from '../expeditions';
import { resolveIncomingRaid, resolveOutgoingRaid } from '../raids';
import { departCharacter } from '../roster';
import { Rng } from '../rng';
import { outcomeCtx, resolveTurn, advanceTurn } from '../turn';
import type { ExpeditionState, GameState, PendingIncomingRaid, PendingOutgoingRaid } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const ALL_POOL_IDS = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
const DEFS = TEST_CONTENT.locationDefs;

const RAID_CTX = {
  goodDefs: TEST_CONTENT.goodDefs,
  goodNames: TEST_CONTENT.goodNames,
  buildingNames: TEST_CONTENT.buildingNames,
};

function withGenders(seed = 1): GameState {
  return testState(seed, ALL_POOL_IDS);
}

function malesAndFemales(s: GameState) {
  return {
    males: s.heroes.filter((h) => h.gender === 'male'),
    females: s.heroes.filter((h) => h.gender === 'female'),
  };
}

describe('captureHero', () => {
  it('marks the hero captive and queues exactly one resolution event pinned to them', () => {
    const s = testState();
    const hero = s.heroes[0];
    const before = s.queuedEvents.length;
    captureHero(s, hero, 'RIVER_CLANS', 'raid', new Rng(1));
    expect(hero.status).toBe('captive');
    expect(hero.captivity).toEqual({ faction: 'RIVER_CLANS', capturedTurn: s.turn, source: 'raid' });
    expect(s.queuedEvents.length).toBe(before + 1);
    const queued = s.queuedEvents[s.queuedEvents.length - 1];
    expect(queued.heroId).toBe(hero.id);
    expect(['captive_quick_release', 'captive_check_in']).toContain(queued.eventId);
    expect(queued.fireOnTurn).toBeGreaterThan(s.turn);
  });
});

describe('maybeQueueKinArrival', () => {
  it('never queues before the grim-warning threshold has passed', () => {
    const s = testState();
    const hero = s.heroes[0];
    maybeQueueKinArrival(s, hero, 'RIVER_CLANS', s.turn - TUNING.abduction.grimWarningThresholdTurns + 1, new Rng(1));
    expect(s.queuedEvents).toHaveLength(0);
  });

  it('always attributes RIVER_CLANS kin to kiswani heritage', () => {
    let queued = false;
    for (let seed = 1; seed <= 40 && !queued; seed++) {
      const s = testState(seed);
      const hero = s.heroes[0];
      maybeQueueKinArrival(
        s,
        hero,
        'RIVER_CLANS',
        s.turn - TUNING.abduction.grimWarningThresholdTurns,
        new Rng(seed),
      );
      const entry = s.queuedEvents.find((q) => q.eventId === 'captive_kin_arrival');
      if (entry) {
        queued = true;
        expect(entry.vars?.captorHeritage).toBe('kiswani');
      }
    }
    expect(queued).toBe(true);
  });

  it('splits BEASTFOLK kin between orc and goblin heritage across seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80 && seen.size < 2; seed++) {
      const s = testState(seed);
      const hero = s.heroes[0];
      maybeQueueKinArrival(
        s,
        hero,
        'BEASTFOLK',
        s.turn - TUNING.abduction.grimWarningThresholdTurns,
        new Rng(seed),
      );
      const entry = s.queuedEvents.find((q) => q.eventId === 'captive_kin_arrival');
      const heritage = entry?.vars?.captorHeritage;
      if (heritage === 'orc' || heritage === 'goblin') seen.add(heritage);
    }
    expect(seen).toEqual(new Set(['orc', 'goblin']));
  });
});

describe('incoming raid capture (raids.ts hook)', () => {
  function sackedRaid(s: GameState, faction: PendingIncomingRaid['faction']): void {
    s.pendingRaid = {
      kind: 'incoming',
      faction,
      severity: 'warband',
      attackerForce: 120,
      attackerManeuver: 'charge',
      spotted: false,
      band: 'a raiding party',
    };
  }

  it('a male hero can be captured instead of wounded/killed by a risky faction, across enough seeds', () => {
    let capturedAny = false;
    for (let seed = 1; seed <= 60 && !capturedAny; seed++) {
      const s = withGenders(seed);
      sackedRaid(s, 'RIVER_CLANS');
      resolveIncomingRaid(s, { goal: 'hold', maneuver: 'evade' }, new Rng(seed), RAID_CTX);
      if (s.heroes.some((h) => h.status === 'captive')) capturedAny = true;
    }
    expect(capturedAny).toBe(true);
  });

  it('never captures a female hero, regardless of seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = withGenders(seed);
      sackedRaid(s, 'RIVER_CLANS');
      resolveIncomingRaid(s, { goal: 'hold', maneuver: 'evade' }, new Rng(seed), RAID_CTX);
      const { females } = malesAndFemales(s);
      expect(females.every((h) => h.status !== 'captive')).toBe(true);
    }
  });

  it('never captures for a non-risky aggressor faction', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = withGenders(seed);
      sackedRaid(s, 'HILL_TRIBES');
      resolveIncomingRaid(s, { goal: 'hold', maneuver: 'evade' }, new Rng(seed), RAID_CTX);
      expect(s.heroes.every((h) => h.status !== 'captive')).toBe(true);
    }
  });
});

describe('checkBrokenCompany does not treat captive as lost (turn.ts)', () => {
  it('an all-captive roster does not end the game', () => {
    const s = testState();
    for (const h of s.heroes) {
      h.status = 'captive';
      h.captivity = { faction: 'RIVER_CLANS', capturedTurn: 1 };
    }
    advanceTurn(s);
    expect(s.gameOver).toBeNull();
  });

  it('an all-dead-or-departed roster still ends the game', () => {
    const s = testState();
    for (const h of s.heroes) h.status = 'dead';
    advanceTurn(s);
    expect(s.gameOver?.kind).toBe('brokenCompany');
  });
});

describe('pinned captivity chain events survive resolveTurn (selection.ts/turn.ts fixes)', () => {
  it('a not-yet-due pinned event on a captive hero is not pruned', () => {
    const s = testState();
    const hero = s.heroes[0];
    hero.status = 'captive';
    hero.captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn };
    s.queuedEvents.push({
      eventId: 'captive_check_in',
      fireOnTurn: s.turn + 5,
      heroId: hero.id,
      vars: { faction: 'RIVER_CLANS' },
    });
    resolveTurn(s, TEST_CONTENT);
    expect(s.queuedEvents.some((q) => q.eventId === 'captive_check_in' && q.heroId === hero.id)).toBe(
      true,
    );
  });

  it('a due pinned event on a captive hero fires and binds to them', () => {
    const s = testState();
    const hero = s.heroes[0];
    hero.status = 'captive';
    hero.captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn };
    s.queuedEvents.push({
      eventId: 'captive_quick_release',
      fireOnTurn: s.turn,
      heroId: hero.id,
    });
    const selected = selectEvents(s, TEST_CONTENT.events, TEST_CONTENT.locationDefs, new Rng(1));
    expect(selected.some((e) => e.eventId === 'captive_quick_release' && e.heroId === hero.id)).toBe(
      true,
    );
  });
});

describe('expedition-arrival abduction risk (captivity.ts / expeditions.ts hook)', () => {
  function expeditionAt(overrides: Partial<ExpeditionState> = {}): ExpeditionState {
    return {
      id: 'exp_abduct',
      kind: 'caravan',
      destination: 'river_meet',
      target: DEFS.get('river_meet')!.mapPoint,
      pace: 'normal',
      legTurns: 1,
      heroIds: ['p1'],
      leg: 'outbound',
      turnsLeft: 0,
      cargo: {},
      silver: 0,
      buyOrders: {},
      ...overrides,
    };
  }

  it('never rolls for a non-risky destination', () => {
    const s = withGenders();
    const def = DEFS.get('old_road')!; // no faction, not tagged beastfolk
    for (let seed = 1; seed <= 30; seed++) {
      expect(rollAbductionRisk(s, expeditionAt(), def, new Rng(seed))).toBeNull();
    }
  });

  it('is skipped entirely for a rescue-goal raid expedition', () => {
    const s = withGenders();
    const def = DEFS.get('river_meet')!;
    const exp = expeditionAt({ kind: 'raid', raidGoal: 'rescue' });
    for (let seed = 1; seed <= 30; seed++) {
      expect(rollAbductionRisk(s, exp, def, new Rng(seed))).toBeNull();
    }
  });

  it('more escorted guards reduce (never increase) the number of captures over many seeds', () => {
    const def = DEFS.get('river_meet')!;
    let hitsNoGuards = 0;
    let hitsManyGuards = 0;
    const trials = 300;
    for (let seed = 1; seed <= trials; seed++) {
      const sNo = withGenders(seed);
      if (rollAbductionRisk(sNo, expeditionAt({ heroIds: ['p1'] }), def, new Rng(seed))) hitsNoGuards++;

      const sMany = withGenders(seed);
      const escorted = expeditionAt({ heroIds: ['p1'], residentEscort: { guards: 20 } });
      if (rollAbductionRisk(sMany, escorted, def, new Rng(seed))) hitsManyGuards++;
    }
    expect(hitsNoGuards).toBeGreaterThan(0);
    expect(hitsManyGuards).toBeLessThanOrEqual(hitsNoGuards);
  });

  it('BEASTFOLK territory rolls captures more readily than RIVER_CLANS, per the per-faction TUNING override', () => {
    const beastWilds = DEFS.get('beast_wilds')!;
    const riverMeet = DEFS.get('river_meet')!;
    let beastHits = 0;
    let riverHits = 0;
    const trials = 400;
    for (let seed = 1; seed <= trials; seed++) {
      const sBeast = withGenders(seed);
      if (rollAbductionRisk(sBeast, expeditionAt(), beastWilds, new Rng(seed))) beastHits++;

      const sRiver = withGenders(seed);
      if (rollAbductionRisk(sRiver, expeditionAt({ destination: 'river_meet' }), riverMeet, new Rng(seed)))
        riverHits++;
    }
    expect(beastHits).toBeGreaterThan(riverHits);
  });
});

describe('the ransom diplomacy mission', () => {
  it('dispatchError blocks ransom when the faction holds no captive', () => {
    const s = testState();
    const reason = dispatchError(
      s,
      { kind: 'diplomacy', destination: 'river_meet', heroIds: ['p2'], diplomacyMission: { type: 'ransom' } },
      DEFS,
    );
    expect(reason).toMatch(/no one of yours held/i);
  });

  it('dispatchError allows ransom once the faction holds a captive', () => {
    const s = testState();
    s.heroes[0].status = 'captive';
    s.heroes[0].captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn };
    const reason = dispatchError(
      s,
      { kind: 'diplomacy', destination: 'river_meet', heroIds: ['p2'], diplomacyMission: { type: 'ransom' } },
      DEFS,
    );
    expect(reason).toBeNull();
  });

  it('a successful ransom frees a recently-captured hero (never refuses — turnsHeld is far under threshold)', () => {
    let freed = false;
    for (let seed = 1; seed <= 50 && !freed; seed++) {
      const trial = testState(2020);
      const trialCaptive = trial.heroes.find((h) => h.id === 'p1')!;
      trialCaptive.status = 'captive';
      trialCaptive.captivity = { faction: 'RIVER_CLANS', capturedTurn: trial.turn };
      const trialEnvoy = trial.heroes.find((h) => h.id === 'p2')!;
      trialEnvoy.skills.diplomacy = 5;
      trialEnvoy.stats.charm = 5;
      dispatchExpedition(
        trial,
        { kind: 'diplomacy', destination: 'river_meet', heroIds: ['p2'], diplomacyMission: { type: 'ransom' } },
        DEFS,
      );
      const exp = trial.expeditions[0];
      exp.turnsLeft = 0;
      advanceExpeditions(trial, TEST_CONTENT, new Rng(seed), () => undefined);
      const after = trial.heroes.find((h) => h.id === 'p1')!;
      expect(after.status).not.toBe('departed');
      if (after.status === 'active') freed = true;
    }
    expect(freed).toBe(true);
  });

  it('waiting past the refuse-return threshold can end in the hero declining to come home', () => {
    let sawDeparted = false;
    let sawFreed = false;
    for (let seed = 1; seed <= 80 && !(sawDeparted && sawFreed); seed++) {
      const s = testState(seed);
      const captive = s.heroes.find((h) => h.id === 'p1')!;
      captive.status = 'captive';
      captive.captivity = {
        faction: 'RIVER_CLANS',
        capturedTurn: s.turn - TUNING.abduction.refuseReturnThresholdTurns - 1,
      };
      const envoy = s.heroes.find((h) => h.id === 'p2')!;
      envoy.skills.diplomacy = 5;
      envoy.stats.charm = 5;
      dispatchExpedition(
        s,
        { kind: 'diplomacy', destination: 'river_meet', heroIds: ['p2'], diplomacyMission: { type: 'ransom' } },
        DEFS,
      );
      s.expeditions[0].turnsLeft = 0;
      advanceExpeditions(s, TEST_CONTENT, new Rng(seed), () => undefined);
      const after = s.heroes.find((h) => h.id === 'p1')!;
      if (after.status === 'departed') sawDeparted = true;
      if (after.status === 'active') sawFreed = true;
    }
    // Both outcomes should be reachable once the threshold has passed —
    // not every successful ransom past the threshold refuses.
    expect(sawDeparted).toBe(true);
    expect(sawFreed).toBe(true);
  });
});

describe('the rescue raid goal', () => {
  function raidExpedition(overrides: Partial<ExpeditionState> = {}): ExpeditionState {
    return {
      id: 'exp_rescue',
      kind: 'raid',
      destination: 'river_meet',
      target: DEFS.get('river_meet')!.mapPoint,
      pace: 'normal',
      legTurns: 2,
      heroIds: ['p1', 'p2'],
      leg: 'outbound',
      turnsLeft: 0,
      cargo: {},
      silver: 0,
      buyOrders: {},
      residentEscort: {},
      raidGoal: 'rescue',
      raidManeuver: 'skirmish',
      raidRally: false,
      ...overrides,
    };
  }

  it('dispatchError blocks a rescue raid when the target holds no captive', () => {
    const s = testState();
    const reason = dispatchError(
      s,
      { kind: 'raid', destination: 'river_meet', heroIds: ['p1'], raidGoal: 'rescue' },
      DEFS,
    );
    expect(reason).toMatch(/no one of yours held/i);
  });

  it('dispatchError allows a rescue raid once the target holds a captive', () => {
    const s = testState();
    s.heroes[0].status = 'captive';
    s.heroes[0].captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn };
    const reason = dispatchError(
      s,
      { kind: 'raid', destination: 'river_meet', heroIds: ['p2'], raidGoal: 'rescue' },
      DEFS,
    );
    expect(reason).toBeNull();
  });

  it('a winning rescue raid frees every captive held by the target faction', () => {
    const s = testState(910);
    const captive = s.heroes.find((h) => h.id === 'p3')!;
    captive.status = 'captive';
    captive.captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn - 3 };
    const p1 = s.heroes.find((h) => h.id === 'p1')!;
    const p2 = s.heroes.find((h) => h.id === 'p2')!;
    for (const hero of [p1, p2]) {
      hero.skills.combat = 5;
      hero.skills.leadership = 5;
      hero.skills.stealth = 5;
      hero.stats.might = 5;
      hero.stats.agility = 5;
      hero.stats.resolve = 5;
    }
    const expedition = raidExpedition();
    s.expeditions.push(expedition);

    const raid: PendingOutgoingRaid = {
      kind: 'outgoing',
      expeditionId: expedition.id,
      faction: 'RIVER_CLANS',
      targetName: 'Njaro-Matu',
      defenderForce: 1,
      defenderManeuver: 'charge',
      spotted: false,
      goal: 'rescue',
      maneuver: 'evade',
      rally: false,
    };
    const res = resolveOutgoingRaid(s, raid, { goal: 'rescue', maneuver: 'evade' }, new Rng(1), RAID_CTX);
    expect(res.outcome).toBe('rescued');
    const after = s.heroes.find((h) => h.id === 'p3')!;
    expect(after.status).toBe('active');
    expect(after.captivity).toBeUndefined();
  });

  it('a losing rescue raid leaves the captive still held', () => {
    const s = testState(911);
    const captive = s.heroes.find((h) => h.id === 'p3')!;
    captive.status = 'captive';
    captive.captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn - 3 };
    const expedition = raidExpedition({ heroIds: ['p1'] });
    s.expeditions.push(expedition);

    const raid: PendingOutgoingRaid = {
      kind: 'outgoing',
      expeditionId: expedition.id,
      faction: 'RIVER_CLANS',
      targetName: 'Njaro-Matu',
      defenderForce: 500,
      defenderManeuver: 'charge',
      spotted: true,
      goal: 'rescue',
      maneuver: 'evade',
      rally: false,
    };
    const res = resolveOutgoingRaid(s, raid, { goal: 'rescue', maneuver: 'evade' }, new Rng(1), RAID_CTX);
    expect(res.outcome).toBe('drivenOff');
    const after = s.heroes.find((h) => h.id === 'p3')!;
    expect(after.status).toBe('captive');
  });
});

describe('departCharacter / heroDeparts accept a captive hero (requirement 5 reuse)', () => {
  it('departCharacter clears captivity and marks departed', () => {
    const s = testState();
    const hero = s.heroes[0];
    hero.status = 'captive';
    hero.captivity = { faction: 'RIVER_CLANS', capturedTurn: 1 };
    expect(departCharacter(s, hero.id)).toBe(true);
    expect(hero.status).toBe('departed');
    expect(hero.captivity).toBeUndefined();
  });

  it('the heroDeparts outcome also accepts a captive hero', () => {
    const s = testState();
    const hero = s.heroes[0];
    hero.status = 'captive';
    hero.captivity = { faction: 'BEASTFOLK', capturedTurn: 1 };
    applyOutcomes(s, [{ type: 'heroDeparts' }], outcomeCtx(TEST_CONTENT, hero.id));
    expect(hero.status).toBe('departed');
    expect(hero.captivity).toBeUndefined();
  });
});

describe('the freeCaptive outcome', () => {
  it('returns a captive hero to active and clears captivity', () => {
    const s = testState();
    const hero = s.heroes[0];
    hero.status = 'captive';
    hero.captivity = { faction: 'RIVER_CLANS', capturedTurn: 1 };
    applyOutcomes(s, [{ type: 'freeCaptive' }], outcomeCtx(TEST_CONTENT, hero.id));
    expect(hero.status).toBe('active');
    expect(hero.captivity).toBeUndefined();
  });
});

describe('hasCaptiveHeldBy', () => {
  it('reflects live captivity state', () => {
    const s = testState();
    expect(hasCaptiveHeldBy(s, 'RIVER_CLANS')).toBe(false);
    s.heroes[0].status = 'captive';
    s.heroes[0].captivity = { faction: 'RIVER_CLANS', capturedTurn: s.turn };
    expect(hasCaptiveHeldBy(s, 'RIVER_CLANS')).toBe(true);
    expect(hasCaptiveHeldBy(s, 'BEASTFOLK')).toBe(false);
  });
});
