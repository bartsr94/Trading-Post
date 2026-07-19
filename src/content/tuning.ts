// All initial tuning values in one place (spec §14). Balancing happens here,
// never in engine code. Pure data — no logic.

import type { BuildingDefData, TierRequirement } from '../engine/types';

export const TUNING = {
  save: {
    version: 6,
    autosaveKey: 'trading-post-save',
  },

  start: {
    silver: 200,
    goods: { grain: 30, timber: 10, tools: 4, salt: 4 } as Partial<Record<string, number>>,
    partySize: 6,
  },

  // The active party ↔ reserve roster (CHARACTERS_SPEC.md).
  roster: {
    activeCap: 6, // in-game party ceiling; a building raises this later (Phase C).
    retainerWagePerReserve: 8, // a reserve named character's seasonal retainer.
  },

  // Named, non-working family (CHARACTERS_SPEC.md §7). Food only, no wages.
  dependants: {
    grainPerDependantPerTurn: 1, // families eat; tune against grainPerHeroPerTurn.
    maxPerCharacter: 4, // soft cap on one family; the post-wide count stays uncapped.
  },

  time: {
    turnsPerSeason: 6,
    turnsPerYear: 24,
  },

  checks: {
    critSuccessMargin: 5, // margin ≥ +5
    critFailureMargin: -5, // margin ≤ −5
  },

  skillGrowth: {
    // End of season: each marked skill rolls 2d6 vs (base + current skill).
    baseDifficulty: 7,
    maxSkill: 5,
  },

  condition: {
    maxHealth: 10,
    maxStress: 10,
    restHealthRecovery: 2,
    restStressRecovery: 3,
    /** Chance a Rest turn sheds a negative recoverable trait. */
    restTraitRecoveryChance: 0.15,
  },

  economy: {
    /** Grain eaten per hero per turn. */
    grainPerHeroPerTurn: 1,
    /** Silver upkeep per turn for the post itself (tier 1). */
    postUpkeepSilver: 4,
    /** Turns of unpaid upkeep before the post goes under. */
    bankruptcyTurns: 3,
    /** Stress added to every hero on a missed-upkeep turn. */
    missedUpkeepStress: 2,
    /** Supply/demand random-walk band and step. */
    supplyDemandMin: 0.6,
    supplyDemandMax: 1.6,
    supplyDemandStep: 0.1,
    /** Event price modifiers decay toward 1 by this factor each turn. */
    eventModDecay: 0.5,
    /** Trade assignment: base silver income before prosperity and margin. */
    tradeBaseIncome: 12,
    tradeCheckDifficulty: 10,
    /** Silver per point of check margin on a trade turn. */
    tradeMarginSilver: 2,
    /** Prosperity = silver/prosperitySilverDiv + stockValue/prosperityStockDiv. */
    prosperitySilverDiv: 50,
    prosperityStockDiv: 40,
    /** Trade income multiplier per prosperity point (1 + prosperity * this). */
    prosperityTradeBonus: 0.05,
  },

  provision: {
    checkDifficulty: 9,
    /** Grain-equivalent gained on success / crit success. */
    successYield: 4,
    critYield: 8,
    failureYield: 1,
  },

  events: {
    /** Events fired per turn: always at least min, at most max (travel events are extra). */
    minPerTurn: 1,
    maxPerTurn: 2,
    defaultCooldown: 6,
    /** Chance per expedition per en-route turn that a travel event fires. */
    travelEventChance: 0.5,
  },

  map: {
    /** Location id of the post itself (its market is `GameState.market`). */
    homeLocationId: 'post',
    /** Heroes per expedition: at least 1, at most this. */
    maxExpeditionHeroes: 2,
    /** Cargo units an expedition can carry per hero. */
    cargoCapacityPerHero: 20,
    /** Arrival Bargain check at a destination market. */
    caravanCheckDifficulty: 10,
    /** Sale/purchase price swing per point of check margin (1 ± margin × this). */
    caravanMarginRate: 0.02,
    /** Best/worst price multiplier from the arrival check. */
    caravanPriceMultMax: 1.3,
    caravanPriceMultMin: 0.75,
    /** Standing gained with a faction whose seat hosts a successful trade. */
    caravanStandingGain: 1,
    /** Explore progress check at the destination. */
    exploreCheckDifficulty: 9,
  },

  stress: {
    /** Stress at which a breakdown event is queued. */
    breakdownThreshold: 10,
    /** Content event fired when a hero breaks down. */
    breakdownEventId: 'hero_breakdown',
  },

  diplomacy: {
    /** At-post: hosting the Company's factor (Assignment Board activity). */
    atPostCheckDifficulty: 9,
    atPostStandingGainSuccess: 2,
    atPostStandingGainCrit: 4,
    atPostStandingLossFailure: 0,
    atPostStandingLossCritFailure: 2,
    /** Expedition: visiting a faction seat in person (spec §8). */
    expeditionCheckDifficulty: 10,
    expeditionStandingGainSuccess: 4,
    expeditionStandingGainCrit: 8,
    expeditionStandingLossFailure: 1,
    expeditionStandingLossCritFailure: 4,
    expeditionFailureStress: 1,
    expeditionCritFailureStress: 2,
  },

  residents: {
    /** Provisional cap by post tier; buildings add to this later (Phase C). */
    capByTier: { 1: 4, 2: 10, 3: 20, 4: 40 } as Record<number, number>,
    /** Grain eaten per resident per turn (heroes eat separately). */
    grainPerResidentPerTurn: 1,
    /** Silver wage per resident, paid at each season end (Charter cadence). */
    seasonWagePerResident: 6,
    contentment: {
      start: 7,
      min: 0,
      max: 10,
      /** ≥ this = content (full output, may grow). */
      contentThreshold: 7,
      /** ≤ this = unrest (output penalty, desertion, unrest events). */
      unrestThreshold: 3,
      /** Upward drift when fed, paid, roomy, and not idle-heavy. */
      fedPaidDrift: 1,
      missedFoodPenalty: 2,
      missedWagePenalty: 2,
      /** Per resident over cap, per turn. */
      overCapPenalty: 1,
      /** Idle residents beyond this many start dragging contentment. */
      idleTolerance: 2,
      idlePenalty: 1,
      /** Role output multipliers by band. */
      grumblingOutputMult: 0.75,
      unrestOutputMult: 0.4,
    },
    desertion: {
      /** Fraction of the pool that deserts each unrest turn. */
      unrestDesertRate: 0.2,
      /** Desertion rate reduced per point of post defense (guards). */
      guardSuppressionPerPoint: 0.02,
    },
    growth: {
      /** Per-turn chance of +1 idle resident when content and under cap. */
      baseGrowthChance: 0.15,
      /** Added to the chance per point of prosperity. */
      prosperityBonus: 0.01,
    },
    effects: {
      grainPerFarmerPerTurn: 2,
      cargoPerPorter: 15,
      /** Escort bonus to a caravan/explore/envoy arrival check when guards ride along. */
      guardEscortBonus: 2,
      postDefensePerGuard: 1,
      /** Silver upkeep relief per craftsperson (repairs). */
      upkeepReliefPerCraftsperson: 1,
      /** Build progress a craftsperson adds to the active project per turn (Phase C). */
      crewYieldPerCraftsperson: 1,
    },
    hire: {
      costPerHead: { farmers: 20, porters: 15, guards: 30, craftsfolk: 40 } as Record<
        string,
        number
      >,
    },
    axisGrowth: {
      integrationThreshold: 4,
      communalThreshold: 4,
      /** Residents added per qualifying axis at each season end. */
      arrivalsPerSeason: 1,
    },
    /** Transient outsiders (Phase B): live effects + engine-spawn parameters. */
    transients: {
      /** Per-head effect each transient kind lends while present (summed by transientEffect). */
      effects: {
        visitorGuards: { defenseBonus: 1, contentmentPressure: 0, cargoBonus: 0 },
        companyAgents: { defenseBonus: 0, contentmentPressure: 1, cargoBonus: 0 },
        supplierCrew: { defenseBonus: 0, contentmentPressure: 0, cargoBonus: 20 },
      } as Record<
        string,
        { defenseBonus: number; contentmentPressure: number; cargoBonus: number }
      >,
      /** A faction honour-guard that rides back with a successful envoy. */
      visitorGuardCount: 3,
      visitorGuardTurns: 3,
      /** Inspectors posted (indefinitely) while the Charter quota goes unmet. */
      companyAgentCount: 1,
    },
  },

  // Buildings & construction (BUILDINGS_SPEC.md). Prose (names/blurbs) lives in
  // content/buildings.ts; every balance number lives here, keyed by building id.
  building: {
    /** Craft check each Build turn; progress added by result tier. */
    buildCheckDifficulty: 9,
    buildProgressYield: { critSuccess: 3, success: 2, failure: 1, critFailure: 0 } as Record<
      string,
      number
    >,
    /** Per-building cost, effort, prerequisites, and effects (ids ↔ content/buildings.ts). */
    defs: {
      storehouse: {
        cost: { silver: 40, goods: { timber: 10 } },
        buildProgress: 4,
        prerequisites: [],
        effects: { residentCapBonus: 2, prosperityBonus: 1, upkeepSilver: 1 },
      },
      palisade: {
        cost: { silver: 60, goods: { timber: 20 } },
        buildProgress: 6,
        prerequisites: [],
        effects: { defenseBonus: 3, prosperityBonus: 1, upkeepSilver: 1 },
      },
      trade_hall: {
        cost: { silver: 80, goods: { timber: 10, tools: 4 } },
        buildProgress: 6,
        prerequisites: ['storehouse'],
        effects: { tradeIncomeBonus: 0.15, prosperityBonus: 2, upkeepSilver: 2 },
      },
      common_house: {
        cost: { silver: 70, goods: { timber: 15 } },
        buildProgress: 5,
        prerequisites: [],
        effects: { residentCapBonus: 4, stressReliefBonus: 1, upkeepSilver: 1 },
      },
      workshop: {
        cost: { silver: 90, goods: { timber: 10, tools: 6 } },
        buildProgress: 7,
        prerequisites: ['storehouse'],
        effects: { craftReliefBonus: 1, prosperityBonus: 2, upkeepSilver: 2 },
      },
    } as Record<string, BuildingDefData>,
    /** Tier-advancement recipes; canAdvanceTier reads the entry for postTier+1. */
    tierLadder: [
      {
        tier: 2,
        requiredBuildings: ['palisade', 'storehouse'],
        silverCost: 100,
        advanceEventId: 'post_raise_palisade',
      },
    ] as TierRequirement[],
  },

  charter: {
    /** Silver shipment the Company expects every season end (spec §8). */
    quotaSilver: 120,
    /** Standing lost on a missed quota, before streak escalation. */
    standingLossPerMiss: 8,
    /** Multiplies the standing loss for each additional consecutive miss. */
    streakEscalation: 1.5,
    /** Stress added to every hero when the quota is missed. */
    missedQuotaStress: 1,
    /** Consecutive misses before inspectors start seizing silver outright. */
    seizureStreakThreshold: 2,
    /** Fraction of remaining silver seized once past the threshold. */
    seizureFraction: 0.25,
    /** Standing gained with the Company for meeting the quota. */
    metStandingGain: 1,
  },
} as const;
