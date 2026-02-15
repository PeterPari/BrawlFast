import fs from 'node:fs';

const base = 'https://api.brawlify.com/v1';

const norm = (value) => String(value || '')
  .replace(/[\s\-_’']/g, '')
  .toLowerCase();

const modeName = (raw) => (
  raw?.gameMode?.name ||
  (typeof raw?.gameMode === 'string' ? raw.gameMode : null) ||
  raw?.mode?.name ||
  (typeof raw?.mode === 'string' ? raw.mode : null) ||
  'Unknown'
);

const [mapsRes, brawlersRes, eventsRes] = await Promise.all([
  fetch(`${base}/maps`),
  fetch(`${base}/brawlers`),
  fetch(`${base}/events`),
]);

if (!mapsRes.ok || !brawlersRes.ok || !eventsRes.ok) {
  throw new Error(`Brawlify fetch failed: maps=${mapsRes.status}, brawlers=${brawlersRes.status}, events=${eventsRes.status}`);
}

const mapsJson = await mapsRes.json();
const brawlersJson = await brawlersRes.json();
const eventsJson = await eventsRes.json();

const mapItems = mapsJson?.list || mapsJson?.items || (Array.isArray(mapsJson) ? mapsJson : []);
const brawlerItems = brawlersJson?.list || brawlersJson?.items || (Array.isArray(brawlersJson) ? brawlersJson : []);
const activeEvents = Array.isArray(eventsJson?.active) ? eventsJson.active : [];

const maps = mapItems
  .filter((item) => Number.isFinite(Number(item?.id)) && item?.name)
  .map((item) => ({
    id: Number(item.id),
    name: String(item.name),
    mode: String(modeName(item)),
    ...(Array.isArray(item.stats) && item.stats.length > 0 ? { stats: item.stats } : {}),
    ...(Array.isArray(item.teamStats) && item.teamStats.length > 0 ? { teamStats: item.teamStats } : {}),
    _norm: norm(item.name),
  }));

const brawlers = brawlerItems
  .filter((item) => Number.isFinite(Number(item?.id)) && item?.name)
  .map((item) => ({
    id: Number(item.id),
    name: String(item.name),
    _norm: norm(item.name),
  }));

const activeMapIds = [...new Set(activeEvents
  .map((event) => Number(event?.map?.id))
  .filter((id) => Number.isFinite(id)))]
  .sort((a, b) => a - b);

const loadedAt = Date.now();

const kvEntries = [
  { key: 'catalog:maps', value: JSON.stringify(maps) },
  { key: 'catalog:brawlers', value: JSON.stringify(brawlers) },
  { key: 'catalog:activeMapIds', value: JSON.stringify(activeMapIds) },
  { key: 'catalog:loadedAt', value: String(loadedAt) },
];

fs.writeFileSync('worker/kv-seed.json', JSON.stringify(kvEntries, null, 2));
console.log(`Prepared kv-seed.json with ${maps.length} maps, ${brawlers.length} brawlers, ${activeMapIds.length} active maps.`);
