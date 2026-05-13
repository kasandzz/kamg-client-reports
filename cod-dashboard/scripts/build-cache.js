#!/usr/bin/env node
/* ============================================
   build-cache.js -- pre-bake BQ query results
   to data/cache/*.json for cache-first reads

   Usage:
     node scripts/build-cache.js              (DRY RUN -- logs queries, no fetch)
     node scripts/build-cache.js --live       (LIVE -- hits Cloud Function)
     node scripts/build-cache.js --live --only=war-room  (filter by page)

   Hard rules:
   - No npm deps (Node 18+ global fetch only).
   - Default = dry-run. --live must be explicit.
   - Writes manifest at data/cache/_manifest.json regardless of mode.
   - Each run logs per-query: status, row count, ms.
   ============================================ */

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const BASE_URL = 'https://us-central1-green-segment-491604-j8.cloudfunctions.net/codDashboard';
const DASHBOARD_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(DASHBOARD_ROOT, 'data', 'cache');
const MANIFEST_PATH = path.join(CACHE_DIR, '_manifest.json');
const DEFAULT_TTL_SECONDS = 900; // 15 min stale-while-revalidate target

const args = new Set(process.argv.slice(2));
const LIVE = args.has('--live');
const onlyArg = [...args].find(a => a.startsWith('--only='));
const ONLY_PAGE = onlyArg ? onlyArg.split('=')[1] : null;

