/**
 * Brawl Stars API Integration
 */

const { logger } = require('./logger');
const { metrics } = require('./metrics');
const { safeArray, modeName, normalizeText } = require('./utils');

const BRAWL_API_BASE = process.env.BRAWL_API_BASE || 'https://api.brawlify.com/v1';
const BRAWL_EVENTS_URL = 'https://api.brawlapi.com/v1/events';
const BRAWL_STARS_API_BASE = process.env.BRAWL_STARS_API_BASE || 'https://api.brawlstars.com/v1';
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, options = {}) {
  const { timeout = FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const start = Date.now();
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    metrics.recordUpstreamRequest(Date.now() - start);
    
    if (!response.ok) {
      throw new Error(`Upstream request failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    metrics.recordUpstreamFailure(error);
    throw error;
  } finally {
    clearTimeout(id);
  }
}

async function fetchMaps() {
  const payload = await fetchWithTimeout(`${BRAWL_API_BASE}/maps`);
  const allMaps = safeArray(payload?.list || payload?.items || payload).map((item) => ({
    id: item.id,
    name: item.name,
    mode: modeName(item),
    stats: safeArray(item.stats),
    teamStats: safeArray(item.teamStats),
    _norm: normalizeText(item.name),
    _raw: item,
  })).filter((item) => item.id && item.name);

  const mapsById = new Map();
  allMaps.forEach((map) => {
    const mapId = Number(map.id);
    if (!mapsById.has(mapId)) {
      mapsById.set(mapId, map);
    }
  });
  return Array.from(mapsById.values());
}

async function fetchBrawlers() {
  const payload = await fetchWithTimeout(`${BRAWL_API_BASE}/brawlers`);
  const allBrawlers = safeArray(payload?.list || payload?.items || payload).map((item) => ({
    id: item.id,
    name: item.name,
    _norm: normalizeText(item.name),
    _raw: item,
  })).filter((item) => item.id && item.name);

  const brawlersById = new Map();
  allBrawlers.forEach((brawler) => {
    const brawlerId = Number(brawler.id);
    if (!brawlersById.has(brawlerId)) {
      brawlersById.set(brawlerId, brawler);
    }
  });
  return Array.from(brawlersById.values());
}

async function fetchActiveMapIds() {
  const payload = await fetchWithTimeout(BRAWL_EVENTS_URL);
  const events = safeArray(payload?.active);
  if (!events.length) {
    return new Set();
  }

  const nowMs = Date.now();
  const todayIds = new Set(
    events
      .filter((event) => {
        const start = Date.parse(event?.startTime || '');
        const end = Date.parse(event?.endTime || '');
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          return true;
        }
        return nowMs >= start && nowMs <= end;
      })
      .map((event) => Number(event?.map?.id))
      .filter((id) => Number.isFinite(id))
  );

  if (todayIds.size > 0) {
    return todayIds;
  }

  return new Set(
    events
      .map((event) => Number(event?.map?.id))
      .filter((id) => Number.isFinite(id))
  );
}

async function fetchMap(id) {
  return fetchWithTimeout(`${BRAWL_API_BASE}/maps/${encodeURIComponent(id)}`);
}

async function fetchBrawler(id) {
  return fetchWithTimeout(`${BRAWL_API_BASE}/brawlers/${encodeURIComponent(id)}`);
}

/**
 * Parses the official Brawl Stars API battleTime string into a Date.
 *
 * The official API uses a non-standard format: "20231015T143022.000Z"
 * (YYYYMMDDTHHMMSS.sssZ) rather than ISO 8601.
 *
 * @param {string} battleTime
 * @returns {Date|null}
 */
function parseBattleTime(battleTime) {
  if (!battleTime) return null;
  // Try the BS-API-specific compact format first
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(battleTime);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
  }
  // Fall back to standard Date parsing
  const d = new Date(battleTime);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Transforms a raw battle log response from the official Brawl Stars API
 * into the {isWin, brawlerName, timestamp} format expected by detectChangepoint.
 *
 * Each battle log item includes:
 *   - battleTime: compact ISO timestamp ("20231015T143022.000Z")
 *   - battle.result: "victory" | "defeat" | "draw"
 *   - battle.teams[][].brawler.name: brawler used by each player
 *
 * @param {Object} battleLog  - Raw response from /players/:tag/battlelog
 * @param {string} [myTag]    - Player tag to identify their brawler (optional)
 * @returns {Array<{isWin: boolean, brawlerName: string, timestamp: Date}>}
 */
function transformBattleLog(battleLog, myTag = null) {
  const items = safeArray(battleLog?.items);
  const results = [];
  const normalTag = myTag ? String(myTag).replace('#', '').toUpperCase() : null;

  for (const item of items) {
    const ts = parseBattleTime(item?.battleTime);
    if (!ts) continue;

    const result = item?.battle?.result;
    if (!result || result === 'draw') continue;

    const isWin = result === 'victory';
    const teams = safeArray(item?.battle?.teams);

    // When a player tag is provided, find their specific brawler; otherwise
    // collect all brawlers from all teams (useful for per-brawler analysis).
    let found = false;
    for (const team of teams) {
      for (const player of safeArray(team)) {
        const playerTag = String(player?.tag || '').replace('#', '').toUpperCase();
        const brawlerName = player?.brawler?.name;
        if (!brawlerName) continue;

        if (!normalTag || playerTag === normalTag) {
          results.push({ isWin, brawlerName, timestamp: ts });
          if (normalTag) { found = true; break; }
        }
      }
      if (found) break;
    }
  }

  return results;
}

/**
 * Groups a transformed battle log by brawler name.
 *
 * @param {Array<{isWin: boolean, brawlerName: string, timestamp: Date}>} transformed
 * @returns {Map<string, Array<{isWin: boolean, timestamp: Date}>>}
 */
function groupBattleLogByBrawler(transformed) {
  const byBrawler = new Map();
  for (const entry of transformed) {
    const key = entry.brawlerName;
    if (!byBrawler.has(key)) byBrawler.set(key, []);
    byBrawler.get(key).push({ isWin: entry.isWin, timestamp: entry.timestamp });
  }
  return byBrawler;
}

/**
 * Fetches a player's battle log from the official Brawl Stars API.
 * Requires the BRAWL_STARS_API_TOKEN environment variable.
 *
 * @param {string} playerTag - Player tag with or without leading '#'
 * @returns {Promise<Object>} Raw battle log payload
 * @throws {Error} When the API token is missing or the request fails
 */
async function fetchBattleLog(playerTag) {
  const token = process.env.BRAWL_STARS_API_TOKEN;
  if (!token) throw new Error('BRAWL_STARS_API_TOKEN env var not set');

  const tag = playerTag.startsWith('#') ? playerTag : `#${playerTag}`;
  const encoded = encodeURIComponent(tag);
  return fetchWithTimeout(
    `${BRAWL_STARS_API_BASE}/players/${encoded}/battlelog`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

module.exports = {
  fetchMaps,
  fetchBrawlers,
  fetchActiveMapIds,
  fetchMap,
  fetchBrawler,
  fetchBattleLog,
  parseBattleTime,
  transformBattleLog,
  groupBattleLogByBrawler
};
