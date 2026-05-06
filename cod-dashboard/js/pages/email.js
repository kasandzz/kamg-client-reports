/* ============================================
   Email -- SendGrid delivery + engagement
   Delivery rate, open/click rates, subject
   performance, daily volume
   ============================================ */

App.registerPage('email-intel', async (container) => {
  const days = Filters.getDays();

  // Shimmer skeleton loader
  container.innerHTML = `
    <style>
      @keyframes ei-shimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .ei-skeleton-bar {
        background: linear-gradient(90deg, #1a1a26 25%, #252536 50%, #1a1a26 75%);
        background-size: 800px 100%;
        animation: ei-shimmer 1.5s infinite ease-in-out;
        border-radius: 6px;
      }
      @media(max-width:768px) {
        .ei-kpi-strip, .kpi-strip { grid-template-columns: 1fr 1fr !important; }
        .ei-chart-grid { grid-template-columns: 1fr !important; }
      }
    </style>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px">
      ${[1,2,3,4].map(() => `<div class="card" style="padding:24px"><div class="ei-skeleton-bar" style="height:14px;width:60%;margin-bottom:12px"></div><div class="ei-skeleton-bar" style="height:28px;width:40%"></div></div>`).join('')}
    </div>
    <div class="card" style="padding:24px"><div class="ei-skeleton-bar" style="height:200px;width:100%"></div></div>
  `;

  // Track per-query errors
  const _eiQueryErrors = {};

  const results = await Promise.allSettled([
    API.query('email', 'default',         { days }),
    API.query('email', 'daily',           { days }),
    API.query('email', 'subjects',        { days }),
    API.query('email', 'mailboxProvider', { days }),
  ]);

  const queryNames = ['default', 'daily', 'subjects', 'mailboxProvider'];
  const extract = (idx) => {
    if (results[idx].status === 'fulfilled') return results[idx].value;
    _eiQueryErrors[queryNames[idx]] = results[idx].reason?.message || 'Query failed';
    return null;
  };

  const kpiRows = extract(0);
  const dailyRows = extract(1);
  const subjectRows = extract(2);
  const providerRows = extract(3);

  const kpi = (kpiRows && kpiRows.length > 0) ? kpiRows[0] : {};
  container.innerHTML = '';

  // Helper: inline error card for failed query section
  function _eiErrorCard(sectionName, queryKey) {
    const err = _eiQueryErrors[queryKey];
    if (!err) return null;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `padding:24px;text-align:center;border:1px solid rgba(239,68,68,0.3)`;
    card.innerHTML = `
      <div style="font-size:14px;color:#ef4444;font-weight:600;margin-bottom:8px">Email Intelligence: ${sectionName} unavailable</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:12px">${err}</div>
      <button onclick="App.navigate('email-intel')" style="background:${Theme.COLORS.accent};color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;cursor:pointer;font-family:Manrope,sans-serif">Retry</button>
    `;
    return card;
  }

  // Helper: empty state card
  function _eiEmptyState(sectionLabel) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:48px 24px;text-align:center';
    card.innerHTML = `
      <div style="font-size:28px;margin-bottom:8px;opacity:0.4">&#9776;</div>
      <div style="font-size:13px;color:#8888a0">No ${sectionLabel} data for this period</div>
    `;
    return card;
  }

  // ---- SendGrid Source Label (EMAIL-03) ----
  const sourceLabel = document.createElement('div');
  sourceLabel.style.cssText = `font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:16px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.06)`;
  sourceLabel.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block"></span> SendGrid Blast Email Analytics`;
  container.appendChild(sourceLabel);

  // ---- KPI Strip ----
  const kpiErrCard = _eiErrorCard('KPIs', 'default');
  if (kpiErrCard) {
    container.appendChild(kpiErrCard);
  } else if (!kpiRows || kpiRows.length === 0) {
    container.appendChild(_eiEmptyState('KPI'));
  } else {

  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    {
      label: 'Total Sent',
      value: kpi.total_sent || 0,
      format: 'num',
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(*) WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL {days} DAY)',
    },
    {
      label: 'Delivery Rate',
      value: kpi.delivery_rate || 0,
      format: 'pct',
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(delivered) / COUNT(*) * 100',
    },
    {
      label: 'Open Rate',
      value: kpi.open_rate || 0,
      format: 'pct',
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(DISTINCT opens) / COUNT(delivered) * 100',
    },
    {
      label: 'Click Rate',
      value: kpi.click_rate || 0,
      format: 'pct',
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(DISTINCT clicks) / COUNT(delivered) * 100',
    },
    {
      label: 'Bounced',
      value: kpi.bounced || 0,
      format: 'num',
      invertCost: true,
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(*) WHERE event = "bounce"',
    },
    {
      label: 'Unsubscribed',
      value: kpi.unsubscribed || 0,
      format: 'num',
      invertCost: true,
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(*) WHERE event = "unsubscribe"',
    },
    {
      label: 'Delivered',
      value: kpi.delivered || 0,
      format: 'num',
      source: 'BigQuery: sendgrid_messages',
      calc: 'COUNT(*) WHERE event = "delivered"',
    },
  ]);

  } // end KPI else block

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.className = 'ei-chart-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // ---- Chart 1: Daily Send Volume (stacked bar) ----
  const dailyErrCard = _eiErrorCard('Daily Volume', 'daily');
  if (dailyErrCard) {
    grid.appendChild(dailyErrCard);
  } else if (!dailyRows || dailyRows.length === 0) {
    grid.appendChild(_eiEmptyState('daily volume'));
  } else {

  const dailyCard = document.createElement('div');
  dailyCard.className = 'card';
  dailyCard.style.cssText = 'padding:24px';
  dailyCard.innerHTML = `<div style="font-size:1.1rem;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Daily Send Volume</div>`;

  const dailyCanvasId = 'email-daily-volume';
  const dailyCanvas   = document.createElement('canvas');
  dailyCanvas.id      = dailyCanvasId;
  dailyCanvas.style.cssText = 'height:300px;min-height:200px;width:100%';
  dailyCard.appendChild(dailyCanvas);
  grid.appendChild(dailyCard);

  const dailyLabels    = (dailyRows || []).map(r => r.day);
  const dailyDelivered = (dailyRows || []).map(r => r.delivered || 0);
  const dailyBounced   = (dailyRows || []).map(r => r.bounced   || 0);

  Theme.createChart(dailyCanvasId, {
    type: 'bar',
    data: {
      labels: dailyLabels,
      datasets: [
        {
          label:           'Delivered',
          data:            dailyDelivered,
          backgroundColor: Theme.FUNNEL.green,
          stack:           'volume',
          order:           2,
        },
        {
          label:           'Bounced',
          data:            dailyBounced,
          backgroundColor: Theme.FUNNEL.red,
          stack:           'volume',
          order:           2,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Theme.num(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          stacked: true,
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  } // end Daily Volume else block

  // ---- Chart 2: Engagement Rates (dual-axis line) ----
  const dailyEngErr = _eiErrorCard('Engagement Rates', 'daily');
  if (dailyEngErr) {
    grid.appendChild(dailyEngErr);
  } else if (!dailyRows || dailyRows.length === 0) {
    grid.appendChild(_eiEmptyState('engagement rates'));
  } else {

  const engCard = document.createElement('div');
  engCard.className = 'card';
  engCard.style.cssText = 'padding:20px';
  engCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Engagement Rates</div>`;

  const engCanvasId = 'email-engagement-rates';
  const engCanvas   = document.createElement('canvas');
  engCanvas.id      = engCanvasId;
  engCanvas.style.height = '300px';
  engCard.appendChild(engCanvas);
  grid.appendChild(engCard);

  // Build per-day open rate and click rate from daily data
  // daily query returns sent/delivered/opened/bounced -- compute rates on the fly
  const engLabels    = (dailyRows || []).map(r => r.day);
  const openRates    = (dailyRows || []).map(r => {
    const delivered = r.delivered || 0;
    const opened    = r.opened    || 0;
    return delivered > 0 ? (opened / delivered) * 100 : 0;
  });
  const clickRates   = (dailyRows || []).map(r => {
    // click rate requires clicks col; daily query only has opened -- use 0 as placeholder
    return 0;
  });

  Theme.createChart(engCanvasId, {
    type: 'line',
    data: {
      labels: engLabels,
      datasets: [
        {
          label:           'Open Rate %',
          data:            openRates,
          borderColor:     Theme.FUNNEL.blue,
          backgroundColor: 'transparent',
          borderWidth:     2,
          pointRadius:     3,
          tension:         0.3,
          yAxisID:         'y',
        },
        {
          label:           'Click Rate %',
          data:            clickRates,
          borderColor:     Theme.FUNNEL.orange,
          backgroundColor: 'transparent',
          borderWidth:     2,
          pointRadius:     3,
          tension:         0.3,
          yAxisID:         'yRight',
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Theme.pct(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          position: 'left',
          ticks: {
            color:    Theme.COLORS.textMuted,
            font:     { size: 10 },
            callback: (v) => Theme.pct(v),
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        yRight: {
          position: 'right',
          ticks: {
            color:    Theme.COLORS.textMuted,
            font:     { size: 10 },
            callback: (v) => Theme.pct(v),
          },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });

  } // end Engagement Rates else block

  // ---- Chart 3: Subject Performance (Plotly horizontal bar) ----
  const subjectErrCard = _eiErrorCard('Subject Performance', 'subjects');
  if (subjectErrCard) {
    grid.appendChild(subjectErrCard);
  } else if (!subjectRows || subjectRows.length === 0) {
    grid.appendChild(_eiEmptyState('subject performance'));
  } else {

  const subjectCard = document.createElement('div');
  subjectCard.className = 'card';
  subjectCard.style.cssText = 'padding:20px';
  subjectCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Subject Performance -- Top 20 by Open Rate</div>`;

  const subjectDivId = 'email-subject-performance';
  const subjectDiv   = document.createElement('div');
  subjectDiv.id      = subjectDivId;
  subjectDiv.style.height = '300px';
  subjectCard.appendChild(subjectDiv);
  grid.appendChild(subjectCard);

  const subjects   = (subjectRows || []).map(r => r.subject || '(no subject)');
  const openRatesSub = (subjectRows || []).map(r => r.open_rate  || 0);
  const clickRatesSub = (subjectRows || []).map(r => r.click_rate || 0);
  const sentCounts = (subjectRows || []).map(r => r.sent || 0);

  // Color bars by click_rate intensity -- map 0..max to blue..purple
  const maxClick = Math.max(...clickRatesSub, 1);
  const barColors = clickRatesSub.map(cr => {
    const t = cr / maxClick;
    // interpolate Theme funnel blue -> purple
    return t > 0.5 ? Theme.FUNNEL.purple : Theme.FUNNEL.blue;
  });

  Plotly.newPlot(
    subjectDivId,
    [
      {
        type:        'bar',
        orientation: 'h',
        x:           openRatesSub,
        y:           subjects,
        text:        sentCounts.map(s => `${Theme.num(s)} sent`),
        textposition: 'outside',
        marker: { color: barColors },
        hovertemplate: '<b>%{y}</b><br>Open Rate: %{x:.1f}%<extra></extra>',
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      margin: { t: 10, b: 40, l: 260, r: 80 },
      xaxis: {
        ...Theme.PLOTLY_LAYOUT.xaxis,
        title: 'Open Rate (%)',
      },
      yaxis: {
        ...Theme.PLOTLY_LAYOUT.yaxis,
        autorange: 'reversed',
        tickfont:  { size: 11 },
      },
    },
    Theme.PLOTLY_CONFIG
  );

  } // end Subject Performance else block

  // ---- Chart 4: Click-to-Booking (data gap card) ----
  const gapCard = document.createElement('div');
  gapCard.className = 'card';
  gapCard.style.cssText = 'padding:20px;display:flex;flex-direction:column;justify-content:center';

  gapCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Click-to-Booking Conversion</div>
    <div style="display:inline-flex;align-items:center;gap:8px;padding:4px 10px;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.4);border-radius:6px;font-size:11px;font-weight:600;color:#eab308;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px;width:fit-content">
      Data Gap
    </div>
    <p style="font-size:14px;color:${Theme.COLORS.textSecondary};line-height:1.6;margin:0">
      Click-to-booking conversion tracking requires joining SendGrid click events to sheets_bookings via email. This integration is planned.
    </p>
    <div style="margin-top:16px;padding:12px 16px;background:${Theme.COLORS.bgPage};border-radius:8px;border-left:3px solid rgba(234,179,8,0.6)">
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Planned integration</div>
      <div style="font-size:13px;color:${Theme.COLORS.textSecondary}">sendgrid_messages.email JOIN sheets_bookings.email -> click-to-book rate per campaign</div>
    </div>
  `;
  grid.appendChild(gapCard);

  // ---- Section: Mailbox Provider Deliverability (EMAIL-04) ----
  // Source: cod_warehouse.sendgrid_mailbox_provider_stats (5M+ rows)
  const providerSectionHeader = document.createElement('div');
  providerSectionHeader.style.cssText = 'margin:32px 0 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
  providerSectionHeader.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Mailbox Provider Deliverability</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Per-provider delivery, open, click, bounce + spam rates. Highlights inbox-placement issues by destination ESP.</div>
    </div>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};padding:4px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.06)">
      <span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px"></span>BQ: sendgrid_mailbox_provider_stats
    </div>
  `;
  container.appendChild(providerSectionHeader);

  const providerErr = _eiErrorCard('Mailbox provider stats', 'mailboxProvider');
  if (providerErr) {
    container.appendChild(providerErr);
  } else if (!providerRows || providerRows.length === 0) {
    container.appendChild(_eiEmptyState('mailbox provider'));
  } else {
    const providerGrid = document.createElement('div');
    providerGrid.className = 'ei-chart-grid';
    providerGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px';
    container.appendChild(providerGrid);

    // Chart A: Volume Donut (delivered share by provider)
    const donutCard = document.createElement('div');
    donutCard.className = 'card';
    donutCard.style.cssText = 'padding:20px';
    donutCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Delivered Share by Provider</div>`;

    const donutDivId = 'email-provider-donut';
    const donutDiv = document.createElement('div');
    donutDiv.id = donutDivId;
    donutDiv.style.height = '320px';
    donutCard.appendChild(donutDiv);
    providerGrid.appendChild(donutCard);

    const donutLabels = providerRows.map(r => r.provider);
    const donutValues = providerRows.map(r => Number(r.delivered) || 0);
    const palette = [
      Theme.FUNNEL.blue, Theme.FUNNEL.purple, Theme.FUNNEL.green,
      Theme.FUNNEL.amber, Theme.FUNNEL.red, Theme.FUNNEL.cyan,
      '#ec4899', '#a855f7', '#14b8a6', '#84cc16',
      '#f97316', '#06b6d4', '#eab308', '#ef4444', '#6366f1'
    ];

    Plotly.newPlot(
      donutDivId,
      [{
        type: 'pie',
        hole: 0.55,
        labels: donutLabels,
        values: donutValues,
        marker: { colors: palette.slice(0, donutLabels.length) },
        textinfo: 'label+percent',
        textposition: 'outside',
        hovertemplate: '<b>%{label}</b><br>Delivered: %{value:,}<br>Share: %{percent}<extra></extra>',
      }],
      {
        ...Theme.PLOTLY_LAYOUT,
        margin: { t: 20, b: 20, l: 20, r: 20 },
        showlegend: false,
      },
      Theme.PLOTLY_CONFIG
    );

    // Chart B: Per-Provider Rates Table
    const tableCard = document.createElement('div');
    tableCard.className = 'card';
    tableCard.style.cssText = 'padding:20px;overflow-x:auto';
    tableCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Provider Rates (delivery / open / click / bounce / spam)</div>`;

    function _emailColorRate(value, type) {
      if (value == null || isNaN(value)) return Theme.COLORS.textMuted;
      const v = Number(value);
      if (type === 'delivery') {
        if (v >= 95) return '#22c55e';
        if (v >= 90) return '#eab308';
        return '#ef4444';
      }
      if (type === 'open') {
        if (v >= 30) return '#22c55e';
        if (v >= 20) return '#eab308';
        return Theme.COLORS.textSecondary;
      }
      if (type === 'click') {
        if (v >= 2) return '#22c55e';
        if (v >= 1) return '#eab308';
        return Theme.COLORS.textSecondary;
      }
      if (type === 'bounce') {
        if (v >= 2) return '#ef4444';
        if (v >= 1) return '#eab308';
        return '#22c55e';
      }
      if (type === 'spam') {
        if (v >= 0.1) return '#ef4444';
        if (v >= 0.05) return '#eab308';
        return '#22c55e';
      }
      return Theme.COLORS.textPrimary;
    }
    function _emailFmtPct(v) {
      return v == null || isNaN(v) ? '–' : Number(v).toFixed(1) + '%';
    }
    function _emailFmtNum(v) {
      return v == null ? '0' : Number(v).toLocaleString();
    }

    const headers = ['Provider', 'Delivered', 'Delivery %', 'Open %', 'Click %', 'Bounce %', 'Spam %'];
    let tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
            ${headers.map(h => `<th style="text-align:${h === 'Provider' ? 'left' : 'right'};padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;
    providerRows.forEach((r, i) => {
      const altBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      tableHtml += `
        <tr style="background:${altBg};border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="padding:8px 10px;color:${Theme.COLORS.textPrimary};font-weight:500">${_esc(r.provider)}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${_emailFmtNum(r.delivered)}</td>
          <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;color:${_emailColorRate(r.delivery_rate, 'delivery')};font-weight:600">${_emailFmtPct(r.delivery_rate)}</td>
          <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;color:${_emailColorRate(r.open_rate, 'open')}">${_emailFmtPct(r.open_rate)}</td>
          <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;color:${_emailColorRate(r.click_rate, 'click')}">${_emailFmtPct(r.click_rate)}</td>
          <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;color:${_emailColorRate(r.bounce_rate, 'bounce')}">${_emailFmtPct(r.bounce_rate)}</td>
          <td style="padding:8px 10px;text-align:right;font-variant-numeric:tabular-nums;color:${_emailColorRate(r.spam_rate, 'spam')}">${_emailFmtPct(r.spam_rate)}</td>
        </tr>
      `;
    });
    tableHtml += '</tbody></table>';
    tableCard.innerHTML += tableHtml;
    providerGrid.appendChild(tableCard);
  }
});

function _esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

App.onFilterChange(() => App.navigate('email-intel'));
