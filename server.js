const express = require('express');
const {
  computeCPS,
  rankBrawlers,
  assignTiers,
  MapType
} = require('./lib/rankingEngine');
const { logger } = require('./lib/logger');
const { createApiLimiter, createSearchLimiter } = require('./lib/rateLimiter');
const {
  securityHeaders,
  validateSearchQuery,
  validateMapId,
  validateBrawlerId,
  validateLimit,
  requestSizeLimit
} = require('./lib/security');
const { metrics } = require('./lib/metrics');
const {
  safeArray,
  toNum,
  modeName,
  resolveBrawlerName,
  normalizeText
} = require('./lib/utils');
const {
  topScored,
  scoreMatch
} = require('./lib/search');
const brawlApi = require('./lib/brawlApi');
const config = require('./config/ranking.config');

const app = express();
app.set('trust proxy', 1);

// Apply security middleware
app.use(securityHeaders);
app.use(requestSizeLimit);

// Dynamic CORS middleware
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
  }
  next();
});

app.use(express.json());

// Apply logging middleware
app.use(logger.requestLogger());
app.use(logger.errorLogger());

// Apply metrics middleware
app.use(metrics.middleware());

const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL = Number(process.env.CACHE_TTL || 30 * 60 * 1000);
const CATALOG_TTL = Number(process.env.CATALOG_TTL || 1 * 60 * 60 * 1000);
const EVENTS_TTL = Number(process.env.EVENTS_TTL || 10 * 60 * 1000);
const MAX_CACHE_ENTRIES = 500;
const PRIOR_WEIGHT = Number(process.env.PRIOR_WEIGHT || config.bayesianPriors.weight);
const DEFAULT_PRIOR_WIN_RATE = Number(process.env.DEFAULT_PRIOR_WIN_RATE || config.bayesianPriors.defaultWinRate);

// Apply rate limiting (use the middleware function from RateLimiter)
const apiLimiter = createApiLimiter().middleware();
const searchLimiter = createSearchLimiter().middleware();

// Apply rate limiters to API endpoints
app.use('/api', apiLimiter);
app.use('/api/search', searchLimiter);

app.use(express.static('public'));

const cache = new Map();

const catalog = {
  maps: [],
  brawlers: [],
  brawlerById: new Map(),
  activeMapIds: new Set(),
  loadedAt: 0,
};

function now() {
  return Date.now();
}

function getCached(key, ttl) {
  const entry = cache.get(key);
  if (!entry) {
    logger.debug('Cache miss', { key });
    metrics.recordCacheMiss(key);
    return null;
  }

  if (now() - entry.ts < ttl) {
    // Move to end (mark as recently used)
    cache.delete(key);
    cache.set(key, entry);
    logger.debug('Cache hit', { key, age: now() - entry.ts });
    metrics.recordCacheHit(key);
    return entry.data;
  }

  cache.delete(key);
  logger.debug('Cache expired', { key, age: now() - entry.ts });
  metrics.recordCacheMiss(key);
  return null;
}

function setCache(key, data) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, { data, ts: now() });
  
  logger.debug('Cache set', { key, cacheSize: cache.size });
  metrics.updateCacheSize(cache.size);

  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
    logger.debug('Cache evicted', { evictedKey: oldestKey, cacheSize: cache.size });
    metrics.recordCacheEviction(oldestKey);
    metrics.updateCacheSize(cache.size);
  }
}

function getCacheStats() {
  return {
    size: cache.size,
    max: MAX_CACHE_ENTRIES,
  };
}

