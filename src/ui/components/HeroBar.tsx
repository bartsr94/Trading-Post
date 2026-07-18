// Bottom hero bar (UI shell spec §3.3-3.4): every living hero as a portrait
// tile — hover/focus for condition & status, click for the Hero Sheet. Away
// heroes are dimmed with their expedition's marker. Portrait art (or its
// placeholder fallback) comes from Portrait.tsx.

import { LOCATION_NAMES } from '../../content/locations';
import { livingHeroes } from '../../engine/types';
import type { ExpeditionState, GameState, Hero } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConditionBars } from './ConditionBars';
import { Portrait } from './Portrait';

const KIND_ICONS: Record<ExpeditionState['kind'], string> = {
  caravan: '🐴',
  explore: '🗺️',
  diplomacy: '🤝',
};

function statusLine(game: GameState, hero: Hero, expedition: ExpeditionState | undefined): string {
  if (expedition) {
    const dest = LOCATION_NAMES.get(expedition.destination) ?? expedition.destination;
    const turns = `${expedition.turnsLeft} turn${expedition.turnsLeft === 1 ? '' : 's'}`;
    return expedition.leg === 'outbound'
      ? `${KIND_ICONS[expedition.kind]} → ${dest} (${turns})`
      : `${KIND_ICONS[expedition.kind]} ${dest} → home (${turns})`;
  }
  const activity = game.assignments[hero.id];
  return activity
    ? `Assigned: ${activity.charAt(0).toUpperCase()}${activity.slice(1)}`
    : 'At the post.';
}

function HeroTile({ game, hero }: { game: GameState; hero: Hero }) {
  const selectHero = useGameStore((s) => s.selectHero);
  const expedition = game.expeditions.find((e) => e.heroIds.includes(hero.id));

  return (
    <div className={`hero-tile${expedition ? ' away' : ''}`}>
      <button className="hero-portrait" aria-label={hero.name} onClick={() => selectHero(hero.id)}>
        <Portrait hero={hero} />
      </button>
      {expedition && (
        <span className="away-marker" aria-hidden="true">
          {KIND_ICONS[expedition.kind]}
        </span>
      )}
      <div className="hero-tooltip" role="tooltip">
        <div className="name">
          {hero.name} <span className="dim">{hero.epithet}</span>
        </div>
        <ConditionBars hero={hero} />
        <div className="status dim">{statusLine(game, hero, expedition)}</div>
      </div>
    </div>
  );
}

export function HeroBar({ game }: { game: GameState }) {
  return (
    <footer className="hero-bar">
      {livingHeroes(game).map((hero) => (
        <HeroTile key={hero.id} game={game} hero={hero} />
      ))}
    </footer>
  );
}
