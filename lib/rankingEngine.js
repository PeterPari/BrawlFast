/**
 * Ranking Engine Module
 *
 * Core algorithm for calculating brawler rankings using advanced statistical methods.
 * Implements Bayesian confidence, time-weighted performance, map-aware weighting,
 * team synergy analysis, use-rate intelligence, and counter-meta scoring.
 */

const { mean, standardDeviation } = require('./statistics');
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
 * Calculates use-rate intelligence score based on z-score analysis.
 *
 * Classifies brawlers into categories based on use rate and win rate patterns:
 * - Meta Strength: High use + high win (popular and effective)
 * - Sleeper Pick: Low use + high win (underrated gems)
 * - Trap Pick: High use + low win (overrated, noob trap)
 * - Neutral: Average performance
 *
 * Uses z-scores to identify statistical outliers and assign appropriate scores.
 *
 * @param {number} useRate - Brawler's use rate percentage
 * @param {number} winRate - Brawler's win rate percentage
 * @param {number} meanUse - Mean use rate across all brawlers
 * @param {number} stdDevUse - Standard deviation of use rates
 * @param {number} meanWin - Mean win rate across all brawlers
 * @param {number} stdDevWin - Standard deviation of win rates
 * @returns {number} Score between 0 and 1
 *
 * @example
 * // Meta dominant (high use, high win)
 * calculateUseRateScore(25, 60, 10, 5, 50, 5) // ~0.9
 *
 * // Sleeper pick (low use, high win)
 * calculateUseRateScore(5, 60, 10, 5, 50, 5) // ~0.85
 *
 * // Trap pick (high use, low win)
 * calculateUseRateScore(25, 40, 10, 5, 50, 5) // 0.2
 */
