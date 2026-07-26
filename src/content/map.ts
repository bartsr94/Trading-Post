// Spatial Ashmark access zones and coarse travel-event terrain overlays.
// Coordinates are normalized to the 4096x3072 map asset (0..1).

import type { MapFeatureDef, MapRegionDef } from '../engine/types';

export const MAP_REGIONS: readonly MapRegionDef[] = [
  {
    id: 'far_west',
    name: 'the far western marches',
    polygon: [
      { x: 0, y: 0.26 },
      { x: 0.16, y: 0.22 },
      { x: 0.15, y: 0.63 },
      { x: 0, y: 0.62 },
    ],
    requires: [{ type: 'flag', flag: 'map_far_west_routes_open' }],
    tags: ['wilds', 'danger'],
  },
  {
    id: 'stormwall',
    name: 'the Stormwall approaches',
    polygon: [
      { x: 0.04, y: 0 },
      { x: 0.55, y: 0 },
      { x: 0.61, y: 0.08 },
      { x: 0.6, y: 0.15 },
      { x: 0.52, y: 0.2 },
      { x: 0.42, y: 0.225 },
      { x: 0.3, y: 0.235 },
      { x: 0.18, y: 0.215 },
      { x: 0.08, y: 0.18 },
      { x: 0.04, y: 0.11 },
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
      { x: 0.38, y: 0.18 },
      { x: 0.44, y: 0.11 },
      { x: 0.61, y: 0.1 },
      { x: 0.75, y: 0.11 },
      { x: 0.84, y: 0.135 },
      { x: 0.88, y: 0.19 },
      { x: 0.86, y: 0.245 },
      { x: 0.73, y: 0.27 },
      { x: 0.55, y: 0.25 },
      { x: 0.43, y: 0.225 },
      { x: 0.38, y: 0.2 },
    ],
    requires: [],
    tags: ['river', 'forest', 'frontier'],
  },
  {
    id: 'western_interior',
    name: 'the western interior',
    polygon: [
      { x: 0.08, y: 0.29 },
      { x: 0.24, y: 0.285 },
      { x: 0.35, y: 0.31 },
      { x: 0.43, y: 0.37 },
      { x: 0.445, y: 0.49 },
      { x: 0.4, y: 0.565 },
      { x: 0.3, y: 0.595 },
      { x: 0.16, y: 0.59 },
      { x: 0.08, y: 0.54 },
      { x: 0.05, y: 0.42 },
    ],
    requires: [{ type: 'locationDiscovery', location: 'old_road', atLeast: 'visited' }],
    tags: ['plains', 'wilds', 'natives'],
  },
  {
    id: 'charter_corridor',
    name: 'the charter corridor',
    polygon: [
      { x: 0.18, y: 0.245 },
      { x: 0.33, y: 0.235 },
      { x: 0.51, y: 0.235 },
      { x: 0.61, y: 0.215 },
      { x: 0.67, y: 0.24 },
      { x: 0.69, y: 0.31 },
      { x: 0.66, y: 0.375 },
      { x: 0.62, y: 0.45 },
      { x: 0.54, y: 0.46 },
      { x: 0.43, y: 0.43 },
      { x: 0.3, y: 0.38 },
      { x: 0.19, y: 0.32 },
    ],
    requires: [],
    tags: ['road', 'frontier'],
  },
  {
    id: 'eastern_ashmark',
    name: 'the eastern Ashmark',
    polygon: [
      { x: 0.62, y: 0.21 },
      { x: 0.78, y: 0.2 },
      { x: 0.91, y: 0.255 },
      { x: 0.97, y: 0.35 },
      { x: 0.98, y: 0.54 },
      { x: 0.95, y: 0.6 },
      { x: 0.84, y: 0.605 },
      { x: 0.73, y: 0.53 },
      { x: 0.65, y: 0.45 },
      { x: 0.61, y: 0.325 },
    ],
    requires: [],
    tags: ['forest', 'jungle', 'river'],
  },
  {
    id: 'southern_ashmark',
    name: 'the southern Ashmark',
    polygon: [
      { x: 0.45, y: 0.44 },
      { x: 0.58, y: 0.45 },
      { x: 0.76, y: 0.49 },
      { x: 0.88, y: 0.58 },
      { x: 0.9, y: 0.76 },
      { x: 0.79, y: 0.85 },
      { x: 0.64, y: 0.82 },
      { x: 0.51, y: 0.72 },
      { x: 0.44, y: 0.56 },
    ],
    requires: [{ type: 'locationDiscovery', location: 'elder_grove', atLeast: 'visited' }],
    tags: ['wilds', 'danger', 'forest'],
  },
] as const;

