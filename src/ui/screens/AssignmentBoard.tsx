// Assignment Board (spec §11): standing orders persist between turns; the
// player tweaks what the situation demands and confirms.

import { useGameStore } from '../../store/gameStore';
import type { GameState, ActivityId } from '../../engine/types';
import { awayHeroIds, heroesAtPost, livingHeroes } from '../../engine/types';
import { LOCATION_NAMES } from '../../content/locations';
import { ConditionBars } from '../components/ConditionBars';

const ACTIVITIES: { id: ActivityId; label: string; hint: string; enabled: boolean }[] = [
  { id: 'trade', label: 'Trade', hint: 'Run the post market (Bargain check for the margin).', enabled: true },
  { id: 'provision', label: 'Provision', hint: 'Hunt and forage — offsets food costs (Survival).', enabled: true },
  { id: 'rest', label: 'Rest', hint: 'Recover health and stress; a chance to shake bad traits.', enabled: true },
  { id: 'build', label: 'Build', hint: 'Work the active construction project (Craft check).', enabled: true },
  {
    id: 'diplomacy',
    label: 'Diplomacy',
    hint: "Host the Company's factor at the post (Diplomacy check vs Ansberry standing).",
    enabled: true,
  },
];

export function AssignmentBoard({ game }: { game: GameState }) {
  const setAssignment = useGameStore((s) => s.setAssignment);
  const confirmTurn = useGameStore((s) => s.confirmTurn);
  const selectHero = useGameStore((s) => s.selectHero);
  const growthLines = useGameStore((s) => s.growthLines);
  const heroes = heroesAtPost(game);
  const away = awayHeroIds(game);
  const awayHeroes = livingHeroes(game).filter((h) => away.has(h.id));

  return (
    <div>
      {growthLines.length > 0 && (
        <div className="growth-banner">
          <b className="crit">Season's end — skills honed by use:</b>
          {growthLines.map((line, i) => (
            <div key={i}>📈 {line}</div>
          ))}
        </div>
      )}
      <h2>Assignments</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Standing orders persist between turns. Adjust who does what, then let the two weeks pass.
      </p>
      {heroes.map((hero) => {
        const current = game.assignments[hero.id] ?? 'unassigned';
        return (
          <div key={hero.id} className="assign-row">
            <div className="who">
              <div className="name" onClick={() => selectHero(hero.id)}>
                {hero.name} <span className="dim">{hero.epithet}</span>
              </div>
              <ConditionBars hero={hero} />
            </div>
            <div className="activity-buttons">
              {ACTIVITIES.map((a) => {
                const noProject = a.id === 'build' && game.construction === null;
                return (
                  <button
                    key={a.id}
                    className={current === a.id ? 'active' : ''}
                    disabled={!a.enabled || noProject || game.phase !== 'assignment'}
                    title={noProject ? 'No project — start one on the Post screen.' : a.hint}
                    onClick={() => setAssignment(hero.id, a.id)}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            {current === 'unassigned' && <span className="bad" title="This hero needs orders.">⚑ unassigned</span>}
          </div>
        );
      })}
      {awayHeroes.length > 0 && (
        <>
          <h3 style={{ marginTop: 14 }}>On the Road</h3>
          {awayHeroes.map((hero) => {
            const exp = game.expeditions.find((e) => e.heroIds.includes(hero.id));
            const dest = exp ? LOCATION_NAMES.get(exp.destination) ?? exp.destination : '';
            return (
              <div key={hero.id} className="assign-row">
                <div className="who">
                  <div className="name" onClick={() => selectHero(hero.id)}>
                    {hero.name} <span className="dim">{hero.epithet}</span>
                  </div>
                  <ConditionBars hero={hero} />
                </div>
                <span className="dim" style={{ fontSize: '0.85rem' }}>
                  {exp?.kind === 'caravan' ? '🐴 Caravan' : exp?.kind === 'explore' ? '🗺️ Scouting' : '🤝 Envoy'}{' '}
                  — {exp?.leg === 'outbound' ? `bound for ${dest}` : `returning from ${dest}`},{' '}
                  {exp?.turnsLeft} turn{exp?.turnsLeft === 1 ? '' : 's'} out
                </span>
              </div>
            );
          })}
        </>
      )}
      <div style={{ marginTop: 16 }}>
        <button className="primary" disabled={game.phase !== 'assignment'} onClick={confirmTurn}>
          Confirm Orders — Let Two Weeks Pass ▸
        </button>
      </div>
    </div>
  );
}
