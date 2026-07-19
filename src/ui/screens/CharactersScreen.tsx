// Characters (CHARACTERS_SPEC.md §9): the named-character roster — the active
// party (≤ activeCap) and the reserve bench. Swap members in and out between
// turns; dependants (Phase C) nest under their character.

import { TUNING } from '../../content/tuning';
import {
  activateError,
  activeCap,
  benchError,
  dependantsOf,
} from '../../engine/roster';
import { activeHeroes, reserveHeroes } from '../../engine/types';
import type { Dependant, GameState, Hero } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConditionBars } from '../components/ConditionBars';
import { Portrait } from '../components/Portrait';

const DEPENDANT_LABEL: Record<Dependant['kind'], string> = {
  spouse: 'Spouse',
  child: 'Child',
  kin: 'Kin',
};

function DependantList({ game, hero }: { game: GameState; hero: Hero }) {
  const deps = dependantsOf(game, hero.id);
  if (deps.length === 0) return null;
  return (
    <div className="char-deps">
      {deps.map((d) => (
        <span key={d.id} className="char-dep" title={`${DEPENDANT_LABEL[d.kind]} — eats grain, does no work`}>
          {d.name} <span className="dim">({DEPENDANT_LABEL[d.kind].toLowerCase()})</span>
        </span>
      ))}
    </div>
  );
}

function CharacterCard({
  game,
  hero,
  reserve,
}: {
  game: GameState;
  hero: Hero;
  reserve: boolean;
}) {
  const selectHero = useGameStore((s) => s.selectHero);
  const activate = useGameStore((s) => s.activate);
  const bench = useGameStore((s) => s.bench);
  const canAct = game.phase === 'assignment';

  const reason = reserve ? activateError(game, hero.id) : benchError(game, hero.id);

  return (
    <div className={`char-card${reserve ? ' reserve' : ''}`}>
      <button className="hero-portrait" aria-label={hero.name} onClick={() => selectHero(hero.id)}>
        <Portrait hero={hero} />
      </button>
      <div className="char-body">
        <div className="name" onClick={() => selectHero(hero.id)}>
          {hero.name} <span className="dim">{hero.epithet}</span>
        </div>
        <ConditionBars hero={hero} />
        <DependantList game={game} hero={hero} />
        <div className="char-actions">
          <button
            className="small primary"
            disabled={!canAct || reason !== null}
            title={reason ?? (reserve ? 'Bring into the active party' : 'Send to the reserve bench')}
            onClick={() => (reserve ? activate(hero.id) : bench(hero.id))}
          >
            {reserve ? 'Activate' : 'Bench'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CharactersScreen({ game }: { game: GameState }) {
  const active = activeHeroes(game);
  const reserve = reserveHeroes(game);
  const cap = activeCap(game);

  return (
    <div>
      <h2>Characters</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        The active party works the post and takes the road; the reserve waits, kept and fed.
        Swap them between turns as the venture — and its people — change.
      </p>

      <div className="faction-row" style={{ maxWidth: 360 }}>
        <span>Active party</span>
        <span className={active.length >= cap ? 'dim' : 'good'}>
          {active.length} / {cap}
        </span>
      </div>
      {active.length === 0 && (
        <p className="bad" style={{ fontSize: '0.85rem' }}>
          No one is on active duty — bring someone up from the reserve, or nothing can be assigned.
        </p>
      )}

      <div className="roster-grid">
        {active.map((hero) => (
          <CharacterCard key={hero.id} game={game} hero={hero} reserve={false} />
        ))}
      </div>

      <h3 style={{ marginTop: 20 }}>
        Reserve{' '}
        <span className="dim" style={{ fontSize: '0.8rem' }}>
          ({reserve.length}) — {TUNING.roster.retainerWagePerReserve} silver retainer each, per season
        </span>
      </h3>
      {reserve.length === 0 ? (
        <p className="dim" style={{ fontSize: '0.85rem' }}>
          No one is on the bench. Recruits and retired hands will gather here as the campaign runs.
        </p>
      ) : (
        <div className="roster-grid">
          {reserve.map((hero) => (
            <CharacterCard key={hero.id} game={game} hero={hero} reserve />
          ))}
        </div>
      )}

      {game.phase !== 'assignment' && (
        <div className="dim" style={{ fontSize: '0.78rem', marginTop: 12 }}>
          Swap the roster during the assignment phase.
        </div>
      )}
    </div>
  );
}
