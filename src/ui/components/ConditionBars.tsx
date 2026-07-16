import type { Hero } from '../../engine/types';

export function ConditionBars({ hero }: { hero: Hero }) {
  return (
    <div className="condition-bars">
      <span>
        Health
        <span className="bar health">
          <div style={{ width: `${hero.health * 10}%` }} />
        </span>
      </span>
      <span>
        Stress
        <span className="bar stress">
          <div style={{ width: `${hero.stress * 10}%` }} />
        </span>
      </span>
    </div>
  );
}
