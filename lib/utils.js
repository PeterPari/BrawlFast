/**
 * Common Utility Functions
 */

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

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-_'’]/g, '');
}

module.exports = {
  safeArray,
  toNum,
  modeName,
  resolveBrawlerName,
  normalizeText
};
