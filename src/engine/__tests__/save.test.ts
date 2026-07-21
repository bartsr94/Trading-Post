import { describe, expect, it } from 'vitest';
import { deserialize, migrate, serialize } from '../save';
import type { GameState } from '../types';
import { TEST_LOCATIONS, testState } from './helpers';

describe('saves', () => {
  it('round-trips the full game state through JSON', () => {
    const s = testState(2024);
    s.turn = 9;
    s.flags.odd_hired = true;
    s.queuedEvents.push({ eventId: 'post_amber_find', fireOnTurn: 11, heroId: 'p3' });
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('rejects garbage', () => {
    expect(() => deserialize('{"hello":"world"}')).toThrow();
    expect(() => deserialize('not json')).toThrow();
  });

  it('rejects saves from a newer game version', () => {
    const s = testState();
    s.saveVersion = 999;
    expect(() => migrate(s)).toThrow(/newer/);
  });

  it('has no migration gaps from unknown old versions', () => {
    const s = testState();
    s.saveVersion = 0;
    expect(() => migrate(s)).toThrow(/No migration path/);
  });

  it('migrates v1 saves all the way to current: map + residents + roster added, everything else intact', () => {
    const v1 = testState(555) as Partial<GameState>;
    delete v1.locations;
    delete v1.expeditions;
    delete v1.nextExpeditionId;
    delete v1.charterMissedStreak;
    delete v1.residents;
    delete v1.transients;
    delete v1.nextTransientId;
    delete v1.activePartyIds;
    delete v1.dependants;
    delete v1.nextDependantId;
    delete v1.buildings;
    delete v1.construction;
    delete (v1 as Partial<GameState>).charterCompromisedStreak;
    v1.saveVersion = 1;
    v1.silver = 123;

    const migrated = deserialize(JSON.stringify(v1), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.silver).toBe(123);
    expect(migrated.expeditions).toEqual([]);
    expect(migrated.locations.river_meet.discovery).toBe('visited');
    expect(migrated.locations.river_meet.market).toBeDefined();
    expect(migrated.charterMissedStreak).toBe(0);
    expect(migrated.residents.roles.farmers).toBe(0);
    expect(migrated.transients).toEqual([]);
    // Every living hero becomes the active party.
    expect(migrated.activePartyIds).toEqual(migrated.heroes.map((h) => h.id));
    expect(migrated.dependants).toEqual([]);
    expect(migrated.buildings).toEqual([]);
    expect(migrated.construction).toBeNull();
    // v7 heritage system.
    expect(migrated.axes.culture).toBe(0);
    expect(migrated.charterCompromisedStreak).toBe(0);
    expect(migrated.residents.heritage).toEqual({ homeland: 0, native: 0 });
    expect(migrated.heroes.every((h) => h.heritage !== undefined)).toBe(true);
  });

  it('migrates v2 saves: Charter quota clock + residents added, everything else intact', () => {
    const v2 = testState(556) as Partial<GameState>;
    delete v2.charterMissedStreak;
    delete v2.residents;
    delete v2.transients;
    delete v2.nextTransientId;
    delete v2.activePartyIds;
    delete v2.dependants;
    delete v2.nextDependantId;
    delete v2.buildings;
    delete v2.construction;
    v2.saveVersion = 2;
    v2.silver = 77;

    const migrated = deserialize(JSON.stringify(v2), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.silver).toBe(77);
    expect(migrated.charterMissedStreak).toBe(0);
    expect(migrated.residents.contentment).toBeGreaterThan(0);
  });

  it('migrates v3 saves: resident population added, everything else intact', () => {
    const v3 = testState(557) as Partial<GameState>;
    delete v3.residents;
    delete v3.transients;
    delete v3.nextTransientId;
    delete v3.activePartyIds;
    delete v3.dependants;
    delete v3.nextDependantId;
    delete v3.buildings;
    delete v3.construction;
    v3.saveVersion = 3;
    v3.silver = 88;

    const migrated = deserialize(JSON.stringify(v3), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.silver).toBe(88);
    expect(migrated.residents.idle).toBe(0);
    expect(migrated.nextTransientId).toBe(1);
  });

  it('migrates v4 saves: active-party roster + dependant layer added, everything else intact', () => {
    const v4 = testState(558) as Partial<GameState>;
    delete v4.activePartyIds;
    delete v4.dependants;
    delete v4.nextDependantId;
    delete v4.buildings;
    delete v4.construction;
    v4.saveVersion = 4;
    v4.silver = 99;

    const migrated = deserialize(JSON.stringify(v4), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.silver).toBe(99);
    expect(migrated.activePartyIds).toEqual(migrated.heroes.map((h) => h.id));
    expect(migrated.dependants).toEqual([]);
    expect(migrated.nextDependantId).toBe(1);
  });

  it('migrates v5 saves: buildings + construction slot added, everything else intact', () => {
    const v5 = testState(559) as Partial<GameState>;
    delete v5.buildings;
    delete v5.construction;
    v5.saveVersion = 5;
    v5.silver = 111;

    const migrated = deserialize(JSON.stringify(v5), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.silver).toBe(111);
    expect(migrated.buildings).toEqual([]);
    expect(migrated.construction).toBeNull();
    expect(migrated.postTier).toBe(1);
  });

  it('migrates v6 saves: heritage system added; residents backfill homeland, heroes from ctx', () => {
    const v6 = testState(560) as Partial<GameState>;
    if (v6.axes) delete (v6.axes as Partial<GameState['axes']>).culture;
    delete (v6 as Partial<GameState>).charterCompromisedStreak;
    if (v6.residents) delete (v6.residents as Partial<GameState['residents']>).heritage;
    // Pretend the old pool had no heritage stamped on the runtime heroes.
    v6.heroes = v6.heroes!.map((h) => {
      const copy = { ...h } as Partial<GameState['heroes'][number]>;
      delete copy.heritage;
      return copy as GameState['heroes'][number];
    });
    v6.residents!.roles.farmers = 3;
    v6.saveVersion = 6;

    const heroHeritage = new Map([['p4', 'kiswani'], ['p5', 'hanjoda']] as const);
    const migrated = deserialize(JSON.stringify(v6), {
      locationDefs: TEST_LOCATIONS,
      heroHeritage,
    });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.axes.culture).toBe(0);
    expect(migrated.charterCompromisedStreak).toBe(0);
    // Pre-feature residents are treated as homeland founders.
    expect(migrated.residents.heritage).toEqual({ homeland: 3, native: 0 });
    // Hero heritage comes from the injected map; unknown ids default to imanian.
    expect(migrated.heroes.find((h) => h.id === 'p4')!.heritage).toBe('kiswani');
    expect(migrated.heroes.find((h) => h.id === 'p5')!.heritage).toBe('hanjoda');
    expect(migrated.heroes.find((h) => h.id === 'p1')!.heritage).toBe('imanian');
  });

  it('migrates v7 saves: families added; gender backfilled, recruit counter seeded, dependants enriched', () => {
    const v7 = testState(561) as Partial<GameState>;
    delete (v7 as Partial<GameState>).nextCharacterId;
    // Pretend the old heroes had no gender stamped on the runtime.
    v7.heroes = v7.heroes!.map((h) => {
      const copy = { ...h } as Partial<GameState['heroes'][number]>;
      delete copy.gender;
      return copy as GameState['heroes'][number];
    });
    // A pre-v8 dependant with only a single heritage and no gender/ancestry.
    v7.dependants = [
      { id: 'd1', name: 'Old One', kind: 'kin', parentId: 'p1', heritage: 'kiswani' } as GameState['dependants'][number],
    ];
    v7.saveVersion = 7;

    const heroGender = new Map([['p2', 'female'], ['p4', 'female']] as const);
    const migrated = deserialize(JSON.stringify(v7), {
      locationDefs: TEST_LOCATIONS,
      heroGender,
    });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.nextCharacterId).toBe(1);
    // Gender from the injected map; unknown ids default to male.
    expect(migrated.heroes.find((h) => h.id === 'p2')!.gender).toBe('female');
    expect(migrated.heroes.find((h) => h.id === 'p1')!.gender).toBe('male');
    // Dependant gets a default gender and ancestry derived from its heritage.
    expect(migrated.dependants[0].gender).toBe('female');
    expect(migrated.dependants[0].ancestry).toEqual({ peoples: ['kiswani'] });
  });

  it('migrates v8 saves: two-tier peoples remap + subPeople + Knights faction', () => {
    // Build a legacy v8 save as a plain object so the pre-v9 heritage strings
    // ('dustwalker'/'bejasi') are allowed past the type system.
    const v8 = JSON.parse(serialize(testState(562))) as Record<string, unknown>;
    v8.saveVersion = 8;
    const factions = v8.factions as Record<string, unknown>;
    delete factions.KNIGHTS_EIRWEN;
    const heroes = v8.heroes as Array<Record<string, unknown>>;
    const hDust = heroes.find((h) => h.id === 'p5')!;
    hDust.heritage = 'dustwalker';
    delete hDust.subPeople;
    const hBej = heroes.find((h) => h.id === 'p2')!;
    hBej.heritage = 'bejasi';
    delete hBej.subPeople;
    v8.dependants = [
      {
        id: 'd1',
        name: 'Mixed Kin',
        kind: 'kin',
        parentId: 'p1',
        gender: 'female',
        heritage: 'bejasi',
        ancestry: { peoples: ['kiswani', 'bejasi'] },
      },
    ];

    const migrated = deserialize(JSON.stringify(v8), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    // Knights of Saint Eirwen seeded neutral.
    expect(migrated.factions.KNIGHTS_EIRWEN.standing).toBe(0);
    // Dustwalker folds into the Hanjoda people; the tribe survives as subPeople.
    const p5 = migrated.heroes.find((h) => h.id === 'p5')!;
    expect(p5.heritage).toBe('hanjoda');
    expect(p5.subPeople).toBe('dustwalker');
    // Bejasi Hills folk are Kiswani; the region survives as subPeople.
    const p2 = migrated.heroes.find((h) => h.id === 'p2')!;
    expect(p2.heritage).toBe('kiswani');
    expect(p2.subPeople).toBe('bejasi_hills');
    // A [kiswani, bejasi] line collapses to a pure Kiswani line after the remap.
    expect(migrated.dependants[0].heritage).toBe('kiswani');
    expect(migrated.dependants[0].subPeople).toBe('bejasi_hills');
    expect(migrated.dependants[0].ancestry).toEqual({ peoples: ['kiswani'] });
  });

  it('migrates v10 saves: resident tags become countable (presence-only backfills to 1)', () => {
    const v10 = JSON.parse(serialize(testState(563))) as Record<string, unknown>;
    v10.saveVersion = 10;
    const residents = v10.residents as Record<string, unknown>;
    // Pre-v11 shape: a bare array of tag strings, no counts.
    residents.tags = ['kiswani', 'orc'];

    const migrated = deserialize(JSON.stringify(v10), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(11);
    expect(migrated.residents.tags).toEqual({ kiswani: 1, orc: 1 });
  });
});