function calculateUseRateScore(useRate, winRate, meanUse, stdDevUse, meanWin, stdDevWin) {
  const zUse = stdDevUse > 0 ? (useRate - meanUse) / stdDevUse : 0;
  const zWin = stdDevWin > 0 ? (winRate - meanWin) / stdDevWin : 0;

  const thresholds = config.useRateThresholds;
  const scores = config.useRateScores;
  let score = 0.5;

  // Meta strength: High use + high win
  if (zUse > thresholds.metaStrength && zWin > thresholds.metaStrength) {
    score = scores.metaStrength.base + (scores.metaStrength.bonus * Math.min(zUse, zWin) / 3);
  }
  // Sleeper pick: Low use + high win
  else if (zWin > thresholds.sleeperPick.winRateMin && zUse < thresholds.sleeperPick.useRateMax) {
    score = scores.sleeperPick.base + (scores.sleeperPick.bonus * zWin / 3);
  }
  // Trap pick: High use + low win
  else if (zUse > thresholds.trapPick.useRateMin && zWin < thresholds.trapPick.winRateMax) {
    score = scores.trapPick;
  }
  // Neutral: Adjust based on win rate
  else {
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
 * Matchups are weighted by sample count (log scale) to emphasize reliable data.
 *
 * @param {string} brawlerName - Name of brawler to analyze
 * @param {Array<{opponent: string, winRate: number, sampleCount: number}>} matchups - Matchup data for this brawler
 * @param {string[]} popularEnemies - List of popular enemy brawlers (empty = consider all)
 * @returns {number} Score between 0 and 1 (0.5 = neutral, >0.5 = counters meta, <0.5 = weak to meta)
 *
 * @example
 * const matchups = [
 *   { opponent: "Mortis", winRate: 65, sampleCount: 100 },
 *   { opponent: "Tick", winRate: 55, sampleCount: 80 }
 * ];
 * calculateCounterMetaScore("Shelly", matchups, ["Mortis", "Tick"]) // ~0.6
 */
function calculateCounterMetaScore(brawlerName, matchups, popularEnemies) {
  if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
    return config.counterMetaConfig.defaultScore;
  }

  let totalWeightedWinRate = 0;
  let totalWeight = 0;
  const enemies = popularEnemies || [];

  for (const matchup of matchups) {
    if (matchup.sampleCount > config.counterMetaConfig.minMatchupSampleCount) {
      const isPopular = enemies.length === 0 || enemies.includes(matchup.opponent);
      if (isPopular) {
        const weight = Math.log(matchup.sampleCount);
        totalWeightedWinRate += matchup.winRate * weight;
        totalWeight += weight;
      }
    }
  }

  if (totalWeight === 0) return config.counterMetaConfig.defaultScore;
  return (totalWeightedWinRate / totalWeight) / 100;
}

/**
 * Computes the Competitive Performance Score (CPS) for a brawler.
 *
 * The CPS is a comprehensive ranking metric that combines multiple factors:
 * 1. Time-weighted win rate (performance with recent emphasis)
 * 2. Bayesian confidence (reliability of data)
 * 3. Pairwise synergy (team composition strength)
 * 4. Use rate intelligence (meta positioning)
 * 5. Counter-meta score (strategic value)
 *
 * Weights are dynamically adjusted based on map type to reflect different
 * strategic priorities across game modes.
 *
 * Formula:
 * CPS = [Σ(weight_i × score_i)] × confidence
 *
 * @param {Object} brawler - Brawler data object
 * @param {string} brawler.name - Brawler name
 * @param {number} brawler.winRate - Win rate percentage
 * @param {number} brawler.adjustedWinRate - Bayesian-adjusted win rate
 * @param {number} brawler.useRate - Use rate percentage
 * @param {number} brawler.count - Total games played
 * @param {Array} brawler.recentGames - Recent game records with timestamps
 * @param {Array} brawler.matchups - Matchup data
 * @param {Array<Object>} allBrawlers - All brawlers for statistical comparison
 * @param {Array<Object>} teams - Team composition data
 * @param {string} mapMode - Map mode string
 * @returns {number} CPS score (typically 0.0 to 1.0, higher is better)
 *
 * @example
 * const cps = computeCPS(brawler, allBrawlers, teams, "Gem Grab");
 * // 0.847 (S-tier brawler)
 */
function computeCPS(brawler, allBrawlers, teams, mapMode) {
  const winRate = brawler.adjustedWinRate || brawler.winRate || 50;
  const useRate = brawler.useRate || 0;
  const count = brawler.count || 0;

  // Calculate distribution statistics for z-score analysis
  const winRates = allBrawlers.map(b => b.adjustedWinRate || b.winRate).filter(wr => wr != null);
  const useRates = allBrawlers.map(b => b.useRate).filter(ur => ur != null);
  const meanWR = mean(winRates);
  const stdDevWR = standardDeviation(winRates);
  const meanUR = useRates.length > 0 ? mean(useRates) : 0;
  const stdDevUR = useRates.length > 0 ? standardDeviation(useRates) : 0;

  // Calculate time-weighted win rate (falls back to static win rate if no game data)
  const timeWeightedWinRate = calculateTimeWeightedWinRate(brawler.recentGames) ?? winRate;

  // Calculate Bayesian confidence
  const wins = (winRate / 100) * count;
  const losses = count - wins;
  const confidence = calculateBayesianConfidence(wins, losses);

  // Get map-specific weights
  const mapType = normalizeMapType(mapMode);
  const weights = getMapTypeWeights(mapType);

  // Calculate component scores
  const synergyScore = calculatePairwiseSynergy(brawler.name, teams, allBrawlers);
  const useRateScore = calculateUseRateScore(useRate, winRate, meanUR, stdDevUR, meanWR, stdDevWR);
  const counterScore = calculateCounterMetaScore(brawler.name, brawler.matchups, []);

  const normWinRate = timeWeightedWinRate / 100;

  // Weighted combination of all factors
  const baseCPS =
    (weights.performance * normWinRate) +
    (weights.synergy * synergyScore) +
    (weights.popularity * useRateScore) +
    (weights.counter * counterScore);

  // Apply confidence multiplier (low confidence reduces final score)
  const finalCPS = baseCPS * confidence;

  return Number(finalCPS.toFixed(3));
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

module.exports = {
  calculateBayesianConfidence,
  calculateTimeWeightedWinRate,
  normalizeMapType,
  getMapTypeWeights,
  calculatePairwiseSynergy,
  calculateUseRateScore,
  calculateCounterMetaScore,
  computeCPS,
  assignTiers,
  MapType: config.MapType
};