function searchCatalog(query) {
  const queryNorm = normalizeText(query);
  if (!queryNorm) {
    return { maps: [], brawlers: [] };
  }

  // Get raw matches for maps with scores
  const mapMatches = catalog.maps
    .map((item) => {
      const score = scoreMatch(queryNorm, item._norm);
      if (score == null) return null;
      
      // Add a boost for active maps, but don't let it override primary matches
      const isActive = catalog.activeMapIds.has(Number(item.id));
      const finalScore = score + (isActive ? 15 : 0);
      
      return { score: finalScore, item };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  // Deduplicate by display key (name+mode for maps)
  const mapsByKey = new Map();
  mapMatches.forEach(({ item }) => {
    const mapKey = `${item.name.toLowerCase()}|${item.mode.toLowerCase()}`;
    if (!mapsByKey.has(mapKey)) {
      mapsByKey.set(mapKey, {
        id: item.id,
        name: item.name,
        mode: item.mode,
        activeToday: catalog.activeMapIds.has(Number(item.id)),
      });
    }
  });
  const maps = Array.from(mapsByKey.values()).slice(0, 8);

  const brawlerResults = topScored(catalog.brawlers, queryNorm, 20);
  const brawlersByName = new Map();
  brawlerResults.forEach(({ id, name }) => {
    const brawlerKey = name.toLowerCase();
    if (!brawlersByName.has(brawlerKey)) {
      brawlersByName.set(brawlerKey, { id, name });
    }
  });
  const brawlers = Array.from(brawlersByName.values()).slice(0, 8);

  return { maps, brawlers };
}

function computeAdjustedWinRate(winRate, sampleSize, priorWinRate = DEFAULT_PRIOR_WIN_RATE) {
  const wr = toNum(winRate);
  if (wr == null) {
    return null;
  }

  const count = Math.max(0, Number(sampleSize || 0));
  const prior = toNum(priorWinRate) ?? DEFAULT_PRIOR_WIN_RATE;
  const adjusted = ((wr * count) + (prior * PRIOR_WEIGHT)) / (count + PRIOR_WEIGHT);
  return Number(adjusted.toFixed(1));
}

function computePriorFromEntries(entries) {
  const valid = safeArray(entries).filter((entry) => toNum(entry?.winRate) != null);
  if (!valid.length) {
    return DEFAULT_PRIOR_WIN_RATE;
  }

  const weighted = valid.reduce((acc, entry) => {
    const wr = toNum(entry.winRate);
    const count = Math.max(1, Number(entry.count || 0));
    return {
      wins: acc.wins + (wr * count),
      count: acc.count + count,
    };
  }, { wins: 0, count: 0 });

  if (weighted.count <= 0) {
    return DEFAULT_PRIOR_WIN_RATE;
  }

  return Number((weighted.wins / weighted.count).toFixed(1));
}

function sortByAdjustedThenRaw(a, b) {
  const adjustedA = toNum(a.adjustedWinRate) ?? -1;
  const adjustedB = toNum(b.adjustedWinRate) ?? -1;
  if (adjustedA !== adjustedB) {
    return adjustedB - adjustedA;
  }

  const rawA = toNum(a.winRate) ?? -1;
  const rawB = toNum(b.winRate) ?? -1;
  if (rawA !== rawB) {
    return rawB - rawA;
  }

  const countA = Number(a.count || 0);
  const countB = Number(b.count || 0);
  return countB - countA;
}

// ============================================================================
// RANKING ALGORITHM FUNCTIONS
// ============================================================================
// These functions have been extracted to modules for better maintainability:
// - lib/statistics.js: mean, standardDeviation, zScore
// - lib/rankingEngine.js: All ranking algorithm functions
// - config/ranking.config.js: Tunable parameters
//
// Functions are imported at the top of this file and used as before.
// ============================================================================

function parseMapStatEntry(entry, brawlerNameById) {
  const name = resolveBrawlerName(entry?.brawler ?? entry?.id ?? entry?.name, brawlerNameById) || entry?.name || null;
  const winRate = toNum(entry?.winRate ?? entry?.stats?.winRate ?? entry?.winrate);
  const count = Number(entry?.count ?? entry?.matches ?? entry?.samples ?? 0);
  const useRate = toNum(entry?.useRate ?? entry?.usageRate ?? entry?.pickRate ?? entry?.use);

  if (!name || winRate == null) {
    return null;
  }

  return {
    name,
    winRate: Number(winRate.toFixed(1)),
    count: Number.isFinite(count) ? Math.max(0, count) : 0,
    useRate: useRate == null ? null : Number(useRate.toFixed(2)),
  };
}

function parseTeamEntry(entry, brawlerNameById) {
  const rawBrawlers = safeArray(entry?.brawlers || entry?.team || entry?.composition)
    .map((item) => resolveBrawlerName(item?.brawler ?? item, brawlerNameById) || item?.name)
    .filter(Boolean);
  const winRate = toNum(entry?.winRate ?? entry?.stats?.winRate ?? entry?.winrate);
  const count = Number(entry?.count ?? entry?.matches ?? entry?.samples ?? 0);

  if (rawBrawlers.length === 0 || winRate == null) {
    return null;
  }

  return {
    brawlers: rawBrawlers,
    winRate: Number(winRate.toFixed(1)),
    count: Number.isFinite(count) ? Math.max(0, count) : 0,
  };
}

function buildFallbackTeamsFromBrawlers(brawlers) {
  if (!Array.isArray(brawlers) || brawlers.length < 3) {
    return [];
  }

  const top = brawlers.slice(0, 8);
  const teams = [];
  for (let i = 0; i < top.length - 2 && teams.length < 6; i += 1) {
    const pick = [top[i], top[i + 1], top[i + 2]];
    const avg = (pick[0].adjustedWinRate + pick[1].adjustedWinRate + pick[2].adjustedWinRate) / 3;
    const teamCount = Math.round((pick[0].count + pick[1].count + pick[2].count) / 3);
    teams.push({
      brawlers: pick.map((item) => item.name),
      winRate: Number((avg + 1.5).toFixed(1)),
      count: teamCount,
      adjustedWinRate: Number((avg + 1.5).toFixed(1)),
    });
  }
  return teams;
}

function getRankedBrawlers(raw, brawlerNameById) {
  const brawlerCandidates = safeArray(raw.stats)
    .concat(safeArray(raw.stats?.brawlers))
    .concat(safeArray(raw.brawlers))
    .concat(safeArray(raw.meta?.brawlers));

  const teamCandidates = safeArray(raw.teamStats)
    .concat(safeArray(raw.stats?.teams))
    .concat(safeArray(raw.teams))
    .concat(safeArray(raw.meta?.teams));

  // Deduplicate brawlers by name (keep first occurrence)
  const brawlersByName = new Map();
  brawlerCandidates
    .map((entry) => parseMapStatEntry(entry, brawlerNameById))
    .filter(Boolean)
    .forEach((brawler) => {
      if (!brawlersByName.has(brawler.name)) {
        brawlersByName.set(brawler.name, brawler);
      }
    });
  const brawlers = Array.from(brawlersByName.values());

  if (brawlers.length === 0) {
    return [];
  }

  const brawlerPrior = computePriorFromEntries(brawlers);
  let rankedBrawlers = brawlers
    .map((entry) => ({
      ...entry,
      adjustedWinRate: computeAdjustedWinRate(entry.winRate, entry.count, brawlerPrior),
    }))
    .sort(sortByAdjustedThenRaw);

  // Deduplicate teams by sorted brawler names (keep first occurrence)
  const teamsByKey = new Map();
  teamCandidates
    .map((entry) => parseTeamEntry(entry, brawlerNameById))
    .filter(Boolean)
    .forEach((team) => {
      const teamKey = [...team.brawlers].sort().join('|');
      if (!teamsByKey.has(teamKey)) {
        teamsByKey.set(teamKey, team);
      }
    });
  let teams = Array.from(teamsByKey.values());

  const teamPrior = computePriorFromEntries(teams);
  teams = teams
    .map((entry) => ({
      ...entry,
      adjustedWinRate: computeAdjustedWinRate(entry.winRate, entry.count, teamPrior),
    }))
    .sort(sortByAdjustedThenRaw)
    .slice(0, 20);

  if (teams.length === 0) {
    teams = buildFallbackTeamsFromBrawlers(rankedBrawlers.slice(0, 20));
  }

  const mapType = modeName(raw);
  return rankBrawlers(rankedBrawlers, teams, mapType);
}

function stripMapResponse(raw, brawlerNameById, isActive) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.name) {
    logger.warn('Unexpected map response shape', { raw });
    return null;
  }

  const teamCandidates = safeArray(raw.teamStats)
    .concat(safeArray(raw.stats?.teams))
    .concat(safeArray(raw.teams))
    .concat(safeArray(raw.meta?.teams));

  const rankedBrawlers = getRankedBrawlers(raw, brawlerNameById);

  // Deduplicate teams by sorted brawler names
  const teamsByKey = new Map();
  teamCandidates
    .map((entry) => parseTeamEntry(entry, brawlerNameById))
    .filter(Boolean)
    .forEach((team) => {
      const teamKey = [...team.brawlers].sort().join('|');
      if (!teamsByKey.has(teamKey)) {
        teamsByKey.set(teamKey, team);
      }
    });
  let teams = Array.from(teamsByKey.values());

  const teamPrior = computePriorFromEntries(teams);
  teams = teams
    .map((entry) => ({
      ...entry,
      adjustedWinRate: computeAdjustedWinRate(entry.winRate, entry.count, teamPrior),
    }))
    .sort(sortByAdjustedThenRaw)
    .slice(0, 20);

  if (teams.length === 0) {
    teams = buildFallbackTeamsFromBrawlers(rankedBrawlers.slice(0, 20)).slice(0, 20);
  }

  return {
    id: raw.id,
    name: raw.name,
    map: raw.name,
    mode: modeName(raw),
    activeToday: Boolean(isActive),
    brawlers: rankedBrawlers.slice(0, 20),
    teams,
  };
}

