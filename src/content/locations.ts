// Authored places on the illustrated Ashmark map. Stable ids retain save and
// event compatibility; normalized points were calibrated from the guide labels
// on assets/ui/ashmark_map.jpg.

import type { LocationDef, LocationId } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

export const LOCATIONS: LocationDef[] = [
  {
    id: 'post',
    name: 'The Trading Post',
    blurb: 'Your clearing on the frontier. Tents, a firepit, and ambition.',
    hasMarket: true,
    initialDiscovery: 'known',
    tags: ['post'],
    mapPoint: { x: 0.59, y: 0.164 },
    mapRegion: 'northern_river',
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
    initialDiscovery: 'visited',
    tags: ['river', 'natives'],
    mapPoint: { x: 0.71, y: 0.154 },
    mapRegion: 'northern_river',
  },
  {
    id: 'hill_fort',
    name: 'The Ashcircle',
    blurb:
      'A ring of standing stones and old fire-scars where Dustwalker bands convene between migrations. No walls — the horse-herds are the only defense this country needs.',
    faction: 'HILL_TRIBES',
    hasMarket: true,
    priceBias: { furs: 0.6, hides: 0.8, grain: 1.2, salt: 1.3, tools: 1.5, cloth: 1.4 },
    initialDiscovery: 'rumored',
    tags: ['hills', 'natives'],
    mapPoint: { x: 0.2, y: 0.35 },
    mapRegion: 'western_interior',
  },
  {
    id: 'elder_grove',
    name: "Themba's Town",
    blurb:
      'Jungle-swallowed ruins and a settlement that studies them as much as it lives among them. The Bejasi Hills folk trade here, when they choose to.',
    faction: 'OLD_PEOPLE',
    hasMarket: true,
    priceBias: { amber: 0.6, herbs: 0.7, salt: 1.2, tools: 1.3, cloth: 1.3 },
    initialDiscovery: 'rumored',
    tags: ['forest', 'ritual', 'natives'],
    mapPoint: { x: 0.682, y: 0.375 },
    mapRegion: 'eastern_ashmark',
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
    initialDiscovery: 'visited',
    tags: ['homeland', 'river'],
    mapPoint: { x: 0.9, y: 0.491 },
    mapRegion: 'eastern_ashmark',
  },

  // ------------------------------------------------------------- wilderness
  {
    id: 'old_road',
    name: 'The Shattered Road',
    blurb:
      'A paved road from some empire that predates the Sauromatian tribes themselves, broken now into causeways of tilted stone. It leads west toward the Dustwalker range.',
    hasMarket: false,
    initialDiscovery: 'rumored',
    tags: ['ruin', 'road'],
    mapPoint: { x: 0.44, y: 0.34 },
    mapRegion: 'charter_corridor',
  },
  {
    id: 'beast_wilds',
    name: 'The Gnawback Camp', // working name (BEASTFOLK_SPEC.md §9) — Bartosz to confirm/replace
    blurb:
      'A scatter of bone-hung stakes and cook-fire smoke where the broken causeways give out into deep scrub. Orc war-bands and goblin clans hold this stretch of the wilds; no chief speaks for all of it, and no map agrees where it ends. Deliberately not a diplomacy seat — nobody here answers for the rest.',
    hasMarket: false,
    initialDiscovery: 'rumored',
    tags: ['wilds', 'beastfolk', 'danger'],
    mapPoint: { x: 0.35, y: 0.43 },
    mapRegion: 'western_interior',
  },
  {
    id: 'drowned_ruins',
    name: 'The Drowned Weir',
    blurb:
      'Roofless halls sunk to the lintels where the tributary runs its worst rapids. Even the Tributary Towns give the old weir a wide berth.',
    hasMarket: false,
    initialDiscovery: 'rumored',
    tags: ['ruin', 'marsh'],
    mapPoint: { x: 0.56, y: 0.235 },
    mapRegion: 'northern_river',
  },
  {
    id: 'black_mere',
    name: 'The Black Mere',
    blurb:
      'A lake like spilled ink below the Bejasi Hills, where the boundary between the living country and whatever the Veil touches runs thin. Greyleaf grows thick on its margins.',
    hasMarket: false,
    initialDiscovery: 'unknown',
    tags: ['marsh', 'ritual'],
    mapPoint: { x: 0.58, y: 0.39 },
    mapRegion: 'charter_corridor',
  },
  {
    id: 'high_pass',
    name: 'The Stormwall Pass',
    blurb: 'The only way over the Stormwall Mountains, when it is open at all.',
    hasMarket: false,
    initialDiscovery: 'unknown',
    tags: ['hills', 'pass'],
    mapPoint: { x: 0.3, y: 0.205 },
    mapRegion: 'stormwall',
  },
  {
    id: 'amber_shore',
    name: 'The Amber Cut',
    blurb:
      'An old dig cut into the jungle rock, amber-veined and half-swallowed by vines. The Bejasi Hills folk still visit it by moonlight, though no one will say what for.',
    hasMarket: false,
    initialDiscovery: 'unknown',
    tags: ['ruin', 'jungle'],
    mapPoint: { x: 0.72, y: 0.42 },
    mapRegion: 'eastern_ashmark',
  },

  // ---------------------------------------------- the wider peoples (PEOPLES_SPEC)
  {
    id: 'pemba_jasiri',
    name: 'Pemba-Jasiri',
    blurb:
      'A walled town in the Stormwall pass, held with the Knights of Saint Eirwen, where the Weri work their deep-forges. The only place to court the Weri to your service — and the highest road in the Ashmark.',
    faction: 'KNIGHTS_EIRWEN',
    hasMarket: true,
    priceBias: { tools: 0.6, salt: 1.3, grain: 1.3, cloth: 1.1, furs: 1.2 },
    initialDiscovery: 'unknown',
    tags: ['pass', 'mountain', 'weri'],
    mapPoint: { x: 0.34, y: 0.198 },
    mapRegion: 'stormwall',
  },
  {
    id: 'blackstone_plateau',
    name: 'The Blackstone Plateau',
    blurb:
      'Volcanic badlands of jagged black rock and steaming fumaroles, ring-camped by the Sunspear Hanjoda. Their javelin-throwers watch every approach from the heights; strangers are met at the edge, never the heart.',
    faction: 'HILL_TRIBES',
    hasMarket: true,
    priceBias: { furs: 0.7, hides: 0.8, grain: 1.4, salt: 1.4, tools: 1.5, timber: 1.6 },
    initialDiscovery: 'unknown',
    tags: ['hills', 'badlands', 'natives'],
    mapPoint: { x: 0.274, y: 0.342 },
    mapRegion: 'western_interior',
  },
  {
    id: 'redsand_range',
    name: 'The Redsand Range',
    blurb:
      'Rust-red prairie between the plateau and the Bleak Hills, ranged by the Redsand Hanjoda — largest and richest of the horse-tribes, their fired pottery traded the length of the Ashmark. They watch the Cult\'s passes so others need not.',
    faction: 'HILL_TRIBES',
    hasMarket: true,
    priceBias: { hides: 0.7, furs: 0.8, grain: 1.2, cloth: 1.2, tools: 1.3 },
    initialDiscovery: 'unknown',
    tags: ['plains', 'natives'],
    mapPoint: { x: 0.267, y: 0.481 },
    mapRegion: 'western_interior',
  },
  {
    id: 'shackle_station',
    name: 'Shackle Station',
    blurb:
      'The Company\'s loneliest garrison, far up the Black River, where Ansberite and Sauromatian have blended past telling into one creole town. Loyal to Thornwatch in name; a world unto itself in fact.',
    faction: 'CHARTER_COMPANY',
    hasMarket: true,
    priceBias: { tools: 0.9, cloth: 0.9, salt: 1.0, furs: 1.3, hides: 1.2, amber: 1.3 },
    initialDiscovery: 'known',
    tags: ['homeland', 'river', 'creole'],
    mapPoint: { x: 0.91, y: 0.322 },
    mapRegion: 'eastern_ashmark',
  },
];

export const LOCATION_DEFS: ReadonlyMap<LocationId, LocationDef> = uniqueIdMap('location', LOCATIONS);
export const LOCATION_NAMES: ReadonlyMap<LocationId, string> = new Map(
  [...LOCATION_DEFS].map(([id, location]) => [id, location.name]),
);
