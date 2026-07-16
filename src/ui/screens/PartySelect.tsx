// Party Select (spec §11): 12 hero cards, pick 6. Hooks hinted, not spelled out.

import { useRef, useState } from 'react';
import { HERO_POOL } from '../../content/heroes';
import { TRAIT_NAMES } from '../../content/traits';
import { TUNING } from '../../content/tuning';
import { STAT_IDS } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

export function PartySelect() {
  const [picked, setPicked] = useState<string[]>([]);
  const newGame = useGameStore((s) => s.newGame);
  const continueGame = useGameStore((s) => s.continueGame);
  const importSave = useGameStore((s) => s.importSave);
  const hasAutosave = useGameStore((s) => s.hasAutosave);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cap = TUNING.start.partySize;

  const toggle = (id: string) => {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < cap ? [...prev, id] : prev,
    );
  };

  const onImportFile = async (file: File) => {
    setImportError(importSave(await file.text()));
  };

  return (
    <div>
      <h1>The Trading Post</h1>
      <p className="dim">
        Choose six heroes to found a trading post on the Palusterian frontier. Who you bring
        determines what stories find you.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 16px' }}>
        <button
          className="primary"
          disabled={picked.length !== cap}
          onClick={() => newGame(picked)}
        >
          Found the Post ({picked.length}/{cap})
        </button>
        {hasAutosave() && <button onClick={continueGame}>Continue Saved Game</button>}
        <button onClick={() => fileInput.current?.click()}>Import Save…</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = '';
          }}
        />
        {importError && <span className="bad">{importError}</span>}
      </div>
      <div className="hero-grid">
        {HERO_POOL.map((h) => (
          <div
            key={h.id}
            className={`hero-card ${picked.includes(h.id) ? 'picked' : ''}`}
            onClick={() => toggle(h.id)}
          >
            <div className="name">
              {h.name} <span className="dim">{h.epithet}</span>
            </div>
            <div className="statline">
              {STAT_IDS.map((s) => (
                <span key={s}>
                  <span className="dim">{s.slice(0, 3).toUpperCase()}</span> {h.stats[s]}
                </span>
              ))}
            </div>
            <div className="statline">
              {Object.entries(h.skills)
                .filter(([, v]) => v && v > 0)
                .map(([skill, v]) => (
                  <span key={skill}>
                    {skill} {v}
                  </span>
                ))}
            </div>
            <div>
              {h.traits.map((t) => (
                <span key={t} className="trait-tag">
                  {TRAIT_NAMES.get(t) ?? t}
                </span>
              ))}
            </div>
            <div className="bio">{h.bio}</div>
            <div className="hook">“{h.hookHint}”</div>
          </div>
        ))}
      </div>
    </div>
  );
}
