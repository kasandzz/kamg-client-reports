/* ============================================
   API Client -- Cloud Function fetch wrapper
   ============================================ */

const API = (() => {
  const BASE_URL = 'https://us-central1-green-segment-491604-j8.cloudfunctions.net/codDashboard';
  const CACHE_TTL = 5 * 60 * 1000; // 5 min
  const _cache = new Map();
  const _inflight = new Map();
  const _meta = new Map(); // page:query -> { fetchedAt, cachedAt, fromCache }

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

  return { query, getFilterParams, getLastUpdated, getQueryMeta, getAllMeta, timeAgo, clearCache, BASE_URL };
})();
