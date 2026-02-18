/**
 * Tests for the battle-log transformation helpers in lib/brawlApi.js
 *
 * No network calls are made — only the pure transformation functions are tested.
 */

const { parseBattleTime, transformBattleLog, groupBattleLogByBrawler } = require('../lib/brawlApi');

// ─── parseBattleTime ─────────────────────────────────────────────────────────
describe('parseBattleTime()', () => {
  test('parses the compact BS-API format (YYYYMMDDTHHmmss.sssZ)', () => {
    const result = parseBattleTime('20231015T143022.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth()).toBe(9);   // October (0-indexed)
    expect(result.getDate()).toBe(15);
    expect(result.getUTCHours()).toBe(14);
    expect(result.getUTCMinutes()).toBe(30);
  });

  test('returns null for null input', () => {
    expect(parseBattleTime(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseBattleTime('')).toBeNull();
  });

  test('falls back to standard Date parsing for ISO strings', () => {
    const result = parseBattleTime('2023-10-15T14:30:22.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.getUTCHours()).toBe(14);
  });

  test('returns null for unparseable string', () => {
    expect(parseBattleTime('not-a-date')).toBeNull();
  });
});

// ─── Sample battle log payload ────────────────────────────────────────────────
const sampleBattleLog = {
  items: [
    {
      battleTime: '20231015T143022.000Z',
      battle: {
        result: 'victory',
        teams: [
          [
            { tag: '#ABC123', brawler: { name: 'Shelly' } },
            { tag: '#DEF456', brawler: { name: 'Colt' } },
            { tag: '#GHI789', brawler: { name: 'Brock' } }
          ],
          [
            { tag: '#OPP001', brawler: { name: 'Mortis' } },
            { tag: '#OPP002', brawler: { name: 'Poco' } },
            { tag: '#OPP003', brawler: { name: 'Rosa' } }
          ]
        ]
      }
    },
    {
      battleTime: '20231014T100000.000Z',
      battle: {
        result: 'defeat',
        teams: [
          [
            { tag: '#ABC123', brawler: { name: 'Shelly' } },
            { tag: '#DEF456', brawler: { name: 'Jessie' } },
            { tag: '#GHI789', brawler: { name: 'Penny' } }
          ],
          [
            { tag: '#OPP001', brawler: { name: 'Mortis' } },
            { tag: '#OPP002', brawler: { name: 'Sandy' } },
            { tag: '#OPP003', brawler: { name: 'Amber' } }
          ]
        ]
      }
    },
    {
      // Draw — should be excluded
      battleTime: '20231013T090000.000Z',
      battle: {
        result: 'draw',
        teams: [
          [{ tag: '#ABC123', brawler: { name: 'Shelly' } }],
          [{ tag: '#OPP001', brawler: { name: 'Mortis' } }]
        ]
      }
    },
    {
      // Missing battleTime — should be skipped
      battle: {
        result: 'victory',
        teams: [[{ tag: '#ABC123', brawler: { name: 'Colt' } }]]
      }
    }
  ]
};

// ─── transformBattleLog ───────────────────────────────────────────────────────
describe('transformBattleLog()', () => {
  test('returns all non-draw battles when no player tag is provided', () => {
    const results = transformBattleLog(sampleBattleLog, null);
    // 2 valid battles × 3 players per team × 2 teams = 12 entries, minus 1 skipped (no battleTime)
    // Only counting entries that have a timestamp (so 12)
    expect(results.length).toBeGreaterThan(0);
    // All results should have required fields
    for (const entry of results) {
      expect(entry).toHaveProperty('isWin');
      expect(entry).toHaveProperty('brawlerName');
      expect(entry).toHaveProperty('timestamp');
      expect(entry.timestamp).toBeInstanceOf(Date);
    }
  });

  test('filters to specific player tag when provided', () => {
    const results = transformBattleLog(sampleBattleLog, '#ABC123');
    // Player #ABC123 appears in 2 battles (3rd is a draw → excluded; 4th missing time → excluded)
    expect(results).toHaveLength(2);
    expect(results.every(r => r.brawlerName === 'Shelly')).toBe(true);
  });

  test('correctly identifies wins and defeats', () => {
    const results = transformBattleLog(sampleBattleLog, '#ABC123');
    const win    = results.find(r => r.isWin === true);
    const defeat = results.find(r => r.isWin === false);
    expect(win).toBeDefined();
    expect(defeat).toBeDefined();
  });

  test('excludes draw battles', () => {
    const results = transformBattleLog(sampleBattleLog, '#ABC123');
    // Third battle is a draw, should not appear
    expect(results).toHaveLength(2);
  });

  test('skips battles missing battleTime', () => {
    // Only entries WITH battleTime should be returned
    const all = transformBattleLog(sampleBattleLog, null);
    expect(all.every(r => r.timestamp instanceof Date)).toBe(true);
  });

  test('returns empty array for empty items', () => {
    expect(transformBattleLog({ items: [] }, null)).toEqual([]);
  });

  test('returns empty array for null input', () => {
    expect(transformBattleLog(null, null)).toEqual([]);
  });

  test('handles player tag with or without leading #', () => {
    const withHash    = transformBattleLog(sampleBattleLog, '#ABC123');
    const withoutHash = transformBattleLog(sampleBattleLog, 'ABC123');
    expect(withHash).toHaveLength(withoutHash.length);
  });
});

// ─── groupBattleLogByBrawler ─────────────────────────────────────────────────
describe('groupBattleLogByBrawler()', () => {
  test('groups by brawler name', () => {
    const transformed = transformBattleLog(sampleBattleLog, '#ABC123');
    const grouped = groupBattleLogByBrawler(transformed);

    expect(grouped).toBeInstanceOf(Map);
    expect(grouped.has('Shelly')).toBe(true);
    expect(grouped.get('Shelly')).toHaveLength(2);
  });

  test('each entry has isWin and timestamp', () => {
    const transformed = transformBattleLog(sampleBattleLog, '#ABC123');
    const grouped = groupBattleLogByBrawler(transformed);
    const shellyGames = grouped.get('Shelly');
    for (const g of shellyGames) {
      expect(typeof g.isWin).toBe('boolean');
      expect(g.timestamp).toBeInstanceOf(Date);
    }
  });

  test('returns empty Map for empty input', () => {
    const grouped = groupBattleLogByBrawler([]);
    expect(grouped.size).toBe(0);
  });

  test('multiple brawlers in non-filtered log are all grouped', () => {
    const transformed = transformBattleLog(sampleBattleLog, null);
    const grouped = groupBattleLogByBrawler(transformed);
    // Should have entries for at least Shelly, Colt, Brock, Mortis, etc.
    expect(grouped.size).toBeGreaterThan(3);
  });
});
