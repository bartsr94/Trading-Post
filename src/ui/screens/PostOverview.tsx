// Post Overview (spec §11): post banner by tier, resources, settlement axes,
// faction standings, and the post market (buy/sell).

import { FACTIONS } from '../../content/factions';
import { GOODS } from '../../content/goods';
import { LOCATION_NAMES } from '../../content/locations';
import { prosperity } from '../../engine/economy';
import { CONTENT } from '../../content/registry';
import { stanceOf } from '../../engine/types';
import type { ExpeditionState, GameState } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { BuildingsPanel } from '../components/BuildingsPanel';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { ResidentsPanel } from '../components/ResidentsPanel';

const TIER_NAMES = ['The Clearing', 'Palisade Post', 'Established Post', 'Thriving Settlement'];

const EXPEDITION_KIND_ICONS: Record<ExpeditionState['kind'], IconName> = {
  caravan: 'caravan',
  explore: 'explore',
  diplomacy: 'diplomacy',
};

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
  const setScreen = useGameStore((s) => s.setScreen);

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
            {game.charterMissedStreak > 0 && (
              <div className="bad">
                ⚠ Charter quota unmet {game.charterMissedStreak} season
                {game.charterMissedStreak > 1 ? 's' : ''} running.
              </div>
            )}
          </div>
          <h4 style={{ marginTop: 16 }}>Factions</h4>
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
          <h3>Stores</h3>
          <table className="market">
            <tbody>
              {GOODS.filter((g) => game.goods[g.id] > 0).map((g) => (
                <tr key={g.id} title={g.note}>
                  <td>{g.name}</td>
                  <td className="num">{game.goods[g.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dim" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>
            Buy and sell — and plan caravans — on the{' '}
            <a
              style={{ color: 'var(--accent)', cursor: 'pointer' }}
              onClick={() => setScreen('market')}
            >
              Market screen
            </a>
            .
          </p>

          <h4 style={{ marginTop: 16 }}>Comings &amp; Goings</h4>
          {game.expeditions.length === 0 ? (
            <p className="dim" style={{ fontSize: '0.85rem' }}>
              Everyone is at the post. The road waits.
            </p>
          ) : (
            game.expeditions.map((exp) => {
              const dest = LOCATION_NAMES.get(exp.destination) ?? exp.destination;
              const names = exp.heroIds
                .map((id) => game.heroes.find((h) => h.id === id)?.name ?? id)
                .join(' & ');
              return (
                <div key={exp.id} className="faction-row">
                  <span>
                    <Icon
                      name={EXPEDITION_KIND_ICONS[exp.kind]}
                      size={14}
                      style={{ verticalAlign: '-2px', marginRight: 4 }}
                    />
                    {names}
                  </span>
                  <span className="dim">
                    {exp.leg === 'outbound' ? `→ ${dest}` : `${dest} → home`} ({exp.turnsLeft}{' '}
                    turn{exp.turnsLeft === 1 ? '' : 's'})
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BuildingsPanel game={game} />
      <ResidentsPanel game={game} />
    </div>
  );
}
