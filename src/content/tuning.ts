// All initial tuning values in one place (spec §14). Balancing happens here,
// never in engine code. Pure data — no logic.

export const TUNING = {
  save: {
    version: 1,
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
    /** Events fired per turn: always at least min, at most max. */
    minPerTurn: 1,
    maxPerTurn: 2,
    defaultCooldown: 6,
  },

  stress: {
    /** Stress at which a breakdown event is queued. */
    breakdownThreshold: 10,
    /** Content event fired when a hero breaks down. */
    breakdownEventId: 'hero_breakdown',
  },
} as const;
