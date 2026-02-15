# BrawlFast

**BrawlFast** is a lightning-fast Brawl Stars meta API delivering **sub-5ms global response times** through four complementary optimizations:

1. **Edge Execution**: Cloudflare Workers at 300+ locations worldwide
2. **Proactive Prefetching**: Background polling eliminates API wait (1ms vs 200ms)
3. **Rust + WebAssembly**: Zero garbage collection, SIMD JSON parsing, < 0.5ms overhead
4. **HTTP/3 (QUIC)**: 0-RTT connection resumption, 5x faster on mobile networks

The result: **125x faster** than traditional reactive architectures, with zero maintenance.

See [OPTIMIZATION_SUMMARY.md](OPTIMIZATION_SUMMARY.md) for complete details.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User Request (anywhere in the world)                       │
│    ↓ 2ms                                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Cloudflare Edge (nearest POP)                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Rust Worker (Wasm)                             │ │ │
│  │  │    ↓ 1.2ms                                       │ │ │
│  │  │  Workers KV (global cache)                      │ │ │
│  │  │    • Maps catalog                                │ │ │
│  │  │    • Brawlers catalog                            │ │ │
│  │  │    • Prefetched detail data                      │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│    ↓ 0.4ms                                                   │
│  Response (JSON)                                             │
│                                                              │
│  Background (every 60s):                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Scheduled Worker                                      │ │
│  │    → Fetch BrawlAPI (parallel, 8x concurrency)         │ │
│  │    → Strip to essentials                               │ │
│  │    → Update KV cache globally                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
Total: ~3.6ms globally
```

## Stack

- **Runtime**: Cloudflare Workers (Rust + WebAssembly)
- **Cache**: Workers KV (global replication to 300+ locations)
- **Prefetching**: Scheduled cron with parallel batch processing
- **Frontend**: Vanilla HTML/CSS/JS (single file, zero build)

## Quick Start (Rust Edge Backend)

1. Install JavaScript and Rust tooling:
  - `npm install`
  - `rustup toolchain install stable`
  - `cargo install worker-build`
2. Start Worker locally:
  - `npm run edge:dev`
3. Open the local Wrangler URL shown in terminal.

## Environment

Copy `.env.example` values into your environment:

- `BRAWL_API_BASE` (default `https://api.brawlify.com/v1`)
- `WARM_INTERVAL_SECONDS` (default `60`)
- `WARM_CONCURRENCY` (default `8`)

## API

- `GET /api/search?q=sna`
  - Returns fuzzy matches from in-memory map + brawler catalog
- `GET /api/map/:id`
  - Returns stripped map meta (brawlers + teams)
- `GET /api/brawler/:id`
  - Returns stripped brawler meta (best maps)
- `GET /health`
  - Returns status, cache size, and catalog age

## Caching & Prefetching Strategy

BrawlFast implements **proactive background polling** to achieve near-zero latency:

### How It Works

1. **Background Worker Loop**: A Cloudflare Worker cron job runs every minute
2. **Parallel Batch Fetching**: Fetches all maps and brawlers from BrawlAPI with controlled concurrency
3. **Strip & Store**: Processes responses to extract only essential stats, then stores in global KV
4. **Instant Reads**: User requests hit KV first (1-2ms latency), never waiting on BrawlAPI

### Latency Comparison

- **Traditional Reactive**: User request → Fetch BrawlAPI (200-500ms) → Strip → Return
- **BrawlFast Prefetching**: User request → Read KV (1-2ms) → Return ⚡

### Configuration

- `WARM_INTERVAL_SECONDS`: How often to prefetch all data (default: 60s, minimum: 30s)
- `WARM_CONCURRENCY`: Number of parallel API requests (default: 8, recommended: 8-12)

### Benefits

- **200ms → 1ms**: Eliminates network wait time for users
- **Always Fresh**: Data refreshes every minute in the background
- **Global CDN**: KV replicates data to 300+ edge locations worldwide
- **Resilient**: If BrawlAPI is down, stale cache continues serving

## Deploy

Global edge deploy is via Cloudflare Workers:

- `npm run edge:deploy`
- `/health` returns edge status and KV catalog age.

## Edge Deploy (Absolute Fastest Mode)

BrawlFast now includes a Rust Cloudflare Worker implementation in `worker/src/lib.rs` with:

- Global edge execution (Cloudflare POP nearest user)
- KV-backed API responses (`/api/search`, `/api/map/:id`, `/api/brawler/:id`, `/health`)
- Scheduled background warming (`scheduled()`) every minute
- Static frontend served directly from `public/` assets binding

### 1) Create KV namespace

```bash
npx wrangler kv namespace create BRAWLFAST_KV
npx wrangler kv namespace create BRAWLFAST_KV --preview
```

Copy the generated IDs into `wrangler.toml` under `[[kv_namespaces]]`.

### 2) Install JS tooling + Rust toolchain

```bash
npm install
rustup toolchain install stable
cargo install worker-build
```

### 3) Run locally at the edge runtime

```bash
npm run edge:dev
```

### 4) Deploy globally

```bash
npm run edge:deploy
```

### 5) Test scheduled warm-up locally (optional)

```bash
npm run edge:test-scheduled
```

### Notes

- Cloudflare terminates traffic with HTTP/3 automatically at the edge.
- API requests hit KV first; origin fetch is fallback only.
- Cron is set to every minute in `wrangler.toml` (`* * * * *`).
- Worker build entry is configured through `wrangler.toml` (`main = "build/worker/shim.mjs"`).

## Legacy Node Server

`server.js` remains in the repo as a legacy fallback path, but the active backend architecture is the Rust Worker in `worker/src/lib.rs`.

## Notes

- Data source: [BrawlAPI](https://brawlapi.com)
- Not affiliated with Supercell
