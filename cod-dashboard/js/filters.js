/* ============================================
   Filters -- Date range, custom date picker,
   dropdowns, URL sync
   ============================================ */

const Filters = (() => {
  // State
  let _days = 14;
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

  // Date picker state
  let _dpViewMonth = new Date().getMonth();
  let _dpViewYear = new Date().getFullYear();
  let _dpRangeStart = null;
  let _dpRangeEnd = null;
  const _dpToday = new Date();
  _dpToday.setHours(0,0,0,0);

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
    dateGroup.id = 'filter-date-presets';
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

    // Show Calculations toggle
    container.appendChild(_el('div', 'filter-divider'));
    const calcLabel = _el('label', 'filter-checkbox');
    const calcCb = document.createElement('input');
    calcCb.type = 'checkbox';
    calcCb.checked = false;
    calcCb.addEventListener('change', () => {
      document.body.classList.toggle('show-calcs', calcCb.checked);
    });
    calcLabel.appendChild(calcCb);
    calcLabel.appendChild(document.createTextNode('Show calculations'));
    container.appendChild(calcLabel);

    // Custom Date Picker
    const dpWrap = _el('div', 'dp-wrap');

    const dpTrigger = _el('button', 'dp-trigger');
    dpTrigger.id = 'dp-trigger';
    dpTrigger.textContent = 'Custom';
    dpWrap.appendChild(dpTrigger);

    const dpDropdown = _el('div', 'dp-dropdown');
    dpDropdown.id = 'dp-dropdown';
    dpDropdown.innerHTML = `
      <div style="display:flex;flex-direction:column;flex:1;">
        <div class="dp-cal" id="dp-cal"></div>
        <div class="dp-footer">
          <span class="dp-footer__label" id="dp-range-label">Select start date</span>
          <div class="dp-footer__actions">
            <button class="dp-btn dp-btn--ghost" id="dp-cancel">Cancel</button>
            <button class="dp-btn dp-btn--primary" id="dp-apply">Apply</button>
          </div>
        </div>
      </div>
      <div class="dp-side" id="dp-side"></div>
    `;
    dpWrap.appendChild(dpDropdown);
    container.appendChild(dpWrap);

    // Wire date picker
    _initDatePicker(dpTrigger, dpDropdown, dateGroup);
  }

  // ---- Date Picker Logic ----

  function _initDatePicker(trigger, dropdown, presetGroup) {
    const cal = document.getElementById('dp-cal');
    const side = document.getElementById('dp-side');
    const cancelBtn = document.getElementById('dp-cancel');
    const applyBtn = document.getElementById('dp-apply');
    const rangeLabel = document.getElementById('dp-range-label');

    function fmtDate(d) {
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    function fmtDisplay(d) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    function updateLabel() {
      if (_dpRangeStart && _dpRangeEnd) {
        rangeLabel.textContent = fmtDisplay(_dpRangeStart) + ' \u2013 ' + fmtDisplay(_dpRangeEnd);
      } else if (_dpRangeStart) {
        rangeLabel.textContent = fmtDisplay(_dpRangeStart) + ' \u2013 Select end';
      } else {
        rangeLabel.textContent = 'Select start date';
      }
    }

    function buildSide() {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      let html = '';
      [2026, 2025].forEach((yr, yi) => {
        html += '<div class="dp-side__year-label">' + yr + '</div>';
        const startM = yr === 2026 ? new Date().getMonth() : 11;
        for (let m = startM; m >= 0; m--) {
          const isActive = (_dpViewYear === yr && _dpViewMonth === m);
          html += '<button class="dp-side__month' + (isActive ? ' dp-side__month--active' : '') + '" data-yr="' + yr + '" data-mo="' + m + '">' + months[m] + '</button>';
        }
        if (yi === 0) html += '<div class="dp-side__divider"></div>';
      });
      side.innerHTML = html;
      side.querySelectorAll('.dp-side__month').forEach(btn => {
        btn.addEventListener('click', () => {
          _dpViewYear = parseInt(btn.dataset.yr);
          _dpViewMonth = parseInt(btn.dataset.mo);
          buildCal();
          buildSide();
        });
      });
    }

    function buildCal() {
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const dows = ['Mo','Tu','We','Th','Fr','Sa','Su'];
      const firstDay = new Date(_dpViewYear, _dpViewMonth, 1);
      const lastDay = new Date(_dpViewYear, _dpViewMonth + 1, 0);
      const startDow = (firstDay.getDay() + 6) % 7;
      const totalDays = lastDay.getDate();

      let html = '<div class="dp-cal__nav">' +
        '<button class="dp-cal__nav-btn" id="dp-prev">&#8249;</button>' +
        '<span class="dp-cal__month-label">' + monthNames[_dpViewMonth] + ' ' + _dpViewYear + '</span>' +
        '<button class="dp-cal__nav-btn" id="dp-next">&#8250;</button>' +
      '</div><div class="dp-cal__grid">';

      dows.forEach(d => { html += '<div class="dp-cal__dow">' + d + '</div>'; });

      // Previous month fill
      const prevLastDay = new Date(_dpViewYear, _dpViewMonth, 0).getDate();
      for (let p = startDow - 1; p >= 0; p--) {
        const pd = new Date(_dpViewYear, _dpViewMonth - 1, prevLastDay - p);
        html += '<button class="dp-cal__day dp-cal__day--other" data-date="' + fmtDate(pd) + '">' + (prevLastDay - p) + '</button>';
      }

      // Hyros attribution start date
      const HYROS_START = new Date(2026, 2, 10); // March 10, 2026

      // Current month
      for (let d = 1; d <= totalDays; d++) {
        const dt = new Date(_dpViewYear, _dpViewMonth, d);
        let cls = 'dp-cal__day';
        if (dt.getTime() === _dpToday.getTime()) cls += ' dp-cal__day--today';
        if (dt.getTime() === HYROS_START.getTime()) cls += ' dp-cal__day--hyros';
        if (_dpRangeStart && _dpRangeEnd) {
          const t = dt.getTime(), s = _dpRangeStart.getTime(), e = _dpRangeEnd.getTime();
          if (t === s && t === e) cls += ' dp-cal__day--selected';
          else if (t === s) cls += ' dp-cal__day--range-start';
          else if (t === e) cls += ' dp-cal__day--range-end';
          else if (t > s && t < e) cls += ' dp-cal__day--in-range';
        } else if (_dpRangeStart && dt.getTime() === _dpRangeStart.getTime()) {
          cls += ' dp-cal__day--selected';
        }
        const hyrosTitle = dt.getTime() === HYROS_START.getTime() ? ' title="Hyros attribution started"' : '';
        html += '<button class="' + cls + '"' + hyrosTitle + ' data-date="' + fmtDate(dt) + '">' + d + '</button>';
      }

      // Next month fill
      const cells = startDow + totalDays;
      const remaining = (7 - (cells % 7)) % 7;
      for (let n = 1; n <= remaining; n++) {
        const nd = new Date(_dpViewYear, _dpViewMonth + 1, n);
        html += '<button class="dp-cal__day dp-cal__day--other" data-date="' + fmtDate(nd) + '">' + n + '</button>';
      }

      html += '</div>';

      // Hyros sticky note -- show when viewing March 2026 or later
      if (_dpViewYear > 2026 || (_dpViewYear === 2026 && _dpViewMonth >= 2)) {
        if (_dpViewYear === 2026 && _dpViewMonth === 2) {
          html += '<div class="dp-hyros-note">&#128205; <span><strong>Mar 10</strong> -- Hyros attribution started. Data before this date lacks source tracking.</span></div>';
        }
      } else {
        html += '<div class="dp-hyros-note" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2);border-left-color:#ef4444;color:#ef4444">&#9888;&#65039; <span>Pre-Hyros period -- no attribution data available. Hyros started <strong>Mar 10, 2026</strong>.</span></div>';
      }

      cal.innerHTML = html;

      // Nav buttons
      document.getElementById('dp-prev').addEventListener('click', () => {
        _dpViewMonth--;
        if (_dpViewMonth < 0) { _dpViewMonth = 11; _dpViewYear--; }
        buildCal(); buildSide();
      });
      document.getElementById('dp-next').addEventListener('click', () => {
        _dpViewMonth++;
        if (_dpViewMonth > 11) { _dpViewMonth = 0; _dpViewYear++; }
        buildCal(); buildSide();
      });

      // Day clicks
      cal.querySelectorAll('.dp-cal__day').forEach(btn => {
        btn.addEventListener('click', () => {
          const parts = btn.dataset.date.split('-');
          const clicked = new Date(+parts[0], +parts[1]-1, +parts[2]);
          if (!_dpRangeStart || _dpRangeEnd) {
            _dpRangeStart = clicked;
            _dpRangeEnd = null;
          } else {
            if (clicked < _dpRangeStart) {
              _dpRangeEnd = _dpRangeStart;
              _dpRangeStart = clicked;
            } else {
              _dpRangeEnd = clicked;
            }
          }
          _dpViewMonth = clicked.getMonth();
          _dpViewYear = clicked.getFullYear();
          updateLabel();
          buildCal();
          buildSide();
        });
      });
    }

    function closeDP() {
      dropdown.classList.remove('dp-dropdown--open');
      trigger.classList.remove('dp-trigger--active');
    }

    // Toggle
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('dp-dropdown--open');
      trigger.classList.toggle('dp-trigger--active', isOpen);
      if (isOpen) { buildCal(); buildSide(); }
    });

    // Cancel
    cancelBtn.addEventListener('click', () => {
      _dpRangeStart = null; _dpRangeEnd = null;
      updateLabel(); closeDP();
    });

    // Apply
    applyBtn.addEventListener('click', () => {
      if (!_dpRangeStart || !_dpRangeEnd) return;
      // Deactivate preset buttons
      presetGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      trigger.classList.add('dp-trigger--active');
      trigger.textContent = fmtDisplay(_dpRangeStart) + ' \u2013 ' + fmtDisplay(_dpRangeEnd);
      // Calculate days and set
      const diffDays = Math.round((_dpRangeEnd - _dpRangeStart) / 86400000) + 1;
      _days = Math.max(diffDays, 1);
      _syncToURL();
      _notify();
      closeDP();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== trigger) closeDP();
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    // Reset custom trigger when a preset is clicked
    presetGroup.addEventListener('click', () => {
      trigger.textContent = 'Custom';
      trigger.classList.remove('dp-trigger--active');
      _dpRangeStart = null; _dpRangeEnd = null;
      updateLabel();
    });
  }

  // ---- Preset handling ----

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

  // ---- URL sync ----
  function _readFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('days')) _days = parseInt(params.get('days'), 10) || 14;
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
  function getCompare() { return _compare; }

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

  return { getDays, getCloser, getChannel, getVip, getCompare, getState, onChange, init };
})();
