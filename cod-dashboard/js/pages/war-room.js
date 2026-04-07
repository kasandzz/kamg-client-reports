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
    },
    {
      label: 'ROAS',
      value: cur.roas || 0,
      prevValue: prev.roas || 0,
      format: 'num',
      delta: _delta(cur.roas, prev.roas),
    },
    {
      label: 'Enrollments',
      value: cur.enrollments || 0,
      prevValue: prev.enrollments || 0,
      format: 'num',
      delta: _delta(cur.enrollments, prev.enrollments),
    },
    {
      label: 'CPB',
      value: cur.cpb || 0,
      prevValue: prev.cpb || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cpb, prev.cpb),
    },
    {
      label: 'CPA',
      value: cur.cost_per_enrollment || 0,
      prevValue: prev.cost_per_enrollment || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cost_per_enrollment, prev.cost_per_enrollment),
    },
    {
      label: 'CPM',
      value: cur.cpm || 0,
      prevValue: prev.cpm || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cpm, prev.cpm),
    },
  ]);

  // ---- Charts Row ----
  const chartsRow = document.createElement('div');
  chartsRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(chartsRow);

  // Revenue Breakdown (horizontal stacked bar)
  const revenueCard = _card('Revenue Breakdown');
  const ticketRev = cur.ticket_revenue || 0;
  const enrollmentRev = cur.enrollment_revenue || 0;
  const vipRev = cur.vip_revenue || 0;
  const adSpend = cur.total_spend || 0;
  const refunds = cur.refunds || 0;
  const netRev = (cur.gross_revenue || 0) - refunds - adSpend;

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
    <div><div style="font-size:11px;color:${Theme.COLORS.textMuted}">Net Profit</div><div style="font-size:16px;font-weight:700;color:${netRev >= 0 ? Theme.COLORS.success : Theme.COLORS.danger}">${Theme.money(netRev)}</div></div>
  </div>`;
  barHTML += '</div>';

  revenueCard.innerHTML += barHTML;
  chartsRow.appendChild(revenueCard);

  // ---- Sales by Source (from Hyros -- uses existing deployed 'hyros/sources' query) ----
  const dealsCard = _card('Sales by Source (Hyros)');
  dealsCard.innerHTML += `<div id="wr-sales-channel" style="margin-top:8px"><div class="page-placeholder"><div class="spinner"></div></div></div>`;

  API.query('hyros', 'sources', { days }).then(rows => {
    const el = dealsCard.querySelector('#wr-sales-channel');
    if (!rows || rows.length === 0) {
      el.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">No Hyros sales data for this period</p>`;
      return;
    }
    // Normalize source names into channels
    const channelMap = {};
    rows.forEach(r => {
      const src = (r.source || 'Unknown').toLowerCase();
      let channel;
      if (src.includes('fb') || src.includes('facebook') || src.includes('meta')) channel = 'Meta';
      else if (src.includes('youtube') || src.includes('yt')) channel = 'YouTube';
      else if (src.includes('google')) channel = 'Google';
      else if (src.includes('email') || src.includes('sendgrid')) channel = 'Email';
      else if (src.includes('tiktok')) channel = 'TikTok';
      else if (src.includes('direct')) channel = 'Direct';
      else if (src === 'unknown') channel = 'Unattributed';
      else channel = r.source; // keep original source name for granular view
      if (!channelMap[channel]) channelMap[channel] = { sales: 0, revenue: 0 };
      channelMap[channel].sales += (r.sales || 0);
      channelMap[channel].revenue += (r.revenue || 0);
    });
    const channels = Object.entries(channelMap)
      .map(([ch, d]) => ({ channel: ch, ...d }))
      .sort((a, b) => b.revenue - a.revenue);

    const channelColors = { Meta: '#1877F2', YouTube: '#FF0000', Email: '#22c55e', Google: '#FBBC04', TikTok: '#000000', Direct: '#94a3b8', Unattributed: '#475569' };
    const maxDeal = Math.max(...channels.map(r => r.sales || 0));
    const totalDeals = channels.reduce((s, r) => s + r.sales, 0) || 1;
    const totalRev = channels.reduce((s, r) => s + r.revenue, 0);
    let html = '';
    channels.forEach(r => {
      const pct = ((r.sales / totalDeals) * 100).toFixed(0);
      const widthPct = maxDeal > 0 ? ((r.sales / maxDeal) * 100) : 0;
      const color = channelColors[r.channel] || '#6366f1';
      html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:120px;font-size:12px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.channel}">${r.channel}</div>
        <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${widthPct}%;background:${color};border-radius:4px;min-width:2px"></div>
        </div>
        <div style="width:36px;font-size:13px;font-family:var(--font-mono);font-weight:500;color:${Theme.COLORS.textPrimary};text-align:right;flex-shrink:0">${r.sales}</div>
        <div style="width:36px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0">${pct}%</div>
        <div style="width:64px;font-size:11px;color:${Theme.COLORS.success};text-align:right;flex-shrink:0;font-family:var(--font-mono)">${Theme.money(r.revenue)}</div>
      </div>`;
    });
    html += `<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">
      <span style="font-size:12px;color:${Theme.COLORS.textMuted}">Total: ${totalDeals} sales</span>
      <span style="font-size:12px;color:${Theme.COLORS.success};font-weight:600;font-family:var(--font-mono)">${Theme.money(totalRev)}</span>
    </div>`;
    html += `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px;font-style:italic">Source: Hyros first-click attribution</div>`;
    el.innerHTML = html;
  }).catch(err => {
    dealsCard.querySelector('#wr-sales-channel').innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">Failed to load: ${err.message}</p>`;
  });

  // ---- Calls by Source (from Hyros -- uses existing 'hyros/lastSources' as proxy) ----
  const callsCard = _card('Leads by Source (Hyros)');
  callsCard.innerHTML += `<div id="wr-calls-channel" style="margin-top:8px"><div class="page-placeholder"><div class="spinner"></div></div></div>`;

  API.query('hyros', 'lastSources', { days }).then(rows => {
    const el = callsCard.querySelector('#wr-calls-channel');
    if (!rows || rows.length === 0) {
      el.innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">No Hyros lead data for this period</p>`;
      return;
    }
    // Normalize into channels
    const channelMap = {};
    rows.forEach(r => {
      const src = (r.last_source || 'Unknown').toLowerCase();
      let channel;
      if (src.includes('fb') || src.includes('facebook') || src.includes('meta')) channel = 'Meta';
      else if (src.includes('youtube') || src.includes('yt')) channel = 'YouTube';
      else if (src.includes('google')) channel = 'Google';
      else if (src.includes('email') || src.includes('sendgrid')) channel = 'Email';
      else if (src.includes('tiktok')) channel = 'TikTok';
      else if (src.includes('direct')) channel = 'Direct';
      else if (src === 'unknown') channel = 'Unattributed';
      else channel = r.last_source;
      if (!channelMap[channel]) channelMap[channel] = { leads: 0 };
      channelMap[channel].leads += (r.leads || 0);
    });
    const channels = Object.entries(channelMap)
      .map(([ch, d]) => ({ channel: ch, ...d }))
      .sort((a, b) => b.leads - a.leads);

    const channelColors = { Meta: '#1877F2', YouTube: '#FF0000', Email: '#22c55e', Google: '#FBBC04', TikTok: '#000000', Direct: '#94a3b8', Unattributed: '#475569' };
    const maxCh = Math.max(...channels.map(r => r.leads || 0));
    const totalCh = channels.reduce((s, r) => s + r.leads, 0) || 1;
    let html = '';
    channels.forEach(r => {
      const pct = ((r.leads / totalCh) * 100).toFixed(0);
      const widthPct = maxCh > 0 ? ((r.leads / maxCh) * 100) : 0;
      const color = channelColors[r.channel] || '#6366f1';
      html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:120px;font-size:12px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.channel}">${r.channel}</div>
        <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${widthPct}%;background:${color};border-radius:4px;min-width:2px"></div>
        </div>
        <div style="width:48px;font-size:13px;font-family:var(--font-mono);font-weight:500;color:${Theme.COLORS.textPrimary};text-align:right;flex-shrink:0">${r.leads}</div>
        <div style="width:44px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0">${pct}%</div>
      </div>`;
    });
    html += `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px;font-style:italic">Source: Hyros last-click attribution</div>`;
    el.innerHTML = html;
  }).catch(err => {
    callsCard.querySelector('#wr-calls-channel').innerHTML = `<p style="font-size:12px;color:${Theme.COLORS.textMuted}">Failed to load: ${err.message}</p>`;
  });

  // DPL (Dollars Per Lead) & Cost Per Ticket
  const dplCptCard = _card('');
  const totalSpend = cur.total_spend || 0;
  const grossRev = cur.gross_revenue || 0;
  const totalCalls = cur.total_calls || 0;
  const ticketRev2 = cur.ticket_revenue || 0;
  const totalTickets = ticketRev2 > 0 ? Math.round(ticketRev2 / 27) : 0;
  const curDPL = totalCalls > 0 ? grossRev / totalCalls : 0;
  const curCPT = totalTickets > 0 ? totalSpend / totalTickets : 0;

  const prevSpend = prev.total_spend || 0;
  const prevRev = prev.gross_revenue || 0;
  const prevCalls = prev.total_calls || 0;
  const prevTicketRev = prev.ticket_revenue || 0;
  const prevTickets = prevTicketRev > 0 ? Math.round(prevTicketRev / 27) : 0;
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
  chartsRow.appendChild(callsCard);
  chartsRow.appendChild(dealsCard);

  // ---- Biggest Wins / Biggest Leaks ----
  const signals = _detectSignals(cur, prev);
  const winsLeaksRow = document.createElement('div');
  winsLeaksRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';

  const winsCard = document.createElement('div');
  winsCard.className = 'card';
  winsCard.style.cssText = 'padding:16px 20px;border-left:3px solid ' + Theme.COLORS.success + ';position:relative;overflow:hidden';
  let winsHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.success};margin-bottom:12px">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${Theme.COLORS.success}" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    <span>Biggest Wins</span>
  </div>`;
  if (signals.wins.length === 0) {
    winsHTML += `<div style="font-size:13px;color:${Theme.COLORS.textMuted}">No significant wins detected</div>`;
  } else {
    winsHTML += '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px">';
    signals.wins.forEach(w => {
      winsHTML += `<li style="font-size:13px;color:${Theme.COLORS.textPrimary};padding-left:16px;position:relative;line-height:1.5"><span style="position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:${Theme.COLORS.success}"></span>${w.text}</li>`;
    });
    winsHTML += '</ul>';
  }
  winsCard.innerHTML = winsHTML;

  const leaksCard = document.createElement('div');
  leaksCard.className = 'card';
  leaksCard.style.cssText = 'padding:16px 20px;border-left:3px solid ' + Theme.COLORS.danger + ';position:relative;overflow:hidden';
  let leaksHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.danger};margin-bottom:12px">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${Theme.COLORS.danger}" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
    <span>Biggest Leaks</span>
  </div>`;
  if (signals.leaks.length === 0) {
    leaksHTML += `<div style="font-size:13px;color:${Theme.COLORS.textMuted}">No significant leaks detected</div>`;
  } else {
    leaksHTML += '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px">';
    signals.leaks.forEach(l => {
      leaksHTML += `<li style="font-size:13px;color:${Theme.COLORS.textPrimary};padding-left:16px;position:relative;line-height:1.5"><span style="position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:${Theme.COLORS.danger}"></span>${l.text}</li>`;
    });
    leaksHTML += '</ul>';
  }
  leaksCard.innerHTML = leaksHTML;

  winsLeaksRow.appendChild(winsCard);
  winsLeaksRow.appendChild(leaksCard);
  container.appendChild(winsLeaksRow);

  // ---- Daily/Weekly Metrics Table ----
  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  tableCard.style.cssText = 'padding:16px 20px;margin-top:16px;overflow-x:auto';

  const tableHeader = document.createElement('div');
  tableHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';

  const tableTitle = document.createElement('div');
  tableTitle.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary;
  tableTitle.textContent = 'Daily Metrics';

  const toggleWrap = document.createElement('div');
  toggleWrap.style.cssText = 'display:flex;gap:2px;background:rgba(255,255,255,0.04);border-radius:6px;padding:2px';
  const btnDaily = document.createElement('button');
  btnDaily.textContent = 'Daily';
  btnDaily.className = 'filter-btn active';
  btnDaily.style.cssText = 'padding:4px 12px;font-size:11px';
  const btnWeekly = document.createElement('button');
  btnWeekly.textContent = 'Weekly';
  btnWeekly.className = 'filter-btn';
  btnWeekly.style.cssText = 'padding:4px 12px;font-size:11px';
  toggleWrap.appendChild(btnDaily);
  toggleWrap.appendChild(btnWeekly);

  tableHeader.appendChild(tableTitle);
  tableHeader.appendChild(toggleWrap);
  tableCard.appendChild(tableHeader);

  const tableContent = document.createElement('div');
  tableContent.id = 'war-room-daily-table';
  tableContent.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';
  tableCard.appendChild(tableContent);
  container.appendChild(tableCard);

  // Store raw daily rows for toggling
  let _dailyRows = null;

  API.query('war-room', 'dailyTable', { days }).then(rows => {
    _dailyRows = rows;
    if (!rows || rows.length === 0) {
      tableContent.innerHTML = '<p class="text-muted" style="padding:16px">No daily data available</p>';
      return;
    }
    tableContent.innerHTML = _renderDailyTable(rows);
  }).catch(() => {
    tableContent.innerHTML = '<p class="text-muted" style="padding:16px">Failed to load daily data</p>';
  });

  btnDaily.addEventListener('click', () => {
    btnDaily.classList.add('active');
    btnWeekly.classList.remove('active');
    tableTitle.textContent = 'Daily Metrics';
    if (_dailyRows && _dailyRows.length > 0) {
      tableContent.innerHTML = _renderDailyTable(_dailyRows);
    }
  });

  btnWeekly.addEventListener('click', () => {
    btnWeekly.classList.add('active');
    btnDaily.classList.remove('active');
    tableTitle.textContent = 'Weekly Averages';
    if (_dailyRows && _dailyRows.length > 0) {
      tableContent.innerHTML = _renderDailyTable(_aggregateWeekly(_dailyRows));
    }
  });

  // ---- Responsive ----
  const mq = window.matchMedia('(max-width: 768px)');
  function handleMobile(e) {
    chartsRow.style.gridTemplateColumns = e.matches ? '1fr' : '1fr 1fr';
    winsLeaksRow.style.gridTemplateColumns = e.matches ? '1fr' : '1fr 1fr';
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
    h.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';margin-bottom:12px';
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

  const numKeys = ['traffic', 'all_tickets', 'vip', 'calls_booked', 'vip_upgrade_pct', 'booking_pct', 'ad_spend', 'cost_per_booked_call', 'paid_tickets', 'cost_per_ticket_purchase', 'ticket_revenue', 'cost_per_call_after_ticket_rev'];

  return Object.values(weeks)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .map(w => {
      const avg = { date: { value: w.weekStart } };
      numKeys.forEach(k => {
        const vals = w.rows.map(r => parseFloat(r[k]) || 0).filter(v => v !== 0);
        avg[k] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      });
      return avg;
    });
}

