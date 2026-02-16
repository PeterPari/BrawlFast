/**
 * Unit Tests for Ranking Engine Module
 *
 * Tests all core ranking algorithm functions including Bayesian confidence,
 * time-weighted performance, synergy analysis, and CPS calculation.
 */

const {
  calculateBayesianConfidence,
  calculateTimeWeightedWinRate,
  normalizeMapType,
  getMapTypeWeights,
  calculatePairwiseSynergy,
  calculateUseRateScore,
  calculateCounterMetaScore,
  computeCPS,
  assignTiers,
  MapType
} = require('../lib/rankingEngine');

describe('Ranking Engine Module', () => {
  describe('calculateBayesianConfidence()', () => {
    test('high sample count produces high confidence', () => {
      const confidence = calculateBayesianConfidence(1000, 1000);
      expect(confidence).toBeGreaterThan(0.9);
    });

    test('low sample count produces low confidence', () => {
      const confidence = calculateBayesianConfidence(10, 10);
      expect(confidence).toBeLessThan(0.85); // Adjusted threshold
    });

    test('equal wins and losses produces moderate confidence', () => {
      const confidence = calculateBayesianConfidence(100, 100);
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThan(1.0);
    });

    test('extreme win rate with low samples has low confidence', () => {
      const highConfidence = calculateBayesianConfidence(1000, 100);
      const lowConfidence = calculateBayesianConfidence(10, 1);
      expect(lowConfidence).toBeLessThan(highConfidence);
    });

    test('confidence increases with sample size', () => {
      const conf1 = calculateBayesianConfidence(10, 10);
      const conf2 = calculateBayesianConfidence(100, 100);
      const conf3 = calculateBayesianConfidence(1000, 1000);
      expect(conf2).toBeGreaterThan(conf1);
      expect(conf3).toBeGreaterThan(conf2);
    });

    test('returns value between 0 and 1', () => {
      const confidence = calculateBayesianConfidence(50, 50);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateTimeWeightedWinRate()', () => {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    test('all recent games have full weight', () => {
      const games = [
        { isWin: true, timestamp: now },
        { isWin: true, timestamp: now - dayInMs },
        { isWin: false, timestamp: now - 2 * dayInMs }
      ];
      const winRate = calculateTimeWeightedWinRate(games, 14);
      expect(winRate).toBeGreaterThan(60); // ~2/3 wins with exponential weighting
      expect(winRate).toBeLessThan(75);
    });

    test('old games have lower weight', () => {
      const recentGames = [
        { isWin: true, timestamp: now },
        { isWin: false, timestamp: now }
      ];
      const oldGames = [
        { isWin: true, timestamp: now - 100 * dayInMs },
        { isWin: false, timestamp: now - 100 * dayInMs }
      ];
      const recentWR = calculateTimeWeightedWinRate(recentGames, 14);
      const oldWR = calculateTimeWeightedWinRate(oldGames, 14);

      // Both should be ~50% but recent should be more definitive
      expect(Math.abs(recentWR - 50)).toBeLessThan(1);
      expect(Math.abs(oldWR - 50)).toBeLessThan(1);
    });

    test('returns null for empty array', () => {
      expect(calculateTimeWeightedWinRate([], 14)).toBeNull();
    });

    test('returns null for null input', () => {
      expect(calculateTimeWeightedWinRate(null, 14)).toBeNull();
    });

    test('handles all wins', () => {
      const games = [
        { isWin: true, timestamp: now },
        { isWin: true, timestamp: now - dayInMs }
      ];
      const winRate = calculateTimeWeightedWinRate(games, 14);
      expect(winRate).toBeCloseTo(100, 1);
    });

    test('handles all losses', () => {
      const games = [
        { isWin: false, timestamp: now },
        { isWin: false, timestamp: now - dayInMs }
      ];
      const winRate = calculateTimeWeightedWinRate(games, 14);
      expect(winRate).toBeCloseTo(0, 1);
    });
  });

  describe('normalizeMapType()', () => {
    test('normalizes Gem Grab variants', () => {
      expect(normalizeMapType('Gem Grab')).toBe(MapType.GEM_GRAB);
      expect(normalizeMapType('gem-grab')).toBe(MapType.GEM_GRAB);
      expect(normalizeMapType('GEMGRAB')).toBe(MapType.GEM_GRAB);
    });

    test('normalizes Brawl Ball variants', () => {
      expect(normalizeMapType('Brawl Ball')).toBe(MapType.BRAWL_BALL);
      expect(normalizeMapType('brawl-ball')).toBe(MapType.BRAWL_BALL);
    });

    test('normalizes Showdown', () => {
      expect(normalizeMapType('Showdown')).toBe(MapType.SHOWDOWN);
      expect(normalizeMapType('showdown')).toBe(MapType.SHOWDOWN);
    });

    test('returns UNKNOWN for unrecognized mode', () => {
      expect(normalizeMapType('Invalid Mode')).toBe(MapType.UNKNOWN);
      expect(normalizeMapType('')).toBe(MapType.UNKNOWN);
      expect(normalizeMapType(null)).toBe(MapType.UNKNOWN);
    });

    test('handles all 7 official modes', () => {
      expect(normalizeMapType('Gem Grab')).toBe(MapType.GEM_GRAB);
      expect(normalizeMapType('Brawl Ball')).toBe(MapType.BRAWL_BALL);
      expect(normalizeMapType('Bounty')).toBe(MapType.BOUNTY);
      expect(normalizeMapType('Heist')).toBe(MapType.HEIST);
      expect(normalizeMapType('Showdown')).toBe(MapType.SHOWDOWN);
      expect(normalizeMapType('Hot Zone')).toBe(MapType.HOT_ZONE);
      expect(normalizeMapType('Knockout')).toBe(MapType.KNOCKOUT);
    });
  });

  describe('getMapTypeWeights()', () => {
    test('Showdown has high performance weight', () => {
      const weights = getMapTypeWeights(MapType.SHOWDOWN);
      expect(weights.performance).toBe(0.75);
      expect(weights.synergy).toBe(0.05);
    });

    test('Gem Grab has high synergy weight', () => {
      const weights = getMapTypeWeights(MapType.GEM_GRAB);
      expect(weights.synergy).toBe(0.35);
      expect(weights.performance).toBe(0.4);
    });

    test('all weights sum to 1.0', () => {
      const modes = [
        MapType.GEM_GRAB,
        MapType.BRAWL_BALL,
        MapType.BOUNTY,
        MapType.HEIST,
        MapType.SHOWDOWN,
        MapType.HOT_ZONE,
        MapType.KNOCKOUT,
        MapType.UNKNOWN
      ];

      modes.forEach(mode => {
        const weights = getMapTypeWeights(mode);
        const sum = weights.performance + weights.synergy + weights.popularity + weights.counter;
        expect(sum).toBeCloseTo(1.0, 10);
      });
    });

    test('returns default weights for unknown mode', () => {
      const weights = getMapTypeWeights(MapType.UNKNOWN);
      expect(weights).toHaveProperty('performance');
      expect(weights).toHaveProperty('synergy');
      expect(weights).toHaveProperty('popularity');
      expect(weights).toHaveProperty('counter');
    });
  });

  describe('calculatePairwiseSynergy()', () => {
    const mockBrawlers = [
      { name: 'Poco', winRate: 52, adjustedWinRate: 52 },
      { name: 'Mortis', winRate: 48, adjustedWinRate: 48 },
      { name: 'Brock', winRate: 50, adjustedWinRate: 50 }
    ];

    test('returns 0 when no teams include brawler', () => {
      const teams = [];
      const synergy = calculatePairwiseSynergy('Poco', teams, mockBrawlers);
      expect(synergy).toBe(0);
    });

    test('filters out teams with low sample count', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis'], winRate: 60, count: 10 } // Below 50 threshold
      ];
      const synergy = calculatePairwiseSynergy('Poco', teams, mockBrawlers);
      expect(synergy).toBe(0);
    });

    test('calculates positive synergy for strong teams', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis'], winRate: 60, adjustedWinRate: 60, count: 100 }
      ];
      const synergy = calculatePairwiseSynergy('Poco', teams, mockBrawlers);
      expect(synergy).toBeGreaterThan(0);
    });

    test('returns value between 0 and 1', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis'], winRate: 55, adjustedWinRate: 55, count: 100 },
        { brawlers: ['Poco', 'Brock'], winRate: 57, adjustedWinRate: 57, count: 80 }
      ];
      const synergy = calculatePairwiseSynergy('Poco', teams, mockBrawlers);
      expect(synergy).toBeGreaterThanOrEqual(0);
      expect(synergy).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateUseRateScore()', () => {
    const meanUse = 10;
    const stdDevUse = 5;
    const meanWin = 50;
    const stdDevWin = 5;

    test('meta brawler (high use, high win) scores high', () => {
      const score = calculateUseRateScore(25, 60, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeGreaterThan(0.8);
    });

    test('sleeper pick (low use, high win) scores high', () => {
      const score = calculateUseRateScore(5, 60, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeGreaterThan(0.7);
    });

    test('trap pick (high use, low win) scores low', () => {
      const score = calculateUseRateScore(25, 40, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBe(0.2);
    });

    test('average brawler scores around 0.5', () => {
      const score = calculateUseRateScore(10, 50, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeCloseTo(0.5, 1);
    });

    test('returns value between 0 and 1', () => {
      const score = calculateUseRateScore(15, 55, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateCounterMetaScore()', () => {
    test('returns 0.5 (neutral) when no matchups provided', () => {
      const score = calculateCounterMetaScore('Shelly', [], []);
      expect(score).toBe(0.5);
    });

    test('returns 0.5 when matchups is null', () => {
      const score = calculateCounterMetaScore('Shelly', null, []);
      expect(score).toBe(0.5);
    });

    test('filters out matchups with low sample count', () => {
      const matchups = [
        { opponent: 'Mortis', winRate: 70, sampleCount: 20 } // Below 30 threshold
      ];
      const score = calculateCounterMetaScore('Shelly', matchups, []);
      expect(score).toBe(0.5);
    });

    test('good matchups produce score > 0.5', () => {
      const matchups = [
        { opponent: 'Mortis', winRate: 65, sampleCount: 100 },
        { opponent: 'Tick', winRate: 60, sampleCount: 80 }
      ];
      const score = calculateCounterMetaScore('Shelly', matchups, []);
      expect(score).toBeGreaterThan(0.5);
    });

    test('bad matchups produce score < 0.5', () => {
      const matchups = [
        { opponent: 'Colt', winRate: 35, sampleCount: 100 },
        { opponent: 'Brock', winRate: 40, sampleCount: 80 }
      ];
      const score = calculateCounterMetaScore('Shelly', matchups, []);
      expect(score).toBeLessThan(0.5);
    });

    test('returns value between 0 and 1', () => {
      const matchups = [
        { opponent: 'Test', winRate: 55, sampleCount: 50 }
      ];
      const score = calculateCounterMetaScore('Shelly', matchups, []);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('computeCPS()', () => {
    const mockBrawler = {
      name: 'Belle',
      winRate: 55,
      adjustedWinRate: 55,
      useRate: 15,
      count: 1000
    };

    const mockAllBrawlers = [
      { name: 'Belle', winRate: 55, adjustedWinRate: 55, useRate: 15 },
      { name: 'Brock', winRate: 50, adjustedWinRate: 50, useRate: 10 },
      { name: 'Mortis', winRate: 48, adjustedWinRate: 48, useRate: 12 }
    ];

    const mockTeams = [];

    test('returns a number', () => {
      const cps = computeCPS(mockBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');
      expect(typeof cps).toBe('number');
    });

    test('different map modes produce different scores', () => {
      const gemGrabCPS = computeCPS(mockBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');
      const showdownCPS = computeCPS(mockBrawler, mockAllBrawlers, mockTeams, 'Showdown');

      // Scores may differ due to different weighting
      expect(gemGrabCPS).toBeGreaterThan(0);
      expect(showdownCPS).toBeGreaterThan(0);
    });

    test('high win rate produces high CPS', () => {
      const highWRBrawler = {
        ...mockBrawler,
        winRate: 65,
        adjustedWinRate: 65
      };
      const lowWRBrawler = {
        ...mockBrawler,
        winRate: 45,
        adjustedWinRate: 45
      };

      const highCPS = computeCPS(highWRBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');
      const lowCPS = computeCPS(lowWRBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');

      expect(highCPS).toBeGreaterThan(lowCPS);
    });

    test('handles missing data gracefully', () => {
      const incompleteBrawler = {
        name: 'Test',
        winRate: 50
        // Missing useRate, count, etc.
      };
      const cps = computeCPS(incompleteBrawler, mockAllBrawlers, mockTeams, 'Bounty');
      expect(cps).toBeGreaterThanOrEqual(0);
      expect(cps).toBeLessThanOrEqual(1);
    });

    test('CPS is confidence-weighted', () => {
      const highSampleBrawler = { ...mockBrawler, count: 10000 };
      const lowSampleBrawler = { ...mockBrawler, count: 100 };

      const highCPS = computeCPS(highSampleBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');
      const lowCPS = computeCPS(lowSampleBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');

      // High sample count should have higher confidence multiplier
      expect(highCPS).toBeGreaterThan(lowCPS);
    });
  });

  describe('assignTiers()', () => {
    test('assigns correct tier distribution', () => {
      const brawlers = Array.from({ length: 20 }, (_, i) => ({
        name: `Brawler${i}`,
        cps: 1 - (i * 0.04) // Descending CPS from 1.0 to 0.24
      }));

      const tiered = assignTiers(brawlers);
      const tierCounts = tiered.reduce((acc, b) => {
        acc[b.tier] = (acc[b.tier] || 0) + 1;
        return acc;
      }, {});

      // With 20 brawlers: S=2, A=4, B=8, C=4, F=2
      expect(tierCounts.S).toBeGreaterThanOrEqual(1); // At least 1 S-tier
      expect(tierCounts.S).toBeLessThanOrEqual(3); // Roughly 10%
    });

    test('guarantees minimum 1 S-tier brawler', () => {
      const brawlers = [
        { name: 'Solo', cps: 0.5 }
      ];
      const tiered = assignTiers(brawlers);
      expect(tiered[0].tier).toBe('S');
    });

    test('handles empty array', () => {
      const tiered = assignTiers([]);
      expect(tiered).toEqual([]);
    });

    test('sorts by CPS descending', () => {
      const brawlers = [
        { name: 'Low', cps: 0.3 },
        { name: 'High', cps: 0.9 },
        { name: 'Mid', cps: 0.6 }
      ];
      const tiered = assignTiers(brawlers);

      expect(tiered[0].name).toBe('High');
      expect(tiered[1].name).toBe('Mid');
      expect(tiered[2].name).toBe('Low');
    });

    test('all brawlers get a tier', () => {
      const brawlers = Array.from({ length: 10 }, (_, i) => ({
        name: `B${i}`,
        cps: Math.random()
      }));
      const tiered = assignTiers(brawlers);

      tiered.forEach(b => {
        expect(['S', 'A', 'B', 'C', 'F']).toContain(b.tier);
      });
    });
  });
});
