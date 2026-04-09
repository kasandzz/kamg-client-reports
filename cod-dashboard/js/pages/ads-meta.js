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
    // Still render dummy panels below
    _renderSourceAttribution(container);
    _renderDemographicIntel(container);
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
    {
      label: 'Total Spend',
      value: totalSpend,
      format: 'money',
      source: 'Meta Marketing API via BQ: meta_ads_insights',
      calc: 'SUM(spend) across all campaigns for selected date range',
    },
    {
      label: 'ROAS',
      value: accountRoas,
      format: 'num',
      source: 'BQ: meta_ads_campaigns (revenue rollup) / meta_ads_insights (spend)',
      calc: 'SUM(campaign.revenue) / SUM(spend); revenue from Hyros attribution joined to campaigns',
    },
    {
      label: 'CPM',
      value: avgCpm,
      format: 'money',
      source: 'Meta Marketing API via BQ: meta_ads_insights',
      calc: 'AVG(cpm) across active ad sets; Meta-reported (spend / impressions * 1000)',
    },
    {
      label: 'CPC',
      value: avgCpc,
      format: 'money',
      source: 'Meta Marketing API via BQ: meta_ads_insights',
      calc: 'AVG(cpc) across active ad sets; Meta-reported (spend / link_clicks)',
    },
    {
      label: 'CTR',
      value: avgCtr,
      format: 'pct',
      source: 'Meta Marketing API via BQ: meta_ads_insights',
      calc: 'AVG(ctr) across active ad sets; Meta-reported link CTR (link_clicks / impressions)',
    },
    {
      label: 'Cost Per Ticket',
      value: costPerTicket,
      format: 'money',
      invertCost: true,
      source: 'BQ: meta_ads_insights (spend) joined to Stripe ticket purchases',
      calc: 'SUM(spend) / COUNT(DISTINCT stripe_ticket_purchases) for date range',
    },
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

  try { _renderCampaignTable(tableCard, campaigns || []); } catch (e) { console.warn('Campaign table error:', e); }

  // ---- Render charts after DOM settles ----
  requestAnimationFrame(() => {
    try { _renderRoasChart(roasDiv, adsets || []); } catch (e) { console.warn('ROAS chart error:', e); }
    try { _renderDailyChart(trendCanvas, daily || []); } catch (e) { console.warn('Daily chart error:', e); }
  });

  // ---- Unit Economics Panel ----
  try { _renderUnitEcon(container, unitEconData, totalSpend); } catch (e) { console.warn('Unit econ error:', e); }

  // ---- Source Attribution Table ----
  try { _renderSourceAttribution(container); } catch (e) { console.warn('Source attribution error:', e); }

  // ---- Demographic Intelligence Panel ----
  try { _renderDemographicIntel(container); } catch (e) { console.warn('Demographic intel error:', e); }
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

  // ---- Niche detection from campaign name ----
  const NICHE_RULES = [
    { key: 'therapists', label: 'THERAPISTS', color: '#22c55e', keywords: ['therap', 'counselor', 'psycholog', 'licensed', 'clinical', 'lmft', 'lcsw', 'lpc'] },
    { key: 'attorneys',  label: 'ATTORNEYS',  color: '#f59e0b', keywords: ['attorney', 'lawyer', 'law ', 'legal'] },
    { key: 'coaches',    label: 'COACHES',    color: '#3b82f6', keywords: ['coach', 'consultant', 'transformation'] },
    { key: 'educators',  label: 'EDUCATORS',  color: '#a855f7', keywords: ['educator', 'teacher', 'course creator', 'trainer'] },
    { key: 'broad',      label: 'BROAD / MIXED', color: '#64748b', keywords: ['broad', 'cbo', 'stacked', 'interest stack', 'lla stack', 'advantage'] },
  ];

  function detectNiche(name) {
    const lower = (name || '').toLowerCase();
    for (const rule of NICHE_RULES) {
      if (rule.keywords.some(kw => lower.includes(kw))) return rule;
    }
    return { key: 'other', label: 'OTHER', color: '#475569', keywords: [] };
  }

  // Group campaigns by niche
  const nicheGroups = {};
  const rows = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0));
  rows.forEach(row => {
    const niche = detectNiche(row.campaign_name);
    if (!nicheGroups[niche.key]) nicheGroups[niche.key] = { niche, campaigns: [] };
    nicheGroups[niche.key].campaigns.push(row);
  });

  // Order: therapists, attorneys, coaches, educators, broad, other
  const nicheOrder = ['therapists', 'attorneys', 'coaches', 'educators', 'broad', 'other'];
  const sortedGroups = nicheOrder
    .filter(k => nicheGroups[k])
    .map(k => nicheGroups[k]);

  // ---- Filter dropdowns ----
  const filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'display:flex;gap:10px;margin-bottom:14px';

  const nicheSelect = document.createElement('select');
  nicheSelect.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:${Theme.COLORS.textPrimary};font-size:12px;padding:6px 10px;outline:none`;
  nicheSelect.innerHTML = `<option value="">All Niches</option>` + sortedGroups.map(g => `<option value="${g.niche.key}">${g.niche.label}</option>`).join('');

  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = nicheSelect.style.cssText;
  statusSelect.innerHTML = `<option value="">All Statuses</option><option value="active">Active (spending)</option><option value="paused">Paused (no spend)</option>`;

  filterWrap.appendChild(nicheSelect);
  filterWrap.appendChild(statusSelect);
  card.appendChild(filterWrap);

  // ---- Table wrapper ----
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow-x:auto;margin-top:4px';
  card.appendChild(wrapper);

  const cols = [
    { key: 'campaign_name', label: 'Campaign',    fmt: (v) => `<span style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block">${v || '--'}</span>` },
    { key: '_niche',        label: 'Niche',        fmt: (v, row) => { const n = detectNiche(row.campaign_name); return `<span style="background:${n.color}22;color:${n.color};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600">${n.label.split(' ')[0]}</span>`; } },
    { key: '_status',       label: 'Status',       fmt: (v, row) => { const active = (row.spend || 0) > 0; return `<span style="color:${active ? Theme.COLORS.success : Theme.COLORS.textMuted}">&#9679; ${active ? 'Active' : 'Paused'}</span>`; } },
    { key: 'spend',         label: 'Spend',        fmt: (v) => Theme.money(v || 0) },
    { key: 'impressions',   label: 'Impr.',        fmt: (v) => Theme.num(v || 0) },
    { key: 'clicks',        label: 'Clicks',       fmt: (v) => Theme.num(v || 0) },
    { key: 'ctr',           label: 'CTR',          fmt: (v) => (+(v || 0)).toFixed(2) + '%' },
    { key: 'cpc',           label: 'CPC',          fmt: (v) => Theme.money(v || 0) },
    { key: 'cpm',           label: 'CPM',          fmt: (v) => Theme.money(v || 0) },
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

  function renderTable() {
    const filterNiche = nicheSelect.value;
    const filterStatus = statusSelect.value;
    const groups = filterNiche ? sortedGroups.filter(g => g.niche.key === filterNiche) : sortedGroups;

    const thead = `<thead><tr>${cols.map(c => `<th style="${thStyle}">${c.label}</th>`).join('')}</tr></thead>`;
    let tbody = '';

    groups.forEach(group => {
      const filtered = group.campaigns.filter(row => {
        if (filterStatus === 'active' && (row.spend || 0) <= 0) return false;
        if (filterStatus === 'paused' && (row.spend || 0) > 0) return false;
        return true;
      });
      if (filtered.length === 0) return;

      // Niche section header
      tbody += `<tr><td colspan="${cols.length}" style="padding:14px 12px 6px;font-size:12px;font-weight:700;color:${group.niche.color};letter-spacing:.06em;border-bottom:1px solid ${group.niche.color}33">${group.niche.label}</td></tr>`;

      filtered.forEach(row => {
        const cells = cols.map(c => `<td style="${tdStyle};font-family:${c.key === 'campaign_name' ? 'Inter,sans-serif' : 'var(--font-mono)'};font-weight:${c.key === 'campaign_name' ? '500' : '400'}">${c.fmt(row[c.key], row)}</td>`).join('');
        tbody += `<tr onmouseenter="this.style.background='rgba(255,255,255,0.03)'" onmouseleave="this.style.background=''" style="cursor:pointer" data-campaign="${(row.campaign_name || '').replace(/"/g, '&quot;')}">${cells}</tr>`;
      });
    });

    wrapper.innerHTML = `<table style="width:100%;border-collapse:collapse">${thead}<tbody>${tbody}</tbody></table>`;

    // Row click -> drill-down
    wrapper.querySelectorAll('tbody tr[data-campaign]').forEach(tr => {
      tr.addEventListener('click', () => {
        const name = tr.dataset.campaign;
        const row = rows.find(r => r.campaign_name === name);
        if (row && typeof Components.openDrillDown === 'function') {
          Components.openDrillDown(`Campaign: ${row.campaign_name}`, async () => [row]);
        }
      });
    });
  }

  nicheSelect.addEventListener('change', renderTable);
  statusSelect.addEventListener('change', renderTable);
  renderTable();
}

