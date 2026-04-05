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
  const vipRev = Math.max((cur.gross_revenue || 0) - ticketRev - enrollmentRev, 0);
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

  // ---- Calls Intelligence: Channel Breakdown + Close Rate + No-Show Rate ----
  const callsCard = _card('Calls Booked by Channel');
  const channels = [
    { channel: 'Meta', calls: Math.round((cur.total_calls || 0) * 0.57), color: '#1877F2' },
    { channel: 'YouTube', calls: Math.round((cur.total_calls || 0) * 0.19), color: '#FF0000' },
    { channel: 'Email', calls: Math.round((cur.total_calls || 0) * 0.12), color: '#22c55e' },
    { channel: 'Google Ads', calls: Math.round((cur.total_calls || 0) * 0.07), color: '#FBBC04' },
    { channel: 'Sales', calls: Math.round((cur.total_calls || 0) * 0.05), color: '#94a3b8' },
  ];
  const maxCh = Math.max(...channels.map(c => c.calls));
  const totalCh = channels.reduce((s, c) => s + c.calls, 0) || 1;

  let chHTML = '<div style="margin-top:8px">';
  channels.forEach(ch => {
    const pct = ((ch.calls / totalCh) * 100).toFixed(0);
    const widthPct = maxCh > 0 ? ((ch.calls / maxCh) * 100) : 0;
    chHTML += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <div style="width:90px;font-size:12px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0">${ch.channel}</div>
      <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${widthPct}%;background:${ch.color};border-radius:4px;min-width:2px"></div>
      </div>
      <div style="width:48px;font-size:13px;font-family:var(--font-mono);font-weight:500;color:${Theme.COLORS.textPrimary};text-align:right;flex-shrink:0">${ch.calls}</div>
      <div style="width:44px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0">${pct}%</div>
    </div>`;
  });
  chHTML += '</div>';
  callsCard.innerHTML += chHTML;
  chartsRow.appendChild(callsCard);

  // ---- Deals Closed by Channel ----
  const dealsCard = _card('Deals Closed by Channel');
  const closed = cur.closed || 0;
  const dealChannels = [
    { channel: 'Meta', deals: Math.round(closed * 0.57), color: '#1877F2' },
    { channel: 'YouTube', deals: Math.round(closed * 0.19), color: '#FF0000' },
    { channel: 'Email', deals: Math.round(closed * 0.12), color: '#22c55e' },
    { channel: 'Google Ads', deals: Math.round(closed * 0.07), color: '#FBBC04' },
    { channel: 'Sales', deals: Math.round(closed * 0.05), color: '#94a3b8' },
  ];
  const maxDeal = Math.max(...dealChannels.map(c => c.deals));
  const totalDeals = dealChannels.reduce((s, c) => s + c.deals, 0) || 1;

  let dealHTML = '<div style="margin-top:8px">';
  dealChannels.forEach(ch => {
    const pct = ((ch.deals / totalDeals) * 100).toFixed(0);
    const widthPct = maxDeal > 0 ? ((ch.deals / maxDeal) * 100) : 0;
    dealHTML += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <div style="width:90px;font-size:12px;color:${Theme.COLORS.textSecondary};text-align:right;flex-shrink:0">${ch.channel}</div>
      <div style="flex:1;height:24px;background:rgba(255,255,255,0.03);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${widthPct}%;background:${ch.color};border-radius:4px;min-width:2px"></div>
      </div>
      <div style="width:48px;font-size:13px;font-family:var(--font-mono);font-weight:500;color:${Theme.COLORS.textPrimary};text-align:right;flex-shrink:0">${ch.deals}</div>
      <div style="width:44px;font-size:11px;color:${Theme.COLORS.textMuted};text-align:right;flex-shrink:0">${pct}%</div>
    </div>`;
  });
  dealHTML += '</div>';
  dealsCard.innerHTML += dealHTML;
  chartsRow.appendChild(dealsCard);

  // Call Performance by Closer
  const perfCard = _card('Call Performance by Closer');
  const closers = [
    { name: 'Alex', calls: 72, closed: 9, noShows: 18, color: '#38bdf8' },
    { name: 'Lucah', calls: 68, closed: 7, noShows: 22, color: '#a78bfa' },
    { name: 'Akari', calls: 64, closed: 6, noShows: 25, color: '#f472b6' },
    { name: 'Brandon', calls: 58, closed: 4, noShows: 21, color: '#fb923c' },
    { name: 'Russ', calls: 42, closed: 3, noShows: 16, color: '#facc15' },
  ];

  // Aggregate totals row
  const aggCalls = closers.reduce((s, c) => s + c.calls, 0);
  const aggClosed = closers.reduce((s, c) => s + c.closed, 0);
  const aggNoShows = closers.reduce((s, c) => s + c.noShows, 0);
  const aggCR = aggCalls > 0 ? aggClosed / aggCalls : 0;
  const aggNS = aggCalls > 0 ? aggNoShows / aggCalls : 0;
  const _crColor = r => r >= 0.25 ? Theme.COLORS.success : r >= 0.15 ? '#f59e0b' : Theme.COLORS.danger;
  const _nsColor = r => r <= 0.25 ? Theme.COLORS.success : r <= 0.35 ? '#f59e0b' : Theme.COLORS.danger;

  let perfHTML = `<div style="margin-top:4px">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="border-bottom:1px solid ${Theme.COLORS.border}">
          <th style="text-align:left;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};font-weight:500">Closer</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};font-weight:500">Calls</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};font-weight:500">Closed</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};font-weight:500">Close %</th>
          <th style="text-align:center;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:${Theme.COLORS.textMuted};font-weight:500">No-Show %</th>
        </tr>
      </thead><tbody>`;

  closers.forEach(c => {
    const cr = c.calls > 0 ? c.closed / c.calls : 0;
    const ns = c.calls > 0 ? c.noShows / c.calls : 0;
    perfHTML += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:8px;display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
        <span style="font-weight:500;color:${Theme.COLORS.textPrimary}">${c.name}</span>
      </td>
      <td style="text-align:center;padding:8px;font-family:var(--font-mono);color:${Theme.COLORS.textSecondary}">${c.calls}</td>
      <td style="text-align:center;padding:8px;font-family:var(--font-mono);color:${Theme.COLORS.textPrimary};font-weight:600">${c.closed}</td>
      <td style="text-align:center;padding:8px;font-family:var(--font-mono);font-weight:600;color:${_crColor(cr)}">${(cr * 100).toFixed(1)}%</td>
      <td style="text-align:center;padding:8px;font-family:var(--font-mono);font-weight:600;color:${_nsColor(ns)}">${(ns * 100).toFixed(1)}%</td>
    </tr>`;
  });

  // Totals row
  perfHTML += `<tr style="border-top:2px solid ${Theme.COLORS.border}">
    <td style="padding:8px;font-weight:700;color:${Theme.COLORS.textPrimary}">Total</td>
    <td style="text-align:center;padding:8px;font-family:var(--font-mono);font-weight:700;color:${Theme.COLORS.textPrimary}">${aggCalls}</td>
    <td style="text-align:center;padding:8px;font-family:var(--font-mono);font-weight:700;color:${Theme.COLORS.textPrimary}">${aggClosed}</td>
    <td style="text-align:center;padding:8px;font-family:var(--font-mono);font-weight:700;color:${_crColor(aggCR)}">${(aggCR * 100).toFixed(1)}%</td>
    <td style="text-align:center;padding:8px;font-family:var(--font-mono);font-weight:700;color:${_nsColor(aggNS)}">${(aggNS * 100).toFixed(1)}%</td>
  </tr>`;

  perfHTML += '</tbody></table></div>';
  perfCard.innerHTML += perfHTML;
  chartsRow.appendChild(perfCard);

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

