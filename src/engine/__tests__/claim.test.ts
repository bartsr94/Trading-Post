// The Concession, settlement & farming (TULA_SETTLEMENT_SPEC.md §11): land
// math, the seasonal harvest, the herd, over-Concession pressure, the Company
// muster's rural draw, and the Invite Settlers / Negotiate Land expeditions.

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../content/tuning';
import {
  accrueCropProgress,
  addClaim,
  addHerd,
  croplandCapacity,
  growHerd,
  herdCarryingCapacity,
  isOverClaim,
  landChains,
  nearestDiscoveredNativeFaction,
  overClaimStandingTarget,
  pastureCapacity,
  resolveHarvest,
  setLandAllocation,
  wildlandCapacity,
  wildlandTrickle,
} from '../claim';
import { advanceExpeditions, dispatchExpedition } from '../expeditions';
import type { ExpeditionContext } from '../expeditions';
import { companyMuster } from '../raids';
import {
  addResidents,
  claimCapacity,
  freshResidents,
  residentTotal,
  updateContentment,
} from '../residents';
import { Rng } from '../rng';
import type { GameState, Hero } from '../types';
import { TEST_CONTENT, testState } from './helpers';

const noop = () => {};
const CTX = TEST_CONTENT as unknown as ExpeditionContext;

function runToHomecoming(s: GameState): void {
  const rng = new Rng(1);
  for (let i = 0; i < 40 && s.expeditions.length > 0; i++) advanceExpeditions(s, CTX, rng, noop);
}

/** Make a party overwhelmingly likely to pass an arrival check. */
function makeSkilled(...heroes: Hero[]): void {
  for (const h of heroes) {
    h.skills.bargain = 5;
    h.skills.leadership = 5;
    for (const stat of Object.keys(h.stats) as (keyof Hero['stats'])[]) h.stats[stat] = 5;
  }
}

describe('land-use math', () => {
  it('splits chains by allocation and derives worker capacities', () => {
    const s = testState(); // size 10, cropland 50 / pasture 30 / wildland 20
    expect(claimCapacity(s)).toBe(10 * TUNING.claim.residentsPerChain);
    expect(landChains(s, 'cropland')).toBe(5);
    expect(landChains(s, 'pasture')).toBe(3);
    expect(landChains(s, 'wildland')).toBe(2);
    expect(croplandCapacity(s)).toBe(Math.floor(5 / TUNING.claim.chainsPerFarmer));
    expect(pastureCapacity(s)).toBe(Math.floor(3 / TUNING.claim.chainsPerHerder));
    expect(herdCarryingCapacity(s)).toBe(3 * TUNING.claim.herdPerPastureChain);
  });

  it('validates and applies a re-allocation summing to 100', () => {
    const s = testState();
    expect(setLandAllocation(s, { cropland: 60, pasture: 20, wildland: 10 })).toBe(false); // sums 90
    expect(setLandAllocation(s, { cropland: 60, pasture: 20, wildland: 20 })).toBe(true);
    expect(s.claim.allocation).toEqual({ cropland: 60, pasture: 20, wildland: 20 });
  });

  it('grows the Concession only forward', () => {
    const s = testState();
    addClaim(s, 5);
    expect(s.claim.size).toBe(15);
    addClaim(s, -100);
    expect(s.claim.size).toBe(0);
  });
});

