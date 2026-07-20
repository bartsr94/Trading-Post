// Characters (CHARACTERS_SPEC.md §9): the named-character roster — the active
// party (≤ activeCap) and the reserve bench. Swap members in and out between
// turns; each character's family (FAMILY_SPEC.md §10) shows as a strip that
// opens the full multi-generational tree.

import { useState } from 'react';
import { TUNING } from '../../content/tuning';
import { activateError, activeCap, benchError } from '../../engine/roster';
import { childrenOf, householdMembers, spousesOf } from '../../engine/family';
import { activeHeroes, reserveHeroes } from '../../engine/types';
import type { GameState, Hero, UnionSource } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConditionBars } from '../components/ConditionBars';
import { FamilyTree } from '../components/FamilyTree';
import { Portrait } from '../components/Portrait';

const UNION_BADGE: Record<UnionSource, string> = {
  homeland: 'Homeland',
  alliance: 'Allied',
  informal: 'Household',
};

function FamilyStrip({
  game,
  hero,
  onOpen,
}: {
  game: GameState;
  hero: Hero;
  onOpen: () => void;
}) {
  const spouses = spousesOf(game, hero.id);
  const household = householdMembers(game, hero.id);
  const children = childrenOf(game, hero.id);
  const kin = household.filter((d) => d.kind === 'kin' && d.comeOfAge);
  const hasFamily = spouses.length > 0 || household.length > 0;
  if (!hasFamily) return null;

  return (
    <div className="char-family">
      {spouses.map((s) => (
        <span key={s.id} className="char-dep" title="Spouse — eats grain, does no work">
          {s.name}
          {!('stats' in s) && s.union && (
            <span className="union-badge"> {UNION_BADGE[s.union]}</span>
          )}
        </span>
      ))}
      {children.length > 0 && (
        <span className="dim">
          {children.length} child{children.length === 1 ? '' : 'ren'}
        </span>
      )}
      {kin.length > 0 && <span className="dim">{kin.length} grown kin</span>}
      <button className="small link-btn" onClick={onOpen}>
        Family tree ▸
      </button>
    </div>
  );
}

function CharacterCard({
  game,
  hero,
  reserve,
  onOpenFamily,
}: {
  game: GameState;
  hero: Hero;
  reserve: boolean;
  onOpenFamily: (headId: string) => void;
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
          <span className="dim"> {hero.gender === 'female' ? '♀' : '♂'}</span>
          {hero.bloodline && (
            <span className={`ft-blood ${hero.bloodline}`}>
              {hero.bloodline === 'pure' ? 'Pure' : 'Mixed'}
            </span>
          )}
        </div>
        <ConditionBars hero={hero} />
        <FamilyStrip game={game} hero={hero} onOpen={() => onOpenFamily(hero.id)} />
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
  const [familyHead, setFamilyHead] = useState<string | null>(null);

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
          <CharacterCard
            key={hero.id}
            game={game}
            hero={hero}
            reserve={false}
            onOpenFamily={setFamilyHead}
          />
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
            <CharacterCard
              key={hero.id}
              game={game}
              hero={hero}
              reserve
              onOpenFamily={setFamilyHead}
            />
          ))}
        </div>
      )}

      {game.phase !== 'assignment' && (
        <div className="dim" style={{ fontSize: '0.78rem', marginTop: 12 }}>
          Swap the roster during the assignment phase.
        </div>
      )}

      {familyHead && (
        <FamilyTree game={game} headId={familyHead} onClose={() => setFamilyHead(null)} />
      )}
    </div>
  );
}