function parseBestMapEntry(entry) {
  const map = entry?.map?.name || entry?.name || null;
  const mode = entry?.map?.gameMode?.name || entry?.map?.mode?.name || entry?.mode?.name || entry?.mode || 'Unknown';
  const winRate = toNum(entry?.winRate ?? entry?.stats?.winRate ?? entry?.winrate);

  if (!map || winRate == null) {
    return null;
  }

  return {
    map,
    mode,
    winRate: Number(winRate.toFixed(1)),
  };
}

function buildBestMapsFromCatalog(brawlerId, fallbackName) {
  const resolvedId = Number(brawlerId);
  const bestMaps = [];

  for (const map of catalog.maps) {
    const stats = safeArray(map.stats);
    for (const stat of stats) {
      const statId = Number(stat?.brawler?.id ?? stat?.brawler);
      const statName = resolveBrawlerName(stat?.brawler, catalog.brawlerById);
      const byId = Number.isFinite(resolvedId) && Number.isFinite(statId) && statId === resolvedId;
      const byName = fallbackName && statName && normalizeText(statName) === normalizeText(fallbackName);
      if (!byId && !byName) {
        continue;
      }

      const winRate = toNum(stat?.winRate ?? stat?.stats?.winRate ?? stat?.winrate);
      const count = Number(stat?.count ?? stat?.matches ?? stat?.samples ?? 0);
      if (winRate == null) {
        continue;
      }

      const mapPrior = computePriorFromEntries(stats);

      bestMaps.push({
        map: map.name,
        mode: modeName(map),
        winRate: Number(winRate.toFixed(1)),
        count: Number.isFinite(count) ? Math.max(0, count) : 0,
        adjustedWinRate: computeAdjustedWinRate(winRate, count, mapPrior),
      });
      break;
    }
  }

  return bestMaps
    .sort(sortByAdjustedThenRaw)
    .slice(0, 25);
}

