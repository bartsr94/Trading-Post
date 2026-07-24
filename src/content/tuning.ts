// All initial tuning values in one place (spec §14). Balancing happens here,
// never in engine code. Pure data — no logic.

import type { BuildingDefData, FactionId, Heritage, TierRequirement } from '../engine/types';

export const TUNING = {
  save: {
    version: 21,
    autosaveKey: 'trading-post-save',
    /** Manual import guard; current saves are far smaller than five MiB. */
    maxImportBytes: 5 * 1024 * 1024,
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
    /** Snap a nearly-decayed event modifier back to exactly 1 inside this distance. */
    eventModSnapThreshold: 0.05,
    /** Trade assignment: base silver income before prosperity and margin. */
    tradeBaseIncome: 12,
    tradeCheckDifficulty: 10,
    /** Silver per point of check margin on a trade turn. */
    tradeMarginSilver: 2,
    /** Failed trade turns still earn this fraction of ordinary base income. */
    tradeFailureIncomeMultiplier: 0.5,
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
    exploreFailureStress: 1,
    exploreCritFailureStress: 2,
    exploreCritFailureHealthLoss: 1,
    /** 4:3 fog grid matching the illustrated Ashmark map. */
    fogGrid: { width: 64, height: 48 },
    /** Scaled normalized map distance covered per one-way turn at normal pace. */
    distancePerTurn: 0.11,
    pace: {
      fast: { turnMultiplier: 0.75, checkModifier: -1, eventChanceMultiplier: 1.3 },
      normal: { turnMultiplier: 1, checkModifier: 0, eventChanceMultiplier: 1 },
      slow: { turnMultiplier: 1.5, checkModifier: 1, eventChanceMultiplier: 0.35 },
    },
    exploration: {
      /** New games reveal the already-travelled routes to initially visited places. */
      initialRadius: 0.045,
      initialRouteWidth: 0.012,
      routeWidth: { fast: 0.01, normal: 0.016, slow: 0.023 },
      targetRadius: { fast: 0.05, normal: 0.075, slow: 0.105 },
      tierRadiusMultiplier: {
        critSuccess: 1.35,
        success: 1,
        failure: 0.42,
        critFailure: 0.22,
      },
      detectionBonus: { critSuccess: 0.04, success: 0.02, failure: 0, critFailure: 0 },
      rumorRadiusX: 0.055,
      rumorRadiusY: 0.04,
      /** Failed surveys narrow the target radius but retain this much route width. */
      minRouteTierMultiplier: 0.45,
      /** Deterministic rumor-center displacement within the displayed ellipse. */
      rumorOffsetMin: 0.25,
      rumorOffsetRange: 0.3,
    },
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
    /** Share of a seat-level diplomatic shift that becomes wider faction sentiment. */
    factionSentimentShare: 0.5,
    /** Share of a seat-level diplomatic shift that spills into sibling communities. */
    siblingSpilloverShare: 0.25,
    /** How much gift value roughly maps to one standing step. */
    giftValuePerStep: 30,
    /** Standing normally needed before an alliance proposal is realistic. */
    allianceStandingThreshold: 35,
    /** Peace talks trim accumulated grievances by this much on success / crit. */
    peaceGrievanceReliefSuccess: 2,
    peaceGrievanceReliefCrit: 4,
    /** Failed peace / alliance missions may add grievance. */
    grievanceOnFailure: 1,
    grievanceOnCritFailure: 2,
    /** When grievances reach this, UI begins warning that slights are remembered. */
    grievanceWarningThreshold: 3,
    /** Each remembered slight adds weight to that community's raid appetite. */
    raidThreatPerGrievance: 4,
    /** Truces and alliances sharply suppress a community's local raid threat. */
    truceRaidThreatReduction: 25,
    allianceRaidThreatReduction: 45,
    /** Content event id fired when a seat is discovered for the first time
     *  (DIPLOMACY_DISCOVERY_SPEC.md §3). */
    firstContactEventId: 'post_first_contact',
    firstContact: {
      /** Unplanned encounter — a little easier than a resourced envoy mission. */
      checkDifficulty: 8,
      /** "Approach in peace" (diplomacy check). */
      peaceStandingGainSuccess: 3,
      peaceStandingGainCrit: 6,
      peaceFailureStress: 1,
      peaceCritFailureStandingLoss: 2,
      peaceCritFailureGrievance: 1,
      /** "Show strength" (combat check) — always costs standing/grievance;
       *  failure adds injury on top (RAIDING_SPEC.md grievance feeds threat). */
      hostileStandingLossSuccess: 3,
      hostileGrievanceSuccess: 1,
      hostileStandingLossFailure: 6,
      hostileGrievanceFailure: 2,
      hostileFailureHealth: 5,
      hostileFailureStress: 2,
      hostileStandingLossCritFailure: 10,
      hostileGrievanceCritFailure: 3,
      hostileCritFailureHealth: 10,
      hostileCritFailureStress: 3,
    },
  },

  residents: {
    /** A new post doesn't start from bare tents — a handful of hands came with
     *  the founding party. New-game only (createInitialState); old-save
     *  migrations never backfill this. */
    startingRoles: { farmers: 2, guards: 2 } as Partial<Record<string, number>>,
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
      cargoPerPorter: 15,
      /** Escort bonus to a caravan/explore/envoy arrival check when guards ride along. */
      guardEscortBonus: 2,
      postDefensePerGuard: 1,
      /** Silver upkeep relief per craftsperson (repairs). */
      upkeepReliefPerCraftsperson: 1,
      /** Build progress a craftsperson adds to the active project per turn (Phase C). */
      crewYieldPerCraftsperson: 1,
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

  // The Concession, settlement & farming (TULA_SETTLEMENT_SPEC.md). Land is
  // measured in chains; population is uncapped, the Concession a soft threshold.
  claim: {
    /** Starting Concession for a new game — the ground the post already sits on. */
    startingSize: 10,
    startingAllocation: { cropland: 50, pasture: 30, wildland: 20 } as Record<string, number>,

    residentsPerChain: 6, // 1 chain "supports" 6 residents without resistance
    chainsPerFarmer: 1, // cropland chains one farmer usefully works
    chainsPerHerder: 2, // pasture chains one herder usefully tends
    chainsPerHunter: 3, // wildland chains one hunter usefully covers
    herdPerPastureChain: 5, // herd carrying capacity per pasture chain
    herdGrowthPerHerder: 2, // herd count growth per herder per turn (capped)
    herdYieldFraction: 0.3, // fraction of herd count converted to Food at season end
    yieldPerFarmerPerTurn: 2, // feeds cropProgress each turn (mood-scaled)
    yieldPerHunterPerTurn: 1, // continuous wildland Food trickle, smaller than farming
    harvestVariance: 0.35, // ± swing on an ordinary season-end harvest roll
    harvestMultMin: 0.4, // ordinary bad luck still guarantees some crop
    harvestMultMax: 1.5,
    cropFailureChance: 0.08, // ~1 season in 12 rolls a true failure instead
    cropFailureMult: 0.1, // near-total loss on a true failure
    overClaimPenalty: 2, // contentment penalty per head over claimCapacity, per turn
    overClaimStandingLossPerTurn: 1, // standing lost/turn over-Concession, vs the landholder

    invite: {
      baseCostPerHead: 18,
      offerTierMultiplier: { modest: 0.7, generous: 1.0, lavish: 1.4 } as Record<string, number>,
      offerTierRollBonus: { modest: -1, generous: 0, lavish: 2 } as Record<string, number>,
      baseFractionByCheckTier: {
        critSuccess: 1.1,
        success: 0.8,
        failure: 0.4,
        critFailure: 0.1,
      } as Record<string, number>,
      contentmentMult: { content: 1.1, grumbling: 1.0, unrest: 0.7 } as Record<string, number>,
      overflowBonus: 2, // extra arrivals possible on a crit success
      arrivalStandingGain: 1,
      checkDifficulty: 10,
    },

    negotiateLand: {
      silverCostPerLandUnit: 15,
      goodsCostPerLandUnit: { timber: 1 } as Partial<Record<string, number>>,
      checkDifficulty: 11,
      successStandingGain: 1,
      failureGrievance: 1,
      /** Chains a single Negotiate Land run may ask for at most. */
      maxAsk: 10,
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
        effects: { foodStorageBonus: 2, prosperityBonus: 1, upkeepSilver: 1 },
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
        effects: { contentmentBonus: 1, stressReliefBonus: 1, upkeepSilver: 1 },
      },
      workshop: {
        cost: { silver: 90, goods: { timber: 10, tools: 6 } },
        buildProgress: 7,
        prerequisites: ['storehouse'],
        effects: { craftReliefBonus: 1, prosperityBonus: 2, upkeepSilver: 2 },
      },
      // -------------------------------------------------- Phase B (tier-2 upgrades)
      storehouse_ii: {
        cost: { silver: 90, goods: { timber: 20 } },
        buildProgress: 6,
        prerequisites: ['storehouse'],
        minTier: 2,
        effects: { foodStorageBonus: 3, prosperityBonus: 1, upkeepSilver: 1 },
      },
      palisade_ii: {
        cost: { silver: 130, goods: { timber: 15, tools: 10 } },
        buildProgress: 8,
        prerequisites: ['palisade'],
        minTier: 2,
        requiresResidents: { role: 'guards', value: 3 },
        effects: { defenseBonus: 4, upkeepSilver: 2 },
      },
      workshop_ii: {
        cost: { silver: 140, goods: { timber: 15, tools: 12 } },
        buildProgress: 8,
        prerequisites: ['workshop'],
        minTier: 2,
        requiresResidents: { role: 'craftsfolk', value: 3 },
        effects: { craftReliefBonus: 2, prosperityBonus: 2, upkeepSilver: 2 },
      },
      // -------------------------------------------------- Phase B (rest of the base set)
      infirmary: {
        cost: { silver: 100, goods: { timber: 10, tools: 6 } },
        buildProgress: 6,
        prerequisites: ['common_house'],
        minTier: 2,
        effects: { healingBonus: 2, upkeepSilver: 1 },
      },
      watchtower: {
        cost: { silver: 70, goods: { timber: 15 } },
        buildProgress: 5,
        prerequisites: ['palisade'],
        minTier: 2,
        requiresResidents: { role: 'guards', value: 2 },
        effects: { defenseBonus: 2, upkeepSilver: 1 },
      },
      // -------------------------------------------------- Phase B (culture-tied)
      river_shrine: {
        cost: { silver: 60, goods: { timber: 10 } },
        buildProgress: 5,
        prerequisites: ['common_house'],
        minTier: 2,
        requiresHeritageGroup: { group: 'native', value: 6 },
        effects: { contentmentBonus: 1, prosperityBonus: 1 },
      },
      goblin_warren: {
        cost: { silver: 50, goods: { timber: 10 } },
        buildProgress: 5,
        prerequisites: [],
        minTier: 2,
        requiresTag: { tag: 'goblin', value: 4 },
        requiresStanding: { faction: 'BEASTFOLK', value: -20 },
        effects: { defenseBonus: 2, contentmentBonus: 1 },
      },
      orc_longhouse: {
        cost: { silver: 60, goods: { timber: 15 } },
        buildProgress: 6,
        prerequisites: [],
        minTier: 2,
        requiresTag: { tag: 'orc', value: 4 },
        requiresStanding: { faction: 'BEASTFOLK', value: -20 },
        effects: { defenseBonus: 3, prosperityBonus: 1 },
      },
      // -------------------------------------------------- Phase B (wealth-gated)
      counting_house: {
        cost: { silver: 150, goods: { tools: 5 } },
        buildProgress: 6,
        prerequisites: ['trade_hall'],
        minTier: 2,
        minSilverHeld: 400,
        effects: { tradeIncomeBonus: 0.1, prosperityBonus: 2, upkeepSilver: 2 },
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
      {
        tier: 3,
        requiredBuildings: ['trade_hall', 'workshop', 'common_house'],
        silverCost: 250,
        advanceEventId: 'post_found_settlement',
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

  // Heritage & the cultural character of the post (HERITAGE_SPEC.md). The
  // `culture` axis is Homeland(−, Imanian) ↔ Frontier(+, Sauromatian).
  heritage: {
    /** Native hire sources, keyed by tribe/region (PEOPLES_SPEC.md §7.1): which
     *  people they are, which faction gates them, and where they live. One people
     *  can have several seats (Kiswani at the Tributary Towns AND the Bejasi Hills;
     *  Hanjoda across the three nomad seats). Weri are heroes-only — not hireable. */
    hireSources: {
      tributary: { people: 'kiswani', faction: 'RIVER_CLANS', seat: 'river_meet' },
      // Kalasha-Tora is a second RIVER_CLANS seat (pilots/boatwrights, not
      // fisherfolk) — same people, same faction, its own settler pool.
      kalasha_tora: { people: 'kiswani', faction: 'RIVER_CLANS', seat: 'kalasha_tora' },
      bejasi_hills: { people: 'kiswani', faction: 'OLD_PEOPLE', seat: 'elder_grove' },
      dustwalker: { people: 'hanjoda', faction: 'HILL_TRIBES', seat: 'hill_fort' },
      sunspear: { people: 'hanjoda', faction: 'HILL_TRIBES', seat: 'blackstone_plateau' },
      redsand: { people: 'hanjoda', faction: 'HILL_TRIBES', seat: 'redsand_range' },
      // Homeland folds into the same table (TULA_SETTLEMENT_SPEC.md §5.1) so
      // Invite Settlers has one generic target list, not an "if homeland" branch.
      homeland: { people: 'imanian', faction: 'CHARTER_COMPANY', seat: 'charter_landing' },
      // Shackle Station is a second CHARTER_COMPANY seat, Ansberite/Sauromatian
      // creole rather than fresh-off-the-barge Imanian — still homeland stock.
      shackle_station: { people: 'imanian', faction: 'CHARTER_COMPANY', seat: 'shackle_station' },
    } as Record<string, { people: Heritage; faction: FactionId; seat: string }>,

    /** Culture nudge per settler who arrives (Frontier for native, Homeland for imanian). */
    hireAxisNudge: 0.4,

    // Axis drift (season end)
    /** Max culture step toward the tally-implied target each season. */
    axisDriftPerSeason: 1,
    /** Minimum absolute culture drift worth calling out in the turn report. */
    axisDriftReportThreshold: 0.5,
    /** culture ≥ this → native settlers drift in via applyAxisArrivals. */
    frontierThreshold: 4,
    /** culture ≤ this → homeland families settle via applyAxisArrivals. */
    homelandThreshold: -4,

    // Company judgment (used in Phase B)
    /** culture ≥ this reads as "compromised". */
    compromiseThreshold: 5,
    /** culture ≤ this reads as "loyal". */
    loyalThreshold: -5,
    /** Standing lost per point past compromiseThreshold, per season. */
    compromiseStandingLoss: 1.5,
    /** Standing gained per season while loyal. */
    loyalStandingGain: 2,
    /** Compromised-AND-hostile seasons before the charter is revoked. */
    revokeStreak: 3,

    // Active-party composition (HERITAGE_SPEC.md §6, Q7)
    /** Homeland share of the active party that reassures the Company. */
    partyLoyalShare: 0.6,
    /** CHARTER_COMPANY gain + compromise-loss dampener from a loyal party. */
    partyReassureStanding: 2,
    /** Standing a mixed party earns with each non-hostile native faction. */
    nativeRelationsGainPerSeason: 1,
  },

  // Marriage, partners, children & the family line (FAMILY_SPEC.md §13). All
  // tunable; the `culture` axis moves are signed toward the Homeland(−)/Frontier(+)
  // poles. Child gender/heritage arithmetic and Company weighting live here too.
  family: {
    // Gender / bloodline (child arithmetic used in Phase B)
    pureFemaleChance: 0.5, // pure-union child gender (1:1 lore baseline)
    mixedFemaleChance: 0.7, // mixed-union daughter skew (2:1–3:1 lore)

    // Acquisition
    /** Certified Imanian spouse via a Thornwatch courtship run (dear). */
    homelandBridePrice: 120,
    /** CHARTER_COMPANY bump when a courtship reaches Thornwatch. */
    homelandMatchStanding: 2,
    /** Hearth-companion informal union (cheap; event-driven). */
    informalUnionCost: 20,
    /** Multiple partners allowed (compound/polygyny lore); a building raises this later. */
    maxSpousesPerHero: 3,
    /** Culture axis move per union, signed toward the pole. */
    unionCultureNudge: { homeland: -2, alliance: 2, informal: 1 } as Record<string, number>,

    // Children & the line (Phase B)
    /** Turns from bornTurn to coming of age (2 years at 24 turns/yr). */
    comeOfAgeTurns: 48,
    /** Soft cap on one union's children; the post-wide count stays uncapped. */
    maxChildrenPerUnion: 4,
    /** Odds a coming-of-age child is offered as a named recruit rather than grown kin. */
    comeOfAgeRecruitChance: 0.1,
    /** Season retainer for a grown-kin dependant (lighter than a reserve hero's). */
    grownKinRetainer: 4,

    // Company judgment (folded INTO Heritage Phase B, not a parallel clock)
    company: {
      purePartyReassure: 1, // extra reassurance per wed 'pure' active hero
      mixedCompromiseAdd: 1, // extra compromise per wed 'mixed' active hero
      informalCompromiseMult: 1.5, // informal households weigh heavier than alliances
      multiSpouseCompromiseMult: 1.25, // a multi-spouse mixed household heavier still
    },
  },

  // Raiding, both directions (RAIDING_SPEC.md). Phase A wires the incoming side;
  // outgoing (the `raid` ExpeditionKind) reuses the same resolver in Phase B.
  raid: {
    // --- The notoriety arc: when raids become possible (RAIDING_SPEC.md §6) ---
    /** No incoming raid may trigger before this turn — the post is too new to
     *  be a known target (24 turns/yr, so ~1.5 years of grace). */
    graceTurns: 36,
    /** Minimum turns between incoming raids, so they stay a periodic threat. */
    minTurnsBetweenRaids: 8,
    /** A faction at/below this standing is an eligible aggressor. */
    hostileStandingThreshold: -30,
    /** Beastfolk are always an eligible aggressor once grace elapses (no seat). */
    beastfolkAlwaysEligible: true,

    // Per-turn raid-chance formula: base + prosperity + hostility − deterrence.
    raidChance: {
      base: 0.02,
      /** Added per point of prosperity — a fat post is a tempting target. */
      perProsperity: 0.004,
      /** Added per point of the angriest eligible faction's hostility (−standing). */
      perHostility: 0.002,
      /** Subtracted per point of postDefense — a strong wall deters. */
      perDefense: 0.01,
      /** Hard ceiling so a raid is never a certainty in a single turn. */
      max: 0.35,
    },

    // --- Force tallies (RAIDING_SPEC.md §3.1) ---
    /** Each at-post hero's combat skill contributes this much to defender force. */
    heroCombatWeight: 1,
    /** Each farmer/idle head grabs a spear and adds this to the Company muster. */
    musterValuePerHead: 0.34,
    /** Cap on the Company muster so a huge farmhand pool can't trivialise defence. */
    musterMax: 6,
    /** Each guard seconded onto an outgoing raid adds this much force. */
    guardEscortForce: 1,

    // Attacker war-band strength by severity (before hostility scaling + spread).
    // `spotOffset` shifts the patrol spot-chance: a small probe sneaks, a big
    // war-band is loud (KoDP: large parties are seen sooner).
    severity: {
      probe: { baseForce: 4, loot: 0.6, casualtyMult: 0.5, spotOffset: -0.15 },
      raid: { baseForce: 8, loot: 1, casualtyMult: 1, spotOffset: 0 },
      warband: { baseForce: 13, loot: 1.5, casualtyMult: 1.5, spotOffset: 0.15 },
    } as Record<
      string,
      { baseForce: number; loot: number; casualtyMult: number; spotOffset: number }
    >,
    /** Attacker force gained per point of the aggressor's hostility (−standing). */
    forcePerHostility: 0.08,
    /** ± random spread applied to the rolled attacker force (as a fraction). */
    forceSpread: 0.25,
    /** Hostility above this can escalate probe→raid→warband. */
    warbandHostility: 55,
    raidHostility: 30,

    // --- Spotting (RAIDING_SPEC.md §3.2) ---
    /** Base chance the patrols spot an incoming band before it strikes. */
    spotChanceBase: 0.3,
    /** Added to the spot chance per point of postDefense (walls/watchtower/guards). */
    spotChancePerDefense: 0.08,
    /** Undetected raiders open with this much added to attacker force (surprise). */
    surpriseForce: 3,
    /** An outbound raiding party that slips past the watch strikes with this bonus. */
    outgoingSurpriseForce: 4,
    /** A detected target musters this much more force before the clash. */
    outgoingDetectedDefenseBonus: 2,
    /** Base difficulty to approach a target unseen on an outgoing raid. */
    outgoingStealthDifficulty: 10,
    /** Each hero in the party makes a raid harder to conceal. */
    outgoingStealthPartyPenalty: 1,
    /** Each guard escort makes a raid harder to conceal. */
    outgoingStealthGuardPenalty: 1,
    /** Calling in allied warriors makes stealth still harder. */
    outgoingStealthAllyPenalty: 2,
    /** A settled target with guards and stores behind it. */
    outgoingSeatDefense: 9,
    /** A wilderness camp or loose war-band. */
    outgoingWildDefense: 6,
    /** Long marches sap a raiding party's striking power. */
    outgoingDistancePenaltyPerTurn: 0.5,
    /** A friendly faction may be asked to lend warriors at or above this standing. */
    allyStandingRequired: 15,
    /** Warriors lent by an ally on an outgoing raid. */
    allyForceBonus: 4,
    /** Standing spent when calling in allied raiders. */
    allyStandingCost: 2,

    // Defender battle goals: how each shapes the fight (RAIDING_SPEC.md §4).
    // forceMod adds to the defence tally; casualtyMult scales guard losses on a
    // loss; bloody flips a repel into a feud (aggressor standing drops instead of
    // rising); recover is the fraction of threatened value clawed back on a repel.
    defendGoals: {
      hold: { forceMod: 2, casualtyMult: 0.5, bloody: false, recover: 0 },
      driveoff: { forceMod: 1, casualtyMult: 0.7, bloody: false, recover: 0 },
      stand: { forceMod: -1, casualtyMult: 1.3, bloody: true, recover: 0 },
      sally: { forceMod: 0, casualtyMult: 1.1, bloody: false, recover: 0.15 },
    } as Record<
      string,
      { forceMod: number; casualtyMult: number; bloody: boolean; recover: number }
    >,
    attackGoals: {
      plunder: {
        forceMod: 0,
        casualtyMult: 0.9,
        lootSilverMult: 1,
        lootGoodsMult: 1,
        factionStandingLoss: 3,
        companyStandingLoss: 2,
        tributeSilver: 0,
      },
      burn: {
        forceMod: -1,
        casualtyMult: 1.1,
        lootSilverMult: 0.3,
        lootGoodsMult: 0.4,
        factionStandingLoss: 5,
        companyStandingLoss: 4,
        tributeSilver: 0,
      },
      bloody: {
        forceMod: 1,
        casualtyMult: 1.25,
        lootSilverMult: 0.15,
        lootGoodsMult: 0.2,
        factionStandingLoss: 6,
        companyStandingLoss: 5,
        tributeSilver: 0,
      },
      cow: {
        forceMod: 0,
        casualtyMult: 1,
        lootSilverMult: 0.4,
        lootGoodsMult: 0.3,
        factionStandingLoss: 4,
        companyStandingLoss: 3,
        tributeSilver: 18,
      },
    } as Record<
      string,
      {
        forceMod: number;
        casualtyMult: number;
        lootSilverMult: number;
        lootGoodsMult: number;
        factionStandingLoss: number;
        companyStandingLoss: number;
        tributeSilver: number;
      }
    >,

    // --- Battle resolution (RAIDING_SPEC.md §3.3) ---
    /** ± force swing from winning the maneuver rock-paper-scissors. */
    maneuverSwing: 3,
    /** Rally (a leadership check) adds this to the defender force on success. */
    rallyForceBonus: 3,
    rallyCheckDifficulty: 10,
    /** Margin thresholds (defender POV) mapping the battle roll to an outcome. */
    outcome: {
      repelledMargin: 4, // decisive defence — attackers bloodied, driven off
      holdMargin: -3, // held, but they got something
      sackMargin: -9, // overrun: heavy loss, a sack
    },

    // --- Stakes (RAIDING_SPEC.md §7) ---
    /** Fraction of held silver a full sack can carry off (scaled by deficit). */
    lootSilverFraction: 0.3,
    /** Fraction of a good's stock a full sack can carry off. */
    lootGoodFraction: 0.35,
    /** Goods raiders prefer, in rough priority order (grain/portable wealth). */
    lootGoods: ['grain', 'furs', 'hides', 'cloth', 'salt', 'tools', 'amber'] as string[],
    /** Silver an outbound raid can expect per point of winning margin. */
    outgoingSilverPerMargin: 5,
    /** Goods units an outbound raid expects even on a narrow win. */
    outgoingGoodsBase: 2,
    /** Extra goods units per point of winning margin on an outgoing raid. */
    outgoingGoodsPerMargin: 0.45,
    /** Guard residents lost, per point of losing margin, × severity casualtyMult. */
    guardCasualtyPerMargin: 0.4,
    /** Guard escorts lost, per point of losing margin, on an outgoing raid. */
    outgoingGuardCasualtyPerMargin: 0.25,
    /** Chance a bad loss wounds an at-post hero (health/stress). */
    heroWoundChance: 0.5,
    heroWoundHealth: 2,
    heroWoundStress: 2,
    /** Construction progress lost when a raid reaches the works. */
    constructionDamage: 40,
    /** On a sack with a building present, the chance a completed building burns. */
    buildingBurnChance: 0.25,

    // Standing consequences (KoDP feuds).
    /** Aggressor standing change when we repel them decisively (they respect strength). */
    repelStandingGain: 2,
    /** Aggressor standing loss when we choose to bloody them (hardens the grudge). */
    bloodyStandingLoss: 4,
    /** Aggressor standing change when they sack us (emboldened). */
    sackStandingLoss: 3,
    /** Standing loss when tribute is broken or dishonoured. */
    tributeBrokenStandingLoss: 8,

    // --- The `destroyed` game-over: cascading failure only (RAIDING_SPEC.md §7.1) ---
    destroyed: {
      /** Post is "hollowed" at/below this many total residents. */
      residentFloor: 3,
      /** …and at/below this combined silver + stock value. */
      wealthFloor: 60,
      /** A prior sack within this many turns makes the next sack fatal. */
      cascadeWindow: 6,
    },
  },
} as const;
