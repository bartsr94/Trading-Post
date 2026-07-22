import { useMemo, useState } from 'react';
import { FACTIONS, FACTION_DEFS } from '../../content/factions';
import { GOODS } from '../../content/goods';
import { LOCATION_DEFS } from '../../content/locations';
import { TUNING } from '../../content/tuning';
import {
  diplomacyReasons,
  diplomacySeatDefs,
  diplomacySeatState,
  tributeForCommunity,
} from '../../engine/diplomacy';
import { dispatchError } from '../../engine/expeditions';
import { journeyTurns } from '../../engine/map';
import { discoveryAtLeast, heroesAtPost, stanceOf } from '../../engine/types';
import type { ExpeditionPace, GameState, GoodId } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

type DiplomacyMissionChoice = 'talks' | 'gift' | 'alliance' | 'peace';

function positiveGoods(goods: Partial<Record<GoodId, number>>): Partial<Record<GoodId, number>> {
  return Object.fromEntries(
    Object.entries(goods).filter(([, qty]) => (qty ?? 0) > 0),
  ) as Partial<Record<GoodId, number>>;
}

export function DiplomacyScreen({ game }: { game: GameState }) {
  const dispatch = useGameStore((state) => state.dispatch);
  const seatDefs = useMemo(() => diplomacySeatDefs(LOCATION_DEFS.values()), []);
  const initialSeatId =
    seatDefs.find((seat) => discoveryAtLeast(game.locations[seat.id]?.discovery ?? 'unknown', 'visited'))?.id ??
    seatDefs[0]?.id ??
    null;

  const [selectedId, setSelectedId] = useState<string | null>(initialSeatId);
  const [mission, setMission] = useState<DiplomacyMissionChoice>('talks');
  const [pace, setPace] = useState<ExpeditionPace>('normal');
  const [party, setParty] = useState<string[]>([]);
  const [giftSilver, setGiftSilver] = useState(0);
  const [giftGoods, setGiftGoods] = useState<Partial<Record<GoodId, number>>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = selectedId ? LOCATION_DEFS.get(selectedId) ?? null : null;
  const selectedLoc = selected ? game.locations[selected.id] : undefined;
  const selectedSeat = selected ? diplomacySeatState(game, selected) : null;
  const available = heroesAtPost(game);
  const activeMissions = game.expeditions.filter((expedition) => expedition.kind === 'diplomacy');
  const home = LOCATION_DEFS.get(TUNING.map.homeLocationId)!;
  const grouped = FACTIONS.map((faction) => ({
    faction,
    seats: seatDefs.filter((seat) => seat.faction === faction.id),
  })).filter((group) => group.seats.length > 0);
  const oneWay = selected ? journeyTurns(home.mapPoint, selected.mapPoint, pace) : null;
  const canReachSelected =
    selectedLoc !== undefined && discoveryAtLeast(selectedLoc.discovery, 'visited');

  const toggleHero = (heroId: string) => {
    setError(null);
    setParty((current) =>
      current.includes(heroId)
        ? current.filter((id) => id !== heroId)
        : current.length < TUNING.map.maxExpeditionHeroes
          ? [...current, heroId]
          : current,
    );
  };

  const setGiftQty = (good: GoodId, raw: string) => {
    setError(null);
    const held = game.goods[good] ?? 0;
    const qty = Math.max(0, Math.min(held, Math.floor(Number(raw) || 0)));
    setGiftGoods((current) => ({ ...current, [good]: qty }));
  };

  const send = () => {
    if (!selected) return;
    const cargo = mission === 'gift' || mission === 'peace' ? positiveGoods(giftGoods) : {};
    const silver = mission === 'gift' || mission === 'peace' ? Math.max(0, Math.floor(giftSilver)) : 0;
    const params = {
      kind: 'diplomacy' as const,
      destination: selected.id,
      heroIds: party,
      pace,
      silver,
      cargo,
      diplomacyMission: { type: mission as 'talks' | 'gift' | 'alliance' | 'peace' },
    };
    const reason = dispatchError(game, params, LOCATION_DEFS);
    if (reason) {
      setError(reason);
      return;
    }
    if (dispatch(params)) {
      setError(null);
      setParty([]);
      setGiftSilver(0);
      setGiftGoods({});
    }
  };

  return (
    <div className="diplomacy-screen">
      <h2>Diplomacy</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Every community keeps its own memories. Send an envoy with a clear purpose, and the wider
        faction’s mood will follow more slowly behind.
      </p>

      <div className="diplomacy-layout">
        <div className="panel">
          <h3>Communities</h3>
          {grouped.map(({ faction, seats }) => (
            <div key={faction.id} className="diplomacy-group">
              <div className="diplomacy-group-title">{faction.name}</div>
              {seats.map((seat) => {
                const seatState = diplomacySeatState(game, seat);
                const discovery = game.locations[seat.id]?.discovery ?? 'unknown';
                const tribute = tributeForCommunity(game, seat);
                return (
                  <button
                    key={seat.id}
                    className={`road-row diplomacy-seat-button ${selectedId === seat.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedId(seat.id);
                      setError(null);
                    }}
                  >
                    <span>
                      {seat.name}{' '}
                      <span className="dim">
                        ({discoveryAtLeast(discovery, 'visited') ? stanceOf(seatState.standing) : 'Unreached'})
                      </span>
                    </span>
                    <span className="dim">
                      {seatState.pact !== 'none' ? seatState.pact : 'no pact'}
                      {tribute ? ` · tribute ${tribute.direction}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="panel">
          {selected && selectedSeat ? (
            <>
              <h3>{selected.name}</h3>
              <p className="dim map-description">{selected.blurb}</p>
              <div className="faction-row">
                <span>Community stance</span>
                <span>
                  <span className={selectedSeat.standing < 0 ? 'bad' : selectedSeat.standing > 0 ? 'good' : 'dim'}>
                    {selectedSeat.standing > 0 ? '+' : ''}
                    {selectedSeat.standing}
                  </span>{' '}
                  <span className="dim">({stanceOf(selectedSeat.standing)})</span>
                </span>
              </div>
              <div className="faction-row">
                <span>{FACTION_DEFS.get(selected.faction!)?.name}</span>
                <span className="dim">
                  {game.factions[selected.faction!].standing > 0 ? '+' : ''}
                  {game.factions[selected.faction!].standing} faction sentiment
                </span>
              </div>
              <div className="faction-row">
                <span>Pact</span>
                <span className="dim">{selectedSeat.pact === 'none' ? 'None' : selectedSeat.pact}</span>
              </div>
              <div className="faction-row">
                <span>Tribute</span>
                <span className="dim">
                  {tributeForCommunity(game, selected)
                    ? `${tributeForCommunity(game, selected)!.direction}ing tribute`
                    : 'None'}
                </span>
              </div>
              <div className="faction-row">
                <span>Route</span>
                <span className="dim">
                  {canReachSelected ? `${oneWay} turn${oneWay === 1 ? '' : 's'} away` : 'Not yet reached'}
                </span>
              </div>

              <h4 style={{ marginTop: 14 }}>Why they feel this way</h4>
              <ul className="diplomacy-reasons">
                {diplomacyReasons(game, selected).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="dim">Select a community to see its situation.</p>
          )}
        </div>

        <div className="panel">
          <h3>Send Envoy</h3>
          {!selected || !selectedLoc ? (
            <p className="dim">Select a destination first.</p>
          ) : (
            <>
              <label className="compact-field">
                <span>Mission</span>
                <select
                  value={mission}
                  onChange={(event) => {
                    setMission(event.target.value as DiplomacyMissionChoice);
                    setError(null);
                  }}
                >
                  <option value="talks">Open talks</option>
                  <option value="gift">Bear gifts</option>
                  <option value="alliance">Propose alliance</option>
                  <option value="peace">Seek truce</option>
                </select>
              </label>
              <label className="compact-field">
                <span>Pace</span>
                <select value={pace} onChange={(event) => setPace(event.target.value as ExpeditionPace)}>
                  <option value="fast">Fast</option>
                  <option value="normal">Normal</option>
                  <option value="slow">Slow</option>
                </select>
              </label>

              {(mission === 'gift' || mission === 'peace') && (
                <>
                  <label className="compact-field">
                    <span>Silver offered</span>
                    <input
                      type="number"
                      min={0}
                      max={game.silver}
                      value={giftSilver}
                      onChange={(event) =>
                        setGiftSilver(Math.max(0, Math.min(game.silver, Math.floor(Number(event.target.value) || 0))))
                      }
                    />
                  </label>
                  <div className="cargo-grid">
                    {GOODS.filter((good) => game.goods[good.id] > 0).map((good) => (
                      <label key={good.id} className="dim">
                        {good.name} <span style={{ fontSize: '0.75rem' }}>(of {game.goods[good.id]})</span>
                        <input
                          type="number"
                          min={0}
                          max={game.goods[good.id]}
                          value={giftGoods[good.id] ?? 0}
                          onChange={(event) => setGiftQty(good.id, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </>
              )}

              <h4>Party</h4>
              <div className="map-party-picks">
                {available.map((hero) => (
                  <label key={hero.id} className="pick-row">
                    <input
                      type="checkbox"
                      checked={party.includes(hero.id)}
                      onChange={() => toggleHero(hero.id)}
                    />{' '}
                    {hero.name} <span className="dim">(Diplomacy {hero.skills.diplomacy})</span>
                  </label>
                ))}
              </div>

              {!canReachSelected && (
                <div className="bad map-error">No one knows the way there well enough yet.</div>
              )}
              {error && <div className="bad map-error">{error}</div>}
              <button
                className="primary"
                disabled={game.phase !== 'assignment' || party.length === 0 || !canReachSelected}
                onClick={send}
              >
                Send Envoy ▸
              </button>
            </>
          )}

          <h4 style={{ marginTop: 16 }}>Active Envoys</h4>
          {activeMissions.length === 0 ? (
            <p className="dim" style={{ marginBottom: 0 }}>No envoys are away.</p>
          ) : (
            activeMissions.map((expedition) => {
              const destination = expedition.destination
                ? LOCATION_DEFS.get(expedition.destination)?.name ?? expedition.destination
                : 'the frontier';
              return (
                <div key={expedition.id} className="faction-row">
                  <span>
                    {expedition.heroIds
                      .map((id) => game.heroes.find((hero) => hero.id === id)?.name ?? id)
                      .join(' & ')}
                  </span>
                  <span className="dim">
                    {expedition.diplomacyMission?.type ?? 'talks'} · {expedition.leg === 'outbound' ? '→' : '←'}{' '}
                    {destination} ({expedition.turnsLeft})
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
