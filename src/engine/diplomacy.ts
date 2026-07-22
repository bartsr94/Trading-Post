import { TUNING } from '../content/tuning';
import { clamp, stanceOf } from './types';
import type {
  DiplomacySeatState,
  DiscoveryState,
  FactionId,
  GameState,
  LocationDef,
  LocationId,
  TributeRelationship,
} from './types';

export function isDiplomacySeat(def: LocationDef): boolean {
  return def.faction !== undefined;
}

/** True when `def` is a settlement worth a first-contact moment — any market
 *  town, faction-seated or not (e.g. neutral-ground Umoja-Njema). The home
 *  post itself is excluded. */
export function isCommunity(def: LocationDef): boolean {
  return def.hasMarket && def.id !== TUNING.map.homeLocationId;
}

/** True when `def` is a community being contacted for the first time —
 *  i.e. its discovery is advancing past `unknown`/`rumored`
 *  (DIPLOMACY_DISCOVERY_SPEC.md §3). A community with no faction still fires
 *  the event but never accrues standing/grievances — first contact there is
 *  a one-time flavor beat, not the start of a tracked relationship. */
export function isFirstContact(def: LocationDef, priorDiscovery: DiscoveryState): boolean {
  return isCommunity(def) && (priorDiscovery === 'unknown' || priorDiscovery === 'rumored');
}

/** Queues the generic first-contact event for `def`, bound to `heroId`. */
export function queueFirstContact(state: GameState, def: LocationDef, heroId: string): void {
  state.queuedEvents.push({
    eventId: TUNING.diplomacy.firstContactEventId,
    fireOnTurn: state.turn,
    heroId,
    locationId: def.id,
  });
}

export function diplomacySeatDefs(defs: Iterable<LocationDef>): LocationDef[] {
  return [...defs].filter(isDiplomacySeat);
}

export function createDiplomacySeatStates(
  defs: readonly LocationDef[],
  startingStandings: Partial<Record<FactionId, number>> = {},
): Record<LocationId, DiplomacySeatState> {
  const seats: Record<LocationId, DiplomacySeatState> = {};
  for (const def of defs) {
    if (!def.faction) continue;
    seats[def.id] = {
      faction: def.faction,
      standing: def.startingStanding ?? startingStandings[def.faction] ?? 0,
      grievances: 0,
      pact: 'none',
      lastContactTurn: 0,
    };
  }
  return seats;
}

export function ensureDiplomacySeat(
  state: GameState,
  def: Pick<LocationDef, 'id' | 'faction'>,
): DiplomacySeatState {
  const existing = state.diplomacySeats[def.id];
  if (existing) {
    if (def.faction && existing.faction !== def.faction) existing.faction = def.faction;
    return existing;
  }
  if (!def.faction) throw new Error(`Cannot create diplomacy seat ${def.id} without a faction.`);
  const created: DiplomacySeatState = {
    faction: def.faction,
    standing: state.factions[def.faction]?.standing ?? 0,
    grievances: 0,
    pact: 'none',
    lastContactTurn: 0,
  };
  state.diplomacySeats[def.id] = created;
  return created;
}

export function diplomacySeatState(
  state: GameState,
  def: Pick<LocationDef, 'id' | 'faction'>,
): DiplomacySeatState {
  const seat = state.diplomacySeats[def.id];
  if (seat) return seat;
  if (!def.faction) throw new Error(`Cannot read diplomacy seat ${def.id} without a faction.`);
  return {
    faction: def.faction,
    standing: state.factions[def.faction]?.standing ?? 0,
    grievances: 0,
    pact: 'none',
    lastContactTurn: 0,
  };
}

export function diplomacySeatStateById(
  state: GameState,
  seatId: LocationId,
): DiplomacySeatState | undefined {
  return state.diplomacySeats[seatId];
}

export function diplomacySeatsForFaction(
  state: GameState,
  faction: FactionId,
): [LocationId, DiplomacySeatState][] {
  return (Object.entries(state.diplomacySeats) as [LocationId, DiplomacySeatState][])
    .filter(([, seat]) => seat.faction === faction);
}

function scaledDelta(delta: number, factor: number): number {
  return Math.round(delta * factor);
}

export function effectiveDiplomacyStanding(
  state: GameState,
  seat: Pick<DiplomacySeatState, 'faction' | 'standing'>,
): number {
  return clamp(
    seat.standing +
      scaledDelta(state.factions[seat.faction]?.standing ?? 0, TUNING.diplomacy.factionSentimentShare),
    -100,
    100,
  );
}