function stripBrawlerResponse(raw, requestedId) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.name) {
    logger.warn('Unexpected brawler response shape', { raw, requestedId });
    return null;
  }

  const bestMapsCandidates = safeArray(raw.stats?.bestMaps)
    .concat(safeArray(raw.bestMaps))
    .concat(safeArray(raw.meta?.maps));

  // Deduplicate best maps by map name (keep first/best occurrence)
  const bestMapsByName = new Map();
  bestMapsCandidates
    .map(parseBestMapEntry)
    .filter(Boolean)
    .forEach((entry) => {
      const mapKey = `${entry.map}|${entry.mode}`;
      if (!bestMapsByName.has(mapKey)) {
        bestMapsByName.set(mapKey, {
          ...entry,
          count: 0,
          adjustedWinRate: computeAdjustedWinRate(entry.winRate, 0, DEFAULT_PRIOR_WIN_RATE),
        });
      }
    });

  const bestMaps = Array.from(bestMapsByName.values())
    .sort(sortByAdjustedThenRaw)
    .slice(0, 25);

  const hydratedBestMaps = bestMaps.length
    ? bestMaps
    : buildBestMapsFromCatalog(requestedId || raw.id, raw.name);

  return {
    id: raw.id || requestedId,
    name: raw.name,
    bestMaps: hydratedBestMaps,
  };
}

