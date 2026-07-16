// Hero Sheet (spec §11): stats, skills, traits, condition, personal history.

import { TRAIT_DEFS } from '../../content/traits';
import { SKILL_IDS, STAT_IDS } from '../../engine/types';
import type { Hero } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConditionBars } from '../components/ConditionBars';

export function HeroSheet({ hero }: { hero: Hero }) {
  const selectHero = useGameStore((s) => s.selectHero);

  return (
    <div className="overlay" onClick={() => selectHero(null)}>
      <div className="panel hero-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>
          {hero.name} <span className="dim">{hero.epithet}</span>
        </h2>
        <p className="dim" style={{ fontSize: '0.88rem' }}>{hero.bio}</p>
        <ConditionBars hero={hero} />
        {hero.status !== 'active' && (
          <p className="bad">{hero.status === 'dead' ? '☠ Dead' : 'Departed'}</p>
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
