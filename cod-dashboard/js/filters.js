/* ============================================
   Filters -- Date range, dropdowns, URL sync
   ============================================ */

const Filters = (() => {
  // State
  let _days = 30;
  let _closer = '';
  let _channel = '';
  let _vip = '';
  let _compare = false;
  const _listeners = [];

  const DATE_PRESETS = [
    { label: '7D',  days: 7 },
    { label: '14D', days: 14 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: 'MTD', days: 'mtd' },
    { label: 'YTD', days: 'ytd' },
  ];

  const CLOSERS = [
    { value: '', label: 'All Closers' },
    { value: 'dorian', label: 'Dorian' },
    { value: 'matt', label: 'Matt' },
  ];

  const CHANNELS = [
    { value: '', label: 'All Channels' },
    { value: 'paid_meta', label: 'Paid Meta' },
    { value: 'organic', label: 'Organic' },
    { value: 'referral', label: 'Referral' },
    { value: 'direct', label: 'Direct' },
    { value: 'cold_email', label: 'Cold Email' },
  ];

  const VIP_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'vip', label: 'VIP Only' },
    { value: 'non-vip', label: 'Non-VIP Only' },
  ];

  /**
   * Initialize filter controls into #global-controls.
   */
  function init() {
    _readFromURL();
    const container = document.getElementById('global-controls');
    if (!container) return;

    container.innerHTML = '';

    // Date presets
    const dateGroup = _el('div', 'filter-group');
    DATE_PRESETS.forEach(preset => {
      const btn = _el('button', 'filter-btn');
      btn.textContent = preset.label;
      btn.dataset.days = preset.days;
      if (_matchPreset(preset)) btn.classList.add('active');
      btn.addEventListener('click', () => _setDays(preset, dateGroup));
      dateGroup.appendChild(btn);
    });
    container.appendChild(dateGroup);

    // Divider
    container.appendChild(_el('div', 'filter-divider'));

    // Compare toggle
    const compareLabel = _el('label', 'filter-checkbox');
    const compareCb = document.createElement('input');
    compareCb.type = 'checkbox';
    compareCb.checked = _compare;
    compareCb.addEventListener('change', () => {
      _compare = compareCb.checked;
      _syncToURL();
      _notify();
    });
    compareLabel.appendChild(compareCb);
    compareLabel.appendChild(document.createTextNode('Compare'));
    container.appendChild(compareLabel);

    // Divider
    container.appendChild(_el('div', 'filter-divider'));

    // Closer dropdown
    container.appendChild(_buildSelect('closer', CLOSERS, _closer, val => {
      _closer = val;
      _syncToURL();
      _notify();
    }));

    // Channel dropdown
    container.appendChild(_buildSelect('channel', CHANNELS, _channel, val => {
      _channel = val;
      _syncToURL();
      _notify();
    }));

    // VIP dropdown
    container.appendChild(_buildSelect('vip', VIP_OPTIONS, _vip, val => {
      _vip = val;
      _syncToURL();
      _notify();
    }));
  }

  function _setDays(preset, group) {
    if (preset.days === 'mtd') {
      const now = new Date();
      _days = now.getDate();
    } else if (preset.days === 'ytd') {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      _days = Math.ceil((now - start) / 86400000);
    } else {
      _days = preset.days;
    }

    // Update active state
    group.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.days == preset.days);
    });

    _syncToURL();
    _notify();
  }

  function _matchPreset(preset) {
    if (preset.days === 'mtd') return _days === new Date().getDate();
    if (preset.days === 'ytd') {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      return _days === Math.ceil((now - start) / 86400000);
    }
    return _days === preset.days;
  }

  function _buildSelect(name, options, currentValue, onChange) {
    const select = _el('select', 'filter-select');
    select.name = name;
    select.setAttribute('aria-label', name);
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === currentValue) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  // ---- URL sync ----
  function _readFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('days')) _days = parseInt(params.get('days'), 10) || 30;
    if (params.has('closer')) _closer = params.get('closer');
    if (params.has('channel')) _channel = params.get('channel');
    if (params.has('vip')) _vip = params.get('vip');
    if (params.has('compare')) _compare = params.get('compare') === '1';
  }

  function _syncToURL() {
    const params = new URLSearchParams(window.location.search);
    params.set('days', _days);
    if (_closer) params.set('closer', _closer); else params.delete('closer');
    if (_channel) params.set('channel', _channel); else params.delete('channel');
    if (_vip) params.set('vip', _vip); else params.delete('vip');
    if (_compare) params.set('compare', '1'); else params.delete('compare');
    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState(null, '', newURL);
  }

  // ---- Public getters ----
  function getDays() { return _days; }
  function getCloser() { return _closer; }
  function getChannel() { return _channel; }
  function getVip() { return _vip; }

  function getState() {
    return {
      days: _days,
      closer: _closer || undefined,
      channel: _channel || undefined,
      vip: _vip || undefined,
      compare: _compare ? '1' : undefined,
    };
  }

  // ---- Change listeners ----
  function onChange(fn) {
    _listeners.push(fn);
  }

  function _notify() {
    const state = getState();
    _listeners.forEach(fn => {
      try { fn(state); } catch (e) { console.warn('[Filters] listener error:', e); }
    });
  }

  // ---- Helpers ----
  function _el(tag, className) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { getDays, getCloser, getChannel, getVip, getState, onChange, init };
})();
