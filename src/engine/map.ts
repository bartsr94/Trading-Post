// Pure spatial-map helpers: geometry, checkpoint access, fog-grid survey, and
// deterministic rumor placement. No DOM or image knowledge belongs here.

import { TUNING } from '../content/tuning';
import { discoveryAtLeast } from './types';
import type {
  DiscoveryState,
  ExpeditionPace,
  GameState,
  LocationDef,
  MapFeatureDef,
  MapKnowledge,
  MapPoint,
  MapRegionDef,
} from './types';

type SurveyTier = 'critSuccess' | 'success' | 'failure' | 'critFailure';

const ASPECT = 4 / 3;
const EPSILON = 1e-9;

export function validMapPoint(point: MapPoint): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function scaledMapDistance(a: MapPoint, b: MapPoint): number {
  return Math.hypot((a.x - b.x) * ASPECT, a.y - b.y);
}

function pointOnSegment(point: MapPoint, a: MapPoint, b: MapPoint): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > EPSILON) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -EPSILON) return false;
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= lengthSq + EPSILON;
}

/** Boundary-inclusive ray-casting test. */
export function pointInPolygon(point: MapPoint, polygon: readonly MapPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j];
    const b = polygon[i];
    if (pointOnSegment(point, a, b)) return true;
    const crosses =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function regionAt(
  point: MapPoint,
  regions: readonly MapRegionDef[],
): MapRegionDef | undefined {
  return regions.find((region) => pointInPolygon(point, region.polygon));
}

export function mapRegionUnlocked(state: GameState, region: MapRegionDef): boolean {
  return region.requires.every((requirement) => {
    if (requirement.type === 'flag') return state.flags[requirement.flag] === true;
    if (requirement.type === 'postTierAtLeast') return state.postTier >= requirement.tier;
    const discovery = state.locations[requirement.location]?.discovery;
    return discovery !== undefined && discoveryAtLeast(discovery, requirement.atLeast);
  });
}

export function pointReachable(
  state: GameState,
  point: MapPoint,
  regions: readonly MapRegionDef[],
): boolean {
  if (!validMapPoint(point)) return false;
  if (regions.length === 0) return true; // compatibility for isolated engine tests
  // Shared polygon edges belong to both neighbours. Treat the point as
  // reachable when either side is open so a single boundary sample cannot
  // block an otherwise valid route.
  return regions.some(
    (region) => pointInPolygon(point, region.polygon) && mapRegionUnlocked(state, region),
  );
}

export function routeUnlocked(
  state: GameState,
  from: MapPoint,
  to: MapPoint,
  regions: readonly MapRegionDef[],
): boolean {
  if (regions.length === 0) return true;
  const samples = Math.max(TUNING.map.fogGrid.width, TUNING.map.fogGrid.height) * 2;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    if (!pointReachable(state, point, regions)) return false;
  }
  return true;
}

export function tagsAt(
  point: MapPoint,
  regions: readonly MapRegionDef[],
  features: readonly MapFeatureDef[],
): string[] {
  const tags = new Set<string>(regionAt(point, regions)?.tags ?? []);
  for (const feature of features) {
    if (pointInPolygon(point, feature.polygon)) {
      for (const tag of feature.tags) tags.add(tag);
    }
  }
  return [...tags];
}

export function journeyTurns(from: MapPoint, to: MapPoint, pace: ExpeditionPace = 'normal'): number {
  const base = Math.max(1, Math.ceil(scaledMapDistance(from, to) / TUNING.map.distancePerTurn));
  return Math.max(1, Math.ceil(base * TUNING.map.pace[pace].turnMultiplier));
}

export function paceCheckModifier(pace: ExpeditionPace | undefined): number {
  return TUNING.map.pace[pace ?? 'normal'].checkModifier;
}

export function paceEventChance(pace: ExpeditionPace | undefined): number {
  return Math.min(
    1,
    TUNING.events.travelEventChance * TUNING.map.pace[pace ?? 'normal'].eventChanceMultiplier,
  );
}

export function mapCellIndex(point: MapPoint): number {
  const { width, height } = TUNING.map.fogGrid;
  const x = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)));
  return y * width + x;
}

export function mapCellCenter(index: number): MapPoint {
  const { width, height } = TUNING.map.fogGrid;
  const x = index % width;
  const y = Math.floor(index / width);
  return { x: (x + 0.5) / width, y: (y + 0.5) / height };
}

export function mapCellCoordinates(index: number): { x: number; y: number } {
  const { width } = TUNING.map.fogGrid;
  return { x: index % width, y: Math.floor(index / width) };
}

