// Shared test fixtures.

import { CONTENT } from '../../content/registry';
import { STARTING_STANDINGS } from '../../content/factions';
import { HERO_POOL, createHero } from '../../content/heroes';
import { LOCATIONS } from '../../content/locations';
import { MAP_FEATURES, MAP_REGIONS } from '../../content/map';
import { createInitialState } from '../state';
import type { GameState } from '../types';

export const TEST_CONTENT = CONTENT;
export const TEST_LOCATIONS = LOCATIONS;

export function testState(seed = 12345, heroIds?: string[]): GameState {
  const ids = heroIds ?? ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const heroes = HERO_POOL.filter((t) => ids.includes(t.id)).map(createHero);
  return createInitialState({
    seed,
    heroes,
    startingStandings: STARTING_STANDINGS,
    locationDefs: LOCATIONS,
    mapRegionDefs: MAP_REGIONS,
    mapFeatureDefs: MAP_FEATURES,
  });
}
