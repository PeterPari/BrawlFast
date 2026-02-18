/**
 * Pick-Rate Snapshot Manager
 *
 * Persists periodic pick-rate samples to disk so the staleness detector
 * (`computeStaleness`) can compare the current pick rate against a historical
 * baseline without requiring an external time-series database.
 *
 * On-disk layout (data/pickRateSnapshots.json):
 * {
 *   "<mapId>": [
 *     {
 *       "timestamp": 1739234400000,
 *       "brawlers": { "Shelly": 12.5, "Colt": 8.3, ... }
 *     },
 *     ...
 *   ]
 * }
 *
 * Only the last MAX_SNAPSHOTS_PER_MAP snapshots are kept per map so the file
 * stays bounded (≈ 12 days at the default 6-hour server refresh cadence).
 *
 * The module uses synchronous FS operations intentionally — snapshots are
 * written infrequently and outside the request path, so blocking briefly is
 * acceptable and simpler than async with error-prone race conditions.
 */

const fs   = require('fs');
const path = require('path');

const SNAPSHOT_FILE         = path.join(__dirname, '..', 'data', 'pickRateSnapshots.json');
const MAX_SNAPSHOTS_PER_MAP = 48; // ≈ 12 days at 6-hour cadence

/**
 * Loads the full snapshot store from disk.
 * Returns {} when the file doesn't exist or cannot be parsed.
 *
 * @returns {Object}
 */
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}

/**
 * Persists the in-memory store back to disk.
 * Creates the data/ directory if it doesn't exist yet.
 *
 * @param {Object} store
 */
function persistStore(store) {
  const dir = path.dirname(SNAPSHOT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(store, null, 2), 'utf8');
}

/**
 * Saves a snapshot of current pick rates for a single map.
 *
 * Call this after every successful fresh API fetch so the store always
 * reflects the latest known pick rates.  If all brawlers have null useRate,
 * the snapshot is skipped.
 *
 * @param {number|string} mapId
 * @param {Array<{name: string, useRate: number|null}>} brawlers - Ranked brawler list
 */
function saveSnapshot(mapId, brawlers) {
  const key = String(mapId);

  const pickRates = {};
  for (const b of brawlers) {
    if (b.name && b.useRate != null) {
      pickRates[b.name] = b.useRate;
    }
  }

  // Skip write when there's nothing useful to save
  if (Object.keys(pickRates).length === 0) return;

  const store = loadStore();
  if (!store[key]) store[key] = [];

  store[key].push({ timestamp: Date.now(), brawlers: pickRates });

  // Trim to the rolling window
  if (store[key].length > MAX_SNAPSHOTS_PER_MAP) {
    store[key] = store[key].slice(-MAX_SNAPSHOTS_PER_MAP);
  }

  persistStore(store);
}

/**
 * Returns the historical pick rate for a specific brawler.
 *
 * Uses the oldest available snapshot as the "historical" baseline.
 * Returns null when fewer than two snapshots exist (need at least one
 * baseline + one current to compare).
 *
 * @param {number|string} mapId
 * @param {string} brawlerName
 * @returns {number|null}
 */
function getHistoricalPickRate(mapId, brawlerName) {
  const key   = String(mapId);
  const store = loadStore();
  const snaps = store[key];

  if (!snaps || snaps.length < 2) return null;

  // The oldest snapshot is the baseline
  const oldest = snaps[0];
  const rate   = oldest.brawlers?.[brawlerName];
  return rate != null ? rate : null;
}

/**
 * Returns a map of brawlerName → historicalPickRate for all brawlers stored
 * for a given map.  Returns an empty object when no snapshot baseline exists.
 *
 * This is more efficient than calling getHistoricalPickRate per brawler when
 * you need rates for the full roster.
 *
 * @param {number|string} mapId
 * @returns {Object.<string, number>}
 */
function getHistoricalPickRateMap(mapId) {
  const key   = String(mapId);
  const store = loadStore();
  const snaps = store[key];

  if (!snaps || snaps.length < 2) return {};

  // Return a shallow copy of the oldest snapshot's brawler map
  return { ...snaps[0].brawlers };
}

module.exports = {
  saveSnapshot,
  getHistoricalPickRate,
  getHistoricalPickRateMap,

  // Exposed for tests only — not part of the public API
  _snapshotFile: SNAPSHOT_FILE,
  _maxSnapshots: MAX_SNAPSHOTS_PER_MAP
};
