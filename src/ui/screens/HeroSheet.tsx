// Hero Sheet (spec §11): stats, skills, traits, condition, personal history,
// plus roster status (active/reserve) and swap action (CHARACTERS_SPEC.md §9).

import { TRAIT_DEFS } from '../../content/traits';
import { dominantHeritage } from '../../engine/family';
import { activateError, benchError, dependantsOf } from '../../engine/roster';
import { SKILL_IDS, STAT_IDS } from '../../engine/types';
import type { Dependant, Hero, Heritage } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConditionBars } from '../components/ConditionBars';
import { Portrait } from '../components/Portrait';
import { pickPortraitKey, portraitUrl } from '../portraits';

const DEPENDANT_LABEL: Record<Dependant['kind'], string> = {
  spouse: 'Spouse',
  child: 'Child',
  kin: 'Kin',
};

const HERITAGE_LABEL: Record<Heritage, string> = {
  imanian: 'Imanian (homeland)',
  kiswani: 'Kiswani',
  dustwalker: 'Dustwalker',
  bejasi: 'Bejasi',
};

function hueOf(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((hash % 360) + 360) % 360;
}

/** A small family portrait tile: real art from the person's people+gender pool
 *  where one exists, else the hash-hue initial tile. */
function DependantTile({ dep }: { dep: Dependant }) {
  const key = dep.portraitKey ?? pickPortraitKey(`${dominantHeritage(dep)}_${dep.gender}`, dep.id);
  const url = portraitUrl(key);
  return (
    <div className="fam-tile" title={`${DEPENDANT_LABEL[dep.kind]} — fed, does no work`}>
      <div className="fam-face">
        {url ? (
          <img className="portrait-art" src={url} alt="" draggable={false} />
        ) : (
          <span
            className="portrait-fallback"
            aria-hidden="true"
            style={{
              background: `linear-gradient(160deg, hsl(${hueOf(dep.name)}, 28%, 32%), hsl(${(hueOf(dep.name) + 40) % 360}, 30%, 16%))`,
            }}
          >
            {dep.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="fam-name">{dep.name}</div>
      <div className="fam-rel dim">{DEPENDANT_LABEL[dep.kind].toLowerCase()}</div>
    </div>
  );
}

export function HeroSheet({ hero }: { hero: Hero }) {
  const selectHero = useGameStore((s) => s.selectHero);
  const game = useGameStore((s) => s.game);
  const activate = useGameStore((s) => s.activate);
  const bench = useGameStore((s) => s.bench);

  const isActive = game?.activePartyIds.includes(hero.id) ?? false;
  const isLiving = hero.status === 'active';
  const canAct = game?.phase === 'assignment';
  const deps = game ? dependantsOf(game, hero.id) : [];
  const swapReason = game
    ? isActive
      ? benchError(game, hero.id)
      : activateError(game, hero.id)
    : 'unavailable';

  return (
    <div className="overlay" onClick={() => selectHero(null)}>
      <div className="panel hero-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="hero-sheet-head">
          <div className="hero-sheet-portrait">
            <Portrait hero={hero} />
          </div>
          <div>
            <h2>
              {hero.name} <span className="dim">{hero.epithet}</span>
            </h2>
            <p className="dim" style={{ fontSize: '0.78rem', margin: '0 0 4px' }}>
              {HERITAGE_LABEL[hero.heritage]}
            </p>
            <p className="dim" style={{ fontSize: '0.88rem' }}>{hero.bio}</p>
            <ConditionBars hero={hero} />
            {hero.status !== 'active' ? (
              <p className="bad">{hero.status === 'dead' ? '☠ Dead' : 'Departed'}</p>
            ) : (
              <div className="roster-badge-row">
                <span className={`roster-badge ${isActive ? 'active' : 'reserve'}`}>
                  {isActive ? 'Active party' : 'Reserve'}
                </span>
                {game && (
                  <button
                    className="small primary"
                    disabled={!canAct || swapReason !== null}
                    title={swapReason ?? (isActive ? 'Send to reserve' : 'Bring into the active party')}
                    onClick={() => (isActive ? bench(hero.id) : activate(hero.id))}
                  >
                    {isActive ? 'Bench' : 'Activate'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isLiving && deps.length > 0 && (
          <>
            <h3 style={{ marginTop: 14 }}>Family</h3>
            <div className="fam-row">
              {deps.map((d) => (
                <DependantTile key={d.id} dep={d} />
              ))}
            </div>
          </>
        )}

        <h3 style={{ marginTop: 14 }}>Stats</h3>
        <div className="skill-grid">
          {STAT_IDS.map((s) => (
            <div key={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)} <b>{hero.stats[s]}</b>
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: 14 }}>Skills</h3>
        <div className="skill-grid">
          {SKILL_IDS.map((s) => (
            <div key={s} className={hero.skillMarks.includes(s) ? 'marked' : ''}>
              {s.charAt(0).toUpperCase() + s.slice(1)} <b>{hero.skills[s]}</b>
              {hero.skillMarks.includes(s) && ' ✦'}
            </div>
          ))}
        </div>
        <p className="dim" style={{ fontSize: '0.75rem' }}>
          ✦ marked by successful use — rolls for improvement at season's end.
        </p>

        <h3>Traits</h3>
        <div>
          {hero.traits.length === 0 && <span className="dim">None yet. The frontier will fix that.</span>}
          {hero.traits.map((t) => {
            const def = TRAIT_DEFS.get(t);
            return (
              <span key={t} className="trait-tag" title={def?.description}>
                {def?.name ?? t}
              </span>
            );
          })}
        </div>

        {hero.history.length > 0 && (
          <>
            <h3 style={{ marginTop: 14 }}>History</h3>
            <div className="history-log">
              {hero.history.map((line, i) => (
                <div key={i}>— {line}</div>
              ))}
            </div>
          </>
        )}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => selectHero(null)}>Close</button>
        </div>
      </div>
    </div>
  );
}
