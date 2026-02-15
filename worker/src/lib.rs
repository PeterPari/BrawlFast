use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use worker::*;

const DEFAULT_PRIOR_WIN_RATE: f64 = 50.0;
const PRIOR_WEIGHT: f64 = 1500.0;

const KV_MAPS_CATALOG: &str = "catalog:maps";
const KV_BRAWLERS_CATALOG: &str = "catalog:brawlers";
const KV_MAPS_SEARCH_CATALOG: &str = "catalog:mapsLite";
const KV_BRAWLERS_SEARCH_CATALOG: &str = "catalog:brawlersLite";
const KV_ACTIVE_MAP_IDS: &str = "catalog:activeMapIds";
const KV_LOADED_AT: &str = "catalog:loadedAt";
const KV_MAP_RAW_PREFIX: &str = "mapraw:";
const KV_BRAWLER_RAW_PREFIX: &str = "brawlerraw:";

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CatalogMap {
    id: i64,
    name: String,
    mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    stats: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "teamStats")]
    team_stats: Option<Vec<Value>>,
    #[serde(rename = "_norm", alias = "norm", default)]
    norm: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CatalogBrawler {
    id: i64,
    name: String,
    #[serde(rename = "_norm", alias = "norm", default)]
    norm: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct MapBrawlerEntry {
    name: String,
    #[serde(rename = "winRate")]
    win_rate: f64,
    count: i64,
    #[serde(rename = "useRate")]
    use_rate: Option<f64>,
    #[serde(rename = "adjustedWinRate")]
    adjusted_win_rate: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct TeamEntry {
    brawlers: Vec<String>,
    #[serde(rename = "winRate")]
    win_rate: f64,
    count: i64,
    #[serde(rename = "adjustedWinRate")]
    adjusted_win_rate: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct MapResponse {
    map: String,
    mode: String,
    brawlers: Vec<MapBrawlerEntry>,
    teams: Vec<TeamEntry>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct BestMapEntry {
    map: String,
    mode: String,
    #[serde(rename = "winRate")]
    win_rate: f64,
    count: i64,
    #[serde(rename = "adjustedWinRate")]
    adjusted_win_rate: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct BrawlerResponse {
    name: String,
    #[serde(rename = "bestMaps")]
    best_maps: Vec<BestMapEntry>,
}

#[derive(Clone, Debug)]
struct CatalogState {
    maps: Vec<CatalogMap>,
    brawlers: Vec<CatalogBrawler>,
    active_map_ids: HashSet<i64>,
    loaded_at: i64,
}

#[event(fetch, respond_with_errors)]
async fn fetch(req: Request, env: Env, ctx: Context) -> Result<Response> {
    console_error_panic_hook::set_once();
    let url = req.url()?;
    let path = url.path();

    if path == "/health" {
        return health_handler(&env).await;
    }

    if path == "/api/search" {
        return search_handler(&url, &env).await;
    }

    if let Some(id) = extract_id(&path, "/api/map/") {
        return map_handler(id, &env, &ctx).await;
    }

    if let Some(id) = extract_id(&path, "/api/brawler/") {
        return brawler_handler(id, &env, &ctx).await;
    }

    if let Ok(assets) = env.assets("ASSETS") {
        return assets.fetch_request(req).await;
    }

    Response::error("Not found", 404)
}

#[event(scheduled)]
async fn scheduled(event: ScheduledEvent, env: Env, ctx: ScheduleContext) {
    console_error_panic_hook::set_once();
    let _cron = event.cron();
    let interval = env
        .var("WARM_INTERVAL_SECONDS")
        .ok()
        .and_then(|v| v.to_string().parse::<i64>().ok())
        .unwrap_or(60)
        .max(30);

    let kv = env.kv("BRAWLFAST_KV").unwrap();
    let loaded_at_raw = kv.get(KV_LOADED_AT).text().await.unwrap_or_default();
    let loaded_at = loaded_at_raw.as_ref().map(|s| s.parse::<i64>().unwrap_or(0)).unwrap_or(0);
    let now = now_ms();
    let since_last = if loaded_at > 0 {
        now.saturating_sub(loaded_at)
    } else {
        i64::MAX
    };

    if since_last < interval * 1000 {
        return;
    }

    ctx.wait_until(async move {
        if let Err(err) = warm_all(&env).await {
            console_error!("warm_all failed: {}", err);
        }
    });
}

async fn health_handler(env: &Env) -> Result<Response> {
    let state = load_catalog(env).await?;
    let age_ms = if state.loaded_at > 0 {
        now_ms().saturating_sub(state.loaded_at)
    } else {
        0
    };
    json_response(
        &json!({
            "status": "ok",
            "edge": true,
            "catalogAgeMs": age_ms.max(0)
        }),
        200,
    )
}

async fn search_handler(url: &url::Url, env: &Env) -> Result<Response> {
    let q = url
        .query_pairs()
        .find(|(k, _)| k == "q")
        .map(|(_, v)| v.trim().to_string())
        .unwrap_or_default();

    let qn = normalize_text(&q);
    if qn.is_empty() {
        return json_response(&json!({ "maps": [], "brawlers": [] }), 200);
    }

    let mut state = load_catalog(env).await?;
    if state.maps.is_empty() || state.brawlers.is_empty() {
        state = bootstrap_catalog(env).await?;
    }

    let mut maps_hits = top_scored_maps(&state.maps, &qn, 8);
    let mut brawler_hits = top_scored_brawlers(&state.brawlers, &qn, 8);

    if maps_hits.is_empty() && brawler_hits.is_empty() {
        if let Ok(refreshed) = bootstrap_catalog(env).await {
            state = refreshed;
            maps_hits = top_scored_maps(&state.maps, &qn, 8);
            brawler_hits = top_scored_brawlers(&state.brawlers, &qn, 8);
        }

        if maps_hits.is_empty() && brawler_hits.is_empty() {
            let (maps, brawlers) = origin_search_fallback(&qn, env).await?;
            return json_response(&json!({ "maps": maps, "brawlers": brawlers }), 200);
        }
    }

    let maps = maps_hits
        .into_iter()
        .map(|m| {
            json!({
                "id": m.id,
                "name": m.name,
                "mode": m.mode,
                "activeToday": state.active_map_ids.contains(&m.id)
            })
        })
        .collect::<Vec<_>>();

    let brawlers = brawler_hits
        .into_iter()
        .map(|b| json!({ "id": b.id, "name": b.name }))
        .collect::<Vec<_>>();

    json_response(&json!({ "maps": maps, "brawlers": brawlers }), 200)
}

async fn map_handler(id: i64, env: &Env, _ctx: &Context) -> Result<Response> {
    let kv = env.kv("BRAWLFAST_KV")?;
    let key = format!("{}{}", KV_MAP_RAW_PREFIX, id);
    if let Some(cached) = kv.get(&key).text().await? {
        return json_text_response(&cached, 200);
    }

    let (status, body) = fetch_json_text_with_status(format!("/maps/{}", id), env).await?;
    if status == 200 {
        let _ = kv.put(&key, body.clone())?.execute().await;
    }

    json_text_response(&body, status)
}

async fn brawler_handler(id: i64, env: &Env, _ctx: &Context) -> Result<Response> {
    let kv = env.kv("BRAWLFAST_KV")?;
    let key = format!("{}{}", KV_BRAWLER_RAW_PREFIX, id);
    if let Some(cached) = kv.get(&key).text().await? {
        return json_text_response(&cached, 200);
    }

    let (status, body) = fetch_json_text_with_status(format!("/brawlers/{}", id), env).await?;
    if status == 200 {
        let _ = kv.put(&key, body.clone())?.execute().await;
    }

    json_text_response(&body, status)
}

async fn load_catalog(env: &Env) -> Result<CatalogState> {
    let kv = env.kv("BRAWLFAST_KV")?;

    let maps = kv
        .get(KV_MAPS_SEARCH_CATALOG)
        .json::<Vec<CatalogMap>>()
        .await?
        .unwrap_or_default();
    let brawlers = kv
        .get(KV_BRAWLERS_SEARCH_CATALOG)
        .json::<Vec<CatalogBrawler>>()
        .await?
        .unwrap_or_default();
    let active_ids = kv
        .get(KV_ACTIVE_MAP_IDS)
        .json::<Vec<i64>>()
        .await?
        .unwrap_or_default()
        .into_iter()
        .collect::<HashSet<_>>();
    let loaded_at = kv
        .get(KV_LOADED_AT)
        .text()
        .await?
        .unwrap_or_default()
        .parse::<i64>()
        .unwrap_or(0);

    Ok(CatalogState {
        maps,
        brawlers,
        active_map_ids: active_ids,
        loaded_at,
    })
}

async fn bootstrap_catalog(env: &Env) -> Result<CatalogState> {
    let maps = fetch_maps(env).await?;
    let brawlers = fetch_brawlers(env).await?;
    let active_map_ids = fetch_active_map_ids(env).await.unwrap_or_default();
    let loaded_at = now_ms();

    let maps_catalog = maps
        .iter()
        .map(|m| CatalogMap {
            id: m.id,
            name: m.name.clone(),
            mode: m.mode.clone(),
            stats: None,
            team_stats: None,
            norm: m.norm.clone(),
        })
        .collect::<Vec<_>>();

    let kv = env.kv("BRAWLFAST_KV")?;
    let maps_full_json = serde_json::to_string(&maps)?;
    let maps_lite_json = serde_json::to_string(&maps_catalog)?;
    let brawlers_json = serde_json::to_string(&brawlers)?;
    kv.put(KV_MAPS_CATALOG, maps_full_json)?.execute().await?;
    kv.put(KV_MAPS_SEARCH_CATALOG, maps_lite_json)?.execute().await?;
    kv.put(KV_BRAWLERS_CATALOG, brawlers_json.clone())?.execute().await?;
    kv.put(KV_BRAWLERS_SEARCH_CATALOG, brawlers_json)?.execute().await?;
    kv.put(KV_ACTIVE_MAP_IDS, serde_json::to_string(&active_map_ids)?)?.execute().await?;
    kv.put(KV_LOADED_AT, loaded_at.to_string())?.execute().await?;

    Ok(CatalogState {
        maps: maps_catalog,
        brawlers,
        active_map_ids: active_map_ids.into_iter().collect::<HashSet<_>>(),
        loaded_at,
    })
}

async fn fetch_json(path: String, env: &Env) -> Result<Value> {
    let base = env
        .var("BRAWL_API_BASE")
        .ok()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "https://api.brawlify.com/v1".to_string());
    let full_url = format!("{}{}", base, path);

    let mut init = RequestInit::new();
    init.with_method(Method::Get);
    init.with_redirect(worker::RequestRedirect::Follow);

    let headers = Headers::new();
    headers.set("accept", "application/json")?;
    init.with_headers(headers);
    // Signal/AbortController not available in worker crate

    let req = Request::new_with_init(&full_url, &init)?;
    let mut resp = Fetch::Request(req).send().await?;

    if resp.status_code() >= 400 {
        return Err(Error::RustError(format!(
            "BrawlAPI request failed: {}",
            resp.status_code()
        )));
    }

    resp.json::<Value>().await
}

async fn fetch_json_text_with_status(path: String, env: &Env) -> Result<(u16, String)> {
    let base = env
        .var("BRAWL_API_BASE")
        .ok()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "https://api.brawlify.com/v1".to_string());
    let full_url = format!("{}{}", base, path);

    let mut init = RequestInit::new();
    init.with_method(Method::Get);
    init.with_redirect(worker::RequestRedirect::Follow);

    let headers = Headers::new();
    headers.set("accept", "application/json")?;
    init.with_headers(headers);

    let req = Request::new_with_init(&full_url, &init)?;
    let mut resp = Fetch::Request(req).send().await?;
    let status = resp.status_code();
    let body = resp.text().await?;
    Ok((status, body))
}

async fn fetch_maps(env: &Env) -> Result<Vec<CatalogMap>> {
    let payload = fetch_json("/maps".to_string(), env).await?;
    let items = payload
        .get("list")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| payload.get("items").and_then(|v| v.as_array()).cloned())
        .or_else(|| payload.as_array().cloned())
        .unwrap_or_default();

    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let id = to_i64(item.get("id"));
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or_default();
        if id.is_none() || name.is_empty() {
            continue;
        }

        let mode = mode_name(&item);
        let stats = item.get("stats").and_then(|v| v.as_array()).cloned();
        let team_stats = item.get("teamStats").and_then(|v| v.as_array()).cloned();

        out.push(CatalogMap {
            id: id.unwrap_or_default(),
            name: name.to_string(),
            mode,
            stats,
            team_stats,
            norm: normalize_text(name),
        });
    }

    Ok(out)
}

async fn fetch_brawlers(env: &Env) -> Result<Vec<CatalogBrawler>> {
    let payload = fetch_json("/brawlers".to_string(), env).await?;
    let items = payload
        .get("list")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| payload.get("items").and_then(|v| v.as_array()).cloned())
        .or_else(|| payload.as_array().cloned())
        .unwrap_or_default();

    let mut out = Vec::with_capacity(items.len());
    for item in items {
        let id = to_i64(item.get("id"));
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or_default();
        if id.is_none() || name.is_empty() {
            continue;
        }

        out.push(CatalogBrawler {
            id: id.unwrap_or_default(),
            name: name.to_string(),
            norm: normalize_text(name),
        });
    }
    Ok(out)
}

