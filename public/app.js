console.log('BrawlFast script starting...');
const searchInput = document.getElementById('search');
const dropdown = document.getElementById('dropdown');
const result = document.getElementById('result');
const loading = document.getElementById('loading');
const title = document.getElementById('title');
const meta = document.getElementById('meta');
const mapView = document.getElementById('mapView');
const brawlerView = document.getElementById('brawlerView');
const brawlerTable = document.getElementById('brawlerTable');
const teamTable = document.getElementById('teamTable');
const bestMapTable = document.getElementById('bestMapTable');
const homeView = document.getElementById('homeView');
const liveGrid = document.getElementById('liveGrid');

let searchTimer = null;
let searchAbortController = null;
let activeItems = [];
let activeIndex = -1;

async function loadLiveMaps(retries = 3) {
  console.log('loadLiveMaps called, retries left:', retries);
  try {
    const res = await fetch('/api/live');
    console.log('API response status:', res.status);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log('API data received, count:', data.length);
    
    if (!data.length) {
      liveGrid.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No maps are currently live in rotation.</p>';
      return;
    }

    const html = data.map((map, index) => {
      try {
        return `
          <div class="live-card row-in" style="${rowAnimDelay(index)}" data-map-id="${map.id}">
            <h4>${titleCase(map.name || 'Unknown')}</h4>
            <span class="mode">${titleCase(map.mode || 'Unknown')}</span>
            <div class="top-brawlers">
              ${(map.brawlers || []).map(b => `
                <div class="mini-brawler">
                  <span class="tier ${tierClass(b.tier || 'C')}">${b.tier || 'C'}</span>
                  <span class="name">${titleCase(b.name || 'Brawler')}</span>
                  <span class="wr">${(b.winRate || 0).toFixed(1)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } catch (err) {
        console.error('Error rendering map card:', err, map);
        return '';
      }
    }).join('');

    liveGrid.innerHTML = html;

    // Add click event listeners to all live cards
    document.querySelectorAll('.live-card').forEach(card => {
      card.addEventListener('click', () => {
        const mapId = card.dataset.mapId;
        selectItem('map', mapId);
      });
    });
  } catch (error) {
    console.error('Failed to load live maps:', error);
    if (retries > 0) {
      console.log(`Retrying live map load... (${retries} left)`);
      setTimeout(() => loadLiveMaps(retries - 1), 2000);
    } else {
      liveGrid.innerHTML = '<p style="color: var(--danger); padding: 20px;">Failed to load live maps. Please refresh the page.</p>';
    }
  }
}

function tier(winRate) {
  if (winRate >= 62) return 'S';
  if (winRate >= 57) return 'A';
  if (winRate >= 52) return 'B';
  return 'C';
}

function tierClass(t) {
  return `tier tier-${t.toLowerCase()}`;
}

function safePct(value) {
  return `${Number(value).toFixed(1)}%`;
}

function safeCount(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString();
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function setLoading(state) {
  loading.classList.toggle('hidden', !state);
}

function showResult() {
  homeView.classList.add('hidden');
  result.classList.remove('hidden');
}

function hideDropdown() {
  dropdown.style.display = 'none';
  dropdown.innerHTML = '';
  activeItems = [];
  activeIndex = -1;
}

function renderDropdown(data) {
  const mapItems = [...(data.maps || [])]
    .sort((a, b) => Number(Boolean(b.activeToday)) - Number(Boolean(a.activeToday)));
  const brawlerItems = data.brawlers || [];

  if (!mapItems.length && !brawlerItems.length) {
    hideDropdown();
    return;
  }

  let html = '';
  activeItems = [];

  if (mapItems.length) {
    html += `<div class="drop-section"><div class="drop-header">Maps</div>`;
    mapItems.forEach((item) => {
      const order = activeItems.length;
      activeItems.push({ type: 'map', id: item.id });
      const liveTag = item.activeToday ? '<span class="tag tag-today">LIVE</span>' : '';
      const liveClass = item.activeToday ? ' live-map' : '';
      html += `<button class="drop-item${liveClass}" data-order="${order}"><span>${titleCase(item.name)} (${titleCase(item.mode)})</span><span><span class="tag tag-map">Map</span>${liveTag}</span></button>`;
    });
    html += '</div>';
  }

  if (brawlerItems.length) {
    html += `<div class="drop-section"><div class="drop-header">Brawlers</div>`;
    brawlerItems.forEach((item) => {
      const order = activeItems.length;
      activeItems.push({ type: 'brawler', id: item.id });
      html += `<button class="drop-item" data-order="${order}"><span>${titleCase(item.name)}</span><span class="tag tag-brawler">Brawler</span></button>`;
    });
    html += '</div>';
  }

  dropdown.innerHTML = html;
  dropdown.style.display = 'block';

  [...dropdown.querySelectorAll('.drop-item')].forEach((button) => {
    button.addEventListener('click', () => {
      const order = Number(button.dataset.order);
      const selected = activeItems[order];
      if (selected) {
        selectItem(selected.type, selected.id);
      }
    });
  });
}

function activateIndex(index) {
  const items = [...dropdown.querySelectorAll('.drop-item')];
  items.forEach((item) => item.classList.remove('active'));
  if (index >= 0 && items[index]) {
    items[index].classList.add('active');
  }
}

async function fetchSearch(query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }

  searchAbortController = new AbortController();

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: searchAbortController.signal
    });
    if (!res.ok) return { maps: [], brawlers: [] };
    return res.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      return null;
    }
    return { maps: [], brawlers: [] };
  }
}

