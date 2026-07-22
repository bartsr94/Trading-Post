// Bottom hero bar (UI shell spec §3.3-3.4): every living hero as a portrait
// tile — hover/focus for condition & status, click for the Hero Sheet. Away
// heroes are dimmed with their expedition's marker. Portrait art (or its
// placeholder fallback) comes from Portrait.tsx.

import { LOCATION_NAMES } from '../../content/locations';
import { activeHeroes } from '../../engine/types';
import type { ExpeditionState, GameState, Hero } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { ConditionBars } from './ConditionBars';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Portrait } from './Portrait';

const KIND_ICONS: Record<ExpeditionState['kind'], IconName> = {
  caravan: 'caravan',
  explore: 'explore',
  diplomacy: 'diplomacy',
  labor: 'people',
  courtship: 'heart',
  raid: 'raid',
};

function StatusLine({
  game,
  hero,
  expedition,
}: {
  game: GameState;
  hero: Hero;
  expedition: ExpeditionState | undefined;
}) {
  if (expedition) {
    const dest = expedition.destination
      ? LOCATION_NAMES.get(expedition.destination) ?? expedition.destination
      : 'the frontier';
    const turns = `${expedition.turnsLeft} turn${expedition.turnsLeft === 1 ? '' : 's'}`;
    return (
      <>
        <Icon name={KIND_ICONS[expedition.kind]} size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
        {expedition.leg === 'outbound' ? `→ ${dest} (${turns})` : `${dest} → home (${turns})`}
      </>
    );
  }
  const activity = game.assignments[hero.id];
  return (
    <>{activity ? `Assigned: ${activity.charAt(0).toUpperCase()}${activity.slice(1)}` : 'At the post.'}</>
  );
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
          <Icon name={KIND_ICONS[expedition.kind]} size={16} />
        </span>
      )}
      <div className="hero-tooltip" role="tooltip">
        <div className="name">
          {hero.name} <span className="dim">{hero.epithet}</span>
        </div>
        <ConditionBars hero={hero} />
        <div className="status dim">
          <StatusLine game={game} hero={hero} expedition={expedition} />
        </div>
      </div>
    </div>
  );
}

export function HeroBar({ game }: { game: GameState }) {
  return (
    <footer className="hero-bar">
      {activeHeroes(game).map((hero) => (
        <HeroTile key={hero.id} game={game} hero={hero} />
      ))}
    </footer>
  );
}
