/* ============================================
   Ads (Meta) -- paid social performance
   KPI strip, ROAS by ad set, daily spend/CTR,
   campaign table with drill-down
   ============================================ */

App.registerPage('ads-meta', async (container) => {
  const days = Filters.getDays();

  let kpis, campaigns, adsets, daily, unitEconData;

  try {
    [kpis, campaigns, adsets, daily, unitEconData] = await Promise.all([
      API.query('ads-meta', 'default',    { days }),
      API.query('ads-meta', 'campaigns',  { days }),
      API.query('ads-meta', 'adsets',     { days }),
      API.query('ads-meta', 'daily',      { days }),
      API.query('ads-meta', 'unitEcon',   { days }).catch(() => null),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Ads (Meta): ${err.message}</p></div>`;
    return;
  }

  const kpi = (kpis && kpis.length > 0) ? kpis[0] : {};
  container.innerHTML = '';

  // ---- Derived KPI values ----
  const totalSpend     = kpi.total_spend        || 0;
  const avgCtr         = kpi.avg_ctr            || 0;
  const avgCpm         = kpi.avg_cpm            || 0;
  const avgCpc         = kpi.avg_cpc            || 0;
  const costPerTicket  = kpi.cost_per_ticket     || 0;

  // Account-level ROAS from campaigns rollup
  const totalRevenue = (campaigns || []).reduce((s, c) => s + (c.revenue || 0), 0);
  const accountRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Spend',      value: totalSpend,    format: 'money' },
    { label: 'ROAS',             value: accountRoas,   format: 'num' },
    { label: 'CPM',              value: avgCpm,        format: 'money' },
    { label: 'CPC',              value: avgCpc,        format: 'money' },
    { label: 'CTR',              value: avgCtr,        format: 'pct' },
    { label: 'Cost Per Ticket',  value: costPerTicket, format: 'money', invertCost: true },
  ]);

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // -- Chart 1: ROAS by Ad Set (Plotly horizontal bar, top 5 + bottom 5) --
  const roasCard = _metaCard('ROAS by Ad Set');
  const roasDiv  = document.createElement('div');
  roasDiv.id     = 'meta-roas-chart';
  roasDiv.style.height = '320px';
  roasCard.appendChild(roasDiv);
  roasCard.innerHTML += `
    <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:${Theme.COLORS.textMuted}">
      <span style="color:${Theme.COLORS.success}">&#9632; &gt;3x target</span>
      <span style="color:${Theme.COLORS.warning}">&#9632; 1x-3x</span>
      <span style="color:${Theme.COLORS.danger}">&#9632; &lt;1x</span>
    </div>
  `;
  grid.appendChild(roasCard);

  // -- Chart 2: Daily Spend & CTR (Chart.js dual-axis) --
  const trendCard   = _metaCard('Daily Spend & CTR');
  const trendCanvas = document.createElement('canvas');
  trendCanvas.id    = 'meta-daily-chart';
  trendCard.appendChild(trendCanvas);
  grid.appendChild(trendCard);

  // ---- Campaign Table (full-width) ----
  const tableCard = _metaCard('Campaign Performance');
  tableCard.style.gridColumn = '1 / -1';
  tableCard.style.marginTop  = '0';
  container.appendChild(tableCard);

  _renderCampaignTable(tableCard, campaigns || []);

  // ---- Render charts after DOM settles ----
  requestAnimationFrame(() => {
    _renderRoasChart(roasDiv, adsets || []);
    _renderDailyChart(trendCanvas, daily || []);
  });

  // ---- Unit Economics Panel ----
  _renderUnitEcon(container, unitEconData, totalSpend);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _metaCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:20px';
  card.innerHTML = `<div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">${title}</div>`;
  return card;
}

function _roasColor(roas) {
  if (roas >= 3) return Theme.COLORS.success;
  if (roas >= 1) return Theme.COLORS.warning;
  return Theme.COLORS.danger;
}

function _renderRoasChart(el, adsets) {
  if (!adsets || adsets.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No ad set data available.</p>`;
    return;
  }

  // Sort by ROAS, take top 5 and bottom 5 (deduplicated)
  const sorted = [...adsets].sort((a, b) => (b.roas || 0) - (a.roas || 0));
  const top5   = sorted.slice(0, 5);
  const bot5   = sorted.length > 5 ? sorted.slice(-5).reverse() : [];
  const combined = [...top5];
  bot5.forEach(b => {
    if (!combined.find(c => c.ad_set_id === b.ad_set_id)) combined.push(b);
  });

  // Horizontal bar: names on Y axis
  const names  = combined.map(a => (a.ad_set_name || 'Unknown').substring(0, 28));
  const values = combined.map(a => +(a.roas || 0).toFixed(2));
  const colors = values.map(v => _roasColor(v));

  const trace = {
    type: 'bar',
    orientation: 'h',
    x: values,
    y: names,
    marker: { color: colors },
    text: values.map(v => v.toFixed(2) + 'x'),
    textposition: 'outside',
    hovertemplate: '<b>%{y}</b><br>ROAS: %{x:.2f}x<extra></extra>',
  };

  const layout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 300,
    margin: { t: 10, r: 60, b: 30, l: 180 },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      title: { text: 'ROAS', font: { color: Theme.COLORS.textSecondary } },
    },
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      autorange: 'reversed',
    },
    shapes: [{
      type: 'line',
      x0: 3, x1: 3,
      y0: -0.5, y1: combined.length - 0.5,
      line: { color: Theme.COLORS.success, dash: 'dot', width: 2 },
    }],
    annotations: [{
      x: 3,
      y: 0,
      xanchor: 'left',
      yanchor: 'top',
      text: '3x target',
      font: { color: Theme.COLORS.success, size: 10 },
      showarrow: false,
    }],
  });

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderDailyChart(canvas, daily) {
  if (!daily || daily.length === 0) {
    const p = document.createElement('p');
    p.style.cssText = `color:${Theme.COLORS.textMuted};padding:16px;font-size:13px`;
    p.textContent = 'No daily data available.';
    canvas.replaceWith(p);
    return;
  }

  const labels = daily.map(d => d.ad_date || '');
  const spend  = daily.map(d => +(d.spend  || 0).toFixed(2));
  const ctr    = daily.map(d => +(d.ctr    || 0).toFixed(2));

  Theme.createChart(canvas.id, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Spend ($)',
          data: spend,
          backgroundColor: Theme.FUNNEL.blue + 'cc',
          borderColor: Theme.FUNNEL.blue,
          borderWidth: 1,
          yAxisID: 'ySpend',
          order: 2,
        },
        {
          label: 'CTR (%)',
          data: ctr,
          type: 'line',
          borderColor: Theme.FUNNEL.cyan,
          backgroundColor: 'transparent',
          pointBackgroundColor: Theme.FUNNEL.cyan,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: 'yCtr',
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === 'ySpend') return ` Spend: ${Theme.money(ctx.parsed.y)}`;
              return ` CTR: ${ctx.parsed.y.toFixed(2)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        ySpend: {
          position: 'left',
          ticks: {
            color: Theme.COLORS.textSecondary,
            font: { size: 10 },
            callback: (v) => Theme.money(v),
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        yCtr: {
          position: 'right',
          ticks: {
            color: Theme.FUNNEL.cyan,
            font: { size: 10 },
            callback: (v) => v.toFixed(1) + '%',
          },
          grid: { display: false },
        },
      },
    },
  });
}

function _renderCampaignTable(card, campaigns) {
  if (!campaigns || campaigns.length === 0) {
    card.innerHTML += `<p style="color:${Theme.COLORS.textMuted};font-size:13px">No campaign data available.</p>`;
    return;
  }

  // Sort by spend descending
  const rows = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0));

  if (typeof Components.renderTable === 'function') {
    Components.renderTable(card, rows, {
      columns: [
        { key: 'campaign_name', label: 'Campaign' },
        { key: 'spend',        label: 'Spend',       format: 'money' },
        { key: 'impressions',  label: 'Impressions',  format: 'num' },
        { key: 'clicks',       label: 'Clicks',       format: 'num' },
        { key: 'ctr',          label: 'CTR',          format: 'pct' },
        { key: 'cpc',          label: 'CPC',          format: 'money' },
        { key: 'cpm',          label: 'CPM',          format: 'money' },
        { key: 'conversions',  label: 'Conversions',  format: 'num' },
        { key: 'revenue',      label: 'Revenue',      format: 'money' },
        { key: 'roas',         label: 'ROAS',         format: 'num' },
      ],
      onRowClick: (row) => {
        Components.openDrillDown(`Campaign: ${row.campaign_name}`, async () => {
          return [row];
        });
      },
    });
    return;
  }

  // Fallback styled table
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow-x:auto;margin-top:4px';

  const cols = [
    { key: 'campaign_name', label: 'Campaign',    fmt: (v) => `<span style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block">${v || '--'}</span>` },
    { key: 'spend',         label: 'Spend',       fmt: (v) => Theme.money(v || 0) },
    { key: 'impressions',   label: 'Impressions', fmt: (v) => Theme.num(v || 0) },
    { key: 'clicks',        label: 'Clicks',      fmt: (v) => Theme.num(v || 0) },
    { key: 'ctr',           label: 'CTR',         fmt: (v) => Theme.pct(v || 0) },
    { key: 'cpc',           label: 'CPC',         fmt: (v) => Theme.money(v || 0) },
    { key: 'cpm',           label: 'CPM',         fmt: (v) => Theme.money(v || 0) },
    { key: 'conversions',   label: 'Conv.',       fmt: (v) => Theme.num(v || 0) },
    { key: 'revenue',       label: 'Revenue',     fmt: (v) => Theme.money(v || 0) },
    {
      key: 'roas', label: 'ROAS',
      fmt: (v) => {
        const n = +(v || 0);
        const color = n >= 3 ? Theme.COLORS.success : n >= 1 ? Theme.COLORS.warning : Theme.COLORS.danger;
        return `<span style="font-weight:700;color:${color}">${n.toFixed(2)}x</span>`;
      },
    },
  ];

  const thStyle = `padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:10px 12px;font-size:13px;color:${Theme.COLORS.textPrimary};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap`;
  const trHover = `background:rgba(255,255,255,0.03);cursor:pointer`;

  const thead = `<thead><tr>${cols.map(c => `<th style="${thStyle}">${c.label}</th>`).join('')}</tr></thead>`;
  const tbody = rows.map(row => {
    const cells = cols.map(c => `<td style="${tdStyle}">${c.fmt(row[c.key])}</td>`).join('');
    return `<tr onmouseenter="this.style.background='rgba(255,255,255,0.03)'" onmouseleave="this.style.background=''" style="cursor:pointer">${cells}</tr>`;
  }).join('');

  wrapper.innerHTML = `<table style="width:100%;border-collapse:collapse">${thead}<tbody>${tbody}</tbody></table>`;

  // Row click -> drill-down
  const trs = wrapper.querySelectorAll('tbody tr');
  trs.forEach((tr, i) => {
    tr.addEventListener('click', () => {
      const row = rows[i];
      if (typeof Components.openDrillDown === 'function') {
        Components.openDrillDown(`Campaign: ${row.campaign_name}`, async () => [row]);
      }
    });
  });

  card.appendChild(wrapper);
}
