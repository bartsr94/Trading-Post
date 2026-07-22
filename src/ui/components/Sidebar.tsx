// Left navigation column (UI shell spec §3.1): title, screen nav, save actions.
// The Heroes screen is gone — the hero bar + hero sheet replace it.

import type { GameState } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import type { Screen } from '../../store/gameStore';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { SettingsMenu } from './SettingsMenu';

const NAV_ITEMS: { screen: Screen; icon: IconName; label: string }[] = [
  { screen: 'post', icon: 'post', label: 'Outpost' },
  { screen: 'assignments', icon: 'assignments', label: 'Assignments' },
  { screen: 'diplomacy', icon: 'diplomacy', label: 'Diplomacy' },
  { screen: 'characters', icon: 'characters', label: 'Characters' },
  { screen: 'buildings', icon: 'build', label: 'Buildings' },
  { screen: 'people', icon: 'people', label: 'People' },
  { screen: 'map', icon: 'map', label: 'Map' },
  { screen: 'market', icon: 'market', label: 'Market' },
];

export function Sidebar({ game }: { game: GameState }) {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const exportSave = useGameStore((s) => s.exportSave);
  const abandonGame = useGameStore((s) => s.abandonGame);

  const onExport = () => {
    const json = exportSave();
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-post-turn-${game.turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        <span className="full">The Trading Post</span>
        <span className="mono" aria-hidden="true">
          TP
        </span>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.screen}
            className={screen === item.screen ? 'active' : ''}
            onClick={() => setScreen(item.screen)}
          >
            <span className="icon" aria-hidden="true">
              <Icon name={item.icon} />
            </span>
            <span className="label">
              {item.label}
              {item.screen === 'assignments' && game.phase === 'assignment' ? ' ●' : ''}
              {item.screen === 'map' && game.expeditions.length > 0
                ? ` (${game.expeditions.length} away)`
                : ''}
            </span>
          </button>
        ))}
      </nav>
      <div className="sidebar-actions">
        <button className="small" onClick={onExport}>
          Export Save
        </button>
        <button
          className="small"
          onClick={() => {
            if (window.confirm('Abandon this venture? The autosave will be deleted.')) abandonGame();
          }}
        >
          Abandon
        </button>
        <SettingsMenu />
      </div>
    </aside>
  );
}
