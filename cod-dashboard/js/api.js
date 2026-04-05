/* ============================================
   API Client -- Cloud Function fetch wrapper
   ============================================ */

const API = (() => {
  const BASE_URL = 'https://us-central1-green-segment-491604-j8.cloudfunctions.net/codDashboard';

  /**
   * Build current filter params for API calls.
   */
  function getFilterParams() {
    if (typeof Filters === 'undefined') return {};
    return Filters.getState();
  }

  /**
   * Query the Cloud Function API.
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

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[API] ${res.status} for ${page}/${queryName}`);
        return [];
      }
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn(`[API] fetch error for ${page}/${queryName}:`, err.message);
      return [];
    }
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

  return { query, getFilterParams, getLastUpdated, BASE_URL };
})();
