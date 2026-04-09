/* ============================================
   Sales Team -- Closer performance dashboard
   Close rate, show rate, monthly trends,
   heatmap. Colby excluded from active tracking.
   ============================================ */

App.registerPage('sales-team', async (container) => {
  const days = Filters.getDays();

  let defaultRows, monthlyRows;

  try {
    [defaultRows, monthlyRows] = await Promise.all([
      API.query('sales-team', 'default', { days }),
      API.query('sales-team', 'monthly', { days: 180 }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Sales Team data: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  const rows = defaultRows || [];

  // ---- KPI Strip ----
  const totalClosers  = rows.length;
  const avgCloseRate  = rows.length
    ? rows.reduce((s, r) => s + (parseFloat(r.close_rate) || 0), 0) / rows.length
    : 0;
  const bestCloser    = rows.length ? rows[0].closer : '--';
  const totalCalls    = rows.reduce((s, r) => s + (parseInt(r.total_calls) || 0), 0);
  const totalEnrolled = rows.reduce((s, r) => s + (parseInt(r.closed) || 0), 0);
  const avgShowRate   = rows.length
    ? rows.reduce((s, r) => s + (parseFloat(r.show_rate) || 0), 0) / rows.length
    : 0;

  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Closers',   value: totalClosers,  format: 'num',  source: 'BQ ghl_contacts (closer field)', calc: 'COUNT(DISTINCT closer WHERE active = true)' },
    { label: 'Avg Close Rate',  value: avgCloseRate,  format: 'pct',  source: 'BQ ghl_contacts + hyros_sales', calc: 'AVG(enrolled / showed) GROUP BY closer' },
    { label: 'Best Closer',     value: bestCloser,    format: 'text', source: 'BQ ghl_contacts + hyros_sales', calc: 'closer WHERE close_rate = MAX(close_rate)' },
    { label: 'Total Calls',     value: totalCalls,    format: 'num',  source: 'BQ ghl_appointments', calc: 'COUNT(appointments WHERE closer IS NOT NULL AND status = completed)' },
    { label: 'Total Enrolled',  value: totalEnrolled, format: 'num',  source: 'BQ hyros_sales', calc: 'COUNT(sales) WHERE tag = enrolled' },
    { label: 'Avg Show Rate',   value: avgShowRate,   format: 'pct',  source: 'BQ ghl_appointments + zoom_attendance', calc: 'AVG(showed / booked) GROUP BY closer' },
  ]);

  // ---- Closer Cards ----
  const cardsSection = document.createElement('div');
  cardsSection.style.cssText = 'margin-top:16px';

  const cardsHeader = document.createElement('div');
  cardsHeader.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px';
  cardsHeader.textContent = 'Closer Performance';
  cardsSection.appendChild(cardsHeader);

  const cardsGrid = document.createElement('div');
  cardsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px';

  rows.forEach(r => {
    const closeRate = parseFloat(r.close_rate) || 0;
    const showRate  = parseFloat(r.show_rate)  || 0;
    const isColby   = /colby/i.test(r.closer || '');

    const rateColor = closeRate >= 20
      ? 'var(--color-green, #22c55e)'
      : closeRate >= 10
        ? 'var(--color-amber, #f59e0b)'
        : 'var(--color-red, #ef4444)';

    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:18px 20px;position:relative';

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:15px;font-weight:700;color:var(--text-primary)">${r.closer || 'Unknown'}</div>
        ${isColby ? `<span style="
          font-size:10px;
          font-weight:600;
          color:var(--text-muted);
          background:var(--bg-secondary);
          border:1px solid var(--border-subtle);
          border-radius:4px;
          padding:2px 8px;
          letter-spacing:.04em;
        ">Inactive</span>` : ''}
      </div>
      <div style="font-size:32px;font-weight:700;color:${rateColor};margin-bottom:14px;line-height:1">
        ${Theme.pct(closeRate)}
        <span style="font-size:12px;font-weight:500;color:var(--text-muted);margin-left:4px">close rate</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--text-primary)">${Theme.num(parseInt(r.total_calls) || 0)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Calls</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--text-primary)">${Theme.num(parseInt(r.showed) || 0)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Showed</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--color-green,#22c55e)">${Theme.num(parseInt(r.closed) || 0)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Closed</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--color-red,#ef4444)">${Theme.num(parseInt(r.no_shows) || 0)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">No-Shows</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="font-size:11px;color:var(--text-muted)">Show rate:</div>
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary)">${Theme.pct(showRate)}</div>
      </div>
    `;

    cardsGrid.appendChild(card);
  });

  if (rows.length === 0) {
    cardsGrid.innerHTML = `<div class="card" style="padding:24px;color:var(--text-muted);font-size:13px">No closer data found for this period.</div>`;
  }

  cardsSection.appendChild(cardsGrid);
  container.appendChild(cardsSection);

  // ---- Monthly Close Rate Chart ----
  const monthlyData = monthlyRows || [];

  // Build closer -> month -> close_rate map
  const closerSet = [...new Set(monthlyData.map(r => r.closer))].sort();
  const monthSet  = [...new Set(monthlyData.map(r => r.month))].sort();

  const rateMap = {};
  monthlyData.forEach(r => {
    if (!rateMap[r.closer]) rateMap[r.closer] = {};
    rateMap[r.closer][r.month] = parseFloat(r.close_rate) || 0;
  });

  const lineCard = document.createElement('div');
  lineCard.className = 'card';
  lineCard.style.cssText = 'padding:20px;margin-top:16px';
  lineCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Monthly Close Rate by Closer</div>
    <canvas id="sales-team-monthly-chart" style="max-height:350px"></canvas>
  `;
  container.appendChild(lineCard);

  const lineDatasets = closerSet.map((closer, i) => ({
    label:           closer,
    data:            monthSet.map(m => rateMap[closer]?.[m] ?? null),
    borderColor:     Theme.FUNNEL_ARRAY[i % Theme.FUNNEL_ARRAY.length],
    backgroundColor: 'transparent',
    borderWidth:     2,
    pointRadius:     3,
    pointHoverRadius: 5,
    tension:         0.3,
    spanGaps:        true,
  }));

  Theme.createChart('sales-team-monthly-chart', {
    type: 'line',
    data: { labels: monthSet, datasets: lineDatasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display:  true,
          position: 'top',
          labels:   { color: Theme.COLORS.textSecondary, font: { size: 11 }, boxWidth: 14 },
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + '%' : 'N/A'}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 11 } },
          grid:  { color: Theme.COLORS.borderSubtle },
        },
        y: {
          ticks: {
            color:    Theme.COLORS.textMuted,
            font:     { size: 11 },
            callback: v => v + '%',
          },
          grid:    { color: Theme.COLORS.borderSubtle },
          min:     0,
        },
      },
    },
  });

  // ---- Team Heatmap (Plotly) ----
  if (closerSet.length > 0 && monthSet.length > 0) {
    const heatmapCard = document.createElement('div');
    heatmapCard.className = 'card';
    heatmapCard.style.cssText = 'padding:20px;margin-top:16px';
    heatmapCard.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Close Rate Heatmap</div>
      <div id="sales-team-heatmap"></div>
    `;
    container.appendChild(heatmapCard);

    // Build z matrix: rows = closers, cols = months
    const zMatrix = closerSet.map(closer =>
      monthSet.map(m => rateMap[closer]?.[m] ?? null)
    );

    const heatmapTrace = {
      type:        'heatmap',
      x:           monthSet,
      y:           closerSet,
      z:           zMatrix,
      colorscale:  [
        [0,   '#ef4444'],
        [0.5, '#f59e0b'],
        [1,   '#22c55e'],
      ],
      zmin:        0,
      zmax:        40,
      hoverongaps: false,
      hovertemplate: '<b>%{y}</b><br>%{x}: %{z:.1f}%<extra></extra>',
      colorbar: {
        title:      { text: 'Close %', font: { color: Theme.COLORS.textSecondary, size: 11 } },
        ticksuffix: '%',
        tickfont:   { color: Theme.COLORS.textMuted, size: 10 },
        len:        0.8,
      },
    };

    const heatmapLayout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
      height: Math.max(200, closerSet.length * 60 + 80),
      margin: { t: 20, r: 80, b: 60, l: 120 },
      xaxis: Object.assign({}, Theme.PLOTLY_LAYOUT.xaxis || {}, {
        tickfont: { color: Theme.COLORS.textMuted, size: 11 },
      }),
      yaxis: Object.assign({}, Theme.PLOTLY_LAYOUT.yaxis || {}, {
        tickfont: { color: Theme.COLORS.textMuted, size: 11 },
        automargin: true,
      }),
    });

    Plotly.newPlot('sales-team-heatmap', [heatmapTrace], heatmapLayout, Theme.PLOTLY_CONFIG);
  }
});