async function loadActiveEvents() {
  try {
    const activeMapIds = await brawlApi.fetchActiveMapIds();
    catalog.activeMapIds = activeMapIds;
    return true;
  } catch (error) {
    logger.warn('Events refresh failed', { error: error.message });
    return false;
  }
}

async function loadCatalog() {
  try {
    const [maps, brawlers] = await Promise.all([
      brawlApi.fetchMaps(),
      brawlApi.fetchBrawlers(),
    ]);
    if (!maps.length || !brawlers.length) {
      logger.warn('Empty catalog payload, keeping previous catalog');
      return false;
    }
    catalog.maps = maps;
    catalog.brawlers = brawlers;
    catalog.brawlerById = new Map(brawlers.map((item) => [Number(item.id), item.name]));
    
    await loadActiveEvents();
    
    catalog.loadedAt = now();
    return true;
  } catch (error) {
    logger.warn('Catalog refresh failed', { error: error.message });
    return false;
  }
}

function formatAge(ms) {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function bestSuggestionsFromCatalog(type, query = '', limit = 5) {
  const pool = type === 'map' ? catalog.maps : catalog.brawlers;
  const queryNorm = normalizeText(query);

  if (!queryNorm) {
    return pool.slice(0, limit).map((item) => item.name);
  }

  return topScored(pool, queryNorm, limit).map((item) => item.name);
}

app.get('/api/search', validateSearchQuery, validateLimit, (req, res) => {
  const q = req.query.q;
  const limit = req.query.limit;
  
  logger.debug('Search request', { query: q, limit });
  
  const searchResults = searchCatalog(q);
  
  // Combine results into a single array for compatibility with tests/frontend
  const results = [
    ...searchResults.maps.map(m => ({ ...m, type: 'map' })),
    ...searchResults.brawlers.map(b => ({ ...b, type: 'brawler' }))
  ].slice(0, limit);
  
  logger.info('Search completed', {
    requestId: req.requestId,
    query: q,
    resultCount: results.length
  });
  
  return res.json(results);
});

app.get('/api/live', async (req, res) => {
  // Self-heal live data if startup refresh failed or cache drifted.
  if (!catalog.maps.length || !catalog.brawlers.length) {
    await loadCatalog();
  }

  if (!catalog.activeMapIds.size) {
    await loadActiveEvents();
  }

  let liveMaps = catalog.maps
    .filter((m) => catalog.activeMapIds.has(Number(m.id)))
    .map((m) => {
      const ranked = getRankedBrawlers(m._raw, catalog.brawlerById);
      const top3 = ranked.slice(0, 3).map((b) => ({
        name: b.name,
        winRate: b.winRate,
        tier: b.tier,
      }));

      return {
        id: m.id,
        name: m.name,
        mode: m.mode,
        brawlers: top3,
      };
    });

  // If we have active ids but no matching maps, try one forced catalog refresh.
  if (!liveMaps.length && catalog.activeMapIds.size) {
    await loadCatalog();
    liveMaps = catalog.maps
      .filter((m) => catalog.activeMapIds.has(Number(m.id)))
      .map((m) => {
        const ranked = getRankedBrawlers(m._raw, catalog.brawlerById);
        const top3 = ranked.slice(0, 3).map((b) => ({
          name: b.name,
          winRate: b.winRate,
          tier: b.tier,
        }));

        return {
          id: m.id,
          name: m.name,
          mode: m.mode,
          brawlers: top3,
        };
      });
  }

  return res.json(liveMaps);
});

app.get('/api/map/:id', validateMapId, async (req, res) => {
  const { id } = req.params;
  const cacheKey = `map:${id}`;
  const startedAt = now();

  // If caller explicitly wants the raw BrawlAPI payload, proxy it unchanged
  if (String(req.query.raw || '') === 'true') {
    try {
      const raw = await brawlApi.fetchMap(id);
      return res.json(raw);
    } catch (error) {
      return res.status(502).json({ error: 'Unable to fetch raw map data', detail: error.message });
    }
  }

  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached) {
    return res.json({
      ...cached,
      source: 'brawlapi',
      cached: true,
      fetchMs: 0,
    });
  }

  try {
    const raw = await brawlApi.fetchMap(id);
    const isActive = catalog.activeMapIds.has(Number(id));
    const stripped = stripMapResponse(raw, catalog.brawlerById, isActive);
    if (!stripped) {
      return res.status(404).json({
        error: 'Map not found or unsupported response shape.',
        suggestions: bestSuggestionsFromCatalog('map', String(id)),
      });
    }

    setCache(cacheKey, stripped);

    return res.json({
      ...stripped,
      source: 'brawlapi',
      cached: false,
      fetchMs: now() - startedAt,
    });
  } catch (error) {
    const stale = cache.get(cacheKey)?.data;
    if (stale) {
      return res.json({
        ...stale,
        source: 'brawlapi',
        cached: true,
        stale: true,
        fetchMs: 0,
      });
    }

    return res.status(502).json({
      error: 'Unable to fetch map data right now.',
      suggestions: bestSuggestionsFromCatalog('map', String(id)),
      detail: error.message,
    });
  }
});

