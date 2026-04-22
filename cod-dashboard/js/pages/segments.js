/* ============================================
   Segments -- Niche Funnel + Geo Intelligence +
   Meta Demographics (live BQ data)
   ============================================ */

App.registerPage('segments', async (container) => {
  const days = Filters.getDays();
  const T = Theme.COLORS;

  let nicheData;
  try {
    nicheData = await API.query('segments', 'nicheFunnel', { days });
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Segments: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';
  const rows = nicheData || [];

  // ---- Section 1: KPI Strip ----
  const totalContacts = rows.reduce((s, r) => s + (r.contacts || 0), 0);
  const totalEnrolled = rows.reduce((s, r) => s + (r.enrolled || 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + (parseFloat(r.revenue) || 0), 0);
  const topSeg = rows.length > 0 ? [...rows].sort((a, b) => (b.enrolled || 0) - (a.enrolled || 0))[0] : null;
  const bestConv = rows.length > 0 ? [...rows].sort((a, b) => (b.enroll_rate || 0) - (a.enroll_rate || 0))[0] : null;

  const kpiEl = document.createElement('div');
  container.appendChild(kpiEl);
  Components.renderKPIStrip(kpiEl, [
    { label: 'Total Contacts',    value: totalContacts,  format: 'num' },
    { label: 'Total Enrollments',  value: totalEnrolled, format: 'num' },
    { label: 'Total Revenue',     value: totalRevenue,   format: 'money' },
    { label: 'Top Segment',       value: topSeg ? topSeg.profession : '--', format: 'text' },
    { label: 'Best Conversion',   value: bestConv ? `${bestConv.profession} (${(bestConv.enroll_rate || 0).toFixed(1)}%)` : '--', format: 'text' },
    { label: 'Segments Tracked',  value: rows.length,    format: 'num' },
  ]);

  // ---- Section 2: Niche Comparison Table (sortable) ----
  const tableSection = document.createElement('div');
  tableSection.style.cssText = 'margin-top:24px';
  tableSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${T.textPrimary};margin-bottom:12px">Niche Funnel Comparison</h3>`;
  container.appendChild(tableSection);

  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  tableCard.style.cssText = 'padding:20px;overflow-x:auto';
  tableSection.appendChild(tableCard);

  const columns = [
    { key: 'profession',   label: 'Segment',   align: 'left',  fmt: v => v || 'Unknown' },
    { key: 'contacts',     label: 'Contacts',   align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'tickets',      label: 'Tickets',    align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'ticket_rate',  label: 'Ticket%',    align: 'right', fmt: v => (v || 0).toFixed(1) + '%' },
    { key: 'attended',     label: 'Attended',   align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'show_rate',    label: 'Show%',      align: 'right', fmt: v => (v || 0).toFixed(1) + '%' },
    { key: 'booked',       label: 'Booked',     align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'book_rate',    label: 'Book%',      align: 'right', fmt: v => (v || 0).toFixed(1) + '%' },
    { key: 'enrolled',     label: 'Enrolled',   align: 'right', fmt: v => Theme.num(v || 0) },
    { key: 'enroll_rate',  label: 'Enroll%',    align: 'right', fmt: v => (v || 0).toFixed(1) + '%', color: v => (v || 0) >= 10 ? '#22c55e' : (v || 0) >= 5 ? '#f59e0b' : '#ef4444' },
    { key: 'revenue',      label: 'Revenue',    align: 'right', fmt: v => Theme.money(parseFloat(v) || 0) },
    { key: 'avg_deal',     label: 'Avg Deal',   align: 'right', fmt: v => Theme.money(parseFloat(v) || 0) },
  ];

  let sortKey = 'revenue';
  let sortAsc = false;

  function renderNicheTable() {
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortAsc ? (av || '').localeCompare(bv || '') : (bv || '').localeCompare(av || '');
      return sortAsc ? ((av || 0) - (bv || 0)) : ((bv || 0) - (av || 0));
    });

    let html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>';
    columns.forEach(c => {
      const arrow = sortKey === c.key ? (sortAsc ? ' &#9650;' : ' &#9660;') : '';
      html += `<th data-sort="${c.key}" style="text-align:${c.align};padding:8px 10px;color:${T.textMuted};border-bottom:1px solid rgba(255,255,255,0.07);cursor:pointer;user-select:none;white-space:nowrap">${c.label}${arrow}</th>`;
    });
    html += '</tr></thead><tbody>';
    sorted.forEach(r => {
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">';
      columns.forEach(c => {
        const val = r[c.key];
        const cellColor = c.color ? c.color(val) : (c.key === 'profession' ? T.textPrimary : T.textSecondary);
        html += `<td style="padding:8px 10px;text-align:${c.align};color:${cellColor};white-space:nowrap">${c.fmt(val)}</td>`;
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
        renderNicheTable();
      });
    });
  }
  renderNicheTable();

  // ---- Section 3: Segment Funnel Bars ----
  const COLORS = { 'Therapists': '#3b82f6', 'Coaches': '#a855f7', 'Attorneys': '#06b6d4', 'Educators': '#f97316', 'Health & Wellness': '#ec4899', 'Real Estate': '#14b8a6', 'Financial': '#8b5cf6' };
  const stages = ['contacts', 'tickets', 'attended', 'booked', 'enrolled'];
  const stageLabels = ['Contacts', 'Tickets', 'Attended', 'Booked', 'Enrolled'];

  const barsSection = document.createElement('div');
  barsSection.style.cssText = 'margin-top:24px';
  barsSection.innerHTML = `<h3 style="font-size:15px;font-weight:600;color:${T.textPrimary};margin-bottom:12px">Segment Funnel Progression</h3>`;
  container.appendChild(barsSection);

  const barsCard = document.createElement('div');
  barsCard.className = 'card';
  barsCard.style.cssText = 'padding:20px';
  barsSection.appendChild(barsCard);

  const maxByStage = stages.map(s => Math.max(...rows.map(r => r[s] || 0), 1));

  rows.forEach(r => {
    const color = COLORS[r.profession] || '#6b7280';
    let html = `<div style="margin-bottom:20px"><div style="font-size:13px;font-weight:600;color:${T.textPrimary};margin-bottom:8px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle"></span>${r.profession}</div>`;
    stages.forEach((s, i) => {
      const val = r[s] || 0;
      const pct = Math.max((val / maxByStage[i]) * 100, 2);
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div style="width:70px;font-size:11px;color:${T.textMuted};text-align:right;flex-shrink:0">${stageLabels[i]}</div>
        <div style="flex:1;height:18px;background:rgba(255,255,255,0.04);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;opacity:${0.4 + (i * 0.15)}"></div>
        </div>
        <div style="width:40px;font-size:11px;color:${T.textSecondary};text-align:right;flex-shrink:0">${Theme.num(val)}</div>
      </div>`;
    });
    html += '</div>';
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    barsCard.appendChild(wrapper);
  });

  // ---- Section 4: Geographic Intelligence (absorbed from geo-intel) ----
  await _renderGeoSection(container, days);

  // ---- Section 5: Demographic Intelligence (existing) ----
  _renderDemographicIntel(container);
});

App.onFilterChange(() => App.navigate('segments'));

// ---- Geographic Intelligence Panel ----
async function _renderGeoSection(container, days) {
  const T = Theme.COLORS;

  let stateData, deadZones;
  try {
    [stateData, deadZones] = await Promise.all([
      API.query('geo-intel', 'states', { days }),
      API.query('geo-intel', 'deadZones', { days }),
    ]);
  } catch (err) {
    const errEl = document.createElement('div');
    errEl.className = 'card';
    errEl.style.cssText = 'padding:20px;margin-top:24px';
    errEl.innerHTML = `<p class="text-muted">Geographic data unavailable: ${err.message}</p>`;
    container.appendChild(errEl);
    return;
  }

  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;color:${T.textPrimary};margin-bottom:4px">Geographic Intelligence</h3>
    <div style="font-size:12px;color:${T.textMuted}">Revenue density and dead zone analysis by US state</div>`;
  container.appendChild(header);

  // Geo KPI strip
  const states = stateData || [];
  const dzRows = deadZones || [];
  const stateCount = new Set(states.map(r => r.state).filter(Boolean)).size;
  const topState = states.length > 0 ? states[0].state : '--';
  const wastedSpend = dzRows.reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);
  const roasRanked = states.filter(r => r.roas != null && isFinite(r.roas) && r.roas > 0).sort((a, b) => (parseFloat(b.roas) || 0) - (parseFloat(a.roas) || 0));
  const bestRoas = roasRanked.length > 0 ? `${roasRanked[0].state} (${parseFloat(roasRanked[0].roas).toFixed(1)}x)` : '--';

  const geoKpi = document.createElement('div');
  container.appendChild(geoKpi);
  Components.renderKPIStrip(geoKpi, [
    { label: 'States with Revenue', value: stateCount,   format: 'num' },
    { label: 'Top State',           value: topState,     format: 'text' },
    { label: 'Wasted in Dead Zones', value: wastedSpend, format: 'money', invertCost: true },
    { label: 'Best ROAS State',     value: bestRoas,     format: 'text' },
  ]);

  // Choropleth (full width)
  const mapCard = document.createElement('div');
  mapCard.className = 'card';
  mapCard.style.cssText = 'padding:20px;margin-top:12px';
  const mapDiv = document.createElement('div');
  mapDiv.id = 'seg-choropleth';
  mapDiv.style.height = '400px';
  mapCard.appendChild(mapDiv);
  container.appendChild(mapCard);

  // 2-column grid: state bars + dead zones
  const geoGrid = document.createElement('div');
  geoGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(geoGrid);

  if (!document.getElementById('seg-geo-responsive')) {
    const style = document.createElement('style');
    style.id = 'seg-geo-responsive';
    style.textContent = '@media(max-width:768px){.seg-geo-grid{grid-template-columns:1fr!important}}';
    document.head.appendChild(style);
    geoGrid.classList.add('seg-geo-grid');
  }

  // State bars
  const barCard = document.createElement('div');
  barCard.className = 'card';
  barCard.style.cssText = 'padding:20px';
  barCard.innerHTML = `<div style="font-size:14px;font-weight:600;color:${T.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Top 15 States by Revenue</div>`;
  const barDiv = document.createElement('div');
  barDiv.id = 'seg-state-bars';
  barDiv.style.height = '440px';
  barCard.appendChild(barDiv);
  geoGrid.appendChild(barCard);

  // Dead zones table
  const dzCard = document.createElement('div');
  dzCard.className = 'card';
  dzCard.style.cssText = 'padding:20px;border:1px solid rgba(231,76,60,0.3);background:rgba(231,76,60,0.04)';
  dzCard.innerHTML = `
    <div style="font-size:14px;font-weight:600;color:#e74c3c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Dead Zones: Spend &gt; $500, Zero Enrollments</div>
    <div style="font-size:12px;color:${T.textMuted};margin-bottom:16px">${dzRows.length} location${dzRows.length !== 1 ? 's' : ''} spending money with no conversions</div>`;
  dzCard.appendChild(_geoDeadZoneTable(dzRows));
  geoGrid.appendChild(dzCard);

  // Render Plotly charts
  requestAnimationFrame(() => {
    _geoChoropleth(mapDiv, states);
    _geoStateBars(barDiv, states);
  });
}

function _geoChoropleth(el, stateData) {
  if (!stateData || stateData.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No state data available.</p>`;
    return;
  }

  Plotly.newPlot(el, [{
    type: 'choropleth',
    locationmode: 'USA-states',
    locations: stateData.map(r => r.state || ''),
    z: stateData.map(r => parseFloat(r.revenue) || 0),
    text: stateData.map(r => {
      const rev = parseFloat(r.revenue) || 0;
      const enr = parseFloat(r.enrollments) || 0;
      const roas = parseFloat(r.roas) || 0;
      return `${r.state}<br>Revenue: $${rev.toLocaleString()}<br>Enrollments: ${enr}<br>ROAS: ${isFinite(roas) && roas > 0 ? roas.toFixed(1) + 'x' : 'N/A'}`;
    }),
    hovertemplate: '%{text}<extra></extra>',
    colorscale: [[0, '#1a1a2e'], [0.15, '#16213e'], [0.35, '#0f3460'], [0.55, '#1a6b3c'], [0.75, '#27ae60'], [1.0, '#2ecc71']],
    colorbar: {
      title: { text: 'Revenue', font: { color: Theme.COLORS.textSecondary, size: 11 } },
      tickprefix: '$', tickformat: ',.0f', thickness: 14,
      tickfont: { color: Theme.COLORS.textMuted, size: 10 },
      bgcolor: 'rgba(0,0,0,0)', outlinecolor: Theme.COLORS.border,
    },
    marker: { line: { color: Theme.COLORS.border, width: 0.5 } },
  }], Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 380,
    margin: { t: 10, r: 10, b: 10, l: 10 },
    geo: {
      scope: 'usa',
      bgcolor: Theme.COLORS.bgCard || '#12122a',
      lakecolor: Theme.COLORS.bgCard || '#12122a',
      landcolor: '#1a1a2e',
      subunitcolor: Theme.COLORS.border,
      showlakes: true, showframe: false,
      projection: { type: 'albers usa' },
    },
  }), Theme.PLOTLY_CONFIG);
}

function _geoStateBars(el, stateData) {
  if (!stateData || stateData.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No state data available.</p>`;
    return;
  }

  const top15 = stateData.slice(0, 15);
  const states = top15.map(r => r.state || '--').reverse();
  const revenues = top15.map(r => parseFloat(r.revenue) || 0).reverse();

  Plotly.newPlot(el, [{
    type: 'bar', orientation: 'h',
    x: revenues, y: states,
    marker: { color: Theme.FUNNEL.green || '#2ecc71' },
    hovertemplate: '%{y}: $%{x:,.0f}<extra></extra>',
    text: revenues.map(v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0))),
    textposition: 'outside',
    textfont: { color: Theme.COLORS.textSecondary, size: 11 },
  }], Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 410,
    margin: { t: 10, r: 80, b: 40, l: 50 },
    xaxis: { ...Theme.PLOTLY_LAYOUT.xaxis, tickprefix: '$', tickformat: ',.0f', title: { text: 'Revenue', font: { color: Theme.COLORS.textSecondary, size: 11 } } },
    yaxis: { ...Theme.PLOTLY_LAYOUT.yaxis, automargin: true },
  }), Theme.PLOTLY_CONFIG);
}

