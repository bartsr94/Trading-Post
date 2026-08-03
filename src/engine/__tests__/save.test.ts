import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../save';
import { testState } from './helpers';

// The game is pre-release and carries no save-migration system: a save is
// either the current schema (round-trips) or rejected outright. These tests
// cover serialization round-trips and the validation guard.
describe('saves', () => {
  it('round-trips the full game state through JSON', () => {
    const s = testState(2024);
    s.turn = 9;
    s.flags.odd_hired = true;
    s.queuedEvents.push({ eventId: 'post_amber_find', fireOnTurn: 11, heroId: 'p3' });
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('round-trips chain-scoped vars on queued and pending events', () => {
    const s = testState(2024);
    s.queuedEvents.push({
      eventId: 'post_amber_find',
      fireOnTurn: 11,
      heroId: 'p3',
      vars: { approach: 'force', tries: 2, resolved: true },
    });
    s.pendingEvents.push({ eventId: 'post_drifter', heroId: 'p1', vars: { outcome: 'alliance' } });
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('rejects a non-primitive chain var', () => {
    const withBadVars = JSON.parse(serialize(testState())) as Record<string, unknown>;
    (withBadVars.pendingEvents as unknown[]).push({
      eventId: 'post_drifter',
      heroId: 'p1',
      vars: { bad: { nested: true } },
    });
    expect(() => deserialize(JSON.stringify(withBadVars))).toThrow(/vars/);
  });

  it('round-trips price intel and market shocks', () => {
    const s = testState(2024);
    s.locations.river_meet.priceIntel = {
      furs: { price: 8, turnSeen: 3 },
      salt: { price: 11, turnSeen: 5 },
    };
    s.marketShocks = [
      { locationId: 'charter_landing', goodId: 'salt', mod: 1.8, leadLeft: 2, turnsLeft: 5 },
      { locationId: 'river_meet', goodId: 'herbs', mod: 0.5, leadLeft: 0, turnsLeft: 3 },
    ];
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('rejects a market shock naming an unknown good', () => {
    const bad = JSON.parse(serialize(testState())) as Record<string, unknown>;
    (bad.marketShocks as unknown[]).push({
      locationId: 'river_meet',
      goodId: 'unobtainium',
      mod: 1.5,
      leadLeft: 0,
      turnsLeft: 2,
    });
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/good/);
  });

  it('rejects a price observation with a non-integer turn seen', () => {
    const bad = JSON.parse(serialize(testState())) as {
      locations: Record<string, { priceIntel?: unknown }>;
    };
    bad.locations.river_meet.priceIntel = { furs: { price: 8, turnSeen: 1.5 } };
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/turnSeen/);
  });

  it('rejects garbage', () => {
    expect(() => deserialize('{"hello":"world"}')).toThrow();
    expect(() => deserialize('not json')).toThrow();
  });

  it('rejects malformed current-version saves before they enter the store', () => {
    const missingHeroes = JSON.parse(serialize(testState())) as Record<string, unknown>;
    delete missingHeroes.heroes;
    expect(() => deserialize(JSON.stringify(missingHeroes))).toThrow(/heroes/);

    const invalidPhase = JSON.parse(serialize(testState())) as Record<string, unknown>;
    invalidPhase.phase = 'loading';
    expect(() => deserialize(JSON.stringify(invalidPhase))).toThrow(/phase/);

    const duplicateParty = testState();
    duplicateParty.activePartyIds.push(duplicateParty.activePartyIds[0]);
    expect(() => deserialize(serialize(duplicateParty))).toThrow(/activePartyIds/);

    const badHeritage = testState();
    badHeritage.residents.roles.guards = 1;
    expect(() => deserialize(serialize(badHeritage))).toThrow(/heritage/);

    const danglingSpouse = testState();
    danglingSpouse.heroes[0].spouseIds = ['not_a_real_hero'];
    expect(() => deserialize(serialize(danglingSpouse))).toThrow(/spouseIds/);

    const selfSpouse = testState();
    selfSpouse.heroes[0].spouseIds = [selfSpouse.heroes[0].id];
    expect(() => deserialize(serialize(selfSpouse))).toThrow(/spouseIds/);
  });

  it('rejects a save whose version is not the current schema', () => {
    const stale = JSON.parse(serialize(testState())) as Record<string, unknown>;
    stale.saveVersion = 1;
    expect(() => deserialize(JSON.stringify(stale))).toThrow(/current/);
  });

  it('rejects a POV hero id that references an unknown hero', () => {
    const unknownPov = testState();
    unknownPov.povHeroId = 'not_a_real_hero';
    expect(() => deserialize(serialize(unknownPov))).toThrow(/povHeroId/);
  });

  it('rejects an active POV hero missing from the active party', () => {
    const s = testState();
    s.activePartyIds = s.activePartyIds.filter((id) => id !== s.povHeroId);
    expect(() => deserialize(serialize(s))).toThrow(/povHeroId/);
  });

  it('allows a captive POV hero to be absent from the active party (reconcileRoster parity)', () => {
    const s = testState();
    const pov = s.heroes.find((h) => h.id === s.povHeroId)!;
    pov.status = 'captive';
    pov.captivity = { faction: 'RIVER_CLANS', capturedTurn: 1 };
    s.activePartyIds = s.activePartyIds.filter((id) => id !== s.povHeroId);
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('round-trips a POV hero portrait key', () => {
    const s = testState();
    const pov = s.heroes.find((h) => h.id === s.povHeroId)!;
    pov.portraitKey = 'imanian_male_02';
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('round-trips a captive hero, including captivity', () => {
    const s = testState(2024);
    const p1 = s.heroes.find((h) => h.id === 'p1')!;
    p1.status = 'captive';
    p1.captivity = { faction: 'RIVER_CLANS', capturedTurn: 3, source: 'raid' };
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('round-trips a hero-to-hero marriage (spouseIds) and temperament tags', () => {
    const s = testState(2024);
    const p1 = s.heroes.find((h) => h.id === 'p1')!;
    const p4 = s.heroes.find((h) => h.id === 'p4')!;
    p1.spouseIds = ['p4'];
    p4.spouseIds = ['p1'];
    p1.temperament = ['warm', 'steadfast'];
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });
});