app.get('/api/brawler/:id', validateBrawlerId, async (req, res) => {
  const { id } = req.params;
  const cacheKey = `brawler:${id}`;
  const startedAt = now();

  // raw=true → proxy the exact BrawlAPI payload
  if (String(req.query.raw || '') === 'true') {
    try {
      const raw = await brawlApi.fetchBrawler(id);
      return res.json(raw);
    } catch (error) {
      return res.status(502).json({ error: 'Unable to fetch raw brawler data', detail: error.message });
    }
  }

  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached) {
    return res.json({
      ...cached,
      source: 'brawlapi',
      cached: true,
      fetchMs: 0,
    });
  }

  try {
    const raw = await brawlApi.fetchBrawler(id);
    const stripped = stripBrawlerResponse(raw, id);
    if (!stripped) {
      return res.status(404).json({
        error: 'Brawler not found or unsupported response shape.',
        suggestions: bestSuggestionsFromCatalog('brawler', String(id)),
      });
    }

    setCache(cacheKey, stripped);

    return res.json({
      ...stripped,
      source: 'brawlapi',
      cached: false,
      fetchMs: now() - startedAt,
    });
  } catch (error) {
    const stale = cache.get(cacheKey)?.data;
    if (stale) {
      return res.json({
        ...stale,
        source: 'brawlapi',
        cached: true,
        stale: true,
        fetchMs: 0,
      });
    }

    return res.status(502).json({
      error: 'Unable to fetch brawler data right now.',
      suggestions: bestSuggestionsFromCatalog('brawler', String(id)),
      detail: error.message,
    });
  }
});

app.get('/health', (req, res) => {
  const stats = getCacheStats();
  const ageMs = catalog.loadedAt ? now() - catalog.loadedAt : 0;
  const currentMetrics = metrics.getMetrics();

  res.json({
    status: 'ok',
    cache: {
      size: stats.size,
      max: stats.max,
      hitRate: Math.round(currentMetrics.cache.hitRate * 100) / 100
    },
    catalog: {
      age: formatAge(ageMs),
      loadedAt: catalog.loadedAt
    },
    metrics: {
      uptime: currentMetrics.uptime,
      requests: currentMetrics.requests.total,
      averageResponseTime: Math.round(currentMetrics.requests.averageResponseTime),
      upstreamFailures: currentMetrics.api.upstreamFailures
    }
  });
});

app.get('/metrics', (req, res) => {
  const currentMetrics = metrics.getMetrics();
  
  res.json(currentMetrics);
});

// Store interval references for cleanup
const intervals = [];

// Initialize server
(async () => {
  // Load catalog first
  await loadCatalog();
  
  // Start server only in non-test mode
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
    });
    
    // Setup periodic refresh intervals
    intervals.push(setInterval(loadCatalog, CATALOG_TTL));
    intervals.push(setInterval(loadActiveEvents, EVENTS_TTL));
  }
})();

// Export for tests
module.exports = app;

if (process.env.NODE_ENV === 'test') {
  app.cleanup = () => {
    intervals.forEach(interval => clearInterval(interval));
  };
}
