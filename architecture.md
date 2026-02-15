# BrawlFast — Architecture Plan

> A lightweight proxy tool that strips Brawl Stars meta data down to the essentials: brawler win rates, best maps, and team comps. No images, no ads, no bloat.

---

## 1. Core Concept: "Fetch → Strip → Cache"

The app sits between the user and BrawlAPI (brawlapi.com). When someone searches for a map or brawler, the backend fetches the full payload from BrawlAPI, discards everything except the stats that matter, caches the stripped result, and serves it as clean JSON. Repeat queries are served from cache in under 1ms.

```
                        ┌─────────────────────────────────────────────┐
                        │              BrawlFast                      │
                        │                                             │
  User types "sna..."   │  ┌──────────┐    ┌──────────┐              │
  ─────────────────────►│  │ Express   │───►│ In-Memory│              │
                        │  │ Server    │◄───│ Cache    │              │
                        │  │          │    └──────────┘              │
                        │  │          │         │ miss               │
                        │  │          │         ▼                    │
                        │  │          │    ┌──────────┐   ┌────────┐│
                        │  │          │    │ Fetch &   │──►│BrawlAPI││
                        │  │          │    │ Strip     │◄──│  .com  ││
                        │  └──────────┘    └──────────┘   └────────┘│
                        │       │                                    │
                        │       ▼                                    │
                        │  ┌──────────┐                              │
                        │  │ public/  │                              │
                        │  │index.html│  ◄── served as static file   │
                        │  └──────────┘                              │
                        └─────────────────────────────────────────────┘
```

---

## 2. Data Source: BrawlAPI

BrawlAPI (brawlapi.com) is a free, public, unofficial Brawl Stars API with no auth required and no strict rate limits. It powers Brawlify.com and serves data derived from battle logs of top players.

### Endpoints We'll Use

| Endpoint | Data Returned | Our Use Case |
|---|---|---|
| `GET /v1/maps` | All maps with IDs, names, modes | Build the search catalog |
| `GET /v1/maps/:id` | Single map: brawler stats, team comps | Map detail view |
| `GET /v1/brawlers` | All brawlers with IDs, names | Build the search catalog |
| `GET /v1/brawlers/:id` | Single brawler: best maps, win rates | Brawler detail view |
| `GET /v1/events` | Current event rotation | Show what's active now |

### What We Strip (discard from responses)

- Image URLs and asset paths
- HTML description fields
- Hash/version metadata
- Environment-specific IDs
- Redundant nested objects
- Anything not a name, win rate, or team composition

### What We Keep

- Brawler name + win rate (per map)
- Team compositions + team win rate (per map)
- Brawler's best maps + win rate per map (per brawler)
- Map name, mode, and ID (for linking)

---

## 3. Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| Runtime | Node.js 18+ | Built-in `fetch`, runs everywhere |
| Server | Express.js | Minimal, one dependency, static file serving built in |
| Cache | In-memory `Map` with TTL | Zero infrastructure, no Redis needed for prototype |
| Frontend | Vanilla HTML + CSS + JS | No build step, instant load, single file |
| Fuzzy search | Custom (no library) | Normalized substring + distance scoring, < 5ms |
| Hosting (later) | Railway / Render / Fly.io | Free tier, auto-deploy from Git, sets `PORT` env |

### Dependencies (package.json)

