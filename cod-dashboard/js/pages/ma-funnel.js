/* ============================================
   MA/VSL Funnel -- Masterclass & VSL funnel
   metrics, Plotly sankey, trend charts
   ============================================ */

App.registerPage('ma-funnel', async (container) => {
  const days = Filters.getDays();

  // Cache-refresh wiring (Stage 2 follow-up #3): re-navigate the page when
  // api.js detects a row-count delta on the ma-funnel.default background SWR
  // fetch. The page already re-runs end-to-end on Filters.onChange via
  // App.navigate -- reusing that path keeps the KPI + engagement + sankey
  // sections coherent (sankey/regs/apps share the same lookback window).
  // AbortController cleanup before re-listen prevents handler accumulation.
  if (container._cacheRefreshController) {
    try { container._cacheRefreshController.abort(); } catch (_) {}
  }
  const cacheCtrl = new AbortController();
  container._cacheRefreshController = cacheCtrl;
  window.addEventListener('cache-refresh', (e) => {
    const detail = e && e.detail;
    if (!detail || detail.page !== 'ma-funnel' || detail.queryName !== 'default') return;
    App.navigate('ma-funnel');
  }, { signal: cacheCtrl.signal });

  let summary, regRows, appRows, sankeyRow;
  try {
    [summary, regRows, appRows, sankeyRow] = await Promise.all([
      API.query('ma-funnel', 'default', { days }),
      API.query('ma-funnel', 'registrations', { days }),
      API.query('ma-funnel', 'applications', { days }),
      API.query('ma-funnel', 'sankey', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load MA/VSL Funnel: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';
  const d = (summary && summary.length > 0) ? summary[0] : {};

  // ---- Section 1: KPI Strip (14 metrics in categorized rows) ----
  const inputColor = '#06b6d4';
  const calcColor = '#a855f7';
  const roasColor = '#22c55e';
  const engColor = '#eab308';

  const kpiEl = document.createElement('div');
  container.appendChild(kpiEl);

  const kpiCards = [
    { label: 'Ad Spend',       value: d.ad_spend || 0,       format: 'money',  color: inputColor },
    { label: 'Page Visits',    value: d.page_visits,         format: 'num',    color: inputColor, note: d.page_visits == null ? 'No tracking' : null },
    { label: 'Registrations',  value: d.registrations || 0,  format: 'num',    color: inputColor },
    { label: 'Applications',   value: d.applications || 0,   format: 'num',    color: inputColor },
    { label: 'Booked Calls',   value: d.booked_calls || 0,   format: 'num',    color: calcColor },
    { label: 'CPBC',           value: d.cpbc || 0,           format: 'money',  color: calcColor },
    { label: 'Enrollments',    value: d.enrollments || 0,    format: 'num',    color: calcColor },
    { label: 'Cash Collected',  value: d.cash || 0,          format: 'money',  color: roasColor },
    { label: 'Contracts',      value: d.contracts || 0,      format: 'money',  color: roasColor },
    { label: 'Cash ROAS',      value: d.cash_roas || 0,      format: 'pct',    color: roasColor, suffix: 'x' },
    { label: 'Contract ROAS',  value: d.contract_roas || 0,  format: 'pct',    color: roasColor, suffix: 'x' },
    { label: 'CAC',            value: d.cac || 0,            format: 'money',  color: calcColor },
  ];

  // Build KPI grid
  let kpiHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px">';
  kpiCards.forEach(k => {
    let val;
    if (k.note) {
      val = `<span style="color:${Theme.COLORS.textMuted};font-size:11px">${k.note}</span>`;
    } else if (k.format === 'money') {
      val = Theme.money(k.value);
    } else if (k.format === 'pct') {
      val = (k.value || 0).toFixed(2) + (k.suffix || '');
    } else {
      val = Theme.num(k.value || 0);
    }
    kpiHTML += `
      <div class="card" style="padding:14px 16px;border-left:3px solid ${k.color}">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:4px">${k.label}</div>
        <div style="font-size:20px;font-weight:600;color:${Theme.COLORS.textPrimary}">${val}</div>
      </div>`;
  });
  kpiHTML += '</div>';
  kpiEl.innerHTML = kpiHTML;

  // ---- Engagement placeholders (Play Rate + Engagement) ----
  const engEl = document.createElement('div');
  engEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px';
  container.appendChild(engEl);

  // Session-level engagement proxies (PRD §6 + state.md ma-funnel polish).
  // Real Play Rate and Avg Engagement gauges are blocked on PostHog identify()
  // wiring (see docs/cod/ma-funnel-posthog-identify-spec.md). Until that lands,
  // express the same intent from the data we DO have:
  //   - Play Rate proxy  = proxy_watched / registrations  (% of registered who
  //                         crossed the "started watching" threshold per the
  //                         ma-funnel BQ proxy field).
  //   - Engagement proxy = proxy_avg_watch_seconds        (avg watch time of
  //                         those who started, displayed as Xm Ys).
  // Both cards are explicitly labelled "Proxy" so this is not mistaken for the
  // real PostHog-backed gauge. When PostHog identify() lands and the BQ view
  // gains real play_rate / avg_engagement_pct fields, swap these in directly.
  const proxyWatched = d.proxy_watched || 0;
  const proxyAvgSec = d.proxy_avg_watch_seconds ? Math.round(d.proxy_avg_watch_seconds) : 0;
  const proxyRegs = d.registrations || 0;
  const playRateProxy = proxyRegs > 0 ? (proxyWatched / proxyRegs) * 100 : null;
  const playRateColor = playRateProxy == null
    ? Theme.COLORS.textMuted
    : (playRateProxy >= 60 ? '#22c55e' : playRateProxy >= 35 ? '#eab308' : '#ef4444');
  const engagementColor = proxyAvgSec >= 600
    ? '#22c55e'
    : proxyAvgSec >= 300
      ? '#eab308'
      : proxyAvgSec > 0
        ? '#ef4444'
        : Theme.COLORS.textMuted;
  const playRateText = playRateProxy == null ? '--' : playRateProxy.toFixed(1) + '%';
  const engagementText = proxyAvgSec > 0
    ? Math.floor(proxyAvgSec / 60) + 'm ' + (proxyAvgSec % 60) + 's'
    : '--';

  engEl.innerHTML = `
    <div class="card" style="padding:16px;border-left:3px solid ${engColor}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted}">Play Rate</div>
        <span style="font-size:9px;font-weight:700;color:#f59e0b;letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border:1px dashed rgba(245,158,11,0.45);border-radius:8px">Proxy</span>
      </div>
      <div style="font-size:20px;font-weight:600;color:${playRateColor}">${playRateText}</div>
      <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:6px">${proxyWatched.toLocaleString()} attended / ${proxyRegs.toLocaleString()} registered &middot; PostHog identify() pending</div>
    </div>
    <div class="card" style="padding:16px;border-left:3px solid ${engColor}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted}">Avg Engagement</div>
        <span style="font-size:9px;font-weight:700;color:#f59e0b;letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border:1px dashed rgba(245,158,11,0.45);border-radius:8px">Proxy</span>
      </div>
      <div style="font-size:20px;font-weight:600;color:${engagementColor}">${engagementText}</div>
      <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:6px">avg watch time of attended (proxy_avg_watch_seconds) &middot; gauge pending PostHog</div>
    </div>`;

  // ---- Section 2: Plotly Sankey ----
  const sankeySection = document.createElement('div');
  sankeySection.style.cssText = 'margin-bottom:24px';
  sankeySection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:12px">Funnel Flow</h3>`;
  container.appendChild(sankeySection);

  const sankeyCard = document.createElement('div');
  sankeyCard.className = 'card';
  sankeyCard.style.cssText = 'padding:20px';
  sankeySection.appendChild(sankeyCard);

  const sankeyDiv = document.createElement('div');
  sankeyDiv.id = 'ma-sankey';
  sankeyDiv.style.cssText = 'width:100%;height:400px';
  sankeyCard.appendChild(sankeyDiv);

  const sk = (sankeyRow && sankeyRow.length > 0) ? sankeyRow[0] : {};

  const nodeLabels = [
    'Page Visits', 'Registrations', 'Watched', 'Applications',
    'Booked Calls', 'Showed', 'Enrolled'
  ];
  const nodeColors = [
    '#475569', '#06b6d4', '#22d3ee', '#a855f7',
    '#8b5cf6', '#22c55e', '#10b981'
  ];

  const sankeyValues = [
    sk.page_visits || 0, sk.registrations || 0, sk.watched || 0, sk.applications || 0,
    sk.booked_calls || 0, sk.showed || 0, sk.enrollments || 0
  ];

  const source = [0, 1, 2, 3, 4, 5];
  const target = [1, 2, 3, 4, 5, 6];
  const linkValues = [];
  for (let i = 0; i < source.length; i++) {
    linkValues.push(Math.max(sankeyValues[target[i]], 1));
  }

  const linkColors = source.map((s, i) => {
    const dropoff = sankeyValues[s] - sankeyValues[target[i]];
    return dropoff > sankeyValues[s] * 0.5 ? 'rgba(239,68,68,0.25)' : 'rgba(124,58,237,0.2)';
  });

  if (typeof Plotly !== 'undefined') {
    Plotly.newPlot(sankeyDiv, [{
      type: 'sankey',
      orientation: 'h',
      node: {
        pad: 20,
        thickness: 20,
        label: nodeLabels.map((l, i) => `${l}\n${Theme.num(sankeyValues[i])}`),
        color: nodeColors,
      },
      link: {
        source,
        target,
        value: linkValues,
        color: linkColors,
      }
    }], {
      font: { family: 'Inter, sans-serif', size: 12, color: Theme.COLORS.textSecondary },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 10, r: 10, t: 10, b: 10 },
    }, { responsive: true, displayModeBar: false });
  } else {
    sankeyDiv.innerHTML = '<p class="text-muted" style="padding:20px">Plotly not loaded</p>';
  }

  // ---- Section 3: Registration Trend ----
  const regSection = document.createElement('div');
  regSection.style.cssText = 'margin-bottom:24px';
  regSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:12px">Daily Registrations</h3>`;
  container.appendChild(regSection);

  const regCard = document.createElement('div');
  regCard.className = 'card';
  regCard.style.cssText = 'padding:20px';
  const regCanvas = document.createElement('canvas');
  regCanvas.id = 'ma-reg-trend';
  regCanvas.style.height = '220px';
  regCard.appendChild(regCanvas);
  regSection.appendChild(regCard);

  const rRows = regRows || [];
  Theme.createChart('ma-reg-trend', {
    type: 'bar',
    data: {
      labels: rRows.map(r => r.day ? r.day.value || r.day : r.day),
      datasets: [{
        label: 'Registrations',
        data: rRows.map(r => r.registrations || 0),
        backgroundColor: '#06b6d4',
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxTicksLimit: 15 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  // ---- Section 4: Application Trend ----
  const appSection = document.createElement('div');
  appSection.style.cssText = 'margin-bottom:24px';
  appSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:12px">Daily Applications</h3>`;
  container.appendChild(appSection);

  const appCard = document.createElement('div');
  appCard.className = 'card';
  appCard.style.cssText = 'padding:20px';
  const appCanvas = document.createElement('canvas');
  appCanvas.id = 'ma-app-trend';
  appCanvas.style.height = '220px';
  appCard.appendChild(appCanvas);
  appSection.appendChild(appCard);

  const aRows = appRows || [];
  Theme.createChart('ma-app-trend', {
    type: 'bar',
    data: {
      labels: aRows.map(r => r.day ? r.day.value || r.day : r.day),
      datasets: [{
        label: 'Applications',
        data: aRows.map(r => r.applications || 0),
        backgroundColor: '#a855f7',
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxTicksLimit: 15 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
});

App.onFilterChange(() => App.navigate('ma-funnel'));
