// Market (spec §11): post market buy/sell plus the caravan planner —
// choose goods, destination, and 1–2 heroes; profit happens on the road.

import { useEffect, useState } from 'react';
import { GOODS } from '../../content/goods';
import { LOCATIONS, LOCATION_DEFS } from '../../content/locations';
import { MAP_REGIONS } from '../../content/map';
import { TUNING } from '../../content/tuning';
import { priceAt, priceOf } from '../../engine/economy';
import { cargoCapacity, cargoUnits, dispatchError } from '../../engine/expeditions';
import { journeyTurns } from '../../engine/map';
import { residentsAvailable } from '../../engine/residents';
import { discoveryAtLeast, heroesAtPost } from '../../engine/types';
import type { ExpeditionPace, GameState, GoodId, ResidentRole } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

export function MarketScreen({ game }: { game: GameState }) {
  const buy = useGameStore((s) => s.buy);
  const sell = useGameStore((s) => s.sell);
  const dispatch = useGameStore((s) => s.dispatch);
  const marketDestinationFocus = useGameStore((s) => s.marketDestinationFocus);
  const clearMarketFocus = useGameStore((s) => s.clearMarketFocus);
  const canAct = game.phase === 'assignment';

  const [destinationId, setDestinationId] = useState<string>('');
  const [party, setParty] = useState<string[]>([]);
  const [cargo, setCargo] = useState<Partial<Record<GoodId, number>>>({});
  const [buyOrders, setBuyOrders] = useState<Partial<Record<GoodId, number>>>({});
  const [silverCarried, setSilverCarried] = useState(0);
  const [escort, setEscort] = useState<Partial<Record<ResidentRole, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pace, setPace] = useState<ExpeditionPace>('normal');

  useEffect(() => {
    if (marketDestinationFocus) {
      setDestinationId(marketDestinationFocus);
      clearMarketFocus();
    }
  }, [marketDestinationFocus, clearMarketFocus]);

  const destinations = LOCATIONS.filter((def) => {
    if (!def.hasMarket || def.id === TUNING.map.homeLocationId) return false;
    const loc = game.locations[def.id];
    return loc !== undefined && discoveryAtLeast(loc.discovery, 'visited');
  });
  const destination = destinationId ? LOCATION_DEFS.get(destinationId) ?? null : null;
  const available = heroesAtPost(game);
  const capacity = cargoCapacity(Math.max(1, party.length), escort);
  const loaded = cargoUnits(cargo);
  const portersFree = residentsAvailable(game, 'porters');
  const guardsFree = residentsAvailable(game, 'guards');
  const home = LOCATION_DEFS.get(TUNING.map.homeLocationId)!;

  const setEscortQty = (role: ResidentRole, raw: string, max: number) => {
    setError(null);
    const qty = Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)));
    setEscort((prev) => ({ ...prev, [role]: qty }));
  };

  const setQty = (
    setter: typeof setCargo,
    good: GoodId,
    raw: string,
    max: number,
  ) => {
    setError(null);
    const qty = Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)));
    setter((prev) => ({ ...prev, [good]: qty }));
  };

  const toggleHero = (heroId: string) => {
    setError(null);
    setParty((prev) =>
      prev.includes(heroId)
        ? prev.filter((id) => id !== heroId)
        : prev.length < TUNING.map.maxExpeditionHeroes
          ? [...prev, heroId]
          : prev,
    );
  };

  const sendCaravan = () => {
    if (!destination) return;
    const params = {
      kind: 'caravan' as const,
      destination: destination.id,
      heroIds: party,
      cargo,
      silver: silverCarried,
      buyOrders,
      residents: escort,
      pace,
    };
    const reason = dispatchError(game, params, LOCATION_DEFS, MAP_REGIONS);
    if (reason) {
      setError(reason);
      return;
    }
    if (dispatch(params)) {
      setParty([]);
      setCargo({});
      setBuyOrders({});
      setSilverCarried(0);
      setEscort({});
      setError(null);
    }
  };

  return (
    <div className="overview-grid-3">
      {/* Column 1 — the post's own market: buy and sell on the spot. */}
      <div className="panel">
        <h3>Post Market</h3>
        <table className="market">
          <thead>
            <tr>
              <th>Good</th>
              <th style={{ textAlign: 'right' }}>Stock</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              {destination && <th style={{ textAlign: 'right' }}>{destination.name}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {GOODS.map((g) => {
              const price = priceOf(game, g);
              const there = destination ? priceAt(game, g, destination) : null;
              return (
                <tr key={g.id} title={g.note}>
                  <td>{g.name}</td>
                  <td className="num">{game.goods[g.id]}</td>
                  <td className="num">{price}</td>
                  {there !== null && (
                    <td className={`num ${there > price ? 'good' : there < price ? 'bad' : ''}`}>
                      {there}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="small"
                      disabled={!canAct || game.silver < price}
                      onClick={() => buy(g.id, 1)}
                    >
                      Buy
                    </button>{' '}
                    <button
                      className="small"
                      disabled={!canAct || game.goods[g.id] < 1}
                      onClick={() => sell(g.id, 1)}
                    >
                      Sell
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="dim" style={{ fontSize: '0.78rem', marginTop: 8 }}>
          Prices drift with season and local supply. Buy low here, sell dear on the road.
        </p>
      </div>

      {/* Column 2 — the caravan: where it goes and who walks with it. */}
      <div className="panel">
        <h3>Caravan</h3>
        {destinations.length === 0 ? (
          <p className="dim">No known markets yet. Explore the map to find trading partners.</p>
        ) : (
          <>
            <label className="dim" style={{ fontSize: '0.85rem', display: 'block' }}>
              Destination
              <select
                value={destinationId}
                onChange={(e) => {
                  setDestinationId(e.target.value);
                  setError(null);
                }}
                style={{ marginLeft: 8 }}
              >
                <option value="">— choose a market —</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({journeyTurns(home.mapPoint, d.mapPoint, pace)} turns out)
                  </option>
                ))}
              </select>
            </label>

            <label className="dim" style={{ fontSize: '0.85rem', display: 'block', marginTop: 8 }}>
              Pace
              <select value={pace} onChange={(e) => setPace(e.target.value as ExpeditionPace)} style={{ marginLeft: 8 }}>
                <option value="fast">Fast</option>
                <option value="normal">Normal</option>
                <option value="slow">Slow</option>
              </select>
            </label>

            {destination && (
              <>
                <h4 style={{ marginTop: 12 }}>Who Goes</h4>
                {available.map((hero) => (
                  <label key={hero.id} className="pick-row">
                    <input
                      type="checkbox"
                      checked={party.includes(hero.id)}
                      onChange={() => toggleHero(hero.id)}
                    />{' '}
                    {hero.name} <span className="dim">(Bargain {hero.skills.bargain})</span>
                  </label>
                ))}

                {(portersFree > 0 || guardsFree > 0) && (
                  <>
                    <h4 style={{ marginTop: 12 }}>Escort</h4>
                    <p className="dim" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
                      Porters carry more; guards steady the bargaining.
                    </p>
                    <div className="cargo-grid">
                      {portersFree > 0 && (
                        <label className="dim">
                          Porters <span style={{ fontSize: '0.75rem' }}>(of {portersFree})</span>
                          <input
                            type="number"
                            min={0}
                            max={portersFree}
                            value={escort.porters ?? 0}
                            onChange={(e) => setEscortQty('porters', e.target.value, portersFree)}
                          />
                        </label>
                      )}
                      {guardsFree > 0 && (
                        <label className="dim">
                          Guards <span style={{ fontSize: '0.75rem' }}>(of {guardsFree})</span>
                          <input
                            type="number"
                            min={0}
                            max={guardsFree}
                            value={escort.guards ?? 0}
                            onChange={(e) => setEscortQty('guards', e.target.value, guardsFree)}
                          />
                        </label>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Column 3 — the load: what it carries out and what it buys there. */}
      <div className="panel">
        <h3>The Load</h3>
        {!destination ? (
          <p className="dim" style={{ fontSize: '0.85rem' }}>
            {destinations.length === 0
              ? 'A caravan needs a known market to make for.'
              : 'Choose a destination to load a caravan.'}
          </p>
        ) : (
          <>
            <h4 style={{ marginTop: 0 }}>
              Cargo <span className="dim" style={{ fontSize: '0.8rem' }}>({loaded}/{capacity})</span>
            </h4>
            <div className="cargo-grid">
              {GOODS.filter((g) => game.goods[g.id] > 0).map((g) => (
                <label key={g.id} className="dim">
                  {g.name}
                  <input
                    type="number"
                    min={0}
                    max={game.goods[g.id]}
                    value={cargo[g.id] ?? 0}
                    onChange={(e) => setQty(setCargo, g.id, e.target.value, game.goods[g.id])}
                  />
                </label>
              ))}
            </div>

            <h4 style={{ marginTop: 12 }}>Buy There</h4>
            <p className="dim" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
              Filled from carried silver and sale proceeds, as far as they stretch.
            </p>
            <div className="cargo-grid">
              {GOODS.map((g) => (
                <label key={g.id} className="dim">
                  {g.name}
                  <input
                    type="number"
                    min={0}
                    max={capacity}
                    value={buyOrders[g.id] ?? 0}
                    onChange={(e) => setQty(setBuyOrders, g.id, e.target.value, capacity)}
                  />
                </label>
              ))}
            </div>
            <label className="dim" style={{ fontSize: '0.85rem', display: 'block', marginTop: 8 }}>
              Silver carried
              <input
                type="number"
                min={0}
                max={game.silver}
                value={silverCarried}
                onChange={(e) => {
                  setError(null);
                  setSilverCarried(
                    Math.max(0, Math.min(game.silver, Math.floor(Number(e.target.value) || 0))),
                  );
                }}
                style={{ marginLeft: 8, width: 90 }}
              />
            </label>

            {error && <div className="bad" style={{ fontSize: '0.85rem', margin: '8px 0 0' }}>{error}</div>}
            <button
              className="primary"
              style={{ marginTop: 10 }}
              disabled={!canAct || party.length === 0}
              onClick={sendCaravan}
            >
              Send the Caravan ▸
            </button>
            {!canAct && (
              <div className="dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Caravans set out during the assignment phase.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