export function applyDiplomacyShiftById(
  state: GameState,
  seatId: LocationId,
  delta: number,
  grievanceDelta = 0,
): void {
  const seat = state.diplomacySeats[seatId];
  if (!seat) return;
  seat.standing = clamp(seat.standing + delta, -100, 100);
  seat.grievances = Math.max(0, seat.grievances + grievanceDelta);
  seat.lastContactTurn = state.turn;

  const factionDelta = scaledDelta(delta, TUNING.diplomacy.factionSentimentShare);
  if (factionDelta !== 0) {
    state.factions[seat.faction].standing = clamp(
      state.factions[seat.faction].standing + factionDelta,
      -100,
      100,
    );
  }

  const siblingDelta = scaledDelta(delta, TUNING.diplomacy.siblingSpilloverShare);
  if (siblingDelta !== 0) {
    for (const [siblingId, siblingSeat] of Object.entries(state.diplomacySeats) as [
      LocationId,
      DiplomacySeatState,
    ][]) {
      if (siblingId === seatId || siblingSeat.faction !== seat.faction) continue;
      siblingSeat.standing = clamp(siblingSeat.standing + siblingDelta, -100, 100);
    }
  }
}

export function applyDiplomacyShift(
  state: GameState,
  locationDefs: ReadonlyMap<LocationId, LocationDef>,
  seatId: LocationId,
  delta: number,
  grievanceDelta = 0,
): void {
  const def = locationDefs.get(seatId);
  if (!def || !def.faction) return;
  ensureDiplomacySeat(state, def);
  for (const sibling of locationDefs.values()) {
    if (sibling.faction !== def.faction) continue;
    ensureDiplomacySeat(state, sibling);
  }
  applyDiplomacyShiftById(state, seatId, delta, grievanceDelta);
}

export function setDiplomacyPact(
  state: GameState,
  def: Pick<LocationDef, 'id' | 'faction'>,
  pact: DiplomacySeatState['pact'],
): void {
  const seat = ensureDiplomacySeat(state, def);
  seat.pact = pact;
  seat.lastContactTurn = state.turn;
}

export function setDiplomacyPactById(
  state: GameState,
  seatId: LocationId,
  pact: DiplomacySeatState['pact'],
): void {
  const seat = state.diplomacySeats[seatId];
  if (!seat) return;
  seat.pact = pact;
  seat.lastContactTurn = state.turn;
}

export function tributeForCommunity(
  state: GameState,
  def: Pick<LocationDef, 'faction'>,
): TributeRelationship | undefined {
  return def.faction ? state.tributes.find((tribute) => tribute.faction === def.faction) : undefined;
}

export function diplomacyReasons(
  state: GameState,
  def: Pick<LocationDef, 'id' | 'faction' | 'name'>,
): string[] {
  const seat = diplomacySeatState(state, def);
  const reasons: string[] = [];
  if (seat.pact === 'alliance') reasons.push('Bound by an alliance.');
  else if (seat.pact === 'truce') reasons.push('A truce is currently holding.');

  if (seat.grievances >= TUNING.diplomacy.grievanceWarningThreshold) {
    reasons.push('Old affronts are still remembered.');
  }

  const tribute = tributeForCommunity(state, def);
  if (tribute) {
    reasons.push(
      tribute.direction === 'pay'
        ? 'Tribute keeps the peace uneasy.'
        : 'Tribute is being drawn from their wider faction.',
    );
  }

  if (def.faction) {
    const factionStance = stanceOf(state.factions[def.faction].standing);
    if (factionStance === 'Friendly' || factionStance === 'Allied') {
      reasons.push('Their wider faction looks kindly on the post.');
    } else if (factionStance === 'Hostile' || factionStance === 'Wary') {
      reasons.push('Their wider faction is suspicious of the post.');
    }
  }

  if (seat.lastContactTurn > 0) {
    const turnsAgo = state.turn - seat.lastContactTurn;
    reasons.push(
      turnsAgo <= 1 ? 'An envoy has dealt with them recently.' : `Your last envoy called ${turnsAgo} turns ago.`,
    );
  }

  if (reasons.length === 0) reasons.push('No recent envoy has shaped this relationship yet.');
  return reasons;
}
