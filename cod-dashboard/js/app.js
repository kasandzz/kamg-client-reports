/* ============================================
   App -- SPA router, sidebar, auth gate, search, init
   Must be loaded LAST (after page scripts register)
   ============================================ */

const App = (() => {
  const AUTH_KEY = 'cod_auth';
  const AUTH_PASS = 'cod2026';

  // Page registry: { name: { init, title, section, icon } }
  const _pages = {};
  let _currentPage = null;

  // Sidebar nav items for search
  let _navItems = [];

  // ---- Page Registration ----

  /**
   * Pages call this to register themselves.
   * @param {string} name - URL-safe page name (e.g. 'war-room')
   * @param {Function} initFn - async function(container) called when page activates
   */
  function registerPage(name, initFn) {
    _pages[name] = { init: initFn };
  }

  /**
   * Navigate to a page.
   * @param {string} pageName
   * @param {Object} params - extra URL params
   */
  function navigate(pageName, params = {}) {
    if (!pageName) return;

    // Destroy existing charts when leaving page
    Theme.destroyAllCharts();

    // Close drill-down if open
    Components.closeDrillDown();

    _currentPage = pageName;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });

    // Expand submenu if navigating to a stage
    if (pageName.startsWith('stage-')) {
      const toggle = document.getElementById('nav-stages-toggle');
      const submenu = document.getElementById('nav-stages-submenu');
      if (toggle && submenu) {
        toggle.classList.add('open');
        submenu.hidden = false;
      }
    }

    // Update page title
    const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    const label = navItem ? navItem.querySelector('.nav-label')?.textContent : _titleCase(pageName);
    document.getElementById('page-title').textContent = label;
    document.title = `${label} | COD Command Center`;

    // Update URL
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', pageName);
    for (const [k, v] of Object.entries(params)) {
      if (v) urlParams.set(k, v); else urlParams.delete(k);
    }
    window.history.pushState(null, '', window.location.pathname + '?' + urlParams.toString());

    // Mark as viewed for notifications
    Notifications.markViewed(pageName);

    // Load page
    const container = document.getElementById('page-container');
    const pageEntry = _pages[pageName];

    if (pageEntry && pageEntry.init) {
      container.innerHTML = '';
      try {
        pageEntry.init(container);
      } catch (err) {
        console.error(`[App] page init error for ${pageName}:`, err);
        container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9888;&#65039;</span><p>Error loading page</p></div>`;
      }
    } else {
      // Page not yet implemented
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">&#128679;</span>
          <p>Page "${_titleCase(pageName)}" coming soon</p>
          <p class="text-muted" style="font-size:12px">This page will be implemented in a future update.</p>
        </div>
      `;
    }
  }

  function getCurrentPage() {
    return _currentPage;
  }

  // ---- Auth Gate ----

  function _initAuth() {
    const gate = document.getElementById('auth-gate');
    const shell = document.getElementById('app-shell');
    const form = document.getElementById('auth-form');

    // Check if already authenticated
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
    // Collect nav items for search
    _navItems = [];
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      _navItems.push({
        page: item.dataset.page,
        label: item.querySelector('.nav-label')?.textContent || '',
        icon: item.querySelector('.nav-icon')?.textContent || item.querySelector('.nav-sub-num')?.textContent || '',
        section: item.closest('.sidebar-nav')?.querySelector('.nav-section-label:last-of-type')?.textContent || '',
      });
    });

    // Build section map by walking DOM
    let currentSection = '';
    document.querySelectorAll('.sidebar-nav > *').forEach(el => {
      if (el.classList.contains('nav-section-label')) {
        currentSection = el.textContent;
      } else if (el.dataset && el.dataset.page) {
        const entry = _navItems.find(n => n.page === el.dataset.page);
        if (entry) entry.section = currentSection;
      }
    });
    // Also handle submenu items
    document.querySelectorAll('.nav-submenu .nav-item[data-page]').forEach(item => {
      const entry = _navItems.find(n => n.page === item.dataset.page);
      if (entry) entry.section = 'CUSTOMER JOURNEY';
    });

    // Click handlers
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
      });
    });

    // Collapsible stages submenu
    const toggle = document.getElementById('nav-stages-toggle');
    const submenu = document.getElementById('nav-stages-submenu');
    if (toggle && submenu) {
      toggle.addEventListener('click', () => {
        const isOpen = toggle.classList.toggle('open');
        submenu.hidden = !isOpen;
      });
    }

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // Close sidebar on nav click (mobile)
      document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
          }
        });
      });
    }
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
        ? _navItems.filter(n => n.label.toLowerCase().includes(q) || n.page.includes(q))
        : _navItems;

      results.innerHTML = filtered.map((item, i) => `
        <div class="search-result-item${i === focusedIdx ? ' focused' : ''}" data-page="${item.page}" data-idx="${i}">
          <span class="search-result-icon">${item.icon}</span>
          <span>${_highlightMatch(item.label, q)}</span>
          <span class="search-result-section">${item.section}</span>
        </div>
      `).join('');

      // Click handlers
      results.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
          navigate(el.dataset.page);
          close();
        });
      });
    }

    function _highlightMatch(text, query) {
      if (!query) return text;
      const idx = text.toLowerCase().indexOf(query);
      if (idx === -1) return text;
      return text.slice(0, idx) + '<strong style="color:#e2e8f0">' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
    }

    // Input handler
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
          navigate(items[focusedIdx].dataset.page);
          close();
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

    // Close on backdrop click
    if (backdrop) backdrop.addEventListener('click', close);

    // Sidebar search button
    if (searchBtn) searchBtn.addEventListener('click', open);

    // Cmd+K / Ctrl+K
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

  // ---- Init ----

  function _initApp() {
    _initSidebar();
    _initSearch();

    // Re-init filters (they may have rendered before shell was visible)
    Filters.init();

    // Start notification checks
    Notifications.startChecking();

    // Listen for filter changes to reload current page
    Filters.onChange(() => {
      if (_currentPage && _pages[_currentPage]) {
        navigate(_currentPage);
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page') || 'war-room';
      navigate(page);
    });

    // Navigate to initial page
    const params = new URLSearchParams(window.location.search);
    const initialPage = params.get('page') || 'war-room';
    navigate(initialPage);
  }

  // ---- Helpers ----
  function _titleCase(str) {
    return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', () => {
    const authed = _initAuth();
    if (authed) _initApp();
  });

  return { registerPage, navigate, getCurrentPage };
})();