async function selectItem(type, id) {
  hideDropdown();
  searchInput.blur();
  setLoading(true);

  const endpoint = type === 'map' ? `/api/map/${id}` : `/api/brawler/${id}`;
  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Request failed');
    }

    renderDetail(type, data);
  } catch (error) {
    showResult();
    title.innerHTML = '<h2>Error</h2>';
    meta.innerHTML = `<span>${error.message}</span><span></span>`;
    mapView.classList.add('hidden');
    brawlerView.classList.add('hidden');
  } finally {
    setLoading(false);
  }
}

function rowAnimDelay(index) {
  return `animation-delay:${Math.min(index * 35, 350)}ms`;
}

function renderDetail(type, data) {
  showResult();

  const fetchMs = Number(data.fetchMs || 0);
  const cacheText = data.cached ? (data.stale ? 'stale cache' : 'cache hit') : 'fresh fetch';
  meta.innerHTML = `<span>source: ${data.source || 'brawlapi'} · ${cacheText}</span><span class="mono">fetched in ${fetchMs}ms</span>`;

  if (type === 'map') {
    mapView.classList.remove('hidden');
    brawlerView.classList.add('hidden');
    const liveTag = data.activeToday ? '<span class="tag tag-today" style="vertical-align: middle; margin-left: 12px; font-size: 14px;">LIVE</span>' : '';
    const titleClass = data.activeToday ? '' : 'gradient-text';
    const titleStyle = data.activeToday ? 'color: #FFCC00;' : '';
    title.innerHTML = `<h2 style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px; ${titleStyle}"><span class="${titleClass}">${titleCase(data.map)} · ${titleCase(data.mode)}</span>${liveTag}</h2>`;

    brawlerTable.innerHTML = `
      <thead><tr><th class="mobile-hide">#</th><th>Tier</th><th>Brawler</th><th>Score</th><th class="mobile-hide">Adj WR</th><th class="mobile-hide">Raw WR</th><th class="mobile-hide">Samples</th><th class="mobile-hide">Impact</th></tr></thead>
      <tbody>
        ${(data.brawlers || []).map((item, index) => {
          const adjusted = Number(item.adjustedWinRate ?? item.winRate ?? 0);
          const t = item.tier || tier(adjusted);
          const cpsScore = item.cps ? (item.cps * 100).toFixed(1) : '—';
          return `<tr class="row-in" style="${rowAnimDelay(index)}"><td class="mono mobile-hide">${index + 1}</td><td><span class="${tierClass(t)}">${t}</span></td><td>${titleCase(item.name)}</td><td class="mono" style="font-weight: 600; color: var(--accent);">${cpsScore}</td><td class="mono mobile-hide">${safePct(adjusted)}</td><td class="mono mobile-hide">${safePct(item.winRate)}</td><td class="mono mobile-hide">${safeCount(item.count)}</td><td class="mobile-hide"><div class="bar-wrap"><div class="bar"><span style="width:${Math.min(adjusted, 100)}%"></span></div></div></td></tr>`;
        }).join('')}
      </tbody>
    `;

    teamTable.innerHTML = `
      <thead><tr><th class="mobile-hide">#</th><th>Team</th><th>Adj WR</th><th class="mobile-hide">Raw WR</th><th class="mobile-hide">Samples</th></tr></thead>
      <tbody>
        ${(data.teams || []).map((item, index) => {
          const adjusted = Number(item.adjustedWinRate ?? item.winRate ?? 0);
          return `<tr class="row-in" style="${rowAnimDelay(index)}"><td class="mono mobile-hide">${index + 1}</td><td>${item.brawlers.map(titleCase).join(' + ')}</td><td class="mono">${safePct(adjusted)}</td><td class="mono mobile-hide">${safePct(item.winRate)}</td><td class="mono mobile-hide">${safeCount(item.count)}</td></tr>`;
        }).join('')}
      </tbody>
    `;
    return;
  }

  mapView.classList.add('hidden');
  brawlerView.classList.remove('hidden');
  title.innerHTML = `<h2>${titleCase(data.name)}</h2>`;

  bestMapTable.innerHTML = `
    <thead><tr><th class="mobile-hide">#</th><th>Map</th><th>Mode</th><th>Adj WR</th><th class="mobile-hide">Raw WR</th><th class="mobile-hide">Samples</th><th class="mobile-hide">Impact</th></tr></thead>
    <tbody>
      ${(data.bestMaps || []).map((item, index) => {
        const adjusted = Number(item.adjustedWinRate ?? item.winRate ?? 0);
        return `<tr class="row-in" style="${rowAnimDelay(index)}"><td class="mono mobile-hide">${index + 1}</td><td>${titleCase(item.map)}</td><td>${titleCase(item.mode)}</td><td class="mono">${safePct(adjusted)}</td><td class="mono mobile-hide">${safePct(item.winRate)}</td><td class="mono mobile-hide">${safeCount(item.count)}</td><td class="mobile-hide"><div class="bar-wrap"><div class="bar"><span style="width:${Math.min(adjusted, 100)}%"></span></div></div></td></tr>`;
      }).join('')}
    </tbody>
  `;
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  clearTimeout(searchTimer);

  if (!query) {
    hideDropdown();
    homeView.classList.remove('hidden');
    result.classList.add('hidden');
    return;
  }

  searchTimer = setTimeout(async () => {
    const data = await fetchSearch(query);
    if (data) {
      renderDropdown(data);
    }
  }, 80);
});

searchInput.addEventListener('focus', async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  const data = await fetchSearch(query);
  if (data) {
    renderDropdown(data);
  }
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex = Math.min(activeIndex + 1, activeItems.length - 1);
    activateIndex(activeIndex);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    activateIndex(activeIndex);
  } else if (event.key === 'Enter') {
    const selected = activeItems[activeIndex];
    if (selected) {
      selectItem(selected.type, selected.id);
    }
  } else if (event.key === 'Escape') {
    hideDropdown();
  }
});

document.addEventListener('click', (event) => {
  if (!dropdown.contains(event.target) && event.target !== searchInput) {
    hideDropdown();
  }
});

// Ensure DOM is fully ready before loading live maps
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => loadLiveMaps());
} else {
  loadLiveMaps();
}
