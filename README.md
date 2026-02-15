# BrawlFast

BrawlFast is a lightweight proxy that fetches Brawl Stars stats from BrawlAPI, strips responses down to core meta data, caches results in memory, and serves a fast JSON API plus a single-file frontend.

## Stack

- Node.js 18+
- Express
- In-memory `Map` cache with TTL
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

## Deploy

Works with Railway, Render, Fly.io with no code changes.

- Start command: `npm start`
- Exposes `PORT` from environment
- Includes `/health` route for platform uptime checks

## Notes

- Data source: [BrawlAPI](https://brawlapi.com)
- Not affiliated with Supercell
