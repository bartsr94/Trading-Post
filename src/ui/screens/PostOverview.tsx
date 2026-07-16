// Post Overview (spec §11): post banner by tier, resources, settlement axes,
// faction standings, and the post market (buy/sell).

import { FACTIONS } from '../../content/factions';
import { GOODS } from '../../content/goods';
import { priceOf, prosperity } from '../../engine/economy';
import { CONTENT } from '../../content/registry';
import { stanceOf } from '../../engine/types';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const TIER_NAMES = ['The Clearing', 'Palisade Post', 'Established Post', 'Thriving Settlement'];

function AxisIndicator({
  value,
  left,
  right,
}: {
  value: number;
  left: string;
  right: string;
}) {
  return (
    <div className="axis-row">
      <span className="dim">{left}</span> ↔ <span className="dim">{right}</span>
      <div className="axis-track">
        <div className="center" />
        <div className="marker" style={{ left: `${((value + 10) / 20) * 100}%` }} />
      </div>
    </div>
  );
}

export function PostOverview({ game }: { game: GameState }) {
  const buy = useGameStore((s) => s.buy);
  const sell = useGameStore((s) => s.sell);
  const canTrade = game.phase === 'assignment';

  return (
    <div>
      <div className="post-banner">
        <div>
          <h2 style={{ color: '#fff6e0', margin: 0 }}>{TIER_NAMES[game.postTier - 1]}</h2>
          <span className="dim" style={{ color: '#cbbfa4' }}>
            Tents, a firepit, a stock pile — and six people determined to make it more.
          </span>
        </div>
      </div>

      <div className="overview-grid">
        <div className="panel">
          <h3>The Post</h3>
          <AxisIndicator value={game.axes.integration} left="Aloof" right="Integrated" />
          <AxisIndicator value={game.axes.communal} left="Mercantile" right="Communal" />
          <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
            Prosperity: <b>{prosperity(game, CONTENT.goodDefs)}</b>
            {game.bankruptcyClock > 0 && (
              <div className="bad">
                ⚠ Upkeep unpaid {game.bankruptcyClock} turn{game.bankruptcyClock > 1 ? 's' : ''} — ruin
                at 3.
              </div>
            )}
          </div>
          <h3 style={{ marginTop: 16 }}>Factions</h3>
          {FACTIONS.map((f) => {
            const standing = game.factions[f.id].standing;
            return (
              <div key={f.id} className="faction-row" title={f.blurb}>
                <span>{f.name}</span>
                <span>
                  <span className={standing < 0 ? 'bad' : standing > 0 ? 'good' : 'dim'}>
                    {standing > 0 ? '+' : ''}
                    {standing}
                  </span>{' '}
                  <span className="dim">({stanceOf(standing)})</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h3>Post Market</h3>
          <table className="market">
            <thead>
              <tr>
                <th>Good</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {GOODS.map((g) => {
                const price = priceOf(game, g);
                return (
                  <tr key={g.id} title={g.note}>
                    <td>{g.name}</td>
                    <td className="num">{game.goods[g.id]}</td>
                    <td className="num">{price}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="small"
                        disabled={!canTrade || game.silver < price}
                        onClick={() => buy(g.id, 1)}
                      >
                        Buy
                      </button>{' '}
                      <button
                        className="small"
                        disabled={!canTrade || game.goods[g.id] < 1}
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
            Prices drift with season and local supply. Caravans to other markets arrive with MVP 2.
          </p>
        </div>
      </div>
    </div>
  );
}