describe('cropland harvest', () => {
  it('farmers accrue effort, bounded by cropland capacity', () => {
    const s = testState();
    s.residents.roles.farmers = 3; // cropland cap 5 → all 3 count
    accrueCropProgress(s);
    expect(s.claim.cropProgress).toBe(3 * TUNING.claim.yieldPerFarmerPerTurn);

    const s2 = testState();
    s2.residents.roles.farmers = 20; // only croplandCapacity(=5) usefully work
    accrueCropProgress(s2);
    expect(s2.claim.cropProgress).toBe(croplandCapacity(s2) * TUNING.claim.yieldPerFarmerPerTurn);
  });

  it('turns cropProgress into a lump harvest, clamped, and resets it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = testState();
      s.claim.cropProgress = 100;
      const grainBefore = s.goods.grain;
      const result = resolveHarvest(s, new Rng(seed));
      expect(s.claim.cropProgress).toBe(0);
      if (result.cropFailed) {
        expect(result.cropFood).toBeLessThanOrEqual(Math.round(100 * TUNING.claim.cropFailureMult));
      } else {
        expect(result.cropFood).toBeGreaterThanOrEqual(Math.round(100 * TUNING.claim.harvestMultMin));
        expect(result.cropFood).toBeLessThanOrEqual(
          Math.round(100 * TUNING.claim.harvestMultMax) + 100, // + storage headroom
        );
      }
      expect(s.goods.grain).toBe(grainBefore + result.cropFood + result.herdFood);
    }
  });

  it('rolls a true crop failure on at least some seasons', () => {
    let failures = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = testState();
      s.claim.cropProgress = 50;
      if (resolveHarvest(s, new Rng(seed)).cropFailed) failures += 1;
    }
    expect(failures).toBeGreaterThan(0);
  });

  it('a storehouse adds food-storage relief to a successful harvest', () => {
    // Find a non-failing seed, then compare with/without the storehouse.
    let seed = 1;
    for (; seed <= 200; seed++) {
      const probe = testState();
      probe.claim.cropProgress = 50;
      if (!resolveHarvest(probe, new Rng(seed)).cropFailed) break;
    }
    const bare = testState();
    bare.claim.cropProgress = 50;
    const withStore = testState();
    withStore.claim.cropProgress = 50;
    withStore.buildings.push('storehouse');
    const a = resolveHarvest(bare, new Rng(seed));
    const b = resolveHarvest(withStore, new Rng(seed));
    expect(b.cropFood - a.cropFood).toBe(TUNING.building.defs.storehouse.effects.foodStorageBonus);
  });
});

describe('pasture & the herd', () => {
  it('herders grow the herd toward carrying capacity, never past it', () => {
    const s = testState();
    setLandAllocation(s, { cropland: 0, pasture: 100, wildland: 0 });
    s.residents.roles.herders = 3;
    const added = growHerd(s);
    expect(added).toBeGreaterThan(0);
    expect(s.herd.count).toBe(added);

    s.herd.count = herdCarryingCapacity(s);
    expect(growHerd(s)).toBe(0); // full pasture — no more growth
  });

  it('season yield does not eat the herd down', () => {
    const s = testState();
    s.herd.count = 20;
    const result = resolveHarvest(s, new Rng(5));
    expect(result.herdFood).toBe(Math.round(20 * TUNING.claim.herdYieldFraction));
    expect(s.herd.count).toBe(20); // durable wealth, not consumed
  });

  it('addHerd clamps at zero', () => {
    const s = testState();
    addHerd(s, 4);
    addHerd(s, -10);
    expect(s.herd.count).toBe(0);
  });
});

describe('wildland trickle', () => {
  it('hunters add a continuous Food trickle, bounded by wildland capacity', () => {
    const s = testState();
    setLandAllocation(s, { cropland: 0, pasture: 0, wildland: 100 });
    s.residents.roles.hunters = 20;
    const before = s.goods.grain;
    const added = wildlandTrickle(s);
    expect(added).toBe(wildlandCapacity(s) * TUNING.claim.yieldPerHunterPerTurn);
    expect(s.goods.grain).toBe(before + added);
  });
});

