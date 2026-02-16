/**
 * Ranking Algorithm Configuration
 *
 * Tunable parameters for the BrawlFast advanced brawler ranking system.
 * Adjust these values to customize algorithm behavior based on meta changes,
 * balance patches, or specific use cases.
 */

/**
 * Map Type Enumeration
 * Defines all supported Brawl Stars game modes
 */
const MapType = {
  GEM_GRAB: 'gemGrab',
  BRAWL_BALL: 'brawlBall',
  BOUNTY: 'bounty',
  HEIST: 'heist',
  SHOWDOWN: 'showdown',
  HOT_ZONE: 'hotZone',
  KNOCKOUT: 'knockout',
  UNKNOWN: 'unknown'
};

/**
 * Bayesian Prior Configuration
 *
 * Controls confidence calculation for win rates with limited sample sizes.
 * Higher priors = more conservative (pulls estimates toward 50% win rate)
 * Lower priors = more aggressive (trusts limited data more)
 *
 * Default: 50/50 represents a neutral 50% win rate assumption
 */
const bayesianPriors = {
  wins: 50,
  losses: 50
};

/**
 * Time-Weighting Configuration
 *
 * Controls how much recent games are weighted vs older games.
 * Half-life determines at what point a game has 50% of its original weight.
 *
 * Default: 14 days (games from 2 weeks ago have 50% weight)
 * Increase for slower meta evolution, decrease for rapid balance changes
 */
const timeWeighting = {
  halfLifeDays: 14
};

/**
 * Map-Specific Ranking Weights
 *
 * Each game mode has different strategic emphases:
 * - performance: Individual win rate contribution
 * - synergy: Team composition synergy contribution
 * - popularity: Use rate / meta relevance contribution
 * - counter: Anti-meta / counter-pick contribution
 *
 * All weights must sum to 1.0 for each mode
 */
const mapWeights = {
  /**
   * Gem Grab & Hot Zone
   * Team-oriented modes requiring high coordination
   * High synergy weight reflects importance of team composition
   */
  [MapType.GEM_GRAB]: {
    performance: 0.4,
    synergy: 0.35,
    popularity: 0.15,
    counter: 0.1
  },
  [MapType.HOT_ZONE]: {
    performance: 0.4,
    synergy: 0.35,
    popularity: 0.15,
    counter: 0.1
  },

  /**
   * Showdown (Solo)
   * Individual performance mode
   * Very high performance weight, minimal synergy
   */
  [MapType.SHOWDOWN]: {
    performance: 0.75,
    synergy: 0.05,
    popularity: 0.1,
    counter: 0.1
  },

  /**
   * Brawl Ball, Bounty, Knockout
   * Balanced team modes
   * Moderate emphasis across all factors
   */
  [MapType.BRAWL_BALL]: {
    performance: 0.5,
    synergy: 0.2,
    popularity: 0.15,
    counter: 0.15
  },
  [MapType.BOUNTY]: {
    performance: 0.5,
    synergy: 0.2,
    popularity: 0.15,
    counter: 0.15
  },
  [MapType.KNOCKOUT]: {
    performance: 0.5,
    synergy: 0.2,
    popularity: 0.15,
    counter: 0.15
  },

  /**
   * Heist
   * Objective-focused mode
   * Higher performance weight for specialists
   */
  [MapType.HEIST]: {
    performance: 0.6,
    synergy: 0.1,
    popularity: 0.15,
    counter: 0.15
  },

  /**
   * Unknown/Default
   * Fallback weights for unmapped modes
   */
  [MapType.UNKNOWN]: {
    performance: 0.5,
    synergy: 0.2,
    popularity: 0.15,
    counter: 0.15
  }
};

/**
 * Use Rate Intelligence Configuration
 *
 * Z-score thresholds for classifying brawlers into meta categories
 */
const useRateThresholds = {
  /**
   * Meta Strength: High use + high win
   * Both use rate and win rate z-scores above this threshold
   */
  metaStrength: 0.5,

  /**
   * Sleeper Pick: Low use + high win
   * Win rate z-score above threshold, use rate below negative threshold
   */
  sleeperPick: {
    winRateMin: 0.5,
    useRateMax: -0.5
  },

  /**
   * Trap Pick: High use + low win
   * Use rate z-score above threshold, win rate below negative threshold
   */
  trapPick: {
    useRateMin: 0.5,
    winRateMax: -0.5
  }
};

/**
 * Use Rate Score Modifiers
 *
 * Score ranges for different brawler categories
 */
const useRateScores = {
  metaStrength: { base: 0.8, bonus: 0.2 },  // 0.8 to 1.0
  sleeperPick: { base: 0.7, bonus: 0.3 },   // 0.7 to 1.0
  trapPick: 0.2,                             // Fixed low score
  neutral: { base: 0.5, adjustment: 0.1 }    // 0.5 ± 0.1
};

/**
 * Team Synergy Configuration
 */
const synergyConfig = {
  /**
   * Minimum team sample count to consider for synergy calculation
   * Teams with fewer games are filtered out to avoid noise
   */
  minTeamSampleCount: 50,

  /**
   * Synergy normalization range
   * Maps raw synergy scores to [0, 1] range
   */
  normalization: {
    offset: 10,   // Center point adjustment
    range: 20     // Total range (offset ± range/2)
  }
};

/**
 * Counter-Meta Configuration
 */
const counterMetaConfig = {
  /**
   * Minimum matchup sample count to consider
   * Matchups with fewer games are filtered out
   */
  minMatchupSampleCount: 30,

  /**
   * Default score when no matchup data available
   * 0.5 = neutral (neither strong nor weak)
   */
  defaultScore: 0.5
};

/**
 * Tier Assignment Configuration
 *
 * Percentile cutoffs for tier assignment
 * All values should sum to 1.0 (100%)
 */
const tierPercentiles = {
  S: 0.10,  // Top 10%
  A: 0.20,  // Next 20% (10-30th percentile)
  B: 0.40,  // Next 40% (30-70th percentile)
  C: 0.20,  // Next 20% (70-90th percentile)
  F: 0.10   // Bottom 10%
};

/**
 * Tier Assignment Rules
 */
const tierRules = {
  /**
   * Minimum number of brawlers in S tier
   * Ensures at least one S-tier brawler even in small pools
   */
  minSTier: 1
};

/**
 * Export all configuration
 */
module.exports = {
  MapType,
  bayesianPriors,
  timeWeighting,
  mapWeights,
  useRateThresholds,
  useRateScores,
  synergyConfig,
  counterMetaConfig,
  tierPercentiles,
  tierRules
};