// ---- Query inventory --------------------------------------------------------
// Derived from grep of API.query(...) calls in js/pages/*.js on 2026-05-13.
// Each entry baked with default filter state (days=14, no closer/channel/vip).
// Calls with non-stable params (variable lookups like `q`, `week`, `params`)
// are intentionally omitted -- they cache-miss to live BQ.
const QUERIES = [
  // war-room.js
  { page: 'war-room', query: 'default',                params: { days: 14 } },
  { page: 'war-room', query: 'dailyRevenue',           params: { days: 14 } },
  { page: 'war-room', query: 'staleness',              params: {} },
  { page: 'war-room', query: 'leakDetection',          params: { days: 14 } },
  { page: 'war-room', query: 'closers',                params: { days: 14 } },
  { page: 'war-room', query: 'dailyRevenueStack',      params: { days: 14 } },
  { page: 'war-room', query: 'weeklyDailyBreakdown',   params: {} },

  // revenue.js (page name = enrollment)
  { page: 'enrollment', query: 'default',              params: { days: 14 } },
  { page: 'enrollment', query: 'monthly',              params: { days: 365 } },
  { page: 'enrollment', query: 'pipeline',             params: { days: 14 } },
  { page: 'enrollment', query: 'processorBreakdown',   params: { days: 14 } },
  { page: 'enrollment', query: 'ltvCohorts',           params: { months: 12 } },
  { page: 'enrollment', query: 'jodiConcentration',    params: { days: 14 } },
  { page: 'enrollment', query: 'churnAbsorption',      params: {} },
  { page: 'enrollment', query: 'recentEnrollments',    params: { limit: 20 } },

  // ads-meta.js
  { page: 'ads-meta', query: 'staleness',              params: {} },
  { page: 'ads-meta', query: 'default',                params: { days: 14 } },
  { page: 'ads-meta', query: 'campaigns',              params: { days: 14 } },
  { page: 'ads-meta', query: 'adsets',                 params: { days: 14 } },
  { page: 'ads-meta', query: 'daily',                  params: { days: 14 } },
  { page: 'ads-meta', query: 'unitEcon',               params: { days: 14 } },
  { page: 'ads-meta', query: 'retargeting',            params: { days: 14 } },
  { page: 'ads-meta', query: 'wastedSpend',            params: { days: 14 } },
  { page: 'ads-meta', query: 'creativeFatigue',        params: { days: 14 } },
  { page: 'ads-meta', query: 'sourceAttribution',      params: {} },
  { page: 'ads-meta', query: 'demographicsAgeGender',  params: { days: 14 } },
  { page: 'ads-meta', query: 'demographicsDevice',     params: { days: 14 } },
  { page: 'ads-meta', query: 'scatterAdSets',          params: { days: 14 } },

  // ads-google.js
  { page: 'google-ads', query: 'default',              params: { days: 14 } },
  { page: 'google-ads', query: 'campaigns',            params: { days: 14 } },
  { page: 'google-ads', query: 'keywords',             params: { days: 14 } },
  { page: 'google-ads', query: 'youtube',              params: { days: 14 } },
  { page: 'google-ads', query: 'crossPlatform',        params: { days: 14 } },
  { page: 'google-ads', query: 'daily',                params: { days: 14 } },
  { page: 'google-ads', query: 'landingPages',         params: { days: 14 } },

  // funnels.js (workshop + funnel-27 + worklists)
  { page: 'workshop', query: 'ytd',                    params: {} },
  { page: 'workshop', query: 'showRateTrend',          params: { days: 14 } },
  { page: 'workshop', query: 'watchTime',              params: { days: 14 } },
  { page: 'workshop', query: 'heatmapShowRate',        params: { days: 14 } },
  { page: 'workshop', query: 'heatmapTickets',         params: { days: 14 } },
  { page: 'workshop', query: 'dailyVelocity',          params: { days: 14 } },
  { page: 'workshop', query: 'weeklyVelocity',         params: { days: 14 } },
  { page: 'workshop', query: 'salesDynamic',           params: { days: 14 } },
  { page: 'workshop', query: 'funnelDaily',            params: { days: 14 } },
  { page: 'funnel-27', query: 'metrics',               params: { days: 14 } },
  { page: 'funnel-27', query: 'sankey',                params: { days: 14 } },
  { page: 'funnel-27', query: 'weekly',                params: { days: 84 } },
  { page: 'worklists', query: 'noShowRecovery',        params: {} },
  { page: 'worklists', query: 'vipNonBookers',         params: {} },

  // journey-explorer.js
  { page: 'journey-explorer', query: 'default',        params: { days: 14 } },
  { page: 'journey-explorer', query: 'sankey',         params: { days: 14 } },
  { page: 'journey-explorer', query: 'speedToClose',   params: { days: 180 } },
  { page: 'journey-explorer', query: 'cohortVelocity', params: { weeks: 12 } },

  // ma-funnel.js
  { page: 'ma-funnel', query: 'default',               params: { days: 14 } },
  { page: 'ma-funnel', query: 'registrations',         params: { days: 14 } },
  { page: 'ma-funnel', query: 'applications',          params: { days: 14 } },
  { page: 'ma-funnel', query: 'sankey',                params: { days: 14 } },

  // sales-team.js
  { page: 'sales-team', query: 'default',              params: { days: 14 } },
  { page: 'sales-team', query: 'perRep',               params: { days: 14 } },
  { page: 'sales-team', query: 'funnelSource',         params: { days: 14 } },
  { page: 'sales-team', query: 'monthly',              params: { days: 180 } },
  { page: 'sales-team', query: 'objections',           params: { days: 60 } },
  { page: 'sales-team', query: 'noShowCost',           params: { days: 14 } },
  { page: 'sales-team', query: 'dowCloseRate',         params: { days: 90 } },

  // email.js
  { page: 'email', query: 'default',                   params: { days: 14 } },
  { page: 'email', query: 'daily',                     params: { days: 14 } },
  { page: 'email', query: 'subjects',                  params: { days: 14 } },
  { page: 'email', query: 'mailboxProvider',           params: { days: 14 } },

  // segments.js
  { page: 'segments', query: 'nicheFunnel',            params: { days: 14 } },
  { page: 'segments', query: 'location',               params: { days: 14 } },

  // attribution.js
  { page: 'attribution', query: 'default',             params: { days: 14 } },
  { page: 'attribution', query: 'multiModel',          params: { days: 14 } },
  { page: 'attribution', query: 'multiSource',         params: { days: 14 } },

  // geo-intel.js
  { page: 'geo-intel', query: 'default',               params: { days: 14 } },
  { page: 'geo-intel', query: 'states',                params: { days: 14 } },
  { page: 'geo-intel', query: 'deadZones',             params: { days: 14 } },

  // cold-email.js
  { page: 'cold-email', query: 'kpis',                 params: { days: 14 } },
  { page: 'cold-email', query: 'campaigns',            params: { days: 14 } },
  { page: 'cold-email', query: 'replies',              params: { days: 14 } },
  { page: 'cold-email', query: 'sender_health',        params: { days: 14 } },
  { page: 'cold-email', query: 'daily',                params: { days: 14 } },
  { page: 'cold-email', query: 'bridge',               params: { days: 14 } },
  { page: 'cold-email', query: 'lead_breakdown',       params: { days: 14 } },
  { page: 'cold-email', query: 'reply_hours',          params: { days: 90 } },
  { page: 'cold-email', query: 'meta_cpa',             params: {} },
  { page: 'cold-email', query: 'reply_conversions',    params: { days: 14 } },

  // experiments.js
  { page: 'experiments', query: 'default',             params: { days: 14 } },

  // meta (data freshness, used by all pages)
  { page: 'meta', query: 'dataFreshness',              params: {} },
];

