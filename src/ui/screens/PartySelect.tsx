// Party Select (spec §11): 12 hero cards, pick 6. Hooks hinted, not spelled out.

import { useRef, useState } from 'react';
import { HERO_POOL } from '../../content/heroes';
import { TRAIT_NAMES } from '../../content/traits';
import { TUNING } from '../../content/tuning';
import { STAT_IDS } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { portraitUrl } from '../portraits';

function hueOf(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

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
    if (file.size > TUNING.save.maxImportBytes) {
      setImportError('That save file is too large to be a Trading Post save.');
      return;
    }
    try {
      setImportError(importSave(await file.text()));
    } catch {
      setImportError('Could not read that save file.');
    }
  };

  return (
    <div>
      <h1>The Trading Post</h1>
      <p className="dim">
        Choose six heroes to found an Ansberry Company trading post on the Ashmark frontier. Who
        you bring determines what stories find you.
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
        {HERO_POOL.map((h) => {
          const url = portraitUrl(h.portraitKey);
          return (
          <div
            key={h.id}
            className={`hero-card ${picked.includes(h.id) ? 'picked' : ''}`}
            onClick={() => toggle(h.id)}
          >
            <div className="hero-card-head">
              <div className="hero-card-portrait" aria-hidden="true">
                {url ? (
                  <img className="portrait-art" src={url} alt="" draggable={false} />
                ) : (
                  <span
                    className="portrait-fallback"
                    style={{
                      background: `linear-gradient(160deg, hsl(${hueOf(h.id)}, 28%, 32%), hsl(${(hueOf(h.id) + 40) % 360}, 30%, 16%))`,
                    }}
                  >
                    {h.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="hero-card-title">
                <div className="name">
                  {h.name} <span className="dim">{h.epithet}</span>
                </div>
              </div>
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
          );
        })}
      </div>
    </div>
  );
}
