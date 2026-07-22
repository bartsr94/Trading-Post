import { describe, expect, it } from 'vitest';
import { MAP_REGIONS } from '../../content/map';
import { LOCATION_DEFS } from '../../content/locations';
import { TUNING } from '../../content/tuning';
import { evalCondition } from '../events/conditions';
import { advanceExpeditions, dispatchError, dispatchExpedition, travelContextFor } from '../expeditions';
import {
  discoveryAfterSurvey,
  filterCellsToUnlocked,
  initialSurveyCells,
  journeyTurns,
  locationIdsInCells,
  locationIdsInDetectionRadius,
  mapCellCenter,
  mapCellCoordinates,
  mapCellIndex,
  mapKnowledgeFromDiscovery,
  mapRegionUnlocked,
  mergeSurveyCells,
  paceCheckModifier,
  paceEventChance,
  pointInPolygon,
  pointReachable,
  regionAt,
  routeUnlocked,
  rumorArea,
  surveyCells,
  tagsAt,
  validMapPoint,
} from '../map';
import { Rng } from '../rng';
import type { LocationDef, MapFeatureDef, MapRegionDef } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const OPEN_REGION: MapRegionDef = {
  id: 'open',
  name: 'open country',
  polygon: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  requires: [],
  tags: ['open'],
};

function place(
  id: string,
  point: { x: number; y: number },
  discovery: LocationDef['initialDiscovery'],
): LocationDef {
  return {
    id,
    name: id,
    blurb: id,
    hasMarket: false,
    initialDiscovery: discovery,
    tags: [],
    mapPoint: point,
    mapRegion: 'open',
  };
}

