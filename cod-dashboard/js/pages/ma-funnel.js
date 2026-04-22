/* ============================================
   MA/VSL Funnel -- Masterclass & VSL funnel
   metrics, Plotly sankey, trend charts
   ============================================ */

App.registerPage('ma-funnel', async (container) => {
  const days = Filters.getDays();

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

  const proxyWatched = d.proxy_watched || 0;
  const proxyAvg = d.proxy_avg_watch_seconds ? Math.round(d.proxy_avg_watch_seconds) : 0;

  engEl.innerHTML = `
    <div class="card" style="padding:16px;border-left:3px solid ${engColor}">
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:4px">Play Rate</div>
      <div style="font-size:16px;font-weight:600;color:${Theme.COLORS.textMuted}">Pending PostHog</div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:6px">Proxy: ${proxyWatched} attended</div>
    </div>
    <div class="card" style="padding:16px;border-left:3px solid ${engColor}">
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:4px">Avg Engagement</div>
      <div style="font-size:16px;font-weight:600;color:${Theme.COLORS.textMuted}">Pending PostHog</div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:6px">Proxy: ${proxyAvg}s avg watch</div>
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