function _geoDeadZoneTable(rows) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow:auto;max-height:360px';

  if (rows.length === 0) {
    wrapper.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:8px 0">No dead zones found.</p>`;
    return wrapper;
  }

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px';
  table.innerHTML = `<thead><tr style="border-bottom:1px solid rgba(231,76,60,0.3)">
    <th style="text-align:left;padding:6px 8px;color:#e74c3c;font-weight:600">State</th>
    <th style="text-align:left;padding:6px 8px;color:#e74c3c;font-weight:600">City</th>
    <th style="text-align:right;padding:6px 8px;color:#e74c3c;font-weight:600">Spend Wasted</th>
    <th style="text-align:right;padding:6px 8px;color:#e74c3c;font-weight:600">Enrollments</th>
  </tr></thead>`;

  const tbody = document.createElement('tbody');
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.style.cssText = `border-bottom:1px solid rgba(231,76,60,0.12);background:${i % 2 === 0 ? 'transparent' : 'rgba(231,76,60,0.03)'}`;
    tr.innerHTML = `
      <td style="padding:6px 8px;color:${Theme.COLORS.textPrimary}">${r.state || '--'}</td>
      <td style="padding:6px 8px;color:${Theme.COLORS.textPrimary}">${r.city || '--'}</td>
      <td style="padding:6px 8px;text-align:right;color:#e74c3c;font-weight:600">${Theme.money(parseFloat(r.spend) || 0)}</td>
      <td style="padding:6px 8px;text-align:right;color:${Theme.COLORS.textMuted}">0</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

// ---- Demographic Intelligence Panel ----
let _segDemoT1Stat = 'spend';

function _renderDemographicIntel(container) {
  const T = Theme.COLORS;
  const FC = [Theme.FUNNEL.blue, Theme.FUNNEL.cyan, Theme.FUNNEL.green, Theme.FUNNEL.orange, Theme.FUNNEL.purple];

  const styleId = 'seg-demo-intel-responsive';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = '@media (max-width: 768px) { .seg-demo-intel-grid { grid-template-columns: 1fr !important; } }';
    document.head.appendChild(s);
  }

  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:${T.textPrimary};letter-spacing:-.01em">Demographic Intelligence</div>
    <div style="font-size:12px;color:${T.textMuted};margin-top:2px">Meta ad demographic breakdowns</div>`;
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'seg-demo-intel-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px';
  container.appendChild(grid);

  const days = Filters.getDays();

  function cleanLabel(raw) {
    if (!raw) return '(unknown)';
    let s = String(raw);
    s = s.replace(/^(facebook|instagram|audience_network|messenger)\s+\1_/i, '$1 ');
    s = s.replace(/_/g, ' ');
    return s.replace(/\b\w/g, c => c.toUpperCase());
  }

  function renderBars(barContainer, rows, statKey, labelField, formatFn, emptyMsg) {
    if (!rows || rows.length === 0) {
      barContainer.innerHTML = `<div style="font-size:12px;color:${T.textMuted};padding:16px 0">${emptyMsg || 'No data available.'}</div>`;
      return;
    }
    const values = rows.map(r => parseFloat(r[statKey]) || 0);
    const maxVal = Math.max(...values);
    let html = '';
    rows.forEach((row, i) => {
      const val = values[i];
      const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const color = FC[i % FC.length];
      html += `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;color:${T.textSecondary}">${cleanLabel(row[labelField])}</span>
          <span style="font-size:11px;font-weight:600;color:${T.textPrimary};font-family:'JetBrains Mono',monospace">${formatFn(val, statKey)}</span>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .3s ease"></div>
        </div>
      </div>`;
    });
    barContainer.innerHTML = html;
  }

  function buildToggles(toggleRow, statLabels, getActive, setActive, allCardRefs) {
    toggleRow.innerHTML = '';
    Object.entries(statLabels).forEach(([sk, label]) => {
      const isActive = sk === getActive();
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:${isActive ? '600' : '400'};border:1px solid ${isActive ? 'transparent' : T.border};background:${isActive ? T.accent : 'transparent'};color:${isActive ? '#fff' : T.textMuted};transition:all .15s;outline:none;line-height:1.4`;
      btn.addEventListener('click', () => { setActive(sk); allCardRefs.forEach(fn => fn()); });
      toggleRow.appendChild(btn);
    });
  }

  function sourceBadge(text) {
    return `<div style="font-size:10px;color:${T.textMuted};margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05)">${text}</div>`;
  }

  const T1_STAT_LABELS = { spend: 'Spend', cpm: 'CPM', ctr: 'CTR', cpc: 'CPC', purchases: 'Purchases' };

  function formatT1(val, statKey) {
    if (statKey === 'spend' || statKey === 'cpm' || statKey === 'cpc') return Theme.money(val);
    if (statKey === 'ctr') return val.toFixed(2) + '%';
    return Math.round(val).toLocaleString();
  }

  const T1_CARDS = [
    { title: 'Gender',    queryName: 'ageGender', labelField: 'gender',          groupBy: 'gender' },
    { title: 'Age',       queryName: 'ageGender', labelField: 'age',             groupBy: 'age' },
    { title: 'Device',    queryName: 'device',    labelField: 'device_platform' },
    { title: 'Placement', queryName: 'placement', labelField: 'placement' },
  ];

  const _t1Cache = {};
  async function fetchT1(queryName) {
    if (_t1Cache[queryName]) return _t1Cache[queryName];
    try { _t1Cache[queryName] = await API.query('segments', queryName, { days }) || []; } catch (e) { _t1Cache[queryName] = []; }
    return _t1Cache[queryName];
  }

  function groupRows(rows, groupField) {
    const map = {};
    rows.forEach(row => {
      const key = row[groupField] || '(unknown)';
      if (!map[key]) map[key] = { [groupField]: key };
      Object.keys(row).forEach(k => {
        if (k === groupField) return;
        const n = parseFloat(row[k]);
        if (!isNaN(n)) map[key][k] = (map[key][k] || 0) + n;
      });
    });
    return Object.values(map).map(r => {
      if (r.impressions > 0) r.cpm = (r.spend / r.impressions) * 1000;
      if (r.clicks > 0) r.cpc = r.spend / r.clicks;
      if (r.impressions > 0) r.ctr = (r.clicks / r.impressions) * 100;
      return r;
    });
  }

  const t1CardRenderers = [];
  const T1_EMPTY = 'Awaiting Meta demographics data. Refresh token to enable.';

  T1_CARDS.forEach(cfg => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:20px';

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `font-size:14px;font-weight:600;color:${T.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px`;
    titleDiv.textContent = cfg.title;
    card.appendChild(titleDiv);

    const toggleRow = document.createElement('div');
    toggleRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px';
    card.appendChild(toggleRow);

    const barContainer = document.createElement('div');
    card.appendChild(barContainer);
    barContainer.innerHTML = `<div style="font-size:11px;color:${T.textMuted}">Loading...</div>`;

    let cachedRows = null;

    async function loadAndRender() {
      if (!cachedRows) {
        const raw = await fetchT1(cfg.queryName);
        cachedRows = cfg.groupBy ? groupRows(raw, cfg.groupBy) : raw;
      }
      renderBars(barContainer, cachedRows, _segDemoT1Stat, cfg.labelField, formatT1, T1_EMPTY);
    }

    function renderCard() {
      buildToggles(toggleRow, T1_STAT_LABELS, () => _segDemoT1Stat, (sk) => { _segDemoT1Stat = sk; }, t1CardRenderers);
      renderBars(barContainer, cachedRows, _segDemoT1Stat, cfg.labelField, formatT1, T1_EMPTY);
    }

    t1CardRenderers.push(renderCard);
    loadAndRender().then(() => { t1CardRenderers.forEach(fn => fn()); });

    const badge = document.createElement('div');
    badge.innerHTML = sourceBadge('Source: Meta Ads API');
    card.appendChild(badge);
    grid.appendChild(card);
  });

  // Location card
  const locCard = document.createElement('div');
  locCard.className = 'card';
  locCard.style.cssText = 'padding:20px';

  const locTitle = document.createElement('div');
  locTitle.style.cssText = `font-size:14px;font-weight:600;color:${T.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px`;
  locTitle.textContent = 'Location (Top Regions)';
  locCard.appendChild(locTitle);

  const locToggle = document.createElement('div');
  locToggle.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px';
  locCard.appendChild(locToggle);

  const locBody = document.createElement('div');
  locBody.innerHTML = `<div style="font-size:11px;color:${T.textMuted}">Loading...</div>`;
  locCard.appendChild(locBody);

  let locRows = null;
  (async () => {
    try { locRows = await API.query('segments', 'location', { days }) || []; } catch (e) { locRows = []; }
    renderLocCard();
    t1CardRenderers.push(renderLocCard);
  })();

  function renderLocCard() {
    buildToggles(locToggle, T1_STAT_LABELS, () => _segDemoT1Stat, (sk) => { _segDemoT1Stat = sk; }, t1CardRenderers);
    renderBars(locBody, locRows, _segDemoT1Stat, 'state', formatT1, T1_EMPTY);
  }

  const locBadge = document.createElement('div');
  locBadge.innerHTML = sourceBadge('Source: Meta Ads API (region)');
  locCard.appendChild(locBadge);
  grid.appendChild(locCard);
}
