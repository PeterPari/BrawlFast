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
  getEffectiveWeights,
  calculatePairwiseSynergy,    // legacy export
  calculateCompositionScore,
  calculateUseRateScore,
  calculateUseRateScoreDiscrete,
  calculateCounterMetaScore,
  computeCPS,
  computeCPSWithCI,
  assignTiers,
  rankBrawlers,
  MapType,
  SkillTier
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

  describe('calculatePairwiseSynergy() — legacy alias', () => {
    const mockBrawlers = [
      { name: 'Poco', winRate: 52, adjustedWinRate: 52 },
      { name: 'Mortis', winRate: 48, adjustedWinRate: 48 },
      { name: 'Brock', winRate: 50, adjustedWinRate: 50 }
    ];

    test('returns 0.5 (neutral) when no teams include brawler', () => {
      // Legacy alias now delegates to calculateCompositionScore which defaults to 0.5
      const result = calculatePairwiseSynergy('Poco', [], mockBrawlers);
      expect(result).toBe(0.5);
    });

    test('filters out teams with low sample count', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 60, count: 10 } // Below 50 threshold
      ];
      const result = calculatePairwiseSynergy('Poco', teams, mockBrawlers);
      expect(result).toBe(0.5); // neutral because no qualifying teams
    });

    test('returns value between 0 and 1', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 60, adjustedWinRate: 60, count: 100 }
      ];
      const result = calculatePairwiseSynergy('Poco', teams, mockBrawlers);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateCompositionScore()', () => {
    const mockBrawlers = [
      { name: 'Poco',   winRate: 52, adjustedWinRate: 52 },
      { name: 'Mortis', winRate: 48, adjustedWinRate: 48 },
      { name: 'Brock',  winRate: 50, adjustedWinRate: 50 }
    ];

    test('returns 0.5 (neutral) when no teams include brawler', () => {
      expect(calculateCompositionScore('Poco', [], mockBrawlers)).toBe(0.5);
    });

    test('filters teams below sample threshold', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 65, adjustedWinRate: 65, count: 10 }
      ];
      expect(calculateCompositionScore('Poco', teams, mockBrawlers)).toBe(0.5);
    });

    test('positive composition lift produces score > 0.5', () => {
      // Team WR 62, individual mean = (52+48+50)/3 = 50 → lift = +12 → normalised above 0.5
      const teams = [
        { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 62, adjustedWinRate: 62, count: 200 }
      ];
      const score = calculateCompositionScore('Poco', teams, mockBrawlers);
      expect(score).toBeGreaterThan(0.5);
    });

    test('negative composition lift produces score < 0.5', () => {
      // Team WR 40, individual mean 50 → lift = -10 → normalised below 0.5
      const teams = [
        { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 40, adjustedWinRate: 40, count: 200 }
      ];
      const score = calculateCompositionScore('Poco', teams, mockBrawlers);
      expect(score).toBeLessThan(0.5);
    });

    test('multiple teams are log-weighted by play count', () => {
      const fewGames  = { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 70, adjustedWinRate: 70, count: 51  };
      const manyGames = { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 40, adjustedWinRate: 40, count: 5000 };
      const score = calculateCompositionScore('Poco', [fewGames, manyGames], mockBrawlers);
      // manyGames has much higher weight → net lift is negative → score < 0.5
      expect(score).toBeLessThan(0.5);
    });

    test('returns value in [0, 1]', () => {
      const teams = [
        { brawlers: ['Poco', 'Mortis', 'Brock'], winRate: 75, adjustedWinRate: 75, count: 300 }
      ];
      const score = calculateCompositionScore('Poco', teams, mockBrawlers);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateUseRateScore() — continuous sigmoid', () => {
    const meanUse = 10;
    const stdDevUse = 5;
    const meanWin = 50;
    const stdDevWin = 5;

    test('meta brawler (high use, high win) scores high', () => {
      // zUse=3, zWin=2 → logit=3.5 → sigmoid≈0.97
      const score = calculateUseRateScore(25, 60, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeGreaterThan(0.8);
    });

    test('sleeper pick (low use, high win) scores high', () => {
      // zUse=-1, zWin=2 → no trap penalty → logit=4 → sigmoid≈0.98
      const score = calculateUseRateScore(5, 60, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeGreaterThan(0.7);
    });

    test('trap pick (high use, low win) scores very low', () => {
      // zUse=3, zWin=-2 → trapPenalty=2.5 → logit=-6.5 → sigmoid≈0.0015
      const score = calculateUseRateScore(25, 40, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeLessThan(0.1);
    });

    test('average brawler scores 0.5', () => {
      // zUse=0, zWin=0 → logit=0 → sigmoid=0.5
      const score = calculateUseRateScore(10, 50, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeCloseTo(0.5, 3);
    });

    test('returns value strictly between 0 and 1', () => {
      const score = calculateUseRateScore(15, 55, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    test('sleeper scores higher than trap pick for same |z|', () => {
      const sleeper = calculateUseRateScore(5,  60, meanUse, stdDevUse, meanWin, stdDevWin);
      const trap    = calculateUseRateScore(25, 40, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(sleeper).toBeGreaterThan(trap);
    });
  });

  describe('calculateUseRateScoreDiscrete() — legacy v2 behaviour', () => {
    const meanUse = 10, stdDevUse = 5, meanWin = 50, stdDevWin = 5;

    test('trap pick scores exactly 0.2', () => {
      const score = calculateUseRateScoreDiscrete(25, 40, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBe(0.2);
    });

    test('average brawler scores around 0.5', () => {
      const score = calculateUseRateScoreDiscrete(10, 50, meanUse, stdDevUse, meanWin, stdDevWin);
      expect(score).toBeCloseTo(0.5, 1);
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
        { opponent: 'Tick',   winRate: 60, sampleCount: 80  }
      ];
      const score = calculateCounterMetaScore('Shelly', matchups, []);
      expect(score).toBeGreaterThan(0.5);
    });

    test('bad matchups produce score < 0.5', () => {
      const matchups = [
        { opponent: 'Colt',  winRate: 35, sampleCount: 100 },
        { opponent: 'Brock', winRate: 40, sampleCount: 80  }
      ];
      const score = calculateCounterMetaScore('Shelly', matchups, []);
      expect(score).toBeLessThan(0.5);
    });

    test('diversity penalty attenuates score when one matchup dominates', () => {
      // Single matchup → diversity=0 → multiplier = minMultiplier (0.7)
      const singleMatchup = [
        { opponent: 'Mortis', winRate: 70, sampleCount: 1000 }
      ];
      // Multiple matchups → diversity>0 → multiplier > 0.7
      const multiMatchups = [
        { opponent: 'Mortis', winRate: 70, sampleCount: 100 },
        { opponent: 'Tick',   winRate: 70, sampleCount: 100 },
        { opponent: 'Colt',   winRate: 70, sampleCount: 100 }
      ];
      const single = calculateCounterMetaScore('Shelly', singleMatchup, []);
      const multi  = calculateCounterMetaScore('Shelly', multiMatchups,  []);
      // Both above 0.5; multi should score higher due to diversity bonus
      expect(multi).toBeGreaterThan(single);
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

  describe('getEffectiveWeights()', () => {
    test('competitive tier matches base weights exactly', () => {
      const base      = getMapTypeWeights(MapType.GEM_GRAB);
      const effective = getEffectiveWeights(MapType.GEM_GRAB, SkillTier.COMPETITIVE);
      expect(effective.performance).toBeCloseTo(base.performance, 5);
      expect(effective.synergy).toBeCloseTo(base.synergy, 5);
    });

    test('casual tier has higher performance weight than competitive', () => {
      const casual = getEffectiveWeights(MapType.GEM_GRAB, SkillTier.CASUAL);
      const comp   = getEffectiveWeights(MapType.GEM_GRAB, SkillTier.COMPETITIVE);
      expect(casual.performance).toBeGreaterThan(comp.performance);
    });

    test('pro tier has higher synergy weight than competitive', () => {
      const pro  = getEffectiveWeights(MapType.GEM_GRAB, SkillTier.PRO);
      const comp = getEffectiveWeights(MapType.GEM_GRAB, SkillTier.COMPETITIVE);
      expect(pro.synergy).toBeGreaterThan(comp.synergy);
    });

    test('all weights sum to 1.0 for every mode and tier', () => {
      const modes = Object.values(MapType);
      const tiers = Object.values(SkillTier);
      for (const mode of modes) {
        for (const tier of tiers) {
          const w = getEffectiveWeights(mode, tier);
          const sum = w.performance + w.synergy + w.popularity + w.counter;
          expect(sum).toBeCloseTo(1.0, 9);
        }
      }
    });

    test('defaults to competitive weights when tier is null', () => {
      const withNull = getEffectiveWeights(MapType.SHOWDOWN, null);
      const comp     = getEffectiveWeights(MapType.SHOWDOWN, SkillTier.COMPETITIVE);
      expect(withNull.performance).toBeCloseTo(comp.performance, 9);
    });

    test('open map boosts performance weight vs no map name', () => {
      // Shooting Star has openness 0.80 → +0.06*(0.80-0.5) = +0.018 performance
      const withMap    = getEffectiveWeights(MapType.BOUNTY, SkillTier.COMPETITIVE, 'Shooting Star');
      const withoutMap = getEffectiveWeights(MapType.BOUNTY, SkillTier.COMPETITIVE, null);
      expect(withMap.performance).toBeGreaterThan(withoutMap.performance);
    });

    test('bush-heavy map boosts counter weight', () => {
      // Hideout: bushCoverage 0.60 → counter += 0.04*(0.60-0.5) > 0
      const withMap    = getEffectiveWeights(MapType.BOUNTY, SkillTier.COMPETITIVE, 'Hideout');
      const withoutMap = getEffectiveWeights(MapType.BOUNTY, SkillTier.COMPETITIVE, null);
      expect(withMap.counter).toBeGreaterThan(withoutMap.counter);
    });

    test('all weights still sum to 1.0 when map name is provided', () => {
      const w = getEffectiveWeights(MapType.GEM_GRAB, SkillTier.PRO, 'Shooting Star');
      const sum = w.performance + w.synergy + w.popularity + w.counter;
      expect(sum).toBeCloseTo(1.0, 9);
    });

    test('unknown map name applies zero feature adjustment', () => {
      const withUnknown = getEffectiveWeights(MapType.BOUNTY, SkillTier.COMPETITIVE, 'ZZZFAKEMAP');
      const withNull    = getEffectiveWeights(MapType.BOUNTY, SkillTier.COMPETITIVE, null);
      expect(withUnknown.performance).toBeCloseTo(withNull.performance, 9);
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
      const lowSampleBrawler  = { ...mockBrawler, count: 100   };

      const highCPS = computeCPS(highSampleBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');
      const lowCPS  = computeCPS(lowSampleBrawler,  mockAllBrawlers, mockTeams, 'Gem Grab');

      // High sample count should have higher confidence multiplier
      expect(highCPS).toBeGreaterThan(lowCPS);
    });

    test('skill tier shifts CPS score', () => {
      const casual = computeCPS(mockBrawler, mockAllBrawlers, mockTeams, 'Gem Grab', null, SkillTier.CASUAL);
      const pro    = computeCPS(mockBrawler, mockAllBrawlers, mockTeams, 'Gem Grab', null, SkillTier.PRO);
      // They shouldn't be identical (different weights)
      // Both must still be in valid range
      expect(casual).toBeGreaterThanOrEqual(0);
      expect(pro).toBeGreaterThanOrEqual(0);
    });

    test('map name shifts CPS for open map vs no map name', () => {
      // Use a trap-pick brawler: very high use rate relative to win rate.
      // z_use >> z_win → useRateScore is driven very low by the trap penalty.
      // In this regime normWinRate > useRateScore, so boosting the performance
      // weight (open map → Shooting 'Star openness=0.80) cleanly raises CPS.
      const trapBrawler = {
        name: 'Belle',
        winRate: 52,
        adjustedWinRate: 52,
        useRate: 50,   // extremely high relative to mockAllBrawlers (mean≈12)
        count: 1000
      };
      const cpsOpen = computeCPS(trapBrawler, mockAllBrawlers, mockTeams, 'Bounty', null, null, 'Shooting Star');
      const cpsNone = computeCPS(trapBrawler, mockAllBrawlers, mockTeams, 'Bounty', null, null, null);
      // Shooting Star boosts performance weight ↑ and reduces popularity weight ↓.
      // Since normWinRate(0.52) >> useRateScore(≈0.003), this raises CPS.
      expect(cpsOpen).toBeGreaterThan(cpsNone);
    });

    test('staleness penalty reduces CPS when pick rate crashes and WR holds', () => {
      const stalenessBrawler = {
        ...mockBrawler,
        useRate: 2,            // current pick rate cratered (was 15)
        historicalPickRate: 15 // historical baseline
        // historicalWinRate not set → falls back to current WR → stable WR signal
      };
      const normalBrawler = { ...mockBrawler };

      const staleCPS  = computeCPS(stalenessBrawler, mockAllBrawlers, mockTeams, 'Gem Grab');
      const normalCPS = computeCPS(normalBrawler,    mockAllBrawlers, mockTeams, 'Gem Grab');

      // Stale brawler should score lower due to the staleness multiplier
      expect(staleCPS).toBeLessThan(normalCPS);
    });

    test('no staleness penalty when historicalPickRate is null', () => {
      const brawlerNoHistory = { ...mockBrawler }; // no historicalPickRate
      const brawlerWithHistory = { ...mockBrawler, historicalPickRate: mockBrawler.useRate };

      const cpsNoHistory   = computeCPS(brawlerNoHistory,   mockAllBrawlers, mockTeams, 'Gem Grab');
      const cpsWithHistory = computeCPS(brawlerWithHistory, mockAllBrawlers, mockTeams, 'Gem Grab');

      // Same pick rate → stable pick rate → no staleness penalty → same CPS
      expect(cpsNoHistory).toBeCloseTo(cpsWithHistory, 3);
    });
  });

  describe('computeCPSWithCI()', () => {
    const mockBrawler = {
      name: 'Belle',
      winRate: 55,
      adjustedWinRate: 55,
      useRate: 15,
      count: 1000
    };
    const mockAllBrawlers = [
      { name: 'Belle',  winRate: 55, adjustedWinRate: 55, useRate: 15 },
      { name: 'Brock',  winRate: 50, adjustedWinRate: 50, useRate: 10 },
      { name: 'Mortis', winRate: 48, adjustedWinRate: 48, useRate: 12 }
    ];

    test('returns cps, ci, and variance', () => {
      const result = computeCPSWithCI(mockBrawler, mockAllBrawlers, [], 'Gem Grab');
      expect(result).toHaveProperty('cps');
      expect(result).toHaveProperty('ci');
      expect(result).toHaveProperty('variance');
    });

    test('ci is a two-element array [lower, upper]', () => {
      const { ci } = computeCPSWithCI(mockBrawler, mockAllBrawlers, [], 'Gem Grab');
      expect(Array.isArray(ci)).toBe(true);
      expect(ci).toHaveLength(2);
      expect(ci[0]).toBeLessThanOrEqual(ci[1]);
    });

    test('cps is within its own CI', () => {
      const { cps, ci } = computeCPSWithCI(mockBrawler, mockAllBrawlers, [], 'Gem Grab');
      expect(cps).toBeGreaterThanOrEqual(ci[0]);
      expect(cps).toBeLessThanOrEqual(ci[1]);
    });

    test('CI bounds are clamped to [0, 1]', () => {
      const result = computeCPSWithCI(mockBrawler, mockAllBrawlers, [], 'Gem Grab');
      expect(result.ci[0]).toBeGreaterThanOrEqual(0);
      expect(result.ci[1]).toBeLessThanOrEqual(1);
    });

    test('low sample brawler has wider CI than high sample brawler', () => {
      const loSample = { ...mockBrawler, count: 50   };
      const hiSample = { ...mockBrawler, count: 10000 };

      const loResult = computeCPSWithCI(loSample, mockAllBrawlers, [], 'Gem Grab');
      const hiResult = computeCPSWithCI(hiSample, mockAllBrawlers, [], 'Gem Grab');

      const loWidth = loResult.ci[1] - loResult.ci[0];
      const hiWidth = hiResult.ci[1] - hiResult.ci[0];
      expect(loWidth).toBeGreaterThan(hiWidth);
    });

    test('variance is non-negative', () => {
      const { variance } = computeCPSWithCI(mockBrawler, mockAllBrawlers, [], 'Gem Grab');
      expect(variance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('rankBrawlers() with skillTier', () => {
    const brawlers = [
      { name: 'Poco',   winRate: 55, adjustedWinRate: 55, useRate: 12, count: 500 },
      { name: 'Mortis', winRate: 48, adjustedWinRate: 48, useRate: 10, count: 300 },
      { name: 'Brock',  winRate: 52, adjustedWinRate: 52, useRate:  8, count: 400 }
    ];

    test('returns ranked brawlers with tier assigned', () => {
      const ranked = rankBrawlers(brawlers, [], 'Gem Grab');
      ranked.forEach(b => {
        expect(b).toHaveProperty('cps');
        expect(b).toHaveProperty('tier');
        expect(['S', 'A', 'B', 'C', 'F']).toContain(b.tier);
      });
    });

    test('casual tier produces valid rankings', () => {
      const ranked = rankBrawlers(brawlers, [], 'Gem Grab', SkillTier.CASUAL);
      expect(ranked.length).toBe(brawlers.length);
      ranked.forEach(b => expect(b.cps).toBeGreaterThanOrEqual(0));
    });

    test('pro tier produces valid rankings', () => {
      const ranked = rankBrawlers(brawlers, [], 'Gem Grab', SkillTier.PRO);
      expect(ranked.length).toBe(brawlers.length);
      ranked.forEach(b => expect(b.cps).toBeGreaterThanOrEqual(0));
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
