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

  // ---- Section 2: Customer Journey Stages (mirrors funnels.js Customer Journey Stages pattern) ----
  // Replaces the Plotly sankey with the stage-card horizontal row + arrows + CVR bars.
  const sankeySection = document.createElement('div');
  sankeySection.style.cssText = 'margin-bottom:24px';
  sankeySection.innerHTML = `
    <style>
      #ma-journey-stages .ma-stage-row { display:flex; align-items:stretch; gap:0; min-width:max-content; padding:16px 4px; }
      #ma-journey-stages .ma-stage-card { width:158px; min-width:158px; min-height:210px; background:var(--bg-card, #0b1220); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:14px 12px 12px; cursor:default; transition:opacity .15s, border-color .15s, transform .15s; display:flex; flex-direction:column; gap:8px; position:relative; flex-shrink:0; }
      #ma-journey-stages .ma-stage-card:hover { transform:translateY(-2px); }
      #ma-journey-stages .ma-stage-arrow { display:flex; align-items:center; justify-content:center; width:20px; min-width:20px; flex-shrink:0; color:var(--text-muted); font-size:12px; opacity:0.5; }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div>
        <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin:0">Customer Journey Stages</div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:2px">MA/VSL pipeline -- arrows show conversion to next stage.</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:${Theme.COLORS.textSecondary}">
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block"></span>Full</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#eab308;display:inline-block"></span>Partial</span>
        <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;border:1px dashed #ef4444;display:inline-block"></span>Missing</span>
      </div>
    </div>
  `;
  container.appendChild(sankeySection);

  const sankeyCard = document.createElement('div');
  sankeyCard.className = 'card';
  sankeyCard.style.cssText = 'padding:8px 12px';
  sankeySection.appendChild(sankeyCard);

  const stagesHost = document.createElement('div');
  stagesHost.id = 'ma-journey-stages';
  stagesHost.style.cssText = 'width:100%;overflow-x:auto;padding-bottom:8px';
  sankeyCard.appendChild(stagesHost);

  const sk = (sankeyRow && sankeyRow.length > 0) ? sankeyRow[0] : {};

  const MA_STAGES = [
    { num: 1, name: 'Page Visits',  color: '#475569', field: 'page_visits',  tracking: sk.page_visits != null ? 'partial' : 'missing' },
    { num: 2, name: 'Registrations',color: '#06b6d4', field: 'registrations',tracking: 'full' },
    { num: 3, name: 'Watched',      color: '#22d3ee', field: 'watched',      tracking: 'partial' },
    { num: 4, name: 'Applications', color: '#a855f7', field: 'applications', tracking: 'full' },
    { num: 5, name: 'Booked Calls', color: '#8b5cf6', field: 'booked_calls', tracking: 'full' },
    { num: 6, name: 'Showed',       color: '#22c55e', field: 'showed',       tracking: 'full' },
    { num: 7, name: 'Enrolled',     color: '#10b981', field: 'enrollments',  tracking: 'full' }
  ];

  function _maBadge(tracking) {
    if (tracking === 'full')    return { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)',  label: 'Full' };
    if (tracking === 'partial') return { bg: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)',  label: 'Partial' };
    return                            { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444', border: '1px dashed rgba(239,68,68,0.4)', label: 'Missing' };
  }

  function _maCvrColor(value) {
    if (value === null || value === undefined) return '#64748b';
    if (value >= 60) return '#22c55e';
    if (value >= 30) return '#eab308';
    return '#ef4444';
  }

  let stagesHtml = '<div class="ma-stage-row">';
  MA_STAGES.forEach((stage, idx) => {
    const vol = sk[stage.field];
    const volNum = (vol == null) ? null : Number(vol);
    const volStr = volNum == null ? '--' : volNum.toLocaleString();
    const periodStr = volNum == null ? 'no data' : `last ${days}d`;
    const volColor = volNum != null && volNum > 0 ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted;
    const badge = _maBadge(stage.tracking);

    // CVR to next stage
    let cvrLabel = null, cvrValue = null;
    if (idx < MA_STAGES.length - 1) {
      const nextVol = sk[MA_STAGES[idx + 1].field];
      if (volNum != null && volNum > 0 && nextVol != null) {
        cvrValue = (Number(nextVol) / volNum) * 100;
        cvrLabel = `to ${MA_STAGES[idx + 1].name}`;
      }
    }
    const trafficColor = _maCvrColor(cvrValue);

    stagesHtml += `<div class="ma-stage-card" style="border-top:3px solid ${stage.color}" data-stage="${stage.num}">`;
    stagesHtml +=   `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">`;
    stagesHtml +=     `<span style="font-size:10px;font-weight:700;color:${stage.color};text-transform:uppercase;letter-spacing:.06em">Stage ${stage.num}</span>`;
    stagesHtml +=     `<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${badge.bg};color:${badge.color};border:${badge.border};font-weight:500">${badge.label}</span>`;
    stagesHtml +=   `</div>`;
    stagesHtml +=   `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};line-height:1.3">${stage.name}</div>`;
    stagesHtml +=   `<div style="margin-top:auto">`;
    stagesHtml +=     `<div style="font-size:22px;font-weight:700;color:${volColor};letter-spacing:-.5px">${volStr}</div>`;
    stagesHtml +=     `<div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:1px">${periodStr}</div>`;
    stagesHtml +=   `</div>`;
    if (cvrLabel && cvrValue !== null) {
      const barPct = Math.min(Math.max(cvrValue, 0), 100);
      stagesHtml += `<div style="margin-top:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">`;
      stagesHtml +=   `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">`;
      stagesHtml +=     `<span style="font-size:9px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">${cvrLabel}</span>`;
      stagesHtml +=     `<span style="font-size:13px;font-weight:700;color:${trafficColor}">${cvrValue.toFixed(1)}%</span>`;
      stagesHtml +=   `</div>`;
      stagesHtml +=   `<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">`;
      stagesHtml +=     `<div style="height:100%;width:${barPct}%;background:${trafficColor};border-radius:3px;transition:width .3s"></div>`;
      stagesHtml +=   `</div>`;
      stagesHtml += `</div>`;
    } else {
      stagesHtml += `<div style="height:44px"></div>`;
    }
    stagesHtml += `</div>`;

    if (idx < MA_STAGES.length - 1) {
      stagesHtml += `<div class="ma-stage-arrow">&#10142;</div>`;
    }
  });
  stagesHtml += '</div>';
  stagesHost.innerHTML = stagesHtml;

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
  Components.lazyChart('ma-app-trend', () => {
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
});

App.onFilterChange(() => App.navigate('ma-funnel'));
