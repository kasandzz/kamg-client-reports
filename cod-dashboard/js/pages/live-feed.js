/* ============================================
   Live Feed -- real-time customer event stream
   Auto-polls every 60s, event type filter,
   enrollment sound toggle, relative timestamps
   ============================================ */

(function () {
  // Event type emoji + label map
  const EVENT_META = {
    payment_succeeded:   { emoji: '$',  label: 'Payment Succeeded' },
    payment_failed:      { emoji: '✗',  label: 'Payment Failed' },
    ticket_purchased:    { emoji: '🎟', label: 'Ticket Purchased' },
    call_booked:         { emoji: '📞', label: 'Call Booked' },
    call_completed:      { emoji: '✓',  label: 'Call Completed' },
    call_no_show:        { emoji: '❌', label: 'Call No-Show' },
    email_sent:          { emoji: '📧', label: 'Email Sent' },
    email_opened:        { emoji: '👁', label: 'Email Opened' },
    email_clicked:       { emoji: '🔗', label: 'Email Clicked' },
    hyros_lead:          { emoji: '👤', label: 'Hyros Lead' },
    hyros_sale:          { emoji: '💰', label: 'Hyros Sale' },
    lead_created:        { emoji: '👤', label: 'Lead Created' },
    workshop_registered: { emoji: '📋', label: 'Workshop Registered' },
    vip_purchased:       { emoji: '⭐', label: 'VIP Purchased' },
    workshop_attended:   { emoji: '🎬', label: 'Workshop Attended' },
    lp_enrollment:       { emoji: '🎓', label: 'LP Enrollment' },
  };

  const ENROLLMENT_TYPES = new Set(['lp_enrollment', 'hyros_sale', 'payment_succeeded', 'vip_purchased']);
  const SOUND_KEY = 'cod_enrollment_sound';

  // ---- Beep tone (data URI, short 220Hz sine wave) ----
  function _playBeep() {
    try {
      const sampleRate = 8000;
      const duration = 0.25;
      const frequency = 880;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);
      // WAV header
      const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples * 2, true);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const fade = t < 0.05 ? t / 0.05 : (t > 0.2 ? (duration - t) / 0.05 : 1);
        const sample = Math.round(Math.sin(2 * Math.PI * frequency * t) * 16383 * fade);
        view.setInt16(44 + i * 2, sample, true);
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
    const now = Date.now();
    const then = new Date(ts).getTime();
    const diffMs = now - then;
    if (isNaN(diffMs)) return ts;
    const secs = Math.floor(diffMs / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // ---- Parse contact name from payload ----
  function _contactName(row) {
    try {
      const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
      if (p.customer_name) return p.customer_name;
      if (p.first_name || p.last_name) return [p.first_name, p.last_name].filter(Boolean).join(' ');
      if (p.name) return p.name;
    } catch (e) {}
    return row.email || 'Unknown';
  }

  // ---- Parse amount from payload ----
  function _amount(row) {
    try {
      const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
      const val = p.amount || p.revenue || p.value || null;
      if (val != null && !isNaN(parseFloat(val))) return parseFloat(val);
    } catch (e) {}
    return null;
  }

  // ---- Render a single event card ----
  function _renderCard(row, isNew) {
    const meta = EVENT_META[row.event_type] || { emoji: '📌', label: row.event_type };
    const name = _contactName(row);
    const amount = _amount(row);
    const relTime = _relTime(row.event_timestamp);
    const source = row.event_source || '';

    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = [
      'padding:12px 16px',
      'margin-bottom:8px',
      'display:flex',
      'align-items:center',
      'gap:12px',
      'cursor:default',
      isNew ? `border-left:3px solid ${Theme.COLORS.accent}` : `border-left:3px solid transparent`,
    ].join(';');

    if (isNew) {
      card.style.animation = 'lf-pulse 2s ease-in-out';
    }

    // Emoji badge
    const badge = document.createElement('div');
    badge.style.cssText = [
      'width:36px',
      'height:36px',
      'border-radius:8px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:18px',
      'flex-shrink:0',
      `background:${Theme.COLORS.bgPage}`,
    ].join(';');
    badge.textContent = meta.emoji;
    card.appendChild(badge);

    // Main info
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';

    const typeLabel = document.createElement('span');
    typeLabel.style.cssText = `font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary}`;
    typeLabel.textContent = meta.label;
    topRow.appendChild(typeLabel);

    if (source) {
      const srcBadge = document.createElement('span');
      srcBadge.style.cssText = [
        'font-size:10px',
        'font-weight:600',
        'text-transform:uppercase',
        'letter-spacing:0.5px',
        `color:${Theme.COLORS.accentLight}`,
        `background:${Theme.COLORS.bgPage}`,
        'border-radius:4px',
        'padding:2px 6px',
        `border:1px solid ${Theme.COLORS.border}`,
      ].join(';');
      srcBadge.textContent = source;
      topRow.appendChild(srcBadge);
    }

    info.appendChild(topRow);

    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap`;

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = `font-size:12px;color:${Theme.COLORS.textSecondary}`;
    nameSpan.textContent = name;
    bottomRow.appendChild(nameSpan);

    if (amount !== null) {
      const amtSpan = document.createElement('span');
      amtSpan.style.cssText = `font-size:12px;font-weight:600;color:${Theme.COLORS.success}`;
      amtSpan.textContent = Theme.money(amount);
      bottomRow.appendChild(amtSpan);
    }

    info.appendChild(bottomRow);
    card.appendChild(info);

    // Timestamp
    const timeSpan = document.createElement('div');
    timeSpan.style.cssText = `font-size:11px;color:${Theme.COLORS.textMuted};flex-shrink:0;text-align:right`;
    timeSpan.textContent = relTime;
    card.appendChild(timeSpan);

    return card;
  }

  // ---- Inject keyframe CSS once ----
  function _injectStyles() {
    if (document.getElementById('lf-styles')) return;
    const style = document.createElement('style');
    style.id = 'lf-styles';
    style.textContent = `
      @keyframes lf-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
        50%  { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
        100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
      }
      .lf-header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .lf-feed {
        max-height: calc(100vh - 180px);
        overflow-y: auto;
        padding-right: 4px;
      }
      @media (max-width: 768px) {
        .lf-feed { max-height: calc(100vh - 200px); }
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
    filterSelect.style.cssText = [
      `background:${Theme.COLORS.bgCard}`,
      `color:${Theme.COLORS.textPrimary}`,
      `border:1px solid ${Theme.COLORS.border}`,
      'border-radius:6px',
      'padding:6px 10px',
      'font-size:13px',
      'cursor:pointer',
    ].join(';');

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

    // ---- Feed container ----
    const feed = document.createElement('div');
    feed.className = 'lf-feed';
    container.appendChild(feed);

    // ---- Event handlers ----
    soundCheck.addEventListener('change', () => {
      soundEnabled = soundCheck.checked;
      localStorage.setItem(SOUND_KEY, soundEnabled ? 'true' : 'false');
    });

    filterSelect.addEventListener('change', () => {
      currentFilter = filterSelect.value;
      refresh(true);
    });

    // ---- Fetch + render ----
    async function refresh(resetIds) {
      // Bail if container removed from DOM (page changed)
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
        if (feed.children.length === 0) {
          feed.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Live Feed: ${err.message}</p></div>`;
        }
        return;
      }

      if (!rows || rows.length === 0) {
        feed.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9889;</span><p>No events in this period</p></div>`;
        return;
      }

      const newIds = new Set(rows.map(r => r.event_id));
      const isFirst = resetIds || lastEventIds.size === 0;

      // Sound: if not first load, check for new enrollment events
      if (!isFirst && soundEnabled) {
        for (const row of rows) {
          if (!lastEventIds.has(row.event_id) && ENROLLMENT_TYPES.has(row.event_type)) {
            _playBeep();
            break;
          }
        }
      }

      // Re-render feed
      feed.innerHTML = '';
      const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
      rows.forEach(row => {
        const ts = new Date(row.event_timestamp).getTime();
        const isNew = !isFirst && !lastEventIds.has(row.event_id);
        const isRecent = ts >= fiveMinsAgo;
        feed.appendChild(_renderCard(row, isNew || isRecent));
      });

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
