// Buildings screen: the full construction management surface (start/cancel
// projects, tier advancement). The Outpost Overview shows only a summary and
// links here (BUILDINGS_SPEC.md §9).

import type { GameState } from '../../engine/types';
import { BuildingsPanel } from '../components/BuildingsPanel';

export function BuildingsScreen({ game }: { game: GameState }) {
  return (
    <div className="buildings-screen">
      <h2>Buildings &amp; Works</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Raise the outpost one project at a time — pay for it up front, then set heroes to
        <b> Build</b> until it stands.
      </p>
      <BuildingsPanel game={game} />
    </div>
  );
}