```json
{
  "name": "BrawlFast",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

One dependency total.

---

## 4. File Structure

```
BrawlFast/
├── server.js              ← All backend logic (proxy, cache, API routes)
├── public/
│   └── index.html         ← Entire frontend (HTML + CSS + JS in one file)
├── package.json           ← Just express as a dependency
├── .env.example           ← Documented config (PORT, CACHE_TTL, CORS)
└── README.md              ← Setup, usage, and deploy instructions
```

Four real files. That's the whole project.

---

## 5. API Design

### `GET /api/search?q=sna`

Fuzzy autocomplete across both maps and brawlers. Runs against an in-memory catalog, never hits the network. Returns in < 5ms.

```json
{
  "maps": [
    { "name": "Snake Prairie", "mode": "Bounty", "id": 15000100 }
  ],
  "brawlers": [
    { "name": "Sandy", "id": 16000023 }
  ]
}
```

### `GET /api/map/:id`

Full meta breakdown for a single map. Fetches from BrawlAPI on cache miss, serves from cache on hit.

```json
{
  "map": "Snake Prairie",
  "mode": "Bounty",
  "source": "brawlapi",
  "cached": true,
  "fetchMs": 0,
  "brawlers": [
    { "name": "Bo", "winRate": 68.2 },
    { "name": "Tara", "winRate": 64.7 },
    { "name": "Sandy", "winRate": 62.1 }
  ],
  "teams": [
    { "brawlers": ["Bo", "Tara", "Sandy"], "winRate": 72.1 },
    { "brawlers": ["Bo", "Rosa", "Shelly"], "winRate": 69.4 }
  ]
}
```

### `GET /api/brawler/:id`

Stats for a single brawler: their best maps and win rates on each.

```json
{
  "name": "Bo",
  "source": "brawlapi",
  "cached": false,
  "fetchMs": 134,
  "bestMaps": [
    { "map": "Snake Prairie", "mode": "Bounty", "winRate": 68.2 },
    { "map": "Cavern Churn", "mode": "Showdown", "winRate": 61.5 }
  ]
}
```

### `GET /health`

Deploy platforms use this for uptime checks.

```json
{ "status": "ok", "cacheSize": 42, "catalogAge": "2h 14m" }
```

---

## 6. Cache Architecture

Three tiers, all in-memory `Map` objects with TTL expiration:

```
┌─────────────────────────────────────────────────────────┐
│                    CACHE LAYERS                         │
│                                                         │
│  ┌─────────────────┐  Refreshes every 6 hours           │
│  │ Catalog Cache   │  Maps list + Brawlers list         │
│  │ TTL: 6 hours    │  Used by /api/search (never        │
│  │                 │  hits network for autocomplete)     │
│  └─────────────────┘                                    │
│                                                         │
│  ┌─────────────────┐  Per-map brawler stats + teams     │
│  │ Map Cache       │  Keyed by map ID                   │
│  │ TTL: 30 min     │  ~150 possible entries             │
│  └─────────────────┘                                    │
│                                                         │
│  ┌─────────────────┐  Per-brawler best maps             │
│  │ Brawler Cache   │  Keyed by brawler ID               │
│  │ TTL: 30 min     │  ~80 possible entries              │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

### Cache Logic (pseudocode)

```javascript
const cache = new Map();

function getCached(key, ttl) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) {
    return entry.data;              // HIT: return instantly
  }
  cache.delete(key);                // EXPIRED: clean up
  return null;                      // MISS: caller fetches fresh
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}
```

### Memory Budget

Worst case with every map and brawler cached: roughly 2-3 MB. Negligible.

---

## 7. Fuzzy Search Strategy

On server startup, fetch the full map and brawler catalogs from BrawlAPI. Store them as flat arrays in memory. The `/api/search` endpoint runs a lightweight fuzzy match:

```
1. Normalize query: lowercase, strip spaces/hyphens
2. For each item in catalog:
   a. Exact prefix match?  → score = 100
   b. Substring match?     → score = 80
   c. Levenshtein ≤ 2?     → score = 60 - distance * 10
   d. No match             → skip
3. Sort by score descending, return top 8
```

No external fuzzy library. The catalog is small (~350 maps + ~80 brawlers), so brute-force iteration is instant.

The catalog auto-refreshes every 6 hours via `setInterval`. If BrawlAPI is down during refresh, the old catalog stays active.

---

## 8. Frontend Design

### Aesthetic Direction

Dark theme, tactical HUD feel. Designed for gamers who want data fast, not a pretty website. Think: terminal overlay meets esports stats dashboard.

- Monospace numbers for stat readability
- Color-coded tier badges (S/A/B/C based on win rate brackets)
- Horizontal win rate bars with gradient fills
- Zero decorative images — pure data density
- Single search bar that handles both maps and brawlers

### Layout

```
┌──────────────────────────────────────────────────┐
│  ⚡ BrawlFast                                     │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │ 🔍  Search maps or brawlers...           │     │
│  └──────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────┐     │
│  │ ▸ Snake Prairie (Bounty)           MAP   │     │
│  │ ▸ Sandy                         BRAWLER  │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ── MAP VIEW (after selecting a map) ──────────   │
│                                                    │
│  Snake Prairie · Bounty         fetched in 142ms   │
│                                                    │
│  BRAWLER RANKINGS              BEST TEAMS          │
│  ┌──────────────────────┐     ┌──────────────────┐│
│  │ 1  S  Bo      68.2%  │     │ Bo+Tara+Sandy    ││
│  │ 2  S  Tara    64.7%  │     │ Win Rate: 72.1%  ││
│  │ 3  S  Sandy   62.1%  │     │                  ││
│  │ 4  A  Rosa    58.9%  │     │ Bo+Rosa+Shelly   ││
│  │ 5  A  Shelly  57.3%  │     │ Win Rate: 69.4%  ││
│  │ ...                   │     │                  ││
│  └──────────────────────┘     └──────────────────┘│
│                                                    │
│  ── BRAWLER VIEW (after selecting a brawler) ──   │
│                                                    │
│  Bo                                                │
│                                                    │
│  BEST MAPS                                         │
│  ┌──────────────────────────────────────────┐     │
│  │ 1  Snake Prairie    Bounty     68.2%     │     │
│  │ 2  Cavern Churn     Showdown   61.5%     │     │
│  │ 3  Feast or Famine  Showdown   59.1%     │     │
│  │ ...                                      │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ── FOOTER ────────────────────────────────────   │
│  Data from BrawlAPI · Cached 30 min · Not Supercell│
└──────────────────────────────────────────────────┘
```

