/**
 * Unit Tests for Statistics Module
 *
 * Tests core statistical functions used throughout the ranking algorithm.
 */

const { mean, standardDeviation, zScore } = require('../lib/statistics');

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
});
