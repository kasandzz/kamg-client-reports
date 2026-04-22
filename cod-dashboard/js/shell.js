/* ============================================
   Shell -- Injects common layout (auth, sidebar,
   top bar, drill-down, search) into each page HTML.
   Replaces the SPA router from app.js.
   ============================================ */

const Shell = (() => {
  const AUTH_KEY = 'cod_auth';
  const AUTH_PASS = 'cod2026';

  // Navigation structure (mirrors index.html sidebar)
  const NAV = [
    { section: 'COMMAND', items: [
      { page: 'war-room',   icon: '&#127919;', label: 'War Room' },
      { page: 'revenue', icon: '&#128176;', label: 'Revenue & LTV' },
      { page: 'cold-email', icon: '&#9993;&#65039;', label: 'Email' },
    ]},
    { section: 'ACQUISITION', items: [
      { page: 'ads-meta',    icon: '&#128227;', label: 'Meta Ads' },
      { page: 'ads-google',  icon: '&#128270;', label: 'Google Ads', dimmed: true },
      { page: 'attribution', icon: '&#128200;', label: 'Attribution', dimmed: true },
    ]},
    { section: 'CONVERSION', items: [
      { page: 'funnels',     icon: '&#127744;', label: '$27 Funnel' },
      { page: 'ma-funnel',   icon: '&#127891;', label: 'MA/VSL Funnel', dimmed: true },
      { page: 'sales-team',  icon: '&#128101;', label: 'Sales Team', dimmed: true },
      { page: 'experiments', icon: '&#129514;', label: 'Experiments', dimmed: true },
    ]},
    { section: 'INTELLIGENCE', items: [
      { page: 'segments',         icon: '&#128202;', label: 'Segments' },
      { page: 'journey-explorer', icon: '&#128279;', label: 'Journey Explorer', dimmed: true },
    ]},
    { section: 'OPERATIONS', items: [
      { page: 'live-feed',   icon: '&#9889;',   label: 'Live Feed' },
      { page: 'data-health', icon: '&#129681;', label: 'Data Health', dimmed: true },
    ]},
    { section: 'COMING SOON', sectionStyle: 'opacity:0.4', items: [
      { page: 'competitors', icon: '&#9876;&#65039;', label: 'Competitors', disabled: true },
    ]},
  ];

  // Flatten for search
  const ALL_PAGES = NAV.flatMap(s => s.items.map(i => ({ ...i, section: s.section })));

  let _currentPage = null;

  /**
   * Resolve the base path to the dashboard root.
   * Works whether at /cod-dashboard/pages/foo.html or /cod-dashboard/index.html
   */
  function _basePath() {
    const path = window.location.pathname;
    if (path.includes('/pages/')) return '../';
    return './';
  }

  function _pageHref(pageName) {
    const params = new URLSearchParams(window.location.search);
    params.delete('page');
    const qs = params.toString();
    return `${_basePath()}pages/${pageName}.html${qs ? '?' + qs : ''}`;
  }

  // ---- Shell HTML ----

  function _buildShellHTML(pageName) {
    const pageInfo = ALL_PAGES.find(p => p.page === pageName) || { label: pageName, icon: '' };

    // Build nav HTML
    let navHTML = '';
    for (const section of NAV) {
      const sStyle = section.sectionStyle ? ` style="${section.sectionStyle}"` : '';
      navHTML += `<div class="nav-section-label"${sStyle}>${section.section}</div>\n`;
      for (const item of section.items) {
        const active = item.page === pageName ? ' active' : '';
        const dimmed = item.dimmed ? ' dimmed' : '';
        const disabled = item.disabled ? ' style="opacity:0.35;pointer-events:none;cursor:default"' : '';
        navHTML += `<a class="nav-item${active}${dimmed}" href="${_pageHref(item.page)}" data-page="${item.page}"${disabled}><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span><span class="nav-dot" hidden></span></a>\n`;
      }
    }

    return `
    <!-- Auth Gate -->
    <div id="auth-gate" class="auth-gate">
      <div class="auth-card card">
        <h2 class="auth-title">COD Command Center</h2>
        <p class="auth-subtitle">Enter password to continue</p>
        <form id="auth-form" autocomplete="off">
          <input type="password" id="auth-password" class="auth-input" placeholder="Password" autofocus>
          <button type="submit" class="auth-btn">Enter</button>
          <p id="auth-error" class="auth-error" hidden>Incorrect password</p>
        </form>
      </div>
    </div>

    <!-- Main App Shell -->
    <div id="app-shell" class="app-shell" hidden>
      <!-- Sidebar -->
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
          <a href="${_basePath()}pages/war-room.html" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:8px">
            <span class="sidebar-logo">&#127919;</span>
            <span class="sidebar-title">COD Command</span>
          </a>
        </div>

        <button id="sidebar-search-btn" class="sidebar-search-btn" aria-label="Search pages (Ctrl+K)">
          <span class="sidebar-search-icon">&#128269;</span>
          <span class="sidebar-search-text">Search...</span>
          <kbd class="sidebar-kbd">&#8984;K</kbd>
        </button>

        <nav class="sidebar-nav" id="sidebar-nav">
          ${navHTML}
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <!-- Top Bar -->
        <header class="top-bar">
          <button id="sidebar-toggle" class="sidebar-toggle" aria-label="Toggle sidebar">&#9776;</button>
          <h1 id="page-title" class="page-title">${pageInfo.label}</h1>
          <div id="global-controls" class="global-controls"></div>
        </header>

        <!-- Page Container -->
        <div id="page-container" class="page-container">
          <div class="page-placeholder">
            <div class="spinner"></div>
            <p class="text-muted">Loading...</p>
          </div>
        </div>
      </main>

      <!-- Drill-Down Panel -->
      <div id="drill-down-panel" class="drill-down-panel" hidden>
        <div class="drill-down-header">
          <h3 id="drill-down-title" class="drill-down-title"></h3>
          <button id="drill-down-close" class="drill-down-close" aria-label="Close panel">&times;</button>
        </div>
        <div id="drill-down-content" class="drill-down-content"></div>
      </div>

      <!-- Search Modal -->
      <div id="search-modal" class="search-modal" hidden>
        <div class="search-backdrop"></div>
        <div class="search-dialog card">
          <input type="text" id="search-input" class="search-input" placeholder="Search pages..." autocomplete="off">
          <div id="search-results" class="search-results"></div>
        </div>
      </div>
    </div>`;
  }

  // ---- Auth ----

  function _initAuth() {
    const gate = document.getElementById('auth-gate');
    const shell = document.getElementById('app-shell');
    const form = document.getElementById('auth-form');

    if (localStorage.getItem(AUTH_KEY) === 'true') {
      gate.hidden = true;
      shell.hidden = false;
      return true;
    }

    gate.hidden = false;
    shell.hidden = true;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const pw = document.getElementById('auth-password').value;
      if (pw === AUTH_PASS) {
        localStorage.setItem(AUTH_KEY, 'true');
        gate.hidden = true;
        shell.hidden = false;
        _initApp();
      } else {
        document.getElementById('auth-error').hidden = false;
        document.getElementById('auth-password').value = '';
        document.getElementById('auth-password').focus();
      }
    });

    return false;
  }

  // ---- Sidebar ----

  function _initSidebar() {
    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
          }
        });
      });
    }

    // Preserve filter params when clicking nav links
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        window.location.href = _pageHref(page);
      });
    });
  }

  // ---- Search Modal ----

  function _initSearch() {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const backdrop = modal?.querySelector('.search-backdrop');
    const searchBtn = document.getElementById('sidebar-search-btn');
    let focusedIdx = -1;

    function open() {
      if (!modal) return;
      modal.hidden = false;
      input.value = '';
      _renderSearchResults('');
      focusedIdx = -1;
      requestAnimationFrame(() => input.focus());
    }

    function close() {
      if (!modal) return;
      modal.hidden = true;
    }

    function _renderSearchResults(query) {
      const q = query.toLowerCase().trim();
      const filtered = q
        ? ALL_PAGES.filter(n => n.label.toLowerCase().includes(q) || n.page.includes(q))
        : ALL_PAGES;

      results.innerHTML = filtered.map((item, i) => `
        <div class="search-result-item${i === focusedIdx ? ' focused' : ''}" data-page="${item.page}" data-idx="${i}">
          <span class="search-result-icon">${item.icon}</span>
          <span>${_highlightMatch(item.label, q)}</span>
          <span class="search-result-section">${item.section}</span>
        </div>
      `).join('');

      results.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
          window.location.href = _pageHref(el.dataset.page);
        });
      });
    }

    function _highlightMatch(text, query) {
      if (!query) return text;
      const idx = text.toLowerCase().indexOf(query);
      if (idx === -1) return text;
      return text.slice(0, idx) + '<strong style="color:#e2e8f0">' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
    }

    if (input) {
      input.addEventListener('input', () => {
        focusedIdx = -1;
        _renderSearchResults(input.value);
      });

      input.addEventListener('keydown', (e) => {
        const items = results.querySelectorAll('.search-result-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          focusedIdx = Math.min(focusedIdx + 1, items.length - 1);
          _updateFocus(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          focusedIdx = Math.max(focusedIdx - 1, 0);
          _updateFocus(items);
        } else if (e.key === 'Enter' && focusedIdx >= 0 && items[focusedIdx]) {
          window.location.href = _pageHref(items[focusedIdx].dataset.page);
        } else if (e.key === 'Escape') {
          close();
        }
      });
    }

    function _updateFocus(items) {
      items.forEach((el, i) => el.classList.toggle('focused', i === focusedIdx));
      if (items[focusedIdx]) {
        items[focusedIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    if (backdrop) backdrop.addEventListener('click', close);
    if (searchBtn) searchBtn.addEventListener('click', open);

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (modal && !modal.hidden) close();
        else open();
      }
      if (e.key === 'Escape' && modal && !modal.hidden) {
        close();
      }
    });
  }

  // ---- App init (post-auth) ----

  function _initApp() {
    _initSidebar();
    _initSearch();
    Filters.init();
    Notifications.startChecking();

    // Mark this page as viewed
    Notifications.markViewed(_currentPage);

    // Init drill-down close button
    const closeBtn = document.getElementById('drill-down-close');
    if (closeBtn) closeBtn.addEventListener('click', () => Components.closeDrillDown());

    // Listen for filter changes to reload current page
    Filters.onChange(() => {
      API.clearCache();
      const pageEntry = _pages[_currentPage];
      if (pageEntry && pageEntry.init) {
        Theme.destroyAllCharts();
        Components.closeDrillDown();
        const container = document.getElementById('page-container');
        container.innerHTML = '';
        pageEntry.init(container);
      }
    });

    // Auto-stamp cards with sync time via MutationObserver
    _initSyncStamps();

    // Load the page + lineage legend
    _loadCurrentPage();
    _injectLineage();
  }

  // ---- Page registry (keeps existing App.registerPage API) ----
  const _pages = {};

  function registerPage(name, initFn) {
    _pages[name] = { init: initFn };
  }

  function _loadCurrentPage() {
    const container = document.getElementById('page-container');
    const pageEntry = _pages[_currentPage];

    if (pageEntry && pageEntry.init) {
      container.innerHTML = '';
      try {
        pageEntry.init(container);
      } catch (err) {
        console.error(`[Shell] page init error for ${_currentPage}:`, err);
        container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9888;&#65039;</span><p>Error loading page</p></div>`;
      }
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">&#128679;</span>
          <p>Page not yet loaded</p>
          <p class="text-muted" style="font-size:12px">The page script may not be included in this HTML file.</p>
        </div>
      `;
    }
  }

  /**
   * Navigate to another page (real navigation, not SPA).
   * Kept for backwards-compat with page scripts that call App.navigate().
   */
  function navigate(pageName, params = {}) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('page');
    for (const [k, v] of Object.entries(params)) {
      if (v) urlParams.set(k, v); else urlParams.delete(k);
    }
    const qs = urlParams.toString();
    window.location.href = `${_basePath()}pages/${pageName}.html${qs ? '?' + qs : ''}`;
  }

  function getCurrentPage() {
    return _currentPage;
  }

  // ---- Lineage legend injection ----

  function _injectLineage() {
    const container = document.getElementById('page-container');
    if (!container || !_currentPage) return;

    function _tryInject() {
      if (typeof Lineage === 'undefined') return false;
      if (container.querySelector('.lineage-legend')) return true;
      // Wait until page has fully rendered: multiple cards AND no spinner
      const cards = container.querySelectorAll('.card');
      const spinner = container.querySelector('.spinner');
      if (cards.length < 2 || spinner) return false;
      const legend = Lineage.render(_currentPage);
      if (legend) { container.appendChild(legend); return true; }
      return false;
    }

    // Poll until page is fully loaded (handles async page init + async Lineage script)
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (_tryInject() || attempts > 40) clearInterval(poll);
    }, 500);
  }

  // ---- Sync stamp auto-injection ----

  function _initSyncStamps() {
    const container = document.getElementById('page-container');
    if (!container) return;

    let _stampLabel = 'Loading...';
    let _stampClass = '';

    // Preload freshness data eagerly on page init
    const page = _currentPage || 'war-room';
    API.getPageFreshness(page).then(ts => {
      if (ts) {
        const d = new Date(ts);
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const day = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const ageH = (Date.now() - ts) / (1000 * 60 * 60);
        _stampLabel = `Data as of ${day} ${time}`;
        _stampClass = ageH < 1 ? 'sync-stamp--fresh' : ageH < 6 ? 'sync-stamp--warn' : 'sync-stamp--stale';
      } else {
        _stampLabel = 'Freshness unknown';
        _stampClass = '';
      }
      // Retroactively update any dots already on the page
      container.querySelectorAll('.sync-stamp').forEach(dot => {
        dot.setAttribute('data-tooltip', _stampLabel);
        dot.classList.remove('sync-stamp--fresh', 'sync-stamp--warn', 'sync-stamp--stale');
        if (_stampClass) dot.classList.add(_stampClass);
      });
    });

    function _stampCard(card) {
      if (card._syncStamped) return;
      card._syncStamped = true;
      card.style.position = 'relative';

      const dot = document.createElement('div');
      dot.className = 'sync-stamp' + (_stampClass ? ' ' + _stampClass : '');
      dot.setAttribute('data-tooltip', _stampLabel);
      card.appendChild(dot);
    }

    // Stamp existing cards
    container.querySelectorAll('.card').forEach(_stampCard);

    // Watch for new cards
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.classList && node.classList.contains('card')) _stampCard(node);
          if (node.querySelectorAll) node.querySelectorAll('.card').forEach(_stampCard);
        }
      }
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  // ---- Main entry point ----

  function initPage(pageName) {
    _currentPage = pageName;
    document.title = `${(ALL_PAGES.find(p => p.page === pageName) || {}).label || pageName} | COD Command Center`;

    // Load lineage.js dynamically if not already loaded
    if (typeof Lineage === 'undefined') {
      const s = document.createElement('script');
      s.src = (window.location.pathname.includes('/pages/') ? '../' : './') + 'js/lineage.js';
      document.head.appendChild(s);
    }

    // Inject shell HTML into body
    document.body.insertAdjacentHTML('afterbegin', _buildShellHTML(pageName));

    // Boot
    const authed = _initAuth();
    if (authed) _initApp();
  }

  return { initPage, registerPage, navigate, getCurrentPage };
})();

// Backwards-compat: pages use App.registerPage() and App.navigate()
const App = {
  registerPage: Shell.registerPage,
  navigate: Shell.navigate,
  getCurrentPage: Shell.getCurrentPage,
};
