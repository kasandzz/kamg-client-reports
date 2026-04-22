/* ============================================
   Revenue & LTV -- processor breakdown, LTV cohorts,
   closer concentration, churn absorption
   Rebuilt from enrollment.js for Phase 01-02
   ============================================ */

App.registerPage('revenue', async (container) => {
  const days = Filters.getDays();

  // ---- Fetch all data in parallel ----
  let kpi, monthly, pipeline, processors, ltvCohorts, closers, churn;

  try {
    [kpi, monthly, pipeline, processors, ltvCohorts, closers, churn] = await Promise.all([
      API.query('enrollment', 'default', { days }),
      API.query('enrollment', 'monthly', { days: 365 }),
      API.query('enrollment', 'pipeline', { days }),
      API.query('enrollment', 'processorBreakdown', { days }),
      API.query('enrollment', 'ltvCohorts', { months: 12 }),
      API.query('enrollment', 'jodiConcentration', { days }),
      API.query('enrollment', 'churnAbsorption'),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Revenue & LTV: ${err.message}</p></div>`;
    return;
  }

  const k = (kpi && kpi.length > 0) ? kpi[0] : {};
  const pip = (pipeline && pipeline.length > 0) ? pipeline[0] : {};
  container.innerHTML = '';

  // ---- Derived values ----
  const totalEnrolled = k.total_enrolled || 0;
  const cashCollected = k.cash_collected || 0;
  const roas = k.roas || 0;
  const avgDealSize = k.avg_deal_size || 0;
  const refundRate = k.refund_rate || 0;
  const ticketToEnrollment = pip.ticket_to_enrollment_rate || 0;

  // ---- Prior period delta (fetch 2x window, compute delta) ----
  let priorKpi = {};
  try {
    const priorData = await API.query('enrollment', 'default', { days: days * 2 });
    if (priorData && priorData.length > 0) priorKpi = priorData[0];
  } catch (_) { /* ignore */ }

  const priorCash = (priorKpi.cash_collected || 0) - cashCollected;
  const priorEnrolled = (priorKpi.total_enrolled || 0) - totalEnrolled;
  const priorRoas = priorCash > 0 && priorKpi.total_spend
    ? priorCash / ((priorKpi.total_spend || 0) - (k.total_spend || 0) || 1)
    : 0;

  function calcDelta(current, prior) {
    if (!prior || prior === 0) return null;
    return ((current - prior) / Math.abs(prior)) * 100;
  }

  // ======================================================
  // SECTION 1: Revenue KPI Strip
  // ======================================================
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    {
      label: 'Enrollments',
      value: totalEnrolled,
      format: 'num',
      delta: calcDelta(totalEnrolled, priorEnrolled),
      prevValue: priorEnrolled > 0 ? priorEnrolled : undefined,
      source: 'BigQuery: v_stripe_clean',
      calc: 'COUNT(*) WHERE status=succeeded AND amount>100',
    },
    {
      label: 'Cash Collected',
      value: cashCollected,
      format: 'money',
      delta: calcDelta(cashCollected, priorCash),
      prevValue: priorCash > 0 ? priorCash : undefined,
      source: 'BigQuery: v_stripe_clean',
      calc: 'SUM(amount) WHERE status=succeeded AND amount>100',
    },
    {
      label: 'ROAS (Cash)',
      value: roas,
      format: 'num',
      delta: calcDelta(roas, priorRoas),
      source: 'BigQuery: v_stripe_clean + v_meta_ads_clean',
      calc: 'cash_collected / total_ad_spend',
    },
    {
      label: 'Avg Deal Size',
      value: avgDealSize,
      format: 'money',
      source: 'BigQuery: v_stripe_clean',
      calc: 'AVG(amount) WHERE amount > 100',
    },
    {
      label: 'Refund Rate',
      value: refundRate,
      format: 'pct',
      invertCost: true,
      source: 'BigQuery: v_stripe_clean',
      calc: 'refund_count / total_count * 100',
    },
    {
      label: 'Ticket-to-Enrollment',
      value: ticketToEnrollment,
      format: 'pct',
      source: 'BigQuery: vw_workshop_funnel_pipeline',
      calc: 'enrolled / total_tickets * 100',
    },
  ]);

  // ======================================================
  // SECTION 2: LTV Cohort Heatmap (Plotly)
  // ======================================================
  const heatmapCard = document.createElement('div');
  heatmapCard.className = 'card';
  heatmapCard.style.cssText = 'padding:20px;margin-top:16px';
  heatmapCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">LTV by Enrollment Cohort</div>`;

  const heatmapId = 'revenue-ltv-heatmap';
  const heatmapDiv = document.createElement('div');
  heatmapDiv.id = heatmapId;
  heatmapDiv.style.height = '400px';
  heatmapCard.appendChild(heatmapDiv);
  container.appendChild(heatmapCard);

  if (ltvCohorts && ltvCohorts.length > 0) {
    const cohortMonths = ltvCohorts.map(r => r.cohort_month);
    const windows = ['30d', '60d', '90d', '180d'];
    const zValues = ltvCohorts.map(r => [
      parseFloat(r.ltv_30d) || 0,
      parseFloat(r.ltv_60d) || 0,
      parseFloat(r.ltv_90d) || 0,
      parseFloat(r.ltv_180d) || 0,
    ]);
    const cohortSizes = ltvCohorts.map(r => r.cohort_size || 0);

    // Build hover text
    const hoverText = ltvCohorts.map((r, rowIdx) =>
      windows.map((w, colIdx) =>
        `$${Theme.money(zValues[rowIdx][colIdx]).replace('$', '')} at ${w}<br>${r.cohort_month} cohort (n=${cohortSizes[rowIdx]})`
      )
    );

    Plotly.newPlot(
      heatmapId,
      [{
        type: 'heatmap',
        x: windows,
        y: cohortMonths,
        z: zValues,
        text: hoverText,
        hoverinfo: 'text',
        colorscale: [
          [0, '#1a1a26'],
          [0.25, '#312e81'],
          [0.5, '#6366f1'],
          [0.75, '#4ade80'],
          [1, '#22c55e'],
        ],
        colorbar: {
          title: { text: 'LTV ($)', font: { color: Theme.COLORS.textSecondary, size: 11 } },
          tickfont: { color: Theme.COLORS.textMuted, size: 10 },
          tickprefix: '$',
          borderwidth: 0,
        },
        xgap: 2,
        ygap: 2,
      }],
      {
        ...Theme.PLOTLY_LAYOUT,
        title: '',
        xaxis: {
          ...Theme.PLOTLY_LAYOUT.xaxis,
          title: { text: 'LTV Window', font: { color: Theme.COLORS.textSecondary, size: 12 } },
        },
        yaxis: {
          ...Theme.PLOTLY_LAYOUT.yaxis,
          title: { text: 'Cohort Month', font: { color: Theme.COLORS.textSecondary, size: 12 } },
          autorange: 'reversed',
        },
        margin: { t: 10, b: 50, l: 80, r: 20 },
      },
      Theme.PLOTLY_CONFIG
    );
  } else {
    heatmapDiv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${Theme.COLORS.textMuted}">No LTV cohort data available</div>`;
  }

  // ======================================================
  // SECTION 3 + 4: Two-column grid (Processor + Concentration)
  // ======================================================
  const midGrid = document.createElement('div');
  midGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(midGrid);

  // Mobile: stack vertically
  const mqStyle = document.createElement('style');
  mqStyle.textContent = `@media(max-width:768px){#revenue-mid-grid{grid-template-columns:1fr!important}}`;
  document.head.appendChild(mqStyle);
  midGrid.id = 'revenue-mid-grid';

  // ---- Processor Breakdown Doughnut (Chart.js) ----
  const processorCard = document.createElement('div');
  processorCard.className = 'card';
  processorCard.style.cssText = 'padding:20px';
  processorCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Revenue by Processor</div>`;

  const doughnutId = 'revenue-processor-doughnut';
  const doughnutCanvas = document.createElement('canvas');
  doughnutCanvas.id = doughnutId;
  doughnutCanvas.style.height = '280px';
  processorCard.appendChild(doughnutCanvas);

  // Legend below
  const processorLegend = document.createElement('div');
  processorLegend.style.cssText = 'margin-top:16px;display:flex;flex-direction:column;gap:8px';
  processorCard.appendChild(processorLegend);
  midGrid.appendChild(processorCard);

  if (processors && processors.length > 0) {
    const procLabels = processors.map(r => r.processor);
    const procValues = processors.map(r => parseFloat(r.total_revenue) || 0);
    const procPcts = processors.map(r => parseFloat(r.pct_of_total) || 0);
    const totalRev = procValues.reduce((a, b) => a + b, 0);

    // Center text plugin
    const centerTextPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.font = '600 24px Inter, sans-serif';
        ctx.fillStyle = Theme.COLORS.textPrimary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Theme.money(totalRev), centerX, centerY);
        ctx.restore();
      }
    };

    Theme.createChart(doughnutId, {
      type: 'doughnut',
      data: {
        labels: procLabels,
        datasets: [{
          data: procValues,
          backgroundColor: Theme.FUNNEL_ARRAY.slice(0, procLabels.length),
          borderWidth: 0,
          hoverBorderWidth: 2,
          hoverBorderColor: Theme.COLORS.textPrimary,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${Theme.money(ctx.raw)} (${procPcts[ctx.dataIndex]?.toFixed(1)}%)`,
            },
          },
        },
      },
      plugins: [centerTextPlugin],
    });

    // Build legend
    procLabels.forEach((label, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px';
      row.innerHTML = `
        <span style="width:10px;height:10px;border-radius:50%;background:${Theme.FUNNEL_ARRAY[i]};flex-shrink:0"></span>
        <span style="color:${Theme.COLORS.textSecondary};flex:1">${label}</span>
        <span style="color:${Theme.COLORS.textPrimary};font-weight:600">${Theme.money(procValues[i])}</span>
        <span style="color:${Theme.COLORS.textMuted};font-size:11px">${procPcts[i]?.toFixed(1)}%</span>
      `;
      processorLegend.appendChild(row);
    });
  } else {
    doughnutCanvas.style.display = 'none';
    processorLegend.innerHTML = `<div style="color:${Theme.COLORS.textMuted};text-align:center;padding:40px 0">No processor data available</div>`;
  }

  // ---- Jodi Concentration (Closer Cards) ----
  const concCard = document.createElement('div');
  concCard.className = 'card';
  concCard.style.cssText = 'padding:20px';
  concCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Revenue Concentration by Closer</div>`;

  const closerList = document.createElement('div');
  closerList.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  concCard.appendChild(closerList);
  midGrid.appendChild(concCard);

  if (closers && closers.length > 0) {
    closers.forEach(closer => {
      const pctVal = parseFloat(closer.pct_of_total_revenue) || 0;
      const isRisk = pctVal > 40;
      const rev = parseFloat(closer.total_revenue) || 0;

      const closerCard = document.createElement('div');
      closerCard.style.cssText = `
        padding:14px;
        border-radius:8px;
        background:${Theme.COLORS.bgElevated};
        border:1px solid ${isRisk ? Theme.COLORS.danger : Theme.COLORS.border};
        ${isRisk ? 'box-shadow:0 0 12px rgba(239,68,68,0.15);' : ''}
      `;

      // Name + warning row
      let nameRow = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary}">${_esc(closer.closer)}</span>`;
      if (isRisk) {
        nameRow += `<span style="font-size:11px;font-weight:600;color:${Theme.COLORS.danger};display:flex;align-items:center;gap:4px">
          <span style="font-size:14px">&#9888;</span> Single-point-of-failure risk
        </span>`;
      }
      nameRow += '</div>';

      // Revenue + count
      const statsRow = `<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">
        <span style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.money(rev)}</span>
        <span style="font-size:12px;color:${Theme.COLORS.textMuted}">${closer.enrollment_count || 0} enrollments</span>
      </div>`;

      // Progress bar
      const barColor = isRisk ? Theme.COLORS.danger : Theme.FUNNEL.blue;
      const barRow = `<div style="position:relative;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
        <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(pctVal, 100)}%;background:${barColor};border-radius:4px;transition:width 0.6s ease"></div>
      </div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:4px;text-align:right">${pctVal.toFixed(1)}% of total revenue</div>`;

      closerCard.innerHTML = nameRow + statsRow + barRow;
      closerList.appendChild(closerCard);
    });
  } else {
    closerList.innerHTML = `<div style="color:${Theme.COLORS.textMuted};text-align:center;padding:40px 0">No closer data available</div>`;
  }

  // ======================================================
  // SECTION 5: Churn Absorption (Revenue Protection)
  // ======================================================
  const churnCard = document.createElement('div');
  churnCard.className = 'card';
  churnCard.style.cssText = 'padding:20px;margin-top:16px';
  churnCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Revenue Protection</div>`;

  const churnCanvasId = 'revenue-churn-absorption';
  const churnCanvas = document.createElement('canvas');
  churnCanvas.id = churnCanvasId;
  churnCanvas.style.height = '320px';
  churnCard.appendChild(churnCanvas);

  // Failed payments stat row
  const failedRow = document.createElement('div');
  failedRow.style.cssText = `margin-top:12px;padding:10px 14px;background:${Theme.COLORS.bgElevated};border-radius:6px;display:flex;align-items:center;gap:8px;font-size:13px`;
  churnCard.appendChild(failedRow);
  container.appendChild(churnCard);

  if (churn && churn.length > 0) {
    const churnMonths = churn.map(r => r.month);
    const newRevenue = churn.map(r => parseFloat(r.new_revenue) || 0);
    const refundAmounts = churn.map(r => parseFloat(r.refund_amount) || 0);
    const refundRates = churn.map(r => parseFloat(r.refund_rate) || 0);
    const totalFailed = churn.reduce((sum, r) => sum + (parseInt(r.failed_payments) || 0), 0);

    Theme.createChart(churnCanvasId, {
      type: 'bar',
      data: {
        labels: churnMonths,
        datasets: [
          {
            label: 'New Revenue',
            data: newRevenue,
            backgroundColor: Theme.FUNNEL.green,
            order: 2,
            yAxisID: 'y',
          },
          {
            label: 'Refund Amount',
            data: refundAmounts,
            backgroundColor: Theme.FUNNEL.red,
            order: 2,
            yAxisID: 'y',
          },
          {
            label: 'Refund Rate',
            data: refundRates,
            type: 'line',
            borderColor: Theme.COLORS.warning,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: Theme.COLORS.warning,
            tension: 0.3,
            order: 1,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'y1') return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`;
                return `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            position: 'left',
            ticks: {
              color: Theme.COLORS.textMuted,
              font: { size: 10 },
              callback: (v) => Theme.money(v),
            },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y1: {
            position: 'right',
            ticks: {
              color: Theme.COLORS.warning,
              font: { size: 10 },
              callback: (v) => v.toFixed(1) + '%',
            },
            grid: { display: false },
          },
        },
      },
    });

    failedRow.innerHTML = `
      <span style="color:${Theme.COLORS.danger};font-size:16px">&#9888;</span>
      <span style="color:${Theme.COLORS.textSecondary}">Failed payments (last 12 months):</span>
      <span style="color:${Theme.COLORS.textPrimary};font-weight:600">${totalFailed.toLocaleString()}</span>
    `;
  } else {
    churnCanvas.style.display = 'none';
    failedRow.innerHTML = `<span style="color:${Theme.COLORS.textMuted}">No churn data available</span>`;
  }

  // ======================================================
  // SECTION 6: Monthly Revenue Trend (preserved + enhanced)
  // ======================================================
  const trendGrid = document.createElement('div');
  trendGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(trendGrid);

  // Mobile responsive
  const trendMq = document.createElement('style');
  trendMq.textContent = `@media(max-width:768px){#revenue-trend-grid{grid-template-columns:1fr!important}}`;
  document.head.appendChild(trendMq);
  trendGrid.id = 'revenue-trend-grid';

  // -- Monthly Enrollments with trend line --
  const enrollCard = document.createElement('div');
  enrollCard.className = 'card';
  enrollCard.style.cssText = 'padding:20px';
  enrollCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly Enrollments</div>`;

  const enrollCanvasId = 'revenue-monthly-enrollments';
  const enrollCanvas = document.createElement('canvas');
  enrollCanvas.id = enrollCanvasId;
  enrollCanvas.style.height = '300px';
  enrollCard.appendChild(enrollCanvas);
  trendGrid.appendChild(enrollCard);

  const monthLabels = (monthly || []).map(r => r.month);
  const enrollCounts = (monthly || []).map(r => r.enrollments || 0);

  // Linear trend line
  const n = enrollCounts.length;
  let trendData = [];
  if (n > 1) {
    const sumX = enrollCounts.reduce((a, _, i) => a + i, 0);
    const sumY = enrollCounts.reduce((a, v) => a + v, 0);
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
          label: 'Enrollments',
          data: enrollCounts,
          backgroundColor: Theme.FUNNEL.green,
          order: 2,
          yAxisID: 'y',
        },
        ...(trendData.length ? [{
          label: 'Trend',
          data: trendData,
          type: 'line',
          borderColor: Theme.COLORS.warning,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.3,
          order: 1,
          yAxisID: 'y',
        }] : []),
      ],
    },
    options: {
      responsive: true,
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
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  // -- Monthly Cash Collected (bar) --
  const revenueCard = document.createElement('div');
  revenueCard.className = 'card';
  revenueCard.style.cssText = 'padding:20px';
  revenueCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly Cash Collected</div>`;

  const revenueCanvasId = 'revenue-monthly-cash';
  const revenueCanvas = document.createElement('canvas');
  revenueCanvas.id = revenueCanvasId;
  revenueCanvas.style.height = '300px';
  revenueCard.appendChild(revenueCanvas);
  trendGrid.appendChild(revenueCard);

  const revenueSeries = (monthly || []).map(r => r.revenue || 0);

  Theme.createChart(revenueCanvasId, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Cash Collected',
        data: revenueSeries,
        backgroundColor: Theme.FUNNEL.blue,
      }],
    },
    options: {
      responsive: true,
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
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: {
            color: Theme.COLORS.textMuted,
            font: { size: 10 },
            callback: (v) => Theme.money(v),
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });
});

App.onFilterChange(() => App.navigate('revenue'));

// Helper: escape HTML
function _esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}
