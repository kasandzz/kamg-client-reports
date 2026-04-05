/* ============================================
   Enrollment -- high-ticket program conversions
   Cash collected, ROAS, ticket-to-enrollment rate
   ============================================ */

App.registerPage('enrollment', async (container) => {
  const days = Filters.getDays();

  let kpi, monthly, pipeline;

  try {
    [kpi, monthly, pipeline] = await Promise.all([
      API.query('enrollment', 'default',  { days }),
      API.query('enrollment', 'monthly',  { days: 365 }),
      API.query('enrollment', 'pipeline', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Enrollment: ${err.message}</p></div>`;
    return;
  }

  const k          = (kpi && kpi.length > 0) ? kpi[0] : {};
  const pip        = (pipeline && pipeline.length > 0) ? pipeline[0] : {};
  container.innerHTML = '';

  // ---- Derived values ----
  const totalEnrolled         = k.total_enrolled              || 0;
  const cashCollected         = k.cash_collected              || 0;
  const roas                  = k.roas                        || 0;
  const avgDealSize           = k.avg_deal_size               || 0;
  const refundRate            = k.refund_rate                 || 0;
  const ticketToEnrollment    = pip.ticket_to_enrollment_rate || 0;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Enrollments',             value: totalEnrolled,      format: 'num'   },
    { label: 'Cash Collected',          value: cashCollected,      format: 'money' },
    { label: 'ROAS (Cash)',             value: roas,               format: 'num'   },
    { label: 'Avg Deal Size',           value: avgDealSize,        format: 'money' },
    { label: 'Refund Rate',             value: refundRate,         format: 'pct', invertCost: true },
    { label: 'Ticket-to-Enrollment',    value: ticketToEnrollment, format: 'pct'   },
  ]);

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // -- Chart 1: Monthly Enrollments (bar + trend line) --
  const enrollCard = document.createElement('div');
  enrollCard.className = 'card';
  enrollCard.style.cssText = 'padding:20px';
  enrollCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly Enrollments</div>`;

  const enrollCanvasId = 'enrollment-monthly-enrollments';
  const enrollCanvas   = document.createElement('canvas');
  enrollCanvas.id      = enrollCanvasId;
  enrollCanvas.style.height = '300px';
  enrollCard.appendChild(enrollCanvas);
  grid.appendChild(enrollCard);

  const monthLabels     = (monthly || []).map(r => r.month);
  const enrollCounts    = (monthly || []).map(r => r.enrollments || 0);

  // Simple linear trend line
  const n = enrollCounts.length;
  let trendData = [];
  if (n > 1) {
    const sumX  = enrollCounts.reduce((a, _, i) => a + i, 0);
    const sumY  = enrollCounts.reduce((a, v) => a + v, 0);
    const sumXY = enrollCounts.reduce((a, v, i) => a + i * v, 0);
    const sumX2 = enrollCounts.reduce((a, _, i) => a + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    trendData = enrollCounts.map((_, i) => parseFloat((intercept + slope * i).toFixed(2)));
  }

  Theme.createChart(enrollCanvasId, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label:           'Enrollments',
          data:            enrollCounts,
          backgroundColor: Theme.FUNNEL.green,
          order:           2,
          yAxisID:         'y',
        },
        ...(trendData.length ? [{
          label:           'Trend',
          data:            trendData,
          type:            'line',
          borderColor:     Theme.COLORS.warning,
          backgroundColor: 'transparent',
          borderWidth:     2,
          borderDash:      [4, 4],
          pointRadius:     0,
          tension:         0.3,
          order:           1,
          yAxisID:         'y',
        }] : []),
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:  { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Theme.num(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  // -- Chart 2: Monthly Cash Collected (bar) --
  const revenueCard = document.createElement('div');
  revenueCard.className = 'card';
  revenueCard.style.cssText = 'padding:20px';
  revenueCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly Cash Collected</div>`;

  const revenueCanvasId = 'enrollment-monthly-revenue';
  const revenueCanvas   = document.createElement('canvas');
  revenueCanvas.id      = revenueCanvasId;
  revenueCanvas.style.height = '300px';
  revenueCard.appendChild(revenueCanvas);
  grid.appendChild(revenueCard);

  const revenueSeries = (monthly || []).map(r => r.revenue || 0);

  Theme.createChart(revenueCanvasId, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label:           'Cash Collected',
          data:            revenueSeries,
          backgroundColor: Theme.FUNNEL.blue,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:  { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: {
            color:    Theme.COLORS.textMuted,
            font:     { size: 10 },
            callback: (v) => Theme.money(v),
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  // -- Row 2: Revenue by Processor (card) + Ticket-to-Enrollment Gauge --
  const row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(row2);

  // Revenue by Processor card
  const processorCard = document.createElement('div');
  processorCard.className = 'card';
  processorCard.style.cssText = 'padding:20px';
  processorCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Revenue by Processor</div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div style="flex:1">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Stripe</div>
        <div style="font-size:32px;font-weight:700;color:${Theme.COLORS.textPrimary};margin-top:4px">${Theme.money(cashCollected)}</div>
        <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">last ${days} days</div>
      </div>
      <div style="width:48px;height:48px;border-radius:50%;background:${Theme.COLORS.bgPage};border:2px solid ${Theme.FUNNEL.blue};display:flex;align-items:center;justify-content:center;font-size:20px">S</div>
    </div>
    <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:6px">
      <span style="color:${Theme.COLORS.warning};font-size:14px">&#9888;</span>
      <span style="font-size:12px;color:${Theme.COLORS.warning};font-weight:500">Data Gap</span>
    </div>
    <p style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:12px;line-height:1.5">
      Authorize.net data not yet syncing to BigQuery. Revenue shown is Stripe-only.
    </p>
  `;
  row2.appendChild(processorCard);

  // Ticket-to-Enrollment Gauge
  const gaugeCard = document.createElement('div');
  gaugeCard.className = 'card';
  gaugeCard.style.cssText = 'padding:20px';
  gaugeCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Ticket-to-Enrollment Rate</div>`;

  const gaugeId  = 'enrollment-t2e-gauge';
  const gaugeDiv = document.createElement('div');
  gaugeDiv.id    = gaugeId;
  gaugeDiv.style.height = '260px';
  gaugeCard.appendChild(gaugeDiv);

  const gaugeNote = document.createElement('div');
  gaugeNote.style.cssText = `margin-top:8px;font-size:12px;color:${Theme.COLORS.textMuted};text-align:center`;
  gaugeNote.textContent = 'Typical range: 2-4%. Scale 0-10%.';
  gaugeCard.appendChild(gaugeNote);
  row2.appendChild(gaugeCard);

  const gaugeVal = Math.min(ticketToEnrollment, 100);

  Plotly.newPlot(
    gaugeId,
    [
      {
        type:  'indicator',
        mode:  'gauge+number',
        value: gaugeVal,
        number: { suffix: '%', font: { size: 28, color: Theme.COLORS.textPrimary } },
        gauge: {
          axis: {
            range:     [0, 10],
            tickcolor: Theme.COLORS.textMuted,
            tickfont:  { size: 10, color: Theme.COLORS.textMuted },
          },
          bar:       { color: Theme.FUNNEL.green, thickness: 0.25 },
          bgcolor:   'transparent',
          borderwidth: 0,
          steps: [
            { range: [0, 1],  color: 'rgba(239,68,68,0.2)'  },
            { range: [1, 3],  color: 'rgba(234,179,8,0.2)' },
            { range: [3, 10], color: 'rgba(34,197,94,0.15)' },
          ],
          threshold: {
            line:  { color: Theme.COLORS.warning, width: 2 },
            thickness: 0.75,
            value: 3,
          },
        },
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      margin: { t: 20, b: 20, l: 30, r: 30 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Attribution Card (full width) ----
  const attrCard = document.createElement('div');
  attrCard.className = 'card';
  attrCard.style.cssText = 'padding:24px;margin-top:16px';
  attrCard.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:16px">
      <div style="width:36px;height:36px;border-radius:8px;background:rgba(108,92,231,0.15);border:1px solid rgba(108,92,231,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">&#128268;</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Attribution Note</div>
        <p style="font-size:13px;color:${Theme.COLORS.textMuted};line-height:1.6;margin:0">
          Attribution data from Hyros tracks $27 ticket sources (not high-ticket enrollments directly).
          Full enrollment attribution requires email-based linkage between Hyros leads and Stripe transactions
          -- this integration is in progress.
        </p>
      </div>
    </div>
  `;
  container.appendChild(attrCard);
});
