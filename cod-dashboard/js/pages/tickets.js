/* ============================================
   Tickets -- $27 workshop ticket sales
   Daily volume, VIP take rate, revenue vs spend
   ============================================ */

App.registerPage('tickets', async (container) => {
  const days = Filters.getDays();

  let kpis, daily;

  try {
    [kpis, daily] = await Promise.all([
      API.query('tickets', 'default', { days }),
      API.query('tickets', 'daily',   { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Tickets: ${err.message}</p></div>`;
    return;
  }

  const kpi = (kpis && kpis.length > 0) ? kpis[0] : {};
  container.innerHTML = '';

  // ---- Derived values ----
  const ticketsSold     = kpi.tickets_sold     || 0;
  const vipCount        = kpi.vip_count        || 0;
  const vipTakeRate     = kpi.vip_take_rate    || 0;
  const ticketRevenue   = kpi.ticket_revenue   || 0;
  const avgDailyRevenue = kpi.avg_daily_revenue || 0;
  const activeDays      = kpi.active_days      || 0;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Tickets Sold',       value: ticketsSold,     format: 'num'   },
    { label: 'VIP Take Rate',      value: vipTakeRate,     format: 'pct'   },
    { label: 'Ticket Revenue',     value: ticketRevenue,   format: 'money' },
    { label: 'VIP Count',          value: vipCount,        format: 'num'   },
    { label: 'Avg Daily Revenue',  value: avgDailyRevenue, format: 'money' },
    { label: 'Active Days',        value: activeDays,      format: 'num'   },
  ]);

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // -- Chart 1: Daily Ticket Sales (stacked bar + spend line) --
  const salesCard = document.createElement('div');
  salesCard.className = 'card';
  salesCard.style.cssText = 'padding:20px';
  salesCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Daily Ticket Sales</div>`;

  const salesCanvasId = 'tickets-daily-sales';
  const salesCanvas   = document.createElement('canvas');
  salesCanvas.id      = salesCanvasId;
  salesCanvas.style.height = '300px';
  salesCard.appendChild(salesCanvas);
  grid.appendChild(salesCard);

  const labels      = (daily || []).map(r => r.ticket_date);
  const baseTickets = (daily || []).map(r => r.base_tickets   || 0);
  const vipTickets  = (daily || []).map(r => r.vip_tickets    || 0);
  const spendSeries = (daily || []).map(r => r.daily_spend    || 0);

  Theme.createChart(salesCanvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'Base Tickets',
          data:            baseTickets,
          backgroundColor: Theme.FUNNEL.blue,
          stack:           'tickets',
          order:           2,
          yAxisID:         'y',
        },
        {
          label:           'VIP Tickets',
          data:            vipTickets,
          backgroundColor: Theme.FUNNEL.purple,
          stack:           'tickets',
          order:           2,
          yAxisID:         'y',
        },
        {
          label:           'Ad Spend',
          data:            spendSeries,
          type:            'line',
          borderColor:     Theme.FUNNEL.orange,
          backgroundColor: 'transparent',
          borderWidth:     2,
          pointRadius:     3,
          tension:         0.3,
          order:           1,
          yAxisID:         'yRight',
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:  { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === 'yRight') {
                return `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y)}`;
              }
              return `${ctx.dataset.label}: ${Theme.num(ctx.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks:  { color: Theme.COLORS.textMuted,      font: { size: 10 } },
          grid:   { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          stacked: true,
          position: 'left',
          ticks:  { color: Theme.COLORS.textMuted,      font: { size: 10 } },
          grid:   { color: 'rgba(255,255,255,0.04)' },
        },
        yRight: {
          position: 'right',
          ticks:    {
            color:    Theme.COLORS.textMuted,
            font:     { size: 10 },
            callback: (v) => Theme.money(v),
          },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });

  // -- Chart 2: VIP Take Rate (Plotly donut) --
  const vipCard = document.createElement('div');
  vipCard.className = 'card';
  vipCard.style.cssText = 'padding:20px';
  vipCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">VIP Take Rate</div>`;

  const donutId  = 'tickets-vip-donut';
  const donutDiv = document.createElement('div');
  donutDiv.id    = donutId;
  donutDiv.style.height = '300px';
  vipCard.appendChild(donutDiv);

  const annotationDiv = document.createElement('div');
  annotationDiv.style.cssText = `margin-top:12px;padding:10px 14px;background:${Theme.COLORS.bgPage};border-radius:8px;border-left:3px solid ${Theme.FUNNEL.purple};font-size:13px;color:${Theme.COLORS.textSecondary}`;
  annotationDiv.innerHTML = `VIP buyers are <strong style="color:${Theme.COLORS.textPrimary}">3.25x more likely</strong> to enroll in the high-ticket program.`;
  vipCard.appendChild(annotationDiv);
  grid.appendChild(vipCard);

  const standardCount = Math.max(0, ticketsSold - vipCount);
  const vipPct        = vipTakeRate > 0 ? vipTakeRate.toFixed(1) : '0.0';

  Plotly.newPlot(
    donutId,
    [
      {
        type:    'pie',
        hole:    0.6,
        values:  [vipCount, standardCount],
        labels:  ['VIP', 'Standard'],
        marker:  { colors: [Theme.FUNNEL.purple, Theme.FUNNEL.blue] },
        textinfo: 'none',
        hovertemplate: '%{label}: %{value} (%{percent})<extra></extra>',
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      annotations: [
        {
          text:      `<b>${vipPct}%</b><br>VIP`,
          x:         0.5,
          y:         0.5,
          xref:      'paper',
          yref:      'paper',
          showarrow: false,
          font:      { size: 18, color: Theme.COLORS.textPrimary },
        },
      ],
      margin: { t: 10, b: 10, l: 10, r: 10 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Revenue Summary Card (full width) ----
  const summaryCard = document.createElement('div');
  summaryCard.className = 'card';
  summaryCard.style.cssText = 'padding:24px;margin-top:16px';

  const costPerTicket = ticketsSold > 0 && ticketRevenue > 0
    ? (ticketRevenue / ticketsSold).toFixed(2)
    : '0.00';

  summaryCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Revenue Summary</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      <div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Total Ticket Revenue</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.textPrimary};margin-top:4px">${Theme.money(ticketRevenue)}</div>
        <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">last ${days} days</div>
      </div>
      <div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Avg Revenue / Ticket</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.accent};margin-top:4px">$${costPerTicket}</div>
        <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">blended (base + VIP)</div>
      </div>
      <div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Avg Daily Revenue</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.FUNNEL.green};margin-top:4px">${Theme.money(avgDailyRevenue)}</div>
        <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">across ${activeDays} active days</div>
      </div>
    </div>
  `;
  container.appendChild(summaryCard);
});
