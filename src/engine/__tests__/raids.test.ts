import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import { applyOutcomes } from '../events/outcomes';
import { outcomeCtx } from '../turn';
import {
  createIncomingRaid,
  createOutgoingRaid,
  defenderForceBreakdown,
  defenderForce,
  eligibleAggressors,
  raidChance,
  raidEligible,
  raidingForceBreakdown,
  resolveIncomingRaid,
  resolveOutgoingRaid,
  tributeFor,
} from '../raids';
import { addResidents } from '../residents';
import { Rng } from '../rng';
import type { GameState, PendingIncomingRaid } from '../types';
import { GOOD_IDS } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const RAID_CTX = {
  goodDefs: TEST_CONTENT.goodDefs,
  goodNames: TEST_CONTENT.goodNames,
  buildingNames: TEST_CONTENT.buildingNames,
};

/** A hostile Beastfolk neighbour past the grace period — an eligible aggressor. */
function angryPost(seed = 4242): GameState {
  const s = testState(seed);
  s.turn = TUNING.raid.graceTurns + 2;
  s.factions.BEASTFOLK.standing = -60;
  return s;
}

describe('raid force selectors', () => {
  it('defenderForce rises with guards and walls', () => {
    const s = testState();
    const base = defenderForce(s);
    addResidents(s, 'guards', 4, undefined, 'homeland');
    expect(defenderForce(s)).toBeGreaterThan(base);
  });

  it('breaks out resident and escort contributions for raid views', () => {
    const s = testState();
    addResidents(s, 'guards', 2, undefined, 'homeland');
    addResidents(s, 'idle', 2, undefined, 'homeland');
    const defend = defenderForceBreakdown(s);
    expect(defend.guards).toBeGreaterThan(0);
    expect(defend.muster).toBeGreaterThan(0);

    const expedition = {
      id: 'exp_breakdown',
      kind: 'raid' as const,
      destination: 'river_meet',
      target: TEST_CONTENT.locationDefs.get('river_meet')!.mapPoint,
      pace: 'normal' as const,
      legTurns: 2,
      heroIds: ['p1', 'p2'],
      leg: 'outbound' as const,
      turnsLeft: 2,
      cargo: {},
      silver: 0,
      buyOrders: {},
      residentEscort: { guards: 1, porters: 1 },
      raidGoal: 'plunder' as const,
      raidManeuver: 'skirmish' as const,
      raidRally: false,
    };
    s.expeditions.push(expedition);

    const attack = raidingForceBreakdown(s, expedition);
    expect(attack.guards).toBeGreaterThan(0);
    expect(attack.porters).toBe(1);
    expect(attack.cargoCapacity).toBeGreaterThan(0);
  });
});

describe('the notoriety arc (eligibility)', () => {
  it('no raid is possible during the grace period', () => {
    const s = testState();
    s.factions.BEASTFOLK.standing = -60;
    s.turn = TUNING.raid.graceTurns - 1;
    expect(raidEligible(s)).toBe(false);
  });

  it('a hostile neighbour becomes an eligible aggressor after grace', () => {
    const s = angryPost();
    expect(eligibleAggressors(s)).toContain('BEASTFOLK');
    expect(raidEligible(s)).toBe(true);
    expect(raidChance(s, 0)).toBeGreaterThan(0);
  });

  it('the cooldown blocks back-to-back raids', () => {
    const s = angryPost();
    s.lastRaidTurn = s.turn; // just raided
    expect(raidEligible(s)).toBe(false);
  });

  it('tribute buys peace even from a hostile neighbour', () => {
    const s = angryPost();
    applyOutcomes(s, [{ type: 'tribute', faction: 'BEASTFOLK', direction: 'pay', silver: 10 }], outcomeCtx(TEST_CONTENT, s.heroes[0].id));
    expect(eligibleAggressors(s)).not.toContain('BEASTFOLK');
    expect(tributeFor(s, 'BEASTFOLK')?.direction).toBe('pay');
  });

  it('createIncomingRaid draws from the angriest aggressor', () => {
    const s = angryPost();
    const raid = createIncomingRaid(s, new Rng(1));
    expect(raid).not.toBeNull();
    expect(raid!.faction).toBe('BEASTFOLK');
    expect(raid!.attackerForce).toBeGreaterThan(0);
  });
});

describe('battle resolution', () => {
  function withRaid(s: GameState, patch: Partial<PendingIncomingRaid>): void {
    s.pendingRaid = {
      kind: 'incoming',
      faction: 'BEASTFOLK',
      severity: 'raid',
      attackerForce: 8,
      attackerManeuver: 'charge',
      spotted: true,
      band: 'an orc war-band',
      ...patch,
    };
  }

  it('a strong wall repels a small raid with no loss', () => {
    const s = angryPost();
    addResidents(s, 'guards', 12, undefined, 'homeland'); // a wall of spears
    withRaid(s, { attackerForce: 1, severity: 'probe' });
    const silverBefore = s.silver;
    const res = resolveIncomingRaid(s, { goal: 'driveoff', maneuver: 'skirmish' }, new Rng(7), RAID_CTX);
    expect(res.outcome).toBe('repelled');
    expect(s.pendingRaid).toBeNull();
    expect(s.silver).toBe(silverBefore); // nothing carried off
  });

  it('an overwhelming raid sacks the post and carries off wealth', () => {
    const s = angryPost();
    withRaid(s, { attackerForce: 120, severity: 'warband', spotted: false });
    const silverBefore = s.silver;
    const res = resolveIncomingRaid(s, { goal: 'hold', maneuver: 'evade' }, new Rng(9), RAID_CTX);
    expect(res.outcome).toBe('sacked');
    expect(s.silver).toBeLessThan(silverBefore);
    expect(s.lastSackedTurn).toBe(s.turn);
  });
});

