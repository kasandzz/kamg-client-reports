/* ============================================
   War Room -- CEO 5-second pulse page
   KPI strip with period comparison, charts
   ============================================ */

App.registerPage('war-room', async (container) => {
  const days = Filters.getDays();
  let data;

  try {
    data = await API.query('war-room', 'default', { days });
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load War Room: ${err.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#128203;</span><p>No data for the selected period</p></div>`;
    return;
  }

  // Current = first row (ORDER BY period DESC -> 'current' first), Previous = second
  const cur = data[0] || {};
  const prev = data[1] || {};
  container.innerHTML = '';

  // ---- Helper: compute delta % ----
  function _delta(curVal, prevVal) {
    if (!prevVal || prevVal === 0) return null;
    return ((curVal - prevVal) / Math.abs(prevVal)) * 100;
  }

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    {
      label: 'Revenue (Collected)',
      value: cur.gross_revenue || 0,
      prevValue: prev.gross_revenue || 0,
      format: 'money',
      delta: _delta(cur.gross_revenue, prev.gross_revenue),
      source: 'BigQuery: v_stripe_clean',
      calc: 'SUM(amount) WHERE amount > 0 AND status = "succeeded" for period',
    },
    {
      label: 'Blended ROAS',
      value: cur.roas || 0,
      prevValue: prev.roas || 0,
      format: 'num',
      delta: _delta(cur.roas, prev.roas),
      source: 'BigQuery: v_stripe_clean + v_meta_ads_clean',
      calc: '(gross_revenue - refunds) / total_spend for period',
    },
    {
      label: 'Enrollments',
      value: cur.enrollments || 0,
      prevValue: prev.enrollments || 0,
      format: 'num',
      delta: _delta(cur.enrollments, prev.enrollments),
      source: 'BigQuery: v_stripe_clean',
      calc: 'COUNT(DISTINCT email) WHERE amount > 500 AND status = "succeeded" for period',
    },
    {
      label: 'CPB',
      value: cur.cpb || 0,
      prevValue: prev.cpb || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cpb, prev.cpb),
      source: 'BigQuery: v_meta_ads_clean + v_sheets_bookings_clean',
      calc: 'total_spend / total_calls (all booked calls) for period',
    },
    {
      label: 'CPA (Avg)',
      value: cur.cost_per_enrollment || 0,
      prevValue: prev.cost_per_enrollment || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cost_per_enrollment, prev.cost_per_enrollment),
      source: 'BigQuery: v_meta_ads_clean + v_stripe_clean',
      calc: 'total_spend / COUNT(DISTINCT email WHERE amount > 500) for period',
    },
    {
      label: 'CPM',
      value: cur.cpm || 0,
      prevValue: prev.cpm || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cpm, prev.cpm),
      source: 'Meta Marketing API: meta_ads_insights',
      calc: '(SUM(spend) / SUM(impressions)) * 1000, aggregated across all active campaigns for period',
    },
  ]);

  // ---- Sales / Bookings KPI Strip ----
  const salesLabel = document.createElement('div');
  salesLabel.style.cssText = 'font-size:10px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px';
  salesLabel.textContent = 'SALES TEAM';
  container.appendChild(salesLabel);

  const salesKpiContainer = document.createElement('div');
  container.appendChild(salesKpiContainer);

  // Sales Team KPI strip -- uses war-room cur/prev + calls data
  const callsBooked = cur.total_calls || 0;
  const prevCallsBooked = prev.total_calls || 0;
  const callsTaken = cur.showed || ((cur.total_calls || 0) - (cur.no_shows || 0) - (cur.cancellations || 0));
  const prevCallsTaken = prev.showed || ((prev.total_calls || 0) - (prev.no_shows || 0) - (prev.cancellations || 0));
  const totalCash = cur.gross_revenue || 0;
  const totalContracts = cur.enrollment_revenue || 0;
  const prevTotalContracts = prev.enrollment_revenue || 0;
  const adSpend = cur.total_spend || 0;
  const cac = cur.enrollments > 0 ? adSpend / cur.enrollments : 0;
  const prevCac = prev.enrollments > 0 ? (prev.total_spend || 0) / prev.enrollments : 0;
  const netRevenue = (cur.gross_revenue || 0) - (cur.refunds || 0);
  const prevNetRevenue = (prev.gross_revenue || 0) - (prev.refunds || 0);
  const roas = adSpend > 0 ? netRevenue / adSpend : 0;
  const prevRoas = (prev.total_spend || 0) > 0 ? prevNetRevenue / prev.total_spend : 0;

  Components.renderKPIStrip(salesKpiContainer, [
    { label: 'Calls Booked (All)', value: callsBooked, prevValue: prevCallsBooked, format: 'num',
      delta: _delta(callsBooked, prevCallsBooked),
      source: 'BigQuery: v_sheets_bookings_clean', calc: 'COUNT(*) WHERE call_date in period' },
    { label: 'Calls Taken', value: callsTaken, prevValue: prevCallsTaken, format: 'num',
      delta: _delta(callsTaken, prevCallsTaken),
      source: 'BigQuery: v_sheets_bookings_clean', calc: 'COUNT(*) WHERE status != "no-show"' },
    { label: 'Total Cash', value: totalCash, prevValue: prev.gross_revenue || 0, format: 'money',
      delta: _delta(totalCash, prev.gross_revenue),
      source: 'BigQuery: v_stripe_clean', calc: 'SUM(amount) WHERE amount > 0 AND succeeded' },
    { label: 'Enrollment Revenue', value: totalContracts, prevValue: prevTotalContracts, format: 'money',
      delta: _delta(totalContracts, prevTotalContracts),
      source: 'BigQuery: v_stripe_clean', calc: 'SUM(amount) WHERE amount > 500 AND succeeded' },
    { label: 'Ad Spend', value: adSpend, prevValue: prev.total_spend || 0, format: 'money',
      delta: _delta(adSpend, prev.total_spend),
      source: 'BigQuery: v_meta_ads_clean', calc: 'SUM(spend) for period' },
    { label: 'CAC', value: cac, prevValue: prevCac, format: 'money', invertCost: true,
      delta: prevCac > 0 ? _delta(cac, prevCac) : null,
      source: 'BigQuery: v_meta_ads_clean + v_stripe_clean', calc: 'total_spend / enrollments (Stripe)' },
    { label: 'Net ROAS', value: roas, prevValue: prevRoas, format: 'num',
      delta: prevRoas > 0 ? _delta(roas, prevRoas) : null,
      source: 'BigQuery: v_stripe_clean + v_meta_ads_clean', calc: '(gross_revenue - refunds) / total_spend' },
  ]);

  // ---- CPA tooltip: hover on CPA KPI card shows per-channel breakdown ----
  (function attachCPATooltip() {
    const kpiCards = kpiContainer.querySelectorAll('.kpi-card');
    let cpaCard = null;
    kpiCards.forEach(c => { if (c.querySelector('.kpi-label')?.textContent.includes('CPA')) cpaCard = c; });
    if (!cpaCard) return;
    cpaCard.style.position = 'relative';
    cpaCard.style.cursor = 'help';

    // Inject tooltip style
    if (!document.getElementById('wr-cpa-tip-style')) {
      const s = document.createElement('style');
      s.id = 'wr-cpa-tip-style';
      s.textContent = `.wr-cpa-tip{position:absolute;top:100%;left:50%;transform:translateX(-50%);z-index:200;background:#0f172a;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px 16px;min-width:260px;box-shadow:0 8px 24px rgba(0,0,0,0.6);opacity:0;visibility:hidden;transition:opacity .15s,visibility 0s .15s;pointer-events:none}.kpi-card:hover .wr-cpa-tip{opacity:1;visibility:visible;transition:opacity .15s,visibility 0s 0s}`;
      document.head.appendChild(s);
    }

    const tip = document.createElement('div');
    tip.className = 'wr-cpa-tip';
    tip.innerHTML = `<div style="font-size:10px;color:${Theme.COLORS.textMuted}">Loading...</div>`;
    cpaCard.appendChild(tip);

    // Fetch data once on first hover
    let loaded = false;
    cpaCard.addEventListener('mouseenter', () => {
      if (loaded) return;
      loaded = true;
      Promise.all([
        API.query('ads-meta', 'campaigns', { days }),
        API.query('hyros', 'sources', { days })
      ]).then(([metaCampaigns, hyrosSources]) => {
        const spendByChannel = {};
        (metaCampaigns || []).forEach(c => {
          const ch = _classifyChannel(c.campaign_name);
          spendByChannel[ch] = (spendByChannel[ch] || 0) + (c.spend || 0);
        });
        const enrollByChannel = {};
        (hyrosSources || []).forEach(r => {
          const ch = _classifyChannel(r.source);
          enrollByChannel[ch] = (enrollByChannel[ch] || 0) + (r.enrollment_count || 0);
        });
        const allCh = new Set([...Object.keys(spendByChannel), ...Object.keys(enrollByChannel)]);
        const rows = [];
        allCh.forEach(ch => {
          const spend = spendByChannel[ch] || 0;
          const enr = enrollByChannel[ch] || 0;
          if (spend === 0 && enr === 0) return;
          rows.push({ ch, cpa: enr > 0 ? spend / enr : null, spend, enr });
        });
        rows.sort((a, b) => (a.cpa || Infinity) - (b.cpa || Infinity));

        let html = `<div style="font-size:10px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">CPA by Channel</div>`;
        rows.forEach(r => {
          const cpaColor = r.cpa === null ? Theme.COLORS.textMuted : r.cpa <= 3000 ? '#22c55e' : r.cpa <= 6000 ? '#f59e0b' : '#ef4444';
          const cpaText = r.cpa !== null ? Theme.money(r.cpa) : '--';
          const dotColor = _channelColors[r.ch] || '#6366f1';
          html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
              <span style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0"></span>
              <span style="font-size:11px;color:${Theme.COLORS.textSecondary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.ch}</span>
            </div>
            <span style="font-size:12px;font-family:var(--font-mono);font-weight:600;color:${cpaColor};flex-shrink:0">${cpaText}</span>
            <span style="font-size:10px;color:${Theme.COLORS.textMuted};flex-shrink:0;width:32px;text-align:right">${r.enr}e</span>
          </div>`;
        });
        tip.innerHTML = html;
      }).catch(() => {
        tip.innerHTML = `<div style="font-size:10px;color:${Theme.COLORS.textMuted}">Failed to load</div>`;
      });
    });
  })();

  // ---- Charts Row ----
  const chartsRow = document.createElement('div');
  chartsRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(chartsRow);

  // Revenue Breakdown (horizontal stacked bar)
  const revenueCard = _card('Revenue Breakdown');
  const ticketRev = cur.ticket_revenue || 0;
  const enrollmentRev = cur.enrollment_revenue || 0;
  const vipRev = cur.vip_revenue || 0;
  const revAdSpend = cur.total_spend || 0;
  const refunds = cur.refunds || 0;
  const netRev = (cur.gross_revenue || 0) - refunds - revAdSpend;

  const segments = [
    { label: 'Tickets', value: ticketRev, color: '#6366f1' },
    { label: 'VIP', value: vipRev, color: '#8b5cf6' },
    { label: 'Enrollments', value: enrollmentRev, color: '#22c55e' },
  ];
  const grossTotal = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  let barHTML = '<div style="margin-top:8px">';
  // Stacked bar
  barHTML += '<div style="display:flex;height:32px;border-radius:6px;overflow:hidden;margin-bottom:12px">';
  segments.forEach(seg => {
    const pct = ((seg.value / grossTotal) * 100).toFixed(1);
    if (seg.value > 0) {
      barHTML += `<div style="width:${pct}%;background:${seg.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;min-width:30px" title="${seg.label}: ${Theme.money(seg.value)} (${pct}%)">${pct}%</div>`;
    }
  });
  barHTML += '</div>';

  // Legend + numbers
  barHTML += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">';
  segments.forEach(seg => {
    barHTML += `<div style="display:flex;align-items:center;gap:6px">
      <div style="width:10px;height:10px;border-radius:2px;background:${seg.color};flex-shrink:0"></div>
      <div><div style="font-size:11px;color:${Theme.COLORS.textMuted}">${seg.label}</div><div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary}">${Theme.money(seg.value)}</div></div>
    </div>`;
  });
  barHTML += '</div>';

  // Deductions row
  barHTML += `<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid ${Theme.COLORS.border}">
    <div><div style="font-size:11px;color:${Theme.COLORS.textMuted}">Ad Spend</div><div style="font-size:14px;font-weight:600;color:${Theme.COLORS.danger}">-${Theme.money(adSpend)}</div></div>
    <div><div style="font-size:11px;color:${Theme.COLORS.textMuted}">Refunds</div><div style="font-size:14px;font-weight:600;color:${Theme.COLORS.danger}">-${Theme.money(refunds)}</div></div>
    <div><div style="font-size:11px;color:${Theme.COLORS.textMuted}">Net After Ad Spend</div><div style="font-size:16px;font-weight:700;color:${netRev >= 0 ? Theme.COLORS.success : Theme.COLORS.danger}">${Theme.money(netRev)}</div></div>
  </div>`;
  barHTML += '</div>';

  revenueCard.innerHTML += barHTML;
  chartsRow.appendChild(revenueCard);

  // ---- Shared utilities for channel cards ----
  const _channelColors = { 'Meta Ads': '#1877F2', YouTube: '#FF0000', Email: '#22c55e', 'Google Ads': '#FBBC04', TikTok: '#000000', Direct: '#94a3b8', Unattributed: '#475569', 'Franzi (Setter)': '#a855f7', 'Lead Campaigns': '#f59e0b', Other: '#64748b' };

  function _classifyChannel(src) {
    src = (src || 'Unknown').toLowerCase();
    if (src.includes('fb') || src.includes('facebook') || src.includes('meta') || src.includes('broad') || src.includes('lla') || src.includes('interest stack') || src.includes('cbo') || src.includes('stacked') || src.includes('client testimonial') || src.includes('advantage')) return 'Meta Ads';
    if (src.includes('youtube') || src.includes('yt') || src.includes('tof |')) return 'YouTube';
    if (src.includes('google')) return 'Google Ads';
    if (src.includes('email') || src.includes('sendgrid')) return 'Email';
    if (src.includes('tiktok')) return 'TikTok';
    if (src.includes('franzi') || src.includes('setter') || src.includes('appointment') || src.includes('book call')) return 'Franzi (Setter)';
    if (src.includes('leads |') || src.includes('lead') || src.includes('max')) return 'Lead Campaigns';
    if (src.includes('direct')) return 'Direct';
    if (src === 'unknown' || src === '') return 'Unattributed';
    return 'Other';
  }

  function _buildChannelData(rows) {
    const channelMap = {};
    rows.forEach(r => {
      const channel = _classifyChannel(r.source);
      if (!channelMap[channel]) channelMap[channel] = { ticket_count: 0, ticket_revenue: 0, enrollment_count: 0, enrollment_revenue: 0, bookings: 0 };
      channelMap[channel].ticket_count += (r.ticket_count || 0);
      channelMap[channel].ticket_revenue += (r.ticket_revenue || 0);
      channelMap[channel].enrollment_count += (r.enrollment_count || 0);
      channelMap[channel].enrollment_revenue += (r.enrollment_revenue || 0);
      channelMap[channel].bookings += (r.bookings || 0);
    });
    return Object.entries(channelMap).map(([ch, d]) => ({ channel: ch, ...d }));
  }

  function _buildBookingChannelData(rows) {
    const channelMap = {};
    rows.forEach(r => {
      const channel = _classifyChannel(r.source);
      if (!channelMap[channel]) channelMap[channel] = { bookings: 0 };
      channelMap[channel].bookings += (r.bookings || 0);
    });
    return Object.entries(channelMap).map(([ch, d]) => ({ channel: ch, ...d }));
  }

  // ---- Sortable channel chart builder ----
  function _renderChannelChart(card, channels, opts) {
    // Clear previous chart content (keep title)
    const existingHeader = card.querySelector('.wr-ch-header');
    const existingBody = card.querySelector('.wr-ch-body');
    if (existingHeader) existingHeader.remove();
    if (existingBody) existingBody.remove();

    const headerEl = document.createElement('div');
    headerEl.className = 'wr-ch-header';
    headerEl.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)';
    card.appendChild(headerEl);
    const bodyEl = document.createElement('div');
    bodyEl.className = 'wr-ch-body';
    card.appendChild(bodyEl);

    const sort = { key: opts.defaultSort, dir: 'desc' };
    const totalCount = channels.reduce((s, r) => s + (r[opts.countKey] || 0), 0) || 1;
    const totalRev = opts.revKey ? channels.reduce((s, r) => s + (r[opts.revKey] || 0), 0) : null;

    function renderHeaders() {
      headerEl.innerHTML = `<div style="width:120px;flex-shrink:0"></div><div style="flex:1"></div>`;
      opts.cols.forEach(col => {
        const isActive = sort.key === col.key;
        const arrow = isActive ? (sort.dir === 'desc' ? ' &#9660;' : ' &#9650;') : '';
        headerEl.innerHTML += `<div class="wr-sort-col" data-sort="${col.key}" style="width:${col.w};font-size:10px;font-weight:600;color:${isActive ? '#e2e8f0' : Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;user-select:none">${col.label}${arrow}</div>`;
      });
      headerEl.querySelectorAll('.wr-sort-col').forEach(el => {
        el.addEventListener('click', () => {
          const k = el.dataset.sort;
          if (k === '_pct') return;
          if (sort.key === k) sort.dir = sort.dir === 'desc' ? 'asc' : 'desc';
          else { sort.key = k; sort.dir = 'desc'; }
          renderHeaders();
          renderRows();
        });
      });
    }

    function renderRows() {
      const sorted = [...channels].sort((a, b) => {
        const va = a[sort.key] || 0, vb = b[sort.key] || 0;
        return sort.dir === 'desc' ? vb - va : va - vb;
      });
      const maxCount = Math.max(...sorted.map(r => r[opts.countKey] || 0));
      let html = '';
      sorted.forEach(r => {
        const count = r[opts.countKey] || 0;
        const rev = opts.revKey ? (r[opts.revKey] || 0) : null;
        if (count === 0 && (rev === null || rev === 0)) return;
        const pct = ((count / totalCount) * 100).toFixed(0);
        const widthPct = maxCount > 0 ? ((count / maxCount) * 100) : 0;
        const color = _channelColors[r.channel] || '#6366f1';
        html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="width:120px;font-size:12px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.channel}">${r.channel}</div>
          <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden"><div style="height:100%;width:${widthPct}%;background:${color};border-radius:4px;min-width:2px"></div></div>
          <div style="width:36px;font-size:13px;font-family:var(--font-mono);font-weight:500;color:${Theme.COLORS.textPrimary};text-align:right;flex-shrink:0">${count}</div>
          <div style="width:36px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0">${pct}%</div>
          ${rev !== null ? `<div style="width:64px;font-size:11px;color:${opts.revColor};text-align:right;flex-shrink:0;font-family:var(--font-mono)">${Theme.money(rev)}</div>` : ''}
        </div>`;
      });
      html += `<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)"><span style="font-size:12px;color:${Theme.COLORS.textMuted}">Total: ${totalCount} ${opts.countLabel}</span>${totalRev !== null ? `<span style="font-size:12px;color:${opts.revColor};font-weight:600;font-family:var(--font-mono)">${Theme.money(totalRev)}</span>` : ''}</div>`;
      html += `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px;font-style:italic">${opts.footnote}</div>`;
      bodyEl.innerHTML = html;
    }

    renderHeaders();
    renderRows();
  }

  // ---- Attribution model state (shared across Hyros-sourced cards) ----
  let _currentAttribModel = 'first';
  const _attribDropdowns = []; // all dropdowns sync together

  function _createAttribDropdown() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0';
    const btn = document.createElement('button');
    btn.style.cssText = `display:flex;align-items:center;gap:5px;padding:4px 10px;font-size:10px;font-family:var(--font-mono,'JetBrains Mono',monospace);color:${Theme.COLORS.textSecondary};background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;cursor:pointer;white-space:nowrap`;
    const labels = { first: 'First Click', last: 'Last Click', scientific: 'Scientific' };
    const icons = { first: '\u2B95', last: '\u2B05', scientific: '\u2696' };
    btn.innerHTML = `<span style="font-size:11px">${icons[_currentAttribModel]}</span> ${labels[_currentAttribModel]} <span style="font-size:8px;opacity:0.5">\u25BC</span>`;

    const menu = document.createElement('div');
    menu.style.cssText = `display:none;position:absolute;top:100%;right:0;margin-top:4px;background:${Theme.COLORS.bgCard};border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px;z-index:20;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,0.4)`;

    [{ value: 'first', label: 'First Click', icon: '\u2B95', desc: 'First ad touchpoint' },
     { value: 'last', label: 'Last Click', icon: '\u2B05', desc: 'Last ad before conversion' },
     { value: 'scientific', label: 'Scientific', icon: '\u2696', desc: '50/50 first + last split' }
    ].forEach(opt => {
      const item = document.createElement('div');
      item.style.cssText = `display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:11px;color:${_currentAttribModel === opt.value ? Theme.COLORS.textPrimary : Theme.COLORS.textSecondary};background:${_currentAttribModel === opt.value ? 'rgba(255,255,255,0.06)' : 'transparent'}`;
      item.innerHTML = `<span style="font-size:13px">${opt.icon}</span><div><div style="font-weight:${_currentAttribModel === opt.value ? '600' : '400'}">${opt.label}</div><div style="font-size:9px;color:${Theme.COLORS.textMuted}">${opt.desc}</div></div>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        _currentAttribModel = opt.value;
        menu.style.display = 'none';
        _syncAllAttribDropdowns();
        _loadChannelCards(_currentAttribModel);
        _loadHierarchy(_currentAttribModel);
      });
      item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.06)'; });
      item.addEventListener('mouseleave', () => { item.style.background = _currentAttribModel === opt.value ? 'rgba(255,255,255,0.06)' : 'transparent'; });
      menu.appendChild(item);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display !== 'none';
      // Close all other dropdowns
      _attribDropdowns.forEach(d => { if (d.menu !== menu) d.menu.style.display = 'none'; });
      menu.style.display = isOpen ? 'none' : 'block';
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    const ref = { wrap, btn, menu };
    _attribDropdowns.push(ref);
    return wrap;
  }

  function _syncAllAttribDropdowns() {
    const labels = { first: 'First Click', last: 'Last Click', scientific: 'Scientific' };
    const icons = { first: '\u2B95', last: '\u2B05', scientific: '\u2696' };
    _attribDropdowns.forEach(d => {
      d.btn.innerHTML = `<span style="font-size:11px">${icons[_currentAttribModel]}</span> ${labels[_currentAttribModel]} <span style="font-size:8px;opacity:0.5">\u25BC</span>`;
      // Update menu item styles
      d.menu.querySelectorAll('div[style]').forEach(item => {
        const label = item.querySelector('div > div:first-child');
        if (!label) return;
        const isActive = labels[_currentAttribModel] === label.textContent;
        item.style.background = isActive ? 'rgba(255,255,255,0.06)' : 'transparent';
        item.style.color = isActive ? Theme.COLORS.textPrimary : Theme.COLORS.textSecondary;
        if (label) label.style.fontWeight = isActive ? '600' : '400';
      });
    });
  }

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    _attribDropdowns.forEach(d => { d.menu.style.display = 'none'; });
  });

  // ---- Unified Channel Performance Card ----
  const channelCard = document.createElement('div');
  channelCard.className = 'card';
  channelCard.style.cssText = 'padding:16px 20px;margin-top:20px';
  const chTitleRow = document.createElement('div');
  chTitleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
  const chTitle = document.createElement('div');
  chTitle.style.cssText = `font-size:13px;font-weight:700;font-family:Manrope,sans-serif;color:${Theme.COLORS.textPrimary};text-transform:uppercase;letter-spacing:0.05em`;
  chTitle.textContent = 'Channel Performance (spend estimated by ticket share)';
  chTitleRow.appendChild(chTitle);
  chTitleRow.appendChild(_createAttribDropdown());
  channelCard.appendChild(chTitleRow);

  let _chSort = { key: 'ticket_count', dir: 'desc' };

  function _loadChannelCards(model) {
    const existing = channelCard.querySelector('.wr-ch-body');
    if (existing) existing.remove();
    const loader = document.createElement('div');
    loader.className = 'wr-ch-body';
    loader.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';
    channelCard.appendChild(loader);

    const modelLabel = model === 'first' ? 'first-click' : model === 'last' ? 'last-click' : 'scientific (50/50)';

    const salesPromise = API.query('hyros', 'sourcesAttrib', { days, model }).catch(() =>
      API.query('hyros', 'sources', { days })
    );
    const bookingsPromise = API.query('hyros', 'bookings', { days, model }).catch(() => []);

    Promise.all([salesPromise, bookingsPromise]).then(([salesRows, bookingRows]) => {
      // Merge all data by channel
      const channelMap = {};
      (salesRows || []).forEach(r => {
        const ch = _classifyChannel(r.source);
        if (!channelMap[ch]) channelMap[ch] = { channel: ch, ticket_count: 0, ticket_revenue: 0, enrollment_count: 0, enrollment_revenue: 0, bookings: 0 };
        channelMap[ch].ticket_count += (r.ticket_count || 0);
        channelMap[ch].ticket_revenue += (r.ticket_revenue || 0);
        channelMap[ch].enrollment_count += (r.enrollment_count || 0);
        channelMap[ch].enrollment_revenue += (r.enrollment_revenue || 0);
      });
      (bookingRows || []).forEach(r => {
        const ch = _classifyChannel(r.source);
        if (!channelMap[ch]) channelMap[ch] = { channel: ch, ticket_count: 0, ticket_revenue: 0, enrollment_count: 0, enrollment_revenue: 0, bookings: 0 };
        channelMap[ch].bookings += (r.bookings || 0);
      });

      const channels = Object.values(channelMap).filter(c => c.ticket_count > 0 || c.bookings > 0 || c.enrollment_count > 0);
      if (channels.length === 0) {
        loader.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">No channel data</p>`;
        return;
      }

      // Compute ROAS per channel (needed for sorting)
      const totalSpend = cur.total_spend || 0;
      const totalTicketsAll = channels.reduce((s, c) => s + c.ticket_count, 0) || 1;
      channels.forEach(r => {
        const chTotalRev = (r.ticket_revenue || 0) + (r.enrollment_revenue || 0);
        const chSpendShare = totalSpend > 0 ? (r.ticket_count / totalTicketsAll) * totalSpend : 0;
        r._roas = chSpendShare > 0 ? chTotalRev / chSpendShare : 0;
      });

      function _renderChTable() {
        // Sort
        const sorted = [...channels].sort((a, b) => {
          let av, bv;
          if (_chSort.key === 'roas') { av = a._roas; bv = b._roas; }
          else if (_chSort.key === 'channel') { av = a.channel.toLowerCase(); bv = b.channel.toLowerCase(); return _chSort.dir === 'asc' ? (av < bv ? -1 : 1) : (bv < av ? -1 : 1); }
          else { av = a[_chSort.key] || 0; bv = b[_chSort.key] || 0; }
          return _chSort.dir === 'asc' ? av - bv : bv - av;
        });

        const totalTickets = channels.reduce((s, c) => s + c.ticket_count, 0) || 1;
        const totalBookings = channels.reduce((s, c) => s + c.bookings, 0) || 1;
        const totalEnroll = channels.reduce((s, c) => s + c.enrollment_count, 0) || 1;
        const maxTickets = Math.max(...channels.map(c => c.ticket_count));

        const arrow = k => _chSort.key === k ? (_chSort.dir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
        const hdBase = 'font-size:9px;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;cursor:pointer;user-select:none;';
        const hdActive = k => `color:${_chSort.key === k ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted};`;

        let html = '<div style="overflow-x:auto">';
        // Header
        html += '<div class="wr-ch-header" style="display:flex;align-items:center;gap:0;padding:0 0 8px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:6px">';
        html += `<div data-sort="channel" style="${hdBase}${hdActive('channel')}width:110px;text-align:right;padding-right:10px">Source${arrow('channel')}</div>`;
        html += '<div style="flex:1;min-width:80px"></div>';
        html += `<div data-sort="ticket_count" style="${hdBase}${hdActive('ticket_count')}width:44px">Tickets${arrow('ticket_count')}</div>`;
        html += `<div style="font-size:9px;font-weight:700;color:${Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;width:32px">%</div>`;
        html += `<div data-sort="ticket_revenue" style="${hdBase}${hdActive('ticket_revenue')}width:60px">Tkt Rev${arrow('ticket_revenue')}</div>`;
        html += `<div data-sort="bookings" style="${hdBase}${hdActive('bookings')}width:44px">Books${arrow('bookings')}</div>`;
        html += `<div style="font-size:9px;font-weight:700;color:${Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;width:32px">%</div>`;
        html += `<div data-sort="enrollment_count" style="${hdBase}${hdActive('enrollment_count')}width:44px">Enroll${arrow('enrollment_count')}</div>`;
        html += `<div style="font-size:9px;font-weight:700;color:${Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;width:32px">%</div>`;
        html += `<div data-sort="enrollment_revenue" style="${hdBase}${hdActive('enrollment_revenue')}width:64px">Enr Rev${arrow('enrollment_revenue')}</div>`;
        html += `<div data-sort="roas" style="${hdBase}${hdActive('roas')}width:50px">ROAS${arrow('roas')}</div>`;
        html += '</div>';

        // Rows
        sorted.forEach(r => {
          const color = _channelColors[r.channel] || '#6366f1';
          const barW = maxTickets > 0 ? ((r.ticket_count / maxTickets) * 100) : 0;
          const tPct = ((r.ticket_count / totalTickets) * 100).toFixed(0);
          const bPct = r.bookings > 0 ? ((r.bookings / totalBookings) * 100).toFixed(0) : '0';
          const ePct = r.enrollment_count > 0 ? ((r.enrollment_count / totalEnroll) * 100).toFixed(0) : '0';
          const cellMono = 'font-family:var(--font-mono);font-size:12px;';
          const mutedCell = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';';

          html += `<div style="display:flex;align-items:center;gap:0;margin-bottom:8px">`;
          html += `<div style="width:110px;font-size:11px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:10px" title="${r.channel}">${r.channel}</div>`;
          html += `<div style="flex:1;min-width:80px;height:22px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden"><div style="height:100%;width:${barW}%;background:${color};border-radius:4px;min-width:2px"></div></div>`;
          html += `<div style="${cellMono}width:44px;text-align:right;flex-shrink:0;color:${Theme.COLORS.textPrimary};font-weight:500">${r.ticket_count}</div>`;
          html += `<div style="${mutedCell}width:32px;text-align:right;flex-shrink:0">${tPct}%</div>`;
          html += `<div style="${cellMono}width:60px;text-align:right;flex-shrink:0;color:#6366f1">${Theme.money(r.ticket_revenue)}</div>`;
          html += `<div style="${cellMono}width:44px;text-align:right;flex-shrink:0;color:${r.bookings > 0 ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted};font-weight:500">${r.bookings || 0}</div>`;
          html += `<div style="${mutedCell}width:32px;text-align:right;flex-shrink:0">${bPct}%</div>`;
          html += `<div style="${cellMono}width:44px;text-align:right;flex-shrink:0;color:${r.enrollment_count > 0 ? '#22c55e' : Theme.COLORS.textMuted};font-weight:600">${r.enrollment_count || 0}</div>`;
          html += `<div style="${mutedCell}width:32px;text-align:right;flex-shrink:0">${ePct}%</div>`;
          html += `<div style="${cellMono}width:64px;text-align:right;flex-shrink:0;color:${r.enrollment_revenue > 0 ? '#22c55e' : Theme.COLORS.textMuted}">${r.enrollment_revenue > 0 ? Theme.money(r.enrollment_revenue) : '--'}</div>`;
          const roasColor = r._roas >= 3 ? '#22c55e' : r._roas >= 1 ? '#f59e0b' : r._roas > 0 ? Theme.COLORS.danger : Theme.COLORS.textMuted;
          html += `<div style="${cellMono}width:50px;text-align:right;flex-shrink:0;color:${roasColor};font-weight:600">${r._roas > 0 ? r._roas.toFixed(1) + 'x' : '--'}</div>`;
          html += '</div>';
        });

        // Totals row
        const totTktRev = channels.reduce((s, c) => s + c.ticket_revenue, 0);
        const totEnrRev = channels.reduce((s, c) => s + c.enrollment_revenue, 0);
        const totBooks = channels.reduce((s, c) => s + c.bookings, 0);
        const totEnr = channels.reduce((s, c) => s + c.enrollment_count, 0);
        html += `<div style="display:flex;align-items:center;gap:0;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px">`;
        html += `<div style="width:110px;flex-shrink:0"></div><div style="flex:1;min-width:80px"></div>`;
        html += `<div style="font-family:var(--font-mono);font-size:12px;width:44px;text-align:right;flex-shrink:0;font-weight:700;color:${Theme.COLORS.textPrimary}">${totalTickets}</div>`;
        html += `<div style="width:32px;flex-shrink:0"></div>`;
        html += `<div style="font-family:var(--font-mono);font-size:12px;width:60px;text-align:right;flex-shrink:0;font-weight:700;color:#6366f1">${Theme.money(totTktRev)}</div>`;
        html += `<div style="font-family:var(--font-mono);font-size:12px;width:44px;text-align:right;flex-shrink:0;font-weight:700;color:${Theme.COLORS.textPrimary}">${totBooks}</div>`;
        html += `<div style="width:32px;flex-shrink:0"></div>`;
        html += `<div style="font-family:var(--font-mono);font-size:12px;width:44px;text-align:right;flex-shrink:0;font-weight:700;color:#22c55e">${totEnr}</div>`;
        html += `<div style="width:32px;flex-shrink:0"></div>`;
        html += `<div style="font-family:var(--font-mono);font-size:12px;width:64px;text-align:right;flex-shrink:0;font-weight:700;color:#22c55e">${Theme.money(totEnrRev)}</div>`;
        const blendedRoas = totalSpend > 0 ? (totTktRev + totEnrRev) / totalSpend : 0;
        const blendedRoasColor = blendedRoas >= 3 ? '#22c55e' : blendedRoas >= 1 ? '#f59e0b' : Theme.COLORS.danger;
        html += `<div style="font-family:var(--font-mono);font-size:12px;width:50px;text-align:right;flex-shrink:0;font-weight:700;color:${blendedRoasColor}">${blendedRoas > 0 ? blendedRoas.toFixed(1) + 'x' : '--'}</div>`;
        html += '</div>';

        html += `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:10px;font-style:italic">Hyros ${modelLabel} attribution | Tickets = $27/$54 (Stripe) | Enrollments = sales > $500 | ROAS = (tkt rev + enr rev) / proportional ad spend</div>`;
        html += '</div>';
        loader.innerHTML = html;

        // Bind sort clicks
        loader.querySelectorAll('[data-sort]').forEach(el => {
          el.addEventListener('click', () => {
            const key = el.dataset.sort;
            if (_chSort.key === key) _chSort.dir = _chSort.dir === 'desc' ? 'asc' : 'desc';
            else { _chSort.key = key; _chSort.dir = 'desc'; }
            _renderChTable();
          });
        });
      }
      _renderChTable();
    }).catch(err => {
      loader.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">Failed: ${err.message}</p>`;
    });
  }

  // ---- Sales Hierarchy: Campaign > Adset > Ad (toggleable + drill-down) ----
  const adCard = document.createElement('div');
  adCard.className = 'card';
  adCard.style.padding = '16px 20px';

  // Title row with level toggle + attribution dropdown
  const adTitleRow = document.createElement('div');
  adTitleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
  const adTitle = document.createElement('div');
  adTitle.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary;
  adTitle.textContent = 'Sales by Campaign';
  const adControls = document.createElement('div');
  adControls.style.cssText = 'display:flex;align-items:center;gap:8px';
  const adToggle = document.createElement('div');
  adToggle.style.cssText = 'display:flex;gap:2px;background:rgba(255,255,255,0.04);border-radius:6px;padding:2px';
  ['Campaign', 'Adset', 'Ad'].forEach(level => {
    const btn = document.createElement('button');
    btn.textContent = level;
    btn.className = 'filter-btn' + (level === 'Campaign' ? ' active' : '');
    btn.style.cssText = 'padding:4px 12px;font-size:11px';
    btn.dataset.level = level.toLowerCase();
    adToggle.appendChild(btn);
  });
  adControls.appendChild(adToggle);
  adControls.appendChild(_createAttribDropdown());
  adTitleRow.appendChild(adTitle);
  adTitleRow.appendChild(adControls);
  adCard.appendChild(adTitleRow);


  // Breadcrumb for drill-down
  const adBreadcrumb = document.createElement('div');
  adBreadcrumb.style.cssText = 'display:none;align-items:center;gap:6px;margin-bottom:10px;font-size:11px';
  adCard.appendChild(adBreadcrumb);

  // Sort header + body
  const adHeaderEl = document.createElement('div');
  adHeaderEl.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)';
  adCard.appendChild(adHeaderEl);
  const adBodyEl = document.createElement('div');
  adBodyEl.id = 'wr-sales-hierarchy';
  adBodyEl.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';
  adCard.appendChild(adBodyEl);

  // Inject tooltip + drill-down styles once
  if (!document.getElementById('wr-hierarchy-style')) {
    const style = document.createElement('style');
    style.id = 'wr-hierarchy-style';
    style.textContent = `.wr-h-row{position:relative;cursor:pointer;transition:background .15s}.wr-h-row:hover{background:rgba(255,255,255,0.03);border-radius:6px}.wr-h-row--leaf{cursor:default}.wr-h-row--leaf:hover{background:transparent}.wr-h-chevron{color:${Theme.COLORS.textMuted};font-size:10px;transition:transform .15s;flex-shrink:0;width:12px;text-align:center}.wr-h-row:hover .wr-h-chevron{color:${Theme.COLORS.textPrimary}}`;
    document.head.appendChild(style);
  }

  function _loadHierarchy(model) {
  const modelLabel = model === 'first' ? 'first-click' : model === 'last' ? 'last-click' : 'scientific (50/50)';
  adHeaderEl.innerHTML = '';
  adBreadcrumb.style.display = 'none';
  adBodyEl.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';

  // Fetch hierarchy data -- try BQ, fall back to flat sources, then dummy
  const _dummyHierarchy = [
    { campaign: 'Broad + CBO Licensed Therapists', adset: 'CBO - Therapists 25-55', ad_name: 'Broad + CBO Licensed Ther - Video 1', sales: 111, revenue: 21500, ticket_count: 98, ticket_revenue: 3500, enrollment_count: 13, enrollment_revenue: 18000 },
    { campaign: 'Broad + CBO Licensed Therapists', adset: 'CBO - Therapists 25-55', ad_name: 'Broad + CBO Licensed Ther - Static', sales: 22, revenue: 4200, ticket_count: 19, ticket_revenue: 700, enrollment_count: 3, enrollment_revenue: 3500 },
    { campaign: 'Broad + CBO Licensed Therapists', adset: 'CBO - Therapists 35-65', ad_name: 'Broad + CBO Licensed Ther - Carousel', sales: 15, revenue: 2800, ticket_count: 12, ticket_revenue: 400, enrollment_count: 3, enrollment_revenue: 2400 },
    { campaign: 'Interest Stack - FB Coaches', adset: 'Interest - Life Coaches', ad_name: 'Main Interest Stack - FB - Coaches Vid', sales: 29, revenue: 19100, ticket_count: 22, ticket_revenue: 1100, enrollment_count: 7, enrollment_revenue: 18000 },
    { campaign: 'Interest Stack - FB Coaches', adset: 'Interest - Business Coaches', ad_name: 'LLA Stack - FB - Coaches Creative A', sales: 22, revenue: 9729, ticket_count: 18, ticket_revenue: 729, enrollment_count: 4, enrollment_revenue: 9000 },
    { campaign: 'Interest Stack - FB Coaches', adset: 'Interest - Business Coaches', ad_name: 'LLA Stack - FB - Coaches Creative B', sales: 8, revenue: 216, ticket_count: 8, ticket_revenue: 216, enrollment_count: 0, enrollment_revenue: 0 },
    { campaign: 'Broad - Educators', adset: 'Broad - Educators 30-55', ad_name: 'FB. 3064 Broad - Educator / Teacher', sales: 15, revenue: 9513, ticket_count: 12, ticket_revenue: 513, enrollment_count: 3, enrollment_revenue: 9000 },
    { campaign: 'Broad - Educators', adset: 'Broad - Educators 25-45', ad_name: 'Broad + - Educator / Teacher Retarget', sales: 7, revenue: 189, ticket_count: 7, ticket_revenue: 189, enrollment_count: 0, enrollment_revenue: 0 },
    { campaign: 'Broad - Attorneys', adset: 'Broad - Attorneys Financial', ad_name: 'Fb. Broad - Attorney Only - 1', sales: 11, revenue: 9378, ticket_count: 8, ticket_revenue: 378, enrollment_count: 3, enrollment_revenue: 9000 },
    { campaign: 'Broad - Attorneys', adset: 'Broad - Attorneys All', ad_name: 'Broad + - Attorney / Financial v2', sales: 35, revenue: 945, ticket_count: 35, ticket_revenue: 945, enrollment_count: 0, enrollment_revenue: 0 },
    { campaign: 'TOF Video', adset: 'TOF | Video | MC', ad_name: 'TOF | Video | MC | KW [Broad]', sales: 10, revenue: 9270, ticket_count: 7, ticket_revenue: 270, enrollment_count: 3, enrollment_revenue: 9000 },
    { campaign: 'TOF Video', adset: 'TOF | Video | Retarget', ad_name: 'TOF | Video | MC | KW [Comp]', sales: 1, revenue: 9000, ticket_count: 0, ticket_revenue: 0, enrollment_count: 1, enrollment_revenue: 9000 },
    { campaign: 'Email Campaigns', adset: 'SendGrid Blasts', ad_name: 'Email', sales: 15, revenue: 632, ticket_count: 15, ticket_revenue: 632, enrollment_count: 0, enrollment_revenue: 0 },
    { campaign: 'Lead Campaigns', adset: 'Leads | MAX', ad_name: 'LEADS | MAX | US | FREQ 3x', sales: 3, revenue: 6054, ticket_count: 2, ticket_revenue: 54, enrollment_count: 1, enrollment_revenue: 6000 },
    { campaign: 'Unknown', adset: 'Unknown Adset', ad_name: 'Unknown', sales: 49, revenue: 24500, ticket_count: 32, ticket_revenue: 1500, enrollment_count: 17, enrollment_revenue: 23000 },
  ];

  // Fetch hierarchy + campaign status in parallel
  const _hierarchyPromise = API.query('hyros', 'salesHierarchy', { days, model }).catch(() =>
    API.query('hyros', 'sourcesAttrib', { days, model }).then(rows =>
      rows.map(r => ({ campaign: 'Unknown', adset: 'Unknown Adset', ad_name: r.source, sales: r.sales, revenue: r.revenue, ticket_count: r.ticket_count || 0, ticket_revenue: r.ticket_revenue || 0, enrollment_count: r.enrollment_count || 0, enrollment_revenue: r.enrollment_revenue || 0 }))
    ).catch(() => _dummyHierarchy)
  );
  const _statusPromise = API.query('ads-meta', 'campaignStatus', {}).catch(() => []);

  Promise.all([_hierarchyPromise, _statusPromise]).then(([rawRows, statusRows]) => {
    if (!rawRows || rawRows.length === 0) {
      adBodyEl.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">No sales data</p>`;
      return;
    }
    _allHierarchyRows = rawRows;

    // Build status maps at all 3 levels from ad-level rows
    // Each map: name -> { active: bool, spend: number }
    // Campaign/adset aggregate: active if ANY child is active
    const statusByAd = {};
    const statusByAdset = {};
    const statusByCampaign = {};
    (statusRows || []).forEach(s => {
      const cn = s.campaign_name || 'Unknown';
      const asn = s.ad_set_name || 'Unknown Adset';
      const an = s.ad_name || 'Unknown';
      // Ad level
      statusByAd[an] = { active: s.is_active, spend: s.total_spend_30d || 0 };
      // Adset level: active if any ad in it is active
      if (!statusByAdset[asn]) statusByAdset[asn] = { active: false, spend: 0 };
      if (s.is_active) statusByAdset[asn].active = true;
      statusByAdset[asn].spend += (s.total_spend_30d || 0);
      // Campaign level: active if any adset/ad in it is active
      if (!statusByCampaign[cn]) statusByCampaign[cn] = { active: false, spend: 0 };
      if (s.is_active) statusByCampaign[cn].active = true;
      statusByCampaign[cn].spend += (s.total_spend_30d || 0);
    });

    const statusMaps = { campaign: statusByCampaign, adset: statusByAdset, ad: statusByAd };
    const hasStatus = statusRows && statusRows.length > 0;

    // Filter: only items that appear in Meta status (active or recently off), plus 'Unknown' passes
    function _inStatus(name, level) {
      const map = statusMaps[level] || {};
      if (map[name]) return true;
      for (const key of Object.keys(map)) {
        if (name.includes(key) || key.includes(name)) return true;
      }
      return false;
    }
    const filteredRows = rawRows.filter(r => {
      if (r.campaign === 'Unknown') return true;
      // Campaign must be in status OR adset OR ad
      return _inStatus(r.campaign, 'campaign') || _inStatus(r.adset, 'adset') || _inStatus(r.ad_name, 'ad');
    });
    const finalRows = hasStatus ? filteredRows : rawRows;

    const barColors = ['#6366f1', '#8b5cf6', '#a855f7', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#94a3b8'];
    let currentLevel = 'campaign';
    let drillFilter = {};
    const adSort = { key: 'sales', dir: 'desc' };

    function aggregate(rows, groupKey) {
      const map = {};
      rows.forEach(r => {
        const key = r[groupKey] || 'Unknown';
        if (!map[key]) map[key] = { name: key, sales: 0, revenue: 0, ticket_count: 0, ticket_revenue: 0, enrollment_count: 0, enrollment_revenue: 0 };
        map[key].sales += (r.sales || 0);
        map[key].revenue += (r.revenue || 0);
        map[key].ticket_count += (r.ticket_count || 0);
        map[key].ticket_revenue += (r.ticket_revenue || 0);
        map[key].enrollment_count += (r.enrollment_count || 0);
        map[key].enrollment_revenue += (r.enrollment_revenue || 0);
      });
      return Object.values(map);
    }

    function getFilteredRows() {
      return finalRows.filter(r => {
        if (drillFilter.campaign && r.campaign !== drillFilter.campaign) return false;
        if (drillFilter.adset && r.adset !== drillFilter.adset) return false;
        return true;
      });
    }

    function getGroupKey() {
      if (currentLevel === 'campaign') return 'campaign';
      if (currentLevel === 'adset') return 'adset';
      return 'ad_name';
    }

    function isLeaf() { return currentLevel === 'ad'; }

    function renderBreadcrumb() {
      if (!drillFilter.campaign) {
        adBreadcrumb.style.display = 'none';
        return;
      }
      adBreadcrumb.style.display = 'flex';
      let html = `<span style="cursor:pointer;color:${Theme.COLORS.accentPrimary || '#38bdf8'};text-decoration:underline" data-bc="root">All</span>`;
      html += `<span style="color:${Theme.COLORS.textMuted}">&rsaquo;</span>`;
      if (drillFilter.campaign) {
        const isCurrent = !drillFilter.adset;
        html += `<span style="cursor:${isCurrent ? 'default' : 'pointer'};color:${isCurrent ? Theme.COLORS.textPrimary : (Theme.COLORS.accentPrimary || '#38bdf8')};${isCurrent ? '' : 'text-decoration:underline'};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-bc="campaign" title="${drillFilter.campaign}">${drillFilter.campaign}</span>`;
      }
      if (drillFilter.adset) {
        html += `<span style="color:${Theme.COLORS.textMuted}">&rsaquo;</span>`;
        html += `<span style="color:${Theme.COLORS.textPrimary};max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${drillFilter.adset}">${drillFilter.adset}</span>`;
      }
      adBreadcrumb.innerHTML = html;
      adBreadcrumb.querySelectorAll('[data-bc]').forEach(el => {
        el.addEventListener('click', () => {
          const bc = el.dataset.bc;
          if (bc === 'root') { drillFilter = {}; currentLevel = 'campaign'; }
          else if (bc === 'campaign') { delete drillFilter.adset; currentLevel = 'adset'; }
          updateToggleState();
          renderAll();
        });
      });
    }

    function updateToggleState() {
      adToggle.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.level === currentLevel);
      });
      const titles = { campaign: 'Sales by Campaign', adset: 'Sales by Ad Set', ad: 'Sales by Ad' };
      adTitle.textContent = titles[currentLevel];
    }

    function renderHeaders() {
      const cols = [
        { key: 'sales', label: 'Sales', w: '36px' },
        { key: '_pct', label: '%', w: '36px' },
        { key: 'ticket_revenue', label: 'Tickets', w: '64px' },
        { key: 'enrollment_revenue', label: 'Enroll', w: '64px' },
      ];
      adHeaderEl.innerHTML = `<div style="width:${isLeaf() ? '12px' : '12px'};flex-shrink:0"></div><div style="width:160px;flex-shrink:0"></div><div style="flex:1"></div>`;
      cols.forEach(col => {
        const isActive = adSort.key === col.key;
        const arrow = isActive ? (adSort.dir === 'desc' ? ' &#9660;' : ' &#9650;') : '';
        adHeaderEl.innerHTML += `<div class="wr-ad-sort-col" data-sort="${col.key}" style="width:${col.w};font-size:10px;font-weight:600;color:${isActive ? '#e2e8f0' : Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;user-select:none">${col.label}${arrow}</div>`;
      });
      adHeaderEl.querySelectorAll('.wr-ad-sort-col').forEach(el => {
        el.addEventListener('click', () => {
          const k = el.dataset.sort;
          if (k === '_pct') return;
          if (adSort.key === k) adSort.dir = adSort.dir === 'desc' ? 'asc' : 'desc';
          else { adSort.key = k; adSort.dir = 'desc'; }
          renderHeaders();
          renderRows();
        });
      });
    }

    function renderRows() {
      const filtered = getFilteredRows();
      const grouped = aggregate(filtered, getGroupKey());
      const sorted = [...grouped].sort((a, b) => {
        const va = a[adSort.key] || 0, vb = b[adSort.key] || 0;
        return adSort.dir === 'desc' ? vb - va : va - vb;
      });
      const totalSales = sorted.reduce((s, r) => s + r.sales, 0) || 1;
      const totalTicket = sorted.reduce((s, r) => s + r.ticket_revenue, 0);
      const totalEnroll = sorted.reduce((s, r) => s + r.enrollment_revenue, 0);
      const maxSales = Math.max(...sorted.map(r => r.sales || 0));
      const leaf = isLeaf();

      // Status dot lookup at current drill level
      function _getStatus(name) {
        if (!hasStatus) return null;
        const map = statusMaps[currentLevel] || statusByCampaign;
        if (map[name]) return map[name].active;
        for (const [key, st] of Object.entries(map)) {
          if (name.includes(key) || key.includes(name)) return st.active;
        }
        return null;
      }

      function _rowHTML(r, i, extraClass) {
        const pct = ((r.sales / totalSales) * 100).toFixed(0);
        const widthPct = maxSales > 0 ? ((r.sales / maxSales) * 100) : 0;
        const color = barColors[i % barColors.length];
        const chevron = leaf ? '<span class="wr-h-chevron"></span>' : '<span class="wr-h-chevron">&#9656;</span>';
        const isActive = _getStatus(r.name);
        let statusDot;
        if (isActive === true) {
          statusDot = `<span title="Active" style="width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0;box-shadow:0 0 4px rgba(34,197,94,0.5)"></span>`;
        } else if (isActive === false) {
          statusDot = `<span title="Off (last 30d)" style="width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;box-shadow:0 0 4px rgba(239,68,68,0.5)"></span>`;
        } else {
          statusDot = `<span style="width:7px;height:7px;border-radius:50%;background:${Theme.COLORS.textMuted};flex-shrink:0;opacity:0.4"></span>`;
        }
        return `<div class="wr-h-row${leaf ? ' wr-h-row--leaf' : ''} ${extraClass}" data-name="${r.name.replace(/"/g, '&quot;')}" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;padding:4px 0">
          ${chevron}
          ${statusDot}
          <div style="width:152px;font-size:11px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.name}">${r.name}</div>
          <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${widthPct}%;background:${color};border-radius:4px;min-width:2px"></div>
          </div>
          <div style="width:36px;font-size:13px;font-family:var(--font-mono);font-weight:500;color:${Theme.COLORS.textPrimary};text-align:right;flex-shrink:0">${r.sales}</div>
          <div style="width:36px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0">${pct}%</div>
          <div style="width:64px;font-size:11px;color:#6366f1;text-align:right;flex-shrink:0;font-family:var(--font-mono)">${Theme.money(r.ticket_revenue)}</div>
          <div style="width:64px;font-size:11px;color:${Theme.COLORS.success};text-align:right;flex-shrink:0;font-family:var(--font-mono)">${Theme.money(r.enrollment_revenue)}</div>
        </div>`;
      }

      // Split active vs inactive
      const activeRows = [];
      const inactiveRows = [];
      sorted.forEach((r, i) => {
        const status = _getStatus(r.name);
        if (status === false) {
          inactiveRows.push({ r, i });
        } else {
          activeRows.push({ r, i });
        }
      });

      let html = '';
      activeRows.forEach(({ r, i }) => { html += _rowHTML(r, i, ''); });

      // Inactive section (hidden by default, "Show more" button)
      if (inactiveRows.length > 0) {
        html += `<div id="wr-h-show-more-btn" style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;user-select:none" title="Show ${inactiveRows.length} inactive items">
          <div style="flex:1;height:1px;background:rgba(255,255,255,0.06)"></div>
          <span style="font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.04em">Show ${inactiveRows.length} off &#9662;</span>
          <div style="flex:1;height:1px;background:rgba(255,255,255,0.06)"></div>
        </div>`;
        html += `<div id="wr-h-inactive-rows" style="display:none;opacity:0.6">`;
        inactiveRows.forEach(({ r, i }) => { html += _rowHTML(r, i, ''); });
        html += `</div>`;
      }

      html += `<div style="display:flex;justify-content:flex-end;gap:16px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">
        <span style="font-size:12px;color:${Theme.COLORS.textMuted}">Total: ${totalSales} sales</span>
        <span style="font-size:12px;color:#6366f1;font-weight:600;font-family:var(--font-mono)">${Theme.money(totalTicket)}</span>
        <span style="font-size:12px;color:${Theme.COLORS.success};font-weight:600;font-family:var(--font-mono)">${Theme.money(totalEnroll)}</span>
      </div>`;
      html += `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px;font-style:italic">Source: Hyros ${modelLabel} attribution${!leaf ? ' | Click a row to drill down' : ''}</div>`;
      adBodyEl.innerHTML = html;

      // Show more toggle
      const showMoreBtn = adBodyEl.querySelector('#wr-h-show-more-btn');
      const inactiveContainer = adBodyEl.querySelector('#wr-h-inactive-rows');
      if (showMoreBtn && inactiveContainer) {
        let expanded = false;
        showMoreBtn.addEventListener('click', () => {
          expanded = !expanded;
          inactiveContainer.style.display = expanded ? 'block' : 'none';
          showMoreBtn.querySelector('span').innerHTML = expanded
            ? `Hide ${inactiveRows.length} off &#9652;`
            : `Show ${inactiveRows.length} off &#9662;`;
        });
      }

      // Drill-down click handlers
      if (!leaf) {
        adBodyEl.querySelectorAll('.wr-h-row').forEach(el => {
          el.addEventListener('click', () => {
            const name = el.dataset.name;
            if (currentLevel === 'campaign') {
              drillFilter.campaign = name;
              currentLevel = 'adset';
            } else if (currentLevel === 'adset') {
              drillFilter.adset = name;
              currentLevel = 'ad';
            }
            updateToggleState();
            renderAll();
          });
        });
      }

      // Ad-level preview click handlers
      if (leaf) {
        adBodyEl.querySelectorAll('.wr-h-row').forEach(el => {
          el.style.cursor = 'pointer';
          el.classList.remove('wr-h-row--leaf');
          el.addEventListener('click', () => {
            const name = el.dataset.name;
            _showAdPreview(name, el);
          });
        });
      }
    }

    function renderAll() {
      renderBreadcrumb();
      renderHeaders();
      renderRows();
    }

    // Toggle button handlers
    adToggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        currentLevel = btn.dataset.level;
        drillFilter = {}; // reset drill when switching via toggle
        updateToggleState();
        renderAll();
      });
    });

    renderAll();
  }).catch(err => {
    adBodyEl.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">Failed to load: ${err.message}</p>`;
  });
  } // end _loadHierarchy

  // Initial load of all Hyros-sourced charts
  _loadChannelCards('first');
  _loadHierarchy('first');

  // DPL (Dollars Per Lead) & Cost Per Ticket
  const dplCptCard = _card('');
  const totalSpend = cur.total_spend || 0;
  const grossRev = cur.gross_revenue || 0;
  const totalCalls = cur.total_calls || 0;
  const ticketRev2 = cur.ticket_revenue || 0;
  const totalTickets = cur.ticket_count || (ticketRev2 > 0 ? Math.round(ticketRev2 / 27) : 0);
  const curDPL = totalCalls > 0 ? grossRev / totalCalls : 0;
  const curCPT = totalTickets > 0 ? totalSpend / totalTickets : 0;

  const prevSpend = prev.total_spend || 0;
  const prevRev = prev.gross_revenue || 0;
  const prevCalls = prev.total_calls || 0;
  const prevTicketRev = prev.ticket_revenue || 0;
  const prevTickets = prev.ticket_count || (prevTicketRev > 0 ? Math.round(prevTicketRev / 27) : 0);
  const prevDPL = prevCalls > 0 ? prevRev / prevCalls : 0;
  const prevCPT = prevTickets > 0 ? prevSpend / prevTickets : 0;

  const dplColor = curDPL >= 5000 ? Theme.COLORS.success : curDPL >= 2000 ? '#f59e0b' : Theme.COLORS.danger;
  const dplDelta = _delta(curDPL, prevDPL);
  // DPL higher = better (more revenue per booking)
  const dplArrow = dplDelta !== null ? (dplDelta > 0 ? `<span style="color:${Theme.COLORS.success};font-size:11px;margin-left:6px">&#9650; ${Math.abs(dplDelta).toFixed(1)}%</span>` : dplDelta < 0 ? `<span style="color:${Theme.COLORS.danger};font-size:11px;margin-left:6px">&#9660; ${Math.abs(dplDelta).toFixed(1)}%</span>` : '') : '';

  const cptDelta = _delta(curCPT, prevCPT);
  // CPT lower = better
  const cptArrow = cptDelta !== null ? (cptDelta < 0 ? `<span style="color:${Theme.COLORS.success};font-size:11px;margin-left:6px">&#9660; ${Math.abs(cptDelta).toFixed(1)}%</span>` : cptDelta > 0 ? `<span style="color:${Theme.COLORS.danger};font-size:11px;margin-left:6px">&#9650; ${cptDelta.toFixed(1)}%</span>` : '') : '';

  // DPL gauge: $10K = full (higher is better)
  const dplMax = 10000;
  const dplPct = Math.min((curDPL / dplMax) * 100, 100);

  // CPT gauge: $600 = full (lower is better)
  const cptMax = 600;
  const cptPct = Math.min((curCPT / cptMax) * 100, 100);
  const cptColor = curCPT <= 300 ? Theme.COLORS.success : curCPT <= 450 ? '#f59e0b' : Theme.COLORS.danger;

  dplCptCard.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <!-- DPL -->
      <div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};margin-bottom:10px">Dollars Per Lead (DPL)</div>
        <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:12px">
          <span style="font-size:32px;font-weight:800;color:${dplColor};font-family:var(--font-mono)">${Theme.money(curDPL)}</span>
          ${dplArrow}
        </div>
        <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${dplPct}%;background:${dplColor};border-radius:4px;transition:width 0.6s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:${Theme.COLORS.textMuted}">
          <span>$0</span>
          <span style="color:${Theme.COLORS.success}">$5K target</span>
          <span>$10K</span>
        </div>
        <div style="margin-top:12px;font-size:11px;color:${Theme.COLORS.textMuted};line-height:1.5">
          <span style="color:${Theme.COLORS.textSecondary}">Revenue:</span> ${Theme.money(grossRev)} &middot;
          <span style="color:${Theme.COLORS.textSecondary}">Bookings:</span> ${totalCalls}
          ${prevDPL > 0 ? `<br><span style="color:${Theme.COLORS.textMuted}">Prev period: ${Theme.money(prevDPL)}</span>` : ''}
        </div>
      </div>

      <!-- Cost Per Ticket -->
      <div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};margin-bottom:10px">Cost Per Workshop Ticket</div>
        <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:12px">
          <span style="font-size:32px;font-weight:800;color:${cptColor};font-family:var(--font-mono)">${Theme.money(curCPT)}</span>
          ${cptArrow}
        </div>
        <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${cptPct}%;background:${cptColor};border-radius:4px;transition:width 0.6s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:${Theme.COLORS.textMuted}">
          <span>$0</span>
          <span style="color:${Theme.COLORS.success}">$300 target</span>
          <span>$600</span>
        </div>
        <div style="margin-top:12px;font-size:11px;color:${Theme.COLORS.textMuted};line-height:1.5">
          <span style="color:${Theme.COLORS.textSecondary}">Spend:</span> ${Theme.money(totalSpend)} &middot;
          <span style="color:${Theme.COLORS.textSecondary}">Tickets:</span> ${totalTickets}
          ${prevCPT > 0 ? `<br><span style="color:${Theme.COLORS.textMuted}">Prev period: ${Theme.money(prevCPT)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
  chartsRow.appendChild(dplCptCard);
  chartsRow.appendChild(channelCard);

  // ---- CPA by Channel ----
  const cpaCard = _card('CPA by Channel');
  const cpaBodyEl = document.createElement('div');
  cpaBodyEl.className = 'wr-ch-body';
  cpaBodyEl.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';
  cpaCard.appendChild(cpaBodyEl);

  // Compute CPA: ad spend (Meta) / enrollments (Hyros) per channel
  // Use ads-meta campaigns for spend, hyros sources for enrollment counts
  Promise.all([
    API.query('ads-meta', 'campaigns', { days }),
    API.query('hyros', 'sourcesAttrib', { days, model: _currentAttribModel }).catch(() => API.query('hyros', 'sources', { days }))
  ]).then(([metaCampaigns, hyrosSources]) => {
    // Aggregate Meta spend by channel (reuse _classifyChannel on campaign names)
    const spendByChannel = {};
    (metaCampaigns || []).forEach(c => {
      const channel = _classifyChannel(c.campaign_name);
      spendByChannel[channel] = (spendByChannel[channel] || 0) + (c.spend || 0);
    });

    // Aggregate Hyros enrollments by channel
    const enrollByChannel = {};
    (hyrosSources || []).forEach(r => {
      const channel = _classifyChannel(r.source);
      enrollByChannel[channel] = (enrollByChannel[channel] || 0) + (r.enrollment_count || 0);
    });

    // Merge into CPA rows
    const allChannels = new Set([...Object.keys(spendByChannel), ...Object.keys(enrollByChannel)]);
    const cpaRows = [];
    allChannels.forEach(ch => {
      const spend = spendByChannel[ch] || 0;
      const enrollments = enrollByChannel[ch] || 0;
      if (spend === 0 && enrollments === 0) return;
      const cpa = enrollments > 0 ? spend / enrollments : null;
      cpaRows.push({ channel: ch, spend, enrollments, cpa });
    });
    cpaRows.sort((a, b) => (a.cpa || Infinity) - (b.cpa || Infinity));

    if (cpaRows.length === 0) {
      cpaBodyEl.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">No CPA data</p>`;
      return;
    }

    const maxCPA = Math.max(...cpaRows.filter(r => r.cpa !== null).map(r => r.cpa));
    let html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06)">';
    html += `<div style="width:120px;flex-shrink:0"></div><div style="flex:1"></div>`;
    html += `<div style="width:50px;font-size:10px;font-weight:600;color:${Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.04em">CPA</div>`;
    html += `<div style="width:50px;font-size:10px;font-weight:600;color:${Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.04em">Spend</div>`;
    html += `<div style="width:36px;font-size:10px;font-weight:600;color:${Theme.COLORS.textMuted};text-align:right;text-transform:uppercase;letter-spacing:.04em">Enr</div>`;
    html += '</div>';

    cpaRows.forEach(r => {
      const color = _channelColors[r.channel] || '#6366f1';
      const barPct = r.cpa !== null && maxCPA > 0 ? ((r.cpa / maxCPA) * 100) : 0;
      // CPA color: lower is better. Green < $3K, yellow < $6K, red >= $6K
      const cpaColor = r.cpa === null ? Theme.COLORS.textMuted : r.cpa <= 3000 ? Theme.COLORS.success : r.cpa <= 6000 ? '#f59e0b' : Theme.COLORS.danger;
      const cpaText = r.cpa !== null ? Theme.money(r.cpa) : '--';

      html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:120px;font-size:12px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.channel}">${r.channel}</div>
        <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden"><div style="height:100%;width:${barPct}%;background:${color};border-radius:4px;min-width:2px"></div></div>
        <div style="width:50px;font-size:13px;font-family:var(--font-mono);font-weight:600;color:${cpaColor};text-align:right;flex-shrink:0">${cpaText}</div>
        <div style="width:50px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0;font-family:var(--font-mono)">${Theme.money(r.spend)}</div>
        <div style="width:36px;font-size:11px;color:${Theme.COLORS.success};text-align:right;flex-shrink:0;font-family:var(--font-mono)">${r.enrollments}</div>
      </div>`;
    });

    html += `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px;font-style:italic">CPA = Meta spend / Hyros enrollments per channel</div>`;
    cpaBodyEl.innerHTML = html;
  }).catch(err => {
    cpaBodyEl.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">Failed: ${err.message}</p>`;
  });

  chartsRow.appendChild(cpaCard);
  chartsRow.appendChild(adCard);

  // ---- Ad Preview Panel (placeholder) ----
  const previewCard = document.createElement('div');
  previewCard.className = 'card';
  previewCard.id = 'wr-ad-preview';
  previewCard.style.cssText = 'padding:16px 20px;display:flex;flex-direction:column;min-height:400px;position:sticky;top:80px;align-self:start';

  const previewTitle = document.createElement('div');
  previewTitle.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';margin-bottom:12px';
  previewTitle.textContent = 'Ad Preview';
  previewCard.appendChild(previewTitle);

  const previewBody = document.createElement('div');
  previewBody.id = 'wr-ad-preview-body';
  previewBody.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(255,255,255,0.1);border-radius:10px;padding:24px;text-align:center';
  previewBody.innerHTML = `
    <div>
      <div style="font-size:32px;opacity:0.2;margin-bottom:12px">&#128065;</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};line-height:1.6">
        Click any ad in<br><strong style="color:${Theme.COLORS.textSecondary}">Sales by Campaign</strong><br>to preview it here
      </div>
    </div>`;
  previewCard.appendChild(previewBody);

  // Show ad preview when an ad row is clicked
  function _showAdPreview(adName, rowEl) {
    // Highlight selected row
    const allRows = adBodyEl.querySelectorAll('.wr-h-row');
    allRows.forEach(r => r.style.background = '');
    if (rowEl) rowEl.style.background = 'rgba(99,102,241,0.08)';

    // Find ad data from hierarchy
    const adRow = _allHierarchyRows.find(r => r.ad_name === adName);

    previewBody.style.alignItems = 'stretch';
    previewBody.style.justifyContent = 'flex-start';
    previewBody.style.flexDirection = 'column';
    previewBody.style.border = 'none';
    previewBody.style.padding = '0';

    const sales = adRow ? adRow.sales : 0;
    const tickets = adRow ? adRow.ticket_count : 0;
    const enrolls = adRow ? adRow.enrollment_count : 0;
    const revenue = adRow ? adRow.revenue : 0;
    const tktRev = adRow ? adRow.ticket_revenue : 0;
    const enrRev = adRow ? adRow.enrollment_revenue : 0;

    previewBody.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:12px;line-height:1.4;word-break:break-word">${adName}</div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;margin-bottom:14px">
        <div style="height:220px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.2);position:relative">
          <div style="text-align:center">
            <div style="font-size:40px;opacity:0.15;margin-bottom:8px">&#127912;</div>
            <div style="font-size:11px;color:${Theme.COLORS.textMuted}">Creative preview</div>
            <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:4px;opacity:0.6">Connect Meta API for live thumbnails</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Sales</div>
          <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">${sales.toLocaleString()}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Revenue</div>
          <div style="font-size:18px;font-weight:700;color:#22c55e">${Theme.money(revenue)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Tickets</div>
          <div style="font-size:16px;font-weight:600;color:#6366f1">${tickets} <span style="font-size:11px;color:${Theme.COLORS.textMuted}">${Theme.money(tktRev)}</span></div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px 12px">
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Enrollments</div>
          <div style="font-size:16px;font-weight:600;color:#22c55e">${enrolls} <span style="font-size:11px;color:${Theme.COLORS.textMuted}">${Theme.money(enrRev)}</span></div>
        </div>
      </div>
      <div style="font-size:10px;color:${Theme.COLORS.textMuted};font-style:italic">Placeholder -- Meta API integration will show live creative thumbnails, CTR, CPM, and frequency data</div>
    `;
  }

  // Store hierarchy rows globally for preview lookup
  let _allHierarchyRows = [];

  chartsRow.appendChild(previewCard);

  // ---- Cost vs Sales Butterfly Chart ----
  // Revenue bars extend RIGHT, Ad Spend bars extend LEFT from center axis
  const butterflyCard = document.createElement('div');
  butterflyCard.className = 'card';
  butterflyCard.style.cssText = 'padding:20px 24px;margin-top:16px;grid-column:1/-1';
  const bfTitle = document.createElement('div');
  bfTitle.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';
  bfTitle.innerHTML = `<div style="font-size:13px;font-weight:700;font-family:Manrope,sans-serif;color:#f1f5f9;text-transform:uppercase;letter-spacing:0.05em">Cost vs Sales</div>
    <div style="font-size:9px;color:#475569;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.06em">30-day -- Stripe + Hyros revenue vs Meta spend</div>`;
  butterflyCard.appendChild(bfTitle);

  const bfCanvas = document.createElement('canvas');
  bfCanvas.style.cssText = 'display:block;height:360px';
  butterflyCard.appendChild(bfCanvas);

  const bfLegend = document.createElement('div');
  bfLegend.style.cssText = 'display:flex;flex-wrap:wrap;gap:20px;margin-top:16px;justify-content:center;align-items:center';
  butterflyCard.appendChild(bfLegend);

  container.appendChild(butterflyCard);

  // ---- Draw butterfly once data loads ----
  // Always show 30 days for the butterfly chart regardless of page filter
  const bfDays = 30;
  // 3 independent BQ sources: Hyros (ticket+enrollment rev), Meta (spend), Stripe (ticket rev fallback)
  Promise.all([
    API.query('hyros', 'dailySplit', { days: bfDays }).catch(() => []),
    API.query('ads-meta', 'daily', { days: bfDays }).catch(() => []),
    API.query('war-room', 'dailyTable', { days: bfDays }).catch(() => [])
  ]).then(([hyrosRows, metaRows, stripeRows]) => {

    // Build full date range so every day gets a bar slot
    const byDate = {};
    const today = new Date();
    for (let i = bfDays - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      byDate[dateStr] = { date: dateStr, ticket_revenue: 0, enrollment_revenue: 0, spend: 0 };
    }

    // Normalize any date value to YYYY-MM-DD string
    // BQ returns dates as {value: "2026-04-09"} objects or plain strings
    function _ds(v) {
      if (!v) return null;
      if (typeof v === 'object' && v.value) return String(v.value).slice(0, 10);
      return String(v).slice(0, 10);
    }

    // Layer 1: Hyros daily split (ticket + enrollment revenue from attribution)
    (hyrosRows || []).forEach(r => {
      const d = _ds(r.day);
      if (!d) return;
      if (!byDate[d]) byDate[d] = { date: d, ticket_revenue: 0, enrollment_revenue: 0, spend: 0 };
      byDate[d].ticket_revenue += (r.ticket_revenue || 0);
      byDate[d].enrollment_revenue += (r.enrollment_revenue || 0);
    });

    // Layer 2: Meta ad spend
    (metaRows || []).forEach(r => {
      const d = _ds(r.ad_date);
      if (!d) return;
      if (!byDate[d]) byDate[d] = { date: d, ticket_revenue: 0, enrollment_revenue: 0, spend: 0 };
      byDate[d].spend += (r.spend || 0);
    });

    // Layer 3: If Hyros returned no ticket revenue, fall back to Stripe
    const hyrosHasTickets = (hyrosRows || []).some(r => (r.ticket_revenue || 0) > 0);
    if (!hyrosHasTickets) {
      (stripeRows || []).forEach(r => {
        const d = _ds(r.date);
        if (d && byDate[d]) byDate[d].ticket_revenue += (r.ticket_revenue || 0);
      });
    }

    let data = Object.values(byDate).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

    // Draw -- use rAF to ensure canvas has layout dimensions
    requestAnimationFrame(() => {
      try {
        _drawButterfly(bfCanvas, bfLegend, data);
      } catch (err) {
        console.error('[butterfly] draw error:', err);
      }
    });
  }).catch(err => console.error('[butterfly] fetch error:', err));

  function _drawButterfly(bfCanvas, bfLegend, data) {
    const dpr = window.devicePixelRatio || 1;
    const parent = bfCanvas.parentElement;
    const W = (parent ? parent.clientWidth - 48 : 0) || bfCanvas.clientWidth || 800;
    const H = 360;
    bfCanvas.width = W * dpr;
    bfCanvas.height = H * dpr;
    bfCanvas.style.width = W + 'px';
    bfCanvas.style.height = H + 'px';
    const ctx = bfCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 24, right: 16, bottom: 44, left: 52 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const centerY = pad.top + plotH / 2;
    const maxRev = Math.max(...data.map(d => d.ticket_revenue + d.enrollment_revenue), 1);
    const maxSpend = Math.max(...data.map(d => d.spend), 1);
    const halfH = plotH / 2 - 6;
    const barW = Math.max(4, Math.min(18, (plotW / data.length) * 0.72));
    const slotW = plotW / data.length;

    // ---- Background gradient zones ----
    // Revenue zone (top half) - subtle green wash
    const revZone = ctx.createLinearGradient(0, pad.top, 0, centerY);
    revZone.addColorStop(0, 'rgba(34,197,94,0.03)');
    revZone.addColorStop(1, 'transparent');
    ctx.fillStyle = revZone;
    ctx.fillRect(pad.left, pad.top, plotW, halfH + 6);

    // Spend zone (bottom half) - subtle red wash
    const spendZone = ctx.createLinearGradient(0, centerY, 0, H - pad.bottom);
    spendZone.addColorStop(0, 'transparent');
    spendZone.addColorStop(1, 'rgba(239,68,68,0.03)');
    ctx.fillStyle = spendZone;
    ctx.fillRect(pad.left, centerY, plotW, halfH + 6);

    // ---- Grid lines ----
    ctx.setLineDash([2, 4]);
    for (let i = 1; i <= 4; i++) {
      const frac = i / 4;
      // Revenue side
      const yUp = centerY - frac * halfH;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.left, yUp); ctx.lineTo(W - pad.right, yUp); ctx.stroke();
      // Label
      const revVal = maxRev * frac;
      ctx.fillStyle = '#475569';
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(revVal >= 1000 ? '$' + (revVal / 1000).toFixed(0) + 'k' : '$' + Math.round(revVal), pad.left - 8, yUp + 3);
      // Spend side
      const yDown = centerY + frac * halfH;
      ctx.beginPath(); ctx.moveTo(pad.left, yDown); ctx.lineTo(W - pad.right, yDown); ctx.stroke();
      const spVal = maxSpend * frac;
      ctx.fillText(spVal >= 1000 ? '$' + (spVal / 1000).toFixed(0) + 'k' : '$' + Math.round(spVal), pad.left - 8, yDown + 3);
    }
    ctx.setLineDash([]);

    // ---- Center axis ----
    const axisGrad = ctx.createLinearGradient(pad.left, 0, W - pad.right, 0);
    axisGrad.addColorStop(0, 'rgba(255,255,255,0)');
    axisGrad.addColorStop(0.15, 'rgba(255,255,255,0.15)');
    axisGrad.addColorStop(0.85, 'rgba(255,255,255,0.15)');
    axisGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = axisGrad;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, centerY); ctx.lineTo(W - pad.right, centerY); ctx.stroke();

    // ---- Helper: draw a bar with rounded top edge ----
    // dir: 'up' = grows upward from y, 'down' = grows downward from y
    function _bar(x, y, w, h, r, dir) {
      if (h < 1) return;
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      if (dir === 'up') {
        // Bar from y going up by h pixels. Bottom edge flat at y, top edge rounded.
        const top = y - h;
        ctx.moveTo(x, y);                          // bottom-left
        ctx.lineTo(x, top + r);                    // left edge up
        ctx.arcTo(x, top, x + r, top, r);          // top-left corner
        ctx.lineTo(x + w - r, top);                // top edge
        ctx.arcTo(x + w, top, x + w, top + r, r);  // top-right corner
        ctx.lineTo(x + w, y);                      // right edge down
      } else {
        // Bar from y going down by h pixels. Top edge flat at y, bottom edge rounded.
        const bot = y + h;
        ctx.moveTo(x, y);                          // top-left
        ctx.lineTo(x + w, y);                      // top edge
        ctx.lineTo(x + w, bot - r);                // right edge down
        ctx.arcTo(x + w, bot, x + w - r, bot, r);  // bottom-right corner
        ctx.lineTo(x + r, bot);                    // bottom edge
        ctx.arcTo(x, bot, x, bot - r, r);          // bottom-left corner
      }
      ctx.closePath();
    }

    // ---- Draw bars with gradients ----
    const radius = Math.min(3, barW / 3);

    data.forEach((d, i) => {
      const x = pad.left + i * slotW + (slotW - barW) / 2;
      const totalRev = d.ticket_revenue + d.enrollment_revenue;

      const enrollH = totalRev > 0 ? (d.enrollment_revenue / maxRev) * halfH : 0;
      const ticketH = totalRev > 0 ? (d.ticket_revenue / maxRev) * halfH : 0;

      // Enrollment revenue (green) -- sits on top of ticket bar
      if (enrollH > 1) {
        const barTop = centerY - ticketH - enrollH;
        const grad = ctx.createLinearGradient(0, barTop, 0, centerY - ticketH);
        grad.addColorStop(0, '#22c55e');
        grad.addColorStop(1, '#16a34a');
        ctx.fillStyle = grad;
        _bar(x, centerY - ticketH, barW, enrollH, radius, 'up');
        ctx.fill();
        ctx.shadowColor = 'rgba(34,197,94,0.25)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Ticket revenue (indigo) -- base of revenue stack, bottom at centerY
      if (ticketH > 1) {
        const grad = ctx.createLinearGradient(0, centerY - ticketH, 0, centerY);
        grad.addColorStop(0, '#818cf8');
        grad.addColorStop(1, '#6366f1');
        ctx.fillStyle = grad;
        // Round top only if no enrollment above
        _bar(x, centerY, barW, ticketH, enrollH > 1 ? 0 : radius, 'up');
        ctx.fill();
      }

      // Spend bar (red, going down from center)
      const spendH = d.spend > 0 ? (d.spend / maxSpend) * halfH : 0;
      if (spendH > 1) {
        const grad = ctx.createLinearGradient(0, centerY + 2, 0, centerY + 2 + spendH);
        grad.addColorStop(0, '#ef4444');
        grad.addColorStop(1, '#dc2626');
        ctx.fillStyle = grad;
        _bar(x, centerY + 2, barW, spendH, radius, 'down');
        ctx.fill();
        ctx.shadowColor = 'rgba(239,68,68,0.2)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    });

    // ---- X axis labels ----
    ctx.fillStyle = '#475569';
    ctx.font = '500 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.ceil(data.length / 12));
    data.forEach((d, i) => {
      if (i % step !== 0 && i !== data.length - 1) return;
      const x = pad.left + i * slotW + slotW / 2;
      const label = d.date.slice(5); // "MM-DD"
      ctx.fillText(label, x, H - pad.bottom + 16);
    });

    // ---- Zone labels (revenue / spend) ----
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0.08em';
    ctx.fillStyle = 'rgba(34,197,94,0.35)';
    ctx.fillText('REVENUE', pad.left + 4, pad.top + 12);
    ctx.fillStyle = 'rgba(239,68,68,0.35)';
    ctx.fillText('AD SPEND', pad.left + 4, H - pad.bottom - 6);
    ctx.letterSpacing = '0';

    // ---- Totals legend (HTML) ----
    const totTicket = data.reduce((s, d) => s + d.ticket_revenue, 0);
    const totEnroll = data.reduce((s, d) => s + d.enrollment_revenue, 0);
    const totSpend = data.reduce((s, d) => s + d.spend, 0);
    const netRev = totTicket + totEnroll;
    const roas = totSpend > 0 ? (netRev / totSpend).toFixed(1) : '--';
    const roasNum = parseFloat(roas);
    const roasColor = roasNum >= 3 ? '#22c55e' : roasNum >= 1 ? '#f59e0b' : '#ef4444';

    bfLegend.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#818cf8,#6366f1)"></div>
        <span style="font-size:11px;color:#7c8da4;font-family:'JetBrains Mono',monospace">Tickets <span style="color:#f1f5f9;font-weight:600">${Theme.money(totTicket)}</span></span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#22c55e,#16a34a)"></div>
        <span style="font-size:11px;color:#7c8da4;font-family:'JetBrains Mono',monospace">Enrollments <span style="color:#f1f5f9;font-weight:600">${Theme.money(totEnroll)}</span></span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,#ef4444,#dc2626)"></div>
        <span style="font-size:11px;color:#7c8da4;font-family:'JetBrains Mono',monospace">Meta Spend <span style="color:#f1f5f9;font-weight:600">${Theme.money(totSpend)}</span></span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-left:8px;padding:4px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
        <span style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;font-family:'JetBrains Mono',monospace">ROAS</span>
        <span style="font-size:16px;font-weight:800;color:${roasColor};font-family:Manrope,sans-serif">${roas}x</span>
      </div>
    `;
  }

  // ---- Ticket Sales Velocity & Journey -- Weekly ----
  const velocityCard = document.createElement('div');
  velocityCard.className = 'card';
  velocityCard.style.cssText = 'padding:20px 24px;margin-top:16px';

  const velTitle = document.createElement('div');
  velTitle.style.cssText = `display:flex;align-items:center;justify-content:space-between;margin-bottom:14px`;
  velTitle.innerHTML = `<div style="font-size:13px;font-weight:700;font-family:Manrope,sans-serif;color:${Theme.COLORS.textPrimary};text-transform:uppercase;letter-spacing:0.05em">Ticket Sales Velocity & Journey -- Weekly Aggregates</div>`;
  velocityCard.appendChild(velTitle);

  const velTable = document.createElement('div');
  velTable.style.cssText = 'overflow-x:auto';
  velTable.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';
  velocityCard.appendChild(velTable);
  container.appendChild(velocityCard);

  // Dummy weekly data (replaced by BQ when deployed)
  function _dummyWeeklyVelocity() {
    const weeks = [];
    const today = new Date();
    for (let w = 0; w < 8; w++) {
      const end = new Date(today); end.setDate(end.getDate() - w * 7);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      const attendees = Math.round(100 + Math.random() * 180);
      const bookings = Math.round(attendees * (0.28 + Math.random() * 0.12));
      const vipCount = Math.round(attendees * (0.35 + Math.random() * 0.25));
      weeks.push({
        week_num: 15 - w,
        week_start: start.toISOString().slice(0, 10),
        week_end: end.toISOString().slice(0, 10),
        attendees, bookings,
        booking_pct: attendees > 0 ? (bookings / attendees) * 100 : 0,
        vip_count: vipCount,
        vip_pct: attendees > 0 ? (vipCount / attendees) * 100 : 0
      });
    }
    return weeks;
  }

  function _dummyDailyVelocity() {
    const rows = [];
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // Monday=1
    for (let d = 0; d < dayOfWeek; d++) {
      const date = new Date(today); date.setDate(date.getDate() - d);
      const attendees = Math.round(15 + Math.random() * 25);
      const bookings = Math.round(attendees * (0.25 + Math.random() * 0.15));
      const vipCount = Math.round(attendees * (0.3 + Math.random() * 0.3));
      rows.push({
        day: date.toISOString().slice(0, 10),
        attendees, bookings,
        booking_pct: attendees > 0 ? (bookings / attendees) * 100 : 0,
        vip_count: vipCount,
        vip_pct: attendees > 0 ? (vipCount / attendees) * 100 : 0
      });
    }
    return rows;
  }

  function _trendBox(current, prev) {
    if (prev == null) return '<span style="display:inline-block;width:14px;height:10px;border-radius:2px;background:rgba(100,116,139,0.2)"></span>';
    const diff = current - prev;
    let color, glow;
    if (diff > 5)      { color = '#16a34a'; glow = '0 0 6px rgba(22,163,74,0.5)'; }
    else if (diff > 2) { color = '#22c55e'; glow = '0 0 4px rgba(34,197,94,0.4)'; }
    else if (diff > 0.5) { color = 'rgba(34,197,94,0.45)'; glow = 'none'; }
    else if (diff >= -0.5) { color = 'rgba(100,116,139,0.2)'; glow = 'none'; }
    else if (diff >= -2) { color = 'rgba(239,68,68,0.45)'; glow = 'none'; }
    else if (diff >= -5) { color = '#ef4444'; glow = '0 0 4px rgba(239,68,68,0.4)'; }
    else { color = '#dc2626'; glow = '0 0 6px rgba(220,38,38,0.5)'; }
    return `<span style="display:inline-block;width:14px;height:10px;border-radius:2px;background:${color};box-shadow:${glow}"></span>`;
  }

  function _renderVelocityTable(weeklyRows, dailyRows) {
    const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // Build weekly rows HTML
    let html = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:1px solid ${Theme.COLORS.border}">
        <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${Theme.COLORS.textMuted}">Date</th>
        <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${Theme.COLORS.textMuted}">Time Slot</th>
        <th style="text-align:right;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${Theme.COLORS.textMuted}">Attendees</th>
        <th style="text-align:right;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${Theme.COLORS.textMuted}">Bookings</th>
        <th style="text-align:right;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${Theme.COLORS.textMuted}">Booking %</th>
        <th style="text-align:right;padding:10px 16px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:${Theme.COLORS.textMuted}">VIP %</th>
      </tr></thead><tbody>`;

    // Current week = first row -- expand into daily breakdown
    const currentWeek = weeklyRows[0];
    if (currentWeek && dailyRows && dailyRows.length > 0) {
      // Week summary row (current week, clickable header)
      const bkPctColor = currentWeek.booking_pct >= 35 ? Theme.COLORS.success : currentWeek.booking_pct >= 28 ? Theme.COLORS.warning : Theme.COLORS.danger;
      const vipPctColor = currentWeek.vip_pct >= 45 ? Theme.COLORS.success : currentWeek.vip_pct >= 30 ? Theme.COLORS.warning : Theme.COLORS.textSecondary;
      html += `<tr style="background:rgba(124,58,237,0.06);border-bottom:1px solid ${Theme.COLORS.border}">
        <td style="padding:10px 16px;color:${Theme.COLORS.textPrimary};font-weight:600">${currentWeek.week_start} to ${currentWeek.week_end}</td>
        <td style="padding:10px 16px;font-family:var(--font-mono);color:${Theme.COLORS.textSecondary}">Week ${currentWeek.week_num} <span style="font-size:10px;color:${Theme.COLORS.accentLight};margin-left:4px">CURRENT</span></td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${Theme.COLORS.textPrimary}">${currentWeek.attendees}</td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${Theme.COLORS.textPrimary}">${currentWeek.bookings}</td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${bkPctColor}">${currentWeek.booking_pct.toFixed(1)}%</td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${vipPctColor}">${currentWeek.vip_pct.toFixed(1)}%</td>
      </tr>`;

      // Daily breakdown rows for current week
      dailyRows.forEach((r, idx) => {
        const d = new Date(r.day + 'T00:00:00');
        const dayName = dayLabels[d.getDay()];
        const prevRow = dailyRows[idx + 1] || null;
        const bkColor = r.booking_pct >= 35 ? Theme.COLORS.success : r.booking_pct >= 28 ? Theme.COLORS.warning : Theme.COLORS.danger;
        const vColor = r.vip_pct >= 45 ? Theme.COLORS.success : r.vip_pct >= 30 ? Theme.COLORS.warning : Theme.COLORS.textSecondary;
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03);border-left:3px solid rgba(124,58,237,0.3)">
          <td style="padding:8px 16px 8px 24px;color:${Theme.COLORS.textSecondary};font-size:12px">${r.day}</td>
          <td style="padding:8px 16px;font-family:var(--font-mono);font-size:12px;color:${Theme.COLORS.textMuted}">${dayName}</td>
          <td style="padding:8px 16px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${Theme.COLORS.textSecondary}">${r.attendees}</td>
          <td style="padding:8px 16px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${Theme.COLORS.textSecondary}">${r.bookings}</td>
          <td style="padding:8px 16px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${bkColor}"><span style="display:inline-flex;align-items:center;gap:6px">${r.booking_pct.toFixed(1)}% ${_trendBox(r.booking_pct, prevRow ? prevRow.booking_pct : null)}</span></td>
          <td style="padding:8px 16px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${vColor}"><span style="display:inline-flex;align-items:center;gap:6px">${r.vip_pct.toFixed(1)}% ${_trendBox(r.vip_pct, prevRow ? prevRow.vip_pct : null)}</span></td>
        </tr>`;
      });
    }

    // Previous weeks
    const prevWeeks = currentWeek ? weeklyRows.slice(1) : weeklyRows;
    prevWeeks.forEach((r, idx) => {
      const prevRow = prevWeeks[idx + 1] || null;
      const bkPctColor = r.booking_pct >= 35 ? Theme.COLORS.success : r.booking_pct >= 28 ? Theme.COLORS.warning : Theme.COLORS.danger;
      const vipPctColor = r.vip_pct >= 45 ? Theme.COLORS.success : r.vip_pct >= 30 ? Theme.COLORS.warning : Theme.COLORS.textSecondary;
      html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">
        <td style="padding:10px 16px;color:${Theme.COLORS.textSecondary}">${r.week_start} to ${r.week_end}</td>
        <td style="padding:10px 16px;font-family:var(--font-mono);color:${Theme.COLORS.textMuted}">Week ${r.week_num}</td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);color:${Theme.COLORS.textPrimary}">${r.attendees}</td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);color:${Theme.COLORS.textPrimary}">${r.bookings}</td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);color:${bkPctColor}"><span style="display:inline-flex;align-items:center;gap:6px">${r.booking_pct.toFixed(1)}% ${_trendBox(r.booking_pct, prevRow ? prevRow.booking_pct : null)}</span></td>
        <td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);color:${vipPctColor}"><span style="display:inline-flex;align-items:center;gap:6px">${r.vip_pct.toFixed(1)}% ${_trendBox(r.vip_pct, prevRow ? prevRow.vip_pct : null)}</span></td>
      </tr>`;
    });

    html += '</tbody></table>';
    velTable.innerHTML = html;
  }

  // Load velocity data
  Promise.all([
    API.query('workshop', 'weeklyVelocity', { days: 90 }).catch(() => []),
    API.query('workshop', 'dailyVelocity', { days: 14 }).catch(() => [])
  ]).then(([weeklyRows, dailyRows]) => {
    let usingDummy = false;
    if (!weeklyRows || weeklyRows.length === 0) { weeklyRows = _dummyWeeklyVelocity(); usingDummy = true; }
    if (!dailyRows || dailyRows.length === 0) { dailyRows = _dummyDailyVelocity(); usingDummy = true; }
    if (usingDummy) {
      const warn = document.createElement('div');
      warn.style.cssText = 'padding:6px 12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:6px;color:#f59e0b;font-size:11px;margin-bottom:8px;text-align:center';
      warn.textContent = 'Workshop velocity data unavailable -- showing sample data';
      velocityCard.insertBefore(warn, velocityCard.firstChild);
    }
    _renderVelocityTable(weeklyRows, dailyRows);
  });

  // ---- Responsive ----
  const mq = window.matchMedia('(max-width: 768px)');
  function handleMobile(e) {
    chartsRow.style.gridTemplateColumns = e.matches ? '1fr' : '1fr 1fr';
  }
  handleMobile(mq);
  mq.addEventListener('change', handleMobile);
});

// ---- Helpers ----

function _card(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '16px 20px';
  if (title) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:13px;font-weight:700;font-family:Manrope,sans-serif;color:' + Theme.COLORS.textPrimary + ';text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px';
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}


function _detectSignals(cur, prev) {
  const wins = [];
  const leaks = [];
  const metrics = [
    { key: 'gross_revenue', label: 'Revenue', fmt: v => Theme.money(v), invert: false, threshold: 5 },
    { key: 'roas', label: 'ROAS', fmt: v => v.toFixed(2) + 'x', invert: false, threshold: 5 },
    { key: 'enrollments', label: 'Enrollments', fmt: v => Math.round(v), invert: false, threshold: 10 },
    { key: 'total_spend', label: 'Ad Spend', fmt: v => Theme.money(v), invert: true, threshold: 5 },
    { key: 'cpm', label: 'CPM', fmt: v => Theme.money(v), invert: true, threshold: 8 },
    { key: 'cpb', label: 'Cost per Booking', fmt: v => Theme.money(v), invert: true, threshold: 8 },
    { key: 'cost_per_enrollment', label: 'CPA', fmt: v => Theme.money(v), invert: true, threshold: 8 },
    { key: 'ticket_revenue', label: 'Ticket Revenue', fmt: v => Theme.money(v), invert: false, threshold: 10 },
  ];

  metrics.forEach(m => {
    const c = parseFloat(cur[m.key]) || 0;
    const p = parseFloat(prev[m.key]) || 0;
    if (!p || p === 0) return;
    const pctChange = ((c - p) / Math.abs(p)) * 100;
    const absChange = Math.abs(pctChange);
    if (absChange < m.threshold) return;

    const isPositive = m.invert ? pctChange < 0 : pctChange > 0;
    const direction = pctChange > 0 ? 'up' : 'down';
    const text = `${m.label} ${direction} ${absChange.toFixed(0)}% (${m.fmt(p)} -> ${m.fmt(c)})`;

    if (isPositive) {
      wins.push({ text, magnitude: absChange });
    } else {
      leaks.push({ text, magnitude: absChange });
    }
  });

  // Close rate + no-show rate
  const cr = cur.close_rate || 0, pCr = prev.close_rate || 0;
  if (pCr > 0) {
    const crPct = ((cr - pCr) / Math.abs(pCr)) * 100;
    if (Math.abs(crPct) >= 5) {
      const text = `Close rate ${crPct > 0 ? 'up' : 'down'} ${Math.abs(crPct).toFixed(0)}% (${Theme.pct(pCr)} -> ${Theme.pct(cr)})`;
      (crPct > 0 ? wins : leaks).push({ text, magnitude: Math.abs(crPct) });
    }
  }

  const ns = cur.total_calls ? cur.no_shows / cur.total_calls : 0;
  const pNs = prev.total_calls ? prev.no_shows / prev.total_calls : 0;
  if (pNs > 0) {
    const nsPct = ((ns - pNs) / Math.abs(pNs)) * 100;
    if (Math.abs(nsPct) >= 5) {
      const text = `No-show rate ${nsPct > 0 ? 'up' : 'down'} ${Math.abs(nsPct).toFixed(0)}% (${(pNs * 100).toFixed(1)}% -> ${(ns * 100).toFixed(1)}%)`;
      (nsPct < 0 ? wins : leaks).push({ text, magnitude: Math.abs(nsPct) }); // inverted
    }
  }

  wins.sort((a, b) => b.magnitude - a.magnitude);
  leaks.sort((a, b) => b.magnitude - a.magnitude);
  return { wins: wins.slice(0, 4), leaks: leaks.slice(0, 4) };
}

function _aggregateWeekly(dailyRows) {
  const weeks = {};
  dailyRows.forEach(row => {
    const rawDate = typeof row.date === 'object' && row.date !== null ? row.date.value : row.date;
    if (!rawDate) return;
    const d = new Date(rawDate);
    // ISO week: Monday-based
    const dayOfWeek = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    const weekKey = monday.toISOString().slice(0, 10);

    if (!weeks[weekKey]) weeks[weekKey] = { rows: [], weekStart: weekKey };
    weeks[weekKey].rows.push(row);
  });

  const sumKeys = ['traffic', 'all_tickets', 'vip', 'calls_booked', 'ad_spend', 'paid_tickets', 'ticket_revenue'];
  const ratioKeys = ['cost_per_booked_call', 'cost_per_ticket_purchase', 'cost_per_call_after_ticket_rev'];

  return Object.values(weeks)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .map(w => {
      const agg = { date: { value: w.weekStart } };
      // Sum absolute counts/amounts
      sumKeys.forEach(k => {
        agg[k] = w.rows.reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);
      });
      // Recompute percentages from sums (not mean-of-means)
      agg.vip_upgrade_pct = agg.all_tickets > 0 ? (agg.vip / agg.all_tickets) * 100 : 0;
      agg.booking_pct = agg.all_tickets > 0 ? (agg.calls_booked / agg.all_tickets) * 100 : 0;
      // Recompute ratios from sums
      agg.cost_per_booked_call = agg.calls_booked > 0 ? agg.ad_spend / agg.calls_booked : 0;
      agg.cost_per_ticket_purchase = agg.paid_tickets > 0 ? agg.ad_spend / agg.paid_tickets : 0;
      agg.cost_per_call_after_ticket_rev = agg.calls_booked > 0 ? (agg.ad_spend - agg.ticket_revenue) / agg.calls_booked : 0;
      return agg;
    });
}

function _renderDailyTable(rows) {
  const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const cols = [
    { key: 'date', label: 'Date', fmt: v => { if (!v) return ''; const d = typeof v === 'object' && v.value ? v.value : v; return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }); }},
    { key: '_dow', label: 'Day', fmt: v => v || '' },
    { key: 'traffic', label: 'Traffic', fmt: v => Theme.num(v || 0), higherBetter: true },
    { key: 'all_tickets', label: 'Tickets', fmt: v => Math.round(v || 0), higherBetter: true },
    { key: 'vip', label: 'VIP', fmt: v => Math.round(v || 0), higherBetter: true },
    { key: 'calls_booked', label: 'Calls Booked', fmt: v => Math.round(v || 0), higherBetter: true, hasTooltip: true },
    { key: 'vip_upgrade_pct', label: 'VIP %', fmt: v => (v || 0).toFixed(1) + '%', higherBetter: true, showTrend: true },
    { key: 'booking_pct', label: 'Booking %', fmt: v => (v || 0).toFixed(1) + '%', higherBetter: true, showTrend: true },
    { key: 'ad_spend', label: 'Ad Spend', fmt: v => Theme.money(v || 0), align: 'right', higherBetter: false },
    { key: 'cost_per_booked_call', label: 'Cost/Call', fmt: v => v ? Theme.money(v) : '--', align: 'right', higherBetter: false },
    { key: 'paid_tickets', label: 'Paid', fmt: v => Math.round(v || 0), higherBetter: true },
    { key: 'cost_per_ticket_purchase', label: 'Cost/Ticket', fmt: v => Theme.money(v || 0), align: 'right', higherBetter: false },
    { key: 'ticket_revenue', label: 'Ticket Rev', fmt: v => Theme.money(v || 0), align: 'right', higherBetter: true },
    { key: 'cost_per_call_after_ticket_rev', label: 'Net Cost/Call', fmt: v => v ? Theme.money(v) : '--', align: 'right', higherBetter: false },
  ];

  // Enrich rows with day-of-week
  rows.forEach(r => {
    const raw = typeof r.date === 'object' && r.date !== null ? r.date.value || r.date : r.date;
    if (raw) {
      const d = new Date(raw);
      r._dow = DOW_SHORT[d.getDay()];
      r._dowIdx = d.getDay();
      r._dateStr = raw.toString().slice(0, 10);
    }
  });

  // Compute mean + stddev per column for deviation-based coloring
  const stats = {};
  cols.forEach(c => {
    if (c.higherBetter !== undefined) {
      const vals = rows.map(r => parseFloat(r[c.key]) || 0).filter(v => v !== 0);
      if (vals.length > 0) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
        const stddev = Math.sqrt(variance) || 1;
        stats[c.key] = { mean, stddev };
      }
    }
  });

  // Trend box: 7 levels from strong-up to strong-down
  function _trendBox(value, key, higherBetter) {
    if (!stats[key] || !value) return '';
    const { mean, stddev } = stats[key];
    const z = (value - mean) / stddev;
    const effective = higherBetter ? z : -z;
    let bg, label;
    if (effective > 1.2)      { bg = '#16a34a'; label = ''; }
    else if (effective > 0.5) { bg = '#22c55e'; label = ''; }
    else if (effective > 0.15){ bg = '#4ade80'; label = ''; }
    else if (effective > -0.15){ bg = '#475569'; label = ''; }
    else if (effective > -0.5){ bg = '#f87171'; label = ''; }
    else if (effective > -1.2){ bg = '#ef4444'; label = ''; }
    else                      { bg = '#dc2626'; label = ''; }
    return `<span style="display:inline-block;width:28px;height:16px;border-radius:3px;background:${bg};margin-left:6px;vertical-align:middle;box-shadow:${Math.abs(effective) > 1 ? '0 0 6px ' + bg + '80' : 'none'}"></span>`;
  }

  // Color function: deviation from mean -> red/green with intensity
  function _deviationColor(value, key, higherBetter) {
    if (!stats[key] || !value) return '';
    const { mean, stddev } = stats[key];
    const zScore = (value - mean) / stddev;
    const clamped = Math.max(-2, Math.min(2, zScore));
    const intensity = Math.abs(clamped) / 2;
    const alpha = (0.08 + intensity * 0.25).toFixed(2);

    const isGood = higherBetter ? clamped > 0.3 : clamped < -0.3;
    const isBad = higherBetter ? clamped < -0.3 : clamped > 0.3;

    if (isGood) return `background:rgba(34,197,94,${alpha});color:#22c55e;`;
    if (isBad) return `background:rgba(239,68,68,${alpha});color:#ef4444;`;
    return '';
  }

  // ISO week number
  function _getWeek(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  // Separator styles
  const sepColors = { day: '#3b82f6', week: '#7c3aed' };

  const totalCols = cols.length;
  let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr>';
  cols.forEach(c => {
    html += `<th${c.align === 'right' ? ' class="num"' : ''} style="white-space:nowrap;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;font-weight:600;color:${Theme.COLORS.textMuted}">${c.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  let lastDate = null;
  let lastWeek = null;

  rows.forEach((row, idx) => {
    const dateStr = row._dateStr || '';
    const dowIdx = row._dowIdx || 0;
    const isWeekend = dowIdx === 0 || dowIdx === 6;
    const weekNum = dateStr ? _getWeek(dateStr) : null;

    // Week separator
    if (weekNum !== null && lastWeek !== null && weekNum !== lastWeek) {
      html += `<tr><td colspan="${totalCols}" style="padding:0;position:relative;height:24px;">
        <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:${sepColors.week}40"></div>
        <span style="position:absolute;top:50%;left:12px;transform:translateY(-50%);background:${sepColors.week};color:#fff;font-size:9px;font-weight:700;font-family:var(--font-mono);padding:2px 8px;border-radius:0 0 4px 4px;letter-spacing:0.06em;text-transform:uppercase">WEEK ${lastWeek}</span>
      </td></tr>`;
    }

    // Day separator (when date changes)
    if (dateStr && lastDate && dateStr !== lastDate) {
      const prevDow = new Date(lastDate).getDay();
      const dayName = DOW_NAMES[prevDow].toUpperCase();
      html += `<tr><td colspan="${totalCols}" style="padding:0;position:relative;height:20px;">
        <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:${sepColors.day}30"></div>
        <span style="position:absolute;top:50%;left:12px;transform:translateY(-50%);background:${sepColors.day};color:#fff;font-size:9px;font-weight:600;font-family:var(--font-mono);padding:1px 8px;border-radius:0 0 3px 3px;letter-spacing:0.04em">${dayName}</span>
      </td></tr>`;
    }

    lastDate = dateStr;
    lastWeek = weekNum;

    // Row tinting: weekend = purple
    let rowStyle = '';
    if (isWeekend) {
      rowStyle = 'background:rgba(139,92,246,0.04);';
    }

    html += `<tr style="${rowStyle}">`;
    cols.forEach(c => {
      const raw = c.key === '_dow' ? row._dow :
        (typeof row[c.key] === 'object' && row[c.key] !== null ? row[c.key].value || row[c.key] : row[c.key]);
      const numVal = parseFloat(raw) || 0;
      const val = c.fmt(raw);
      let style = c.align === 'right' ? 'text-align:right;' : '';

      // Deviation-based coloring
      if (c.higherBetter !== undefined && c.key !== 'date' && c.key !== '_dow') {
        style += _deviationColor(numVal, c.key, c.higherBetter);
      }

      // Day column styling
      if (c.key === '_dow') {
        const dowColor = isWeekend ? '#a78bfa' : Theme.COLORS.textMuted;
        style += `color:${dowColor};font-weight:500;`;
      }

      // Trend box for % columns
      let trend = '';
      if (c.showTrend && c.higherBetter !== undefined) {
        trend = _trendBox(numVal, c.key, c.higherBetter);
      }

      // Source tooltip for calls_booked
      let tooltip = '';
      if (c.hasTooltip && row.source_breakdown) {
        const parts = row.source_breakdown.split('|').map(p => {
          const [src, cnt] = p.split(':');
          return `${src}: ${cnt}`;
        }).join('&#10;');
        tooltip = ` title="${parts}" style="${style}font-family:var(--font-mono);font-size:12px;cursor:help;text-decoration:underline dotted"`;
      } else {
        tooltip = ` style="${style}font-family:var(--font-mono);font-size:12px"`;
      }

      html += `<td${tooltip}>${val}${trend}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