function _renderDailyTable(rows) {
  const cols = [
    { key: 'date', label: 'Date', fmt: v => { if (!v) return ''; const d = typeof v === 'object' && v.value ? v.value : v; return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }); }},
    { key: 'traffic', label: 'Traffic', fmt: v => Theme.num(v || 0), higherBetter: true },
    { key: 'all_tickets', label: 'Tickets', fmt: v => Math.round(v || 0), higherBetter: true },
    { key: 'vip', label: 'VIP', fmt: v => Math.round(v || 0), higherBetter: true },
    { key: 'calls_booked', label: 'Calls Booked', fmt: v => Math.round(v || 0), higherBetter: true, hasTooltip: true },
    { key: 'vip_upgrade_pct', label: 'VIP %', fmt: v => (v || 0).toFixed(1) + '%', higherBetter: true },
    { key: 'booking_pct', label: 'Booking %', fmt: v => (v || 0).toFixed(1) + '%', higherBetter: true },
    { key: 'ad_spend', label: 'Ad Spend', fmt: v => Theme.money(v || 0), align: 'right', higherBetter: false },
    { key: 'cost_per_booked_call', label: 'Cost/Call', fmt: v => v ? Theme.money(v) : '--', align: 'right', higherBetter: false },
    { key: 'paid_tickets', label: 'Paid', fmt: v => Math.round(v || 0), higherBetter: true },
    { key: 'cost_per_ticket_purchase', label: 'Cost/Ticket', fmt: v => Theme.money(v || 0), align: 'right', higherBetter: false },
    { key: 'ticket_revenue', label: 'Ticket Rev', fmt: v => Theme.money(v || 0), align: 'right', higherBetter: true },
    { key: 'cost_per_call_after_ticket_rev', label: 'Net Cost/Call', fmt: v => v ? Theme.money(v) : '--', align: 'right', higherBetter: false },
  ];

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

  let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr>';
  cols.forEach(c => {
    html += `<th${c.align === 'right' ? ' class="num"' : ''} style="white-space:nowrap">${c.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  rows.forEach(row => {
    html += '<tr>';
    cols.forEach(c => {
      const raw = typeof row[c.key] === 'object' && row[c.key] !== null ? row[c.key].value || row[c.key] : row[c.key];
      const numVal = parseFloat(raw) || 0;
      const val = c.fmt(raw);
      let style = c.align === 'right' ? 'text-align:right;' : '';

      // Deviation-based coloring
      if (c.higherBetter !== undefined && c.key !== 'date') {
        style += _deviationColor(numVal, c.key, c.higherBetter);
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

      html += `<td${tooltip}>${val}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

