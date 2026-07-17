// All initial tuning values in one place (spec §14). Balancing happens here,
// never in engine code. Pure data — no logic.

export const TUNING = {
  save: {
    version: 3,
    autosaveKey: 'trading-post-save',
  },

  start: {
    silver: 200,
    goods: { grain: 30, timber: 10, tools: 4, salt: 4 } as Partial<Record<string, number>>,
    partySize: 6,
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