function distanceToSegment(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const ax = a.x * ASPECT;
  const bx = b.x * ASPECT;
  const px = point.x * ASPECT;
  const ay = a.y;
  const by = b.y;
  const py = point.y;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function cellsForFootprint(
  from: MapPoint,
  to: MapPoint,
  routeWidth: number,
  targetRadius: number,
): number[] {
  const { width, height } = TUNING.map.fogGrid;
  const out: number[] = [];
  for (let index = 0; index < width * height; index++) {
    const point = mapCellCenter(index);
    if (
      distanceToSegment(point, from, to) <= routeWidth ||
      scaledMapDistance(point, to) <= targetRadius
    ) {
      out.push(index);
    }
  }
  return out;
}

export function surveyCells(
  from: MapPoint,
  to: MapPoint,
  pace: ExpeditionPace,
  tier: SurveyTier,
): number[] {
  const exploration = TUNING.map.exploration;
  const tierMult = exploration.tierRadiusMultiplier[tier];
  return cellsForFootprint(
    from,
    to,
    exploration.routeWidth[pace] * Math.max(exploration.minRouteTierMultiplier, tierMult),
    exploration.targetRadius[pace] * tierMult,
  );
}

export function initialSurveyCells(from: MapPoint, to: MapPoint): number[] {
  return cellsForFootprint(
    from,
    to,
    TUNING.map.exploration.initialRouteWidth,
    TUNING.map.exploration.initialRadius,
  );
}

function cellsInPolygon(polygon: readonly MapPoint[]): number[] {
  const { width, height } = TUNING.map.fogGrid;
  const cells: number[] = [];
  for (let index = 0; index < width * height; index++) {
    if (pointInPolygon(mapCellCenter(index), polygon)) cells.push(index);
  }
  return cells;
}

export function filterCellsToUnlocked(
  state: GameState,
  cells: readonly number[],
  regions: readonly MapRegionDef[],
): number[] {
  return cells.filter((index) => pointReachable(state, mapCellCenter(index), regions));
}

export function mergeSurveyCells(existing: readonly number[], incoming: readonly number[]): number[] {
  return [...new Set([...existing, ...incoming])].sort((a, b) => a - b);
}

export function mapKnowledgeFromDiscovery(
  state: GameState,
  locations: readonly LocationDef[],
  regions: readonly MapRegionDef[],
  features: readonly MapFeatureDef[] = [],
): MapKnowledge {
  const home = locations.find((location) => location.id === TUNING.map.homeLocationId);
  if (!home) return { surveyedCells: [] };
  let cells: number[] = [];
  for (const feature of features) {
    if (!feature.initiallySurveyed) continue;
    cells = mergeSurveyCells(
      cells,
      filterCellsToUnlocked(state, cellsInPolygon(feature.polygon), regions),
    );
  }
  cells = mergeSurveyCells(
    cells,
    filterCellsToUnlocked(
      state,
      cellsForFootprint(
        home.mapPoint,
        home.mapPoint,
        TUNING.map.exploration.initialRouteWidth,
        TUNING.map.exploration.initialRadius,
      ),
      regions,
    ),
  );
  return { surveyedCells: cells };
}

export function locationIdsInCells(
  locations: readonly LocationDef[],
  cells: readonly number[],
): string[] {
  const set = new Set(cells);
  return locations.filter((location) => set.has(mapCellIndex(location.mapPoint))).map((l) => l.id);
}

export function locationIdsInDetectionRadius(
  locations: readonly LocationDef[],
  target: MapPoint,
  pace: ExpeditionPace,
  tier: SurveyTier,
): string[] {
  const base = TUNING.map.exploration.targetRadius[pace] * TUNING.map.exploration.tierRadiusMultiplier[tier];
  const radius = base + TUNING.map.exploration.detectionBonus[tier];
  return locations.filter((location) => scaledMapDistance(location.mapPoint, target) <= radius).map((l) => l.id);
}

function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function rumorArea(
  seed: number,
  location: Pick<LocationDef, 'id' | 'mapPoint'>,
): { center: MapPoint; radiusX: number; radiusY: number } {
  const { rumorRadiusX: radiusX, rumorRadiusY: radiusY } = TUNING.map.exploration;
  const hash = hash32(`${seed}:${location.id}`);
  const angle = ((hash & 0xffff) / 0xffff) * Math.PI * 2;
  const magnitude =
    TUNING.map.exploration.rumorOffsetMin +
    (((hash >>> 16) & 0xffff) / 0xffff) * TUNING.map.exploration.rumorOffsetRange;
  const center = {
    // Keep the approximation's center on-map without pushing it farther from
    // edge locations. The SVG may clip part of an edge ellipse, but the true
    // point must always remain inside the searchable area.
    x: Math.min(1, Math.max(0, location.mapPoint.x + Math.cos(angle) * radiusX * magnitude)),
    y: Math.min(1, Math.max(0, location.mapPoint.y + Math.sin(angle) * radiusY * magnitude)),
  };
  return { center, radiusX, radiusY };
}

export function discoveryAfterSurvey(
  current: DiscoveryState,
  tier: SurveyTier,
  deliberatelyTargeted: boolean,
): DiscoveryState {
  if (current === 'unknown' || current === 'rumored') return 'visited';
  if (current === 'visited' && (tier === 'critSuccess' || (deliberatelyTargeted && tier === 'success'))) {
    return 'known';
  }
  return current;
}
