// The Ledger (TRADING_ECONOMY_SPEC §4): a goods × markets price board so the
// player can plan a route without sailing to every market first. Markets are
// rows (only ones reached to 'visited'+), goods are columns. Cells show the
// last price a party actually saw there — coloured against the post's own price
// (green = sells dear here, red = cheap here) and dimmed as the sighting ages.
// Markets known by character but never priced show a '~' structural estimate.

import { GOODS } from '../../content/goods';
import { LOCATIONS, LOCATION_DEFS } from '../../content/locations';
import { TUNING } from '../../content/tuning';
import { priceOf, structuralPrice } from '../../engine/economy';
import type { GoodDef } from '../../engine/economy';
import { discoveryAtLeast } from '../../engine/types';
import type { GameState, GoodId, LocationDef, MarketShock } from '../../engine/types';

/** How the known price compares to the post's — the buy-low/sell-high signal. */
function spreadClass(known: number, post: number): string {
  const ratio = known / post;
  if (ratio >= 1.12) return 'good';
  if (ratio <= 0.89) return 'bad';
  return '';
}

/** Opacity for a sighting this many turns old — fresh reads bold, old reads faint. */
function stalenessOpacity(age: number): number {
  if (age <= 3) return 1;
  if (age <= 7) return 0.72;
  if (age <= 14) return 0.5;
  return 0.34;
}

interface Cell {
  price: number;
  className: string;
  estimate: boolean;
  age: number | null;
}

function cellFor(game: GameState, def: LocationDef, good: GoodDef, postPrice: number): Cell {
  const observed = game.locations[def.id]?.priceIntel?.[good.id];
  if (observed) {
    return {
      price: observed.price,
      className: spreadClass(observed.price, postPrice),
      estimate: false,
      age: Math.max(0, game.turn - observed.turnSeen),
    };
  }
  // Visited its market but no live price on file (e.g. a start-visited seat we
  // have not run a caravan to yet) — show what its structure implies.
  const est = structuralPrice(game, good, def);
  return { price: est, className: spreadClass(est, postPrice), estimate: true, age: null };
}

/** The most notable shock touching a market+good — a live one outranks a rumor. */
function shockFor(
  shocks: MarketShock[],
  locationId: string,
  goodId: GoodId,
): MarketShock | undefined {
  let best: MarketShock | undefined;
  for (const s of shocks) {
    if (s.locationId !== locationId || s.goodId !== goodId) continue;
    if (!best || (best.leadLeft > 0 && s.leadLeft === 0)) best = s;
  }
  return best;
}

/** The little marker a shock leaves on a Ledger cell — the live number is stale
 *  the moment a shock hits, so this flags "something's moving here now". */
function ShockMark({ shock }: { shock: MarketShock }) {
  const rising = shock.mod > 1;
  const rumored = shock.leadLeft > 0;
  const arrow = rising ? '▲' : '▼';
  const title = rumored
    ? `Rumored: ${rising ? 'a shortage is coming — prices will rise' : 'a glut is coming — prices will fall'}.`
    : `${rising ? 'Prices spiking here now' : 'Prices slumping here now'} — your figure predates it.`;
  return (
    <sup
      className={rising ? 'good' : 'bad'}
      style={{ marginLeft: 3, opacity: rumored ? 0.6 : 1, fontWeight: 'bold' }}
      title={title}
    >
      {arrow}
      {rumored ? '?' : ''}
    </sup>
  );
}

export function LedgerScreen({ game }: { game: GameState }) {
  const homeId = TUNING.map.homeLocationId;
  const markets = LOCATIONS.filter(
    (def) =>
      def.hasMarket &&
      def.id !== homeId &&
      discoveryAtLeast(game.locations[def.id]?.discovery ?? 'unknown', 'visited'),
  );

  return (
    <div className="panel">
      <h3>The Ledger</h3>
      <p className="dim" style={{ fontSize: '0.82rem', margin: '0 0 10px' }}>
        Last prices your people brought back. <span className="good">Green</span> sells dear against
        the post; <span className="bad">red</span> is cheap to buy. Faded rows are old news; a{' '}
        <span style={{ fontStyle: 'italic' }}>~</span> price is only what the market's character
        implies, never actually seen.
      </p>

      {markets.length === 0 ? (
        <p className="dim">
          No markets scouted yet. Send caravans or envoys out and their prices will be recorded here.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="market ledger">
            <thead>
              <tr>
                <th>Market</th>
                {GOODS.map((g) => (
                  <th key={g.id} className="num" title={g.note}>
                    {g.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="ledger-ref">
                <td title="The post's own price right now — the figure every market is coloured against.">
                  The Post — now
                </td>
                {GOODS.map((g) => (
                  <td key={g.id} className="num">
                    {priceOf(game, g)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="dim">Base price</td>
                {GOODS.map((g) => (
                  <td key={g.id} className="num dim">
                    {g.basePrice}
                  </td>
                ))}
              </tr>
              {markets.map((def) => (
                <tr key={def.id}>
                  <td title={LOCATION_DEFS.get(def.id)?.blurb}>{def.name}</td>
                  {GOODS.map((g) => {
                    const post = priceOf(game, g);
                    const cell = cellFor(game, def, g, post);
                    const shock = shockFor(game.marketShocks, def.id, g.id);
                    return (
                      <td
                        key={g.id}
                        className={`num ${cell.className}`}
                        style={{ opacity: cell.age === null ? 0.6 : stalenessOpacity(cell.age) }}
                        title={
                          cell.estimate
                            ? 'Estimated from this market’s character — never priced in person.'
                            : cell.age === 0
                              ? 'Seen this turn.'
                              : `Seen ${cell.age} turn${cell.age === 1 ? '' : 's'} ago.`
                        }
                      >
                        {cell.estimate ? '~' : ''}
                        {cell.price}
                        {shock && <ShockMark shock={shock} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