async fn fetch_active_map_ids(env: &Env) -> Result<Vec<i64>> {
    let payload = fetch_json("/events".to_string(), env).await?;
    let active = payload
        .get("active")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if active.is_empty() {
        return Ok(vec![]);
    }

    let now = now_ms();
    let mut current = vec![];
    for event in &active {
        let start = event
            .get("startTime")
            .and_then(|v| v.as_str())
            .and_then(parse_time_ms);
        let end = event
            .get("endTime")
            .and_then(|v| v.as_str())
            .and_then(parse_time_ms);

        let map_id = to_i64(event.get("map").and_then(|m| m.get("id")));
        if map_id.is_none() {
            continue;
        }

        if start.zip(end).map(|(s, e)| now >= s && now <= e).unwrap_or(true) {
            current.push(map_id.unwrap_or_default());
        }
    }

    if !current.is_empty() {
        current.sort_unstable();
        current.dedup();
        return Ok(current);
    }

    let mut fallback = active
        .iter()
        .filter_map(|e| to_i64(e.get("map").and_then(|m| m.get("id"))))
        .collect::<Vec<_>>();
    fallback.sort_unstable();
    fallback.dedup();
    Ok(fallback)
}

async fn warm_all(env: &Env) -> Result<Value> {
    let started = now_ms();
    console_log!("🔥 Starting warm_all prefetch cycle");

    // Step 1: Fetch catalogs (fast, small payloads)
    let maps = fetch_maps(env).await?;
    let brawlers = fetch_brawlers(env).await?;
    let active_map_ids = fetch_active_map_ids(env).await.unwrap_or_default();

    console_log!(
        "📊 Fetched catalogs: {} maps, {} brawlers, {} active",
        maps.len(),
        brawlers.len(),
        active_map_ids.len()
    );

    // Step 2: Save catalogs to KV (full for brawler fallback, lightweight for search/health)
    let kv = env.kv("BRAWLFAST_KV")?;
    let maps_catalog = maps
        .iter()
        .map(|m| CatalogMap {
            id: m.id,
            name: m.name.clone(),
            mode: m.mode.clone(),
            stats: None,
            team_stats: None,
            norm: m.norm.clone(),
        })
        .collect::<Vec<_>>();
    let maps_full_json = serde_json::to_string(&maps)?;
    let maps_lite_json = serde_json::to_string(&maps_catalog)?;
    console_log!("📦 catalog:maps(full) size: {} bytes", maps_full_json.len());
    console_log!("📦 catalog:maps(light) size: {} bytes", maps_lite_json.len());
    kv.put(KV_MAPS_CATALOG, maps_full_json)?.execute().await?;
    kv.put(KV_MAPS_SEARCH_CATALOG, maps_lite_json)?
        .execute()
        .await?;
    console_log!("✅ catalog:maps written");
    let brawlers_json = serde_json::to_string(&brawlers)?;
    kv.put(KV_BRAWLERS_CATALOG, brawlers_json.clone())?.execute().await?;
    kv.put(KV_BRAWLERS_SEARCH_CATALOG, brawlers_json)?.execute().await?;
    kv.put(KV_ACTIVE_MAP_IDS, serde_json::to_string(&active_map_ids)?)?.execute().await?;
    kv.put(KV_LOADED_AT, now_ms().to_string())?.execute().await?;

    let brawler_name_by_id = brawlers
        .iter()
        .map(|b| (b.id, b.name.clone()))
        .collect::<HashMap<_, _>>();

    // Step 3: Parallel prefetch with concurrency control
    let concurrency = env
        .var("WARM_CONCURRENCY")
        .ok()
        .and_then(|v| v.to_string().parse::<usize>().ok())
        .unwrap_or(8)
        .clamp(1, 20);

    console_log!("⚡ Prefetching with concurrency={}", concurrency);

    // Prefetch maps in parallel batches
    let map_results = prefetch_maps_parallel(&maps, &brawler_name_by_id, &kv, env, concurrency).await;

    // Prefetch brawlers in parallel batches
    let brawler_results = prefetch_brawlers_parallel(&brawlers, &maps, &brawler_name_by_id, &kv, env, concurrency).await;

    let total_ms = now_ms().saturating_sub(started);

    console_log!(
        "✅ Prefetch complete: {} maps, {} brawlers in {}ms",
        map_results.success,
        brawler_results.success,
        total_ms
    );

    Ok(json!({
        "maps": {
            "total": maps.len(),
            "success": map_results.success,
            "failed": map_results.failed
        },
        "brawlers": {
            "total": brawlers.len(),
            "success": brawler_results.success,
            "failed": brawler_results.failed
        },
        "activeMaps": active_map_ids.len(),
        "warmMs": total_ms,
        "concurrency": concurrency
    }))
}

