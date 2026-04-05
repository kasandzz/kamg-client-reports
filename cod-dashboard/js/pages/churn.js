/* ============================================
   Churn -- payment health, refunds, failed charges
   Data: stripe_transactions
   ============================================ */

App.registerPage('churn', async (container) => {
  const days = Filters.getDays();

  let kpiData, monthlyData;

  try {
    [kpiData, monthlyData] = await Promise.all([
      API.query('churn', 'default',  { days }),
      API.query('churn', 'monthly',  { days: 365 }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Churn: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  const k              = (kpiData && kpiData.length > 0) ? kpiData[0] : {};
  const totalCharges   = k.total_charges      || 0;
  const successful     = k.successful         || 0;
  const failed         = k.failed             || 0;
  const failureRate    = k.failure_rate        != null ? k.failure_rate   : 0;
  const collected      = k.collected          || 0;
  const refunded       = k.refunded           || 0;
  const refundCount    = k.refund_count        || 0;
  const refundRate     = k.refund_rate         != null ? k.refund_rate    : 0;
  const activeSubscribers = k.active_subscribers || 0;

  // Estimated revenue at risk: failed charges * avg successful charge
  const avgCharge      = successful > 0 ? collected / successful : 0;
  const revenueAtRisk  = failed * avgCharge;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Active Subscribers', value: activeSubscribers, format: 'num'                   },
    { label: 'Total Collected',    value: collected,         format: 'money'                 },
    { label: 'Total Refunded',     value: refunded,          format: 'money', invertCost: true },
    { label: 'Refund Rate',        value: refundRate,        format: 'pct',   invertCost: true },
    { label: 'Failed Payments',    value: failed,            format: 'num',   invertCost: true },
    { label: 'Failure Rate',       value: failureRate,       format: 'pct',   invertCost: true },
    { label: 'Refund Count',       value: refundCount,       format: 'num',   invertCost: true },
    { label: 'Total Charges',      value: totalCharges,      format: 'num'                   },
  ]);

  // ---- Chart grid (2-column) ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  const months    = (monthlyData || []);
  const mLabels   = months.map(r => r.month   || '');
  const mSuccess  = months.map(r => r.successful || 0);
  const mFailed   = months.map(r => r.failed     || 0);
  const mRefunded = months.map(r => Number(r.refunded  || 0));
  const mCollected= months.map(r => Number(r.collected || 0));

  // -- Chart 1: Subscription Health (stacked bar) --
  const healthCard = document.createElement('div');
  healthCard.className = 'card';
  healthCard.style.cssText = 'padding:20px';
  healthCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Subscription Health</div>`;

  const healthCanvas = document.createElement('canvas');
  healthCanvas.id    = 'churn-health-chart';
  healthCanvas.style.height = '300px';
  healthCard.appendChild(healthCanvas);
  grid.appendChild(healthCard);

  Theme.createChart('churn-health-chart', {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [
        {
          label:           'Successful',
          data:            mSuccess,
          backgroundColor: Theme.FUNNEL.green,
          stack:           'health',
        },
        {
          label:           'Failed',
          data:            mFailed,
          backgroundColor: '#ef4444',
          stack:           'health',
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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
          stacked: true,
          ticks:   { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 },
          grid:    { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          stacked: true,
          ticks:   { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:    { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  // -- Chart 2: Refund & Chargeback Trend (bar + line dual-axis) --
  const refundCard = document.createElement('div');
  refundCard.className = 'card';
  refundCard.style.cssText = 'padding:20px';
  refundCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Refund &amp; Chargeback Trend</div>`;

  const refundCanvas = document.createElement('canvas');
  refundCanvas.id    = 'churn-refund-chart';
  refundCanvas.style.height = '300px';
  refundCard.appendChild(refundCanvas);
  grid.appendChild(refundCard);

  // 1% Stripe threshold reference line: max monthly collected * 0.01
  const maxCollected = Math.max(...mCollected, 1);
  const stripeThreshold = maxCollected * 0.01;

  Theme.createChart('churn-refund-chart', {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [
        {
          label:           'Refunded ($)',
          data:            mRefunded,
          backgroundColor: 'rgba(239,68,68,0.65)',
          order:           2,
          yAxisID:         'y',
        },
        {
          label:           'Collected ($)',
          data:            mCollected,
          type:            'line',
          borderColor:     Theme.FUNNEL.green,
          backgroundColor: 'transparent',
          borderWidth:     2,
          pointRadius:     2,
          tension:         0.3,
          order:           1,
          yAxisID:         'y2',
        },
        {
          label:           '1% Stripe Threshold',
          data:            mLabels.map(() => stripeThreshold),
          type:            'line',
          borderColor:     'rgba(234,179,8,0.7)',
          backgroundColor: 'transparent',
          borderWidth:     1.5,
          borderDash:      [6, 4],
          pointRadius:     0,
          order:           0,
          yAxisID:         'y',
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          position: 'left',
          ticks:    { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: (v) => Theme.money(v) },
          grid:     { color: 'rgba(255,255,255,0.04)' },
          title:    { display: true, text: 'Refunds', color: Theme.COLORS.textMuted, font: { size: 10 } },
        },
        y2: {
          position: 'right',
          ticks: {
            color:    Theme.COLORS.textMuted,
            font:     { size: 10 },
            callback: (v) => Theme.money(v),
          },
          grid:  { drawOnChartArea: false },
          title: { display: true, text: 'Collected', color: Theme.COLORS.textMuted, font: { size: 10 } },
        },
      },
    },
  });

  // ---- Row 2 ----
  const row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(row2);

  // -- Chart 3: Failed Payment Tracking (bar) --
  const failedCard = document.createElement('div');
  failedCard.className = 'card';
  failedCard.style.cssText = 'padding:20px';
  failedCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Failed Payment Tracking</div>`;

  const failedCanvas = document.createElement('canvas');
  failedCanvas.id    = 'churn-failed-chart';
  failedCanvas.style.height = '300px';
  failedCard.appendChild(failedCanvas);
  row2.appendChild(failedCard);

  Theme.createChart('churn-failed-chart', {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [
        {
          label:           'Failed Payments',
          data:            mFailed,
          backgroundColor: '#ef4444',
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `Failed: ${Theme.num(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: true,
        },
      },
    },
  });

  // -- Card 4: Revenue at Risk --
  const riskCard = document.createElement('div');
  riskCard.className = 'card';
  riskCard.style.cssText = 'padding:24px;display:flex;flex-direction:column;justify-content:center';

  const riskColor = revenueAtRisk > 5000 ? '#ef4444' : revenueAtRisk > 1000 ? Theme.COLORS.warning : Theme.FUNNEL.green;

  riskCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:20px">Revenue at Risk</div>
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:48px;font-weight:700;color:${riskColor};line-height:1;margin-bottom:8px">${Theme.money(revenueAtRisk)}</div>
      <div style="font-size:13px;color:${Theme.COLORS.textMuted};margin-bottom:24px">Estimated from ${Theme.num(failed)} failed payment${failed !== 1 ? 's' : ''} x avg charge of ${Theme.money(avgCharge)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Failed</div>
        <div style="font-size:18px;font-weight:700;color:#ef4444">${Theme.num(failed)}</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Avg Charge</div>
        <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.money(avgCharge)}</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Failure Rate</div>
        <div style="font-size:18px;font-weight:700;color:${failureRate > 5 ? '#ef4444' : Theme.COLORS.textPrimary}">${failureRate.toFixed(1)}%</div>
      </div>
    </div>
    <div style="margin-top:16px;padding:12px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:6px;font-size:12px;color:${Theme.COLORS.textMuted};line-height:1.6">
      <strong style="color:${Theme.COLORS.textSecondary}">Note:</strong> Revenue at risk is an estimate. Stripe's automatic retry logic may recover a portion of failed charges. Monitor the failure rate; Stripe flags accounts above <strong style="color:${Theme.COLORS.warning}">5%</strong>.
    </div>
  `;
  row2.appendChild(riskCard);
});