describe('the destroyed cascade (RAIDING_SPEC.md §7.1)', () => {
  function hollow(s: GameState): void {
    s.silver = 0;
    for (const g of GOOD_IDS) s.goods[g] = 0;
    // no residents at all — well under the floor
    s.pendingRaid = {
      kind: 'incoming',
      faction: 'BEASTFOLK',
      severity: 'warband',
      attackerForce: 120,
      attackerManeuver: 'charge',
      spotted: false,
      band: 'an orc war-band',
    };
  }

  it('a first sack of a hollow post is survivable', () => {
    const s = angryPost();
    hollow(s);
    s.lastSackedTurn = 0; // never sacked before
    const res = resolveIncomingRaid(s, { goal: 'hold', maneuver: 'evade' }, new Rng(3), RAID_CTX);
    expect(res.outcome).toBe('sacked');
    expect(res.gameOver).toBe(false);
    expect(s.gameOver).toBeNull();
  });

  it('a second sack in quick succession destroys the post', () => {
    const s = angryPost();
    hollow(s);
    s.lastSackedTurn = s.turn - 2; // sacked recently
    const res = resolveIncomingRaid(s, { goal: 'hold', maneuver: 'evade' }, new Rng(3), RAID_CTX);
    expect(res.outcome).toBe('sacked');
    expect(res.gameOver).toBe(true);
    expect(s.gameOver?.kind).toBe('destroyed');
    expect(s.phase).toBe('gameover');
  });
});

describe('outgoing raid encounters', () => {
  it('queues an outgoing raid with pre-rolled opposition at the target', () => {
    const s = testState(909);
    const expedition = {
      id: 'exp_1',
      kind: 'raid' as const,
      destination: 'river_meet',
      target: TEST_CONTENT.locationDefs.get('river_meet')!.mapPoint,
      pace: 'normal' as const,
      legTurns: 2,
      heroIds: ['p1', 'p2'],
      leg: 'outbound' as const,
      turnsLeft: 0,
      cargo: {},
      silver: 0,
      buyOrders: {},
      residentEscort: { guards: 1 },
      raidGoal: 'plunder' as const,
      raidManeuver: 'skirmish' as const,
      raidRally: false,
    };
    s.expeditions.push(expedition);

    const raid = createOutgoingRaid(
      s,
      expedition,
      TEST_CONTENT.locationDefs.get('river_meet')!,
      new Rng(12),
    );

    expect(raid).not.toBeNull();
    expect(raid?.kind).toBe('outgoing');
    expect(raid?.targetName).toBe(TEST_CONTENT.locationDefs.get('river_meet')!.name);
    expect(raid?.defenderForce).toBeGreaterThan(0);
  });

  it('resolves an outgoing raid and sends survivors home', () => {
    const s = testState(910);
    const p1 = s.heroes.find((hero) => hero.id === 'p1')!;
    const p2 = s.heroes.find((hero) => hero.id === 'p2')!;
    for (const hero of [p1, p2]) {
      hero.skills.combat = 5;
      hero.skills.leadership = 5;
      hero.skills.stealth = 5;
      hero.stats.might = 5;
      hero.stats.agility = 5;
      hero.stats.resolve = 5;
    }
    const expedition = {
      id: 'exp_1',
      kind: 'raid' as const,
      destination: 'river_meet',
      target: TEST_CONTENT.locationDefs.get('river_meet')!.mapPoint,
      pace: 'normal' as const,
      legTurns: 2,
      heroIds: ['p1', 'p2'],
      leg: 'outbound' as const,
      turnsLeft: 0,
      cargo: {},
      silver: 0,
      buyOrders: {},
      residentEscort: { guards: 2 },
      raidGoal: 'cow' as const,
      raidManeuver: 'skirmish' as const,
      raidRally: true,
      raidAlly: 'CHARTER_COMPANY' as const,
    };
    s.expeditions.push(expedition);
    s.pendingRaid = createOutgoingRaid(
      s,
      expedition,
      TEST_CONTENT.locationDefs.get('river_meet')!,
      new Rng(3),
    );

    expect(s.pendingRaid?.kind).toBe('outgoing');
    const res = resolveOutgoingRaid(
      s,
      s.pendingRaid!,
      { goal: 'cow', maneuver: 'skirmish', rally: true },
      new Rng(4),
      RAID_CTX,
    );

    expect(res.direction).toBe('outgoing');
    expect(s.pendingRaid).toBeNull();
    expect(s.expeditions[0].leg).toBe('returning');
    expect(s.expeditions[0].turnsLeft).toBeGreaterThan(0);
  });
});

describe('the startRaid outcome', () => {
  it('queues an incoming raid the player must defend', () => {
    const s = angryPost();
    const rng = new Rng(11);
    applyOutcomes(s, [{ type: 'startRaid', faction: 'BEASTFOLK' }], {
      ...outcomeCtx(TEST_CONTENT, s.heroes[0].id),
      rng,
    });
    expect(s.pendingRaid).not.toBeNull();
    expect(s.pendingRaid!.faction).toBe('BEASTFOLK');
    expect(s.pendingRaid!.kind).toBe('incoming');
    expect(s.lastRaidTurn).toBe(s.turn);
  });

  it('can also establish a tribute oath', () => {
    const s = angryPost();
    applyOutcomes(
      s,
      [{ type: 'tribute', faction: 'BEASTFOLK', direction: 'receive', silver: 18 }],
      outcomeCtx(TEST_CONTENT, s.heroes[0].id),
    );
    expect(tributeFor(s, 'BEASTFOLK')).toEqual({
      faction: 'BEASTFOLK',
      direction: 'receive',
      silver: 18,
      goods: {},
    });
  });
});
