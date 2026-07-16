// Assignment Board (spec §11): standing orders persist between turns; the
// player tweaks what the situation demands and confirms.

import { useGameStore } from '../../store/gameStore';
import type { GameState, ActivityId } from '../../engine/types';
import { livingHeroes } from '../../engine/types';
import { ConditionBars } from '../components/ConditionBars';

const ACTIVITIES: { id: ActivityId; label: string; hint: string; enabled: boolean }[] = [
  { id: 'trade', label: 'Trade', hint: 'Run the post market (Bargain check for the margin).', enabled: true },
  { id: 'provision', label: 'Provision', hint: 'Hunt and forage — offsets food costs (Survival).', enabled: true },
  { id: 'rest', label: 'Rest', hint: 'Recover health and stress; a chance to shake bad traits.', enabled: true },
  { id: 'build', label: 'Build', hint: 'Construction arrives with MVP 2.', enabled: false },
  { id: 'explore', label: 'Explore', hint: 'The map arrives with MVP 2.', enabled: false },
  { id: 'diplomacy', label: 'Diplomacy', hint: 'Faction visits arrive with MVP 2.', enabled: false },
];

export function AssignmentBoard({ game }: { game: GameState }) {
  const setAssignment = useGameStore((s) => s.setAssignment);
  const confirmTurn = useGameStore((s) => s.confirmTurn);
  const selectHero = useGameStore((s) => s.selectHero);
  const growthLines = useGameStore((s) => s.growthLines);
  const heroes = livingHeroes(game);

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
              {ACTIVITIES.map((a) => (
                <button
                  key={a.id}
                  className={current === a.id ? 'active' : ''}
                  disabled={!a.enabled || game.phase !== 'assignment'}
                  title={a.hint}
                  onClick={() => setAssignment(hero.id, a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {current === 'unassigned' && <span className="bad" title="This hero needs orders.">⚑ unassigned</span>}
          </div>
        );
      })}
      <div style={{ marginTop: 16 }}>
        <button className="primary" disabled={game.phase !== 'assignment'} onClick={confirmTurn}>
          Confirm Orders — Let Two Weeks Pass ▸
        </button>
      </div>
    </div>
  );
}
