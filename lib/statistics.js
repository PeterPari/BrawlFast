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

module.exports = {
  mean,
  standardDeviation,
  zScore
};
