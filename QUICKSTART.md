# BrawlFast Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Rust toolchain installed
- Cloudflare account (free tier is fine)

## Installation (5 minutes)

### 1. Install JavaScript Dependencies

```bash
npm install
```

This installs `wrangler` (Cloudflare Workers CLI).

### 2. Install Rust Toolchain

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add wasm32 target
rustup target add wasm32-unknown-unknown

# Install worker-build
cargo install worker-build
```

### 3. Create Cloudflare KV Namespace

```bash
# Login to Cloudflare
npx wrangler login

# Create KV namespace for production
npx wrangler kv namespace create BRAWLFAST_KV

# Create KV namespace for preview/dev
npx wrangler kv namespace create BRAWLFAST_KV --preview
```

You'll get output like:
```
{ binding = "BRAWLFAST_KV", id = "abc123..." }
{ binding = "BRAWLFAST_KV", preview_id = "xyz789..." }
```

### 4. Update wrangler.toml with Your KV IDs

Edit `wrangler.toml` and replace the KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "BRAWLFAST_KV"
id = "YOUR_PRODUCTION_ID_HERE"      # From step 3
preview_id = "YOUR_PREVIEW_ID_HERE"  # From step 3
```

## Running Locally (Development)

### Start the Worker

```bash
npm run edge:dev
```

You'll see output like:
```
⛅️ wrangler 3.x.x
------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### Test the API

Open a new terminal and test:

```bash
# Health check
curl http://localhost:8787/health

# Search for maps/brawlers
curl http://localhost:8787/api/search?q=snake

# Get map details (example ID)
curl http://localhost:8787/api/map/15000100

# Get brawler details (example ID)
curl http://localhost:8787/api/brawler/16000000
```

### First Run Notes

**On first run**, the catalog will be empty. You need to trigger the prefetch manually:

```bash
# Trigger the scheduled prefetch (runs in background)
npx wrangler dev --test-scheduled --local
```

Or wait 60 seconds for the automatic cron to run.

## Deploying to Production

### 1. Build the Optimized Worker

```bash
cargo build --release --manifest-path worker/Cargo.toml
```

### 2. Deploy to Cloudflare

```bash
npm run edge:deploy
```

You'll see:
```
Published brawlfast-edge (X.XX sec)
  https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev
```

### 3. Trigger Initial Prefetch

After deploying, trigger the first prefetch:

```bash
# This starts the background prefetch immediately
npx wrangler publish
curl https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev/health
```

The cron will run automatically every minute going forward.

### 4. Test Production

```bash
# Your production URL
curl https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev/health

# Should show:
# {
#   "status": "ok",
#   "edge": true,
#   "catalogAgeMs": 12450,
#   ...
# }
```

## Troubleshooting

### "KV namespace not found"

Make sure you:
1. Created the KV namespaces (step 3)
2. Updated `wrangler.toml` with the correct IDs
3. Ran `wrangler login`

### "Empty catalog" or "No data"

The prefetch hasn't run yet. Either:
1. Wait 60 seconds for the automatic cron
2. Manually trigger: `npx wrangler dev --test-scheduled`

### Build errors

```bash
# Clean and rebuild
cargo clean --manifest-path worker/Cargo.toml
cargo build --release --manifest-path worker/Cargo.toml
```

### Wrangler version issues

```bash
# Update to latest
npm install wrangler@latest
```

## Monitoring

### View Logs (Real-time)

```bash
npx wrangler tail
```

You'll see the prefetch logs:
```
🔥 Starting warm_all prefetch cycle
📊 Fetched catalogs: 145 maps, 78 brawlers, 12 active
⚡ Prefetching with concurrency=8
✅ Prefetch complete: 145 maps, 78 brawlers in 5823ms
```

### Check Prefetch Status

```bash
curl https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev/health | jq
```

### Cloudflare Dashboard

Visit: https://dash.cloudflare.com/
- Navigate to Workers & Pages
- Click on `brawlfast-edge`
- View analytics, logs, and metrics

## Configuration

Edit `wrangler.toml` to tune performance:

```toml
[vars]
# Prefetch frequency (seconds)
WARM_INTERVAL_SECONDS = "60"    # Default: every 60 seconds

# Parallel requests during prefetch
WARM_CONCURRENCY = "8"          # Default: 8 (recommended: 8-12)
```

Deploy changes:
```bash
npm run edge:deploy
```

## Next Steps

1. **Custom Domain**: Add a custom domain in Cloudflare dashboard
2. **Analytics**: Monitor performance in Cloudflare Analytics
3. **Frontend**: The `public/index.html` is served automatically at `/`
4. **API**: Integrate with your app at `/api/*` endpoints

## Performance Verification

Check that all optimizations are working:

```bash
# 1. Edge execution (should be < 10ms globally)
curl -w "@curl-format.txt" https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev/health

# 2. Prefetching (catalogAgeMs should be < 60000)
curl https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev/health | jq .catalogAgeMs

# 3. HTTP/3 support
curl -sI --http3 https://brawlfast-edge.YOUR-SUBDOMAIN.workers.dev/health | grep alt-svc
```

## Cost

**Free tier includes**:
- 100,000 requests/day
- 1,000 KV reads/day
- 1,000 KV writes/day

BrawlFast stays well within these limits for most use cases.

## Need Help?

- Documentation: See `OPTIMIZATION_SUMMARY.md` for details
- Issues: https://github.com/anthropics/claude-code/issues
- Cloudflare Docs: https://developers.cloudflare.com/workers/

---

**You're ready to go!** 🚀

The complete setup takes about 5 minutes, and you'll have a globally-distributed, sub-5ms API running on Cloudflare's edge network.