export const MAP_FEATURES: readonly MapFeatureDef[] = [
  {
    id: 'charted_east_bank',
    polygon: [
      { x: 0.84, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.84, y: 1 },
    ],
    tags: ['river'],
    initiallySurveyed: true,
  },
  {
    id: 'charted_njaro_basin',
    polygon: [
      { x: 0.6, y: 0.07 },
      { x: 0.87, y: 0.07 },
      { x: 0.88, y: 0.235 },
      { x: 0.63, y: 0.24 },
      { x: 0.58, y: 0.16 },
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
  // ---- People/faction territories (TERRITORY_DISCOVERY_SPEC.md §3) ----
  // Traced from src/assets/ui/The Ashmark - Racial distribution.jpg (same 4:3
  // framing as the base map, so these normalized coords line up 1:1). Lowercase
  // people/faction tags gate travel & exploration events via `destinationTag`,
  // so a group's content fires only in its own country. These supersede the old
  // single `beast_wilds` box (now split into real Orc + Goblin ranges); both
  // keep the `beastfolk` tag so the shared travel_beastfolk_toll still fires.
  {
    id: 'orc_range',
    polygon: [{ x: 0.180, y: 0.000 }, { x: 0.460, y: 0.000 }, { x: 0.500, y: 0.060 }, { x: 0.545, y: 0.073 }, { x: 0.675, y: 0.053 }, { x: 0.680, y: 0.093 }, { x: 0.660, y: 0.127 }, { x: 0.605, y: 0.140 }, { x: 0.555, y: 0.100 }, { x: 0.500, y: 0.107 }, { x: 0.440, y: 0.193 }, { x: 0.405, y: 0.200 }, { x: 0.315, y: 0.180 }, { x: 0.300, y: 0.147 }, { x: 0.250, y: 0.120 }, { x: 0.185, y: 0.007 }],
    tags: ['orc', 'beastfolk', 'wilds', 'danger'],
  },
  {
    id: 'goblin_range',
    polygon: [{ x: 0.410, y: 0.200 }, { x: 0.505, y: 0.213 }, { x: 0.540, y: 0.240 }, { x: 0.465, y: 0.247 }, { x: 0.425, y: 0.293 }, { x: 0.360, y: 0.273 }, { x: 0.315, y: 0.293 }, { x: 0.290, y: 0.280 }, { x: 0.310, y: 0.240 }, { x: 0.375, y: 0.247 }, { x: 0.405, y: 0.207 }],
    tags: ['goblin', 'beastfolk', 'wilds', 'danger'],
  },
  {
    id: 'goblin_range_east',
    polygon: [{ x: 0.575, y: 0.273 }, { x: 0.605, y: 0.280 }, { x: 0.595, y: 0.333 }, { x: 0.465, y: 0.373 }, { x: 0.425, y: 0.340 }, { x: 0.570, y: 0.280 }],
    tags: ['goblin', 'beastfolk', 'wilds', 'danger'],
  },
  {
    id: 'harpy_range',
    polygon: [{ x: 0.185, y: 0.047 }, { x: 0.225, y: 0.087 }, { x: 0.205, y: 0.100 }, { x: 0.230, y: 0.147 }, { x: 0.255, y: 0.133 }, { x: 0.250, y: 0.153 }, { x: 0.280, y: 0.153 }, { x: 0.305, y: 0.193 }, { x: 0.330, y: 0.187 }, { x: 0.345, y: 0.220 }, { x: 0.315, y: 0.213 }, { x: 0.295, y: 0.240 }, { x: 0.235, y: 0.193 }, { x: 0.175, y: 0.200 }, { x: 0.185, y: 0.133 }, { x: 0.145, y: 0.120 }, { x: 0.135, y: 0.087 }, { x: 0.145, y: 0.060 }, { x: 0.180, y: 0.053 }],
    tags: ['harpy', 'wilds', 'danger'],
  },
  {
    id: 'harpy_range_east',
    polygon: [{ x: 0.530, y: 0.113 }, { x: 0.570, y: 0.127 }, { x: 0.535, y: 0.153 }, { x: 0.550, y: 0.233 }, { x: 0.510, y: 0.200 }, { x: 0.445, y: 0.187 }, { x: 0.480, y: 0.167 }, { x: 0.500, y: 0.120 }, { x: 0.525, y: 0.120 }],
    tags: ['harpy', 'wilds', 'danger'],
  },
  {
    id: 'knights_range',
    polygon: [{ x: 0.470, y: 0.000 }, { x: 0.680, y: 0.020 }, { x: 0.685, y: 0.053 }, { x: 0.560, y: 0.053 }, { x: 0.520, y: 0.007 }, { x: 0.475, y: 0.007 }],
    tags: ['knights'],
  },
  {
    // The intentional Knights enclave in the goblin/harpy borderland
    // (Bartosz-confirmed) — below the auto-tracer's noise floor, hand-placed.
    id: 'knights_enclave',
    polygon: [{ x: 0.345, y: 0.315 }, { x: 0.400, y: 0.315 }, { x: 0.400, y: 0.365 }, { x: 0.345, y: 0.365 }],
    tags: ['knights'],
  },
  {
    id: 'kiswani_range',
    polygon: [{ x: 0.710, y: 0.147 }, { x: 0.750, y: 0.167 }, { x: 0.720, y: 0.213 }, { x: 0.765, y: 0.347 }, { x: 0.830, y: 0.353 }, { x: 0.865, y: 0.313 }, { x: 0.870, y: 0.253 }, { x: 0.885, y: 0.347 }, { x: 0.920, y: 0.360 }, { x: 0.945, y: 0.407 }, { x: 0.905, y: 0.467 }, { x: 0.875, y: 0.473 }, { x: 0.875, y: 0.507 }, { x: 0.915, y: 0.547 }, { x: 0.930, y: 0.600 }, { x: 0.915, y: 0.633 }, { x: 0.935, y: 0.660 }, { x: 0.935, y: 0.713 }, { x: 0.920, y: 0.727 }, { x: 0.935, y: 0.787 }, { x: 0.905, y: 0.753 }, { x: 0.915, y: 0.693 }, { x: 0.900, y: 0.673 }, { x: 0.900, y: 0.567 }, { x: 0.865, y: 0.513 }, { x: 0.870, y: 0.460 }, { x: 0.920, y: 0.407 }, { x: 0.910, y: 0.373 }, { x: 0.870, y: 0.340 }, { x: 0.830, y: 0.373 }, { x: 0.825, y: 0.407 }, { x: 0.695, y: 0.407 }, { x: 0.715, y: 0.260 }, { x: 0.700, y: 0.207 }, { x: 0.670, y: 0.180 }, { x: 0.630, y: 0.193 }, { x: 0.570, y: 0.267 }, { x: 0.455, y: 0.300 }, { x: 0.475, y: 0.267 }, { x: 0.555, y: 0.247 }, { x: 0.565, y: 0.193 }, { x: 0.705, y: 0.153 }],
    tags: ['kiswani'],
  },
  {
    id: 'hanjoda_range',
    polygon: [{ x: 0.445, y: 0.293 }, { x: 0.445, y: 0.320 }, { x: 0.365, y: 0.353 }, { x: 0.360, y: 0.413 }, { x: 0.385, y: 0.480 }, { x: 0.345, y: 0.520 }, { x: 0.300, y: 0.520 }, { x: 0.275, y: 0.487 }, { x: 0.235, y: 0.480 }, { x: 0.190, y: 0.420 }, { x: 0.235, y: 0.320 }, { x: 0.260, y: 0.300 }, { x: 0.320, y: 0.320 }, { x: 0.345, y: 0.300 }, { x: 0.440, y: 0.300 }],
    tags: ['hanjoda'],
  },
  {
    id: 'company_range',
    polygon: [{ x: 0.935, y: 0.580 }, { x: 0.955, y: 0.607 }, { x: 0.940, y: 0.740 }, { x: 0.965, y: 0.773 }, { x: 0.955, y: 0.787 }, { x: 0.930, y: 0.747 }, { x: 0.945, y: 0.707 }, { x: 0.925, y: 0.633 }, { x: 0.935, y: 0.587 }],
    tags: ['company'],
  },
] as const;