describe('over-Concession pressure', () => {
  it('the pool may exceed capacity, and updateContentment penalises it', () => {
    const s = testState();
    addResidents(s, 'farmers', claimCapacity(s) + 5); // 5 over
    expect(isOverClaim(s)).toBe(true);
    s.residents.contentment = 8;
    updateContentment(s, { missedFood: false, missedWages: false });
    expect(s.residents.contentment).toBeLessThan(8);
  });

  it('targets the negotiated landholder, else the nearest discovered native', () => {
    const s = testState(); // river_meet (RIVER_CLANS) starts visited
    expect(nearestDiscoveredNativeFaction(s, TEST_CONTENT.locationDefs)).toBe('RIVER_CLANS');
    expect(overClaimStandingTarget(s, TEST_CONTENT.locationDefs)).toBe('RIVER_CLANS');
    s.claim.landholder = 'HILL_TRIBES';
    expect(overClaimStandingTarget(s, TEST_CONTENT.locationDefs)).toBe('HILL_TRIBES');
  });
});

describe('the Company muster draws all rural hands', () => {
  it('counts farmers, herders, hunters, and idle', () => {
    const s = testState();
    s.residents.roles.herders = 5;
    const herdersOnly = companyMuster(s);
    expect(herdersOnly).toBeGreaterThan(0);
    s.residents.roles.hunters = 5;
    expect(companyMuster(s)).toBeGreaterThanOrEqual(herdersOnly);
  });
});

describe('Invite Settlers', () => {
  it('pays up front and settles arrivals on homecoming', () => {
    const s = testState();
    s.residents = freshResidents();
    s.locations.charter_landing.discovery = 'visited';
    s.silver = 1000;
    makeSkilled(s.heroes.find((h) => h.id === 'p1')!);
    const cost = TUNING.claim.invite.baseCostPerHead * 4; // generous mult 1.0
    const silverBefore = s.silver;

    expect(
      dispatchExpedition(
        s,
        {
          kind: 'invite',
          destination: 'charter_landing',
          heroIds: ['p1'],
          inviteSource: 'homeland',
          inviteOffer: 'generous',
          inviteCount: 4,
        },
        TEST_CONTENT.locationDefs,
        TEST_CONTENT.mapRegionDefs,
      ),
    ).toBe(true);
    expect(s.silver).toBe(silverBefore - cost);
    expect(residentTotal(s)).toBe(0); // not home yet

    runToHomecoming(s);
    expect(residentTotal(s)).toBeGreaterThan(0);
    expect(s.residents.idle).toBeGreaterThan(0);
    expect(s.residents.heritage.homeland).toBe(residentTotal(s));
  });

  it('refuses a hostile people, and needs a source', () => {
    const s = testState();
    s.locations.charter_landing.discovery = 'visited';
    s.factions.CHARTER_COMPANY.standing = -60;
    const reason = dispatchExpedition(
      s,
      {
        kind: 'invite',
        destination: 'charter_landing',
        heroIds: ['p1'],
        inviteSource: 'homeland',
        inviteOffer: 'generous',
        inviteCount: 2,
      },
      TEST_CONTENT.locationDefs,
      TEST_CONTENT.mapRegionDefs,
    );
    expect(reason).toBe(false); // hostile refuses
  });
});

describe('Negotiate Land', () => {
  it('scales cost with the ask and grows the Concession on success', () => {
    const s = testState(); // river_meet visited, RIVER_CLANS friendly
    s.silver = 1000;
    s.goods.timber = 100;
    makeSkilled(s.heroes.find((h) => h.id === 'p1')!, s.heroes.find((h) => h.id === 'p2')!);
    const sizeBefore = s.claim.size;
    const silverBefore = s.silver;

    expect(
      dispatchExpedition(
        s,
        { kind: 'concession', destination: 'river_meet', heroIds: ['p1', 'p2'], concessionAsk: 3 },
        TEST_CONTENT.locationDefs,
        TEST_CONTENT.mapRegionDefs,
      ),
    ).toBe(true);
    expect(s.silver).toBe(silverBefore - 3 * TUNING.claim.negotiateLand.silverCostPerLandUnit);

    runToHomecoming(s);
    expect(s.claim.size).toBe(sizeBefore + 3);
    expect(s.claim.landholder).toBe('RIVER_CLANS');
  });
});
