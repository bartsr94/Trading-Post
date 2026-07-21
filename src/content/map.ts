// Spatial Ashmark access zones and coarse travel-event terrain overlays.
// Coordinates are normalized to the 4096×3072 map asset (0..1).

import type { MapFeatureDef, MapRegionDef } from '../engine/types';

export const MAP_REGIONS: readonly MapRegionDef[] = [
  {
    id: 'far_west',
    name: 'the far western marches',
    polygon: [
      { x: 0, y: 0 },
      { x: 0.12, y: 0 },
      { x: 0.12, y: 0.62 },
      { x: 0, y: 0.62 },
    ],
    requires: [{ type: 'flag', flag: 'map_far_west_routes_open' }],
    tags: ['wilds', 'danger'],
  },
  {
    id: 'stormwall',
    name: 'the Stormwall approaches',
    polygon: [
      { x: 0.12, y: 0 },
      { x: 0.55, y: 0 },
      { x: 0.55, y: 0.28 },
      { x: 0.12, y: 0.28 },
    ],
    requires: [
      { type: 'locationDiscovery', location: 'old_road', atLeast: 'visited' },
      { type: 'locationDiscovery', location: 'hill_fort', atLeast: 'visited' },
    ],
    tags: ['hills', 'mountain', 'danger'],
  },
  {
    id: 'northern_river',
    name: 'the northern river country',
    polygon: [
      { x: 0.55, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.28 },
      { x: 0.55, y: 0.28 },
    ],
    requires: [],
    tags: ['river', 'forest'],
  },
  {
    id: 'western_interior',
    name: 'the western interior',
    polygon: [
      { x: 0.12, y: 0.28 },
      { x: 0.42, y: 0.28 },
      { x: 0.42, y: 0.62 },
      { x: 0.12, y: 0.62 },
    ],
    requires: [{ type: 'locationDiscovery', location: 'old_road', atLeast: 'visited' }],
    tags: ['plains', 'wilds', 'natives'],
  },
  {
    id: 'charter_corridor',
    name: 'the charter corridor',
    polygon: [
      { x: 0.42, y: 0.28 },
      { x: 0.62, y: 0.28 },
      { x: 0.62, y: 0.62 },
      { x: 0.42, y: 0.62 },
    ],
    requires: [],
    tags: ['road', 'frontier'],
  },
  {
    id: 'eastern_ashmark',
    name: 'the eastern Ashmark',
    polygon: [
      { x: 0.62, y: 0.28 },
      { x: 1, y: 0.28 },
      { x: 1, y: 0.62 },
      { x: 0.62, y: 0.62 },
    ],
    requires: [],
    tags: ['forest', 'jungle', 'river'],
  },
  {
    id: 'southern_ashmark',
    name: 'the southern Ashmark',
    polygon: [
      { x: 0, y: 0.62 },
      { x: 1, y: 0.62 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    requires: [{ type: 'flag', flag: 'map_southern_routes_open' }],
    tags: ['wilds', 'danger'],
  },
] as const;

export const MAP_FEATURES: readonly MapFeatureDef[] = [
  {
    id: 'charted_black_river_corridor',
    polygon: [
      { x: 0.82, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.82, y: 1 },
    ],
    tags: ['river'],
    initiallySurveyed: true,
  },
  {
    id: 'northern_tributary',
    polygon: [
      { x: 0.24, y: 0.13 },
      { x: 0.78, y: 0.13 },
      { x: 0.78, y: 0.29 },
      { x: 0.24, y: 0.29 },
    ],
    tags: ['river'],
  },
  {
    id: 'black_river',
    polygon: [
      { x: 0.75, y: 0 },
      { x: 0.91, y: 0 },
      { x: 0.91, y: 1 },
      { x: 0.75, y: 1 },
    ],
    tags: ['river'],
  },
  {
    id: 'stormwall_mountains',
    polygon: [
      { x: 0.08, y: 0 },
      { x: 0.62, y: 0 },
      { x: 0.62, y: 0.28 },
      { x: 0.08, y: 0.28 },
    ],
    tags: ['hills', 'mountain', 'pass'],
  },
  {
    id: 'bejasi_jungle',
    polygon: [
      { x: 0.48, y: 0.23 },
      { x: 0.82, y: 0.23 },
      { x: 0.82, y: 0.62 },
      { x: 0.48, y: 0.62 },
    ],
    tags: ['forest', 'jungle'],
  },
  {
    id: 'black_mere_wetlands',
    polygon: [
      { x: 0.53, y: 0.32 },
      { x: 0.64, y: 0.32 },
      { x: 0.64, y: 0.46 },
      { x: 0.53, y: 0.46 },
    ],
    tags: ['marsh', 'ritual'],
  },
  {
    id: 'shattered_road',
    polygon: [
      { x: 0.34, y: 0.28 },
      { x: 0.55, y: 0.28 },
      { x: 0.55, y: 0.39 },
      { x: 0.34, y: 0.39 },
    ],
    tags: ['road', 'ruin'],
  },
  {
    id: 'beast_wilds',
    polygon: [
      { x: 0.28, y: 0.35 },
      { x: 0.43, y: 0.35 },
      { x: 0.43, y: 0.54 },
      { x: 0.28, y: 0.54 },
    ],
    tags: ['wilds', 'beastfolk', 'danger'],
  },
] as const;
