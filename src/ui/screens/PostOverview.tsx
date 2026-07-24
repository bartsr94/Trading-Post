// Outpost Overview: the landing screen — a dashboard of the outpost's
// character, trade & standing, the settlement, and its people, plus the
// Concession's land controls in a strip below. The People screen it used to
// link out to is gone; hands/land management live here now. Four columns
// (plus the strip) so it still never scrolls at the 1280x720 floor.

import outpostBg from '../../assets/ui/outpost_background.jpg';
import { BUILDING_NAMES } from '../../content/buildings';
import { FACTION_DEFS, FACTIONS } from '../../content/factions';
import { GOODS } from '../../content/goods';
import { LOCATION_NAMES } from '../../content/locations';
import { CONTENT } from '../../content/registry';
import { TUNING } from '../../content/tuning';
import { canAdvanceTier, tierRequirement } from '../../engine/buildings';
import { prosperity } from '../../engine/economy';
import { postDefense } from '../../engine/residents';
import { stanceOf } from '../../engine/types';
import type { ExpeditionState, GameState } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConcessionStrip, PeopleOverviewColumn } from '../components/ResidentsPanel';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';

const TIER_NAMES = ['The Clearing', 'Palisade Post', 'Established Post', 'Thriving Settlement'];

const EXPEDITION_KIND_ICONS: Record<ExpeditionState['kind'], IconName> = {
  caravan: 'caravan',
  explore: 'explore',
  diplomacy: 'diplomacy',
  courtship: 'heart',
  raid: 'raid',
  invite: 'people',
  concession: 'map',
};

function AxisIndicator({ value, left, right }: { value: number; left: string; right: string }) {
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

  const construction = game.construction;
  const activeDef = construction ? TUNING.building.defs[construction.building] : undefined;
  const nextTier = tierRequirement(game.postTier + 1);
  const ready = canAdvanceTier(game);
  const ownedGoods = GOODS.filter((g) => game.goods[g.id] > 0);

  return (
    <div className="outpost-overview">
      <div className="post-banner" style={{ backgroundImage: `url(${outpostBg})` }}>
        <div className="post-banner-text">
          <h2>{TIER_NAMES[game.postTier - 1]}</h2>
          <span className="dim banner-flavor">
            Tents, a firepit, a stock pile — and six people determined to make it more.
          </span>
        </div>
      </div>

      <div className="overview-grid-4">
        {/* Column 1 — the character of the outpost */}
        <div className="panel">
          <h3>The Outpost</h3>
          <AxisIndicator value={game.axes.integration} left="Aloof" right="Integrated" />
          <AxisIndicator value={game.axes.communal} left="Mercantile" right="Communal" />
          <AxisIndicator value={game.axes.culture} left="Imanian" right="Sauromatian" />
          <div className="faction-row">
            <span>Prosperity</span>
            <b>{prosperity(game, CONTENT.goodDefs)}</b>
          </div>
          <div className="faction-row">
            <span>Defense</span>
            <b>{postDefense(game)}</b>
          </div>
          {game.bankruptcyClock > 0 && (
            <div className="bad" style={{ fontSize: '0.85rem', marginTop: 8 }}>
              ⚠ Upkeep unpaid {game.bankruptcyClock} turn{game.bankruptcyClock > 1 ? 's' : ''} — ruin
              at 3.
            </div>
          )}
          {game.charterMissedStreak > 0 && (
            <div className="bad" style={{ fontSize: '0.85rem', marginTop: 8 }}>
              ⚠ Charter quota unmet {game.charterMissedStreak} season
              {game.charterMissedStreak > 1 ? 's' : ''} running.
            </div>
          )}
          {game.bankruptcyClock === 0 && game.charterMissedStreak === 0 && (
            <div className="dim" style={{ fontSize: '0.82rem', marginTop: 8 }}>
              The books balance and the Company is quiet — for now.
            </div>
          )}
          {game.tributes.length > 0 && (
            <div className="dim" style={{ fontSize: '0.8rem', marginTop: 8 }}>
              Tribute:{' '}
              {game.tributes
                .map((tribute) => `${tribute.direction === 'pay' ? 'to' : 'from'} ${FACTION_DEFS.get(tribute.faction)?.name ?? tribute.faction}`)
                .join('; ')}
            </div>
          )}
        </div>

        {/* Column 2 — trade and standing */}
        <div className="panel">
          <h3>Trade &amp; Standing</h3>
          <h4>Stores</h4>
          <table className="market">
            <tbody>
              {ownedGoods.map((g) => (
                <tr key={g.id} title={g.note}>
                  <td>{g.name}</td>
                  <td className="num">{game.goods[g.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="manage-link" onClick={() => setScreen('market')}>
            Buy &amp; sell on the Market →
          </button>

          <h4 style={{ marginTop: 14 }}>Factions</h4>
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

        {/* Column 3 — the settlement and its comings & goings */}
        <div className="panel">
          <h3>The Settlement</h3>

          <h4>Buildings</h4>
          {game.buildings.length === 0 ? (
            <p className="dim" style={{ fontSize: '0.84rem', margin: '0 0 6px' }}>
              Nothing raised yet.
            </p>
          ) : (
            <div className="building-chips">
              {game.buildings.map((id) => (
                <span key={id} className="building-chip">
                  {BUILDING_NAMES.get(id) ?? id}
                </span>
              ))}
            </div>
          )}
          {construction && activeDef && (
            <div className="faction-row">
              <span className="dim">
                Building {BUILDING_NAMES.get(construction.building) ?? construction.building}
              </span>
              <span className="dim">
                {construction.progress}/{activeDef.buildProgress}
              </span>
            </div>
          )}
          {ready ? (
            <div className="good" style={{ fontSize: '0.82rem', margin: '4px 0' }}>
              ▲ Ready to grow.
            </div>
          ) : (
            nextTier && (
              <div className="dim" style={{ fontSize: '0.8rem', margin: '4px 0' }}>
                To grow: {nextTier.requiredBuildings.map((b) => BUILDING_NAMES.get(b) ?? b).join(' + ')}
                {' '}+ {nextTier.silverCost} silver.
              </div>
            )
          )}
          <button className="manage-link" onClick={() => setScreen('buildings')}>
            Manage buildings →
          </button>

          <h4 style={{ marginTop: 14 }}>Comings &amp; Goings</h4>
          {game.expeditions.length === 0 ? (
            <p className="dim" style={{ fontSize: '0.84rem', margin: 0 }}>
              Everyone is at the outpost.
            </p>
          ) : (
            game.expeditions.map((exp) => {
              const dest = exp.destination
                ? LOCATION_NAMES.get(exp.destination) ?? exp.destination
                : 'the frontier';
              const names = exp.heroIds
                .map((id) => game.heroes.find((h) => h.id === id)?.name ?? id)
                .join(' & ');
              return (
                <div key={exp.id} className="faction-row">
                  <span>
                    <Icon
                      name={EXPEDITION_KIND_ICONS[exp.kind]}
                      size={13}
                      style={{ verticalAlign: '-2px', marginRight: 4 }}
                    />
                    {names}
                  </span>
                  <span className="dim" style={{ fontSize: '0.8rem' }}>
                    {exp.leg === 'outbound' ? `→ ${dest}` : `${dest} →`} ({exp.turnsLeft})
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Column 4 — the people who make it up */}
        <PeopleOverviewColumn game={game} />
      </div>

      <ConcessionStrip game={game} />
    </div>
  );
}