// ---------------------------------------------------------------------------
// Unit Economics Panel
// ---------------------------------------------------------------------------

const UE_LS_KEY = 'cod_unit_econ';

function _ueLoadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(UE_LS_KEY) || '{}');
  } catch (_) { return {}; }
}

function _ueSavePrefs(prefs) {
  try { localStorage.setItem(UE_LS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

function _ueMoney(n) {
  if (isNaN(n) || n === null) return '--';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _ueNum(n, decimals) {
  if (isNaN(n) || n === null) return '--';
  return Number(n).toFixed(decimals !== undefined ? decimals : 2);
}

function _renderUnitEcon(container, rawData, fallbackSpend) {
  const ue = (rawData && rawData.length > 0) ? rawData[0] : {};
  const prefs = _ueLoadPrefs();

  // Live data from BQ (or 0 if unavailable)
  const orderCount = +(ue.order_count || 0);
  const aov        = +(ue.aov        || 103);   // COD benchmark fallback
  const revenue    = +(ue.revenue    || 0);
  const adSpend    = +(ue.total_spend || fallbackSpend || 0);
  const liveCpa    = +(ue.cpa        || 0);

  // User-adjustable defaults (localStorage or hardcoded benchmarks)
  const cogsPctDefault   = prefs.cogsPct    !== undefined ? prefs.cogsPct    : 35;
  const fixedCostDefault = prefs.fixedCost  !== undefined ? prefs.fixedCost  : 13503;
  const ltvDefault       = prefs.ltv        !== undefined ? prefs.ltv        : 140;

  // ---- Section header ----
  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary};letter-spacing:-.01em">Unit Economics</div>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Live breakeven model powered by BQ data &mdash; ${orderCount > 0 ? orderCount.toLocaleString() + ' orders in window' : 'BQ data unavailable, using fallbacks'}</div>
  `;
  container.appendChild(header);

  // ---- Two-column grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px';
  container.appendChild(grid);

  // ---- Input style helper ----
  const inputStyle = `
    background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.12);
    border-radius:6px;
    color:${Theme.COLORS.textPrimary};
    font-family:'JetBrains Mono',monospace;
    font-size:13px;
    padding:4px 8px;
    width:90px;
    outline:none;
    transition:border-color .15s;
  `.replace(/\n\s*/g, '');

  // ---- Row helper ----
  function ueRow(label, valueHtml, muted) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="font-size:12px;color:${muted ? Theme.COLORS.textMuted : Theme.COLORS.textSecondary}">${label}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary}">${valueHtml}</span>
      </div>`;
  }

  function ueInputRow(label, inputId) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="font-size:12px;color:${Theme.COLORS.textSecondary}">${label}</span>
        <input id="${inputId}" style="${inputStyle}" />
      </div>`;
  }

  // ---- Left card: Breakeven Model ----
  const leftCard = document.createElement('div');
  leftCard.className = 'card';
  leftCard.style.cssText = 'padding:20px';
  leftCard.innerHTML = `
    <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">Breakeven Model</div>
    <div id="ue-breakeven-rows"></div>
  `;
  grid.appendChild(leftCard);

  // ---- Right card: 12-Month Gravy Value ----
  const rightCard = document.createElement('div');
  rightCard.className = 'card';
  rightCard.style.cssText = 'padding:20px';
  rightCard.innerHTML = `
    <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">12-Month Gravy Value</div>
    <div id="ue-gravy-rows"></div>
  `;
  grid.appendChild(rightCard);

  // ---- Render breakeven rows (with inputs) ----
  const breakevenContainer = leftCard.querySelector('#ue-breakeven-rows');
  breakevenContainer.innerHTML = `
    ${ueRow('Orders (BQ)', orderCount > 0 ? orderCount.toLocaleString() : '--', true)}
    ${ueRow('AOV (BQ)',    _ueMoney(aov), true)}
    ${ueRow('Revenue (BQ)', _ueMoney(revenue), true)}
    ${ueRow('Ad Spend (BQ)', _ueMoney(adSpend), true)}
    ${ueRow('CPA (BQ)',     _ueMoney(liveCpa), true)}
    ${ueInputRow('COGS %',      'ue-cogs-pct')}
    ${ueInputRow('Fixed Costs', 'ue-fixed-cost')}
    <div id="ue-computed-rows"></div>
  `;

  // ---- Render gravy rows (with LTV input) ----
  const gravyContainer = rightCard.querySelector('#ue-gravy-rows');
  gravyContainer.innerHTML = `
    ${ueInputRow('LTV ($)', 'ue-ltv')}
    <div id="ue-gravy-computed-rows"></div>
  `;

  // ---- Wire up inputs ----
  const cogsPctInput  = leftCard.querySelector('#ue-cogs-pct');
  const fixedCostInput = leftCard.querySelector('#ue-fixed-cost');
  const ltvInput       = rightCard.querySelector('#ue-ltv');

  cogsPctInput.value   = cogsPctDefault;
  fixedCostInput.value = fixedCostDefault;
  ltvInput.value       = ltvDefault;

  // Focus highlight
  [cogsPctInput, fixedCostInput, ltvInput].forEach(inp => {
    inp.addEventListener('focus',  () => inp.style.borderColor = Theme.COLORS.accent || '#6c8fff');
    inp.addEventListener('blur',   () => inp.style.borderColor = 'rgba(255,255,255,0.12)');
  });

  function recompute() {
    const cogsPct   = parseFloat(cogsPctInput.value)   || 0;
    const fixedCost = parseFloat(fixedCostInput.value) || 0;
    const ltv       = parseFloat(ltvInput.value)       || 140;

    // Save prefs
    _ueSavePrefs({ cogsPct, fixedCost, ltv });

    // Breakeven calculations
    const cogsAmt      = revenue * (cogsPct / 100);
    const grossMargin  = revenue - cogsAmt;
    const profit       = grossMargin - fixedCost - adSpend;
    const breakevenRoi = adSpend > 0 ? revenue / adSpend : 0;
    const breakevenCpa = orderCount > 0 ? adSpend / orderCount : liveCpa;
    const adSpendPct   = revenue > 0 ? (adSpend / revenue) * 100 : 0;

    const profitColor  = profit >= 0 ? Theme.COLORS.success : Theme.COLORS.danger;

    leftCard.querySelector('#ue-computed-rows').innerHTML = `
      <div style="height:8px"></div>
      ${ueRow('COGS $',            _ueMoney(cogsAmt))}
      ${ueRow('Gross Margin',      _ueMoney(grossMargin))}
      ${ueRow('Profit', `<span style="color:${profitColor}">${_ueMoney(profit)}</span>`)}
      ${ueRow('Breakeven ROI',     _ueNum(breakevenRoi) + 'x')}
      ${ueRow('Breakeven CPA',     _ueMoney(breakevenCpa))}
      ${ueRow('Ad Spend %',        _ueNum(adSpendPct, 1) + '%')}
    `;

    // Gravy calculations
    const cpa         = breakevenCpa || liveCpa || 0;
    const ltvMultiple = aov > 0   ? ltv / aov   : 0;
    const ltvCac      = cpa > 0   ? ltv / cpa   : 0;
    const ltRevenue   = orderCount * ltv;
    const ltProfit    = ltRevenue - (orderCount * cpa) - fixedCost - (ltRevenue * (cogsPct / 100));
    const ltProfitColor = ltProfit >= 0 ? Theme.COLORS.success : Theme.COLORS.danger;

    rightCard.querySelector('#ue-gravy-computed-rows').innerHTML = `
      <div style="height:8px"></div>
      ${ueRow('AOV',              _ueMoney(aov), true)}
      ${ueRow('LTV Multiple',    _ueNum(ltvMultiple) + 'x')}
      ${ueRow('LTV:CAC',         _ueNum(ltvCac) + 'x')}
      ${ueRow('LT Revenue',      _ueMoney(ltRevenue))}
      ${ueRow('LT Profit', `<span style="color:${ltProfitColor}">${_ueMoney(ltProfit)}</span>`)}
    `;
  }

  // Initial render + wire events
  recompute();
  [cogsPctInput, fixedCostInput, ltvInput].forEach(inp => {
    inp.addEventListener('input', recompute);
  });

  // ---- Responsive: stack on mobile ----
  const mq = window.matchMedia('(max-width: 768px)');
  function onResize(e) {
    grid.style.gridTemplateColumns = e.matches ? '1fr' : '1fr 1fr';
  }
  onResize(mq);
  mq.addEventListener('change', onResize);
}

// ---------------------------------------------------------------------------
// Source Attribution Table (Hyros-style)
// ---------------------------------------------------------------------------

function _renderSourceAttribution(container) {
  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">Purchase Source Attribution</div>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Source, cost, revenue, profit from Hyros + Meta data</div>
  `;
  container.appendChild(header);

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:20px 24px;overflow-x:auto';

  const data = [
    { source: 'Main Interest Stack - FB - Coa', cost: 6606, revenue: 18378, profit: 11772, sales: 13, creative: { type: 'image', thumb: 'https://placehold.co/300x300/1a1f2e/38bdf8?text=Interest+Stack', headline: 'Transform Your Practice in 90 Days' } },
    { source: 'LLA Stack - FB - Coaches Con', cost: 5047, revenue: 12378, profit: 7331, sales: 14, creative: { type: 'video', thumb: 'https://placehold.co/300x300/1a1f2e/a855f7?text=LLA+Coaches+Video', headline: 'How Coaches Are Scaling to $50K/mo' } },
    { source: 'Broad + CBO Licensed Therap', cost: 10483, revenue: 9729, profit: -754, sales: 21, creative: { type: 'image', thumb: 'https://placehold.co/300x300/1a1f2e/22c55e?text=Therapist+CBO', headline: 'Licensed Therapist? Your Practice Deserves More' } },
    { source: 'FB. 3064 Broad - Educator / Te', cost: 2749, revenue: 9243, profit: 6494, sales: 8, creative: { type: 'image', thumb: 'https://placehold.co/300x300/1a1f2e/f59e0b?text=Educator+3064', headline: 'Educators: Build a Business That Matches Your Impact' } },
    { source: 'TOF | Video | MC | KW', cost: 0, revenue: 9000, profit: 9000, sales: 1, creative: { type: 'video', thumb: 'https://placehold.co/300x300/1a1f2e/38bdf8?text=TOF+Video', headline: 'Watch: Client Success Story' } },
    { source: 'Direct Traffic', cost: 0, revenue: 6162, profit: 0, sales: 6, creative: null },
    { source: 'Fb. Broad - Attorney Only - Co', cost: 4659, revenue: 297, profit: -4362, sales: 8, creative: { type: 'image', thumb: 'https://placehold.co/300x300/1a1f2e/ef4444?text=Attorney+Broad', headline: 'Attorneys: Stop Trading Time for Money' } },
    { source: 'FB. 3564 Broad - Educator / Te', cost: 3802, revenue: 297, profit: -3505, sales: 6, creative: { type: 'image', thumb: 'https://placehold.co/300x300/1a1f2e/ef4444?text=Educator+3564', headline: 'Your Teaching Skills Are Worth More' } }
  ];

  const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;font-family:'JetBrains Mono',monospace`;

  const rows = data.map((r, i) => {
    const profitColor = r.profit > 0 ? Theme.COLORS.success : (r.profit < 0 ? Theme.COLORS.danger : Theme.COLORS.textSecondary);
    const creativeCell = r.creative
      ? `<td style="${tdStyle};position:relative;cursor:pointer" class="src-creative-cell" data-idx="${i}">
           <div style="display:flex;align-items:center;gap:8px">
             <div style="width:32px;height:32px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
               <img src="${r.creative.thumb}" style="width:100%;height:100%;object-fit:cover;border-radius:3px" loading="lazy" />
             </div>
             <span style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase">${r.creative.type === 'video' ? '&#9654; Video' : 'Image'}</span>
           </div>
         </td>`
      : `<td style="${tdStyle};color:${Theme.COLORS.textMuted};font-size:11px">--</td>`;
    return `<tr>
      <td style="${tdStyle};color:${Theme.COLORS.textPrimary};font-weight:500;font-family:Inter,sans-serif">${r.source}</td>
      ${creativeCell}
      <td style="${tdStyle}">${Theme.money(r.cost)}</td>
      <td style="${tdStyle}">${Theme.money(r.revenue)}</td>
      <td style="${tdStyle};color:${profitColor};font-weight:600">${r.profit < 0 ? '-' : ''}${Theme.money(Math.abs(r.profit))}</td>
      <td style="${tdStyle};text-align:center">${r.sales}</td>
    </tr>`;
  }).join('');

  card.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${thStyle}">Source</th>
        <th style="${thStyle}">Creative</th>
        <th style="${thStyle}">Cost</th>
        <th style="${thStyle}">Total Revenue</th>
        <th style="${thStyle}">Profit</th>
        <th style="${thStyle};text-align:center">Sales</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div id="src-creative-tooltip" style="
      display:none;position:fixed;z-index:9999;pointer-events:none;
      background:#141824;border:1px solid rgba(255,255,255,0.15);border-radius:10px;
      padding:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:280px;
    ">
      <img id="src-tooltip-img" style="width:250px;border-radius:6px;margin-bottom:8px" />
      <div id="src-tooltip-headline" style="font-size:12px;font-weight:600;color:${Theme.COLORS.textPrimary};line-height:1.4"></div>
      <div id="src-tooltip-type" style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:4px;text-transform:uppercase;letter-spacing:0.05em"></div>
    </div>
  `;

  // Creative hover expand
  const tooltip = card.querySelector('#src-creative-tooltip');
  const tooltipImg = card.querySelector('#src-tooltip-img');
  const tooltipHead = card.querySelector('#src-tooltip-headline');
  const tooltipType = card.querySelector('#src-tooltip-type');

  card.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.src-creative-cell');
    if (!cell) return;
    const idx = +cell.dataset.idx;
    const cr = data[idx]?.creative;
    if (!cr) return;
    tooltipImg.src = cr.thumb;
    tooltipHead.textContent = cr.headline;
    tooltipType.textContent = cr.type === 'video' ? 'Video Ad' : 'Image Ad';
    tooltip.style.display = 'block';
  });

  card.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top = (e.clientY - 80) + 'px';
    }
  });

  card.addEventListener('mouseout', (e) => {
    const cell = e.target.closest('.src-creative-cell');
    if (cell && !cell.contains(e.relatedTarget)) {
      tooltip.style.display = 'none';
    }
    if (!e.relatedTarget?.closest('.src-creative-cell')) {
      tooltip.style.display = 'none';
    }
  });
  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Demographic Intelligence Panel