async fn origin_search_fallback(qn: &str, env: &Env) -> Result<(Vec<Value>, Vec<Value>)> {
    let active_ids = fetch_active_map_ids(env).await.unwrap_or_default();
    let active_set = active_ids.into_iter().collect::<HashSet<_>>();

    let maps_payload = fetch_json("/maps".to_string(), env).await.unwrap_or_else(|_| json!({}));
    let maps_items = maps_payload
        .get("list")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| maps_payload.get("items").and_then(|v| v.as_array()).cloned())
        .or_else(|| maps_payload.as_array().cloned())
        .unwrap_or_default();

    let mut map_scored = maps_items
        .into_iter()
        .filter_map(|item| {
            let id = to_i64(item.get("id"))?;
            let name = item.get("name").and_then(|v| v.as_str())?.to_string();
            let score = score_match(qn, &normalize_text(&name))?;
            let mode = mode_name(&item);
            Some((score, json!({
                "id": id,
                "name": name,
                "mode": mode,
                "activeToday": active_set.contains(&id)
            })))
        })
        .collect::<Vec<_>>();
    map_scored.sort_by(|a, b| b.0.cmp(&a.0));
    let maps = map_scored.into_iter().take(8).map(|(_, v)| v).collect::<Vec<_>>();

    let brawlers_payload = fetch_json("/brawlers".to_string(), env).await.unwrap_or_else(|_| json!({}));
    let brawlers_items = brawlers_payload
        .get("list")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| brawlers_payload.get("items").and_then(|v| v.as_array()).cloned())
        .or_else(|| brawlers_payload.as_array().cloned())
        .unwrap_or_default();

    let mut brawler_scored = brawlers_items
        .into_iter()
        .filter_map(|item| {
            let id = to_i64(item.get("id"))?;
            let name = item.get("name").and_then(|v| v.as_str())?.to_string();
            let score = score_match(qn, &normalize_text(&name))?;
            Some((score, json!({ "id": id, "name": name })))
        })
        .collect::<Vec<_>>();
    brawler_scored.sort_by(|a, b| b.0.cmp(&a.0));
    let brawlers = brawler_scored
        .into_iter()
        .take(8)
        .map(|(_, v)| v)
        .collect::<Vec<_>>();

    Ok((maps, brawlers))
}