### Interaction Flow

1. User starts typing → debounced (150ms) call to `/api/search`
2. Dropdown appears with map and brawler results, visually separated
3. User clicks or presses Enter on a result
4. Loading state (subtle pulse, no spinner) for ~100-300ms
5. Results table animates in with staggered row reveals
6. Metadata shows: fetch time, cache status, data source

---

## 9. Deploy-Ready Configuration

Built in from day one so deployment requires zero code changes:

```bash
# .env.example
PORT=3000              # Railway/Render override this automatically
CACHE_TTL=1800000      # 30 minutes in ms (default)
CATALOG_TTL=21600000   # 6 hours in ms (default)
CORS_ORIGIN=*          # Set to your domain in production
```

### Express Configuration

```javascript
// Deploy-ready patterns baked into server.js:

// 1. PORT from environment
const PORT = process.env.PORT || 3000;

// 2. CORS toggle
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
}

// 3. Static file serving (frontend + backend = one process)
app.use(express.static('public'));

// 4. Health check for platform monitoring
app.get('/health', (req, res) => { ... });

// 5. Trust proxy (for Railway/Render behind load balancer)
app.set('trust proxy', 1);
```

### Deploy Commands

```bash
# Railway
railway init && railway up

# Render
# Just connect Git repo, set start command: npm start

# Fly.io
fly launch && fly deploy
```

---

## 10. Server.js — Module Map

```
server.js
│
├── Config & Env
│   └── PORT, TTLs, BrawlAPI base URL
│
├── Cache Module
│   ├── getCached(key, ttl)
│   ├── setCache(key, data)
│   └── getCacheStats()
│
├── BrawlAPI Client
│   ├── fetchMaps()         → GET /v1/maps
│   ├── fetchMap(id)        → GET /v1/maps/:id
│   ├── fetchBrawlers()     → GET /v1/brawlers
│   ├── fetchBrawler(id)    → GET /v1/brawlers/:id
│   └── stripResponse(raw)  → keep only names + win rates
│
├── Catalog Manager
│   ├── loadCatalog()       → called at startup + every 6h
│   ├── searchCatalog(q)    → fuzzy match, returns top 8
│   └── catalog { maps[], brawlers[], loadedAt }
│
├── Routes
│   ├── GET /api/search?q=  → searchCatalog()
│   ├── GET /api/map/:id    → cache check → fetchMap → strip → cache → respond
│   ├── GET /api/brawler/:id→ cache check → fetchBrawler → strip → cache → respond
│   └── GET /health         → cache stats + uptime
│
└── Startup
    ├── loadCatalog()
    ├── setInterval(loadCatalog, CATALOG_TTL)
    └── app.listen(PORT)
```

---

## 11. Build Order

When it's time to code, build in this sequence:

1. **Cache module** — the `getCached`/`setCache` functions (5 min)
2. **BrawlAPI client** — fetch + strip functions, test against live API (15 min)
3. **Catalog manager** — load maps + brawlers at startup, fuzzy search (15 min)
4. **Express routes** — wire up the three API endpoints (10 min)
5. **Frontend HTML** — search bar, autocomplete, results tables (30 min)
6. **Polish** — error handling, loading states, deploy config (15 min)

Estimated total: ~90 minutes for a working prototype.

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| BrawlAPI goes down | No fresh data | Serve stale cache (extend TTL on fetch failure) |
| BrawlAPI changes response shape | Strip function breaks | Version-check responses, log warnings |
| BrawlAPI rate limits us | Slow/blocked fetches | Cache aggressively, 30-min TTL already handles this |
| Map/brawler not found in API | Empty results | Return helpful error with suggestions from catalog |
| Memory grows unbounded | Server crash (unlikely) | Cap cache at 500 entries, evict oldest on overflow |

---

## 13. Future Expansion (not in prototype)

- **Redis cache** — for multi-instance deployments
- **WebSocket push** — notify when map rotation changes
- **Favorites** — save preferred maps/brawlers in localStorage
- **Compare mode** — side-by-side brawler stats on two maps
- **PWA support** — installable, works offline with last-cached data

---

*Data sourced from BrawlAPI (brawlapi.com). Not affiliated with Supercell.*