// ---------------------------------------------------------------------------

let _demoActiveStat = 'enroll_rate';

function _renderDemographicIntel(container) {

  const STAT_LABELS = {
    ticket_rate: 'Ticket Rate',
    vip_rate: 'VIP Rate',
    show_rate: 'Show Rate',
    book_rate: 'Book Rate',
    call_show: 'Call Show',
    enroll_rate: 'Enroll Rate',
    ltv: 'LTV',
  };

  const STAT_KEYS = Object.keys(STAT_LABELS);

  const DEMO_DATA = {
    gender: {
      title: 'Gender',
      segments: ['Women', 'Men'],
      stats: {
        ticket_rate: [4.2, 3.8],
        vip_rate: [36, 24],
        show_rate: [74, 68],
        book_rate: [34, 28],
        call_show: [82, 76],
        enroll_rate: [8.2, 3.1],
        ltv: [11200, 8400],
      },
    },
    age: {
      title: 'Age',
      segments: ['25-34', '35-44', '45-54', '55-64'],
      stats: {
        ticket_rate: [3.1, 4.6, 4.2, 2.9],
        vip_rate: [22, 34, 31, 19],
        show_rate: [62, 76, 72, 64],
        book_rate: [24, 36, 32, 22],
        call_show: [70, 84, 80, 72],
        enroll_rate: [4.1, 8.8, 7.2, 3.9],
        ltv: [7800, 12400, 10800, 7200],
      },
    },
    profession: {
      title: 'Profession / Segment',
      segments: ['Therapists', 'Attorneys', 'Coaches', 'Educators'],
      stats: {
        ticket_rate: [5.1, 4.4, 3.6, 3.2],
        vip_rate: [38, 32, 26, 22],
        show_rate: [78, 74, 68, 64],
        book_rate: [38, 34, 28, 24],
        call_show: [86, 82, 76, 72],
        enroll_rate: [9.1, 7.8, 5.2, 4.1],
        ltv: [13200, 11800, 9200, 7600],
      },
    },
    device: {
      title: 'Device Platform',
      segments: ['Mobile', 'Desktop'],
      stats: {
        ticket_rate: [4.0, 4.3],
        vip_rate: [28, 34],
        show_rate: [70, 76],
        book_rate: [30, 36],
        call_show: [78, 84],
        enroll_rate: [5.8, 8.4],
        ltv: [9400, 11600],
      },
    },
    location: {
      title: 'Location (Top States)',
      segments: ['California', 'Texas', 'Florida', 'New York', 'Illinois'],
      stats: {
        ticket_rate: [4.4, 4.1, 4.6, 3.8, 3.9],
        vip_rate: [32, 30, 34, 28, 29],
        show_rate: [74, 72, 76, 70, 71],
        book_rate: [34, 32, 36, 30, 31],
        call_show: [82, 80, 84, 78, 79],
        enroll_rate: [7.2, 6.8, 8.1, 5.9, 6.3],
        ltv: [11400, 10800, 12200, 9800, 10200],
      },
    },
    placement: {
      title: 'Placement',
      segments: ['Instagram Feed', 'Facebook Feed', 'Instagram Reels', 'Facebook Reels'],
      stats: {
        ticket_rate: [4.6, 3.8, 5.1, 2.9],
        vip_rate: [34, 28, 38, 20],
        show_rate: [76, 70, 78, 64],
        book_rate: [36, 30, 38, 24],
        call_show: [84, 78, 86, 72],
        enroll_rate: [7.4, 5.1, 8.9, 3.2],
        ltv: [11600, 9400, 13000, 7400],
      },
    },
  };

  // ---- Inject responsive style ----
  const styleId = 'demo-intel-responsive';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      @media (max-width: 768px) {
        .demo-intel-grid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  // ---- Section header ----
  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary};letter-spacing:-.01em">Demographic Intelligence</div>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Buyer profiles from enrolled customers -- mirrors Facebook targeting dimensions</div>
  `;
  container.appendChild(header);

  // ---- 3x2 grid ----
  const grid = document.createElement('div');
  grid.className = 'demo-intel-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px';
  container.appendChild(grid);

  const funnelColors = [
    Theme.FUNNEL.blue,
    Theme.FUNNEL.cyan,
    Theme.FUNNEL.green,
    Theme.FUNNEL.orange,
    Theme.FUNNEL.purple,
  ];

  // Track all card render functions for global re-render
  const cardRenderers = [];
  function formatStatValue(statKey, value) {
    if (statKey === 'ltv') return Theme.money(value);
    return value.toFixed(1) + '%';
  }

  // ---- Build each dimension card ----
  Object.keys(DEMO_DATA).forEach((dimKey) => {
    const dim = DEMO_DATA[dimKey];
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:20px';

    // Card title
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px`;
    titleDiv.textContent = dim.title;
    card.appendChild(titleDiv);

    // Toggle row
    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px';
    card.appendChild(toggleRow);

    // Bar container
    const barContainer = document.createElement('div');
    card.appendChild(barContainer);

    function renderBars() {
      const statKey = _demoActiveStat;
      const values = dim.stats[statKey];
      const maxVal = Math.max(...values);

      let html = '';
      dim.segments.forEach((seg, i) => {
        const pct = maxVal > 0 ? (values[i] / maxVal) * 100 : 0;
        const color = funnelColors[i % funnelColors.length];
        const formattedVal = formatStatValue(statKey, values[i]);
        html += `
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <span style="font-size:11px;color:${Theme.COLORS.textSecondary}">${seg}</span>
              <span style="font-size:11px;font-weight:600;color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace">${formattedVal}</span>
            </div>
            <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .3s ease"></div>
            </div>
          </div>
        `;
      });
      barContainer.innerHTML = html;
    }

    function renderToggles() {
      toggleRow.innerHTML = '';
      STAT_KEYS.forEach((sk) => {
        const btn = document.createElement('button');
        const isActive = sk === _demoActiveStat;
        btn.textContent = STAT_LABELS[sk];
        btn.style.cssText = `
          font-size:10px;
          padding:3px 8px;
          border-radius:4px;
          cursor:pointer;
          font-weight:${isActive ? '600' : '400'};
          border:1px solid ${isActive ? 'transparent' : Theme.COLORS.border};
          background:${isActive ? Theme.COLORS.accent : 'transparent'};
          color:${isActive ? '#fff' : Theme.COLORS.textMuted};
          transition:all .15s;
          outline:none;
          line-height:1.4;
        `.replace(/\n\s*/g, '');
        btn.addEventListener('click', () => {
          _demoActiveStat = sk;
          // Re-render all cards and cross-tab
          cardRenderers.forEach((fn) => fn());
          renderCrossTab();
        });
        toggleRow.appendChild(btn);
      });
    }

    function renderCard() {
      renderToggles();
      renderBars();
    }

    cardRenderers.push(renderCard);
    renderCard();
    grid.appendChild(card);
  });

}
