/**
 * Unit Tests for Changepoint Detection Module
 *
 * Tests detectChangepoint() and computeStaleness() for correct statistical
 * behaviour, edge cases, and graceful degradation when data is absent.
 */

const { detectChangepoint, computeStaleness } = require('../lib/changepoint');

// Convenience helper: generate N games, ratio of which are wins, timestamped
// daysAgo days in the past.
function makeGames(n, winRatio, daysAgo = 0) {
  const ts = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  return Array.from({ length: n }, (_, i) => ({
    isWin: i < Math.round(n * winRatio),
    timestamp: ts
  }));
}

// Config with changepoint enabled for testing
const enabledCfg = {
  enabled: true,
  threshold: 2.5,
  recentWindowDays: 3,
  minRecentGames: 30,
  minHalfLife: 2
};

const disabledCfg = { ...enabledCfg, enabled: false };

describe('Changepoint Detection Module', () => {
  describe('detectChangepoint()', () => {
    describe('feature flag disabled', () => {
      test('returns no changepoint when disabled', () => {
        const games = makeGames(100, 0.8, 0); // strong recent shift but disabled
        const result = detectChangepoint(games, 14, disabledCfg);
        expect(result.isChangepoint).toBe(false);
        expect(result.effectiveHalfLife).toBe(14);
        expect(result.zShift).toBe(0);
      });

      test('returns no changepoint when config is null/undefined', () => {
        const games = makeGames(100, 1.0, 0);
        const result = detectChangepoint(games, 14, null);
        expect(result.isChangepoint).toBe(false);
      });
    });

    describe('input validation', () => {
      test('returns no changepoint for empty games array', () => {
        const result = detectChangepoint([], 14, enabledCfg);
        expect(result.isChangepoint).toBe(false);
        expect(result.effectiveHalfLife).toBe(14);
        expect(result.zShift).toBe(0);
      });

      test('returns no changepoint for null games', () => {
        const result = detectChangepoint(null, 14, enabledCfg);
        expect(result.isChangepoint).toBe(false);
      });

      test('returns no changepoint when fewer games than minRecentGames', () => {
        const games = makeGames(20, 0.9, 0); // only 20, threshold is 30
        const result = detectChangepoint(games, 14, enabledCfg);
        expect(result.isChangepoint).toBe(false);
      });
    });

    describe('detection logic', () => {
      test('detects changepoint when recent win rate differs sharply from history', () => {
        // History (1-14 days ago): 50% WR  →  large sample, stable
        const historicalGames = makeGames(200, 0.50, 10);
        // Recent (0-3 days): 95% WR  →  huge shift
        const recentGames = makeGames(80, 0.95, 0);
        const games = [...historicalGames, ...recentGames];

        const result = detectChangepoint(games, 14, enabledCfg);
        expect(result.isChangepoint).toBe(true);
        expect(result.zShift).toBeGreaterThan(enabledCfg.threshold);
      });

      test('does not detect changepoint when recent rate is similar to history', () => {
        // History: 55%  →  Recent: 57%  (not significant)
        const historicalGames = makeGames(200, 0.55, 10);
        const recentGames     = makeGames(50,  0.57, 0);
        const games = [...historicalGames, ...recentGames];

        const result = detectChangepoint(games, 14, enabledCfg);
        expect(result.isChangepoint).toBe(false);
      });

      test('effective half-life shrinks proportionally to shift magnitude', () => {
        const historical = makeGames(200, 0.50, 10);
        const recent     = makeGames(200, 1.00, 0);  // 100% WR recently
        const games = [...historical, ...recent];

        const result = detectChangepoint(games, 14, enabledCfg);
        expect(result.isChangepoint).toBe(true);
        expect(result.effectiveHalfLife).toBeLessThan(14);
        expect(result.effectiveHalfLife).toBeGreaterThanOrEqual(enabledCfg.minHalfLife);
      });

      test('effective half-life never goes below minHalfLife', () => {
        // Extreme shift: should still respect the floor
        const historical = makeGames(500, 0.50, 10);
        const recent     = makeGames(500, 1.00, 0);
        const games = [...historical, ...recent];

        const result = detectChangepoint(games, 14, enabledCfg);
        expect(result.effectiveHalfLife).toBeGreaterThanOrEqual(enabledCfg.minHalfLife);
      });

      test('zShift is non-negative', () => {
        const games = [
          ...makeGames(200, 0.50, 8),
          ...makeGames(50,  0.30, 0)
        ];
        const result = detectChangepoint(games, 14, enabledCfg);
        expect(result.zShift).toBeGreaterThanOrEqual(0);
      });
    });

    describe('return shape', () => {
      test('always returns { isChangepoint, effectiveHalfLife, zShift }', () => {
        const result = detectChangepoint([], 14, enabledCfg);
        expect(result).toHaveProperty('isChangepoint');
        expect(result).toHaveProperty('effectiveHalfLife');
        expect(result).toHaveProperty('zShift');
      });

      test('effectiveHalfLife defaults to the supplied halfLifeDays when no changepoint', () => {
        const games = makeGames(100, 0.52, 0);
        const result = detectChangepoint(games, 21, enabledCfg);
        if (!result.isChangepoint) {
          expect(result.effectiveHalfLife).toBe(21);
        }
      });
    });
  });

  describe('computeStaleness()', () => {
    test('returns 1.0 when no pick-rate drop', () => {
      // pick rate stable: 10 → 10
      expect(computeStaleness(10, 10, 50, 50)).toBe(1.0);
    });

    test('returns 1.0 when historicalPickRate is 0', () => {
      expect(computeStaleness(5, 0, 50, 50)).toBe(1.0);
    });

    test('returns 1.0 when win rate also shifted (not a shadow nerf)', () => {
      // 50% pick-rate drop but win rate also dropped 10pp → not stale pattern
      expect(computeStaleness(5, 10, 40, 50)).toBe(1.0);
    });

    test('applies penalty when pick rate drops sharply and win rate is stable', () => {
      // 70% pick-rate drop with stable WR → staleness < 1
      const multiplier = computeStaleness(3, 10, 51, 50);
      expect(multiplier).toBeLessThan(1.0);
    });

    test('penalty multiplier is at least (1 - maxPenalty)', () => {
      // Extreme drop: 100% → staleness floor = 0.5
      const multiplier = computeStaleness(0, 100, 50, 50);
      expect(multiplier).toBeGreaterThanOrEqual(0.5);
    });

    test('staleness multiplier is at most 1.0', () => {
      const multiplier = computeStaleness(5, 10, 50, 50);
      expect(multiplier).toBeLessThanOrEqual(1.0);
    });

    test('moderate drop produces proportional penalty', () => {
      // 40% drop: penalty = 1 + 0.5*(-0.4) = 0.8
      const multiplier = computeStaleness(6, 10, 50.5, 50);
      expect(multiplier).toBeCloseTo(0.8, 2);
    });

    test('accepts optional config override', () => {
      const strictCfg = {
        pickRateDropThreshold: -0.1,   // stricter: 10% drop triggers penalty
        winRateStabilityThreshold: 5,  // generous: allows 5pp WR shift
        maxPenalty: 0.3
      };
      const multiplier = computeStaleness(8, 10, 50, 50, strictCfg);
      // 20% drop > 10% threshold, WR shift 0 < 5 → penalty applied
      expect(multiplier).toBeLessThan(1.0);
      expect(multiplier).toBeGreaterThanOrEqual(0.7); // 1 - 0.3 floor
    });
  });
});
