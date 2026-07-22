import { useMemo, useRef, useState } from 'react';
import ashmarkMap from '../../assets/ui/ashmark_map.jpg';
import { FACTION_DEFS } from '../../content/factions';
import { LOCATIONS, LOCATION_DEFS } from '../../content/locations';
import { MAP_REGIONS } from '../../content/map';
import { TUNING } from '../../content/tuning';
import { diplomacySeatState } from '../../engine/diplomacy';
import { cargoCapacity, dispatchError, laborRunCost } from '../../engine/expeditions';
import {
  journeyTurns,
  mapCellCenter,
  mapCellCoordinates,
  pointReachable,
  regionAt,
  rumorArea,
} from '../../engine/map';
import { canCallRaidAlly, raidTargetFaction } from '../../engine/raids';
import { residentsAvailable } from '../../engine/residents';
import { discoveryAtLeast, heroesAtPost, stanceOf } from '../../engine/types';
import type {
  FactionId,
  ExpeditionPace,
  GameState,
  LocationDef,
  MapPoint,
  RaidAttackGoal,
  RaidManeuver,
  ResidentRole,
} from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

const MAP_W = 1000;
const MAP_H = 750;
const DISCOVERY_LABELS = {
  unknown: 'Unknown',
  rumored: 'Rumored',
  visited: 'Visited',
  known: 'Well known',
} as const;

type PlaceAction = 'explore' | 'diplomacy' | 'labor' | 'courtship' | 'raid';
type PanelMode = 'explore' | 'place' | 'road';
type FogCell = { index: number; points: string };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function svgPoint(point: MapPoint): { x: number; y: number } {
  return { x: point.x * MAP_W, y: point.y * MAP_H };
}

