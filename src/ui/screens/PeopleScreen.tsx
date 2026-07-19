// People screen: the full unnamed-population management surface (hire,
// reallocate, idle assignment). The Outpost Overview shows only a summary and
// links here (RESIDENTS_SPEC.md §9).

import type { GameState } from '../../engine/types';
import { ResidentsPanel } from '../components/ResidentsPanel';

export function PeopleScreen({ game }: { game: GameState }) {
  return (
    <div className="manage-screen">
      <h2>The Outpost's People</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        The unnamed hands who work the outpost — hired from the towns or drawn in as it grows.
        Feed them, pay them, and keep them busy.
      </p>
      <ResidentsPanel game={game} />
    </div>
  );
}
