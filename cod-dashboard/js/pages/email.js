/* ============================================
   Email -- SendGrid delivery + engagement
   Delivery rate, open/click rates, subject
   performance, daily volume
   ============================================ */

App.registerPage('email-intel', async (container) => {
  const days = Filters.getDays();

  let kpiRows, dailyRows, subjectRows;

  try {
    [kpiRows, dailyRows, subjectRows] = await Promise.all([
      API.query('email', 'default',  { days }),
      API.query('email', 'daily',    { days }),
      API.query('email', 'subjects', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Email data: ${err.message}</p></div>`;
    return;
  }

  const kpi = (kpiRows && kpiRows.length > 0) ? kpiRows[0] : {};
  container.innerHTML = '';

  // ---- KPI Strip ----
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

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // ---- Chart 1: Daily Send Volume (stacked bar) ----
  const dailyCard = document.createElement('div');
  dailyCard.className = 'card';
  dailyCard.style.cssText = 'padding:20px';
  dailyCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Daily Send Volume</div>`;

  const dailyCanvasId = 'email-daily-volume';
  const dailyCanvas   = document.createElement('canvas');
  dailyCanvas.id      = dailyCanvasId;
  dailyCanvas.style.height = '300px';
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

  // ---- Chart 2: Engagement Rates (dual-axis line) ----
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

  // ---- Chart 3: Subject Performance (Plotly horizontal bar) ----
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
});
