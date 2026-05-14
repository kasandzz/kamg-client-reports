/* ============================================
   Sales Team -- all 9 Russ metrics at team +
   per-rep level, funnel source breakdown,
   revenue by closer, monthly trends
   ============================================ */

App.registerPage('sales-team', async (container) => {
  const days = Filters.getDays();

  let teamTotals, perRepRows, funnelSourceRows, monthlyRows, objectionRows, noShowCostRows, dowRows;
  try {
    [teamTotals, perRepRows, funnelSourceRows, monthlyRows, objectionRows, noShowCostRows, dowRows] = await Promise.all([
      API.query('sales-team', 'default', { days }),
      API.query('sales-team', 'perRep', { days }),
      API.query('sales-team', 'funnelSource', { days }),
      API.query('sales-team', 'monthly', { days: 180 }),
      API.query('sales-team', 'objections', { days: 60 }).catch(() => []),
      API.query('sales-team', 'noShowCost', { days }).catch(() => []),
      API.query('sales-team', 'dowCloseRate', { days: 90 }).catch(() => []),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Sales Team: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';
  const t = (teamTotals && teamTotals.length > 0) ? teamTotals[0] : {};

  // ---- Prior period delta (fetch 2x window, compute delta) ----
  // Counts (booked/taken/enrollments/cash/contracts/ad_spend) subtract cleanly;
  // rate fields (dpl/cac/roas) accept the 2x-window aggregate as approximate
  // prior — same tradeoff as ads-meta.js / journey-explorer.js Stage 3.
  let priorTeam = {};
  try {
    const priorData = await API.query('sales-team', 'default', { days: days * 2 });
    if (priorData && priorData.length > 0) priorTeam = priorData[0];
  } catch (_) { /* ignore */ }

  // ---- Section 1: Team KPI Metric Grid (Mode 2 conversion) ----
  // renderMetricGrid pattern from war-room.js (canonical, Stage 2.5). Was a
  // 9-card KPI strip; now a dense $27 Funnel-style grid. ROAS now formats as
  // "Nx" via `roas` instead of pre-formatted text. Cost metrics (Ad Spend, CAC)
  // carry invertDelta so increases render in danger red.
  const kpiEl = document.createElement('div');
  kpiEl.style.marginBottom = '16px';
  container.appendChild(kpiEl);

  function _buildSalesTeamMetrics(cur, prev) {
    const c = cur || {};
    const p = prev || {};
    // priorTeam comes from 2x-window query — subtract current to get prior-only counts.
    const _priorBooked   = (p.calls_booked   || 0) - (c.calls_booked   || 0);
    const _priorTaken    = (p.calls_taken    || 0) - (c.calls_taken    || 0);
    const _priorEnroll   = (p.enrollments    || 0) - (c.enrollments    || 0);
    const _priorCash     = (p.total_cash     || 0) - (c.total_cash     || 0);
    const _priorContract = (p.total_contracts|| 0) - (c.total_contracts|| 0);
    const _priorSpend    = (p.ad_spend       || 0) - (c.ad_spend       || 0);
    return [
      { label: 'Calls Booked',    value: c.calls_booked,    prevValue: _priorBooked   > 0 ? _priorBooked   : undefined, format: 'num'   },
      { label: 'Calls Taken',     value: c.calls_taken,     prevValue: _priorTaken    > 0 ? _priorTaken    : undefined, format: 'num'   },
      { label: 'Enrollments',     value: c.enrollments,     prevValue: _priorEnroll   > 0 ? _priorEnroll   : undefined, format: 'num'   },
      { label: 'DPL',             value: c.dpl,             prevValue: p.dpl,                                            format: 'money' },
      { label: 'Total Cash',      value: c.total_cash,      prevValue: _priorCash     > 0 ? _priorCash     : undefined, format: 'money' },
      { label: 'Total Contracts', value: c.total_contracts, prevValue: _priorContract > 0 ? _priorContract : undefined, format: 'money' },
      { label: 'Ad Spend',        value: c.ad_spend,        prevValue: _priorSpend    > 0 ? _priorSpend    : undefined, format: 'money', invertDelta: true },
      { label: 'CAC',             value: c.cac,             prevValue: p.cac,                                            format: 'money', invertDelta: true },
      { label: 'ROAS',            value: c.roas,            prevValue: p.roas,                                           format: 'roas'  },
    ];
  }

  Components.renderMetricGrid(kpiEl, _buildSalesTeamMetrics(t, priorTeam));

  // SWR cache-refresh wiring (Stage 2 follow-up #3 — extending pattern from
  // top 6 pages to mid 6). When api.js detects row-count delta from background
  // live fetch on sales-team.default, re-fetch and re-render the KPI grid only.
  // priorTeam (2x-window) stays closure-stable; its own SWR refresh is the
  // next event. AbortController prevents listener accumulation across re-
  // renders triggered by App.onFilterChange.
  if (container._cacheRefreshController) {
    try { container._cacheRefreshController.abort(); } catch (e) { /* noop */ }
  }
  container._cacheRefreshController = new AbortController();
  window.addEventListener('cache-refresh', function (e) {
    if (!e || !e.detail || e.detail.page !== 'sales-team' || e.detail.queryName !== 'default') return;
    API.query('sales-team', 'default', { days: days }).then(function (rows) {
      if (!rows || rows.length === 0) return;
      Components.renderMetricGrid(kpiEl, _buildSalesTeamMetrics(rows[0] || {}, priorTeam));
    }).catch(function () { /* swallow; live fetch already failed once */ });
  }, { signal: container._cacheRefreshController.signal });

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

  // Highlight the best closer per metric. CAC is lowest-is-best (efficiency);
  // every other numeric column is highest-is-best. The previous version early-
  // returned for col.key === 'cac', so the most-efficient closer was never
  // green-highlighted on the CAC column even though the comparison logic was
  // already in place — a real visibility bug for the "who's getting cheap
  // enrollments" question at standup. Zero/missing values are filtered out so
  // a closer with no spend isn't crowned as the most-efficient.
  function findBest(col) {
    if (col.key === 'closer') return null;
    const lowerIsBetter = col.key === 'cac';
    let best = null, bestVal = lowerIsBetter ? Infinity : -Infinity;
    reps.forEach(r => {
      const raw = parseFloat(r[col.key]);
      if (!Number.isFinite(raw) || raw === 0) return; // skip missing/zero so they don't win
      if (lowerIsBetter ? raw < bestVal : raw > bestVal) { bestVal = raw; best = r.closer; }
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
  Components.lazyChart('sales-rev-by-closer', () => {
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

  Components.lazyChart('sales-monthly-trends', () => {
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
  // ---- Section 6: No-Show Cost + Objection Donut (split row) ----
  const splitRow = document.createElement('div');
  splitRow.style.cssText = 'margin-top:32px;display:grid;grid-template-columns:1fr 1.2fr;gap:20px';
  container.appendChild(splitRow);

  // No-Show Cost stat card
  const ns = (noShowCostRows && noShowCostRows.length > 0) ? noShowCostRows[0] : {};
  const noShowCard = document.createElement('div');
  noShowCard.className = 'card';
  noShowCard.style.cssText = 'padding:24px';
  const lostCash = parseFloat(ns.expected_lost_cash) || 0;
  const noShowCount = parseInt(ns.no_show_count) || 0;
  const noShowRate = parseFloat(ns.no_show_rate) || 0;
  const avgDeal = parseFloat(ns.avg_deal_value) || 0;
  const closeRateDec = parseFloat(ns.close_rate_decimal) || 0;
  noShowCard.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">No-Show Cost &middot; ${days}d</div>
    <div style="font-family:'Manrope',sans-serif;font-size:42px;font-weight:800;color:#ef4444;line-height:1;margin-bottom:6px">${Theme.money(lostCash)}</div>
    <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-bottom:20px">Expected revenue if no-shows had taken the call</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:11px">
      <div style="padding:10px 12px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px">
        <div style="color:${Theme.COLORS.textMuted};margin-bottom:2px">No-Shows</div>
        <div style="color:#ef4444;font-weight:700;font-size:16px">${noShowCount}</div>
        <div style="color:${Theme.COLORS.textMuted};font-size:10px;margin-top:2px">${noShowRate.toFixed(1)}% of calls</div>
      </div>
      <div style="padding:10px 12px;background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.15);border-radius:8px">
        <div style="color:${Theme.COLORS.textMuted};margin-bottom:2px">Avg Deal</div>
        <div style="color:#a78bfa;font-weight:700;font-size:16px">${Theme.money(avgDeal)}</div>
        <div style="color:${Theme.COLORS.textMuted};font-size:10px;margin-top:2px">@ ${(closeRateDec * 100).toFixed(1)}% close</div>
      </div>
    </div>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:${Theme.COLORS.textMuted};font-family:'JetBrains Mono',monospace">Calc: no_shows &times; close_rate &times; avg_deal</div>
  `;
  splitRow.appendChild(noShowCard);

  // Objection Donut
  const objCard = document.createElement('div');
  objCard.className = 'card';
  objCard.style.cssText = 'padding:20px';
  splitRow.appendChild(objCard);

  const objHeader = document.createElement('div');
  objHeader.innerHTML = `<div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">Top Objections &middot; 60d</div>`;
  objCard.appendChild(objHeader);

  const objs = objectionRows || [];
  if (!objs.length) {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'padding:40px 20px;text-align:center;color:' + Theme.COLORS.textMuted + ';font-size:12px';
    emptyEl.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px;opacity:0.4">&#9888;</div>
      <div style="margin-bottom:4px;color:${Theme.COLORS.textSecondary}">No objection data captured yet</div>
      <div style="font-size:10px;font-family:'JetBrains Mono',monospace">Source: bridge_call_objections (empty table)</div>
      <div style="font-size:10px;margin-top:8px;line-height:1.5">Objections will populate once closers tag calls in the disposition system. Once flowing, this donut will show: Money / Timing / Spouse / Not Ready / Other.</div>
    `;
    objCard.appendChild(emptyEl);
  } else {
    const objCanvas = document.createElement('canvas');
    objCanvas.id = 'sales-objection-donut';
    objCanvas.style.maxHeight = '260px';
    objCard.appendChild(objCanvas);

    const objColors = ['#ef4444', '#f59e0b', '#a855f7', '#06b6d4', '#22c55e', '#ec4899', '#6b7280'];
    Components.lazyChart('sales-objection-donut', () => {
      Theme.createChart('sales-objection-donut', {
        type: 'doughnut',
        data: {
          labels: objs.map(r => r.objection_type),
          datasets: [{
            data: objs.map(r => parseInt(r.cnt) || 0),
            backgroundColor: objs.map((_, i) => objColors[i % objColors.length]),
            borderColor: '#0f1117',
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'right',
              labels: { color: Theme.COLORS.textSecondary, font: { size: 11 }, boxWidth: 10 },
            },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${ctx.parsed} (${((ctx.parsed / objs.reduce((s, r) => s + (parseInt(r.cnt) || 0), 0)) * 100).toFixed(1)}%)`,
              },
            },
          },
        },
      });
    });
  }

  // ---- Section 7: Day-of-Week Performance Heatmap ----
  const dowSection = document.createElement('div');
  dowSection.style.cssText = 'margin-top:32px';
  dowSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:8px">Day-of-Week Close Rate by Closer</h3>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:16px">Last 90 days &middot; close rate per day-of-week per closer &middot; cell shading = close rate</div>`;
  container.appendChild(dowSection);

  const dowCard = document.createElement('div');
  dowCard.className = 'card';
  dowCard.style.cssText = 'padding:20px;overflow-x:auto';
  dowSection.appendChild(dowCard);

  const dowList = dowRows || [];
  const DOW_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowClosers = [...new Set(dowList.map(r => r.closer))];

  function dowCellColor(rate) {
    if (rate == null) return 'rgba(255,255,255,0.02)';
    var r = parseFloat(rate) || 0;
    if (r >= 30) return 'rgba(34,197,94,0.40)';
    if (r >= 20) return 'rgba(34,197,94,0.22)';
    if (r >= 10) return 'rgba(245,158,11,0.22)';
    if (r > 0)   return 'rgba(239,68,68,0.18)';
    return 'rgba(255,255,255,0.02)';
  }
  function dowCellTextColor(rate) {
    var r = parseFloat(rate) || 0;
    if (r >= 30) return '#22c55e';
    if (r >= 20) return '#22c55e';
    if (r >= 10) return '#f59e0b';
    if (r > 0)   return '#ef4444';
    return Theme.COLORS.textMuted;
  }

  if (!dowClosers.length) {
    dowCard.innerHTML = `<div style="padding:40px 20px;text-align:center;color:${Theme.COLORS.textMuted};font-size:12px">No closer activity in last 90 days.</div>`;
  } else {
    var hHtml = `<table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:11px">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Closer</th>`;
    DOW_ORDER.forEach(function(d) {
      hHtml += `<th style="text-align:center;padding:6px 4px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">${d.slice(0, 3)}</th>`;
    });
    hHtml += `<th style="text-align:right;padding:6px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Total</th>`;
    hHtml += '</tr></thead><tbody>';

    dowClosers.forEach(function(closer) {
      var rowMap = {};
      var totalCalls = 0, totalClosed = 0;
      dowList.filter(function(r) { return r.closer === closer; }).forEach(function(r) {
        rowMap[r.dow_name] = r;
        totalCalls += parseInt(r.calls) || 0;
        totalClosed += parseInt(r.closed) || 0;
      });
      var totalRate = totalCalls > 0 ? (totalClosed / totalCalls * 100) : 0;
      hHtml += `<tr>
        <td style="padding:6px 10px;color:${Theme.COLORS.textPrimary};font-weight:600;white-space:nowrap">${closer}</td>`;
      DOW_ORDER.forEach(function(d) {
        var r = rowMap[d];
        if (!r) {
          hHtml += `<td style="background:rgba(255,255,255,0.02);border-radius:4px;text-align:center;padding:8px 4px;color:${Theme.COLORS.textMuted};font-size:11px">--</td>`;
        } else {
          var rate = parseFloat(r.close_rate) || 0;
          var calls = parseInt(r.calls) || 0;
          var bg = dowCellColor(rate);
          var fg = dowCellTextColor(rate);
          hHtml += `<td title="${closer} on ${d}: ${calls} calls, ${r.closed} closed (${rate.toFixed(1)}%)" style="background:${bg};border-radius:4px;text-align:center;padding:8px 4px;color:${fg};font-weight:600;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.3">
            ${rate.toFixed(0)}%
            <div style="font-size:9px;opacity:0.65;font-weight:500">${calls}c</div>
          </td>`;
        }
      });
      hHtml += `<td style="text-align:right;padding:6px 10px;color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace;font-weight:600">${totalRate.toFixed(1)}%</td></tr>`;
    });
    hHtml += '</tbody></table>';
    dowCard.innerHTML = hHtml;
  }

  // ---- Section 8: Monthly DPL Trend ----
  const dplSection = document.createElement('div');
  dplSection.style.cssText = 'margin-top:32px';
  dplSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Monthly DPL by Closer (6 Months)</h3>`;
  container.appendChild(dplSection);

  const dplCard = document.createElement('div');
  dplCard.className = 'card';
  dplCard.style.cssText = 'padding:20px';
  const dplCanvas = document.createElement('canvas');
  dplCanvas.id = 'sales-monthly-dpl';
  dplCanvas.style.height = '300px';
  dplCard.appendChild(dplCanvas);
  dplSection.appendChild(dplCard);

  const dplDatasets = trendClosers.map((c, i) => ({
    label: c,
    data: months.map(m => {
      const row = mRows.find(r => r.closer === c && r.month === m);
      var dpl = row ? parseFloat(row.dpl) : null;
      return (dpl != null && !isNaN(dpl)) ? dpl : null;
    }),
    borderColor: trendColors[i % trendColors.length],
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.3,
    spanGaps: true,
  }));

  Components.lazyChart('sales-monthly-dpl', () => {
    Theme.createChart('sales-monthly-dpl', {
      type: 'line',
      data: { labels: months, datasets: dplDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y || 0)}` } },
        },
        scales: {
          x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: {
            ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: v => Theme.money(v) },
            grid: { color: 'rgba(255,255,255,0.04)' },
            title: { display: true, text: 'DPL ($/call booked)', color: Theme.COLORS.textMuted, font: { size: 10 } },
          },
        },
      },
    });
  });
});

// Filter-change handled centrally by shell.js Filters.onChange.
// App.onFilterChange does not exist as a function; guard prevents TypeError.
if (typeof App !== 'undefined' && App.onFilterChange) { App.onFilterChange(() => App.navigate('sales-team')); }