function hexPolygonPoints(centerX: number, centerY: number, radiusX: number, radiusY: number): string {
  return [
    [centerX - radiusX, centerY],
    [centerX - radiusX * 0.5, centerY - radiusY],
    [centerX + radiusX * 0.5, centerY - radiusY],
    [centerX + radiusX, centerY],
    [centerX + radiusX * 0.5, centerY + radiusY],
    [centerX - radiusX * 0.5, centerY + radiusY],
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
}

function expeditionName(game: GameState, heroIds: string[]): string {
  return heroIds.map((id) => game.heroes.find((hero) => hero.id === id)?.name ?? id).join(' & ');
}

export function MapScreen({ game }: { game: GameState }) {
  const dispatch = useGameStore((state) => state.dispatch);
  const [mode, setMode] = useState<PanelMode>('explore');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [target, setTarget] = useState<MapPoint | null>(null);
  const [pace, setPace] = useState<ExpeditionPace>('normal');
  const [party, setParty] = useState<string[]>([]);
  const [placeAction, setPlaceAction] = useState<PlaceAction>('explore');
  const [laborCount, setLaborCount] = useState(1);
  const [raidGoal, setRaidGoal] = useState<RaidAttackGoal>('plunder');
  const [raidManeuver, setRaidManeuver] = useState<RaidManeuver>('skirmish');
  const [raidRally, setRaidRally] = useState(false);
  const [raidAlly, setRaidAlly] = useState<FactionId | ''>('');
  const [raidEscort, setRaidEscort] = useState<Partial<Record<ResidentRole, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);
  const draggedRef = useRef(false);

  const available = heroesAtPost(game);
  const selected = selectedId ? LOCATION_DEFS.get(selectedId) ?? null : null;
  const selectedLoc = selected ? game.locations[selected.id] : undefined;
  const selectedSeat = selected && selected.faction ? diplomacySeatState(game, selected) : null;
  const home = LOCATION_DEFS.get(TUNING.map.homeLocationId)!;
  const activeTarget = selected?.mapPoint ?? target;
  const activeRegion = activeTarget ? regionAt(activeTarget, MAP_REGIONS) : undefined;
  const oneWay = activeTarget ? journeyTurns(home.mapPoint, activeTarget, pace) : null;
  const raidFaction = selected ? raidTargetFaction(selected) : null;
  const allyOptions = [...FACTION_DEFS.values()].filter((faction) =>
    canCallRaidAlly(game, faction.id, raidFaction),
  );
  const portersFree = residentsAvailable(game, 'porters');
  const guardsFree = residentsAvailable(game, 'guards');
  const raidCapacity = cargoCapacity(Math.max(1, party.length), raidEscort);

  const surveyed = useMemo(
    () => new Set(game.mapKnowledge?.surveyedCells ?? []),
    [game.mapKnowledge?.surveyedCells],
  );
  const fogLayers = useMemo(() => {
    const { width, height } = TUNING.map.fogGrid;
    const cellWidth = MAP_W / width;
    const cellHeight = MAP_H / height;
    const radiusX = cellWidth * 0.72;
    const radiusY = cellHeight * 0.62;
    const reachable: FogCell[] = [];
    const locked: FogCell[] = [];

    for (let index = 0; index < width * height; index += 1) {
      if (surveyed.has(index)) continue;
      const point = mapCellCenter(index);
      const coords = mapCellCoordinates(index);
      const rowOffset = (coords.y % 2 === 0 ? -1 : 1) * cellWidth * 0.16;
      const centerX = ((coords.x + 0.5) / width) * MAP_W + rowOffset;
      const centerY = ((coords.y + 0.5) / height) * MAP_H;
      const cell = {
        index,
        points: hexPolygonPoints(centerX, centerY, radiusX, radiusY),
      };
      if (pointReachable(game, point, MAP_REGIONS)) reachable.push(cell);
      else locked.push(cell);
    }

    return { reachable, locked };
  }, [game, surveyed]);

  const viewWidth = MAP_W / zoom;
  const viewHeight = MAP_H / zoom;
  const viewX = clamp(center.x * MAP_W - viewWidth / 2, 0, MAP_W - viewWidth);
  const viewY = clamp(center.y * MAP_H - viewHeight / 2, 0, MAP_H - viewHeight);

  const setZoomClamped = (next: number) => setZoom(clamp(next, 1, 3));
  const resetView = () => {
    setZoom(1);
    setCenter({ x: 0.5, y: 0.5 });
  };

  const pointerToMap = (clientX: number, clientY: number): MapPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: clamp(point.x / MAP_W, 0, 1), y: clamp(point.y / MAP_H, 0, 1) };
  };

  const chooseFreeTarget = (point: MapPoint) => {
    setSelectedId(null);
    setTarget(point);
    setMode('explore');
    setPlaceAction('explore');
    setError(
      pointReachable(game, point, MAP_REGIONS)
        ? null
        : 'This country lies beyond your known routes.',
    );
  };

  const chooseLocation = (def: LocationDef) => {
    setSelectedId(def.id);
    setTarget(def.mapPoint);
    setMode('place');
    setPlaceAction('explore');
    setError(null);
  };

  const chooseRumorTarget = (def: LocationDef, approximate: MapPoint) => {
    let point = approximate;
    // A deterministic rumor offset can fall just across an access boundary.
    // If the real place's region is reachable, pull the approximation inward
    // without snapping to or revealing the exact point.
    if (!pointReachable(game, point, MAP_REGIONS) && pointReachable(game, def.mapPoint, MAP_REGIONS)) {
      for (const fraction of [0.25, 0.5, 0.75]) {
        const candidate = {
          x: approximate.x + (def.mapPoint.x - approximate.x) * fraction,
          y: approximate.y + (def.mapPoint.y - approximate.y) * fraction,
        };
        if (pointReachable(game, candidate, MAP_REGIONS)) {
          point = candidate;
          break;
        }
      }
    }
    chooseFreeTarget(point);
  };

  const toggleHero = (heroId: string) => {
    setError(null);
    setParty((current) =>
      current.includes(heroId)
        ? current.filter((id) => id !== heroId)
        : current.length < TUNING.map.maxExpeditionHeroes
          ? [...current, heroId]
          : current,
    );
  };

  const setEscortQty = (role: ResidentRole, raw: string, max: number) => {
    setError(null);
    const qty = Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)));
    setRaidEscort((current) => ({ ...current, [role]: qty }));
  };

  const send = () => {
    if (!activeTarget) return;
    const action: PlaceAction = mode === 'place' ? placeAction : 'explore';
    const params =
      action === 'explore'
        ? {
            kind: 'explore' as const,
            ...(selected ? { destination: selected.id } : { target: activeTarget }),
            heroIds: party,
            pace,
          }
        : action === 'diplomacy' && selected
          ? {
              kind: 'diplomacy' as const,
              destination: selected.id,
              heroIds: party,
              pace,
              diplomacyMission: { type: 'talks' as const },
            }
        : action === 'labor' && selected
            ? {
                kind: 'labor' as const,
                destination: selected.id,
                heroIds: party,
                pace,
                laborCount,
              }
            : action === 'raid' && selected
              ? {
                  kind: 'raid' as const,
                  destination: selected.id,
                  heroIds: party,
                  pace,
                  residents: raidEscort,
                  raidGoal,
                  raidManeuver,
                  raidRally,
                  ...(raidAlly ? { raidAlly } : {}),
                }
            : selected
              ? {
                  kind: 'courtship' as const,
                  destination: selected.id,
                  heroIds: party.slice(0, 1),
                  pace,
                  courtshipFor: party[0],
                }
              : null;
    if (!params) return;
    const reason = dispatchError(game, params, LOCATION_DEFS, MAP_REGIONS);
    if (reason) {
      setError(reason);
      return;
    }
    if (dispatch(params)) {
      setParty([]);
      setRaidEscort({});
      setError(null);
      setMode('road');
    }
  };

  const actionOptions: { value: PlaceAction; label: string }[] = selected
    ? [
        { value: 'explore', label: 'Explore nearby' },
        ...(selected.faction && selectedLoc && discoveryAtLeast(selectedLoc.discovery, 'visited')
          ? [{ value: 'diplomacy' as const, label: 'Send envoy' }]
          : []),
        ...(selected.faction === 'CHARTER_COMPANY' && selectedLoc && discoveryAtLeast(selectedLoc.discovery, 'visited')
          ? [
              { value: 'labor' as const, label: 'Call for hands' },
              { value: 'courtship' as const, label: 'Seek a match' },
            ]
          : []),
        ...(raidTargetFaction(selected) && selectedLoc && discoveryAtLeast(selectedLoc.discovery, 'rumored')
          ? [{ value: 'raid' as const, label: 'Send raiders' }]
          : []),
      ]
    : [];

  const targetLabel = selected
    ? selected.name
    : activeRegion?.name ?? (activeTarget ? 'uncharted country' : 'No target selected');

  return (
    <div className="map-layout spatial-map-layout">
      <div className="panel map-panel spatial-map-panel">
        <div className="map-toolbar" aria-label="Map controls">
          <button className="small" onClick={() => setZoomClamped(zoom - 0.5)} aria-label="Zoom out">−</button>
          <span className="dim">{zoom.toFixed(1)}×</span>
          <button className="small" onClick={() => setZoomClamped(zoom + 0.5)} aria-label="Zoom in">+</button>
          <button className="small" onClick={resetView}>Reset</button>
          <output className="map-coordinate-readout" aria-live="polite" title="Normalized map coordinates">
            {activeTarget
              ? `x ${activeTarget.x.toFixed(4)} · y ${activeTarget.y.toFixed(4)}`
              : 'x — · y —'}
          </output>
          <button className={mode === 'road' ? 'small active' : 'small'} onClick={() => setMode('road')}>
            On the Road ({game.expeditions.length})
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          className="map-svg spatial-map-svg"
          aria-label="Map of the Ashmark"
          onWheel={(event) => {
            event.preventDefault();
            setZoomClamped(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
          }}
          onPointerDown={(event) => {
            if ((event.target as Element).closest('.map-node, .map-rumor')) return;
            dragRef.current = { x: event.clientX, y: event.clientY, centerX: center.x, centerY: center.y };
            draggedRef.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || zoom === 1) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const dx = event.clientX - drag.x;
            const dy = event.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) draggedRef.current = true;
            const halfX = 0.5 / zoom;
            const halfY = 0.5 / zoom;
            setCenter({
              x: clamp(drag.centerX - dx / rect.width / zoom, halfX, 1 - halfX),
              y: clamp(drag.centerY - dy / rect.height / zoom, halfY, 1 - halfY),
            });
          }}
          onPointerUp={(event) => {
            if (!draggedRef.current) {
              const point = pointerToMap(event.clientX, event.clientY);
              if (point) chooseFreeTarget(point);
            }
            dragRef.current = null;
          }}
        >
          <image href={ashmarkMap} x="0" y="0" width={MAP_W} height={MAP_H} preserveAspectRatio="none" />

          <g className="map-fog-layer map-fog-layer--reachable" pointerEvents="none">
            {fogLayers.reachable.map((cell) => (
              <polygon key={cell.index} points={cell.points} className="map-fog" />
            ))}
          </g>
          <g className="map-fog-layer map-fog-layer--locked" pointerEvents="none">
            {fogLayers.locked.map((cell) => (
              <polygon key={cell.index} points={cell.points} className="map-fog locked" />
            ))}
          </g>

          <g className="map-expeditions" pointerEvents="none">
            {game.expeditions.map((expedition) => {
              const expTarget = expedition.target ?? (expedition.destination ? LOCATION_DEFS.get(expedition.destination)?.mapPoint : undefined);
              if (!expTarget) return null;
              const start = svgPoint(home.mapPoint);
              const end = svgPoint(expTarget);
              const total = Math.max(1, expedition.legTurns ?? expedition.turnsLeft);
              const progress = clamp((total - expedition.turnsLeft) / total, 0, 1);
              const t = expedition.leg === 'outbound' ? progress : 1 - progress;
              const x = start.x + (end.x - start.x) * t;
              const y = start.y + (end.y - start.y) * t;
              return (
                <g key={expedition.id}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="map-route" />
                  <circle cx={x} cy={y} r={5} className="map-party-marker" />
                  <text x={x} y={y + 2} className="map-party-letter">
                    {expedition.kind[0].toUpperCase()}
                  </text>
                </g>
              );
            })}
          </g>

          <g className="map-locations">
            {[...LOCATIONS]
              .sort((a, b) => {
                const aRumor = game.locations[a.id]?.discovery === 'rumored' ? 0 : 1;
                const bRumor = game.locations[b.id]?.discovery === 'rumored' ? 0 : 1;
                return aRumor - bRumor;
              })
              .map((def) => {
              const location = game.locations[def.id];
              if (!location || location.discovery === 'unknown') return null;
              if (location.discovery === 'rumored') {
                const rumor = rumorArea(game.seed, def);
                const point = svgPoint(rumor.center);
                return (
                  <g
                    key={def.id}
                    className="map-rumor"
                    role="button"
                    tabIndex={0}
                    aria-label={`Search near ${def.name}`}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      chooseRumorTarget(def, rumor.center);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      chooseRumorTarget(def, rumor.center);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') chooseRumorTarget(def, rumor.center);
                    }}
                  >
                    <ellipse
                      cx={point.x}
                      cy={point.y}
                      rx={rumor.radiusX * MAP_W}
                      ry={rumor.radiusY * MAP_H}
                    />
                    <text x={point.x} y={point.y} className="map-rumor-label">{def.name}?</text>
                  </g>
                );
              }
              const point = svgPoint(def.mapPoint);
              const isHome = def.id === TUNING.map.homeLocationId;
              return (
                <g
                  key={def.id}
                  className={`map-node ${location.discovery} ${selectedId === def.id ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={def.name}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    chooseLocation(def);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    chooseLocation(def);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') chooseLocation(def);
                  }}
                >
                  <circle className="map-node-hit" cx={point.x} cy={point.y} r={20} />
                  <circle cx={point.x} cy={point.y} r={isHome ? 8 : 6} />
                  <text x={point.x} y={point.y - (isHome ? 12 : 10)} className="map-label">{def.name}</text>
                </g>
              );
              })}
          </g>

          {activeTarget && mode !== 'road' && (
            <g className="map-target" pointerEvents="none">
              <circle cx={activeTarget.x * MAP_W} cy={activeTarget.y * MAP_H} r={11} />
              <line x1={activeTarget.x * MAP_W - 15} y1={activeTarget.y * MAP_H} x2={activeTarget.x * MAP_W + 15} y2={activeTarget.y * MAP_H} />
              <line x1={activeTarget.x * MAP_W} y1={activeTarget.y * MAP_H - 15} x2={activeTarget.x * MAP_W} y2={activeTarget.y * MAP_H + 15} />
            </g>
          )}
        </svg>
        <p className="dim map-help">Clear country is already charted. Pale fog is reachable now; dark country stays shut until you open a route.</p>
      </div>

      <div className="panel map-detail-panel">
        {mode === 'road' ? (
          <>
            <h3>On the Road</h3>
            {game.expeditions.length === 0 ? (
              <p className="dim">No parties are away.</p>
            ) : (
              game.expeditions.map((expedition) => {
                const destination = expedition.destination
                  ? LOCATION_DEFS.get(expedition.destination)?.name ?? expedition.destination
                  : expedition.target
                    ? regionAt(expedition.target, MAP_REGIONS)?.name ?? 'the frontier'
                    : 'the frontier';
                return (
                  <button
                    key={expedition.id}
                    className="road-row"
                    onClick={() => {
                      if (expedition.target) {
                        setTarget(expedition.target);
                        setCenter(expedition.target);
                        setZoomClamped(2);
                      }
                    }}
                  >
                    <span>{expeditionName(game, expedition.heroIds)}</span>
                    <span className="dim">
                      {expedition.leg === 'outbound' ? '→' : '←'} {destination} · {expedition.turnsLeft}t · {expedition.pace ?? 'normal'}
                    </span>
                  </button>
                );
              })
            )}
            <button className="small" onClick={() => setMode(activeTarget ? (selected ? 'place' : 'explore') : 'explore')}>
              Plan an expedition
            </button>
          </>
        ) : (
          <>
            <h3>{mode === 'place' && selected ? selected.name : 'Explore the Ashmark'}</h3>
            {mode === 'place' && selected && selectedLoc ? (
              <>
                <p className="dim map-description">{selected.blurb}</p>
                <div className="faction-row"><span>Discovery</span><span className="dim">{DISCOVERY_LABELS[selectedLoc.discovery]}</span></div>
                {selected.faction && (
                  <>
                    <div className="faction-row">
                      <span>Community</span>
                      <span className="dim">
                        {selectedSeat ? stanceOf(selectedSeat.standing) : stanceOf(game.factions[selected.faction].standing)}
                      </span>
                    </div>
                    <div className="faction-row">
                      <span>{FACTION_DEFS.get(selected.faction)?.name}</span>
                      <span className="dim">{stanceOf(game.factions[selected.faction].standing)} faction mood</span>
                    </div>
                  </>
                )}
                {selected.hasMarket && <div className="faction-row"><span>Market</span><span className="dim">Caravans leave from Market</span></div>}
                <label className="compact-field">
                  <span>Purpose</span>
                  <select value={placeAction} onChange={(event) => setPlaceAction(event.target.value as PlaceAction)}>
                    {actionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <p className="dim map-description">
                {activeTarget ? `Target: ${targetLabel}.` : 'Click pale fog or familiar country to place a target.'}
              </p>
            )}

            {activeTarget && (
              <>
                <div className="faction-row"><span>One way</span><span className="dim">{oneWay} turn{oneWay === 1 ? '' : 's'}</span></div>
                <div className="faction-row"><span>Round trip</span><span className="dim">at least {(oneWay ?? 0) * 2} turns</span></div>
                <label className="compact-field">
                  <span>Pace</span>
                  <select value={pace} onChange={(event) => setPace(event.target.value as ExpeditionPace)}>
                    <option value="fast">Fast — riskier, maps less</option>
                    <option value="normal">Normal</option>
                    <option value="slow">Slow — safer, maps more</option>
                  </select>
                </label>

                {placeAction === 'labor' && mode === 'place' && (
                  <label className="compact-field">
                    <span>Hands ({laborRunCost(laborCount)} silver)</span>
                    <input type="number" min={1} value={laborCount} onChange={(event) => setLaborCount(Math.max(1, Number(event.target.value) || 1))} />
                  </label>
                )}
                {placeAction === 'raid' && mode === 'place' && (
                  <>
                    <label className="compact-field">
                      <span>Raid goal</span>
                      <select value={raidGoal} onChange={(event) => setRaidGoal(event.target.value as RaidAttackGoal)}>
                        <option value="plunder">Plunder</option>
                        <option value="burn">Burn</option>
                        <option value="bloody">Bloody them</option>
                        <option value="cow">Cow them</option>
                      </select>
                    </label>
                    <label className="compact-field">
                      <span>Maneuver</span>
                      <select value={raidManeuver} onChange={(event) => setRaidManeuver(event.target.value as RaidManeuver)}>
                        <option value="skirmish">Skirmish</option>
                        <option value="charge">Charge</option>
                        <option value="evade">Evade</option>
                      </select>
                    </label>
                    <label className="compact-check">
                      <input type="checkbox" checked={raidRally} onChange={(event) => setRaidRally(event.target.checked)} />{' '}
                      Rally the party before the strike
                    </label>
                    <label className="compact-field">
                      <span>Call ally</span>
                      <select value={raidAlly} onChange={(event) => setRaidAlly((event.target.value || '') as FactionId | '')}>
                        <option value="">None</option>
                        {allyOptions.map((faction) => (
                          <option key={faction.id} value={faction.id}>
                            {faction.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(portersFree > 0 || guardsFree > 0) && (
                      <div className="raid-escort-planner">
                        <div className="raid-choice-label">Residents</div>
                        <p className="dim raid-escort-note">
                          Guards add striking force. Porters carry the haul home.
                        </p>
                        <div className="cargo-grid">
                          {guardsFree > 0 && (
                            <label className="dim">
                              Guards <span style={{ fontSize: '0.75rem' }}>(of {guardsFree})</span>
                              <input
                                type="number"
                                min={0}
                                max={guardsFree}
                                value={raidEscort.guards ?? 0}
                                onChange={(event) => setEscortQty('guards', event.target.value, guardsFree)}
                              />
                            </label>
                          )}
                          {portersFree > 0 && (
                            <label className="dim">
                              Porters <span style={{ fontSize: '0.75rem' }}>(of {portersFree})</span>
                              <input
                                type="number"
                                min={0}
                                max={portersFree}
                                value={raidEscort.porters ?? 0}
                                onChange={(event) => setEscortQty('porters', event.target.value, portersFree)}
                              />
                            </label>
                          )}
                        </div>
                        <div className="dim raid-escort-note">
                          Loot capacity on this raid: {raidCapacity}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <h4>Party</h4>
                <div className="map-party-picks">
                  {available.map((hero) => (
                    <label key={hero.id} className="pick-row">
                      <input
                        type={placeAction === 'courtship' && mode === 'place' ? 'radio' : 'checkbox'}
                        name="map-party"
                        checked={party.includes(hero.id)}
                        onChange={() => {
                          if (placeAction === 'courtship' && mode === 'place') setParty([hero.id]);
                          else toggleHero(hero.id);
                        }}
                      />{' '}
                      {hero.name}{' '}
                      <span className="dim">
                        {placeAction === 'diplomacy'
                          ? `(Diplomacy ${hero.skills.diplomacy})`
                          : placeAction === 'raid'
                            ? `(Combat ${hero.skills.combat} · Stealth ${hero.skills.stealth})`
                            : `(Survival ${hero.skills.survival})`}
                      </span>
                    </label>
                  ))}
                </div>
                {error && <div className="bad map-error">{error}</div>}
                <button className="primary" disabled={game.phase !== 'assignment' || party.length === 0 || !pointReachable(game, activeTarget, MAP_REGIONS)} onClick={send}>
                  {placeAction === 'raid' ? 'Send Raiders ▸' : 'Send the Party ▸'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
