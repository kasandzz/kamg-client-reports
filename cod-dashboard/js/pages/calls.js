/* ============================================
   Calls -- Sales call performance
   Show rate, close rate, closer comparison,
   objection breakdown, no-show cost
   ============================================ */

App.registerPage('calls', async (container) => {
  const days = Filters.getDays();

  let kpiRows, closerRows, objectionRows, monthlyRows;

  try {
    [kpiRows, closerRows, objectionRows, monthlyRows] = await Promise.all([
      API.query('calls', 'default',    { days }),
      API.query('calls', 'closers',    { days }),
      API.query('calls', 'objections', { days }),
      API.query('calls', 'monthly',    { days: 180 }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Calls data: ${err.message}</p></div>`;
    return;
  }

  const kpi = (kpiRows && kpiRows.length > 0) ? kpiRows[0] : {};
  container.innerHTML = '';

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Bookings',      value: kpi.total_bookings || 0, format: 'num',   source: 'GHL calendar (appointment_bookings)', calc: 'COUNT(appointments WHERE status != cancelled)' },
    { label: 'Show Rate',     value: kpi.show_rate      || 0, format: 'pct',   source: 'GHL calendar + Zoom attendance', calc: 'showed / booked' },
    { label: 'Close Rate',    value: kpi.close_rate     || 0, format: 'pct',   source: 'GHL contacts + Hyros sales', calc: 'enrolled / showed' },
    { label: 'Closed / Enrolled', value: kpi.closed     || 0, format: 'num',   source: 'Hyros sales events', calc: 'COUNT(sales WHERE tag = enrolled)' },
    { label: 'No-Shows',      value: kpi.no_shows       || 0, format: 'num',   source: 'GHL calendar (appointment_bookings)', calc: 'COUNT(appointments WHERE status = no_show)' },
    { label: 'No-Show Cost',  value: kpi.no_show_cost   || 0, format: 'money', invertCost: true, source: 'Derived from GHL no-shows', calc: 'no_shows * $877 avg deal value' },
  ]);

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // ---- Chart 1: No-Show Trend (bar + line, dual axis) ----
  const noShowCard = document.createElement('div');
  noShowCard.className = 'card';
  noShowCard.style.cssText = 'padding:20px';
  noShowCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">No-Show Trend</div>`;

  const noShowCanvasId = 'calls-noshow-trend';
  const noShowCanvas   = document.createElement('canvas');
  noShowCanvas.id      = noShowCanvasId;
  noShowCard.appendChild(noShowCanvas);
  grid.appendChild(noShowCard);

  const monthLabels    = (monthlyRows || []).map(r => r.month);
  const noShowCounts   = (monthlyRows || []).map(r => r.no_shows    || 0);
  const noShowCosts    = (monthlyRows || []).map(r => (r.no_shows || 0) * 877);

  Theme.createChart(noShowCanvasId, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label:           'No-Shows',
          data:            noShowCounts,
          backgroundColor: Theme.FUNNEL.red,
          order:           2,
          yAxisID:         'y',
        },
        {
          label:           'No-Show Cost',
          data:            noShowCosts,
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
        datalabels: {
          display: false,
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          position: 'left',
          ticks:    { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: (v) => Theme.num(v) },
          grid:     { color: 'rgba(255,255,255,0.04)' },
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

  // ---- Chart 2: Closer Comparison (Plotly grouped bar) ----
  const closerCard = document.createElement('div');
  closerCard.className = 'card';
  closerCard.style.cssText = 'padding:20px';
  closerCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Closer Comparison</div>`;

  const closerDivId = 'calls-closer-comparison';
  const closerDiv   = document.createElement('div');
  closerDiv.id      = closerDivId;
  closerDiv.style.height = '300px';
  closerCard.appendChild(closerDiv);
  grid.appendChild(closerCard);

  const closers     = (closerRows || []).map(r => r.closer      || 'Unknown');
  const closeRates  = (closerRows || []).map(r => r.close_rate  || 0);
  const callVolumes = (closerRows || []).map(r => r.total_calls || 0);

  Plotly.newPlot(
    closerDivId,
    [
      {
        type:        'bar',
        name:        'Close Rate %',
        x:           closers,
        y:           closeRates,
        marker:      { color: Theme.FUNNEL.teal },
        text:        closeRates.map(v => `${v.toFixed(1)}%`),
        textposition: 'outside',
        yaxis:       'y',
      },
      {
        type:        'bar',
        name:        'Call Volume',
        x:           closers,
        y:           callVolumes,
        marker:      { color: Theme.FUNNEL.blue },
        text:        callVolumes.map(v => String(v)),
        textposition: 'outside',
        yaxis:       'y2',
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      barmode: 'group',
      yaxis:  {
        title:       { text: 'Close Rate %', font: { size: 11, color: Theme.COLORS.textSecondary } },
        tickcolor:   Theme.COLORS.textMuted,
        tickfont:    { size: 10, color: Theme.COLORS.textMuted },
        gridcolor:   'rgba(255,255,255,0.04)',
        side:        'left',
      },
      yaxis2: {
        title:       { text: 'Call Volume', font: { size: 11, color: Theme.COLORS.textSecondary } },
        tickcolor:   Theme.COLORS.textMuted,
        tickfont:    { size: 10, color: Theme.COLORS.textMuted },
        overlaying:  'y',
        side:        'right',
        showgrid:    false,
      },
      margin: { t: 20, b: 60, l: 50, r: 50 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Chart 3: Objection Breakdown (Plotly horizontal bar) ----
  const objCard = document.createElement('div');
  objCard.className = 'card';
  objCard.style.cssText = 'padding:20px';
  objCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Objection Breakdown</div>`;

  const objDivId = 'calls-objection-breakdown';
  const objDiv   = document.createElement('div');
  objDiv.id      = objDivId;
  objDiv.style.height = '300px';
  objCard.appendChild(objDiv);
  grid.appendChild(objCard);

  const objLabels = (objectionRows || []).map(r => r.objection || 'Unknown');
  const objCounts = (objectionRows || []).map(r => r.count     || 0);
  const objColors = objLabels.map((_, i) => Theme.FUNNEL_ARRAY[i % Theme.FUNNEL_ARRAY.length]);

  Plotly.newPlot(
    objDivId,
    [
      {
        type:        'bar',
        orientation: 'h',
        x:           objCounts,
        y:           objLabels,
        marker:      { color: objColors },
        text:        objCounts.map(String),
        textposition: 'outside',
        hovertemplate: '%{y}: %{x}<extra></extra>',
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      xaxis: {
        tickcolor: Theme.COLORS.textMuted,
        tickfont:  { size: 10, color: Theme.COLORS.textMuted },
        gridcolor: 'rgba(255,255,255,0.04)',
      },
      yaxis: {
        tickcolor:  Theme.COLORS.textMuted,
        tickfont:   { size: 10, color: Theme.COLORS.textMuted },
        automargin: true,
      },
      margin: { t: 10, b: 30, l: 140, r: 60 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Chart 4: Booking Pipeline (Chart.js stacked bar) ----
  const pipelineCard = document.createElement('div');
  pipelineCard.className = 'card';
  pipelineCard.style.cssText = 'padding:20px';
  pipelineCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Booking Pipeline</div>`;

  const pipelineCanvasId = 'calls-booking-pipeline';
  const pipelineCanvas   = document.createElement('canvas');
  pipelineCanvas.id      = pipelineCanvasId;
  pipelineCard.appendChild(pipelineCanvas);
  grid.appendChild(pipelineCard);

  const showedCounts    = (monthlyRows || []).map(r => r.showed   || 0);
  const cancelledCounts = (monthlyRows || []).map(r => {
    const total   = r.total    || 0;
    const showed  = r.showed   || 0;
    const noShows = r.no_shows || 0;
    return Math.max(0, total - showed - noShows);
  });

  Theme.createChart(pipelineCanvasId, {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label:           'Showed',
          data:            showedCounts,
          backgroundColor: Theme.FUNNEL.green,
          stack:           'pipeline',
        },
        {
          label:           'No-Show',
          data:            noShowCounts,
          backgroundColor: Theme.FUNNEL.red,
          stack:           'pipeline',
        },
        {
          label:           'Cancelled',
          data:            cancelledCounts,
          backgroundColor: 'rgba(148,163,184,0.35)',
          stack:           'pipeline',
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
            label: (ctx) => `${ctx.dataset.label}: ${Theme.num(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks:   { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:    { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          stacked: true,
          ticks:   { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: (v) => Theme.num(v) },
          grid:    { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });

  // ---- Franzi Section (full-width card) ----
  const franziCard = document.createElement('div');
  franziCard.className = 'card';
  franziCard.style.cssText = 'padding:24px;margin-top:16px';

  const franziRow = (closerRows || []).find(r =>
    r.closer && r.closer.toLowerCase().includes('franzi')
  );

  if (franziRow) {
    const franziShowRate = franziRow.showed > 0 && franziRow.total_calls > 0
      ? ((franziRow.showed / franziRow.total_calls) * 100).toFixed(1)
      : '0.0';

    franziCard.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Franzi (Setter)</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px">
        <div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Bookings Set</div>
          <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.textPrimary};margin-top:4px">${Theme.num(franziRow.total_calls)}</div>
          <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">last ${days} days</div>
        </div>
        <div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Show Rate</div>
          <div style="font-size:28px;font-weight:700;color:${Theme.FUNNEL.teal};margin-top:4px">${franziShowRate}%</div>
          <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">on her bookings</div>
        </div>
        <div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">Showed</div>
          <div style="font-size:28px;font-weight:700;color:${Theme.FUNNEL.green};margin-top:4px">${Theme.num(franziRow.showed)}</div>
          <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">calls held</div>
        </div>
        <div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">No-Shows</div>
          <div style="font-size:28px;font-weight:700;color:${Theme.FUNNEL.red};margin-top:4px">${Theme.num(franziRow.no_shows)}</div>
          <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-top:2px">missed calls</div>
        </div>
      </div>
    `;
  } else {
    franziCard.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Franzi (Setter)</div>
      <p style="color:${Theme.COLORS.textMuted};font-size:13px">Setter tracking not yet isolated in booking data.</p>
    `;
  }

  container.appendChild(franziCard);
});
