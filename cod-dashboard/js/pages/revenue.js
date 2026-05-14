/* ============================================
   Revenue & LTV -- processor breakdown, LTV cohorts,
   closer concentration, churn absorption

   WARN_DATA_UNRESOLVED: all queries on this page hit the 'enrollment'
   namespace flagged in .planning/allnight-data-validity-7day.md
   (Stage 0.5). Treat KPI deltas as directional, not authoritative,
   until the bq-auth follow-up spawn clears the discrepancy.
   ============================================ */

App.registerPage('revenue', async (container) => {
  const days = Filters.getDays();

  // ---- Fetch all data in parallel ----
  // All eight queries below depend on enrollment-namespace BQ sources flagged
  // by Stage 0.5 data validity audit; see top-of-file WARN_DATA_UNRESOLVED.
  let kpi, monthly, pipeline, processors, ltvCohorts, closers, churn, recent;

  try {
    [kpi, monthly, pipeline, processors, ltvCohorts, closers, churn, recent] = await Promise.all([
      API.query('enrollment', 'default', { days }),
      API.query('enrollment', 'monthly', { days: 365 }),
      API.query('enrollment', 'pipeline', { days }),
      API.query('enrollment', 'processorBreakdown', { days }),
      API.query('enrollment', 'ltvCohorts', { months: 12 }),
      API.query('enrollment', 'jodiConcentration', { days }),
      API.query('enrollment', 'churnAbsorption'),
      API.query('enrollment', 'recentEnrollments', { limit: 20 }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Revenue & LTV: ${err.message}</p></div>`;
    return;
  }

  const k = (kpi && kpi.length > 0) ? kpi[0] : {};
  const pip = (pipeline && pipeline.length > 0) ? pipeline[0] : {};
  container.innerHTML = '';

  // ---- Page Header (consistent with attribution.js + ads-meta) ----
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:20px';
  header.innerHTML = `
    <h2 style="font-size:20px;font-weight:700;color:${Theme.COLORS.textPrimary};margin:0 0 4px 0">Revenue & LTV</h2>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted}">Enrollment economics &middot; cash collected, refunds (Stripe + Akari sheet), processor mix, closer concentration, cohort LTV curves</div>
  `;
  container.appendChild(header);

  // ---- Prior period delta (fetch 2x window, compute delta) ----
  let priorKpi = {};
  try {
    const priorData = await API.query('enrollment', 'default', { days: days * 2 });
    if (priorData && priorData.length > 0) priorKpi = priorData[0];
  } catch (_) { /* ignore */ }

  // ======================================================
  // SECTION 1: Revenue KPI Metric Grid (Mode 2 conversion)
  // renderMetricGrid pattern from war-room.js (canonical, Stage 2.5).
  // Was a 6-card KPI strip; now a dense $27 Funnel-style grid with
  // sparkline on the Enrollments card (monthly trend, oldest→newest).
  // Source/calc tooltip context dropped per PRD §2 Mode 2 tradeoff.
  // ======================================================
  const kpiContainer = document.createElement('div');
  kpiContainer.style.marginBottom = '16px';
  container.appendChild(kpiContainer);

  // Monthly enrollments series doubles as sparkline trend for Enrollments card.
  const enrollSpark = (monthly || []).map(r => Number(r.enrollments || 0));

  function _buildRevenueMetrics(curK, prevK, curPip) {
    const cur = curK || {};
    const prev = prevK || {};
    const pipNow = curPip || {};
    // priorK comes from the 2x-window query; subtract current to get prior-period-only values.
    const _priorCash = (prev.cash_collected || 0) - (cur.cash_collected || 0);
    const _priorEnrolled = (prev.total_enrolled || 0) - (cur.total_enrolled || 0);
    const _priorSpend = (prev.total_spend || 0) - (cur.total_spend || 0);
    const _priorRoas = _priorSpend > 0 ? _priorCash / _priorSpend : 0;
    return [
      { label: 'Enrollments',         value: cur.total_enrolled,            prevValue: _priorEnrolled > 0 ? _priorEnrolled : undefined, format: 'num',    sparklineData: enrollSpark },
      { label: 'Cash Collected',      value: cur.cash_collected,            prevValue: _priorCash     > 0 ? _priorCash     : undefined, format: 'money'  },
      { label: 'ROAS (Cash)',         value: cur.roas,                      prevValue: _priorRoas     > 0 ? _priorRoas     : undefined, format: 'roas'   },
      { label: 'Avg Deal Size',       value: cur.avg_deal_size,                                                                          format: 'money'  },
      { label: 'Refund Rate',         value: cur.refund_rate,                                                                            format: 'pctRaw', invertDelta: true },
      { label: 'Ticket-to-Enrollment',value: pipNow.ticket_to_enrollment_rate,                                                           format: 'pctRaw' },
    ];
  }

  Components.renderMetricGrid(kpiContainer, _buildRevenueMetrics(k, priorKpi, pip));

  // SWR cache-refresh wiring (Stage 2 deferred follow-up #3 for revenue).
  // When api.js detects a row-count delta from background live fetch on the
  // enrollment.default query, re-fetch and re-render the KPI grid only.
  // priorKpi (2x-window) and pip stay closure-stable; their own SWR refresh
  // will be the next event. AbortController prevents listener accumulation
  // across re-renders triggered by filter changes (App.onFilterChange).
  if (container._cacheRefreshController) {
    try { container._cacheRefreshController.abort(); } catch (e) { /* noop */ }
  }
  container._cacheRefreshController = new AbortController();
  window.addEventListener('cache-refresh', function (e) {
    if (!e || !e.detail || e.detail.page !== 'enrollment' || e.detail.queryName !== 'default') return;
    API.query('enrollment', 'default', { days: days }).then(function (rows) {
      if (!rows || rows.length === 0) return;
      Components.renderMetricGrid(kpiContainer, _buildRevenueMetrics(rows[0] || {}, priorKpi, pip));
    }).catch(function () { /* swallow; live fetch already failed once */ });
  }, { signal: container._cacheRefreshController.signal });

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
    // Empty-state polish: structured copy instead of a single dim line.
    // Triggered when ltvCohorts query returns []; common when the window has
    // fewer than 30 days of post-enrollment runway (no cohort can age to 30d).
    heatmapDiv.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:24px;gap:6px">
        <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary}">No LTV cohorts in the selected range</div>
        <div style="font-size:12px;color:${Theme.COLORS.textMuted};max-width:360px;line-height:1.5">
          Cohorts need at least 30 days of post-enrollment runway to surface here.
          Try expanding the date filter, or check back after the next cohort matures.
        </div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:6px;font-family:JetBrains Mono,monospace">enrollment.ltvCohorts · months=12</div>
      </div>`;
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

    Components.lazyChart(doughnutId, () => {
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

    Components.lazyChart(churnCanvasId, () => {
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

  Components.lazyChart(enrollCanvasId, () => {
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

  Components.lazyChart(revenueCanvasId, () => {
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

  // ======================================================
  // SECTION: Recent Enrollments (last 20)
  // ======================================================
  const recentSection = document.createElement('div');
  recentSection.style.cssText = 'margin-top:24px';
  container.appendChild(recentSection);

  // Classify each row into tickets vs enrollments.
  // Heuristic: description match for "Event Registration" / "Ticket" / "Workshop" -> ticket;
  // otherwise enrollment. Pure amount-based fallback when description missing.
  function _classifyRecent(r) {
    var desc = String(r && r.description || '').toLowerCase();
    if (/event registration|ticket|workshop|vip/.test(desc)) return 'ticket';
    if (r && Number(r.amount) >= 1000) return 'enrollment';
    return 'ticket';
  }
  var _recentAll = Array.isArray(recent) ? recent.slice() : [];
  _recentAll.forEach(function (r) { r._classification = _classifyRecent(r); });
  var _ticketCount = _recentAll.filter(function (r) { return r._classification === 'ticket'; }).length;
  var _enrollCount = _recentAll.filter(function (r) { return r._classification === 'enrollment'; }).length;
  var _recentFilter = 'all'; // 'all' | 'ticket' | 'enrollment'

  const recentHeader = document.createElement('div');
  recentHeader.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:12px';
  recentHeader.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Recent Enrollments</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Last 20 high-ticket transactions ($100+) across all processors. Live from Stripe.</div>
      <div id="recent-filter-pills" style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"></div>
    </div>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};padding:4px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.06)">
      <span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px"></span>BQ: v_stripe_clean
    </div>
  `;
  recentSection.appendChild(recentHeader);

  const recentCard = document.createElement('div');
  recentCard.className = 'card';
  recentCard.style.cssText = 'padding:0;overflow-x:auto';
  recentSection.appendChild(recentCard);

  function _renderRecentPills() {
    var host = document.getElementById('recent-filter-pills');
    if (!host) return;
    var pills = [
      { key: 'all',        label: 'All',         count: _recentAll.length },
      { key: 'ticket',     label: 'Tickets',     count: _ticketCount },
      { key: 'enrollment', label: 'Enrollments', count: _enrollCount }
    ];
    host.innerHTML = pills.map(function (p) {
      var active = p.key === _recentFilter;
      var bg = active ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)';
      var border = active ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)';
      var color = active ? '#c4b5fd' : Theme.COLORS.textMuted;
      return '<button data-key="' + p.key + '" class="recent-pill" style="cursor:pointer;padding:5px 12px;border-radius:20px;border:' + border + ';background:' + bg + ';color:' + color + ';font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-family:inherit">' +
        p.label + ' <span style="opacity:0.7;margin-left:4px">' + p.count + '</span>' +
      '</button>';
    }).join('');
    host.querySelectorAll('.recent-pill').forEach(function (b) {
      b.addEventListener('click', function () {
        _recentFilter = this.dataset.key;
        _renderRecentPills();
        _renderRecentTable();
      });
    });
  }

  function _renderRecentTable() {
    var rows = _recentFilter === 'all'
      ? _recentAll
      : _recentAll.filter(function (r) { return r._classification === _recentFilter; });

    if (!rows || rows.length === 0) {
      recentCard.style.padding = '24px';
      recentCard.innerHTML = '<div class="text-muted" style="text-align:center">No rows match the selected filter.</div>';
      return;
    }
    recentCard.style.padding = '0';
    _renderRecentTableHTML(rows);
  }

  function _renderRecentTableHTML(rows) {
    var recent = rows;
    {
    function _processorBadge(p) {
      const colors = {
        'Stripe':       { bg: 'rgba(99,102,241,0.15)', fg: '#818cf8' },
        'Authorize.net':{ bg: 'rgba(34,197,94,0.15)',  fg: '#4ade80' },
        'PayPal':       { bg: 'rgba(6,182,212,0.15)',  fg: '#22d3ee' },
        'Fanbasis':     { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' }
      };
      const c = colors[p] || { bg: 'rgba(255,255,255,0.06)', fg: Theme.COLORS.textMuted };
      return `<span style="background:${c.bg};color:${c.fg};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em">${_esc(p)}</span>`;
    }

    let html = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02)">
            <th style="text-align:left;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">When (CDMX)</th>
            <th style="text-align:left;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Customer</th>
            <th style="text-align:left;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Email</th>
            <th style="text-align:right;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Amount</th>
            <th style="text-align:left;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Processor</th>
            <th style="text-align:left;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Card / Country</th>
            <th style="text-align:left;padding:10px 12px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Description</th>
          </tr>
        </thead>
        <tbody>
    `;
    recent.forEach((r, i) => {
      const altBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      const cardBrand = r.card_brand && r.card_brand !== 'n/a' ? r.card_brand.toUpperCase() : '';
      const country = r.country && r.country !== 'n/a' ? r.country : '';
      const cardCountry = [cardBrand, country].filter(Boolean).join(' · ') || '–';
      html += `
        <tr style="background:${altBg};border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="padding:10px 12px;color:${Theme.COLORS.textSecondary};white-space:nowrap;font-variant-numeric:tabular-nums">${_esc(r.enrolled_at_cdmx)}</td>
          <td style="padding:10px 12px;color:${Theme.COLORS.textPrimary};font-weight:500">${_esc(r.customer_name)}</td>
          <td style="padding:10px 12px;color:${Theme.COLORS.textSecondary};font-family:JetBrains Mono,monospace;font-size:11px">${_esc(r.email)}</td>
          <td style="padding:10px 12px;text-align:right;color:${Theme.COLORS.textPrimary};font-weight:600;font-variant-numeric:tabular-nums">${Theme.money(Number(r.amount) || 0)}</td>
          <td style="padding:10px 12px">${_processorBadge(r.processor)}</td>
          <td style="padding:10px 12px;color:${Theme.COLORS.textMuted};font-size:11px">${_esc(cardCountry)}</td>
          <td style="padding:10px 12px;color:${Theme.COLORS.textSecondary};font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(r.description)}">${_esc(r.description || '')}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    recentCard.innerHTML = html;
  }
  } // close _renderRecentTableHTML

  _renderRecentPills();
  _renderRecentTable();
});

// Filter-change handled centrally by shell.js Filters.onChange.
// App.onFilterChange does not exist as a function; guard prevents TypeError.
if (typeof App !== 'undefined' && App.onFilterChange) { App.onFilterChange(() => App.navigate('revenue')); }

// Helper: escape HTML
function _esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}