struct PrefetchResult {
    success: usize,
    failed: usize,
}

async fn prefetch_maps_parallel(
    maps: &[CatalogMap],
    brawler_name_by_id: &HashMap<i64, String>,
    kv: &kv::KvStore,
    env: &Env,
    concurrency: usize,
) -> PrefetchResult {
    use futures_util::stream::StreamExt;

    let mut success = 0;
    let mut failed = 0;
    let mut futures = FuturesUnordered::new();
    let mut iter = maps.iter();

    use futures_util::stream::FuturesUnordered;

    // Prime the pump with initial batch
    for _ in 0..concurrency {
        if let Some(map) = iter.next() {
            futures.push(prefetch_single_map(map, brawler_name_by_id, kv, env));
        }
    }

    // Process results and spawn new work
    while let Some(result) = futures.next().await {
        if result { success += 1; } else { failed += 1; }

        // Spawn next item
        if let Some(map) = iter.next() {
            futures.push(prefetch_single_map(map, brawler_name_by_id, kv, env));
        }
    }

    PrefetchResult { success, failed }
}

async fn prefetch_single_map(
    map: &CatalogMap,
    _brawler_name_by_id: &HashMap<i64, String>,
    kv: &kv::KvStore,
    env: &Env,
) -> bool {
    match fetch_json_text_with_status(format!("/maps/{}", map.id), env).await {
        Ok((status, body)) => {
            if status != 200 || body.is_empty() {
                return false;
            }
            match kv.put(&format!("{}{}", KV_MAP_RAW_PREFIX, map.id), body) {
                Ok(builder) => builder.execute().await.is_ok(),
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

async fn prefetch_brawlers_parallel(
    brawlers: &[CatalogBrawler],
    maps: &[CatalogMap],
    brawler_name_by_id: &HashMap<i64, String>,
    kv: &kv::KvStore,
    env: &Env,
    concurrency: usize,
) -> PrefetchResult {
    use futures_util::stream::{FuturesUnordered, StreamExt};

    let mut success = 0;
    let mut failed = 0;
    let mut futures = FuturesUnordered::new();
    let mut iter = brawlers.iter();

    // Prime the pump
    for _ in 0..concurrency {
        if let Some(brawler) = iter.next() {
            futures.push(prefetch_single_brawler(brawler, maps, brawler_name_by_id, kv, env));
        }
    }

    // Process results and spawn new work
    while let Some(result) = futures.next().await {
        if result { success += 1; } else { failed += 1; }

        if let Some(brawler) = iter.next() {
            futures.push(prefetch_single_brawler(brawler, maps, brawler_name_by_id, kv, env));
        }
    }

    PrefetchResult { success, failed }
}

async fn prefetch_single_brawler(
    brawler: &CatalogBrawler,
    _maps: &[CatalogMap],
    _brawler_name_by_id: &HashMap<i64, String>,
    kv: &kv::KvStore,
    env: &Env,
) -> bool {
    match fetch_json_text_with_status(format!("/brawlers/{}", brawler.id), env).await {
        Ok((status, body)) => {
            if status != 200 || body.is_empty() {
                return false;
            }
            match kv.put(&format!("{}{}", KV_BRAWLER_RAW_PREFIX, brawler.id), body) {
                Ok(builder) => builder.execute().await.is_ok(),
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

fn strip_map_response(raw: &Value, brawler_name_by_id: &HashMap<i64, String>) -> Option<MapResponse> {
    let id = raw.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
    let map_name = raw.get("name").and_then(|v| v.as_str()).unwrap_or_default();
    if id == 0 || map_name.is_empty() {
        return None;
    }

    let brawler_candidates = merge_arrays(vec![
        raw.get("stats").cloned(),
        raw.get("stats").and_then(|s| s.get("brawlers")).cloned(),
        raw.get("brawlers").cloned(),
        raw.get("meta").and_then(|m| m.get("brawlers")).cloned(),
    ]);

    let team_candidates = merge_arrays(vec![
        raw.get("teamStats").cloned(),
        raw.get("stats").and_then(|s| s.get("teams")).cloned(),
        raw.get("teams").cloned(),
        raw.get("meta").and_then(|m| m.get("teams")).cloned(),
    ]);

    let mut brawlers = brawler_candidates
        .into_iter()
        .filter_map(|entry| parse_map_stat_entry(&entry, brawler_name_by_id))
        .collect::<Vec<_>>();
    let prior = compute_prior_brawlers(&brawlers);
    for b in &mut brawlers {
        b.adjusted_win_rate = compute_adjusted_win_rate(b.win_rate, b.count, prior);
    }
    sort_brawlers(&mut brawlers);
    brawlers.truncate(20);

    let mut teams = team_candidates
        .into_iter()
        .filter_map(|entry| parse_team_entry(&entry, brawler_name_by_id))
        .collect::<Vec<_>>();
    let team_prior = compute_prior_teams(&teams);
    for t in &mut teams {
        t.adjusted_win_rate = compute_adjusted_win_rate(t.win_rate, t.count, team_prior);
    }
    sort_teams(&mut teams);
    teams.truncate(20);

    if teams.is_empty() {
        teams = build_fallback_teams_from_brawlers(&brawlers);
    }

    Some(MapResponse {
        map: map_name.to_string(),
        mode: mode_name(raw),
        brawlers,
        teams,
    })
}

fn strip_brawler_response(
    raw: &Value,
    requested_id: i64,
    maps_catalog: &[CatalogMap],
    brawler_name_by_id: &HashMap<i64, String>,
) -> Option<BrawlerResponse> {
    let id = raw.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
    let name = raw.get("name").and_then(|v| v.as_str()).unwrap_or_default();
    if id == 0 || name.is_empty() {
        return None;
    }

    let best_map_candidates = merge_arrays(vec![
        raw.get("stats").and_then(|s| s.get("bestMaps")).cloned(),
        raw.get("bestMaps").cloned(),
        raw.get("meta").and_then(|m| m.get("maps")).cloned(),
    ]);

    let mut best_maps = best_map_candidates
        .into_iter()
        .filter_map(parse_best_map_entry)
        .collect::<Vec<_>>();

    for item in &mut best_maps {
        item.adjusted_win_rate = compute_adjusted_win_rate(item.win_rate, 0, DEFAULT_PRIOR_WIN_RATE);
    }
    sort_best_maps(&mut best_maps);
    best_maps.truncate(25);

    if best_maps.is_empty() {
        best_maps = build_best_maps_from_catalog(requested_id, name, maps_catalog, brawler_name_by_id);
    }

    Some(BrawlerResponse {
        name: name.to_string(),
        best_maps,
    })
}

fn parse_map_stat_entry(entry: &Value, brawler_name_by_id: &HashMap<i64, String>) -> Option<MapBrawlerEntry> {
    let name = resolve_brawler_name(
        entry.get("brawler").or_else(|| entry.get("id")).or_else(|| entry.get("name")),
        brawler_name_by_id,
    )
    .or_else(|| entry.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))?;

    let win_rate = to_f64(
        entry
            .get("winRate")
            .or_else(|| entry.get("stats").and_then(|s| s.get("winRate")))
            .or_else(|| entry.get("winrate")),
    )?;
    let count = to_i64(
        entry
            .get("count")
            .or_else(|| entry.get("matches"))
            .or_else(|| entry.get("samples")),
    )
    .unwrap_or(0)
    .max(0);

    let use_rate = to_f64(
        entry
            .get("useRate")
            .or_else(|| entry.get("usageRate"))
            .or_else(|| entry.get("pickRate"))
            .or_else(|| entry.get("use")),
    )
    .map(round2);

    Some(MapBrawlerEntry {
        name,
        win_rate: round1(win_rate),
        count,
        use_rate,
        adjusted_win_rate: 0.0,
    })
}

fn parse_team_entry(entry: &Value, brawler_name_by_id: &HashMap<i64, String>) -> Option<TeamEntry> {
    let raw = entry
        .get("brawlers")
        .or_else(|| entry.get("team"))
        .or_else(|| entry.get("composition"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let brawlers = raw
        .into_iter()
        .filter_map(|item| {
            resolve_brawler_name(item.get("brawler").or(Some(&item)), brawler_name_by_id)
                .or_else(|| item.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
        })
        .collect::<Vec<_>>();

    let win_rate = to_f64(
        entry
            .get("winRate")
            .or_else(|| entry.get("stats").and_then(|s| s.get("winRate")))
            .or_else(|| entry.get("winrate")),
    )?;
    let count = to_i64(
        entry
            .get("count")
            .or_else(|| entry.get("matches"))
            .or_else(|| entry.get("samples")),
    )
    .unwrap_or(0)
    .max(0);

    if brawlers.is_empty() {
        return None;
    }

    Some(TeamEntry {
        brawlers,
        win_rate: round1(win_rate),
        count,
        adjusted_win_rate: 0.0,
    })
}

fn parse_best_map_entry(entry: Value) -> Option<BestMapEntry> {
    let map = entry
        .get("map")
        .and_then(|m| m.get("name").and_then(|v| v.as_str()))
        .or_else(|| entry.get("name").and_then(|v| v.as_str()))?
        .to_string();

    let mode = entry
        .get("map")
        .and_then(|m| m.get("gameMode").and_then(|g| g.get("name").and_then(|v| v.as_str())))
        .or_else(|| entry.get("map").and_then(|m| m.get("mode").and_then(|g| g.get("name").and_then(|v| v.as_str()))))
        .or_else(|| entry.get("mode").and_then(|m| m.get("name").and_then(|v| v.as_str())))
        .or_else(|| entry.get("mode").and_then(|v| v.as_str()))
        .unwrap_or("Unknown")
        .to_string();

    let win_rate = to_f64(
        entry
            .get("winRate")
            .or_else(|| entry.get("stats").and_then(|s| s.get("winRate")))
            .or_else(|| entry.get("winrate")),
    )?;

    Some(BestMapEntry {
        map,
        mode,
        win_rate: round1(win_rate),
        count: 0,
        adjusted_win_rate: 0.0,
    })
}

fn build_best_maps_from_catalog(
    brawler_id: i64,
    fallback_name: &str,
    maps_catalog: &[CatalogMap],
    brawler_name_by_id: &HashMap<i64, String>,
) -> Vec<BestMapEntry> {
    let mut best_maps = vec![];
    for map in maps_catalog {
        let stats = map.stats.clone().unwrap_or_default();
        for stat in stats {
            let stat_id = to_i64(stat.get("brawler").and_then(|b| b.get("id")).or_else(|| stat.get("brawler")));
            let stat_name = resolve_brawler_name(stat.get("brawler"), brawler_name_by_id);
            let by_id = stat_id.map(|id| id == brawler_id).unwrap_or(false);
            let by_name = !fallback_name.is_empty()
                && stat_name
                    .as_ref()
                    .map(|n| normalize_text(n) == normalize_text(fallback_name))
                    .unwrap_or(false);
            if !by_id && !by_name {
                continue;
            }

            let win_rate = to_f64(
                stat.get("winRate")
                    .or_else(|| stat.get("stats").and_then(|s| s.get("winRate")))
                    .or_else(|| stat.get("winrate")),
            );
            let count = to_i64(
                stat.get("count")
                    .or_else(|| stat.get("matches"))
                    .or_else(|| stat.get("samples")),
            )
            .unwrap_or(0)
            .max(0);
            if win_rate.is_none() {
                continue;
            }

            let prior = compute_prior_from_stats(&map.stats.clone().unwrap_or_default());
            let wr = win_rate.unwrap_or_default();
            best_maps.push(BestMapEntry {
                map: map.name.clone(),
                mode: map.mode.clone(),
                win_rate: round1(wr),
                count,
                adjusted_win_rate: compute_adjusted_win_rate(wr, count, prior),
            });
            break;
        }
    }
    sort_best_maps(&mut best_maps);
    best_maps.truncate(25);
    best_maps
}

fn build_fallback_teams_from_brawlers(brawlers: &[MapBrawlerEntry]) -> Vec<TeamEntry> {
    if brawlers.len() < 3 {
        return vec![];
    }
    let top = brawlers.iter().take(8).cloned().collect::<Vec<_>>();
    let mut teams = vec![];
    for i in 0..top.len().saturating_sub(2) {
        if teams.len() >= 6 {
            break;
        }
        let pick = [&top[i], &top[i + 1], &top[i + 2]];
        let avg = (pick[0].adjusted_win_rate + pick[1].adjusted_win_rate + pick[2].adjusted_win_rate) / 3.0;
        let team_count = ((pick[0].count + pick[1].count + pick[2].count) as f64 / 3.0).round() as i64;
        let adj = round1(avg + 1.5);
        teams.push(TeamEntry {
            brawlers: pick.iter().map(|b| b.name.clone()).collect(),
            win_rate: adj,
            count: team_count,
            adjusted_win_rate: adj,
        });
    }
    teams
}

fn best_suggestions(kind: &str, query: &str, state: &CatalogState) -> Vec<String> {
    let qn = normalize_text(query);
    if kind == "map" {
        if qn.is_empty() {
            return state.maps.iter().take(5).map(|m| m.name.clone()).collect();
        }
        return top_scored_maps(&state.maps, &qn, 5)
            .into_iter()
            .map(|m| m.name.clone())
            .collect();
    }

    if qn.is_empty() {
        return state
            .brawlers
            .iter()
            .take(5)
            .map(|b| b.name.clone())
            .collect();
    }
    top_scored_brawlers(&state.brawlers, &qn, 5)
        .into_iter()
        .map(|b| b.name.clone())
        .collect()
}

fn top_scored_maps<'a>(items: &'a [CatalogMap], qn: &str, limit: usize) -> Vec<&'a CatalogMap> {
    let mut scored = items
        .iter()
        .filter_map(|item| {
            let target_norm = if item.norm.is_empty() {
                normalize_text(&item.name)
            } else {
                item.norm.clone()
            };
            score_match(qn, &target_norm).map(|s| (s, item))
        })
        .collect::<Vec<_>>();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name.cmp(&b.1.name)));
    scored.into_iter().take(limit).map(|(_, item)| item).collect()
}

fn top_scored_brawlers<'a>(items: &'a [CatalogBrawler], qn: &str, limit: usize) -> Vec<&'a CatalogBrawler> {
    let mut scored = items
        .iter()
        .filter_map(|item| {
            let target_norm = if item.norm.is_empty() {
                normalize_text(&item.name)
            } else {
                item.norm.clone()
            };
            score_match(qn, &target_norm).map(|s| (s, item))
        })
        .collect::<Vec<_>>();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name.cmp(&b.1.name)));
    scored.into_iter().take(limit).map(|(_, item)| item).collect()
}

fn score_match(query_norm: &str, target_norm: &str) -> Option<i32> {
    if query_norm.is_empty() || target_norm.is_empty() {
        return None;
    }
    if target_norm.starts_with(query_norm) {
        return Some(100);
    }
    if target_norm.contains(query_norm) {
        return Some(80);
    }

    let distance = levenshtein(query_norm, target_norm);
    if distance <= 2 {
        return Some(60 - distance as i32 * 10);
    }
    None
}

fn levenshtein(a: &str, b: &str) -> usize {
    let a_chars = a.chars().collect::<Vec<_>>();
    let b_chars = b.chars().collect::<Vec<_>>();
    if a_chars.is_empty() {
        return b_chars.len();
    }
    if b_chars.is_empty() {
        return a_chars.len();
    }

    let mut prev = (0..=b_chars.len()).collect::<Vec<usize>>();
    let mut curr = vec![0usize; b_chars.len() + 1];

    for (i, ca) in a_chars.iter().enumerate() {
        curr[0] = i + 1;
        for (j, cb) in b_chars.iter().enumerate() {
            let cost = if ca == cb { 0 } else { 1 };
            curr[j + 1] = (prev[j + 1] + 1).min(curr[j] + 1).min(prev[j] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[b_chars.len()]
}

fn mode_name(raw: &Value) -> String {
    raw.get("gameMode")
        .and_then(|v| v.get("name").and_then(|n| n.as_str()).or_else(|| v.as_str()))
        .or_else(|| {
            raw.get("mode")
                .and_then(|v| v.get("name").and_then(|n| n.as_str()).or_else(|| v.as_str()))
        })
        .unwrap_or("Unknown")
        .to_string()
}

fn resolve_brawler_name(raw: Option<&Value>, brawler_name_by_id: &HashMap<i64, String>) -> Option<String> {
    let raw = raw?;
    if let Some(s) = raw.as_str() {
        return Some(s.to_string());
    }
    if let Some(id) = raw.as_i64() {
        return brawler_name_by_id.get(&id).cloned();
    }
    if let Some(obj) = raw.as_object() {
        if let Some(name) = obj.get("name").and_then(|v| v.as_str()) {
            return Some(name.to_string());
        }
        if let Some(id) = obj.get("id").and_then(|v| v.as_i64()) {
            return brawler_name_by_id.get(&id).cloned();
        }
    }
    None
}

fn compute_adjusted_win_rate(win_rate: f64, sample_size: i64, prior: f64) -> f64 {
    let count = (sample_size.max(0)) as f64;
    let adjusted = ((win_rate * count) + (prior * PRIOR_WEIGHT)) / (count + PRIOR_WEIGHT);
    round1(adjusted)
}

fn compute_prior_brawlers(entries: &[MapBrawlerEntry]) -> f64 {
    compute_prior_generic(entries.iter().map(|e| (e.win_rate, e.count)).collect())
}

fn compute_prior_teams(entries: &[TeamEntry]) -> f64 {
    compute_prior_generic(entries.iter().map(|e| (e.win_rate, e.count)).collect())
}

fn compute_prior_from_stats(stats: &[Value]) -> f64 {
    let pairs = stats
        .iter()
        .filter_map(|entry| {
            let wr = to_f64(
                entry
                    .get("winRate")
                    .or_else(|| entry.get("stats").and_then(|s| s.get("winRate")))
                    .or_else(|| entry.get("winrate")),
            )?;
            let count = to_i64(
                entry
                    .get("count")
                    .or_else(|| entry.get("matches"))
                    .or_else(|| entry.get("samples")),
            )
            .unwrap_or(0)
            .max(1);
            Some((wr, count))
        })
        .collect::<Vec<_>>();
    compute_prior_generic(pairs)
}

fn compute_prior_generic(values: Vec<(f64, i64)>) -> f64 {
    if values.is_empty() {
        return DEFAULT_PRIOR_WIN_RATE;
    }
    let mut wins = 0.0;
    let mut count = 0.0;
    for (wr, c) in values {
        let sample = c.max(1) as f64;
        wins += wr * sample;
        count += sample;
    }
    if count <= 0.0 {
        DEFAULT_PRIOR_WIN_RATE
    } else {
        round1(wins / count)
    }
}

fn sort_brawlers(items: &mut [MapBrawlerEntry]) {
    items.sort_by(|a, b| {
        b.adjusted_win_rate
            .partial_cmp(&a.adjusted_win_rate)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                b.win_rate
                    .partial_cmp(&a.win_rate)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| b.count.cmp(&a.count))
    });
}

fn sort_teams(items: &mut [TeamEntry]) {
    items.sort_by(|a, b| {
        b.adjusted_win_rate
            .partial_cmp(&a.adjusted_win_rate)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                b.win_rate
                    .partial_cmp(&a.win_rate)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| b.count.cmp(&a.count))
    });
}

fn sort_best_maps(items: &mut [BestMapEntry]) {
    items.sort_by(|a, b| {
        b.adjusted_win_rate
            .partial_cmp(&a.adjusted_win_rate)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                b.win_rate
                    .partial_cmp(&a.win_rate)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| b.count.cmp(&a.count))
    });
}

fn normalize_text(value: &str) -> String {
    value
        .chars()
        .filter(|c| !matches!(c, ' ' | '-' | '_' | '\'' | '’'))
        .flat_map(|c| c.to_lowercase())
        .collect::<String>()
}

fn merge_arrays(values: Vec<Option<Value>>) -> Vec<Value> {
    let mut out = vec![];
    for value in values {
        if let Some(Value::Array(arr)) = value {
            out.extend(arr);
        }
    }
    out
}

fn to_f64(value: Option<&Value>) -> Option<f64> {
    match value {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => s.parse::<f64>().ok(),
        _ => None,
    }
}

fn to_i64(value: Option<&Value>) -> Option<i64> {
    match value {
        Some(Value::Number(n)) => n.as_i64(),
        Some(Value::String(s)) => s.parse::<i64>().ok(),
        _ => None,
    }
}

fn parse_time_ms(iso: &str) -> Option<i64> {
    js_sys::Date::new(&wasm_bindgen::JsValue::from_str(iso))
        .get_time()
        .to_string()
        .parse::<f64>()
        .ok()
        .map(|v| v as i64)
}

fn extract_id(path: &str, prefix: &str) -> Option<i64> {
    if !path.starts_with(prefix) {
        return None;
    }
    path.strip_prefix(prefix)?.parse::<i64>().ok()
}

fn now_ms() -> i64 {
    js_sys::Date::now() as i64
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn json_response(value: &Value, status: u16) -> Result<Response> {
    let mut resp = Response::from_json(value)?;
    resp.headers_mut()
        .set("content-type", "application/json; charset=utf-8")?;
    resp.headers_mut().set("cache-control", "no-store")?;
    Ok(resp.with_status(status))
}

fn json_text_response(body: &str, status: u16) -> Result<Response> {
    let mut resp = Response::from_body(ResponseBody::Body(body.as_bytes().to_vec()))?;
    resp.headers_mut()
        .set("content-type", "application/json; charset=utf-8")?;
    resp.headers_mut().set("cache-control", "no-store")?;
    Ok(resp.with_status(status))
}
