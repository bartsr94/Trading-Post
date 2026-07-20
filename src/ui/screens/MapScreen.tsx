// Map (spec §11): stylized SVG node graph with fog on unknown nodes.
// Explore parties are dispatched from here; caravans from the Market screen.

import { useState } from 'react';
import { FACTION_DEFS } from '../../content/factions';
import { LOCATIONS, LOCATION_DEFS } from '../../content/locations';
import { dispatchError, laborRunCost } from '../../engine/expeditions';
import { discoveryAtLeast, heroesAtPost, stanceOf } from '../../engine/types';
import type { GameState, LocationDef } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { TUNING } from '../../content/tuning';

const DISCOVERY_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  rumored: 'Rumored',
  visited: 'Visited',
  known: 'Well known',
};

function nodeVisible(game: GameState, def: LocationDef): boolean {
  const loc = game.locations[def.id];
  return loc !== undefined && loc.discovery !== 'unknown';
}

export function MapScreen({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [party, setParty] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [envoyParty, setEnvoyParty] = useState<string[]>([]);
  const [envoyError, setEnvoyError] = useState<string | null>(null);
  const [laborParty, setLaborParty] = useState<string[]>([]);
  const [laborCount, setLaborCount] = useState(1);
  const [laborError, setLaborError] = useState<string | null>(null);
  const [matchHeroId, setMatchHeroId] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const available = heroesAtPost(game);
  const selected = selectedId ? LOCATION_DEFS.get(selectedId) ?? null : null;
  const selectedLoc = selected ? game.locations[selected.id] : undefined;

  const toggleHero = (heroId: string) => {
    setError(null);
    setParty((prev) =>
      prev.includes(heroId)
        ? prev.filter((id) => id !== heroId)
        : prev.length < TUNING.map.maxExpeditionHeroes
          ? [...prev, heroId]
          : prev,
    );
  };

  const toggleEnvoy = (heroId: string) => {
    setEnvoyError(null);
    setEnvoyParty((prev) =>
      prev.includes(heroId)
        ? prev.filter((id) => id !== heroId)
        : prev.length < TUNING.map.maxExpeditionHeroes
          ? [...prev, heroId]
          : prev,
    );
  };

  const sendScouts = () => {
    if (!selected) return;
    const params = { kind: 'explore' as const, destination: selected.id, heroIds: party };
    const reason = dispatchError(game, params, LOCATION_DEFS);
    if (reason) {
      setError(reason);
      return;
    }
    if (dispatch(params)) {
      setParty([]);
      setError(null);
    }
  };

  const sendEnvoy = () => {
    if (!selected) return;
    const params = { kind: 'diplomacy' as const, destination: selected.id, heroIds: envoyParty };
    const reason = dispatchError(game, params, LOCATION_DEFS);
    if (reason) {
      setEnvoyError(reason);
      return;
    }
    if (dispatch(params)) {
      setEnvoyParty([]);
      setEnvoyError(null);
    }
  };

  const toggleLabor = (heroId: string) => {
    setLaborError(null);
    setLaborParty((prev) =>
      prev.includes(heroId)
        ? prev.filter((id) => id !== heroId)
        : prev.length < TUNING.map.maxExpeditionHeroes
          ? [...prev, heroId]
          : prev,
    );
  };

  const callForHands = () => {
    if (!selected) return;
    const params = {
      kind: 'labor' as const,
      destination: selected.id,
      heroIds: laborParty,
      laborCount,
    };
    const reason = dispatchError(game, params, LOCATION_DEFS);
    if (reason) {
      setLaborError(reason);
      return;
    }
    if (dispatch(params)) {
      setLaborParty([]);
      setLaborCount(1);
      setLaborError(null);
    }
  };

  const seekMatch = () => {
    if (!selected || !matchHeroId) return;
    const params = {
      kind: 'courtship' as const,
      destination: selected.id,
      heroIds: [matchHeroId],
      courtshipFor: matchHeroId,
    };
    const reason = dispatchError(game, params, LOCATION_DEFS);
    if (reason) {
      setMatchError(reason);
      return;
    }
    if (dispatch(params)) {
      setMatchHeroId(null);
      setMatchError(null);
    }
  };

  const canExplore =
    selected !== undefined &&
    selected !== null &&
    selectedLoc !== undefined &&
    selected.id !== TUNING.map.homeLocationId &&
    selectedLoc.discovery !== 'known';

  const canSendEnvoy =
    selected !== undefined &&
    selected !== null &&
    selectedLoc !== undefined &&
    selected.faction !== undefined &&
    discoveryAtLeast(selectedLoc.discovery, 'visited');

  const canCallHands =
    selected !== undefined &&
    selected !== null &&
    selectedLoc !== undefined &&
    selected.faction === 'CHARTER_COMPANY' &&
    discoveryAtLeast(selectedLoc.discovery, 'visited');

  return (
    <div className="map-layout">
      <div className="panel map-panel">
        <svg viewBox="0 0 100 100" className="map-svg">
          {/* Edges between mutually discovered nodes. */}
          {LOCATIONS.flatMap((def) =>
            def.connections
              .filter((otherId) => def.id < otherId)
              .map((otherId) => {
                const other = LOCATION_DEFS.get(otherId);
                if (!other || !nodeVisible(game, def) || !nodeVisible(game, other)) return null;
                return (
                  <line
                    key={`${def.id}-${otherId}`}
                    x1={def.mapX}
                    y1={def.mapY}
                    x2={other.mapX}
                    y2={other.mapY}
                    className="map-edge"
                  />
                );
              }),
          )}
          {LOCATIONS.map((def) => {
            const loc = game.locations[def.id];
            if (!loc || loc.discovery === 'unknown') return null;
            const isHome = def.id === TUNING.map.homeLocationId;
            const isSelected = selectedId === def.id;
            const expeditionHere = game.expeditions.find((e) => e.destination === def.id);
            return (
              <g
                key={def.id}
                className={`map-node ${loc.discovery} ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedId(def.id);
                  setError(null);
                }}
              >
                <circle cx={def.mapX} cy={def.mapY} r={isHome ? 4 : 3} />
                <text x={def.mapX} y={def.mapY - (isHome ? 5.5 : 4.5)} className="map-label">
                  {loc.discovery === 'rumored' ? `${def.name}?` : def.name}
                </text>
                {expeditionHere && (
                  <text x={def.mapX + 3.5} y={def.mapY + 1.4} className="map-marker">
                    {expeditionHere.kind === 'caravan'
                      ? '🐴'
                      : expeditionHere.kind === 'explore'
                        ? '🗺️'
                        : expeditionHere.kind === 'labor'
                          ? '📜'
                          : '🤝'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="dim" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>
          Rumored places bear a question mark. Exploring spreads word of what lies beyond.
        </p>
      </div>

      <div className="panel">
        {!selected || !selectedLoc ? (
          <>
            <h3>The Country</h3>
            <p className="dim">Select a place on the map.</p>
            {game.expeditions.length > 0 && <h3 style={{ marginTop: 14 }}>On the Road</h3>}
            {game.expeditions.map((exp) => {
              const def = LOCATION_DEFS.get(exp.destination);
              return (
                <div key={exp.id} className="faction-row">
                  <span>
                    {exp.kind === 'caravan'
                      ? '🐴'
                      : exp.kind === 'explore'
                        ? '🗺️'
                        : exp.kind === 'labor'
                          ? '📜'
                          : '🤝'}{' '}
                    {exp.heroIds
                      .map((id) => game.heroes.find((h) => h.id === id)?.name ?? id)
                      .join(' & ')}
                  </span>
                  <span className="dim">
                    {exp.leg === 'outbound' ? `→ ${def?.name}` : `${def?.name} → home`} (
                    {exp.turnsLeft} turn{exp.turnsLeft === 1 ? '' : 's'})
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <>
            <h3>{selectedLoc.discovery === 'rumored' ? `${selected.name} (rumored)` : selected.name}</h3>
            <p className="dim" style={{ fontSize: '0.88rem' }}>
              {selectedLoc.discovery === 'rumored'
                ? 'You know it only from talk around the fire.'
                : selected.blurb}
            </p>
            <div style={{ fontSize: '0.88rem' }}>
              <div className="faction-row">
                <span>Discovery</span>
                <span className="dim">{DISCOVERY_LABELS[selectedLoc.discovery]}</span>
              </div>
              {selected.id !== TUNING.map.homeLocationId && (
                <div className="faction-row">
                  <span>Journey</span>
                  <span className="dim">
                    {selected.travelTurns} turn{selected.travelTurns === 1 ? '' : 's'} out
                  </span>
                </div>
              )}
              {selected.faction && discoveryAtLeast(selectedLoc.discovery, 'visited') && (
                <div className="faction-row">
                  <span>{FACTION_DEFS.get(selected.faction)?.name}</span>
                  <span className="dim">{stanceOf(game.factions[selected.faction].standing)}</span>
                </div>
              )}
              {selected.hasMarket && discoveryAtLeast(selectedLoc.discovery, 'visited') && (
                <div className="faction-row">
                  <span>Market</span>
                  <span className="dim">Send caravans from the Market screen</span>
                </div>
              )}
            </div>

            {canExplore && (
              <>
                <h3 style={{ marginTop: 14 }}>Send Scouts</h3>
                <p className="dim" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>
                  Pick up to {TUNING.map.maxExpeditionHeroes} heroes. They will be away{' '}
                  {selected.travelTurns * 2} turns or more.
                </p>
                {available.map((hero) => (
                  <label key={hero.id} className="pick-row">
                    <input
                      type="checkbox"
                      checked={party.includes(hero.id)}
                      onChange={() => toggleHero(hero.id)}
                    />{' '}
                    {hero.name} <span className="dim">(Survival {hero.skills.survival})</span>
                  </label>
                ))}
                {error && <div className="bad" style={{ fontSize: '0.85rem', margin: '6px 0' }}>{error}</div>}
                <button
                  className="primary"
                  style={{ marginTop: 8 }}
                  disabled={game.phase !== 'assignment' || party.length === 0}
                  onClick={sendScouts}
                >
                  Send the Party ▸
                </button>
                {game.phase !== 'assignment' && (
                  <div className="dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Parties set out during the assignment phase.
                  </div>
                )}
              </>
            )}

            {canSendEnvoy && (
              <>
                <h3 style={{ marginTop: 14 }}>Send Envoy</h3>
                <p className="dim" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>
                  Pick up to {TUNING.map.maxExpeditionHeroes} heroes to treat with{' '}
                  {FACTION_DEFS.get(selected.faction!)?.name}. They will be away{' '}
                  {selected.travelTurns * 2} turns or more.
                </p>
                {available.map((hero) => (
                  <label key={hero.id} className="pick-row">
                    <input
                      type="checkbox"
                      checked={envoyParty.includes(hero.id)}
                      onChange={() => toggleEnvoy(hero.id)}
                    />{' '}
                    {hero.name} <span className="dim">(Diplomacy {hero.skills.diplomacy})</span>
                  </label>
                ))}
                {envoyError && (
                  <div className="bad" style={{ fontSize: '0.85rem', margin: '6px 0' }}>{envoyError}</div>
                )}
                <button
                  className="primary"
                  style={{ marginTop: 8 }}
                  disabled={game.phase !== 'assignment' || envoyParty.length === 0}
                  onClick={sendEnvoy}
                >
                  Send the Envoy ▸
                </button>
                {game.phase !== 'assignment' && (
                  <div className="dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Envoys set out during the assignment phase.
                  </div>
                )}
              </>
            )}

            {canCallHands && (
              <>
                <h3 style={{ marginTop: 14 }}>Call for Hands</h3>
                <p className="dim" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>
                  Send to Thornwatch for homeland laborers — dearer than local hands, and away{' '}
                  {selected.travelTurns * 2} turns, but they keep the post Imanian.
                </p>
                {available.map((hero) => (
                  <label key={hero.id} className="pick-row">
                    <input
                      type="checkbox"
                      checked={laborParty.includes(hero.id)}
                      onChange={() => toggleLabor(hero.id)}
                    />{' '}
                    {hero.name}
                  </label>
                ))}
                <div className="faction-row" style={{ marginTop: 6 }}>
                  <span>Hands</span>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="small"
                      disabled={laborCount <= 1}
                      onClick={() => setLaborCount((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <b>{laborCount}</b>
                    <button className="small" onClick={() => setLaborCount((n) => n + 1)}>
                      +
                    </button>
                  </span>
                </div>
                <div className="faction-row">
                  <span className="dim">Recruiters' fee</span>
                  <span className="dim">{laborRunCost(laborCount)} silver</span>
                </div>
                {laborError && (
                  <div className="bad" style={{ fontSize: '0.85rem', margin: '6px 0' }}>{laborError}</div>
                )}
                <button
                  className="primary"
                  style={{ marginTop: 8 }}
                  disabled={game.phase !== 'assignment' || laborParty.length === 0}
                  onClick={callForHands}
                >
                  Send for Hands ▸
                </button>
                {game.phase !== 'assignment' && (
                  <div className="dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Parties set out during the assignment phase.
                  </div>
                )}
              </>
            )}

            {canCallHands && (
              <>
                <h3 style={{ marginTop: 14 }}>Seek a Match</h3>
                <p className="dim" style={{ fontSize: '0.8rem', margin: '0 0 6px' }}>
                  Send one of the company to Thornwatch to bring a certified homeland
                  spouse upriver — dear, and away {selected.travelTurns * 2} turns, but
                  the Company approves and the line stays Imanian.
                </p>
                {available.map((hero) => (
                  <label key={hero.id} className="pick-row">
                    <input
                      type="radio"
                      name="match-hero"
                      checked={matchHeroId === hero.id}
                      onChange={() => {
                        setMatchHeroId(hero.id);
                        setMatchError(null);
                      }}
                    />{' '}
                    {hero.name}
                  </label>
                ))}
                <div className="faction-row" style={{ marginTop: 6 }}>
                  <span className="dim">Bride-price</span>
                  <span className="dim">{TUNING.family.homelandBridePrice} silver</span>
                </div>
                {matchError && (
                  <div className="bad" style={{ fontSize: '0.85rem', margin: '6px 0' }}>{matchError}</div>
                )}
                <button
                  className="primary"
                  style={{ marginTop: 8 }}
                  disabled={game.phase !== 'assignment' || matchHeroId === null}
                  onClick={seekMatch}
                >
                  Send for a Match ▸
                </button>
                {game.phase !== 'assignment' && (
                  <div className="dim" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    Parties set out during the assignment phase.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
