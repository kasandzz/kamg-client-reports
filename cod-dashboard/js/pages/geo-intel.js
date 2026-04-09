/* ============================================
   Geo Intel -- geographic revenue & dead zone analysis
   Choropleth, state leaderboard, city table, dead zones
   ============================================ */

App.registerPage('geo-intel', async (container) => {
  const days = Filters.getDays();

  let cityData, stateData, deadZones;

  try {
    [cityData, stateData, deadZones] = await Promise.all([
      API.query('geo-intel', 'default', { days }),
      API.query('geo-intel', 'states', { days }),
      API.query('geo-intel', 'deadZones', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Geo Intel: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  // ---- Derived values ----
  const stateSet = new Set((stateData || []).map(r => r.state).filter(Boolean));
  const stateCount = stateSet.size;

  const topStateRow = (stateData && stateData.length > 0) ? stateData[0] : {};
  const topState = topStateRow.state || '--';

  const totalRevenue = (stateData || []).reduce((s, r) => s + (parseFloat(r.revenue) || 0), 0);

  const deadZoneCount = (deadZones || []).length;
  const wastedSpend   = (deadZones || []).reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);

  // Best ROAS state (exclude nulls and infinities)
  const roasRanked = (stateData || [])
    .filter(r => r.roas != null && isFinite(r.roas) && r.roas > 0)
    .sort((a, b) => (parseFloat(b.roas) || 0) - (parseFloat(a.roas) || 0));
  const bestRoasRow = roasRanked.length > 0 ? roasRanked[0] : null;
  const bestRoasLabel = bestRoasRow
    ? `${bestRoasRow.state} (${parseFloat(bestRoasRow.roas).toFixed(1)}x)`
    : '--';

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'States with Revenue',  value: stateCount,    format: 'num',   source: 'BQ hyros_sales (state field)', calc: 'COUNT(DISTINCT state WHERE revenue > 0)' },
    { label: 'Top State',            value: topState,      format: 'text',  source: 'BQ hyros_sales GROUP BY state', calc: 'state WHERE SUM(revenue) = MAX(SUM(revenue))' },
    { label: 'Total Geo Revenue',    value: totalRevenue,  format: 'money', source: 'BQ hyros_sales', calc: 'SUM(revenue WHERE state IS NOT NULL)' },
    { label: 'Dead Zones',           value: deadZoneCount, format: 'num',   invertCost: true, source: 'BQ meta_ads JOIN hyros_sales GROUP BY state', calc: 'COUNT(states WHERE spend > 500 AND enrollments = 0)' },
    { label: 'Wasted in Dead Zones', value: wastedSpend,   format: 'money', invertCost: true, source: 'BQ meta_ads GROUP BY state', calc: 'SUM(spend WHERE state IN dead_zones)' },
    { label: 'Best ROAS State',      value: bestRoasLabel, format: 'text',  source: 'BQ meta_ads JOIN hyros_sales GROUP BY state', calc: 'state WHERE SUM(revenue) / SUM(spend) = MAX(ROAS)' },
  ]);

  // ---- US Choropleth (full width) ----
  const mapCard = _geoCard('Revenue by State');
  mapCard.style.gridColumn = '1 / -1';
  const mapDiv = document.createElement('div');
  mapDiv.id = 'geo-choropleth';
  mapDiv.style.height = '420px';
  mapCard.appendChild(mapDiv);
  container.appendChild(mapCard);

  // ---- 2-col grid: leaderboard + city table ----
  const midGrid = document.createElement('div');
  midGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(midGrid);

  // -- Top 15 States (horizontal bar) --
  const barCard = _geoCard('Top 15 States by Revenue');
  const barDiv  = document.createElement('div');
  barDiv.id = 'geo-state-bars';
  barDiv.style.height = '440px';
  barCard.appendChild(barDiv);
  midGrid.appendChild(barCard);

  // -- Top 20 Cities table --
  const cityCard = _geoCard('Top 20 Cities');
  const cityTable = _buildCityTable(cityData || []);
  cityCard.appendChild(cityTable);
  midGrid.appendChild(cityCard);

  // ---- Dead Zones table (full width) ----
  const dzCard = document.createElement('div');
  dzCard.className = 'card';
  dzCard.style.cssText = 'padding:20px;margin-top:16px;border:1px solid rgba(231,76,60,0.3);background:rgba(231,76,60,0.04)';
  dzCard.innerHTML = `
    <div style="font-size:14px;font-weight:600;color:#e74c3c;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">
      Dead Zones: Spend &gt; $500, Zero Enrollments
    </div>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:16px">
      ${deadZoneCount} location${deadZoneCount !== 1 ? 's' : ''} spending money with no conversions
    </div>
  `;
  const dzTable = _buildDeadZoneTable(deadZones || []);
  dzCard.appendChild(dzTable);
  container.appendChild(dzCard);

  // ---- Render Plotly charts ----
  requestAnimationFrame(() => {
    _renderChoropleth(mapDiv, stateData || []);
    _renderStateBars(barDiv, stateData || []);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _geoCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:20px';
  card.innerHTML = `<div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">${title}</div>`;
  return card;
}

function _roasColor(roas) {
  if (roas == null || !isFinite(roas)) return Theme.COLORS.textMuted;
  if (roas >= 3)  return Theme.FUNNEL.green  || '#2ecc71';
  if (roas >= 1)  return '#f39c12';
  return '#e74c3c';
}

function _buildCityTable(rows) {
  const top20 = rows.slice(0, 20);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow:auto;max-height:420px';

  if (top20.length === 0) {
    wrapper.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:8px 0">No city data available.</p>`;
    return wrapper;
  }

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px';
  table.innerHTML = `
    <thead>
      <tr style="border-bottom:1px solid ${Theme.COLORS.border}">
        <th style="text-align:left;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:600">City</th>
        <th style="text-align:left;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:600">State</th>
        <th style="text-align:right;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:600">Revenue</th>
        <th style="text-align:right;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:600">Spend</th>
        <th style="text-align:right;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:600">Enroll</th>
        <th style="text-align:right;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:600">ROAS</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  top20.forEach((r, i) => {
    const roas = parseFloat(r.roas) || 0;
    const rc = _roasColor(roas);
    const tr = document.createElement('tr');
    tr.style.cssText = `border-bottom:1px solid ${Theme.COLORS.border};background:${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}`;
    tr.innerHTML = `
      <td style="padding:6px 8px;color:${Theme.COLORS.textPrimary}">${r.city || '--'}</td>
      <td style="padding:6px 8px;color:${Theme.COLORS.textSecondary}">${r.state || '--'}</td>
      <td style="padding:6px 8px;text-align:right;color:${Theme.COLORS.textPrimary}">${Theme.money(parseFloat(r.revenue) || 0)}</td>
      <td style="padding:6px 8px;text-align:right;color:${Theme.COLORS.textSecondary}">${Theme.money(parseFloat(r.spend) || 0)}</td>
      <td style="padding:6px 8px;text-align:right;color:${Theme.COLORS.textSecondary}">${Theme.num(parseFloat(r.enrollments) || 0)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600;color:${rc}">${isFinite(roas) && roas > 0 ? roas.toFixed(1) + 'x' : '--'}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function _buildDeadZoneTable(rows) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow:auto;max-height:360px';

  if (rows.length === 0) {
    wrapper.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:8px 0">No dead zones found -- all spend has at least 1 enrollment.</p>`;
    return wrapper;
  }

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px';
  table.innerHTML = `
    <thead>
      <tr style="border-bottom:1px solid rgba(231,76,60,0.3)">
        <th style="text-align:left;padding:6px 8px;color:#e74c3c;font-weight:600">State</th>
        <th style="text-align:left;padding:6px 8px;color:#e74c3c;font-weight:600">City</th>
        <th style="text-align:right;padding:6px 8px;color:#e74c3c;font-weight:600">Spend Wasted</th>
        <th style="text-align:right;padding:6px 8px;color:#e74c3c;font-weight:600">Enrollments</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.style.cssText = `border-bottom:1px solid rgba(231,76,60,0.12);background:${i % 2 === 0 ? 'transparent' : 'rgba(231,76,60,0.03)'}`;
    tr.innerHTML = `
      <td style="padding:6px 8px;color:${Theme.COLORS.textPrimary}">${r.state || '--'}</td>
      <td style="padding:6px 8px;color:${Theme.COLORS.textPrimary}">${r.city || '--'}</td>
      <td style="padding:6px 8px;text-align:right;color:#e74c3c;font-weight:600">${Theme.money(parseFloat(r.spend) || 0)}</td>
      <td style="padding:6px 8px;text-align:right;color:${Theme.COLORS.textMuted}">0</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function _renderChoropleth(el, stateData) {
  if (!stateData || stateData.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No state data available.</p>`;
    return;
  }

  const locations = stateData.map(r => r.state || '');
  const zValues   = stateData.map(r => parseFloat(r.revenue) || 0);
  const text      = stateData.map(r => {
    const rev  = parseFloat(r.revenue) || 0;
    const enr  = parseFloat(r.enrollments) || 0;
    const roas = parseFloat(r.roas) || 0;
    return `${r.state}<br>Revenue: $${rev.toLocaleString()}<br>Enrollments: ${enr}<br>ROAS: ${isFinite(roas) && roas > 0 ? roas.toFixed(1) + 'x' : 'N/A'}`;
  });

  const trace = {
    type: 'choropleth',
    locationmode: 'USA-states',
    locations,
    z: zValues,
    text,
    hovertemplate: '%{text}<extra></extra>',
    colorscale: [
      [0,    '#1a1a2e'],
      [0.15, '#16213e'],
      [0.35, '#0f3460'],
      [0.55, '#1a6b3c'],
      [0.75, '#27ae60'],
      [1.0,  '#2ecc71'],
    ],
    colorbar: {
      title: { text: 'Revenue', font: { color: Theme.COLORS.textSecondary, size: 11 } },
      tickprefix: '$',
      tickformat: ',.0f',
      thickness: 14,
      tickfont: { color: Theme.COLORS.textMuted, size: 10 },
      bgcolor: 'rgba(0,0,0,0)',
      outlinecolor: Theme.COLORS.border,
    },
    marker: { line: { color: Theme.COLORS.border, width: 0.5 } },
  };

  const layout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 400,
    margin: { t: 10, r: 10, b: 10, l: 10 },
    geo: {
      scope: 'usa',
      bgcolor: Theme.COLORS.bgCard || '#12122a',
      lakecolor: Theme.COLORS.bgCard || '#12122a',
      landcolor: '#1a1a2e',
      subunitcolor: Theme.COLORS.border,
      showlakes: true,
      showframe: false,
      projection: { type: 'albers usa' },
    },
  });

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderStateBars(el, stateData) {
  if (!stateData || stateData.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No state data available.</p>`;
    return;
  }

  const top15 = stateData.slice(0, 15);
  // Horizontal bar: reverse for descending top-to-bottom display
  const states   = top15.map(r => r.state || '--').reverse();
  const revenues = top15.map(r => parseFloat(r.revenue) || 0).reverse();

  const trace = {
    type: 'bar',
    orientation: 'h',
    x: revenues,
    y: states,
    marker: { color: Theme.FUNNEL.green || '#2ecc71' },
    hovertemplate: '%{y}: $%{x:,.0f}<extra></extra>',
    text: revenues.map(v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0))),
    textposition: 'outside',
    textfont: { color: Theme.COLORS.textSecondary, size: 11 },
  };

  const layout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 410,
    margin: { t: 10, r: 80, b: 40, l: 50 },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      tickprefix: '$',
      tickformat: ',.0f',
      title: { text: 'Revenue', font: { color: Theme.COLORS.textSecondary, size: 11 } },
    },
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      automargin: true,
    },
  });

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}
