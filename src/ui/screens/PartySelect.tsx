// Pre-game flow (spec §11): a title screen, then a short wizard — build your
// POV character, then pick 6 pool heroes to found the post with. Three
// distinct screens rather than one long page: starting a game is a separate
// decision from building a character, which is a separate decision from
// picking a company.

import { useRef, useState } from 'react';
import { HERO_POOL } from '../../content/heroes';
import type { PovHeroBuild } from '../../content/heroes';
import { POV_BACKGROUNDS } from '../../content/povBackgrounds';
import { TRAIT_NAMES } from '../../content/traits';
import { TUNING } from '../../content/tuning';
import { GENDERS, HERITAGES, SKILL_IDS, STAT_IDS } from '../../engine/types';
import type { Gender, Heritage, SkillId, StatId } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { pickPortraitKey, portraitKeysFor, portraitUrl } from '../portraits';

type Step = 'start' | 'character' | 'company';

function hueOf(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

function evenStats(): Record<StatId, number> {
  const base = Math.floor(TUNING.start.povStatPool / STAT_IDS.length);
  let remainder = TUNING.start.povStatPool - base * STAT_IDS.length;
  const stats = {} as Record<StatId, number>;
  for (const id of STAT_IDS) {
    stats[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return stats;
}

function zeroSkills(): Record<SkillId, number> {
  const skills = {} as Record<SkillId, number>;
  for (const id of SKILL_IDS) skills[id] = 0;
  return skills;
}

function defaultPovBuild(): PovHeroBuild {
  const heritage: Heritage = 'imanian';
  const gender: Gender = 'male';
  return {
    name: 'Rowan',
    gender,
    heritage,
    backgroundId: POV_BACKGROUNDS[0]!.id,
    stats: evenStats(),
    skills: zeroSkills(),
    portraitKey: pickPortraitKey(`${heritage}_${gender}`, 'pov-default'),
  };
}

// ------------------------------------------------------------- Start screen

function StartScreen({
  hasAutosave,
  onNewGame,
  onContinue,
  onImportFile,
  importError,
}: {
  hasAutosave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onImportFile: (file: File) => void;
  importError: string | null;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="start-screen">
      <h1>The Trading Post</h1>
      <p className="dim">
        A single-player narrative management game on the Ashmark frontier. Lead a company of
        heroes founding a trading post in the wilderness — and the one who leads them.
      </p>
      <div className="start-actions">
        <button className="primary" onClick={onNewGame}>
          Found a New Post ▸
        </button>
        {hasAutosave && <button onClick={onContinue}>Continue Saved Game</button>}
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
    </div>
  );
}

// --------------------------------------------------------- Character step

function CharacterStep({
  build,
  onChange,
  onBack,
  onNext,
}: {
  build: PovHeroBuild;
  onChange: (build: PovHeroBuild) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const statSum = STAT_IDS.reduce((sum, id) => sum + build.stats[id], 0);
  const skillSum = SKILL_IDS.reduce((sum, id) => sum + build.skills[id], 0);
  const { povStatPool: pool, povStatMin: min, povStatMax: max, povSkillPool, povSkillMax } = TUNING.start;
  const portraitOptions = portraitKeysFor(`${build.heritage}_${build.gender}`);

  const adjustStat = (id: StatId, delta: number) => {
    const next = build.stats[id] + delta;
    if (next < min || next > max) return;
    if (delta > 0 && statSum >= pool) return;
    onChange({ ...build, stats: { ...build.stats, [id]: next } });
  };

  const adjustSkill = (id: SkillId, delta: number) => {
    const next = build.skills[id] + delta;
    if (next < 0 || next > povSkillMax) return;
    if (delta > 0 && skillSum >= povSkillPool) return;
    onChange({ ...build, skills: { ...build.skills, [id]: next } });
  };

  const setHeritageGender = (heritage: Heritage, gender: Gender) => {
    onChange({ ...build, heritage, gender, portraitKey: pickPortraitKey(`${heritage}_${gender}`, build.name) });
  };

  return (
    <div>
      <h1>Your Character</h1>
      <p className="dim">
        The seventh member of the company — the one the others answer to, and the one the post's
        people will come to when something needs deciding.
      </p>
      <div className="wizard-nav">
        <button onClick={onBack}>◂ Back</button>
        <button
          className="primary"
          disabled={build.name.trim().length === 0}
          onClick={onNext}
        >
          Choose Your Company ▸
        </button>
      </div>

      <section className="pov-section">
        <h3>Identity</h3>
        <div className="pov-field-row">
          <label>
            Name
            <input
              type="text"
              value={build.name}
              maxLength={40}
              onChange={(e) => onChange({ ...build, name: e.target.value })}
            />
          </label>
          <label>
            Gender
            <select
              value={build.gender}
              onChange={(e) => setHeritageGender(build.heritage, e.target.value as Gender)}
            >
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            Heritage
            <select
              value={build.heritage}
              onChange={(e) => setHeritageGender(e.target.value as Heritage, build.gender)}
            >
              {HERITAGES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
        {portraitOptions.length > 0 && (
          <div className="pov-portrait-grid">
            {portraitOptions.map((key) => (
              <div
                key={key}
                className={`pov-portrait-option ${build.portraitKey === key ? 'picked' : ''}`}
                onClick={() => onChange({ ...build, portraitKey: key })}
              >
                <img className="portrait-art" src={portraitUrl(key)} alt="" draggable={false} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pov-section">
        <h3>Background</h3>
        <div className="pov-background-grid">
          {POV_BACKGROUNDS.map((b) => (
            <div
              key={b.id}
              className={`pov-background-card ${build.backgroundId === b.id ? 'picked' : ''}`}
              onClick={() => onChange({ ...build, backgroundId: b.id })}
            >
              <div className="name">{b.label}</div>
              <div className="bio">{b.description}</div>
              <div>
                {b.traits.map((t) => (
                  <span key={t} className="trait-tag">
                    {TRAIT_NAMES.get(t) ?? t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pov-section">
        <h3>Abilities</h3>
        <div className="pov-abilities-row">
          <div>
            <h4>Stats</h4>
            <div className="statline">
              {STAT_IDS.map((id) => (
                <span key={id} className="pov-stat">
                  <span className="dim">{id.slice(0, 3).toUpperCase()}</span>
                  <button type="button" onClick={() => adjustStat(id, -1)} disabled={build.stats[id] <= min}>
                    −
                  </button>
                  {build.stats[id]}
                  <button
                    type="button"
                    onClick={() => adjustStat(id, 1)}
                    disabled={build.stats[id] >= max || statSum >= pool}
                  >
                    +
                  </button>
                </span>
              ))}
            </div>
            <p className="dim" style={{ fontSize: '0.78rem' }}>
              {statSum}/{pool} points spent
            </p>
          </div>
          <div>
            <h4>Skills</h4>
            <div className="statline">
              {SKILL_IDS.map((id) => (
                <span key={id} className="pov-stat">
                  <span className="dim">{id.slice(0, 3).toUpperCase()}</span>
                  <button type="button" onClick={() => adjustSkill(id, -1)} disabled={build.skills[id] <= 0}>
                    −
                  </button>
                  {build.skills[id]}
                  <button
                    type="button"
                    onClick={() => adjustSkill(id, 1)}
                    disabled={build.skills[id] >= povSkillMax || skillSum >= povSkillPool}
                  >
                    +
                  </button>
                </span>
              ))}
            </div>
            <p className="dim" style={{ fontSize: '0.78rem' }}>
              {skillSum}/{povSkillPool} skill points spent
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ Company step

function CompanyStep({
  picked,
  onToggle,
  onBack,
  onFound,
}: {
  picked: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onFound: () => void;
}) {
  const cap = TUNING.start.partySize;

  return (
    <div>
      <h1>Choose Your Company</h1>
      <p className="dim">
        Six heroes to found an Ansberry Company trading post on the Ashmark frontier. Who you
        bring determines what stories find you.
      </p>
      <div className="wizard-nav">
        <button onClick={onBack}>◂ Back</button>
        <button className="primary" disabled={picked.length !== cap} onClick={onFound}>
          Found the Post ({picked.length}/{cap})
        </button>
      </div>
      <div className="hero-grid">
        {HERO_POOL.map((h) => {
          const url = portraitUrl(h.portraitKey);
          return (
            <div
              key={h.id}
              className={`hero-card ${picked.includes(h.id) ? 'picked' : ''}`}
              onClick={() => onToggle(h.id)}
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

// -------------------------------------------------------------------- Root

export function PartySelect() {
  const [step, setStep] = useState<Step>('start');
  const [picked, setPicked] = useState<string[]>([]);
  const [povBuild, setPovBuild] = useState<PovHeroBuild>(defaultPovBuild);
  const newGame = useGameStore((s) => s.newGame);
  const continueGame = useGameStore((s) => s.continueGame);
  const importSave = useGameStore((s) => s.importSave);
  const hasAutosave = useGameStore((s) => s.hasAutosave);
  const [importError, setImportError] = useState<string | null>(null);
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

  if (step === 'start') {
    return (
      <StartScreen
        hasAutosave={hasAutosave()}
        onNewGame={() => setStep('character')}
        onContinue={continueGame}
        onImportFile={onImportFile}
        importError={importError}
      />
    );
  }

  if (step === 'character') {
    return (
      <CharacterStep
        build={povBuild}
        onChange={setPovBuild}
        onBack={() => setStep('start')}
        onNext={() => setStep('company')}
      />
    );
  }

  return (
    <CompanyStep
      picked={picked}
      onToggle={toggle}
      onBack={() => setStep('character')}
      onFound={() => newGame(picked, povBuild)}
    />
  );
}
