const express = require('express');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL = Number(process.env.CACHE_TTL || 30 * 60 * 1000);
const CATALOG_TTL = Number(process.env.CATALOG_TTL || 6 * 60 * 60 * 1000);
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const BRAWL_API_BASE = process.env.BRAWL_API_BASE || 'https://api.brawlify.com/v1';
const MAX_CACHE_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 8000;
const PRIOR_WEIGHT = Number(process.env.PRIOR_WEIGHT || 1500);
const DEFAULT_PRIOR_WIN_RATE = Number(process.env.DEFAULT_PRIOR_WIN_RATE || 50);

if (CORS_ORIGIN) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });
}

app.use(express.static('public'));

const cache = new Map();
const cacheOrder = [];

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
    return null;
  }

  if (now() - entry.ts < ttl) {
    return entry.data;
  }

  cache.delete(key);
  const index = cacheOrder.indexOf(key);
  if (index !== -1) {
    cacheOrder.splice(index, 1);
  }
  return null;
}

function evictOldestIfNeeded() {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cacheOrder.shift();
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
}

function setCache(key, data) {
  if (!cache.has(key)) {
    cacheOrder.push(key);
  }
  cache.set(key, { data, ts: now() });
  evictOldestIfNeeded();
}

function getCacheStats() {
  return {
    size: cache.size,
    max: MAX_CACHE_ENTRIES,
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-_'’]/g, '');
}

function levenshtein(a, b) {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i += 1) dp[i][0] = i;
  for (let j = 0; j <= lenB; j += 1) dp[0][j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[lenA][lenB];
}

function scoreMatch(queryNorm, targetNorm) {
  if (!queryNorm || !targetNorm) return null;

  if (targetNorm.startsWith(queryNorm)) {
    return 100;
  }

  if (targetNorm.includes(queryNorm)) {
    return 80;
  }

  const distance = levenshtein(queryNorm, targetNorm);
  if (distance <= 2) {
    return 60 - distance * 10;
  }

  return null;
}

function topScored(items, queryNorm, limit = 8) {
  return items
    .map((item) => {
      const score = scoreMatch(queryNorm, item._norm);
      if (score == null) return null;
      return { score, item };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function searchCatalog(query) {
  const queryNorm = normalizeText(query);
  if (!queryNorm) {
    return { maps: [], brawlers: [] };
  }

  const maps = topScored(catalog.maps, queryNorm, 8).map(({ id, name, mode }) => ({
    id,
    name,
    mode,
    activeToday: catalog.activeMapIds.has(Number(id)),
  }));
  const brawlers = topScored(catalog.brawlers, queryNorm, 8).map(({ id, name }) => ({ id, name }));

  return { maps, brawlers };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function modeName(raw) {
  return raw?.gameMode?.name || raw?.mode?.name || raw?.mode || raw?.gameMode || 'Unknown';
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

function resolveBrawlerName(rawBrawler, brawlerNameById) {
  if (typeof rawBrawler === 'string') {
    return rawBrawler;
  }

  if (typeof rawBrawler === 'number') {
    return brawlerNameById.get(rawBrawler) || null;
  }

  if (rawBrawler && typeof rawBrawler === 'object') {
    if (rawBrawler.name) {
      return rawBrawler.name;
    }
    if (rawBrawler.id) {
      return brawlerNameById.get(Number(rawBrawler.id)) || null;
    }
  }

  return null;
}

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

function stripMapResponse(raw, brawlerNameById) {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.name) {
    console.warn('[BrawlAPI] Unexpected map response shape');
    return null;
  }

  const brawlerCandidates = safeArray(raw.stats)
    .concat(safeArray(raw.stats?.brawlers))
    .concat(safeArray(raw.brawlers))
    .concat(safeArray(raw.meta?.brawlers));

  const teamCandidates = safeArray(raw.teamStats)
    .concat(safeArray(raw.stats?.teams))
    .concat(safeArray(raw.teams))
    .concat(safeArray(raw.meta?.teams));

  const brawlers = brawlerCandidates
    .map((entry) => parseMapStatEntry(entry, brawlerNameById))
    .filter(Boolean);

  const brawlerPrior = computePriorFromEntries(brawlers);
  const rankedBrawlers = brawlers
    .map((entry) => ({
      ...entry,
      adjustedWinRate: computeAdjustedWinRate(entry.winRate, entry.count, brawlerPrior),
    }))
    .sort(sortByAdjustedThenRaw)
    .slice(0, 20);

  let teams = teamCandidates
    .map((entry) => parseTeamEntry(entry, brawlerNameById))
    .filter(Boolean);

  const teamPrior = computePriorFromEntries(teams);
  teams = teams
    .map((entry) => ({
      ...entry,
      adjustedWinRate: computeAdjustedWinRate(entry.winRate, entry.count, teamPrior),
    }))
    .sort(sortByAdjustedThenRaw)
    .slice(0, 20);

  if (teams.length === 0) {
    teams = buildFallbackTeamsFromBrawlers(rankedBrawlers);
  }

  return {
    map: raw.name,
    mode: modeName(raw),
    brawlers: rankedBrawlers,
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
    console.warn('[BrawlAPI] Unexpected brawler response shape');
    return null;
  }

  const bestMapsCandidates = safeArray(raw.stats?.bestMaps)
    .concat(safeArray(raw.bestMaps))
    .concat(safeArray(raw.meta?.maps));

  const bestMaps = bestMapsCandidates
    .map(parseBestMapEntry)
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      count: 0,
      adjustedWinRate: computeAdjustedWinRate(entry.winRate, 0, DEFAULT_PRIOR_WIN_RATE),
    }))
    .sort(sortByAdjustedThenRaw)
    .slice(0, 25);

  const hydratedBestMaps = bestMaps.length
    ? bestMaps
    : buildBestMapsFromCatalog(requestedId || raw.id, raw.name);

  return {
    name: raw.name,
    bestMaps: hydratedBestMaps,
  };
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${BRAWL_API_BASE}${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`BrawlAPI request failed: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchMaps() {
  const payload = await fetchJson('/maps');
  return safeArray(payload?.list || payload?.items || payload).map((item) => ({
    id: item.id,
    name: item.name,
    mode: modeName(item),
    stats: safeArray(item.stats),
    teamStats: safeArray(item.teamStats),
    _norm: normalizeText(item.name),
  })).filter((item) => item.id && item.name);
}

async function fetchActiveMapIds() {
  const payload = await fetchJson('/events');
  const events = safeArray(payload?.active);
  if (!events.length) {
    return new Set();
  }

  const nowMs = now();
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

async function fetchBrawlers() {
  const payload = await fetchJson('/brawlers');
  return safeArray(payload?.list || payload?.items || payload).map((item) => ({
    id: item.id,
    name: item.name,
    _norm: normalizeText(item.name),
  })).filter((item) => item.id && item.name);
}

async function fetchMap(id) {
  return fetchJson(`/maps/${encodeURIComponent(id)}`);
}

async function fetchBrawler(id) {
  return fetchJson(`/brawlers/${encodeURIComponent(id)}`);
}

async function loadCatalog() {
  try {
    const [maps, brawlers, activeMapIds] = await Promise.all([
      fetchMaps(),
      fetchBrawlers(),
      fetchActiveMapIds().catch(() => new Set()),
    ]);
    if (!maps.length || !brawlers.length) {
      console.warn('[Catalog] Empty catalog payload, keeping previous catalog');
      return false;
    }
    catalog.maps = maps;
    catalog.brawlers = brawlers;
    catalog.brawlerById = new Map(brawlers.map((item) => [Number(item.id), item.name]));
    catalog.activeMapIds = activeMapIds;
    catalog.loadedAt = now();
    return true;
  } catch (error) {
    console.warn('[Catalog] Refresh failed, keeping previous catalog:', error.message);
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

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const result = searchCatalog(q);
  res.json(result);
});

app.get('/api/map/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `map:${id}`;
  const startedAt = now();

  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached) {
    return res.json({
      ...cached,
      source: 'brawlify',
      cached: true,
      fetchMs: 0,
    });
  }

  try {
    const raw = await fetchMap(id);
    const stripped = stripMapResponse(raw, catalog.brawlerById);
    if (!stripped) {
      return res.status(404).json({
        error: 'Map not found or unsupported response shape.',
        suggestions: bestSuggestionsFromCatalog('map', String(id)),
      });
    }

    setCache(cacheKey, stripped);

    return res.json({
      ...stripped,
      source: 'brawlify',
      cached: false,
      fetchMs: now() - startedAt,
    });
  } catch (error) {
    const stale = cache.get(cacheKey)?.data;
    if (stale) {
      return res.json({
        ...stale,
        source: 'brawlify',
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

app.get('/api/brawler/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = `brawler:${id}`;
  const startedAt = now();

  const cached = getCached(cacheKey, CACHE_TTL);
  if (cached) {
    return res.json({
      ...cached,
      source: 'brawlify',
      cached: true,
      fetchMs: 0,
    });
  }

  try {
    const raw = await fetchBrawler(id);
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
      source: 'brawlify',
      cached: false,
      fetchMs: now() - startedAt,
    });
  } catch (error) {
    const stale = cache.get(cacheKey)?.data;
    if (stale) {
      return res.json({
        ...stale,
        source: 'brawlify',
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

  res.json({
    status: 'ok',
    cacheSize: stats.size,
    cacheMax: stats.max,
    catalogAge: formatAge(ageMs),
  });
});

(async () => {
  await loadCatalog();
  setInterval(loadCatalog, CATALOG_TTL);

  app.listen(PORT, () => {
    console.log(`BrawlFast listening on port ${PORT}`);
  });
})();
