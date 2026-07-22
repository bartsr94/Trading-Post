import { describe, expect, it } from 'vitest';
import { LOCATION_DEFS } from '../../content/locations';
import { dispatchExpedition } from '../expeditions';
import { applyDiplomacyShift } from '../diplomacy';
import { deserialize, serialize } from '../save';
import { testState, TEST_LOCATIONS } from './helpers';

describe('diplomacy seats', () => {
  it('seeds per-community diplomacy state from starting faction standings', () => {
    const state = testState(700);
    expect(state.diplomacySeats.river_meet.faction).toBe('RIVER_CLANS');
    expect(state.diplomacySeats.river_meet.standing).toBe(state.factions.RIVER_CLANS.standing);
    expect(state.diplomacySeats.charter_landing.standing).toBe(state.factions.CHARTER_COMPANY.standing);
    expect(state.diplomacySeats.pemba_jasiri.pact).toBe('none');
  });

  it('applies seat shifts with sibling spillover and faction sentiment drift', () => {
    const state = testState(701);
    const beforeFaction = state.factions.HILL_TRIBES.standing;
    const beforeSeat = state.diplomacySeats.hill_fort.standing;
    const beforeSibling = state.diplomacySeats.blackstone_plateau.standing;

    applyDiplomacyShift(state, LOCATION_DEFS, 'hill_fort', 4, 1);

    expect(state.diplomacySeats.hill_fort.standing).toBe(beforeSeat + 4);
    expect(state.diplomacySeats.hill_fort.grievances).toBe(1);
    expect(state.diplomacySeats.blackstone_plateau.standing).toBe(beforeSibling + 1);
    expect(state.diplomacySeats.redsand_range.standing).toBe(beforeSibling + 1);
    expect(state.factions.HILL_TRIBES.standing).toBe(beforeFaction + 2);
  });

  it('migrates v18 saves by adding diplomacy seats and defaulting old envoys to talks', () => {
    const state = testState(702);
    dispatchExpedition(
      state,
      { kind: 'diplomacy', destination: 'river_meet', heroIds: ['p1'] },
      LOCATION_DEFS,
    );
    const legacy = JSON.parse(serialize(state)) as Record<string, unknown>;
    legacy.saveVersion = 18;
    delete legacy.diplomacySeats;
    const expedition = (legacy.expeditions as Array<Record<string, unknown>>)[0];
    delete expedition.diplomacyMission;

    const migrated = deserialize(JSON.stringify(legacy), { locationDefs: TEST_LOCATIONS });
    expect(migrated.saveVersion).toBe(20);
    expect(migrated.diplomacySeats.river_meet).toBeDefined();
    expect(migrated.diplomacySeats.river_meet.faction).toBe('RIVER_CLANS');
    expect(migrated.expeditions[0].diplomacyMission).toEqual({ type: 'talks' });
  });
});
