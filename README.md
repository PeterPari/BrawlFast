# BrawlFast

BrawlFast is a lightweight proxy that fetches Brawl Stars stats from BrawlAPI, strips responses down to core meta data, caches results in memory, and serves a fast JSON API plus a single-file frontend.

## Stack

- Node.js 18+
- Express.js
- Advanced ranking algorithm with Bayesian statistics
- In-memory `Map` cache with TTL
- Jest testing framework
- Vanilla HTML/CSS/JS frontend in one file

## Quick Start

1. Install dependencies:
   - `npm install`
2. Start server:
   - `npm start`
3. Open:
   - `http://localhost:3000`

For auto-reload during development:
- `npm run dev`

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage report:
```bash
npm test:coverage
```

Run tests in watch mode:
```bash
npm test:watch
```

**Test Coverage**: 70 unit tests covering statistics and ranking algorithm
**All tests passing**: ✅

## Environment

Copy `.env.example` values into your environment:

- `PORT` (default `3000`)
- `CACHE_TTL` (default `1800000` ms)
- `CATALOG_TTL` (default `21600000` ms)
- `CORS_ORIGIN` (default disabled unless set; use `*` for open access)

## API

- `GET /api/search?q=sna`
  - Returns fuzzy matches from in-memory map + brawler catalog
- `GET /api/map/:id`
  - Returns stripped map meta (brawlers + teams)
- `GET /api/brawler/:id`
  - Returns stripped brawler meta (best maps)
- `GET /health`
  - Returns status, cache size, and catalog age

## Caching

- Catalog refresh interval: `CATALOG_TTL` (default 6h)
- Map/Brawler TTL: `CACHE_TTL` (default 30m)
- Hard cache cap: 500 entries with oldest-entry eviction
- If upstream fetch fails and prior data exists, stale cache is served

## Advanced Ranking Algorithm

BrawlFast uses a sophisticated **Competitive Performance Score (CPS)** to rank brawlers:

### Key Features

1. **Bayesian Confidence**: Statistical confidence based on sample size
2. **Time-Weighted Performance**: Recent games weighted more heavily (14-day half-life)
3. **Map-Aware Weighting**: Different weights for Showdown vs Gem Grab vs other modes
4. **Team Synergy Analysis**: Identifies brawlers that excel in team compositions
5. **Use Rate Intelligence**: Distinguishes meta picks, sleeper picks, and trap picks
6. **Counter-Meta Scoring**: Rewards brawlers strong against popular enemies
7. **Percentile-Based Tiers**: S/A/B/C/F distribution (10/20/40/20/10%)

### Performance

- **< 1ms** average calculation time (99% faster than 100ms requirement)
- **70 unit tests** with 100% pass rate
- **Fully configurable** via `config/ranking.config.js`

### Documentation

- **[ALGORITHM.md](ALGORITHM.md)** - Detailed algorithm explanation with formulas
- **[TUNING.md](TUNING.md)** - Configuration guide and tuning scenarios
- **[PERFORMANCE.md](PERFORMANCE.md)** - Benchmark results and optimization analysis

### Customization

Edit `config/ranking.config.js` to tune:
- Bayesian priors (confidence thresholds)
- Time decay rate (meta adaptation speed)
- Map-specific weights (performance vs synergy emphasis)
- Tier percentile cutoffs

Example:
```javascript
// Faster meta adaptation after balance patch
timeWeighting: {
  halfLifeDays: 7  // Change from 14
}
```

See [TUNING.md](TUNING.md) for common scenarios.

## Deploy

Works with Railway, Render, Fly.io with no code changes.

- Start command: `npm start`
- Exposes `PORT` from environment
- Includes `/health` route for platform uptime checks

## Project Structure

```
BrawlFast/
├── server.js              # Main server and API routes
├── config/
│   └── ranking.config.js  # Algorithm parameters
├── lib/
│   ├── rankingEngine.js   # Core ranking algorithm
│   └── statistics.js      # Statistical utilities
├── tests/
│   ├── rankingEngine.test.js  # Algorithm tests (46 tests)
│   └── statistics.test.js     # Math utility tests (24 tests)
├── public/
│   └── index.html         # Single-file frontend
├── benchmark.js           # Performance testing
├── ALGORITHM.md           # Algorithm documentation
├── TUNING.md             # Configuration guide
└── PERFORMANCE.md        # Benchmark results
```

## Notes

- Data source: [BrawlAPI](https://brawlapi.com)
- Not affiliated with Supercell
