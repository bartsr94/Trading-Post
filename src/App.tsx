import { useGameStore } from './store/gameStore';
import { seasonOfTurn, yearOfTurn } from './engine/types';
import { AssignmentBoard } from './ui/screens/AssignmentBoard';
import { EventPanel } from './ui/screens/EventPanel';
import { GameOver } from './ui/screens/GameOver';
import { HeroSheet } from './ui/screens/HeroSheet';
import { MapScreen } from './ui/screens/MapScreen';
import { MarketScreen } from './ui/screens/MarketScreen';
import { PartySelect } from './ui/screens/PartySelect';
import { PostOverview } from './ui/screens/PostOverview';
import { TurnReport } from './ui/screens/TurnReport';
import { HeroBar } from './ui/components/HeroBar';
import { Sidebar } from './ui/components/Sidebar';

const SEASON_ICONS: Record<string, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
};

export function App() {
  const game = useGameStore((s) => s.game);
  const screen = useGameStore((s) => s.screen);
  const selectedHeroId = useGameStore((s) => s.selectedHeroId);

  if (!game) {
    return (
      <div className="page">
        <PartySelect />
      </div>
    );
  }
  if (game.phase === 'gameover') {
    return (
      <div className="page">
        <GameOver game={game} />
      </div>
    );
  }

  const selectedHero = selectedHeroId
    ? game.heroes.find((h) => h.id === selectedHeroId) ?? null
    : null;
  const season = seasonOfTurn(game.turn);

  return (
    <div className="app-shell">
      <Sidebar game={game} />

      <header className="top-bar">
        <span className="statchip">
          {SEASON_ICONS[season]} Turn {game.turn} — {season}, year {yearOfTurn(game.turn)}
        </span>
        <span className="statchip">🪙 {game.silver} silver</span>
      </header>

      <main className="content">
        <div className="content-inner">
          {screen === 'post' && <PostOverview game={game} />}
          {screen === 'assignments' && <AssignmentBoard game={game} />}
          {screen === 'map' && <MapScreen game={game} />}
          {screen === 'market' && <MarketScreen game={game} />}
        </div>
      </main>

      <HeroBar game={game} />

      {game.phase === 'event' && <EventPanel game={game} />}
      {game.phase === 'report' && <TurnReport game={game} />}
      {selectedHero && <HeroSheet hero={selectedHero} />}
    </div>
  );
}
