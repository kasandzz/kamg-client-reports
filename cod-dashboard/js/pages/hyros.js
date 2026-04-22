/* ============================================
   Attribution -- multi-model Hyros comparison,
   multi-source divergence, delta analysis
   ============================================ */

App.registerPage('hyros', async (container) => {
  const days = Filters.getDays();

  let kpis, multiModel, multiSource, deltaData;

  try {
    [kpis, multiModel, multiSource, deltaData] = await Promise.all([
      API.query('attribution', 'default', { days }),
      API.query('attribution', 'multiModel', { days }),
      API.query('attribution', 'multiSource', { days }),
      API.query('attribution', 'delta', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Attribution: ${err.message}</p></div>`;
    return;
  }

  const metaDaily = await API.query('ads-meta', 'daily', { days }).catch(() => null);

  container.innerHTML = '';
  const k = (kpis && kpis.length > 0) ? kpis[0] : {};

  // ---- Section 0: ATTR-03 Label Banner ----
  const callout = document.createElement('div');
  callout.style.cssText = 'border-left:3px solid var(--amber,#eab308);background:var(--surface,rgba(255,255,255,0.03));padding:16px 20px;margin-bottom:24px;border-radius:8px';
  callout.innerHTML = `
    <strong style="color:#eab308">Important:</strong>
    <span style="color:${Theme.COLORS.textMuted}"> Hyros ROAS = $27 tickets only. Total ROAS (including high-ticket) = Stripe revenue / ad spend.</span>
  `;
  container.appendChild(callout);

  const roasRow = document.createElement('div');
  roasRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px';
  roasRow.innerHTML = `
    <div class="card" style="padding:20px;text-align:center">
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Hyros ROAS (Tickets Only)</div>
      <div style="font-size:32px;font-weight:700;color:#eab308">${(k.ticket_roas || 0).toFixed(2)}x</div>
    </div>
    <div class="card" style="padding:20px;text-align:center">
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Total ROAS (Stripe)</div>
      <div style="font-size:32px;font-weight:700;color:${Theme.COLORS.success}">${(k.total_roas || 0).toFixed(2)}x</div>
    </div>
  `;
  container.appendChild(roasRow);

  // ---- Section 1: KPI Strip ----
  const kpiEl = document.createElement('div');
  container.appendChild(kpiEl);
  Components.renderKPIStrip(kpiEl, [
    { label: 'Hyros Sales',       value: k.total_sales || 0,    format: 'num' },
    { label: 'Attributed Revenue', value: k.total_revenue || 0,  format: 'money' },
    { label: 'Ticket Revenue',     value: k.ticket_revenue || 0, format: 'money' },
    { label: 'Total Ad Spend',     value: k.total_spend || 0,    format: 'money' },
    { label: 'Hyros ROAS (Tickets)', value: k.ticket_roas || 0,  format: 'pct', suffix: 'x' },
    { label: 'Total ROAS',          value: k.total_roas || 0,    format: 'pct', suffix: 'x' },
  ]);

  // ---- Section 2: Multi-Model Comparison (ATTR-01) ----
  const modelSection = document.createElement('div');
  modelSection.style.cssText = 'margin-top:32px';
  modelSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Revenue by Source &mdash; Attribution Model Comparison</h3>`;
  container.appendChild(modelSection);

  const modelRows = multiModel || [];
  const sources = [...new Set(modelRows.filter(r => r.model === 'first_touch').map(r => r.source))].slice(0, 10);
  const models = ['first_touch', 'last_touch', 'scientific'];
  const modelColors = { first_touch: '#06b6d4', last_touch: '#a855f7', scientific: '#22c55e' };
  const modelLabels = { first_touch: 'First Touch', last_touch: 'Last Touch', scientific: 'Scientific' };

  const chartCard = document.createElement('div');
  chartCard.className = 'card';
  chartCard.style.cssText = 'padding:20px';
  const chartCanvas = document.createElement('canvas');
  chartCanvas.id = 'attr-model-chart';
  chartCanvas.style.height = '320px';
  chartCard.appendChild(chartCanvas);
  modelSection.appendChild(chartCard);

  const datasets = models.map(m => ({
    label: modelLabels[m],
    data: sources.map(s => {
      const row = modelRows.find(r => r.model === m && r.source === s);
      return row ? (row.revenue || 0) : 0;
    }),
    backgroundColor: modelColors[m],
    borderRadius: 4,
  }));

  Theme.createChart('attr-model-chart', {
    type: 'bar',
    data: { labels: sources.map(s => s.length > 20 ? s.slice(0, 18) + '...' : s), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: v => Theme.money(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  // Model comparison table
  const modelTable = document.createElement('div');
  modelTable.className = 'card';
  modelTable.style.cssText = 'padding:20px;margin-top:16px;overflow-x:auto';
  let tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr>
      <th style="text-align:left;padding:8px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07)">Source</th>
      <th style="text-align:right;padding:8px;color:#06b6d4;border-bottom:1px solid rgba(255,255,255,0.07)">First Touch</th>
      <th style="text-align:right;padding:8px;color:#a855f7;border-bottom:1px solid rgba(255,255,255,0.07)">Last Touch</th>
      <th style="text-align:right;padding:8px;color:#22c55e;border-bottom:1px solid rgba(255,255,255,0.07)">Scientific</th>
      <th style="text-align:right;padding:8px;color:${Theme.COLORS.warning};border-bottom:1px solid rgba(255,255,255,0.07)">Delta</th>
    </tr></thead><tbody>`;
  sources.forEach(s => {
    const ft = modelRows.find(r => r.model === 'first_touch' && r.source === s);
    const lt = modelRows.find(r => r.model === 'last_touch' && r.source === s);
    const sc = modelRows.find(r => r.model === 'scientific' && r.source === s);
    const vals = [ft?.revenue || 0, lt?.revenue || 0, sc?.revenue || 0];
    const delta = Math.max(...vals) - Math.min(...vals);
    tableHtml += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:8px;color:${Theme.COLORS.textPrimary}">${s}</td>
      <td style="padding:8px;text-align:right;color:#06b6d4">${Theme.money(vals[0])}</td>
      <td style="padding:8px;text-align:right;color:#a855f7">${Theme.money(vals[1])}</td>
      <td style="padding:8px;text-align:right;color:#22c55e">${Theme.money(vals[2])}</td>
      <td style="padding:8px;text-align:right;color:${Theme.COLORS.warning}">${Theme.money(delta)}</td>
    </tr>`;
  });
  tableHtml += '</tbody></table>';
  modelTable.innerHTML = tableHtml;
  modelSection.appendChild(modelTable);

  // ---- Section 3: Multi-Source Comparison (ATTR-02) ----
  const msSection = document.createElement('div');
  msSection.style.cssText = 'margin-top:32px';
  msSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Multi-Source Attribution Comparison</h3>`;
  container.appendChild(msSection);

  const msCard = document.createElement('div');
  msCard.className = 'card';
  msCard.style.cssText = 'padding:20px;overflow-x:auto';
  const msRows = multiSource || [];
  let msHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr>
      <th style="text-align:left;padding:10px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07)">Platform</th>
      <th style="text-align:right;padding:10px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07)">Spend</th>
      <th style="text-align:right;padding:10px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07)">Attributed Revenue</th>
      <th style="text-align:right;padding:10px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07)">ROAS</th>
    </tr></thead><tbody>`;
  msRows.forEach(r => {
    const isGoogle = r.platform === 'Google Reported';
    const spend = r.spend != null ? Theme.money(r.spend) : '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
    const rev = r.attributed_revenue != null ? Theme.money(r.attributed_revenue) : '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
    const roas = r.roas != null ? (r.roas).toFixed(2) + 'x' : '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
    msHtml += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:10px;color:${Theme.COLORS.textPrimary};font-weight:500">${r.platform}${isGoogle ? ' <span style="font-size:11px;color:' + Theme.COLORS.textMuted + '">(Pending INFRA-04)</span>' : ''}</td>
      <td style="padding:10px;text-align:right">${spend}</td>
      <td style="padding:10px;text-align:right">${rev}</td>
      <td style="padding:10px;text-align:right;font-weight:600">${roas}</td>
    </tr>`;
  });
  msHtml += '</tbody></table>';
  msCard.innerHTML = msHtml;
  msSection.appendChild(msCard);

  // ---- Section 4: Attribution Delta Chart (ATTR-04) ----
  const deltaSection = document.createElement('div');
  deltaSection.style.cssText = 'margin-top:32px';
  deltaSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Daily Attribution Divergence &mdash; Meta Revenue by Model</h3>`;
  container.appendChild(deltaSection);

  const deltaCard = document.createElement('div');
  deltaCard.className = 'card';
  deltaCard.style.cssText = 'padding:20px';
  const deltaCanvas = document.createElement('canvas');
  deltaCanvas.id = 'attr-delta-chart';
  deltaCanvas.style.height = '300px';
  deltaCard.appendChild(deltaCanvas);
  deltaSection.appendChild(deltaCard);

  const dRows = deltaData || [];
  const deltaLabels = dRows.map(r => r.day ? String(r.day).slice(5, 10) : '');
  const deltaDatasets = [
    { label: 'Hyros Meta (First Touch)', data: dRows.map(r => r.hyros_meta_first || 0), borderColor: '#06b6d4', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.3 },
    { label: 'Hyros Meta (Last Touch)', data: dRows.map(r => r.hyros_meta_last || 0), borderColor: '#a855f7', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: 0.3 },
  ];

  if (metaDaily && metaDaily.length > 0) {
    const metaByDay = {};
    metaDaily.forEach(r => { if (r.day || r.date) metaByDay[String(r.day || r.date).slice(0, 10)] = r.spend || 0; });
    deltaDatasets.push({
      label: 'Meta Reported Spend',
      data: dRows.map(r => metaByDay[String(r.day).slice(0, 10)] || 0),
      borderColor: '#f97316',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 3],
      pointRadius: 1,
      tension: 0.3,
    });
  }

  Theme.createChart('attr-delta-chart', {
    type: 'line',
    data: { labels: deltaLabels, datasets: deltaDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: v => Theme.money(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  // ---- Section 5: Source Performance Table (sortable) ----
  const srcSection = document.createElement('div');
  srcSection.style.cssText = 'margin-top:32px';
  srcSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:16px">Source Performance (First Touch)</h3>`;
  container.appendChild(srcSection);

  const srcCard = document.createElement('div');
  srcCard.className = 'card';
  srcCard.style.cssText = 'padding:20px;overflow-x:auto';
  srcSection.appendChild(srcCard);

  const ftRows = modelRows.filter(r => r.model === 'first_touch').sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const cols = [
    { key: 'source', label: 'Source', align: 'left', fmt: v => v },
    { key: 'sales', label: 'Sales', align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'revenue', label: 'Revenue', align: 'right', fmt: v => Theme.money(v || 0) },
    { key: 'ticket_sales', label: 'Tickets', align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'ticket_revenue', label: 'Ticket Rev', align: 'right', fmt: v => Theme.money(v || 0) },
    { key: 'enrollment_sales', label: 'Enrollments', align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'enrollment_revenue', label: 'Enrollment Rev', align: 'right', fmt: v => Theme.money(v || 0) },
  ];

  let sortKey = 'revenue';
  let sortAsc = false;

  function renderSrcTable() {
    const sorted = [...ftRows].sort((a, b) => {
      const av = a[sortKey] || 0, bv = b[sortKey] || 0;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    let html = `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>`;
    cols.forEach(c => {
      const arrow = sortKey === c.key ? (sortAsc ? ' &#9650;' : ' &#9660;') : '';
      html += `<th data-sort="${c.key}" style="text-align:${c.align};padding:8px;color:${Theme.COLORS.textMuted};border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;user-select:none">${c.label}${arrow}</th>`;
    });
    html += '</tr></thead><tbody>';
    sorted.forEach(r => {
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">';
      cols.forEach(c => {
        html += `<td style="padding:8px;text-align:${c.align};color:${c.key === 'source' ? Theme.COLORS.textPrimary : Theme.COLORS.textSecondary}">${c.fmt(r[c.key])}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    srcCard.innerHTML = html;

    srcCard.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const newKey = th.dataset.sort;
        if (sortKey === newKey) sortAsc = !sortAsc;
        else { sortKey = newKey; sortAsc = false; }
        renderSrcTable();
      });
    });
  }
  renderSrcTable();
});

App.onFilterChange(() => App.navigate('hyros'));
