// Bottom-left settings popover (sidebar-actions): the one switch that unlocks
// the cheat console, off by default and persisted (see gameStore's
// cheatModeEnabled). The console itself only ever renders through App.tsx.

import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Icon } from './Icon';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const cheatModeEnabled = useGameStore((s) => s.cheatModeEnabled);
  const setCheatMode = useGameStore((s) => s.setCheatMode);
  const setCheatConsoleOpen = useGameStore((s) => s.setCheatConsoleOpen);

  return (
    <div className="settings-menu">
      <button className="small" onClick={() => setOpen((o) => !o)} title="Settings">
        <span className="icon" aria-hidden="true" style={{ marginRight: 4 }}>
          <Icon name="gear" size={14} />
        </span>
        Settings
      </button>
      {open && (
        <div className="settings-popover" onClick={(e) => e.stopPropagation()}>
          <label className="settings-row">
            <input
              type="checkbox"
              checked={cheatModeEnabled}
              onChange={(e) => setCheatMode(e.target.checked)}
            />
            Cheat mode
          </label>
          {cheatModeEnabled && (
            <button
              className="small"
              onClick={() => {
                setCheatConsoleOpen(true);
                setOpen(false);
              }}
            >
              Open Cheat Console
            </button>
          )}
        </div>
      )}
    </div>
  );
}
