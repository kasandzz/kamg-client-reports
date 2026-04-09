/* ============================================
   Notifications -- Green dots for fresh data
   ============================================ */

const Notifications = (() => {
  const STORAGE_KEY = 'cod_viewed_timestamps';
  const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  let _intervalId = null;

  /**
   * Mark a page as viewed (stores current timestamp).
   */
  function markViewed(page) {
    const timestamps = _getTimestamps();
    timestamps[page] = Date.now();
    _saveTimestamps(timestamps);
    _hideDot(page);
  }

  /**
   * Start periodic checking of BQ last_updated_at.
   */
  function startChecking() {
    _check(); // initial check
    if (_intervalId) clearInterval(_intervalId);
    _intervalId = setInterval(_check, CHECK_INTERVAL);
  }

  function stopChecking() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  }

  async function _check() {
    try {
      const lastUpdated = await API.getLastUpdated();
      if (!lastUpdated || typeof lastUpdated !== 'object') return;

      const viewed = _getTimestamps();

      for (const [page, updatedAt] of Object.entries(lastUpdated)) {
        const updatedTs = new Date(updatedAt).getTime();
        const viewedTs = viewed[page] || 0;

        if (updatedTs > viewedTs) {
          _showDot(page);
        } else {
          _hideDot(page);
        }
      }
    } catch {
      // Silent fail -- dots are nice-to-have
    }
  }

  function _showDot(page) {
    const navItem = document.querySelector(`.nav-item[data-page="${page}"] .nav-dot`);
    if (navItem) navItem.hidden = false;
  }

  function _hideDot(page) {
    const navItem = document.querySelector(`.nav-item[data-page="${page}"] .nav-dot`);
    if (navItem) navItem.hidden = true;
  }

  function _getTimestamps() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function _saveTimestamps(ts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ts));
    } catch {
      // localStorage full or unavailable
    }
  }

  return { markViewed, startChecking, stopChecking };
})();
