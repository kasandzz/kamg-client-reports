/* ============================================
   Live Feed -- real-time funnel event table
   Shows ticket sales, opt-ins, calls booked,
   enrollments with attribution + session links
   ============================================ */

(function () {
  const EVENT_META = {
    ticket_purchased: { emoji: '🎟', label: 'Ticket Purchased', color: '#6366f1' },
    vip_purchased:    { emoji: '🎟', label: 'Ticket & VIP',     color: '#f59e0b' },
    lead_created:     { emoji: '👤', label: 'Opt-In',           color: '#38bdf8' },
    call_booked:      { emoji: '📞', label: 'Call Booked',      color: '#a855f7' },
    lp_enrollment:    { emoji: '🎓', label: 'Enrollment',       color: '#22c55e' },
  };

  const SEGMENT_META = {
    'Therapist/Counselor': { icon: '🧠', color: '#a78bfa' },
    'Attorney':            { icon: '⚖️', color: '#60a5fa' },
    'Coach':               { icon: '🎯', color: '#f472b6' },
    'Educator':            { icon: '📚', color: '#34d399' },
    'Real Estate':         { icon: '🏠', color: '#fbbf24' },
    'Consultant':          { icon: '💼', color: '#818cf8' },
    'Fitness':             { icon: '💪', color: '#fb923c' },
    'Dentist':             { icon: '🦷', color: '#67e8f9' },
    'Chiropractor':        { icon: '🦴', color: '#c084fc' },
    'Med Spa':             { icon: '✨', color: '#f9a8d4' },
    'General':             { icon: '🌐', color: '#94a3b8' },
    'Unknown':             { icon: '?',  color: '#64748b' },
  };

  const VIP_TYPES = new Set(['vip_purchased']);
  const ENROLLMENT_TYPES = new Set(['lp_enrollment']);
  const ALLOWED_TYPES = new Set(['ticket_purchased', 'lead_created', 'call_booked', 'lp_enrollment', 'vip_purchased']);
  const SOUND_KEY = 'cod_enrollment_sound';

  // ---- Beep tone ----
  function _playBeep() {
    try {
      const sampleRate = 8000, duration = 0.25, frequency = 880;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
      writeStr(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      writeStr(36, 'data'); view.setUint32(40, numSamples * 2, true);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const fade = t < 0.05 ? t / 0.05 : (t > 0.2 ? (duration - t) / 0.05 : 1);
        view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * frequency * t) * 16383 * fade), true);
      }
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch(() => {});
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
    } catch (e) { /* silent fail */ }
  }

  // ---- Relative time ----
  function _relTime(ts) {
    if (!ts || typeof ts === 'object') return '--';
    const now = Date.now();
    const then = new Date(ts).getTime();
    const diffMs = now - then;
    if (isNaN(diffMs)) return String(ts);
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // ---- Parse payload safely ----
  function _payload(row) {
    try {
      return typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
    } catch (e) { return {}; }
  }

  function _contactName(row) {
    const p = _payload(row);
    if (p.customer_name) return p.customer_name;
    if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ');
    if (p.name) return p.name;
    return row.email || 'Unknown';
  }

  function _contactEmail(row) {
    const p = _payload(row);
    return p.email || row.email || '';
  }

  function _amount(row) {
    const p = _payload(row);
    const val = p.amount || p.revenue || p.value || null;
    if (val != null && !isNaN(parseFloat(val))) return parseFloat(val);
    return null;
  }

  function _isVip(row) {
    if (VIP_TYPES.has(row.event_type)) return true;
    const p = _payload(row);
    return !!(p.is_vip || p.vip || p.ticket_type === 'vip' || p.package === 'vip');
  }

  // ---- Extract attribution fields from payload ----
  function _firstAd(row) {
    const p = _payload(row);
    return p.first_ad || p.first_click_ad || p.utm_source_first || p.first_touch || '';
  }

  function _lastAd(row) {
    const p = _payload(row);
    return p.last_ad || p.last_click_ad || p.utm_source || p.last_touch || row.event_source || '';
  }

  function _conversionPage(row) {
    const p = _payload(row);
    return p.page || p.landing_page || p.conversion_page || p.url || '';
  }

  function _sessionUrl(row) {
    const p = _payload(row);
    // PostHog session recording link
    if (p.session_url) return p.session_url;
    if (p.posthog_session_id) return `https://us.posthog.com/replay/${p.posthog_session_id}`;
    if (p.session_id) return `https://us.posthog.com/replay/${p.session_id}`;
    // Fallback: search by email in PostHog
    const email = _contactEmail(row);
    if (email) return `https://us.posthog.com/persons?q=${encodeURIComponent(email)}`;
    return '';
  }

  // ---- Truncate long strings ----
  function _trunc(str, len) {
    if (!str) return '--';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  // ---- Inject styles ----
  function _injectStyles() {
    if (document.getElementById('lf-styles')) return;
    const style = document.createElement('style');
    style.id = 'lf-styles';
    style.textContent = `
      @keyframes lf-pulse-row {
        0%   { background: rgba(99,102,241,0.12); }
        100% { background: transparent; }
      }
      .lf-header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .lf-table-wrap {
        max-height: calc(100vh - 180px);
        overflow-y: auto;
        overflow-x: auto;
        padding-right: 4px;
      }
      .lf-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .lf-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 8px 10px;
        text-align: left;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: ${Theme.COLORS.textMuted};
        background: ${Theme.COLORS.bgCard};
        border-bottom: 1px solid ${Theme.COLORS.border};
        white-space: nowrap;
      }
      .lf-table td {
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.04);
        color: ${Theme.COLORS.textSecondary};
        vertical-align: middle;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lf-table tr:hover td {
        background: rgba(255,255,255,0.03);
      }
      .lf-table tr.lf-new td {
        animation: lf-pulse-row 3s ease-out;
      }
      .lf-event-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;
        font-size: 12px;
      }
      .lf-event-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .lf-vip {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #f59e0b;
        background: rgba(245,158,11,0.12);
        border-radius: 3px;
        padding: 1px 6px;
        border: 1px solid rgba(245,158,11,0.3);
        margin-left: 6px;
        cursor: help;
        position: relative;
      }
      .lf-vip-stats {
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 8px 14px;
        background: ${Theme.COLORS.bgCard};
        border: 1px solid ${Theme.COLORS.border};
        border-radius: 8px;
        font-size: 11px;
      }
      .lf-vip-bar-wrap {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 160px;
      }
      .lf-vip-bar-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        color: ${Theme.COLORS.textSecondary};
      }
      .lf-vip-bar-track {
        flex: 1;
        height: 6px;
        background: rgba(255,255,255,0.06);
        border-radius: 3px;
        overflow: hidden;
      }
      .lf-vip-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.4s ease;
      }
      .lf-segment {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.03em;
        padding: 2px 8px;
        border-radius: 10px;
        white-space: nowrap;
      }
      .lf-segment-icon {
        font-size: 11px;
        line-height: 1;
      }
      .lf-session-link {
        font-size: 11px;
        color: ${Theme.COLORS.accent};
        text-decoration: none;
      }
      .lf-session-link:hover {
        text-decoration: underline;
      }
      @media (max-width: 768px) {
        .lf-table-wrap { max-height: calc(100vh - 200px); }
        .lf-table { font-size: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  App.registerPage('live-feed', async (container) => {
    _injectStyles();

    let pollInterval = null;
    let lastEventIds = new Set();
    let currentFilter = '';
    let soundEnabled = localStorage.getItem(SOUND_KEY) === 'true';

    // ---- Header controls ----
    const header = document.createElement('div');
    header.className = 'lf-header';

    // Filter dropdown
    const filterLabel = document.createElement('label');
    filterLabel.style.cssText = `font-size:12px;color:${Theme.COLORS.textSecondary};display:flex;align-items:center;gap:6px`;
    filterLabel.textContent = 'Filter:';

    const filterSelect = document.createElement('select');
    filterSelect.style.cssText = `background:${Theme.COLORS.bgCard};color:${Theme.COLORS.textPrimary};border:1px solid ${Theme.COLORS.border};border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer`;

    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All Events';
    filterSelect.appendChild(allOpt);

    Object.entries(EVENT_META).forEach(([key, meta]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${meta.emoji} ${meta.label}`;
      filterSelect.appendChild(opt);
    });

    filterLabel.appendChild(filterSelect);
    header.appendChild(filterLabel);

    // Event count badge
    const countBadge = document.createElement('span');
    countBadge.style.cssText = `font-size:11px;color:${Theme.COLORS.textMuted};padding:4px 10px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid ${Theme.COLORS.border}`;
    countBadge.textContent = '0 events';
    header.appendChild(countBadge);

    // Sound toggle
    const soundLabel = document.createElement('label');
    soundLabel.style.cssText = `font-size:12px;color:${Theme.COLORS.textSecondary};display:flex;align-items:center;gap:6px;margin-left:auto;cursor:pointer`;

    const soundCheck = document.createElement('input');
    soundCheck.type = 'checkbox';
    soundCheck.checked = soundEnabled;
    soundCheck.style.cssText = 'cursor:pointer;accent-color:' + Theme.COLORS.accent;

    soundLabel.appendChild(soundCheck);
    soundLabel.appendChild(document.createTextNode('Enrollment sound'));
    header.appendChild(soundLabel);

    container.appendChild(header);

    // ---- VIP conversion stats bar ----
    const vipStatsBar = document.createElement('div');
    vipStatsBar.className = 'lf-vip-stats';
    vipStatsBar.style.display = 'none';
    container.appendChild(vipStatsBar);

    function _updateVipStats(rows) {
      const allPurchases = rows.filter(r => r.event_type === 'ticket_purchased' || r.event_type === 'vip_purchased');
      const totalBuyers = allPurchases.length;
      const vipRows = rows.filter(r => r.event_type === 'vip_purchased');
      const totalVip = vipRows.length;

      if (totalBuyers === 0) { vipStatsBar.style.display = 'none'; return; }

      let checkboxCount = 0, upsellCount = 0;
      vipRows.forEach(r => {
        const p = _payload(r);
        if (p.vip_source === 'checkout_checkbox') checkboxCount++;
        else upsellCount++;
      });

      const vipRate = ((totalVip / totalBuyers) * 100).toFixed(1);
      const cbRate = totalBuyers > 0 ? ((checkboxCount / totalBuyers) * 100).toFixed(1) : '0.0';
      const upRate = totalBuyers > 0 ? ((upsellCount / totalBuyers) * 100).toFixed(1) : '0.0';

      vipStatsBar.style.display = 'flex';
      vipStatsBar.innerHTML = `
        <div style="color:${Theme.COLORS.textMuted};font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;white-space:nowrap">
          VIP Uptake
        </div>
        <div style="font-size:18px;font-weight:700;color:#f59e0b;font-family:'JetBrains Mono',monospace;white-space:nowrap">
          ${vipRate}%
        </div>
        <div style="color:${Theme.COLORS.textMuted};font-size:10px;white-space:nowrap">
          ${totalVip} of ${totalBuyers} buyers
        </div>
        <div style="width:1px;height:24px;background:${Theme.COLORS.border};margin:0 4px"></div>
        <div class="lf-vip-bar-wrap">
          <div class="lf-vip-bar-row">
            <span style="min-width:70px">Checkbox</span>
            <div class="lf-vip-bar-track">
              <div class="lf-vip-bar-fill" style="width:${cbRate}%;background:#f59e0b"></div>
            </div>
            <span style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#f59e0b;min-width:38px;text-align:right">${cbRate}%</span>
            <span style="color:${Theme.COLORS.textMuted}">(${checkboxCount})</span>
          </div>
          <div class="lf-vip-bar-row">
            <span style="min-width:70px">Upsell pg</span>
            <div class="lf-vip-bar-track">
              <div class="lf-vip-bar-fill" style="width:${upRate}%;background:#a78bfa"></div>
            </div>
            <span style="font-family:'JetBrains Mono',monospace;font-weight:600;color:#a78bfa;min-width:38px;text-align:right">${upRate}%</span>
            <span style="color:${Theme.COLORS.textMuted}">(${upsellCount})</span>
          </div>
        </div>
      `;
    }

    // ---- Table container ----
    const tableWrap = document.createElement('div');
    tableWrap.className = 'card lf-table-wrap';
    tableWrap.style.cssText = 'padding:0';
    container.appendChild(tableWrap);

    // ---- Event handlers ----
    soundCheck.addEventListener('change', () => {
      soundEnabled = soundCheck.checked;
      localStorage.setItem(SOUND_KEY, soundEnabled ? 'true' : 'false');
    });

    filterSelect.addEventListener('change', () => {
      currentFilter = filterSelect.value;
      refresh(true);
    });

    // ---- Build table row ----
    function _buildRow(row, isNew) {
      const meta = EVENT_META[row.event_type] || { emoji: '📌', label: row.event_type, color: '#6366f1' };
      const name = _contactName(row);
      const email = _contactEmail(row);
      const amount = _amount(row);
      const vip = _isVip(row);
      const firstAd = _firstAd(row);
      const lastAd = _lastAd(row);
      const page = _conversionPage(row);
      const sessionLink = _sessionUrl(row);
      const relTime = _relTime(row.event_timestamp);
      const p = _payload(row);
      const segment = p.niche_segment || 'Unknown';
      const segMeta = SEGMENT_META[segment] || SEGMENT_META['Unknown'];

      const tr = document.createElement('tr');
      if (isNew) tr.className = 'lf-new';

      tr.innerHTML = `
        <td style="font-size:11px;color:${Theme.COLORS.textMuted};white-space:nowrap">${relTime}</td>
        <td>
          <span class="lf-event-badge">
            <span class="lf-event-dot" style="background:${meta.color}"></span>
            <span style="color:${Theme.COLORS.textPrimary}">${meta.label}</span>
          </span>
          ${vip ? `<span class="lf-vip" title="${
            p.vip_source === 'checkout_checkbox'
              ? 'Checkout checkbox -- $54 single transaction on reg page'
              : p.vip_source === 'upsell_page'
              ? 'Post-purchase upsell page -- $27 VIP add-on after initial ticket'
              : 'VIP purchase'
          }">VIP</span>` : ''}
        </td>
        <td>
          <div style="font-weight:500;color:${Theme.COLORS.textPrimary}">${name}</div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted}">${email ? _trunc(email, 28) : '--'}</div>
          ${p.closer ? `<div style="font-size:10px;color:#a855f7;margin-top:1px">Closer: ${p.closer}</div>` : ''}
          ${p.source && p.source !== 'ghl' ? `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:1px">via ${_trunc(p.source, 20)}</div>` : ''}
        </td>
        <td>
          <span class="lf-segment" style="color:${segMeta.color};background:${segMeta.color}18;border:1px solid ${segMeta.color}40">
            <span class="lf-segment-icon">${segMeta.icon}</span>
            ${segment}
          </span>
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:600;color:${amount ? Theme.COLORS.success : Theme.COLORS.textMuted}">
          ${amount ? Theme.money(amount) : '--'}
        </td>
        <td class="lf-page-cell" title="${page}">${_trunc(page, 22)}</td>
        <td class="lf-ad-cell" title="${firstAd}">${_trunc(firstAd, 24)}</td>
        <td class="lf-ad-cell" title="${lastAd}">${_trunc(lastAd, 24)}</td>
        <td>
          ${sessionLink
            ? `<a href="${sessionLink}" target="_blank" rel="noopener" class="lf-session-link">View</a>`
            : `<span style="font-size:11px;color:${Theme.COLORS.textMuted}">--</span>`
          }
        </td>
      `;

      return tr;
    }

    // ---- Fetch + render ----
    async function refresh(resetIds) {
      if (!document.body.contains(container)) {
        clearInterval(pollInterval);
        return;
      }

      let rows;
      try {
        const params = { days: Filters.getDays() };
        if (currentFilter) params.eventType = currentFilter;
        rows = await API.query('live-feed', 'default', params);
      } catch (err) {
        if (tableWrap.children.length === 0) {
          tableWrap.innerHTML = `<div style="padding:24px"><p class="text-muted">Failed to load Live Feed: ${err.message}</p></div>`;
        }
        return;
      }

      // Filter to core funnel events
      rows = (rows || []).filter(r => ALLOWED_TYPES.has(r.event_type));

      if (rows.length === 0) {
        tableWrap.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9889;</span><p>No events in this period</p></div>`;
        countBadge.textContent = '0 events';
        return;
      }

      countBadge.textContent = `${rows.length} event${rows.length !== 1 ? 's' : ''}`;
      _updateVipStats(rows);

      const newIds = new Set(rows.map(r => r.event_id));
      const isFirst = resetIds || lastEventIds.size === 0;

      // Sound on new enrollment
      if (!isFirst && soundEnabled) {
        for (const row of rows) {
          if (!lastEventIds.has(row.event_id) && ENROLLMENT_TYPES.has(row.event_type)) {
            _playBeep();
            break;
          }
        }
      }

      // Build table
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;

      const table = document.createElement('table');
      table.className = 'lf-table';
      table.innerHTML = `
        <thead><tr>
          <th>When</th>
          <th>Event</th>
          <th>Contact</th>
          <th>Segment</th>
          <th>Amount</th>
          <th>Conversion Page</th>
          <th>First Ad Click</th>
          <th>Last Ad Click</th>
          <th>Session</th>
        </tr></thead>
      `;

      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const ts = new Date(row.event_timestamp).getTime();
        const isNew = !isFirst && !lastEventIds.has(row.event_id);
        const isRecent = !isNaN(ts) && ts >= fiveMinsAgo;
        tbody.appendChild(_buildRow(row, isNew || isRecent));
      });
      table.appendChild(tbody);

      tableWrap.innerHTML = '';
      tableWrap.appendChild(table);

      lastEventIds = newIds;
    }

    // Initial load
    await refresh(true);

    // Auto-poll every 60s
    pollInterval = setInterval(() => {
      if (!document.body.contains(container)) {
        clearInterval(pollInterval);
        return;
      }
      refresh(false);
    }, 60000);
  });
})();
