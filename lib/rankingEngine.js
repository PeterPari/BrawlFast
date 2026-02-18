/**
 * Ranking Engine Module
 *
 * Core algorithm for calculating brawler rankings using advanced statistical methods.
 * Implements Bayesian confidence, time-weighted performance, map-aware weighting,
 * team synergy analysis, use-rate intelligence, and counter-meta scoring.
 */

const { mean, standardDeviation, binomialVariance, betaVariance } = require('./statistics');
const { detectChangepoint, computeStaleness } = require('./changepoint');
const { getMapFeatureWeightModifiers } = require('./mapFeatures');
const config = require('../config/ranking.config');

/**
 * Calculates Bayesian confidence using Beta distribution credible intervals.
 *
 * Uses the Beta distribution to model win rate uncertainty. Confidence is inversely
 * proportional to the width of the 95% credible interval - narrower intervals indicate
 * higher confidence in the estimated win rate.
 *
 * The Beta distribution is characterized by alpha (wins + prior wins) and beta
 * (losses + prior losses). The variance formula gives us interval width, which
 * we invert to get confidence.
 *
 * @param {number} wins - Number of wins
 * @param {number} losses - Number of losses
 * @param {number} [priorWins] - Prior wins (Bayesian prior parameter). Defaults to config value.
 * @param {number} [priorLosses] - Prior losses (Bayesian prior parameter). Defaults to config value.
 * @returns {number} Confidence score between 0 and 1 (1 = maximum confidence)
 *
 * @example
 * // High sample count → high confidence
 * calculateBayesianConfidence(1000, 1000) // ~0.95
 *
 * // Low sample count → low confidence
 * calculateBayesianConfidence(10, 10) // ~0.7
 *
 * @see {@link https://en.wikipedia.org/wiki/Beta_distribution}
 */
function calculateBayesianConfidence(
  wins,
  losses,
  priorWins = config.bayesianPriors.wins,
  priorLosses = config.bayesianPriors.losses
) {
  const alpha = wins + priorWins;
  const beta = losses + priorLosses;
  const total = alpha + beta;

  // Beta distribution variance formula
  const variance = (alpha * beta) / (Math.pow(total, 2) * (total + 1));
  const stdDev = Math.sqrt(variance);

  // 95% credible interval width (approximately ±2σ)
  const intervalWidth = 4 * stdDev;

  // Invert interval width to get confidence (narrower = higher confidence)
  return Math.max(0, 1 - intervalWidth);
}

/**
 * Calculates time-weighted win rate using exponential decay.
 *
 * Recent games are weighted more heavily than older games using exponential decay.
 * The half-life parameter determines how quickly game weights decay over time.
 *
 * Formula: weight(t) = exp(-t / halfLife)
 * where t is days ago
 *
 * This allows the ranking system to adapt quickly to balance changes and meta shifts
 * while still incorporating historical performance data.
 *
 * @param {Array<{isWin: boolean, timestamp: Date|string|number}>} games - Array of game records with timestamps
 * @param {number} [halfLifeDays] - Half-life in days (games this old have 50% weight). Defaults to config value.
 * @returns {number|null} Time-weighted win rate percentage (0-100), or null if no games provided
 *
 * @example
 * const games = [
 *   { isWin: true, timestamp: Date.now() },              // Full weight
 *   { isWin: false, timestamp: Date.now() - 7*24*60*60*1000 }, // ~70% weight
 *   { isWin: true, timestamp: Date.now() - 14*24*60*60*1000 }  // 50% weight
 * ];
 * calculateTimeWeightedWinRate(games, 14) // Weighted average
 */
