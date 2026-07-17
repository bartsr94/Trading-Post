// The map (spec §10): a node graph of ~10 locations. Ashmark grounding per
// docs/ASHMARK_LORE_SPEC.md. Travel turns are one-way from the post;
// connections drive the map drawing and rumor spread.

import type { LocationDef, LocationId } from '../engine/types';

export const LOCATIONS: LocationDef[] = [
  {
    id: 'post',
    name: 'The Trading Post',
    blurb: 'Your clearing on the frontier. Tents, a firepit, and ambition.',
    hasMarket: true,
    travelTurns: 0,
    initialDiscovery: 'known',
    connections: ['river_meet', 'old_road', 'elder_grove', 'charter_landing'],
    tags: ['post'],
    mapX: 50,
    mapY: 55,
  },

  // ------------------------------------------------------------ faction seats
  {
    id: 'river_meet',
    name: 'Njaro-Matu',
    blurb:
      'Stilt-houses and fish smoke at the tributary\'s mouth. Pragmatic and calculating, seat of the Tributary Towns.',
    faction: 'RIVER_CLANS',
    hasMarket: true,
    priceBias: { grain: 0.8, hides: 0.7, furs: 0.9, salt: 1.2, tools: 1.4, cloth: 1.3 },
    travelTurns: 2,
    initialDiscovery: 'visited',
    connections: ['post', 'drowned_ruins'],
    tags: ['river', 'natives'],
    mapX: 28,
    mapY: 70,
  },
  {
    id: 'hill_fort',
    name: 'The Ashcircle',
    blurb:
      'A ring of standing stones and old fire-scars where Dustwalker bands convene between migrations. No walls — the horse-herds are the only defense this country needs.',
    faction: 'HILL_TRIBES',
    hasMarket: true,
    priceBias: { furs: 0.6, hides: 0.8, grain: 1.2, salt: 1.3, tools: 1.5, cloth: 1.4 },
    travelTurns: 3,
    initialDiscovery: 'rumored',
    connections: ['old_road', 'high_pass'],
    tags: ['hills', 'natives'],
    mapX: 26,
    mapY: 24,
  },
  {
    id: 'elder_grove',
    name: "Themba's Town",
    blurb:
      'Jungle-swallowed ruins and a settlement that studies them as much as it lives among them. The Bejasi Hills folk trade here, when they choose to.',
    faction: 'OLD_PEOPLE',
    hasMarket: true,
    priceBias: { amber: 0.6, herbs: 0.7, salt: 1.2, tools: 1.3, cloth: 1.3 },
    travelTurns: 4,
    initialDiscovery: 'rumored',
    connections: ['post', 'black_mere', 'amber_shore'],
    tags: ['forest', 'ritual', 'natives'],
    mapX: 76,
    mapY: 28,
  },
  {
    id: 'charter_landing',
    name: 'Thornwatch',
    blurb:
      'The nearest Ansberry Company garrison, where river barges up from Port Iron put in. Imports, inspectors, and news.',
    faction: 'CHARTER_COMPANY',
    hasMarket: true,
    priceBias: {
      tools: 0.8,
      cloth: 0.8,
      salt: 0.9,
      furs: 1.5,
      amber: 1.4,
      herbs: 1.4,
      hides: 1.2,
      timber: 1.1,
    },
    travelTurns: 3,
    initialDiscovery: 'visited',
    connections: ['post', 'amber_shore'],
    tags: ['homeland', 'river'],
    mapX: 74,
    mapY: 82,
  },

  // ------------------------------------------------------------- wilderness
  {
    id: 'old_road',
    name: 'The Shattered Road',
    blurb:
      'A paved road from some empire that predates the Sauromatian tribes themselves, broken now into causeways of tilted stone. It leads west toward the Dustwalker range.',
    hasMarket: false,
    travelTurns: 2,
    initialDiscovery: 'rumored',
    connections: ['post', 'hill_fort', 'high_pass'],
    tags: ['ruin', 'road'],
    mapX: 38,
    mapY: 40,
  },
  {
    id: 'drowned_ruins',
    name: 'The Drowned Weir',
    blurb:
      'Roofless halls sunk to the lintels where the tributary runs its worst rapids. Even the Tributary Towns give the old weir a wide berth.',
    hasMarket: false,
    travelTurns: 3,
    initialDiscovery: 'rumored',
    connections: ['river_meet'],
    tags: ['ruin', 'marsh'],
    mapX: 12,
    mapY: 56,
  },
  {
    id: 'black_mere',
    name: 'The Black Mere',
    blurb:
      'A lake like spilled ink below the Bejasi Hills, where the boundary between the living country and whatever the Veil touches runs thin. Greyleaf grows thick on its margins.',
    hasMarket: false,
    travelTurns: 4,
    initialDiscovery: 'unknown',
    connections: ['elder_grove', 'high_pass'],
    tags: ['marsh', 'ritual'],
    mapX: 58,
    mapY: 12,
  },
  {
    id: 'high_pass',
    name: 'The Stormwall Pass',
    blurb: 'The only way over the Stormwall Mountains, when it is open at all.',
    hasMarket: false,
    travelTurns: 4,
    initialDiscovery: 'unknown',
    connections: ['hill_fort', 'old_road', 'black_mere'],
    tags: ['hills', 'pass'],
    mapX: 10,
    mapY: 10,
  },
  {
    id: 'amber_shore',
    name: 'The Amber Cut',
    blurb:
      'An old dig cut into the jungle rock, amber-veined and half-swallowed by vines. The Bejasi Hills folk still visit it by moonlight, though no one will say what for.',
    hasMarket: false,
    travelTurns: 4,
    initialDiscovery: 'unknown',
    connections: ['elder_grove', 'charter_landing'],
    tags: ['ruin', 'jungle'],
    mapX: 92,
    mapY: 52,
  },
];

export const LOCATION_DEFS: ReadonlyMap<LocationId, LocationDef> = new Map(
  LOCATIONS.map((l) => [l.id, l]),
);
export const LOCATION_NAMES: ReadonlyMap<LocationId, string> = new Map(
  LOCATIONS.map((l) => [l.id, l.name]),
);
