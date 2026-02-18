/**
 * Brawl Stars API Integration
 */

const { logger } = require('./logger');
const { metrics } = require('./metrics');
const { safeArray, modeName, normalizeText } = require('./utils');

const BRAWL_API_BASE = process.env.BRAWL_API_BASE || 'https://api.brawlify.com/v1';
const BRAWL_EVENTS_URL = 'https://api.brawlapi.com/v1/events';
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

module.exports = {
  fetchMaps,
  fetchBrawlers,
  fetchActiveMapIds,
  fetchMap,
  fetchBrawler
};