function calculateTimeWeightedWinRate(games, halfLifeDays = config.timeWeighting.halfLifeDays) {
  if (!games || !Array.isArray(games) || games.length === 0) return null;

  const now = Date.now();
  let totalWeight = 0;
  let weightedWins = 0;

  for (const game of games) {
    const daysAgo = (now - new Date(game.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.exp(-daysAgo / halfLifeDays);

    totalWeight += weight;
    if (game.isWin) {
      weightedWins += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return (weightedWins / totalWeight) * 100;
}

/**
 * Normalizes a map mode string to a MapType enum value.
 *
 * Handles various input formats (spaces, hyphens, underscores, case variations)
 * and maps them to standardized MapType values.
 *
 * @param {string} mode - Raw map mode string (e.g., "Gem Grab", "gem-grab", "GEMGRAB")
 * @returns {string} Normalized MapType value
 *
 * @example
 * normalizeMapType("Gem Grab") // "gemGrab"
 * normalizeMapType("brawl-ball") // "brawlBall"
 * normalizeMapType("unknown mode") // "unknown"
 */
function normalizeMapType(mode) {
  const m = String(mode || '').toLowerCase().replace(/[\s\-_]/g, '');
  if (m.includes('gem')) return config.MapType.GEM_GRAB;
  if (m.includes('ball')) return config.MapType.BRAWL_BALL;
  if (m.includes('bounty')) return config.MapType.BOUNTY;
  if (m.includes('heist')) return config.MapType.HEIST;
  if (m.includes('showdown')) return config.MapType.SHOWDOWN;
  if (m.includes('zone')) return config.MapType.HOT_ZONE;
  if (m.includes('knock')) return config.MapType.KNOCKOUT;
  return config.MapType.UNKNOWN;
}

/**
 * Gets map-specific ranking weights based on game mode.
 *
 * Different game modes emphasize different aspects of brawler performance:
 * - Showdown emphasizes individual performance (solo mode)
 * - Gem Grab/Hot Zone emphasize team synergy (coordination-heavy)
 * - Brawl Ball/Bounty/Knockout are balanced
 * - Heist emphasizes specialist performance
 *
 * @param {string} mapType - MapType enum value
 * @returns {{performance: number, synergy: number, popularity: number, counter: number}} Weight object (sums to 1.0)
 *
 * @example
 * getMapTypeWeights(MapType.SHOWDOWN)
 * // { performance: 0.75, synergy: 0.05, popularity: 0.1, counter: 0.1 }
 *
 * getMapTypeWeights(MapType.GEM_GRAB)
 * // { performance: 0.4, synergy: 0.35, popularity: 0.15, counter: 0.1 }
 */
function getMapTypeWeights(mapType) {
  return config.mapWeights[mapType] || config.mapWeights[config.MapType.UNKNOWN];
}

/**
 * Calculates pairwise synergy score based on team composition performance.
 *
 * Analyzes how well a brawler performs with partners compared to individual expected
 * performance. Positive synergy indicates the brawler performs better in certain team
 * compositions than predicted by individual win rates.
 *
 * Formula: synergy(A, B) = teamWinRate(A+B) - winRate(A) - winRate(B) + baseline
 *
 * Results are log-weighted by team play count to emphasize popular compositions
 * and normalized to [0, 1] range.
 *
 * @param {string} brawlerName - Name of brawler to analyze
 * @param {Array<{brawlers: string[], winRate: number, adjustedWinRate: number, count: number}>} allTeams - All team compositions
 * @param {Array<{name: string, winRate: number, adjustedWinRate: number}>} topBrawlers - List of brawlers with win rates
 * @returns {number} Synergy score between 0 and 1
 *
 * @example
 * // Brawler performs well in teams → high synergy
 * calculatePairwiseSynergy("Poco", teams, brawlers) // 0.7
 *
 * // Brawler performs worse in teams → low synergy
 * calculatePairwiseSynergy("Edgar", teams, brawlers) // 0.2
 */
function calculatePairwiseSynergy(brawlerName, allTeams, topBrawlers) {
  const relevantTeams = allTeams.filter(t =>
    t.brawlers &&
    t.brawlers.includes(brawlerName) &&
    (t.count || 0) > config.synergyConfig.minTeamSampleCount
  );

  if (relevantTeams.length === 0) return 0;

  let totalSynergy = 0;
  let pairCount = 0;

  const brawlerMap = new Map(topBrawlers.map(b => [b.name, b.adjustedWinRate || b.winRate || 50]));
  const myWinRate = brawlerMap.get(brawlerName) || 50;

  for (const team of relevantTeams) {
    const teamWinRate = team.adjustedWinRate || team.winRate || 50;
    const partners = team.brawlers.filter(n => n !== brawlerName);

    for (const partner of partners) {
      const partnerWinRate = brawlerMap.get(partner) || 50;

      // Synergy formula: team performance minus individual expected performance
      const synergy = teamWinRate - myWinRate - partnerWinRate + 50;

      // Log-weight by team play count (popular teams matter more)
      const weight = Math.log(team.count || 1);
      totalSynergy += synergy * weight;
      pairCount += weight;
    }
  }

  if (pairCount === 0) return 0;
  const avgSynergy = totalSynergy / pairCount;

  // Normalize to [0, 1] range
  const { offset, range } = config.synergyConfig.normalization;
  return Math.max(0, Math.min(1, (avgSynergy + offset) / range));
}

/**
 * Calculates a continuous use-rate intelligence score using a sigmoid function.
 *
 * Replaces the discrete meta/sleeper/trap/neutral categorisation with a smooth
 * function that:
 *   - Rewards high win-rate brawlers (strong z_win → high score)
 *   - Penalises brawlers where use-rate far exceeds win-rate (trap picks)
 *   - Lets sleeper picks (low use, high win) score nearly as high as meta picks
 *
 * Formula:
 *   trapPenalty = trapPenaltyCoeff × max(z_use - z_win, 0)
 *   logit = winRateCoeff × z_win - trapPenalty
 *   score = sigmoid(logit) = 1 / (1 + exp(-logit))
 *
 * Illustrative examples (meanUse=10, stdUse=5, meanWin=50, stdWin=5):
 *   Meta   (use=25, win=60): z_use=3, z_win=2 → score ≈ 0.97
 *   Sleeper (use=5,  win=60): z_use=-1, z_win=2 → score ≈ 0.98
 *   Trap   (use=25, win=40): z_use=3, z_win=-2 → score ≈ 0.001
 *   Average (use=10, win=50): z_use=0, z_win=0  → score = 0.50
 *
 * @param {number} useRate    - Brawler's use rate percentage
 * @param {number} winRate    - Brawler's win rate percentage
 * @param {number} meanUse    - Mean use rate across all brawlers
 * @param {number} stdDevUse  - Standard deviation of use rates
 * @param {number} meanWin    - Mean win rate across all brawlers
 * @param {number} stdDevWin  - Standard deviation of win rates
 * @returns {number} Score in (0, 1) — strictly inside the open interval
 */
function calculateUseRateScore(useRate, winRate, meanUse, stdDevUse, meanWin, stdDevWin) {
  const zUse = stdDevUse > 0 ? (useRate - meanUse) / stdDevUse : 0;
  const zWin = stdDevWin > 0 ? (winRate - meanWin) / stdDevWin : 0;

  const cfg = config.continuousUseRate;
  const trapPenalty = cfg.trapPenaltyCoeff * Math.max(zUse - zWin, 0);
  const logit = cfg.winRateCoeff * zWin - trapPenalty;

  // Sigmoid — always in (0, 1), never exactly 0 or 1
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Legacy discrete use-rate scoring (v2 behaviour).
 *
 * Kept for reference and backward-compatible imports.  New code should use
 * calculateUseRateScore() which uses the continuous sigmoid model.
 *
 * @deprecated Use calculateUseRateScore() instead.
 */
function calculateUseRateScoreDiscrete(useRate, winRate, meanUse, stdDevUse, meanWin, stdDevWin) {
  const zUse = stdDevUse > 0 ? (useRate - meanUse) / stdDevUse : 0;
  const zWin = stdDevWin > 0 ? (winRate - meanWin) / stdDevWin : 0;

  const thresholds = config.useRateThresholds;
  const scores = config.useRateScores;
  let score = 0.5;

  if (zUse > thresholds.metaStrength && zWin > thresholds.metaStrength) {
    score = scores.metaStrength.base + (scores.metaStrength.bonus * Math.min(zUse, zWin) / 3);
  } else if (zWin > thresholds.sleeperPick.winRateMin &&
             zUse < thresholds.sleeperPick.useRateMax &&
             useRate >= (thresholds.sleeperPick.minUseRate || 0)) {
    score = scores.sleeperPick.base + (scores.sleeperPick.bonus * zWin / 3);
  } else if (zUse > thresholds.trapPick.useRateMin && zWin < thresholds.trapPick.winRateMax) {
    score = scores.trapPick;
  } else {
    score = scores.neutral.base + (scores.neutral.adjustment * zWin);
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Calculates counter-meta score based on matchup performance.
 *
 * Evaluates how well a brawler performs against popular enemy picks.
 * Brawlers that counter the meta receive higher scores, making them valuable
 * strategic choices even if their overall win rate is moderate.
 *
 * v3 addition — diversity penalty:
 *   When one matchup dominates the weight sum (e.g. a brawler that only
 *   counters Mortis) the deviation from neutral (0.5) is attenuated by:
 *     diversityMultiplier = minMultiplier + (1 - minMultiplier) × diversity
 *   where diversity = 1 - maxWeight / totalWeight.
 *
 *   This prevents a hyper-niche pick from scoring identically to a brawler
 *   that genuinely counters a broad spread of the meta.
 *
 * @param {string} brawlerName - Name of brawler to analyse
 * @param {Array<{opponent: string, winRate: number, sampleCount: number}>} matchups
 * @param {string[]} popularEnemies - List of popular enemy brawlers (empty = all)
 * @returns {number} Score in [0, 1] (0.5 = neutral)
 */
function calculateCounterMetaScore(brawlerName, matchups, popularEnemies) {
  if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
    return config.counterMetaConfig.defaultScore;
  }

  let totalWeightedWinRate = 0;
  let totalWeight = 0;
  let maxWeight = 0;
  const enemies = popularEnemies || [];

  for (const matchup of matchups) {
    if (matchup.sampleCount > config.counterMetaConfig.minMatchupSampleCount) {
      const isPopular = enemies.length === 0 || enemies.includes(matchup.opponent);
      if (isPopular) {
        const weight = Math.log(matchup.sampleCount);
        totalWeightedWinRate += matchup.winRate * weight;
        totalWeight += weight;
        if (weight > maxWeight) maxWeight = weight;
      }
    }
  }

  if (totalWeight === 0) return config.counterMetaConfig.defaultScore;

  const rawScore = (totalWeightedWinRate / totalWeight) / 100;

  // Diversity penalty: attenuate the deviation from 0.5 when one matchup dominates
  const diversity = totalWeight > maxWeight ? 1 - maxWeight / totalWeight : 0;
  const dvMin = config.counterDiversity.minMultiplier;
  const diversityMultiplier = dvMin + (1 - dvMin) * diversity;
  const deviation = rawScore - 0.5;

  return Math.max(0, Math.min(1, 0.5 + deviation * diversityMultiplier));
}

/**
 * Calculates the triple-wise composition score for a brawler.
 *
 * Replaces calculatePairwiseSynergy with a full-team composition lift signal
 * that captures effects invisible to pairwise analysis (e.g. two partners
 * that individually synergise but are terrible together).
 *
 * For every team T = {X, Y, Z} containing this brawler:
 *   compLift(T) = teamWR(T) - mean({WR_X, WR_Y, WR_Z})
 *
 * This measures how much the full composition outperforms the simple
 * expectation from individual win rates.  Results are log-weighted by play
 * count and normalised to [0, 1].
 *
 * Neutral default (0.5) when no qualifying team data is available, unlike
 * the old pairwise scorer which defaulted to 0 (implying terrible synergy).
 *
 * @param {string} brawlerName - Name of brawler to analyse
 * @param {Array<{brawlers: string[], winRate: number, adjustedWinRate: number, count: number}>} allTeams
 * @param {Array<{name: string, winRate: number, adjustedWinRate: number}>} topBrawlers
 * @returns {number} Composition score in [0, 1] (0.5 = neutral)
 */
function calculateCompositionScore(brawlerName, allTeams, topBrawlers) {
  const relevantTeams = allTeams.filter(t =>
    t.brawlers &&
    t.brawlers.includes(brawlerName) &&
    (t.count || 0) > config.compositionConfig.minTeamSampleCount
  );

  if (relevantTeams.length === 0) return 0.5; // neutral when no team data

  const brawlerMap = new Map(
    topBrawlers.map(b => [b.name, b.adjustedWinRate || b.winRate || 50])
  );

  let totalLift = 0;
  let totalWeight = 0;

  for (const team of relevantTeams) {
    const teamWR = team.adjustedWinRate || team.winRate || 50;

    // Mean win rate of all team members (including this brawler)
    const memberWRs = team.brawlers.map(n => brawlerMap.get(n) || 50);
    const teamMeanWR = memberWRs.reduce((s, v) => s + v, 0) / memberWRs.length;

    // Composition lift: how much the team outperforms individual expectations
    const compLift = teamWR - teamMeanWR;

    const weight = Math.log(Math.max(team.count || 1, 1));
    totalLift   += compLift * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0.5;

  const avgLift = totalLift / totalWeight;
  const { offset, range } = config.compositionConfig.normalization;
  return Math.max(0, Math.min(1, (avgLift + offset) / range));
}

/**
 * Applies skill-tier and map-feature modifiers to base map weights, then
 * re-normalises so the four weights always sum to 1.0.
 *
 * Adjustment order:
 *   1. Start from mode-level base weights (mapWeights[mapType])
 *   2. Add skill-tier adjustments (±0.05–0.10 pp)
 *   3. Add map-feature micro-adjustments (±0.03 pp, derived from terrain data)
 *   4. Clamp each weight to [0, 1]
 *   5. Normalise to sum = 1.0
 *
 * 'competitive' tier applies no tier adjustment.
 * Unknown map names apply no feature adjustment.
 *
 * @param {string}      mapType   - The normalised MapType value
 * @param {string|null} skillTier - One of SkillTier.CASUAL / COMPETITIVE / PRO
 * @param {string|null} [mapName] - Raw map name for terrain feature lookup
 * @returns {{ performance: number, synergy: number, popularity: number, counter: number }}
 */
function getEffectiveWeights(mapType, skillTier, mapName = null) {
  const base = getMapTypeWeights(mapType);
  const tier = skillTier || config.SkillTier.COMPETITIVE;
  const tierMods    = config.skillTierModifiers[tier] || config.skillTierModifiers[config.SkillTier.COMPETITIVE];
  const featureMods = getMapFeatureWeightModifiers(mapName);

  const raw = {
    performance: base.performance + (tierMods.performance || 0) + (featureMods.performance || 0),
    synergy:     base.synergy     + (tierMods.synergy     || 0) + (featureMods.synergy     || 0),
    popularity:  base.popularity  + (tierMods.popularity  || 0) + (featureMods.popularity  || 0),
    counter:     base.counter     + (tierMods.counter     || 0) + (featureMods.counter     || 0)
  };

  // Clamp each weight to [0, 1] then re-normalise so they sum to 1.0
  const clamped = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Math.max(0, Math.min(1, v))])
  );
  const total = Object.values(clamped).reduce((s, v) => s + v, 0) || 1;

  return {
    performance: clamped.performance / total,
    synergy:     clamped.synergy     / total,
    popularity:  clamped.popularity  / total,
    counter:     clamped.counter     / total
  };
}

/**
 * Computes the Competitive Performance Score (CPS) for a brawler.
 *
 * v3 changes vs v2:
 *   - Composition scoring replaces pairwise synergy (calculateCompositionScore)
 *   - Continuous sigmoid use-rate replaces discrete categories
 *   - Counter-meta score includes diversity penalty
 *   - Changepoint detection dynamically adjusts the TWR half-life
 *   - Skill-tier modifier re-weights components before calculation
 *
 * Formula:
 *   CPS = [w_perf×(TWR/100) + w_comp×S_comp + w_pop×S_use + w_ctr×S_ctr] × C_bayes
 *
 * @param {Object}      brawler       - Brawler data object
 * @param {Array}       allBrawlers   - All brawlers for statistical comparison
 * @param {Array}       teams         - Team composition data
 * @param {string}      mapMode       - Map mode string (e.g. "Gem Grab")
 * @param {Object|null} [stats]       - Pre-calculated distribution stats (optional)
 * @param {string|null} [skillTier]   - One of 'casual' | 'competitive' | 'pro'
 * @param {string|null} [mapName]     - Raw map name (e.g. "Hard Rock Mine") for terrain features
 * @returns {number} CPS score, typically in [0, 1]
 */
function computeCPS(brawler, allBrawlers, teams, mapMode, stats = null, skillTier = null, mapName = null) {
  const winRate = brawler.adjustedWinRate || brawler.winRate || 50;
  const useRate = brawler.useRate || 0;
  const count   = brawler.count   || 0;

  let meanWR, stdDevWR, meanUR, stdDevUR;

  if (stats) {
    ({ meanWR, stdDevWR, meanUR, stdDevUR } = stats);
  } else {
    const winRates = allBrawlers.map(b => b.adjustedWinRate || b.winRate).filter(wr => wr != null);
    const useRates = allBrawlers.map(b => b.useRate).filter(ur => ur != null);
    meanWR  = mean(winRates);
    stdDevWR = standardDeviation(winRates);
    meanUR  = useRates.length > 0 ? mean(useRates)              : 0;
    stdDevUR = useRates.length > 0 ? standardDeviation(useRates) : 0;
  }

  // Changepoint detection — dynamically adjusts the decay half-life
  const defaultHalfLife = config.timeWeighting.halfLifeDays;
  const { effectiveHalfLife } = detectChangepoint(
    brawler.recentGames,
    defaultHalfLife,
    config.changepointDetection
  );

  // Time-weighted win rate with changepoint-adjusted half-life
  const timeWeightedWinRate = calculateTimeWeightedWinRate(brawler.recentGames, effectiveHalfLife) ?? winRate;

  // Bayesian confidence
  const wins   = (winRate / 100) * count;
  const losses = count - wins;
  const confidence = calculateBayesianConfidence(wins, losses);

  // Map-aware + skill-tier-adjusted + terrain-feature weights
  const mapType = normalizeMapType(mapMode);
  const weights = getEffectiveWeights(mapType, skillTier, mapName);

  // Component scores (v3)
  const compositionScore = calculateCompositionScore(brawler.name, teams, allBrawlers);
  const useRateScore     = calculateUseRateScore(useRate, winRate, meanUR, stdDevUR, meanWR, stdDevWR);
  const counterScore     = calculateCounterMetaScore(brawler.name, brawler.matchups, []);

  const normWinRate = timeWeightedWinRate / 100;

  const baseCPS =
    (weights.performance * normWinRate)      +
    (weights.synergy     * compositionScore) +
    (weights.popularity  * useRateScore)     +
    (weights.counter     * counterScore);

  // Staleness penalty: reduce CPS when pick rate drops sharply while WR is
  // stable — signals a meta-discovered weakness (shadow nerf) not yet visible
  // in aggregate win-rate data.
  let stalenessMult = 1.0;
  if (brawler.historicalPickRate != null && useRate != null) {
    const historicalWR = brawler.historicalWinRate ?? winRate;
    stalenessMult = computeStaleness(
      useRate,
      brawler.historicalPickRate,
      winRate,
      historicalWR,
      config.staleness
    );
  }

  const finalCPS = baseCPS * confidence * stalenessMult;
  return Number(finalCPS.toFixed(3));
}

/**
 * Computes CPS together with a 95% confidence interval using the delta method.
 *
 * The delta method propagates component-level variance through the linear
 * CPS aggregation formula:
 *
 *   Var(CPS) ≈ C² × Σ(w_i² × Var(S_i))  +  baseCPS² × Var(C)
 *
 * This is mathematically exact for the linear combination and approximate for
 * the confidence multiplier term (product of two random variables).
 *
 * @param {Object}      brawler     - Brawler data object (same as computeCPS)
 * @param {Array}       allBrawlers - All brawlers for statistical comparison
 * @param {Array}       teams       - Team composition data
 * @param {string}      mapMode     - Map mode string
 * @param {Object|null} [stats]     - Pre-calculated distribution stats
 * @param {string|null} [skillTier] - Skill tier string
 * @param {string|null} [mapName]   - Raw map name for terrain feature lookup
 * @returns {{ cps: number, ci: [number, number], variance: number }}
 */
function computeCPSWithCI(brawler, allBrawlers, teams, mapMode, stats = null, skillTier = null, mapName = null) {
  const cps = computeCPS(brawler, allBrawlers, teams, mapMode, stats, skillTier, mapName);

  const winRate = brawler.adjustedWinRate || brawler.winRate || 50;
  const count   = brawler.count || 0;
  const wins    = (winRate / 100) * count;
  const losses  = count - wins;

  const priorWins   = config.bayesianPriors.wins;
  const priorLosses = config.bayesianPriors.losses;
  const alpha = wins   + priorWins;
  const beta  = losses + priorLosses;

  // Component variances
  const varWR   = binomialVariance(winRate, count);            // binomial model
  const varConf = betaVariance(alpha, beta);                   // Beta distribution

  // Small fixed variances for synergy/use/counter (data-derived, hard to parameterise exactly)
  const varComp    = 0.02;  // composition score uncertainty ≈ ±14% in score space
  const varUseRate = 0.01;
  const varCounter = count > 0 ? 0.01 : 0.04;  // wider when no match data

  const mapType  = normalizeMapType(mapMode);
  const weights  = getEffectiveWeights(mapType, skillTier, mapName);
  const confidence = calculateBayesianConfidence(wins, losses);

  // Delta method: Var(CPS) ≈ C²Σ(w_i² Var(S_i)) + baseCPS² Var(C)
  const baseCPS  = confidence > 0 ? cps / confidence : cps;
  const varCPS   =
    Math.pow(confidence, 2) * (
      Math.pow(weights.performance, 2) * varWR      +
      Math.pow(weights.synergy,     2) * varComp    +
      Math.pow(weights.popularity,  2) * varUseRate +
      Math.pow(weights.counter,     2) * varCounter
    ) +
    Math.pow(baseCPS, 2) * varConf;

  const stdCPS = Math.sqrt(Math.max(0, varCPS));
  const z      = config.ciConfig.zScore;

  return {
    cps,
    ci: [
      Number(Math.max(0, cps - z * stdCPS).toFixed(3)),
      Number(Math.min(1, cps + z * stdCPS).toFixed(3))
    ],
    variance: Number(varCPS.toFixed(6))
  };
}

/**
 * Assigns tier rankings (S/A/B/C/F) based on CPS percentiles.
 *
 * Uses percentile-based cutoffs rather than standard deviation to ensure
 * consistent tier distribution regardless of score variance:
 * - S tier: Top 10% (elite picks)
 * - A tier: 10-30th percentile (strong picks)
 * - B tier: 30-70th percentile (viable picks)
 * - C tier: 70-90th percentile (weak picks)
 * - F tier: Bottom 10% (avoid)
 *
 * Guarantees at least one S-tier brawler even in small pools.
 *
 * @param {Array<Object>} brawlers - Array of brawlers with CPS scores
 * @param {number} brawlers[].cps - Competitive Performance Score
 * @returns {Array<Object>} Brawlers with tier property added
 *
 * @example
 * const ranked = assignTiers(brawlers);
 * // [
 * //   { name: "Belle", cps: 0.89, tier: "S" },
 * //   { name: "Brock", cps: 0.77, tier: "A" },
 * //   { name: "Shelly", cps: 0.52, tier: "B" },
 * //   ...
 * // ]
 */
function assignTiers(brawlers) {
  const sorted = [...brawlers].sort((a, b) => (b.cps || 0) - (a.cps || 0));
  const count = sorted.length;

  if (count === 0) return brawlers;

  const percentiles = config.tierPercentiles;
  const sCount = Math.max(config.tierRules.minSTier, Math.ceil(count * percentiles.S));
  const aCount = Math.ceil(count * percentiles.A);
  const bCount = Math.ceil(count * percentiles.B);
  const cCount = Math.ceil(count * percentiles.C);

  return sorted.map((brawler, index) => {
    let tier = 'F';
    if (index < sCount) tier = 'S';
    else if (index < sCount + aCount) tier = 'A';
    else if (index < sCount + aCount + bCount) tier = 'B';
    else if (index < sCount + aCount + bCount + cCount) tier = 'C';

    return { ...brawler, tier };
  });
}

/**
 * Ranks a list of brawlers for a specific map mode.
 *
 * Pre-calculates distribution statistics once and shares them across all
 * brawler CPS calculations to avoid O(b²) recomputation.
 *
 * @param {Array<Object>} brawlers    - List of brawlers to rank
 * @param {Array<Object>} teams       - Team composition data
 * @param {string}        mapMode     - Map mode string
 * @param {string|null}   [skillTier] - Optional skill tier ('casual'|'competitive'|'pro')
 * @param {string|null}   [mapName]   - Raw map name for terrain feature weight adjustments
 * @returns {Array<Object>} Ranked brawlers with cps and tier properties
 */
function rankBrawlers(brawlers, teams, mapMode, skillTier = null, mapName = null) {
  if (!brawlers || brawlers.length === 0) return [];

  const winRates = brawlers.map(b => b.adjustedWinRate || b.winRate).filter(wr => wr != null);
  const useRates = brawlers.map(b => b.useRate).filter(ur => ur != null);

  const stats = {
    meanWR:   mean(winRates),
    stdDevWR: standardDeviation(winRates),
    meanUR:   useRates.length > 0 ? mean(useRates)              : 0,
    stdDevUR: useRates.length > 0 ? standardDeviation(useRates) : 0
  };

  const withCPS = brawlers.map(brawler => ({
    ...brawler,
    cps: computeCPS(brawler, brawlers, teams, mapMode, stats, skillTier, mapName)
  }));

  return assignTiers(withCPS);
}

module.exports = {
  // Core utilities
  calculateBayesianConfidence,
  calculateTimeWeightedWinRate,
  normalizeMapType,
  getMapTypeWeights,
  getEffectiveWeights,

  // Scoring components (v3)
  calculateCompositionScore,
  calculateUseRateScore,
  calculateUseRateScoreDiscrete, // legacy — kept for backward compat
  calculateCounterMetaScore,

  // Legacy alias — new code should use calculateCompositionScore directly
  calculatePairwiseSynergy: calculateCompositionScore,

  // CPS computation
  computeCPS,
  computeCPSWithCI,
  rankBrawlers,
  assignTiers,

  MapType: config.MapType,
  SkillTier: config.SkillTier
};
