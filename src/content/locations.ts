// Authored places on the illustrated Ashmark map. Stable ids retain save and
// event compatibility; normalized points were calibrated from the guide labels
// on assets/ui/ashmark_map.jpg.

import type { LocationDef, LocationId } from '../engine/types';
import { uniqueIdMap } from './uniqueIdMap';

// priceBias is a market's permanent structural identity (TRADING_ECONOMY_SPEC
// §3a): each has ~2 goods it produces cheap (<1) and ~2 it lacks and pays dear
// for (>1), extremes ~0.5-1.7. The post itself is the neutral reference (bias
// 1). The legible routes this is meant to create: native furs/hides (hill
// tribes, river clans) -> Company garrisons; Company/Weri tools & cloth ->
// natives; Bejasi amber & Greyleaf (Themba's Town) -> Company. Umoja-Njema is a
// deliberately near-flat "efficient neutral" market. Widen with intent, not by
// feel — calibration is a later step against §6 targets.
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
    // River fisherfolk: their own furs/hides/food cheap; imports dear.
    priceBias: { hides: 0.55, furs: 0.7, grain: 0.85, salt: 1.3, cloth: 1.5, tools: 1.6 },
    initialDiscovery: 'visited',
    tags: ['river', 'natives'],
    mapPoint: { x: 0.71, y: 0.154 },
    mapRegion: 'northern_river',
  },
  {
    id: 'kalasha_tora',
    name: 'Kalasha-Tora',
    blurb:
      'Pilots and boatwrights on the northern bank, where the tributary\'s gradient turns to rapids. Their crews walked your first survey through the shoals and helped clear the ground your post now stands on, gambling that a Company clearing nearby would mean steadier trade than tolls alone ever could.',
    faction: 'RIVER_CLANS',
    startingStanding: 30,
    hasMarket: true,
    // Boatwrights: timber cheap by their trade. Close friendly hub, modest spreads.
    priceBias: { timber: 0.6, hides: 0.85, furs: 0.9, salt: 1.2, cloth: 1.2, tools: 1.3 },
    initialDiscovery: 'visited',
    tags: ['river', 'natives', 'trade'],
    mapPoint: { x: 0.6218, y: 0.1928 },
    mapRegion: 'northern_river',
  },
  {
    id: 'hill_fort',
    name: 'The Ashcircle',
    blurb:
      'A ring of standing stones and old fire-scars where Dustwalker bands convene between migrations. No walls — the horse-herds are the only defense this country needs.',
    faction: 'HILL_TRIBES',
    hasMarket: true,
    // Dustwalker horse-nomads: hunt/herd furs & hides cheap; no farms, forest, or forges.
    priceBias: { hides: 0.5, furs: 0.55, grain: 1.3, timber: 1.4, cloth: 1.5, salt: 1.4, tools: 1.6 },
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
    // Bejasi Hills folk: the source of amber and Greyleaf; jungle timber too.
    priceBias: { amber: 0.5, herbs: 0.55, timber: 0.75, salt: 1.3, tools: 1.4, cloth: 1.4 },
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
    // Company import hub off the Port Iron barges: manufactures cheap, and the
    // main sink shipping frontier furs/amber/Greyleaf home.
    priceBias: { tools: 0.6, cloth: 0.6, salt: 0.7, hides: 1.4, herbs: 1.5, furs: 1.6, amber: 1.6 },
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
    name: 'The Gnawback Camp',
    blurb:
      'A scatter of bone-hung stakes and cook-fire smoke where the broken causeways give out into deep scrub. Orc war-bands hold this stretch of the wilds; no chief speaks for all of them, and no map agrees where the camp truly ends. Deliberately not a diplomacy seat — nobody here answers for the rest.',
    hasMarket: false,
    initialDiscovery: 'rumored',
    tags: ['wilds', 'beastfolk', 'orc', 'danger'],
    mapPoint: { x: 0.4488, y: 0.1588 },
    mapRegion: 'stormwall',
  },
  {
    id: 'goblin_wilds',
    name: 'The Tangle',
    blurb:
      'A snarl of deadfall and briar dragged into makeshift walls, laced with snares too clever to walk through carelessly. Goblin clans hold this ground and reshape it season to season; no elder speaks for all of it, and the traps outrun any map that tries to fix them. Deliberately not a diplomacy seat — nobody here answers for the rest.',
    hasMarket: false,
    initialDiscovery: 'rumored',
    tags: ['wilds', 'beastfolk', 'goblin', 'danger'],
    mapPoint: { x: 0.4572, y: 0.2543 },
    mapRegion: 'charter_corridor',
  },
  {
    id: 'drowned_ruins',
    name: 'Umoja-Njema',
    blurb:
      'A neutral market ground on the river\'s southern bank, opposite Kalasha-Tora\'s rapids. Weapons stay sheathed here; arbiters settle disputes, and Company and Cult traders alike are free to deal.',
    hasMarket: true,
    // Neutral arbiter market: deliberately near-flat, the efficient low-risk option.
    priceBias: { tools: 0.85, cloth: 0.9, salt: 0.95, hides: 1.1, amber: 1.15, furs: 1.15 },
    initialDiscovery: 'rumored',
    tags: ['river', 'natives', 'trade'],
    mapPoint: { x: 0.561221, y: 0.233372 },
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
    // Weri deep-forges: the cheapest tools in the Ashmark. High and cold — food,
    // salt, and furs all dear.
    priceBias: { tools: 0.5, hides: 0.9, cloth: 1.2, furs: 1.4, salt: 1.4, grain: 1.5 },
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
    // Volcanic badlands: herders' furs/hides cheap; nothing grows or stands, so
    // food, timber, salt, and tools are the dearest anywhere.
    priceBias: { hides: 0.55, furs: 0.6, cloth: 1.4, salt: 1.5, tools: 1.6, grain: 1.6, timber: 1.7 },
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
    // Richest of the horse-tribes: the great hide source; prairie has no timber
    // or forges and they can pay for cloth.
    priceBias: { hides: 0.5, furs: 0.75, grain: 1.2, cloth: 1.3, tools: 1.4, timber: 1.4 },
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
    // Loneliest Company garrison, far up the Black River: imports less cheap than
    // Thornwatch (remoter from Port Iron), but starved enough to pay the top price
    // for frontier furs, hides, and amber — the reward for the long haul.
    priceBias: { tools: 0.8, cloth: 0.85, grain: 1.3, herbs: 1.4, hides: 1.5, furs: 1.7, amber: 1.7 },
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
