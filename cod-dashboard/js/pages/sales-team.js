/* ============================================
   Sales Team -- all 9 Russ metrics at team +
   per-rep level, funnel source breakdown,
   revenue by closer, monthly trends
   ============================================ */

App.registerPage('sales-team', async (container) => {
  const days = Filters.getDays();

  let teamTotals, perRepRows, funnelSourceRows, monthlyRows;
  try {
    [teamTotals, perRepRows, funnelSourceRows, monthlyRows] = await Promise.all([
      API.query('sales-team', 'default', { days }),
      API.query('sales-team', 'perRep', { days }),
      API.query('sales-team', 'funnelSource', { days }),
      API.query('sales-team', 'monthly', { days: 180 }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Sales Team: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';
  const t = (teamTotals && teamTotals.length > 0) ? teamTotals[0] : {};

  // ---- Section 1: Team KPI Strip ----
  const kpiEl = document.createElement('div');
  container.appendChild(kpiEl);
  Components.renderKPIStrip(kpiEl, [
    { label: 'Calls Booked',   value: t.calls_booked || 0,   format: 'num' },
    { label: 'Calls Taken',    value: t.calls_taken || 0,    format: 'num' },
    { label: 'Enrollments',    value: t.enrollments || 0,    format: 'num' },
    { label: 'DPL',            value: t.dpl || 0,            format: 'money' },
    { label: 'Total Cash',     value: t.total_cash || 0,     format: 'money' },
    { label: 'Total Contracts', value: t.total_contracts || 0, format: 'money' },
    { label: 'Ad Spend',       value: t.ad_spend || 0,       format: 'money' },
    { label: 'CAC',            value: t.cac || 0,            format: 'money' },
    { label: 'ROAS',           value: (t.roas || 0).toFixed(2) + 'x', format: 'text' },
  ]);

  // ---- Section 2: Calls by Funnel Source -- Stacked Bar ----
  const funnelSection = document.createElement('div');
  funnelSection.style.cssText = 'margin-top:32px';
  funnelSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Calls Booked by Funnel Source</h3>`;
  container.appendChild(funnelSection);

  const funnelCard = document.createElement('div');
  funnelCard.className = 'card';
  funnelCard.style.cssText = 'padding:20px';
  const funnelCanvas = document.createElement('canvas');
  funnelCanvas.id = 'sales-funnel-source-chart';
  funnelCanvas.style.height = '300px';
  funnelCard.appendChild(funnelCanvas);
  funnelSection.appendChild(funnelCard);

  const fsRows = funnelSourceRows || [];
  const closers = [...new Set(fsRows.map(r => r.closer))];
  const funnelSources = ['$27', 'MA-VSL', 'Organic', 'Franzi', 'Other'];
  const funnelColors = { '$27': '#06b6d4', 'MA-VSL': '#a855f7', 'Organic': '#22c55e', 'Franzi': '#eab308', 'Other': '#6b7280' };

  const funnelDatasets = funnelSources.map(src => ({
    label: src,
    data: closers.map(c => {
      const row = fsRows.find(r => r.closer === c && r.funnel_source === src);
      return row ? (row.calls_booked || 0) : 0;
    }),
    backgroundColor: funnelColors[src],
    borderRadius: 3,
  }));

  Theme.createChart('sales-funnel-source-chart', {
    type: 'bar',
    data: { labels: closers, datasets: funnelDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
      },
      scales: {
        x: { stacked: true, ticks: { color: Theme.COLORS.textMuted, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { stacked: true, ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  // ---- Section 3: Per-Rep Comparison Table (sortable) ----
  const tableSection = document.createElement('div');
  tableSection.style.cssText = 'margin-top:32px';
  tableSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Per-Rep Performance</h3>`;
  container.appendChild(tableSection);

  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  tableCard.style.cssText = 'padding:20px;overflow-x:auto';
  tableSection.appendChild(tableCard);

  const reps = perRepRows || [];
  const columns = [
    { key: 'closer',         label: 'Closer',     align: 'left',  fmt: v => v || 'Unknown' },
    { key: 'calls_booked',   label: 'Booked',     align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'calls_taken',    label: 'Taken',       align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'show_rate',      label: 'Show%',       align: 'right', fmt: v => (v || 0).toFixed(1) + '%' },
    { key: 'close_rate',     label: 'Close%',      align: 'right', fmt: v => (v || 0).toFixed(1) + '%' },
    { key: 'dpl',            label: 'DPL',         align: 'right', fmt: v => Theme.money(v || 0) },
    { key: 'total_cash',     label: 'Cash',        align: 'right', fmt: v => Theme.money(v || 0) },
    { key: 'total_contracts', label: 'Contracts',  align: 'right', fmt: v => Theme.money(v || 0) },
    { key: 'cac',            label: 'CAC',         align: 'right', fmt: v => Theme.money(v || 0) },
    { key: 'roas',           label: 'ROAS',        align: 'right', fmt: v => (v || 0).toFixed(2) + 'x' },
  ];

  let sortKey = 'total_cash';
  let sortAsc = false;

  function findBest(col) {
    if (col.key === 'closer' || col.key === 'cac') return null;
    let best = null, bestVal = col.key === 'cac' ? Infinity : -Infinity;
    reps.forEach(r => {
      const v = parseFloat(r[col.key]) || 0;
      if (col.key === 'cac' ? v < bestVal : v > bestVal) { bestVal = v; best = r.closer; }
    });
    return best;
  }

  function renderTable() {
    const sorted = [...reps].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortAsc ? (av || '').localeCompare(bv || '') : (bv || '').localeCompare(av || '');
      return sortAsc ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });

    const bests = {};
    columns.forEach(c => { bests[c.key] = findBest(c); });

    let html = `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>`;
    columns.forEach(c => {
      const arrow = sortKey === c.key ? (sortAsc ? ' &#9650;' : ' &#9660;') : '';
      html += `<th data-sort="${c.key}" style="text-align:${c.align};padding:8px 10px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;user-select:none;white-space:nowrap">${c.label}${arrow}</th>`;
    });
    html += '</tr></thead><tbody>';
    sorted.forEach(r => {
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">';
      columns.forEach(c => {
        const isBest = bests[c.key] === r.closer;
        const bg = isBest ? 'background:rgba(34,197,94,0.08);' : '';
        html += `<td style="padding:8px 10px;text-align:${c.align};${bg}color:${c.key === 'closer' ? Theme.COLORS.textPrimary : Theme.COLORS.textSecondary};white-space:nowrap">${c.fmt(r[c.key])}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    tableCard.innerHTML = html;

    tableCard.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const newKey = th.dataset.sort;
        if (sortKey === newKey) sortAsc = !sortAsc;
        else { sortKey = newKey; sortAsc = false; }
        renderTable();
      });
    });
  }
  renderTable();

  // ---- Section 4: Revenue by Closer -- Horizontal Bar ----
  const revSection = document.createElement('div');
  revSection.style.cssText = 'margin-top:32px';
  revSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Revenue by Closer</h3>`;
  container.appendChild(revSection);

  const revCard = document.createElement('div');
  revCard.className = 'card';
  revCard.style.cssText = 'padding:20px';
  const revCanvas = document.createElement('canvas');
  revCanvas.id = 'sales-rev-by-closer';
  revCanvas.style.height = Math.max(200, reps.length * 40) + 'px';
  revCard.appendChild(revCanvas);
  revSection.appendChild(revCard);

  const sortedByRev = [...reps].sort((a, b) => (b.total_cash || 0) - (a.total_cash || 0));
  Theme.createChart('sales-rev-by-closer', {
    type: 'bar',
    data: {
      labels: sortedByRev.map(r => r.closer || 'Unknown'),
      datasets: [{
        label: 'Revenue',
        data: sortedByRev.map(r => r.total_cash || 0),
        backgroundColor: '#6c5ce7',
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => Theme.money(ctx.parsed.x) } },
      },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: v => Theme.money(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: Theme.COLORS.textPrimary, font: { size: 11 } }, grid: { display: false } },
      },
    },
  });

  // ---- Section 5: Monthly Close Rate Trends ----
  const trendSection = document.createElement('div');
  trendSection.style.cssText = 'margin-top:32px';
  trendSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Close Rate Trends (6 Months)</h3>`;
  container.appendChild(trendSection);

  const trendCard = document.createElement('div');
  trendCard.className = 'card';
  trendCard.style.cssText = 'padding:20px';
  const trendCanvas = document.createElement('canvas');
  trendCanvas.id = 'sales-monthly-trends';
  trendCanvas.style.height = '300px';
  trendCard.appendChild(trendCanvas);
  trendSection.appendChild(trendCard);

  const mRows = monthlyRows || [];
  const months = [...new Set(mRows.map(r => r.month))].sort();
  const trendClosers = [...new Set(mRows.map(r => r.closer))];
  const trendColors = ['#06b6d4', '#a855f7', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#6b7280'];

  const trendDatasets = trendClosers.map((c, i) => ({
    label: c,
    data: months.map(m => {
      const row = mRows.find(r => r.closer === c && r.month === m);
      return row ? (row.close_rate || 0) : null;
    }),
    borderColor: trendColors[i % trendColors.length],
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.3,
    spanGaps: true,
  }));

  Theme.createChart('sales-monthly-trends', {
    type: 'line',
    data: { labels: months, datasets: trendDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y || 0).toFixed(1)}%` } },
      },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Close Rate %', color: Theme.COLORS.textMuted, font: { size: 10 } },
        },
      },
    },
  });
});

App.onFilterChange(() => App.navigate('sales-team'));
