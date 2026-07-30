// The face(s) an event is actually about, overlaid on the illustration
// corner (EVENT_CAST_PORTRAITS_SPEC.md). Purely presentational — reuses
// Portrait.tsx as-is, no engine data beyond the Hero records the caller
// already resolved.

import type { Hero } from '../../engine/types';
import { Portrait } from './Portrait';

export function EventCast({ heroes }: { heroes: Hero[] }) {
  if (heroes.length === 0) return null;
  return (
    <div className="event-cast">
      {heroes.map((hero) => (
        <div className="event-cast-chip" key={hero.id}>
          <div className="event-cast-portrait">
            <Portrait hero={hero} />
          </div>
          <span className="event-cast-name">{hero.name}</span>
        </div>
      ))}
    </div>
  );
}
