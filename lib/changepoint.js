/**
 * Changepoint Detection Module
 *
 * Detects abrupt win-rate shifts (e.g. immediately after balance patches or new
 * brawler releases) using a one-sample binomial z-test.  When a significant
 * shift is detected the effective timeWeighting half-life is shortened so stale
 * pre-patch data decays much faster than the default exponential schedule.
 *
 * This module is intentionally decoupled from rankingEngine so it can be
 * unit-tested and feature-flagged independently.
 */

const config = require('../config/ranking.config');

/**
 * Detects whether a brawler's win rate has undergone an abrupt shift.
 *
 * Algorithm:
 *   1. Partition timestamped games into "recent" (last recentWindowDays) and
 *      "historical" (last halfLifeDays).
 *   2. Compute a binomial z-statistic comparing pRecent vs pHist.
 *   3. If |z| > threshold, shrink the effective half-life proportionally so
 *      pre-shift data receives much lower weight in calculateTimeWeightedWinRate.
 *
 * @param {Array<{isWin: boolean, timestamp: number|string|Date}>} games
 * @param {number} halfLifeDays - Default half-life from config
 * @param {Object} [cpCfg] - Optional override of changepointDetection config
 * @returns {{ isChangepoint: boolean, effectiveHalfLife: number, zShift: number }}
 */
function detectChangepoint(games, halfLifeDays, cpCfg) {
  const cfg = cpCfg || config.changepointDetection;

  if (!cfg || !cfg.enabled) {
    return { isChangepoint: false, effectiveHalfLife: halfLifeDays, zShift: 0 };
  }

  if (!Array.isArray(games) || games.length === 0) {
    return { isChangepoint: false, effectiveHalfLife: halfLifeDays, zShift: 0 };
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentCutoff = now - cfg.recentWindowDays * dayMs;
  const histCutoff   = now - halfLifeDays * dayMs;

  const recentGames = games.filter(g => new Date(g.timestamp).getTime() >= recentCutoff);
  const histGames   = games.filter(g => new Date(g.timestamp).getTime() >= histCutoff);

  // Need enough recent games for the z-test to be meaningful
  if (recentGames.length < cfg.minRecentGames) {
    return { isChangepoint: false, effectiveHalfLife: halfLifeDays, zShift: 0 };
  }

  const pRecent = recentGames.filter(g => g.isWin).length / recentGames.length;
  const pHist   = histGames.length > 0
    ? histGames.filter(g => g.isWin).length / histGames.length
    : 0.5; // fall back to neutral when history window is empty

  // Standard error of pRecent under H0: pRecent ~ Binomial(n, pHist)
  const se = Math.sqrt((pHist * (1 - pHist)) / recentGames.length);

  if (se === 0) {
    // pHist is exactly 0 or 1 — can't divide; treat as no changepoint
    return { isChangepoint: false, effectiveHalfLife: halfLifeDays, zShift: 0 };
  }

  const zShift = Math.abs(pRecent - pHist) / se;

  if (zShift > cfg.threshold) {
    // Reduce half-life proportionally: the larger the shift, the faster old data decays
    const effectiveHalfLife = Math.max(cfg.minHalfLife, halfLifeDays / zShift);
    return { isChangepoint: true, effectiveHalfLife, zShift };
  }

  return { isChangepoint: false, effectiveHalfLife: halfLifeDays, zShift };
}

/**
 * Computes a staleness multiplier for a brawler whose pick rate has dropped
 * sharply while its win rate has remained stable.
 *
 * This pattern typically signals a meta-discovered weakness ("shadow nerf" or a
 * player-behaviour shift) that raw win-rate data hasn't caught yet.
 *
 * Formula: multiplier = clamp(1 + 0.5 * pickDrop, floor, 1.0)
 *
 * @param {number} recentPickRate      - Recent pick rate (0-100)
 * @param {number} historicalPickRate  - Historical pick rate (0-100)
 * @param {number} recentWR            - Recent win rate (0-100)
 * @param {number} historicalWR        - Historical win rate (0-100)
 * @param {Object} [cfg]               - Optional override of staleness config
 * @returns {number} Staleness multiplier in [1 - maxPenalty, 1.0]
 */
function computeStaleness(recentPickRate, historicalPickRate, recentWR, historicalWR, cfg) {
  const stale = cfg || config.staleness;

  if (!historicalPickRate || historicalPickRate <= 0) return 1.0;

  const drop    = (recentPickRate - historicalPickRate) / historicalPickRate;
  const wrShift = Math.abs(recentWR - historicalWR);

  if (drop < stale.pickRateDropThreshold && wrShift < stale.winRateStabilityThreshold) {
    // drop is negative; 1 + 0.5*drop pulls the multiplier below 1
    const multiplier = 1 + 0.5 * drop;
    return Math.max(1 - stale.maxPenalty, multiplier);
  }

  return 1.0;
}

module.exports = { detectChangepoint, computeStaleness };
