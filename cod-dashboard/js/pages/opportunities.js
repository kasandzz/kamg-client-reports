/* ============================================
   Opportunities -- revenue opportunity surface
   VIP activation, closer equalization, day-of-week
   optimization, booking gap, prioritization matrix
   ============================================ */

App.registerPage('opportunities', async (container) => {
  const days = Filters.getDays();

  let kpis, closers, dowData;

  try {
    [kpis, closers, dowData] = await Promise.all([
      API.query('opportunities', 'default', { days }),
      API.query('opportunities', 'closers', { days }),
      API.query('opportunities', 'dayofweek', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Opportunities: ${err.message}</p></div>`;
    return;
  }

  const kpi = (kpis && kpis.length > 0) ? kpis[0] : {};
  container.innerHTML = '';

  // ---- Derived values ----
  const vipNonBookers    = kpi.vip_non_bookers || 0;
  const overallCloseRate = kpi.overall_close_rate || 0;
  const bookingRate      = kpi.booking_rate || 0;
  const totalTickets     = kpi.total_tickets || 0;
  const enrolled         = kpi.enrolled || 0;
  const vipPotential     = kpi.vip_potential_revenue || 0;

  // Closer equalization calc
  const validClosers = (closers || []).filter(c => c.total_calls > 0);
  const bestRate     = validClosers.length > 0 ? (validClosers[0].close_rate || 0) : 0;
  const avgRate      = validClosers.length > 0
    ? validClosers.reduce((s, c) => s + (c.close_rate || 0), 0) / validClosers.length
    : 0;
  const avgCalls     = validClosers.length > 0
    ? validClosers.reduce((s, c) => s + (c.total_calls || 0), 0) / validClosers.length
    : 0;
  const avgDeal      = 5000;
  const closerUplift = ((bestRate - avgRate) / 100) * avgCalls * avgDeal * validClosers.length;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'VIP Non-Booker Potential', value: vipPotential, format: 'money' },
    { label: 'Close Rate Equalization', value: closerUplift > 0 ? closerUplift : 0, format: 'money' },
    { label: 'VIP Non-Bookers', value: vipNonBookers, format: 'num' },
    { label: 'Overall Close Rate', value: overallCloseRate * 100, format: 'pct' },
    { label: 'Enrolled', value: enrolled, format: 'num' },
  ]);

  // ---- 2-column card grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // -- Card 1: VIP Non-Booker Activation --
  const vipCard = _oppCard('VIP Non-Booker Activation');
  const br     = (bookingRate > 0 ? bookingRate : 0.15) * 100;
  const cr     = (overallCloseRate > 0 ? overallCloseRate : 0.15) * 100;
  const revenue = vipNonBookers * (br / 100) * (cr / 100) * avgDeal;
  vipCard.innerHTML += `
    <div style="margin-top:12px">
      <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.accent}">${Theme.money(revenue)}</div>
      <div style="color:${Theme.COLORS.textSecondary};margin-top:8px;font-size:13px;line-height:1.6">
        ${vipNonBookers} VIP non-bookers
        &times; ${br.toFixed(1)}% booking rate
        &times; ${cr.toFixed(1)}% close rate
        &times; ${Theme.money(avgDeal)} avg
      </div>
      <div style="margin-top:16px;padding:12px;background:${Theme.COLORS.bgPage};border-radius:8px;border-left:3px solid ${Theme.COLORS.accent}">
        <div style="font-size:12px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em">Action</div>
        <div style="margin-top:4px;font-size:13px;color:${Theme.COLORS.textPrimary}">Send targeted re-engagement sequence to ${vipNonBookers} VIPs who have not booked a strategy call.</div>
      </div>
    </div>
  `;
  grid.appendChild(vipCard);

  // -- Card 2: Close Rate Equalization (Plotly bar) --
  const eqCard  = _oppCard('Close Rate Equalization');
  const eqChartId = 'opp-eq-chart';
  const eqDiv   = document.createElement('div');
  eqDiv.id      = eqChartId;
  eqDiv.style.height = '260px';
  eqCard.appendChild(eqDiv);

  const upliftDisplay = closerUplift > 0 ? Theme.money(closerUplift) : 'N/A';
  const bestName = validClosers.length > 0 ? (validClosers[0].closer || 'Best') : 'Best';
  eqCard.innerHTML += `
    <div style="margin-top:8px;font-size:13px;color:${Theme.COLORS.textSecondary}">
      If all closers matched <strong style="color:${Theme.COLORS.textPrimary}">${bestName}</strong> (${bestRate.toFixed(1)}%),
      potential uplift: <strong style="color:${Theme.COLORS.accent}">${upliftDisplay}</strong>
    </div>
  `;
  grid.appendChild(eqCard);

  // -- Card 3: Day-of-Week Optimization (Plotly bar) --
  const dowCard   = _oppCard('Day-of-Week Optimization');
  const dowChartId = 'opp-dow-chart';
  const dowDiv    = document.createElement('div');
  dowDiv.id       = dowChartId;
  dowDiv.style.height = '260px';
  dowCard.appendChild(dowDiv);
  grid.appendChild(dowCard);

  // -- Card 4: Booking Gap Analysis --
  const bgCard  = _oppCard('Booking Gap Analysis');
  const bkPct   = bookingRate > 0 ? bookingRate * 100 : 0;
  const benchmark = 35; // industry benchmark %
  const bkColor = bkPct >= benchmark ? Theme.COLORS.success : Theme.COLORS.warning;
  bgCard.innerHTML += `
    <div style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;color:${Theme.COLORS.textSecondary}">Your booking rate</span>
        <span style="font-weight:700;color:${bkColor}">${bkPct.toFixed(1)}%</span>
      </div>
      <div style="background:${Theme.COLORS.border};border-radius:4px;height:10px;overflow:hidden">
        <div style="height:100%;width:${Math.min(bkPct, 100)}%;background:${bkColor};border-radius:4px;transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:11px;color:${Theme.COLORS.textMuted}">0%</span>
        <span style="font-size:11px;color:${Theme.COLORS.textMuted}">Industry: ${benchmark}%</span>
        <span style="font-size:11px;color:${Theme.COLORS.textMuted}">100%</span>
      </div>
      <div style="margin-top:16px;padding:12px;background:${Theme.COLORS.bgPage};border-radius:8px;border-left:3px solid ${bkColor}">
        <div style="font-size:13px;color:${Theme.COLORS.textPrimary}">
          ${bkPct < benchmark
            ? `Gap of ${(benchmark - bkPct).toFixed(1)}pp vs benchmark. Priority: improve post-workshop CTA and follow-up sequence timing.`
            : `Above benchmark by ${(bkPct - benchmark).toFixed(1)}pp. Maintain current booking flow and test higher-converting CTAs.`
          }
        </div>
      </div>
    </div>
  `;
  grid.appendChild(bgCard);

  // -- Card 5: Prioritization Matrix (full-width, Plotly scatter) --
  const matrixCard    = _oppCard('Opportunity Prioritization Matrix');
  matrixCard.style.gridColumn = '1 / -1';
  const matrixChartId = 'opp-matrix-chart';
  const matrixDiv     = document.createElement('div');
  matrixDiv.id        = matrixChartId;
  matrixDiv.style.height = '340px';
  matrixCard.appendChild(matrixDiv);
  matrixCard.innerHTML += `
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:8px">
      X axis = implementation effort (1-5). Y axis = revenue potential. Bubble size = speed to capture.
    </div>
  `;
  container.appendChild(matrixCard);

  // ---- Render Plotly charts ----
  requestAnimationFrame(() => {
    _renderCloserBars(eqDiv, validClosers, bestRate);
    _renderDowBars(dowDiv, dowData || []);
    _renderPriorityMatrix(matrixDiv, vipPotential, closerUplift, bookingRate);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _oppCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:20px';
  card.innerHTML = `<div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${title}</div>`;
  return card;
}

function _renderCloserBars(el, closers, bestRate) {
  if (!closers || closers.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No closer data available.</p>`;
    return;
  }

  const names = closers.map(c => c.closer || 'Unknown');
  const rates = closers.map(c => +(c.close_rate || 0).toFixed(1));

  const barColors = rates.map(r =>
    r >= bestRate ? Theme.FUNNEL.green : Theme.COLORS.accent
  );

  const trace = {
    type: 'bar',
    x: names,
    y: rates,
    marker: { color: barColors },
    text: rates.map(r => r.toFixed(1) + '%'),
    textposition: 'outside',
    hovertemplate: '%{x}: %{y:.1f}%<extra></extra>',
  };

  const layout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 240,
    margin: { t: 30, r: 10, b: 60, l: 40 },
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      title: { text: 'Close Rate %', font: { color: Theme.COLORS.textSecondary } },
      ticksuffix: '%',
    },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      tickangle: -20,
    },
    shapes: [{
      type: 'line',
      x0: -0.5,
      x1: names.length - 0.5,
      y0: bestRate,
      y1: bestRate,
      line: { color: Theme.COLORS.success, dash: 'dot', width: 2 },
    }],
    annotations: [{
      x: names.length - 1,
      y: bestRate,
      xanchor: 'right',
      yanchor: 'bottom',
      text: `Best: ${bestRate.toFixed(1)}%`,
      font: { color: Theme.COLORS.success, size: 11 },
      showarrow: false,
    }],
  });

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderDowBars(el, dowData) {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (!dowData || dowData.length === 0) {
    el.innerHTML = `<p style="color:${Theme.COLORS.textMuted};padding:16px">No day-of-week data available.</p>`;
    return;
  }

  const sorted = [...dowData].sort((a, b) => (a.dow || 0) - (b.dow || 0));
  const labels = sorted.map(d => DAY_NAMES[(d.dow || 1) - 1] || `Day ${d.dow}`);
  const rates  = sorted.map(d => +(d.close_rate || 0).toFixed(1));

  // Highlight Mon-Wed (dow 2,3,4) if they outperform average
  const avg = rates.reduce((s, r) => s + r, 0) / (rates.length || 1);
  const barColors = sorted.map((d, i) => {
    const dow = d.dow || 0;
    return (dow >= 2 && dow <= 4 && rates[i] > avg) ? Theme.FUNNEL.cyan : Theme.COLORS.accent;
  });

  const trace = {
    type: 'bar',
    x: labels,
    y: rates,
    marker: { color: barColors },
    text: rates.map(r => r.toFixed(1) + '%'),
    textposition: 'outside',
    hovertemplate: '%{x}: %{y:.1f}% close rate<extra></extra>',
  };

  const layout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 240,
    margin: { t: 30, r: 10, b: 40, l: 40 },
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      title: { text: 'Close Rate %', font: { color: Theme.COLORS.textSecondary } },
      ticksuffix: '%',
    },
    shapes: [{
      type: 'line',
      x0: -0.5,
      x1: labels.length - 0.5,
      y0: avg,
      y1: avg,
      line: { color: Theme.COLORS.textMuted, dash: 'dot', width: 1.5 },
    }],
    annotations: [{
      x: labels.length - 1,
      y: avg,
      xanchor: 'right',
      yanchor: 'bottom',
      text: `Avg: ${avg.toFixed(1)}%`,
      font: { color: Theme.COLORS.textMuted, size: 11 },
      showarrow: false,
    }],
  });

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderPriorityMatrix(el, vipPotential, closerUplift, bookingRate) {
  // Hardcoded opportunity definitions: effort (1-5), revenue potential, speed (bubble size)
  const opportunities = [
    {
      name: 'VIP Activation',
      effort: 2,
      revenue: vipPotential > 0 ? vipPotential : 25000,
      speed: 30,   // weeks to capture
      color: Theme.FUNNEL.cyan,
    },
    {
      name: 'Close Rate Equalization',
      effort: 3,
      revenue: closerUplift > 0 ? closerUplift : 18000,
      speed: 20,
      color: Theme.FUNNEL.blue,
    },
    {
      name: 'Day Optimization',
      effort: 1,
      revenue: 8000,
      speed: 40,
      color: Theme.FUNNEL.green,
    },
    {
      name: 'No-Show Reduction',
      effort: 2,
      revenue: 12000,
      speed: 35,
      color: Theme.FUNNEL.yellow,
    },
    {
      name: 'Booking Gap',
      effort: 4,
      revenue: bookingRate > 0 ? (1 - bookingRate) * 30000 : 15000,
      speed: 15,
      color: Theme.FUNNEL.orange,
    },
  ];

  const trace = {
    type: 'scatter',
    mode: 'markers+text',
    x: opportunities.map(o => o.effort),
    y: opportunities.map(o => o.revenue),
    text: opportunities.map(o => o.name),
    textposition: 'top center',
    textfont: { color: Theme.COLORS.textPrimary, size: 11 },
    marker: {
      size: opportunities.map(o => o.speed),
      color: opportunities.map(o => o.color),
      opacity: 0.8,
      line: { color: Theme.COLORS.border, width: 1 },
    },
    hovertemplate: '<b>%{text}</b><br>Effort: %{x}/5<br>Revenue: $%{y:,.0f}<extra></extra>',
  };

  const layout = Object.assign({}, Theme.PLOTLY_LAYOUT, {
    height: 300,
    margin: { t: 20, r: 20, b: 50, l: 80 },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      title: { text: 'Implementation Effort (1=Easy, 5=Hard)', font: { color: Theme.COLORS.textSecondary } },
      range: [0.5, 5.5],
      dtick: 1,
    },
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      title: { text: 'Revenue Potential ($)', font: { color: Theme.COLORS.textSecondary } },
      tickprefix: '$',
      tickformat: ',.0f',
    },
    // Quadrant divider lines
    shapes: [
      {
        type: 'line',
        x0: 3, x1: 3,
        y0: 0, y1: 1,
        xref: 'x', yref: 'paper',
        line: { color: Theme.COLORS.gridLine, dash: 'dot', width: 1 },
      },
    ],
    annotations: [
      { x: 1.5, y: 0.97, xref: 'paper', yref: 'paper', text: 'Quick Wins', showarrow: false, font: { color: Theme.COLORS.success, size: 11 } },
      { x: 0.75, y: 0.97, xref: 'paper', yref: 'paper', text: 'Strategic', showarrow: false, font: { color: Theme.COLORS.textMuted, size: 11 } },
    ],
  });

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}
