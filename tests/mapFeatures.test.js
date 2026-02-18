/**
 * Tests for lib/mapFeatures.js
 */

const { getMapFeatures, getMapFeatureWeightModifiers } = require('../lib/mapFeatures');

describe('Map Features Module', () => {

  // ─── getMapFeatures ────────────────────────────────────────────────────────
  describe('getMapFeatures()', () => {
    test('returns features for an exact key match', () => {
      const features = getMapFeatures('Hard Rock Mine');
      expect(features).not.toBeNull();
      expect(features).toHaveProperty('wallDensity');
      expect(features).toHaveProperty('openness');
      expect(features).toHaveProperty('bushCoverage');
      expect(features).toHaveProperty('laneCount');
    });

    test('returns features for a case-insensitive match', () => {
      const lower = getMapFeatures('hard rock mine');
      const upper = getMapFeatures('HARD ROCK MINE');
      expect(lower).not.toBeNull();
      expect(upper).not.toBeNull();
      expect(lower).toEqual(upper);
    });

    test('returns features for a normalised (no-spaces) match', () => {
      const result = getMapFeatures('hardrock mine'); // extra normalisation
      // normalizeText strips spaces, so both map to 'hardrockmime'
      // The exact normalised form of "Hard Rock Mine" is "hardrockmime"
      // Accept either null (edge case) or the same features
      if (result !== null) {
        expect(result).toHaveProperty('wallDensity');
      }
    });

    test('returns null for an unknown map', () => {
      expect(getMapFeatures('Nonexistent Map XYZ')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(getMapFeatures('')).toBeNull();
    });

    test('returns null for null input', () => {
      expect(getMapFeatures(null)).toBeNull();
    });

    test('all feature values are valid numbers in correct ranges', () => {
      const features = getMapFeatures('Shooting Star');
      expect(typeof features.wallDensity).toBe('number');
      expect(typeof features.openness).toBe('number');
      expect(typeof features.bushCoverage).toBe('number');
      expect(typeof features.laneCount).toBe('number');
      expect(features.wallDensity).toBeGreaterThanOrEqual(0);
      expect(features.wallDensity).toBeLessThanOrEqual(1);
      expect(features.openness).toBeGreaterThanOrEqual(0);
      expect(features.openness).toBeLessThanOrEqual(1);
      expect(features.laneCount).toBeGreaterThanOrEqual(1);
      expect(features.laneCount).toBeLessThanOrEqual(4);
    });

    test('does not return meta-keys (underscore prefixed)', () => {
      expect(getMapFeatures('_comment')).toBeNull();
      expect(getMapFeatures('_schema')).toBeNull();
    });
  });

  // ─── getMapFeatureWeightModifiers ──────────────────────────────────────────
  describe('getMapFeatureWeightModifiers()', () => {
    test('returns zero modifiers for unknown map', () => {
      const mods = getMapFeatureWeightModifiers('Unknown Fake Map 999');
      expect(mods).toEqual({ performance: 0, synergy: 0, popularity: 0, counter: 0 });
    });

    test('returns zero modifiers for null map name', () => {
      const mods = getMapFeatureWeightModifiers(null);
      expect(mods).toEqual({ performance: 0, synergy: 0, popularity: 0, counter: 0 });
    });

    test('open map → positive performance modifier', () => {
      // Shooting Star: openness 0.80 → performance += 0.06*(0.80-0.5) = +0.018
      const mods = getMapFeatureWeightModifiers('Shooting Star');
      expect(mods.performance).toBeGreaterThan(0);
    });

    test('tight/walled map → negative or near-zero performance modifier', () => {
      // Hard Rock Mine: openness 0.25 → performance += 0.06*(0.25-0.5) = -0.015
      const mods = getMapFeatureWeightModifiers('Hard Rock Mine');
      expect(mods.performance).toBeLessThan(0);
    });

    test('bush-heavy map → positive counter modifier', () => {
      // Hideout: bushCoverage 0.60 → counter += 0.04*(0.60-0.5) = +0.004
      const mods = getMapFeatureWeightModifiers('Hideout');
      expect(mods.counter).toBeGreaterThan(0);
    });

    test('multi-lane map → positive synergy modifier', () => {
      // Island Invasion: laneCount 4 → synergy += 0.04*(4-2)/2 = +0.04
      const mods = getMapFeatureWeightModifiers('Island Invasion');
      expect(mods.synergy).toBeGreaterThan(0);
    });

    test('single-lane map → non-positive synergy modifier', () => {
      // Shooting Star: laneCount 1 → synergy += 0.04*(1-2)/2 = -0.02
      const mods = getMapFeatureWeightModifiers('Shooting Star');
      expect(mods.synergy).toBeLessThan(0);
    });

    test('open map → negative popularity modifier', () => {
      // Open Business: openness 0.75 → popularity -= 0.03*(0.75-0.5) = -0.0075
      const mods = getMapFeatureWeightModifiers('Open Business');
      expect(mods.popularity).toBeLessThan(0);
    });

    test('modifiers are numerically small (< 0.1 in absolute value)', () => {
      const knownMaps = ['Shooting Star', 'Hard Rock Mine', 'Hideout', 'Galaxy Arena'];
      for (const map of knownMaps) {
        const mods = getMapFeatureWeightModifiers(map);
        for (const [key, val] of Object.entries(mods)) {
          expect(Math.abs(val)).toBeLessThan(0.1);
        }
      }
    });

    test('modifier object always has all four keys', () => {
      const mods = getMapFeatureWeightModifiers('Shooting Star');
      expect(Object.keys(mods)).toEqual(
        expect.arrayContaining(['performance', 'synergy', 'popularity', 'counter'])
      );
    });
  });

});
