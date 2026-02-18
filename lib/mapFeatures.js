/**
 * Map Features Module
 *
 * Provides per-map terrain features that allow the ranking engine to fine-tune
 * component weights beyond what the game mode alone captures.
 *
 * Features (all per map, sourced from config/mapFeatures.json):
 *   wallDensity   [0-1]  High = many walls/obstacles; constrains sightlines
 *   openness      [0-1]  High = wide open areas; favours long-range throwers
 *   bushCoverage  [0-1]  High = lots of bush; rewards ambush/stealth picks
 *   laneCount     [1-4]  Distinct lanes; more lanes → more team coordination
 *
 * Weight modifiers are intentionally small (≤ ±3pp) to complement rather than
 * override mode-level and skill-tier adjustments that are already in place.
 *
 * Formula for each component:
 *   performance += 0.06 × (openness - 0.5)         // snipers shine in the open
 *   synergy     += 0.04 × ((laneCount - 2) / 2)    // multi-lane = more coordination
 *   counter     += 0.04 × (bushCoverage - 0.5)     // bush = more ambush counters
 *   popularity  -= 0.03 × (openness - 0.5)         // open = meta transparent
 */

const mapFeaturesData = require('../config/mapFeatures.json');
const { normalizeText } = require('./utils');

// Pre-build a normalised-key index once at load time for O(1) fuzzy lookup
const normalizedIndex = Object.fromEntries(
  Object.entries(mapFeaturesData)
    .filter(([k]) => !k.startsWith('_'))  // skip comment/_schema keys
    .map(([k, v]) => [normalizeText(k), v])
);

/**
 * Returns the terrain feature object for a map, or null if not found.
 *
 * Lookup order:
 *   1. Exact key match (string equality)
 *   2. Case-insensitive exact match
 *   3. Normalised match (lowercase, no spaces/hyphens/underscores)
 *
 * @param {string} mapName
 * @returns {{ wallDensity: number, openness: number, bushCoverage: number, laneCount: number } | null}
 */
function getMapFeatures(mapName) {
  if (!mapName) return null;

  // 1. Exact match
  if (mapFeaturesData[mapName] && !String(mapName).startsWith('_')) {
    return mapFeaturesData[mapName];
  }

  // 2. Case-insensitive
  const lc = mapName.toLowerCase();
  const ciKey = Object.keys(mapFeaturesData)
    .filter(k => !k.startsWith('_'))
    .find(k => k.toLowerCase() === lc);
  if (ciKey) return mapFeaturesData[ciKey];

  // 3. Normalised fallback (strips spaces, hyphens, underscores, apostrophes)
  const norm = normalizeText(mapName);
  return normalizedIndex[norm] || null;
}

/**
 * Converts map terrain features into additive weight modifiers for the ranking
 * engine's getEffectiveWeights() function.
 *
 * Returns all-zero modifiers for unknown maps so existing behaviour is
 * preserved exactly for unrecognised map names.
 *
 * @param {string} mapName
 * @returns {{ performance: number, synergy: number, popularity: number, counter: number }}
 */
function getMapFeatureWeightModifiers(mapName) {
  const zero = { performance: 0, synergy: 0, popularity: 0, counter: 0 };
  const features = getMapFeatures(mapName);
  if (!features) return zero;

  const {
    openness     = 0.5,
    bushCoverage = 0.5,
    laneCount    = 2
  } = features;

  return {
    performance:  0.06 * (openness - 0.5),
    synergy:      0.04 * ((laneCount - 2) / 2),
    counter:      0.04 * (bushCoverage - 0.5),
    popularity:  -0.03 * (openness - 0.5)
  };
}

module.exports = { getMapFeatures, getMapFeatureWeightModifiers };
