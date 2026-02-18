/**
 * Statistical Utilities Module
 *
 * Provides core statistical calculations for the ranking algorithm.
 */

/**
 * Calculates the arithmetic mean (average) of an array of numbers.
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} The mean value, or 0 if array is empty
 *
 * @example
 * mean([1, 2, 3, 4, 5]) // 3
 * mean([]) // 0
 */
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculates the standard deviation of an array of numbers.
 *
 * Uses population standard deviation formula:
 * σ = sqrt(Σ(x - μ)² / N)
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} The standard deviation, or 0 if fewer than 2 values
 *
 * @example
 * standardDeviation([1, 2, 3, 4, 5]) // ~1.41
 * standardDeviation([5, 5, 5]) // 0
 * standardDeviation([1]) // 0
 */
function standardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculates the z-score (standard score) for a value.
 *
 * The z-score represents how many standard deviations a value is from the mean.
 * Formula: z = (x - μ) / σ
 *
 * Positive z-scores indicate above-average values.
 * Negative z-scores indicate below-average values.
 *
 * @param {number} value - The value to score
 * @param {number} avg - The mean of the distribution
 * @param {number} stdDev - The standard deviation of the distribution
 * @returns {number} The z-score, or 0 if stdDev is 0
 *
 * @example
 * zScore(75, 50, 10) // 2.5 (75 is 2.5 std devs above mean)
 * zScore(50, 50, 10) // 0 (exactly average)
 * zScore(25, 50, 10) // -2.5 (75 is 2.5 std devs below mean)
 */
function zScore(value, avg, stdDev) {
  if (stdDev === 0) return 0;
  return (value - avg) / stdDev;
}

/**
 * Variance of a win-rate estimate under the Binomial model.
 *
 * Var(p̂) = p(1 - p) / n
 *
 * Returns maximum uncertainty (0.25) when n ≤ 0 because an unobserved
 * brawler could have any win rate.
 *
 * @param {number} winRatePct - Win rate as a percentage (0-100)
 * @param {number} n          - Sample size (games played)
 * @returns {number} Variance in squared proportion units [0, 0.25]
 */
function binomialVariance(winRatePct, n) {
  if (!n || n <= 0) return 0.25;
  const p = winRatePct / 100;
  return (p * (1 - p)) / n;
}

/**
 * Variance of a Beta(α, β) distribution.
 *
 * Var = αβ / [(α + β)² (α + β + 1)]
 *
 * Used by computeCPSWithCI to propagate Bayesian-confidence uncertainty
 * through the delta-method approximation.
 *
 * @param {number} alpha - Alpha parameter (wins + priorWins)
 * @param {number} beta  - Beta  parameter (losses + priorLosses)
 * @returns {number} Variance of the Beta distribution
 */
function betaVariance(alpha, beta) {
  const total = alpha + beta;
  if (total <= 0) return 0;
  return (alpha * beta) / (Math.pow(total, 2) * (total + 1));
}

/**
 * Sample variance of an array of numbers (Bessel's correction).
 *
 * Used to estimate variance in synergy / counter-meta score samples
 * when individual per-team or per-matchup scores are available.
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} Sample variance (n-1 denominator), or 0 if length < 2
 */
function sampleVariance(values) {
  if (!values || values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
}

module.exports = {
  mean,
  standardDeviation,
  zScore,
  binomialVariance,
  betaVariance,
  sampleVariance
};