describe('map geometry and access edge cases', () => {
  it('validates normalized points and handles polygon interiors, edges, and invalid polygons', () => {
    expect(validMapPoint({ x: 0, y: 1 })).toBe(true);
    expect(validMapPoint({ x: -0.001, y: 0.5 })).toBe(false);
    expect(validMapPoint({ x: 0.5, y: 1.001 })).toBe(false);
    expect(validMapPoint({ x: Number.NaN, y: 0.5 })).toBe(false);
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, OPEN_REGION.polygon)).toBe(true);
    expect(pointInPolygon({ x: 1, y: 0.5 }, OPEN_REGION.polygon)).toBe(true);
    expect(pointInPolygon({ x: 1.1, y: 0.5 }, OPEN_REGION.polygon)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('supports flag, post-tier, and monotonic discovery checkpoints', () => {
    const state = testState();
    const gated: MapRegionDef = {
      ...OPEN_REGION,
      requires: [
        { type: 'flag', flag: 'charted' },
        { type: 'postTierAtLeast', tier: 2 },
        { type: 'locationDiscovery', location: 'old_road', atLeast: 'visited' },
      ],
    };
    expect(mapRegionUnlocked(state, gated)).toBe(false);
    state.flags.charted = true;
    state.postTier = 2;
    state.locations.old_road.discovery = 'visited';
    expect(mapRegionUnlocked(state, gated)).toBe(true);
    state.locations.old_road.discovery = 'known';
    expect(mapRegionUnlocked(state, gated)).toBe(true);
  });

  it('rejects invalid and unassigned points but accepts valid points when no regions are configured', () => {
    const state = testState();
    expect(pointReachable(state, { x: 0.5, y: 0.5 }, [])).toBe(true);
    expect(pointReachable(state, { x: -1, y: 0.5 }, [])).toBe(false);
    expect(pointReachable(state, { x: 0.5, y: 0.5 }, [{ ...OPEN_REGION, polygon: [] }])).toBe(false);
    expect(regionAt({ x: 2, y: 2 }, MAP_REGIONS)).toBeUndefined();
  });

  it('rejects a route whose endpoints are open but which crosses locked country', () => {
    const state = testState();
    const regions: MapRegionDef[] = [
      { ...OPEN_REGION, id: 'left', polygon: [{ x: 0, y: 0 }, { x: 0.4, y: 0 }, { x: 0.4, y: 1 }, { x: 0, y: 1 }] },
      {
        ...OPEN_REGION,
        id: 'middle',
        polygon: [{ x: 0.4, y: 0 }, { x: 0.6, y: 0 }, { x: 0.6, y: 1 }, { x: 0.4, y: 1 }],
        requires: [{ type: 'flag', flag: 'middle_open' }],
      },
      { ...OPEN_REGION, id: 'right', polygon: [{ x: 0.6, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.6, y: 1 }] },
    ];
    expect(pointReachable(state, { x: 0.1, y: 0.5 }, regions)).toBe(true);
    expect(pointReachable(state, { x: 0.9, y: 0.5 }, regions)).toBe(true);
    expect(routeUnlocked(state, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, regions)).toBe(false);
    const home = place('post', { x: 0.1, y: 0.5 }, 'known');
    expect(
      dispatchError(
        state,
        { kind: 'explore', target: { x: 0.9, y: 0.5 }, heroIds: ['p1'] },
        new Map([[home.id, home]]),
        regions,
      ),
    ).toMatch(/crosses/);
    state.flags.middle_open = true;
    expect(routeUnlocked(state, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, regions)).toBe(true);
  });

  it('deduplicates overlapping region and feature tags', () => {
    const feature: MapFeatureDef = { id: 'road', polygon: OPEN_REGION.polygon, tags: ['open', 'road'] };
    expect(tagsAt({ x: 0.5, y: 0.5 }, [OPEN_REGION], [feature])).toEqual(['open', 'road']);
  });
});

describe('distance, pace, fog grid, and survey footprints', () => {
  it('rounds journeys to at least one turn and exposes each pace trade-off', () => {
    const from = { x: 0.1, y: 0.1 };
    const to = { x: 0.9, y: 0.9 };
    expect(journeyTurns(from, from)).toBe(1);
    expect(journeyTurns(from, to, 'fast')).toBeLessThan(journeyTurns(from, to, 'normal'));
    expect(journeyTurns(from, to, 'normal')).toBeLessThan(journeyTurns(from, to, 'slow'));
    expect(paceCheckModifier('fast')).toBe(-1);
    expect(paceCheckModifier(undefined)).toBe(0);
    expect(paceCheckModifier('slow')).toBe(1);
    expect(paceEventChance('fast')).toBeGreaterThan(paceEventChance('normal'));
    expect(paceEventChance('normal')).toBeGreaterThan(paceEventChance('slow'));
  });

  it('clips grid indexes and round-trips cell coordinates through their centers', () => {
    const last = TUNING.map.fogGrid.width * TUNING.map.fogGrid.height - 1;
    expect(mapCellIndex({ x: -1, y: -1 })).toBe(0);
    expect(mapCellIndex({ x: 2, y: 2 })).toBe(last);
    for (const index of [0, 63, 64, 527, last]) {
      expect(mapCellIndex(mapCellCenter(index))).toBe(index);
      const coords = mapCellCoordinates(index);
      expect(coords.x).toBe(index % TUNING.map.fogGrid.width);
      expect(coords.y).toBe(Math.floor(index / TUNING.map.fogGrid.width));
    }
  });

  it('orders survey coverage by pace and result tier', () => {
    const from = { x: 0.2, y: 0.2 };
    const to = { x: 0.7, y: 0.5 };
    const fast = surveyCells(from, to, 'fast', 'success').length;
    const normal = surveyCells(from, to, 'normal', 'success').length;
    const slow = surveyCells(from, to, 'slow', 'success').length;
    expect(fast).toBeLessThan(normal);
    expect(normal).toBeLessThan(slow);
    expect(surveyCells(from, to, 'normal', 'critFailure').length).toBeLessThan(
      surveyCells(from, to, 'normal', 'failure').length,
    );
    expect(surveyCells(from, to, 'normal', 'failure').length).toBeLessThan(normal);
    expect(normal).toBeLessThan(surveyCells(from, to, 'normal', 'critSuccess').length);
  });

  it('filters locked cells and keeps survey merges sorted, unique, and idempotent', () => {
    const state = testState();
    const unlocked = mapCellIndex({ x: 0.5, y: 0.5 });
    const locked = mapCellIndex({ x: 0.25, y: 0.4 });
    expect(filterCellsToUnlocked(state, [locked, unlocked], MAP_REGIONS)).toEqual([unlocked]);
    const merged = mergeSurveyCells([9, 2, 2], [5, 9]);
    expect(merged).toEqual([2, 5, 9]);
    expect(mergeSurveyCells(merged, merged)).toEqual(merged);
  });

  it('seeds familiar terrain and routes to visited/known places, never rumored places', () => {
    const state = testState();
    const defs = [
      place('post', { x: 0.1, y: 0.1 }, 'known'),
      place('visited', { x: 0.9, y: 0.1 }, 'visited'),
      place('rumor', { x: 0.1, y: 0.9 }, 'rumored'),
    ];
    state.locations = {
      post: { discovery: 'known' },
      visited: { discovery: 'visited' },
      rumor: { discovery: 'rumored' },
    };
    const feature: MapFeatureDef = {
      id: 'familiar',
      polygon: [{ x: 0.75, y: 0.75 }, { x: 0.85, y: 0.75 }, { x: 0.85, y: 0.85 }, { x: 0.75, y: 0.85 }],
      tags: [],
      initiallySurveyed: true,
    };
    const cells = mapKnowledgeFromDiscovery(state, defs, [OPEN_REGION], [feature]).surveyedCells;
    expect(cells).toContain(mapCellIndex({ x: 0.5, y: 0.1 }));
    expect(cells).not.toContain(mapCellIndex({ x: 0.1, y: 0.7 }));
    expect(cells).toContain(mapCellIndex({ x: 0.8, y: 0.8 }));
    expect(mapKnowledgeFromDiscovery(state, defs.slice(1), [OPEN_REGION])).toEqual({ surveyedCells: [] });
  });

  it('finds locations by mapped cell and by the tuned detection radius', () => {
    const near = place('near', { x: 0.5, y: 0.5 }, 'unknown');
    const far = place('far', { x: 0.9, y: 0.9 }, 'unknown');
    expect(locationIdsInCells([near, far], [mapCellIndex(near.mapPoint)])).toEqual(['near']);
    expect(locationIdsInDetectionRadius([near, far], { x: 0.5, y: 0.5 }, 'normal', 'success')).toEqual(['near']);
    expect(locationIdsInDetectionRadius([far], { x: 0.5, y: 0.5 }, 'fast', 'critFailure')).toEqual([]);
  });
});

describe('rumors, discovery, dispatch, and reporting semantics', () => {
  it('keeps edge rumors inside the map and containing their true location', () => {
    const rumor = rumorArea(1, place('edge', { x: 0, y: 1 }, 'rumored'));
    expect(rumor.center.x).toBeGreaterThanOrEqual(0);
    expect(rumor.center.y).toBeLessThanOrEqual(1);
    const normalized =
      ((0 - rumor.center.x) / rumor.radiusX) ** 2 +
      ((1 - rumor.center.y) / rumor.radiusY) ** 2;
    expect(normalized).toBeLessThanOrEqual(1);
  });

  it('applies the complete monotonic discovery transition matrix', () => {
    for (const tier of ['critSuccess', 'success', 'failure', 'critFailure'] as const) {
      expect(discoveryAfterSurvey('unknown', tier, false)).toBe('visited');
      expect(discoveryAfterSurvey('rumored', tier, false)).toBe('visited');
      expect(discoveryAfterSurvey('known', tier, true)).toBe('known');
    }
    expect(discoveryAfterSurvey('visited', 'critSuccess', false)).toBe('known');
    expect(discoveryAfterSurvey('visited', 'success', true)).toBe('known');
    expect(discoveryAfterSurvey('visited', 'success', false)).toBe('visited');
    expect(discoveryAfterSurvey('visited', 'failure', true)).toBe('visited');
  });

  it('rejects invalid/free non-explore targets and duplicate exploration cells', () => {
    const state = testState();
    expect(dispatchError(state, { kind: 'explore', target: { x: -1, y: 0 }, heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toMatch(/beyond/);
    expect(dispatchError(state, { kind: 'caravan', target: { x: 0.6, y: 0.4 }, heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toMatch(/known destination/);
    expect(dispatchExpedition(state, { kind: 'explore', target: { x: 0.58, y: 0.5 }, heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBe(true);
    expect(dispatchError(state, { kind: 'explore', target: { x: 0.581, y: 0.501 }, heroIds: ['p2'] }, LOCATION_DEFS, MAP_REGIONS)).toMatch(/already searching/);
  });

  it('persists target, pace, and equal leg duration and permits repeat exploration of known places', () => {
    const state = testState();
    expect(dispatchExpedition(state, { kind: 'explore', destination: 'shackle_station', pace: 'slow', heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBe(true);
    const expedition = state.expeditions[0];
    expect(expedition.target).toEqual(LOCATION_DEFS.get('shackle_station')!.mapPoint);
    expect(expedition.pace).toBe('slow');
    expect(expedition.turnsLeft).toBe(expedition.legTurns);
    expedition.turnsLeft = 1;
    advanceExpeditions(state, TEST_CONTENT, new Rng(4), () => undefined);
    expect(expedition.leg).toBe('returning');
    expect(expedition.turnsLeft).toBe(expedition.legTurns);
    state.expeditions = [];
    expect(dispatchError(state, { kind: 'explore', destination: 'shackle_station', heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBeNull();
  });

  it('commits an explicit survey result on homecoming, including both discovery levels', () => {
    const state = testState();
    state.locations.old_road.discovery = 'visited';
    expect(dispatchExpedition(state, { kind: 'explore', target: { x: 0.58, y: 0.5 }, heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBe(true);
    const expedition = state.expeditions[0];
    const newCell = mapCellIndex({ x: 0.6, y: 0.5 });
    expedition.leg = 'returning';
    expedition.turnsLeft = 1;
    expedition.surveyResult = {
      tier: 'success',
      surveyedCells: [newCell],
      discoveredLocationIds: ['black_mere'],
      knownLocationIds: ['old_road'],
    };
    advanceExpeditions(state, TEST_CONTENT, new Rng(1), () => undefined);
    expect(state.expeditions).toHaveLength(0);
    expect(state.mapKnowledge.surveyedCells).toContain(newCell);
    expect(state.locations.black_mere.discovery).toBe('visited');
    expect(state.locations.old_road.discovery).toBe('known');
    expect(state.heroes.find((hero) => hero.id === 'p1')!.history.at(-1)).toMatch(/Explored/);
  });

  it('discards pending survey knowledge when the whole party is lost', () => {
    const state = testState();
    const before = [...state.mapKnowledge.surveyedCells];
    expect(dispatchExpedition(state, { kind: 'explore', target: { x: 0.58, y: 0.5 }, heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBe(true);
    state.expeditions[0].surveyResult = {
      tier: 'critSuccess',
      surveyedCells: [mapCellIndex({ x: 0.6, y: 0.5 })],
      discoveredLocationIds: ['black_mere'],
      knownLocationIds: [],
    };
    state.heroes.find((hero) => hero.id === 'p1')!.status = 'dead';
    advanceExpeditions(state, TEST_CONTENT, new Rng(1), () => undefined);
    expect(state.expeditions).toHaveLength(0);
    expect(state.mapKnowledge.surveyedCells).toEqual(before);
    expect(state.locations.black_mere.discovery).toBe('unknown');
  });

  it('builds exact and free travel contexts without leaking destination identity', () => {
    const state = testState();
    expect(dispatchExpedition(state, { kind: 'explore', target: { x: 0.58, y: 0.39 }, pace: 'fast', heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBe(true);
    const free = travelContextFor(state.expeditions[0], TEST_CONTENT)!;
    expect(free.destination.locationId).toBeUndefined();
    expect(free.paceCheckModifier).toBe(-1);
    expect(evalCondition(state, { type: 'destinationIs', location: 'black_mere' }, { travel: free })).toBe(false);
    expect(evalCondition(state, { type: 'destinationTag', tag: 'marsh' }, { travel: free })).toBe(true);
    expect(evalCondition(state, { type: 'expeditionKind', kind: 'explore' }, { travel: free })).toBe(true);

    const authored = travelContextFor({ ...state.expeditions[0], destination: 'black_mere' }, TEST_CONTENT)!;
    expect(authored.destination.locationId).toBe('black_mere');
    expect(new Set(authored.destination.tags).size).toBe(authored.destination.tags.length);
    expect(travelContextFor({ ...state.expeditions[0], target: undefined }, { locationDefs: new Map() })).toBeUndefined();
  });

  it('uses an already-known authored route even when its straight line clips a locked region', () => {
    const state = testState();
    expect(state.locations.river_meet.discovery).toBe('visited');
    expect(dispatchError(state, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBeNull();
  });

  it('removes an obsolete authored expedition safely when its destination no longer exists', () => {
    const state = testState();
    expect(dispatchExpedition(state, { kind: 'caravan', destination: 'river_meet', heroIds: ['p1'] }, LOCATION_DEFS, MAP_REGIONS)).toBe(true);
    state.expeditions[0].destination = 'removed_place';
    expect(() => advanceExpeditions(state, TEST_CONTENT, new Rng(1), () => undefined)).not.toThrow();
    expect(state.expeditions).toHaveLength(0);
  });

  it('initial survey footprints always include their destination cell', () => {
    const target = { x: 0.75, y: 0.6 };
    expect(initialSurveyCells({ x: 0.1, y: 0.1 }, target)).toContain(mapCellIndex(target));
  });
});
