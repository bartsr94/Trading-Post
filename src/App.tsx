import { useGameStore } from './store/gameStore';
import { seasonOfTurn, yearOfTurn, livingHeroes } from './engine/types';
import { AssignmentBoard } from './ui/screens/AssignmentBoard';
import { EventPanel } from './ui/screens/EventPanel';
import { GameOver } from './ui/screens/GameOver';
import { HeroSheet } from './ui/screens/HeroSheet';
import { PartySelect } from './ui/screens/PartySelect';
import { PostOverview } from './ui/screens/PostOverview';
import { TurnReport } from './ui/screens/TurnReport';
import { ConditionBars } from './ui/components/ConditionBars';

const SEASON_ICONS: Record<string, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

function HeroesScreen() {
  const game = useGameStore((s) => s.game)!;
  const selectHero = useGameStore((s) => s.selectHero);
  return (
    <div>
      <h2>The Company</h2>
      {game.heroes.map((hero) => (
        <div key={hero.id} className="assign-row" style={{ cursor: 'pointer' }} onClick={() => selectHero(hero.id)}>
          <div className="who">
            <div className="name">
              {hero.name} <span className="dim">{hero.epithet}</span>
            </div>
            {hero.status === 'active' ? (
              <ConditionBars hero={hero} />
            ) : (
              <span className="bad">{hero.status === 'dead' ? '☠ Dead' : 'Departed'}</span>
            )}
          </div>
          <span className="dim" style={{ fontSize: '0.85rem' }}>
            {hero.history.length > 0 ? hero.history[hero.history.length - 1] : 'No notable deeds yet.'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const game = useGameStore((s) => s.game);
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const selectedHeroId = useGameStore((s) => s.selectedHeroId);
  const exportSave = useGameStore((s) => s.exportSave);
  const abandonGame = useGameStore((s) => s.abandonGame);

  if (!game) return <PartySelect />;
  if (game.phase === 'gameover') return <GameOver game={game} />;

  const selectedHero = selectedHeroId
    ? game.heroes.find((h) => h.id === selectedHeroId) ?? null
    : null;
  const season = seasonOfTurn(game.turn);

  const onExport = () => {
    const json = exportSave();
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-post-turn-${game.turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <header className="app-header">
        <span className="title">The Trading Post</span>
        <span className="statchip">
          {SEASON_ICONS[season]} Turn {game.turn} — {season}, year {yearOfTurn(game.turn)}
        </span>
        <span className="statchip">🪙 {game.silver} silver</span>
        <span className="statchip">🧑‍🤝‍🧑 {livingHeroes(game).length} heroes</span>
        <span className="spacer" />
        <button className="small" onClick={onExport}>Export Save</button>
        <button
          className="small"
          onClick={() => {
            if (window.confirm('Abandon this venture? The autosave will be deleted.')) abandonGame();
          }}
        >
          Abandon
        </button>
      </header>

      <nav className="nav-tabs">
        <button className={screen === 'post' ? 'active' : ''} onClick={() => setScreen('post')}>
          Post
        </button>
        <button
          className={screen === 'assignments' ? 'active' : ''}
          onClick={() => setScreen('assignments')}
        >
          Assignments {game.phase === 'assignment' ? '●' : ''}
        </button>
        <button className={screen === 'heroes' ? 'active' : ''} onClick={() => setScreen('heroes')}>
          Heroes
        </button>
      </nav>

      {screen === 'post' && <PostOverview game={game} />}
      {screen === 'assignments' && <AssignmentBoard game={game} />}
      {screen === 'heroes' && <HeroesScreen />}

      {game.phase === 'event' && <EventPanel game={game} />}
      {game.phase === 'report' && <TurnReport game={game} />}
      {selectedHero && <HeroSheet hero={selectedHero} />}
    </div>
  );
}
