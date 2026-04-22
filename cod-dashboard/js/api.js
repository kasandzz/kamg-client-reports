/* ============================================
   API Client -- Cloud Function fetch wrapper
   ============================================ */

const API = (() => {
  const BASE_URL = 'https://us-central1-green-segment-491604-j8.cloudfunctions.net/codDashboard';
  const CACHE_TTL = 5 * 60 * 1000; // 5 min
  const _cache = new Map();
  const _inflight = new Map();
  const _meta = new Map(); // page:query -> { fetchedAt, cachedAt, fromCache }

  // Maps dashboard page name -> BQ tables it depends on (used for data freshness)
  const PAGE_TABLES = {
    'war-room':             ['stripe_transactions', 'hyros_sales', 'meta_ad_performance', 'posthog_events', 'ghl_contacts'],
    'ads-meta':             ['meta_ad_performance'],
    'ads-google':           ['google_ads_campaign_performance', 'google_ads_keyword_stats', 'google_ads_video_stats', 'meta_ad_performance'],
    'hyros':                ['hyros_sales', 'hyros_leads', 'hyros_calls', 'ghl_contacts', 'meta_ad_performance'],
    'cold-email':           ['cold_outbound_campaigns', 'cold_outbound_leads', 'cold_outbound_replies'],
    'email-intel':          ['sendgrid_messages'],
    'email-deliverability': ['sendgrid_daily_stats', 'sendgrid_mailbox_provider_stats'],
    'revenue':              ['stripe_transactions', 'meta_ad_performance', 'hyros_sales'],
    'sales-team':           ['sheets_bookings'],
    'calls':                ['sheets_bookings'],
    'journey-map':          ['mat_pipeline'],
    'funnels':              ['mat_pipeline'],
    'funnel-27':            ['mat_pipeline', 'meta_ad_performance', 'stripe_transactions'],
    'landing-pages':        ['posthog_events'],
    'behavioral':           ['posthog_events'],
    'churn':                ['stripe_transactions'],
    'insights':             ['mat_pipeline'],
    'leaks':                ['sheets_bookings', 'mat_pipeline', 'stripe_transactions'],
    'opportunities':        ['mat_pipeline', 'sheets_bookings'],
    'live-feed':            ['ghl_contacts', 'stripe_transactions', 'hyros_sales', 'posthog_events'],
    'segments':             ['meta_ad_performance', 'ghl_contacts'],
    'geo-intel':            ['mat_geo_revenue'],
    'wistia':               ['posthog_events'],
    'experiments':          ['posthog_events'],
    'retargeting':          ['meta_ad_performance', 'posthog_events'],
    'competitors':          ['meta_ad_performance'],
    'worklists':            ['ghl_contacts', 'sheets_bookings'],
    'ma-funnel':            ['mat_pipeline', 'stripe_transactions'],
  };

  // Client-side cache for data freshness (30 min TTL)
  let _freshnessCache = null;
  let _freshnessCachedAt = 0;
  const FRESHNESS_TTL = 30 * 60 * 1000; // 30 min

  /**
   * Build current filter params for API calls.
   */
  function getFilterParams() {
    if (typeof Filters === 'undefined') return {};
    return Filters.getState();
  }

  /**
   * Query the Cloud Function API (with cache + dedup).
   * @param {string} page   - Dashboard page name
   * @param {string} query  - Query name within that page
   * @param {Object} params - Additional params to merge with filters
   * @returns {Promise<Array>} data array from response
   */
  async function query(page, queryName, params = {}) {
    const filterParams = getFilterParams();
    const allParams = { page, query: queryName, ...filterParams, ...params };

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== null && v !== undefined && v !== '') {
        qs.set(k, String(v));
      }
    }

    const url = `${BASE_URL}?${qs.toString()}`;
    const cacheKey = url;

    // Return cached if fresh
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data;
    }

    // Deduplicate in-flight requests
    if (_inflight.has(cacheKey)) {
      return _inflight.get(cacheKey);
    }

    const promise = _fetchAndCache(url, cacheKey, page, queryName);
    _inflight.set(cacheKey, promise);
    promise.finally(() => _inflight.delete(cacheKey));
    return promise;
  }

  async function _fetchAndCache(url, cacheKey, page, queryName) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[API] ${res.status} for ${page}/${queryName}`);
        return [];
      }
      const json = await res.json();
      const data = json.data || [];
      const now = Date.now();
      _cache.set(cacheKey, { data, ts: now });
      _meta.set(`${page}:${queryName}`, {
        fetchedAt: now,
        cachedAt: json.cachedAt ? new Date(json.cachedAt).getTime() : now,
        fromCache: !!json.cached
      });
      return data;
    } catch (err) {
      console.warn(`[API] fetch error for ${page}/${queryName}:`, err.message);
      return [];
    }
  }

  function clearCache() {
    _cache.clear();
  }

  /**
   * Get last_updated_at timestamps for notification dots.
   * @returns {Promise<Object>} { page: timestamp, ... }
   */
  async function getLastUpdated() {
    try {
      const res = await fetch(`${BASE_URL}?query=lastUpdated`);
      if (!res.ok) return {};
      const json = await res.json();
      return json.data || {};
    } catch {
      return {};
    }
  }

  /**
   * Get metadata for a specific query (fetch timestamp, cache status).
   * @param {string} page
   * @param {string} queryName
   * @returns {{ fetchedAt: number, cachedAt: number, fromCache: boolean }|null}
   */
  function getQueryMeta(page, queryName) {
    return _meta.get(`${page}:${queryName}`) || null;
  }

  /**
   * Format a timestamp as relative time string (e.g. "3m ago", "2h ago").
   */
  function timeAgo(ts) {
    if (!ts) return 'unknown';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  /**
   * Get all tracked query metadata.
   */
  function getAllMeta() { return _meta; }

  /**
   * Fetch BQ table last-modified timestamps from the CF meta endpoint.
   * Cached client-side for 30 minutes.
   * @returns {Promise<Map<string, number>>} table_name -> epoch ms
   */
  async function getDataFreshness() {
    if (_freshnessCache && Date.now() - _freshnessCachedAt < FRESHNESS_TTL) {
      return _freshnessCache;
    }
    try {
      const rows = await query('meta', 'dataFreshness');
      const map = new Map();
      for (const row of rows) {
        // BQ TIMESTAMP may return as { value: string }, ISO string, or epoch number
        let ms = row.last_modified_ms;
        if (ms && typeof ms === 'object' && ms.value) ms = new Date(ms.value).getTime();
        else if (typeof ms === 'string') ms = new Date(ms).getTime();
        else if (typeof ms === 'number' && ms < 1e12) ms = ms * 1000; // seconds -> ms
        map.set(row.table_name, ms || 0);
      }
      _freshnessCache = map;
      _freshnessCachedAt = Date.now();
      return map;
    } catch {
      return new Map();
    }
  }

  /**
   * Get the oldest last_modified_ms across all tables for a given page.
   * Returns null if the page has no table mapping or freshness data is unavailable.
   * @param {string} page - Dashboard page name (must exist in PAGE_TABLES)
   * @returns {Promise<number|null>} epoch ms of oldest table, or null
   */
  async function getPageFreshness(page) {
    const tables = PAGE_TABLES[page] || [];
    const map = await getDataFreshness();
    if (!map.size) return null;
    // If page has no mapping, return newest timestamp across all tables
    if (!tables.length) {
      let newest = 0;
      for (const ts of map.values()) { if (ts > newest) newest = ts; }
      return newest || null;
    }
    let oldest = Infinity;
    for (const t of tables) {
      const ts = map.get(t);
      if (ts && ts < oldest) oldest = ts;
    }
    return oldest === Infinity ? null : oldest;
  }

  return { query, getFilterParams, getLastUpdated, getQueryMeta, getAllMeta, timeAgo, clearCache, BASE_URL, getDataFreshness, getPageFreshness, PAGE_TABLES };
})();
