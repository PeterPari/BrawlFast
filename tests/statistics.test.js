/**
 * Unit Tests for Statistics Module
 *
 * Tests core statistical functions used throughout the ranking algorithm.
 */

const { mean, standardDeviation, zScore, binomialVariance, betaVariance, sampleVariance } = require('../lib/statistics');

describe('Statistics Module', () => {
  describe('mean()', () => {
    test('calculates mean of positive numbers', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    test('calculates mean of negative numbers', () => {
      expect(mean([-5, -3, -1])).toBe(-3);
    });

    test('calculates mean of mixed numbers', () => {
      expect(mean([-2, 0, 2])).toBe(0);
    });

    test('calculates mean of single value', () => {
      expect(mean([42])).toBe(42);
    });

    test('returns 0 for empty array', () => {
      expect(mean([])).toBe(0);
    });

    test('handles decimal values correctly', () => {
      expect(mean([1.5, 2.5, 3.5])).toBeCloseTo(2.5, 5);
    });

    test('handles large numbers', () => {
      expect(mean([1000000, 2000000, 3000000])).toBe(2000000);
    });
  });

  describe('standardDeviation()', () => {
    test('calculates standard deviation of varying numbers', () => {
      const result = standardDeviation([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(1.414, 2);
    });

    test('returns 0 for identical values (no variance)', () => {
      expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    });

    test('returns 0 for single value', () => {
      expect(standardDeviation([42])).toBe(0);
    });

    test('returns 0 for empty array', () => {
      expect(standardDeviation([])).toBe(0);
    });

    test('handles negative numbers', () => {
      const result = standardDeviation([-5, -3, -1, 1, 3, 5]);
      expect(result).toBeGreaterThan(0);
    });

    test('handles high variance data', () => {
      const result = standardDeviation([1, 100, 200]);
      expect(result).toBeGreaterThan(50);
    });

    test('handles low variance data', () => {
      const result = standardDeviation([49, 50, 51]);
      expect(result).toBeLessThan(1);
    });
  });

  describe('zScore()', () => {
    test('calculates positive z-score for above-average value', () => {
      const result = zScore(75, 50, 10);
      expect(result).toBe(2.5);
    });

    test('calculates negative z-score for below-average value', () => {
      const result = zScore(25, 50, 10);
      expect(result).toBe(-2.5);
    });

    test('returns 0 for value equal to mean', () => {
      expect(zScore(50, 50, 10)).toBe(0);
    });

    test('returns 0 when standard deviation is 0', () => {
      expect(zScore(100, 50, 0)).toBe(0);
    });

    test('handles decimal z-scores', () => {
      const result = zScore(55, 50, 10);
      expect(result).toBeCloseTo(0.5, 5);
    });

    test('handles negative mean and values', () => {
      const result = zScore(-10, -20, 5);
      expect(result).toBe(2);
    });

    test('identifies extreme outliers', () => {
      const result = zScore(150, 50, 10);
      expect(result).toBe(10);
    });
  });

  describe('Integration Tests', () => {
    test('mean and standard deviation work together', () => {
      const data = [45, 50, 55, 60, 65];
      const avg = mean(data);
      const stdDev = standardDeviation(data);

      expect(avg).toBe(55);
      expect(stdDev).toBeGreaterThan(0);
    });

    test('z-score calculation with computed mean and stdDev', () => {
      const data = [40, 50, 60];
      const avg = mean(data);
      const stdDev = standardDeviation(data);
      const z = zScore(60, avg, stdDev);

      expect(z).toBeGreaterThan(0); // 60 is above mean
    });

    test('all functions handle empty/edge cases gracefully', () => {
      expect(mean([])).toBe(0);
      expect(standardDeviation([])).toBe(0);
      expect(zScore(100, 50, 0)).toBe(0);
    });
  });

  describe('binomialVariance()', () => {
    test('returns 0.25 (max uncertainty) when n is 0', () => {
      expect(binomialVariance(50, 0)).toBe(0.25);
    });

    test('returns 0.25 (max uncertainty) when n is null/undefined', () => {
      expect(binomialVariance(50, null)).toBe(0.25);
      expect(binomialVariance(50, undefined)).toBe(0.25);
    });

    test('variance decreases as n increases', () => {
      const lo = binomialVariance(55, 100);
      const hi = binomialVariance(55, 1000);
      expect(hi).toBeLessThan(lo);
    });

    test('variance is maximised at p = 0.5 (WR = 50)', () => {
      const at50 = binomialVariance(50, 1000);
      const at70 = binomialVariance(70, 1000);
      expect(at50).toBeGreaterThan(at70);
    });

    test('variance is 0 at WR = 0% (certain loss)', () => {
      expect(binomialVariance(0, 1000)).toBe(0);
    });

    test('variance is 0 at WR = 100% (certain win)', () => {
      expect(binomialVariance(100, 1000)).toBe(0);
    });

    test('formula check: p=0.5, n=100 → 0.0025', () => {
      expect(binomialVariance(50, 100)).toBeCloseTo(0.0025, 6);
    });
  });

  describe('betaVariance()', () => {
    test('returns 0 for alpha=0 and beta=0', () => {
      expect(betaVariance(0, 0)).toBe(0);
    });

    test('variance decreases as alpha and beta grow (more data)', () => {
      const small = betaVariance(10, 10);
      const large = betaVariance(1000, 1000);
      expect(large).toBeLessThan(small);
    });

    test('symmetric Beta has equal variance for swapped params', () => {
      expect(betaVariance(30, 70)).toBeCloseTo(betaVariance(70, 30), 10);
    });

    test('formula check: Beta(1,1) uniform → variance = 1/12', () => {
      // Var(Beta(1,1)) = 1*1 / (2^2 * 3) = 1/12
      expect(betaVariance(1, 1)).toBeCloseTo(1 / 12, 6);
    });

    test('variance is always non-negative', () => {
      expect(betaVariance(50, 50)).toBeGreaterThanOrEqual(0);
      expect(betaVariance(0.1, 0.1)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sampleVariance()', () => {
    test('returns 0 for fewer than 2 values', () => {
      expect(sampleVariance([])).toBe(0);
      expect(sampleVariance([5])).toBe(0);
    });

    test('returns 0 for identical values', () => {
      expect(sampleVariance([3, 3, 3, 3])).toBe(0);
    });

    test('calculates correct sample variance', () => {
      // [2, 4, 4, 4, 5, 5, 7, 9]: mean=5
      // sum of squared deviations = 9+1+1+1+0+0+4+16 = 32
      // sample variance = 32 / (8-1) = 32/7 ≈ 4.571
      const result = sampleVariance([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(32 / 7, 4);
    });

    test('sample variance is larger than population variance', () => {
      const data = [1, 2, 3, 4, 5];
      const avg = mean(data);
      const popVar = data.reduce((s, v) => s + (v - avg) ** 2, 0) / data.length;
      const sampVar = sampleVariance(data);
      expect(sampVar).toBeGreaterThan(popVar);
    });

    test('variance is non-negative', () => {
      expect(sampleVariance([10, 20, 30])).toBeGreaterThanOrEqual(0);
    });
  });
});
