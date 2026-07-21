import { describe, expect, it } from 'vitest';
import { MAP_FEATURES, MAP_REGIONS } from '../../content/map';
import { LOCATION_DEFS, LOCATIONS } from '../../content/locations';
import { advanceExpeditions, dispatchError, dispatchExpedition, travelContextFor } from '../expeditions';
import {
  journeyTurns,
  mapCellIndex,
  mapRegionUnlocked,
  mergeSurveyCells,
  pointInPolygon,
  regionAt,
  rumorArea,
  scaledMapDistance,
  surveyCells,
  tagsAt,
} from '../map';
import { Rng } from '../rng';
import { TEST_CONTENT, testState } from './helpers';

const noop = () => undefined;

describe('spatial Ashmark map', () => {
  it('starts with the revised eastern anchors and a charted river corridor', () => {
    const state = testState();
    expect(LOCATION_DEFS.get('post')!.mapPoint).toEqual({ x: 0.59, y: 0.164 });
    expect(LOCATION_DEFS.get('charter_landing')!.mapPoint).toEqual({ x: 0.9, y: 0.491 });
    expect(LOCATION_DEFS.get('shackle_station')!.mapPoint).toEqual({ x: 0.91, y: 0.322 });
    expect(state.locations.shackle_station.discovery).toBe('known');
    expect(state.mapKnowledge.surveyedCells).toContain(mapCellIndex({ x: 0.9, y: 0.4 }));
    expect(state.mapKnowledge.surveyedCells).not.toContain(mapCellIndex({ x: 0.9, y: 0.8 }));
    expect(state.mapKnowledge.surveyedCells).not.toContain(mapCellIndex({ x: 0.7, y: 0.4 }));
  });

  it('corrects normalized distance for the 4:3 image', () => {
    expect(scaledMapDistance({ x: 0, y: 0 }, { x: 0.75, y: 0 })).toBeCloseTo(1);
    expect(scaledMapDistance({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(1);
  });

  it('combines distance with fast/normal/slow pace', () => {
    const from = { x: 0.5, y: 0.32 };
    const to = { x: 0.8, y: 0.45 };
    expect(journeyTurns(from, to, 'fast')).toBeLessThan(journeyTurns(from, to, 'normal'));
    expect(journeyTurns(from, to, 'normal')).toBeLessThan(journeyTurns(from, to, 'slow'));
  });

  it('uses monotonic discovery checkpoints for distant regions', () => {
    const state = testState();
    const western = MAP_REGIONS.find((region) => region.id === 'western_interior')!;
    const stormwall = MAP_REGIONS.find((region) => region.id === 'stormwall')!;
    expect(mapRegionUnlocked(state, western)).toBe(false);
    state.locations.old_road.discovery = 'visited';
    expect(mapRegionUnlocked(state, western)).toBe(true);
    expect(mapRegionUnlocked(state, stormwall)).toBe(false);
    state.locations.hill_fort.discovery = 'visited';
    expect(mapRegionUnlocked(state, stormwall)).toBe(true);
  });

  it('finds regions/features with boundary-inclusive polygons', () => {
    const point = { x: 0.58, y: 0.39 };
    const region = regionAt(point, MAP_REGIONS);
    expect(region?.id).toBe('charter_corridor');
    expect(tagsAt(point, MAP_REGIONS, MAP_FEATURES)).toEqual(
      expect.arrayContaining(['frontier', 'marsh', 'ritual']),
    );
    expect(pointInPolygon({ x: 0, y: 0 }, MAP_REGIONS[0].polygon)).toBe(true);
  });

  it('places a stable rumor area which contains the true point', () => {
    const location = LOCATION_DEFS.get('hill_fort')!;
    const a = rumorArea(42, location);
    const b = rumorArea(42, location);
    const c = rumorArea(43, location);
    expect(a).toEqual(b);
    expect(c.center).not.toEqual(a.center);
    const normalized =
      ((location.mapPoint.x - a.center.x) / a.radiusX) ** 2 +
      ((location.mapPoint.y - a.center.y) / a.radiusY) ** 2;
    expect(normalized).toBeLessThanOrEqual(1);
  });

  it('deduplicates survey cells and slow pace maps more than fast', () => {
    expect(mergeSurveyCells([3, 1, 3], [2, 1])).toEqual([1, 2, 3]);
    const from = LOCATION_DEFS.get('post')!.mapPoint;
    const to = { x: 0.6, y: 0.5 };
    expect(surveyCells(from, to, 'slow', 'success').length).toBeGreaterThan(
      surveyCells(from, to, 'fast', 'success').length,
    );
  });

  it('rejects locked free targets and accepts reachable free targets', () => {
    const state = testState();
    expect(
      dispatchError(
        state,
        { kind: 'explore', target: { x: 0.25, y: 0.4 }, heroIds: ['p1'] },
        LOCATION_DEFS,
        MAP_REGIONS,
      ),
    ).toMatch(/beyond/);
    expect(
      dispatchError(
        state,
        { kind: 'explore', target: { x: 0.58, y: 0.5 }, heroIds: ['p1'] },
        LOCATION_DEFS,
        MAP_REGIONS,
      ),
    ).toBeNull();
  });

  it('commits survey knowledge only after the explorers return', () => {
    const state = testState(9);
    const before = [...state.mapKnowledge.surveyedCells];
    expect(
      dispatchExpedition(
        state,
        { kind: 'explore', target: { x: 0.58, y: 0.5 }, heroIds: ['p1'], pace: 'fast' },
        LOCATION_DEFS,
        MAP_REGIONS,
      ),
    ).toBe(true);
    const outbound = state.expeditions[0].turnsLeft;
    for (let i = 0; i < outbound; i++) advanceExpeditions(state, TEST_CONTENT, new Rng(i + 1), noop);
    expect(state.expeditions[0].surveyResult).toBeDefined();
    expect(state.mapKnowledge.surveyedCells).toEqual(before);
    while (state.expeditions.length > 0) advanceExpeditions(state, TEST_CONTENT, new Rng(99), noop);
    expect(state.mapKnowledge.surveyedCells.length).toBeGreaterThan(before.length);
  });

  it('builds terrain-tag travel context for free-coordinate expeditions', () => {
    const state = testState();
    dispatchExpedition(
      state,
      { kind: 'explore', target: { x: 0.58, y: 0.39 }, heroIds: ['p1'] },
      LOCATION_DEFS,
      MAP_REGIONS,
    );
    const travel = travelContextFor(state.expeditions[0], TEST_CONTENT)!;
    expect(travel.destination.locationId).toBeUndefined();
    expect(travel.destination.tags).toEqual(expect.arrayContaining(['marsh', 'ritual']));
  });

  it('all authored points sit in their declared regions', () => {
    for (const location of LOCATIONS) {
      expect(regionAt(location.mapPoint, MAP_REGIONS)?.id, location.id).toBe(location.mapRegion);
    }
  });
});
