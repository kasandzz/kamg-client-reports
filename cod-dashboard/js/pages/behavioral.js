/* ============================================
   Behavioral -- PostHog events, speed-to-action,
   purchase timing heatmap, cross-domain coverage
   ============================================ */

App.registerPage('behavioral', async (container) => {
  const days = Filters.getDays();

  let defaultData, speedData, dowData;

  try {
    [defaultData, speedData, dowData] = await Promise.all([
      API.query('behavioral', 'default',       { days }),
      API.query('behavioral', 'speedToAction', { days: 90 }),
      API.query('behavioral', 'dayofweek',     { days: 90 }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Behavioral: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  const kpi = (defaultData && defaultData.length > 0) ? defaultData[0] : {};

  // ---- Derived: avg hours to book ----
  const speedRows = speedData || [];
  const avgHoursToBook = speedRows.length > 0
    ? speedRows.reduce((sum, r) => sum + (r.hours_to_book || 0), 0) / speedRows.length
    : 0;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Events',      value: kpi.total_events   || 0, format: 'num', source: 'BQ posthog_events', calc: 'COUNT(events)' },
    { label: 'Unique Users',      value: kpi.unique_users   || 0, format: 'num', source: 'BQ posthog_events', calc: 'COUNT(DISTINCT distinct_id)' },
    { label: 'Pageviews',         value: kpi.pageviews      || 0, format: 'num', source: 'BQ posthog_events', calc: 'COUNT(events WHERE event = $pageview)' },
    { label: 'Rage Clicks',       value: kpi.rage_clicks    || 0, format: 'num', invertCost: true, source: 'BQ posthog_events', calc: 'COUNT(events WHERE event = $rageclick)' },
    { label: 'Avg Hours to Book', value: Math.round(avgHoursToBook), format: 'num', source: 'BQ posthog_events JOIN ghl_appointments', calc: 'AVG(TIMESTAMP_DIFF(booked_at, first_pageview_at, HOUR))' },
  ]);

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // ---- Chart 1: Speed-to-Action Scatter (Plotly) ----
  const scatterCard = document.createElement('div');
  scatterCard.className = 'card';
  scatterCard.style.cssText = 'padding:20px';
  scatterCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Speed to Action</div>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:12px">Faster booking correlates with higher enrollment probability.</div>
  `;

  const scatterDivId = 'behavioral-scatter';
  const scatterDiv = document.createElement('div');
  scatterDiv.id = scatterDivId;
  scatterDiv.style.height = '300px';
  scatterCard.appendChild(scatterDiv);
  grid.appendChild(scatterCard);

  const vipRows      = speedRows.filter(r => r.is_vip === 1 || r.is_vip === true);
  const nonVipRows   = speedRows.filter(r => !(r.is_vip === 1 || r.is_vip === true));

  function jitter(val) { return val + (Math.random() - 0.5) * 0.18; }

  const scatterTraces = [
    {
      type:    'scatter',
      mode:    'markers',
      name:    'VIP',
      x:       vipRows.map(r => Math.max(0.5, r.hours_to_book || 0)),
      y:       vipRows.map(r => jitter(r.did_enroll || 0)),
      marker:  { color: Theme.FUNNEL.purple, size: 7, opacity: 0.75 },
      hovertemplate: 'Hours: %{x:.1f}<br>Enrolled: %{customdata}<extra>VIP</extra>',
      customdata: vipRows.map(r => r.did_enroll ? 'Yes' : 'No'),
    },
    {
      type:    'scatter',
      mode:    'markers',
      name:    'Standard',
      x:       nonVipRows.map(r => Math.max(0.5, r.hours_to_book || 0)),
      y:       nonVipRows.map(r => jitter(r.did_enroll || 0)),
      marker:  { color: Theme.FUNNEL.blue, size: 6, opacity: 0.55 },
      hovertemplate: 'Hours: %{x:.1f}<br>Enrolled: %{customdata}<extra>Standard</extra>',
      customdata: nonVipRows.map(r => r.did_enroll ? 'Yes' : 'No'),
    },
  ];

  Plotly.newPlot(
    scatterDivId,
    scatterTraces,
    {
      ...Theme.PLOTLY_LAYOUT,
      xaxis: {
        ...Theme.PLOTLY_LAYOUT.xaxis,
        title:   { text: 'Hours to Book (log scale)', font: { size: 11, color: Theme.COLORS.textMuted } },
        type:    'log',
        tickfont: { size: 10, color: Theme.COLORS.textMuted },
      },
      yaxis: {
        ...Theme.PLOTLY_LAYOUT.yaxis,
        title:    { text: 'Enrolled', font: { size: 11, color: Theme.COLORS.textMuted } },
        tickvals: [0, 1],
        ticktext: ['No', 'Yes'],
        tickfont: { size: 10, color: Theme.COLORS.textMuted },
        range:    [-0.3, 1.3],
      },
      margin: { t: 10, b: 50, l: 60, r: 10 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Chart 2: Day-of-Week Heatmap (Plotly) ----
  const heatCard = document.createElement('div');
  heatCard.className = 'card';
  heatCard.style.cssText = 'padding:20px';
  heatCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Purchase Timing</div>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:12px">Ticket purchases by day of week and hour (last 90 days).</div>
  `;

  const heatDivId = 'behavioral-heatmap';
  const heatDiv = document.createElement('div');
  heatDiv.id = heatDivId;
  heatDiv.style.height = '300px';
  heatCard.appendChild(heatDiv);
  grid.appendChild(heatCard);

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  // Build 24x7 matrix (rows=hours, cols=days)
  const matrix = Array.from({ length: 24 }, () => Array(7).fill(0));
  (dowData || []).forEach(r => {
    const dow  = (r.dow  || 1) - 1; // BQ DOW: 1=Sun, adjust to 0-indexed
    const hour = r.hour || 0;
    if (dow >= 0 && dow < 7 && hour >= 0 && hour < 24) {
      matrix[hour][dow] = r.tickets || 0;
    }
  });

  Plotly.newPlot(
    heatDivId,
    [
      {
        type:        'heatmap',
        z:           matrix,
        x:           DAY_LABELS,
        y:           HOURS.map(h => `${h}:00`),
        colorscale:  [[0, '#1a1f2e'], [0.5, Theme.FUNNEL.blue], [1, Theme.FUNNEL.purple]],
        showscale:   true,
        hovertemplate: '%{x} %{y}: <b>%{z} tickets</b><extra></extra>',
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      xaxis: { tickfont: { size: 10, color: Theme.COLORS.textMuted } },
      yaxis: { tickfont: { size: 9,  color: Theme.COLORS.textMuted }, autorange: 'reversed' },
      margin: { t: 10, b: 40, l: 50, r: 60 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Bottom row: Coverage + Session Gap (full width split) ----
  const bottomGrid = document.createElement('div');
  bottomGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(bottomGrid);

  // ---- Card 3: Cross-Domain Coverage (scorecard) ----
  const coverageCard = document.createElement('div');
  coverageCard.className = 'card';
  coverageCard.style.cssText = 'padding:20px';

  const systems = [
    { name: 'PostHog', status: 'Active',   color: Theme.FUNNEL.green  },
    { name: 'Stripe',  status: 'Full',     color: Theme.FUNNEL.green  },
    { name: 'GHL',     status: 'Full',     color: Theme.FUNNEL.green  },
    { name: 'Hyros',   status: 'Active',   color: Theme.FUNNEL.green  },
    { name: 'AEvent',  status: 'Missing',  color: Theme.FUNNEL.red    },
    { name: 'Zoom',    status: 'Active',   color: Theme.FUNNEL.green  },
  ];

  const rows = systems.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="font-size:13px;color:${Theme.COLORS.textSecondary}">${s.name}</span>
      <span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;background:${s.color}22;color:${s.color};letter-spacing:.04em">${s.status}</span>
    </div>
  `).join('');

  coverageCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Cross-Domain Coverage</div>
    ${rows}
  `;
  bottomGrid.appendChild(coverageCard);

  // ---- Card 4: Session Duration Gap ----
  const gapCard = document.createElement('div');
  gapCard.className = 'card';
  gapCard.style.cssText = 'padding:20px;display:flex;flex-direction:column;justify-content:center';
  gapCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Session Duration</div>
    <div style="display:flex;align-items:flex-start;gap:12px">
      <span style="font-size:24px;margin-top:2px">&#9888;&#65039;</span>
      <div>
        <div style="font-size:14px;color:${Theme.COLORS.textPrimary};font-weight:500;margin-bottom:8px">Data Gap</div>
        <div style="font-size:13px;color:${Theme.COLORS.textMuted};line-height:1.6">
          Session duration analysis requires PostHog session recording data. Current integration captures events but not full session timelines.
        </div>
        <div style="margin-top:16px;padding:10px 14px;background:${Theme.COLORS.bgPage};border-radius:8px;border-left:3px solid ${Theme.FUNNEL.orange};font-size:12px;color:${Theme.COLORS.textSecondary}">
          Enable PostHog Session Recording on AEvent pages to unlock time-on-page and scroll depth metrics.
        </div>
      </div>
    </div>
  `;
  bottomGrid.appendChild(gapCard);
});
