/**
 * Tests for lib/pickRateSnapshots.js
 *
 * Uses Jest's manual mock for the 'fs' module so no real files are created.
 */

const path = require('path');

// ─── fs mock ───────────────────────────────────────────────────────────────
// Must be prefixed with 'mock' so Jest allows referencing it inside jest.mock()
let mockFsStore = {};

jest.mock('fs', () => ({
  readFileSync(filePath) {
    // Throw ENOENT to simulate file-not-found when the store is empty
    if (Object.keys(mockFsStore).length === 0) {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    }
    return JSON.stringify(mockFsStore);
  },
  writeFileSync(filePath, content) {
    mockFsStore = JSON.parse(content);
  },
  existsSync() { return true; },
  mkdirSync() {}
}));

// ─── Helper ─────────────────────────────────────────────────────────────────
function primeStore(data) {
  mockFsStore = JSON.parse(JSON.stringify(data));
}

// Reset between tests
beforeEach(() => { mockFsStore = {}; });

// Re-require after mocking so the module picks up the mocked fs
const {
  saveSnapshot,
  getHistoricalPickRate,
  getHistoricalPickRateMap,
  _maxSnapshots
} = require('../lib/pickRateSnapshots');

// ─── saveSnapshot ────────────────────────────────────────────────────────────
describe('saveSnapshot()', () => {
  test('creates an entry for a new map', () => {
    const brawlers = [
      { name: 'Shelly', useRate: 12.5 },
      { name: 'Colt',   useRate: 8.3 }
    ];
    saveSnapshot(1, brawlers);

    const snaps = mockFsStore['1'];
    expect(snaps).toHaveLength(1);
    expect(snaps[0].brawlers).toEqual({ Shelly: 12.5, Colt: 8.3 });
    expect(typeof snaps[0].timestamp).toBe('number');
  });

  test('appends a second snapshot for same map', () => {
    saveSnapshot(1, [{ name: 'Shelly', useRate: 10 }]);
    saveSnapshot(1, [{ name: 'Shelly', useRate: 11 }]);

    expect(mockFsStore['1']).toHaveLength(2);
  });

  test('skips brawlers with null useRate', () => {
    saveSnapshot(1, [
      { name: 'Shelly', useRate: 10 },
      { name: 'Colt',   useRate: null }
    ]);
    expect(mockFsStore['1'][0].brawlers).not.toHaveProperty('Colt');
    expect(mockFsStore['1'][0].brawlers).toHaveProperty('Shelly');
  });

  test('does not write when all useRates are null', () => {
    saveSnapshot(1, [{ name: 'Shelly', useRate: null }]);
    expect(mockFsStore).toEqual({});
  });

  test(`trims to the last ${_maxSnapshots} snapshots`, () => {
    const brawlers = [{ name: 'Shelly', useRate: 10 }];
    for (let i = 0; i < _maxSnapshots + 5; i++) {
      saveSnapshot(1, brawlers);
    }
    expect(mockFsStore['1']).toHaveLength(_maxSnapshots);
  });

  test('uses string key for mapId', () => {
    saveSnapshot(42, [{ name: 'Shelly', useRate: 5 }]);
    expect(mockFsStore).toHaveProperty('42');
  });
});

// ─── getHistoricalPickRate ───────────────────────────────────────────────────
describe('getHistoricalPickRate()', () => {
  test('returns null when no data exists for map', () => {
    expect(getHistoricalPickRate(1, 'Shelly')).toBeNull();
  });

  test('returns null with only one snapshot (no baseline yet)', () => {
    primeStore({ '1': [{ timestamp: 1000, brawlers: { Shelly: 10 } }] });
    expect(getHistoricalPickRate(1, 'Shelly')).toBeNull();
  });

  test('returns oldest snapshot pick rate when two+ snapshots exist', () => {
    primeStore({
      '1': [
        { timestamp: 1000, brawlers: { Shelly: 10 } },
        { timestamp: 2000, brawlers: { Shelly: 15 } }
      ]
    });
    expect(getHistoricalPickRate(1, 'Shelly')).toBe(10);
  });

  test('returns null when brawler not in oldest snapshot', () => {
    primeStore({
      '1': [
        { timestamp: 1000, brawlers: { Colt: 8 } },
        { timestamp: 2000, brawlers: { Shelly: 12, Colt: 9 } }
      ]
    });
    expect(getHistoricalPickRate(1, 'Shelly')).toBeNull();
  });
});

// ─── getHistoricalPickRateMap ────────────────────────────────────────────────
describe('getHistoricalPickRateMap()', () => {
  test('returns empty object when no snapshots exist', () => {
    expect(getHistoricalPickRateMap(99)).toEqual({});
  });

  test('returns empty object with fewer than 2 snapshots', () => {
    primeStore({ '5': [{ timestamp: 1000, brawlers: { Shelly: 10 } }] });
    expect(getHistoricalPickRateMap(5)).toEqual({});
  });

  test('returns full brawler map from oldest snapshot', () => {
    primeStore({
      '5': [
        { timestamp: 1000, brawlers: { Shelly: 10, Colt: 8 } },
        { timestamp: 2000, brawlers: { Shelly: 13, Colt: 9 } }
      ]
    });
    expect(getHistoricalPickRateMap(5)).toEqual({ Shelly: 10, Colt: 8 });
  });

  test('returns a shallow copy (mutations do not affect stored data)', () => {
    primeStore({
      '5': [
        { timestamp: 1000, brawlers: { Shelly: 10 } },
        { timestamp: 2000, brawlers: { Shelly: 12 } }
      ]
    });
    const result = getHistoricalPickRateMap(5);
    result.Shelly = 999;
    // Re-read from the primed store — value should still be 10
    expect(getHistoricalPickRateMap(5).Shelly).toBe(10);
  });
});