// ---- Cache key derivation ---------------------------------------------------
// Must match the function in js/api.js. If you change either, change both.
function cacheKeyFor(page, queryName, params) {
  const parts = [page, queryName];
  const keys = Object.keys(params || {})
    .filter(k => params[k] !== null && params[k] !== undefined && params[k] !== '')
    .sort();
  for (const k of keys) {
    parts.push(`${k}_${params[k]}`);
  }
  return parts.join('__').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function buildUrl(page, queryName, params) {
  const qs = new URLSearchParams();
  qs.set('page', page);
  qs.set('query', queryName);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, String(v));
  }
  return `${BASE_URL}?${qs.toString()}`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function bake(entry) {
  const { page, query, params } = entry;
  const cacheKey = cacheKeyFor(page, query, params);
  const url = buildUrl(page, query, params);
  const t0 = Date.now();

  if (!LIVE) {
    return { cacheKey, url, status: 'DRY', rows: 0, ms: 0, error: null };
  }

  try {
    const res = await fetch(url);
    const ms = Date.now() - t0;
    if (!res.ok) {
      return { cacheKey, url, status: `HTTP_${res.status}`, rows: 0, ms, error: `${res.status} ${res.statusText}` };
    }
    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];
    const payload = {
      query_key: cacheKey,
      page,
      query_name: query,
      params,
      fetched_at: new Date().toISOString(),
      ttl_seconds: DEFAULT_TTL_SECONDS,
      row_count: rows.length,
      rows,
    };
    await fs.writeFile(path.join(CACHE_DIR, `${cacheKey}.json`), JSON.stringify(payload), 'utf8');
    return { cacheKey, url, status: 'OK', rows: rows.length, ms, error: null };
  } catch (err) {
    return { cacheKey, url, status: 'ERROR', rows: 0, ms: Date.now() - t0, error: err.message };
  }
}

async function main() {
  await ensureDir(CACHE_DIR);

  const entries = ONLY_PAGE ? QUERIES.filter(q => q.page === ONLY_PAGE) : QUERIES;
  console.log(`[build-cache] mode=${LIVE ? 'LIVE' : 'DRY'} entries=${entries.length}${ONLY_PAGE ? ` only=${ONLY_PAGE}` : ''}`);

  const results = [];
  for (const entry of entries) {
    const r = await bake(entry);
    results.push(r);
    const pad = r.cacheKey.padEnd(56);
    console.log(`  ${r.status.padEnd(8)} ${pad} rows=${String(r.rows).padStart(6)}  ${r.ms}ms${r.error ? '  ERR: ' + r.error : ''}`);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    mode: LIVE ? 'live' : 'dry',
    ttl_seconds: DEFAULT_TTL_SECONDS,
    base_url: BASE_URL,
    entries: results.map(r => ({
      cache_key: r.cacheKey,
      url: r.url,
      status: r.status,
      row_count: r.rows,
    })),
  };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[build-cache] manifest written: ${MANIFEST_PATH}`);

  const failures = results.filter(r => r.status !== 'OK' && r.status !== 'DRY');
  if (failures.length) {
    console.error(`[build-cache] ${failures.length} failures`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[build-cache] fatal:', err);
  process.exit(2);
});
