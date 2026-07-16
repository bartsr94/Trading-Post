// Failure states get a proper narrative ending screen, not just "Game Over".

import { seasonOfTurn, yearOfTurn } from '../../engine/types';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

export function GameOver({ game }: { game: GameState }) {
  const abandonGame = useGameStore((s) => s.abandonGame);
  if (!game.gameOver) return null;
  const survivors = game.heroes.filter((h) => h.status === 'active');
  const dead = game.heroes.filter((h) => h.status === 'dead');
  const departed = game.heroes.filter((h) => h.status === 'departed');

  return (
    <div className="gameover panel">
      <h1>{game.gameOver.title}</h1>
      <div className="ending-text">{game.gameOver.text}</div>
      <div className="dim" style={{ fontSize: '0.9rem', marginBottom: 20 }}>
        <div>
          The venture ended in {seasonOfTurn(game.turn)} of year {yearOfTurn(game.turn)}, turn{' '}
          {game.turn}.
        </div>
        {survivors.length > 0 && <div>Went home: {survivors.map((h) => h.name).join(', ')}</div>}
        {departed.length > 0 && <div>Left before the end: {departed.map((h) => h.name).join(', ')}</div>}
        {dead.length > 0 && <div>Buried on the frontier: {dead.map((h) => h.name).join(', ')}</div>}
        <div>Final silver: {game.silver}</div>
      </div>
      <button className="primary" onClick={abandonGame}>
        Begin a New Venture
      </button>
    </div>
  );
}
