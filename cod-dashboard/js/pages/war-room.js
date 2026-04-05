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

  // Revenue Waterfall
  const waterfallCard = _card('Revenue Waterfall');
  const waterfallDiv = document.createElement('div');
  waterfallDiv.id = 'war-room-waterfall';
  waterfallDiv.style.height = '320px';
  waterfallCard.appendChild(waterfallDiv);
  chartsRow.appendChild(waterfallCard);

  // Funnel Health Gauge
  const funnelHealth = _computeFunnelHealth(cur);
  const gaugeCard = _card('Funnel Health');
  const gaugeDiv = document.createElement('div');
  gaugeDiv.id = 'war-room-gauge';
  gaugeDiv.style.height = '320px';
  gaugeCard.appendChild(gaugeDiv);
  chartsRow.appendChild(gaugeCard);

  // Close Rate + Calls summary
  const callsCard = _card('Calls Summary');
  const closeRate = cur.close_rate != null ? cur.close_rate : 0;
  const prevCloseRate = prev.close_rate != null ? prev.close_rate : 0;
  const crDelta = _delta(closeRate, prevCloseRate);
  const crClass = Theme.deltaClass(crDelta);
  const crArrow = crDelta > 0 ? '&#9650;' : crDelta < 0 ? '&#9660;' : '';
  const crDeltaStr = crDelta != null ? (crDelta >= 0 ? '+' : '') + crDelta.toFixed(1) + '%' : '';

  callsCard.innerHTML += `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:8px">
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">Total Calls</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.num(cur.total_calls || 0)}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">Close Rate</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.pct(closeRate)}</div>
        ${crDeltaStr ? `<span class="kpi-delta ${crClass}" style="font-size:12px">${crArrow} ${crDeltaStr}</span>` : ''}
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">No-Shows</div>
        <div style="font-size:28px;font-weight:700;color:${(cur.no_shows || 0) > 10 ? Theme.COLORS.danger : Theme.COLORS.textPrimary}">${cur.no_shows || 0}</div>
      </div>
    </div>
  `;
  chartsRow.appendChild(callsCard);

  // Render Plotly charts after DOM insert
  requestAnimationFrame(() => {
    _renderWaterfall(waterfallDiv, cur);
    _renderGauge(gaugeDiv, funnelHealth);
  });

  // ---- Biggest Lever Callout ----
  const leverText = _computeBiggestLever(cur);
  const leverCard = document.createElement('div');
  leverCard.className = 'card';
  leverCard.style.cssText = 'margin-top:16px;padding:20px 24px;border:2px solid transparent;border-image:linear-gradient(135deg, ' + Theme.COLORS.accent + ', ' + Theme.COLORS.accentLight + ') 1;position:relative;overflow:hidden';
  leverCard.innerHTML = `
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${Theme.COLORS.accentLight};margin-bottom:8px;font-weight:600">Biggest Lever</div>
    <div style="font-size:15px;line-height:1.5;color:${Theme.COLORS.textPrimary}">${leverText}</div>
  `;
  container.appendChild(leverCard);

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

function _computeFunnelHealth(d) {
  const roasComponent = Math.min(((d.roas || 0) / 5) * 25, 25);
  const closeRate = d.close_rate || 0;
  const closeComponent = Math.min((closeRate / 25) * 25, 25);
  const baseline = 50;
  const total = Math.min(Math.round(roasComponent + closeComponent + baseline), 100);
  return total;
}

function _computeBiggestLever(d) {
  const noShows = d.no_shows || 0;
  const noShowCost = noShows * 877;

  if (noShows > 20) {
    const savings = Math.round(noShowCost * 0.1);
    return `Fix no-show rate: ${noShows} no-shows cost ${Theme.money(noShowCost)}. A 10% improvement saves ${Theme.money(savings)}/period.`;
  }

  if ((d.roas || 0) < 3) {
    const roasVal = (d.roas || 0).toFixed(1);
    return `ROAS at ${roasVal}x (target: 3x). Focus on cutting worst-performing ad sets.`;
  }

  const closeRate = d.close_rate != null ? Theme.pct(d.close_rate) : 'N/A';
  return `Close rate at ${closeRate} -- equalizing closers could add significant revenue.`;
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

function _renderWaterfall(el, d) {
  if (typeof Plotly === 'undefined') return;

  const ticketRev = d.ticket_revenue || 0;
  const enrollmentRev = d.enrollment_revenue || 0;
  const vipRev = (d.gross_revenue || 0) - ticketRev - enrollmentRev;
  const adSpend = d.total_spend || 0;
  const refunds = d.refunds || 0;
  const netRev = (d.gross_revenue || 0) - refunds - adSpend;

  const trace = {
    type: 'waterfall',
    orientation: 'v',
    x: ['Tickets', 'VIP', 'Enrollments', 'Ad Spend', 'Refunds', 'Net Profit'],
    y: [ticketRev, vipRev > 0 ? vipRev : 0, enrollmentRev, -adSpend, -refunds, netRev],
    measure: ['relative', 'relative', 'relative', 'relative', 'relative', 'total'],
    connector: { line: { color: Theme.COLORS.border, width: 1 } },
    increasing: { marker: { color: Theme.FUNNEL.green } },
    decreasing: { marker: { color: Theme.FUNNEL.red } },
    totals: { marker: { color: netRev >= 0 ? Theme.FUNNEL.blue : Theme.FUNNEL.red } },
    textposition: 'outside',
    text: [
      Theme.money(ticketRev),
      Theme.money(vipRev > 0 ? vipRev : 0),
      Theme.money(enrollmentRev),
      '-' + Theme.money(adSpend),
      refunds ? '-' + Theme.money(refunds) : '$0',
      Theme.money(netRev),
    ],
    textfont: { color: Theme.COLORS.textSecondary, size: 11 },
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 20, r: 20, b: 40, l: 60 },
    showlegend: false,
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      tickformat: '$,.0f',
    },
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderGauge(el, score) {
  if (typeof Plotly === 'undefined') return;

  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Warning' : 'Critical';
  const color = score >= 70 ? Theme.FUNNEL.green : score >= 40 ? Theme.FUNNEL.yellow : Theme.FUNNEL.red;

  const trace = {
    type: 'indicator',
    mode: 'gauge+number',
    value: score,
    title: { text: label, font: { size: 14, color: color } },
    number: {
      font: { size: 48, color: Theme.COLORS.textPrimary },
      suffix: '/100',
      valueformat: '.0f',
    },
    gauge: {
      axis: {
        range: [0, 100],
        tickwidth: 1,
        tickcolor: Theme.COLORS.textMuted,
        dtick: 20,
        tickfont: { color: Theme.COLORS.textMuted, size: 10 },
      },
      bar: { color: color, thickness: 0.3 },
      bgcolor: 'transparent',
      borderwidth: 0,
      steps: [
        { range: [0, 40], color: 'rgba(239,68,68,0.15)' },
        { range: [40, 70], color: 'rgba(234,179,8,0.15)' },
        { range: [70, 100], color: 'rgba(34,197,94,0.15)' },
      ],
    },
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 30, r: 30, b: 10, l: 30 },
    showlegend: false,
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}
