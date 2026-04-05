/* ============================================
   Funnels -- COD acquisition funnel analysis
   KPI strip, Hero Sankey, Conversion Waterfall,
   Per-100 Dropout visualization
   ============================================ */

App.registerPage('funnels', async (container) => {
  const days = Filters.getDays();
  let kpis, weekly;
  const SHOPIFY_METRICS = [
    { key: 'tickets', label: 'Tickets', color: '#6366f1' },
    { key: 'attended', label: 'Attended', color: '#06b6d4' },
    { key: 'booked', label: 'Booked', color: '#22c55e' },
    { key: 'enrolled', label: 'Enrolled', color: '#a855f7' },
  ];

  let daily;
  try {
    [kpis, weekly, daily] = await Promise.all([
      API.query('funnels', 'default', { days }),
      API.query('funnels', 'weekly', { days: Math.max(days, 90) }),
      API.query('funnels', 'daily', { days }).catch(() => null)
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Funnels: ${err.message}</p></div>`;
    return;
  }

  if (!kpis || kpis.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9888;</span><p>No data for the selected period</p></div>`;
    return;
  }

  const d = Array.isArray(kpis) ? kpis[0] : kpis;
  container.innerHTML = '';

  // ---- KPI Strip (6) ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  const totalTickets = d.total_tickets || 0;
  const enrolled = d.enrolled || 0;
  const overallConv = totalTickets > 0 ? ((enrolled / totalTickets) * 100) : 0;

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Tickets', value: totalTickets, format: 'num' },
    { label: 'Show Rate', value: d.show_rate || 0, format: 'pct' },
    { label: 'Booking Rate', value: d.booking_rate || 0, format: 'pct' },
    { label: 'Close Rate', value: d.close_rate || 0, format: 'pct' },
    { label: 'Enrolled', value: enrolled, format: 'num' },
    { label: 'Overall Conversion', value: overallConv, format: 'pct' },
  ]);

  // ---- Shopify-Style Analytics Chart ----
  if (daily && daily.length > 0) {
    const curRows = daily.filter(r => r.period === 'current').sort((a, b) => String(a.dt?.value || a.dt).localeCompare(String(b.dt?.value || b.dt)));
    const prevRows = daily.filter(r => r.period === 'previous').sort((a, b) => String(a.dt?.value || a.dt).localeCompare(String(b.dt?.value || b.dt)));

    // Compute totals for the mini-KPI strip
    const sum = (rows, key) => rows.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);
    const curTotals = {};
    const prevTotals = {};
    SHOPIFY_METRICS.forEach(m => {
      curTotals[m.key] = sum(curRows, m.key);
      prevTotals[m.key] = sum(prevRows, m.key);
    });
    const curConvRate = curTotals.tickets > 0 ? (curTotals.enrolled / curTotals.tickets * 100) : 0;
    const prevConvRate = prevTotals.tickets > 0 ? (prevTotals.enrolled / prevTotals.tickets * 100) : 0;

    function _shopifyDelta(cur, prev) {
      if (!prev || prev === 0) return null;
      return ((cur - prev) / Math.abs(prev)) * 100;
    }

    const shopifyCard = document.createElement('div');
    shopifyCard.className = 'card';
    shopifyCard.style.cssText = 'padding:16px 20px;margin-top:16px';

    // Mini KPI row (Shopify style)
    const miniKpis = [
      { label: 'Tickets', cur: curTotals.tickets, prev: prevTotals.tickets },
      { label: 'Attended', cur: curTotals.attended, prev: prevTotals.attended },
      { label: 'Booked', cur: curTotals.booked, prev: prevTotals.booked },
      { label: 'Enrolled', cur: curTotals.enrolled, prev: prevTotals.enrolled },
      { label: 'Conversion', cur: curConvRate, prev: prevConvRate, isPct: true },
    ];

    let miniHTML = '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid ' + Theme.COLORS.border + '">';
    let activeMetricIdx = 0;

    miniKpis.forEach((mk, idx) => {
      const delta = _shopifyDelta(mk.cur, mk.prev);
      const deltaStr = delta != null ? (delta >= 0 ? '+' : '') + delta.toFixed(0) + '%' : '';
      const deltaColor = delta > 0 ? Theme.COLORS.success : delta < 0 ? Theme.COLORS.danger : Theme.COLORS.textMuted;
      const valStr = mk.isPct ? mk.cur.toFixed(2) + '%' : Theme.num(Math.round(mk.cur));

      miniHTML += `<div class="shopify-metric" data-idx="${idx}" style="cursor:pointer;padding:4px 8px;border-radius:6px;transition:background .15s${idx === 0 ? ';background:rgba(255,255,255,0.06)' : ''}">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:2px">${mk.label}</div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">${valStr}</span>
          ${deltaStr ? `<span style="font-size:11px;font-weight:600;color:${deltaColor}">${deltaStr}</span>` : ''}
        </div>
      </div>`;
    });
    miniHTML += '</div>';
    shopifyCard.innerHTML = miniHTML;

    // Chart canvas
    const chartWrap = document.createElement('div');
    chartWrap.style.cssText = 'position:relative;height:220px;width:100%';
    const canvas = document.createElement('canvas');
    canvas.id = 'funnels-shopify-chart';
    chartWrap.appendChild(canvas);
    shopifyCard.appendChild(chartWrap);

    // Legend
    const legendDiv = document.createElement('div');
    legendDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:16px;margin-top:10px;font-size:11px;color:' + Theme.COLORS.textMuted;
    const curStart = curRows.length > 0 ? String(curRows[0].dt?.value || curRows[0].dt).substring(5) : '';
    const curEnd = curRows.length > 0 ? String(curRows[curRows.length - 1].dt?.value || curRows[curRows.length - 1].dt).substring(5) : '';
    const prevStart = prevRows.length > 0 ? String(prevRows[0].dt?.value || prevRows[0].dt).substring(5) : '';
    const prevEnd = prevRows.length > 0 ? String(prevRows[prevRows.length - 1].dt?.value || prevRows[prevRows.length - 1].dt).substring(5) : '';
    legendDiv.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:16px;height:2px;background:currentColor;display:inline-block"></span>${curStart} - ${curEnd}</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:16px;height:2px;border-bottom:2px dashed currentColor;display:inline-block"></span>${prevStart} - ${prevEnd}</span>
    `;
    shopifyCard.appendChild(legendDiv);
    container.appendChild(shopifyCard);

    // Render Chart.js line chart
    requestAnimationFrame(() => {
      const metricKey = SHOPIFY_METRICS[activeMetricIdx].key;
      const metricColor = SHOPIFY_METRICS[activeMetricIdx].color;
      _renderShopifyChart(canvas, curRows, prevRows, metricKey, metricColor);
    });

    // Click metric to change chart
    shopifyCard.querySelectorAll('.shopify-metric').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        if (idx === 4) return; // Conversion rate doesn't have a daily series
        activeMetricIdx = idx;
        shopifyCard.querySelectorAll('.shopify-metric').forEach(m => m.style.background = 'transparent');
        el.style.background = 'rgba(255,255,255,0.06)';
        const metricKey = SHOPIFY_METRICS[idx].key;
        const metricColor = SHOPIFY_METRICS[idx].color;
        Theme.destroyChart('funnels-shopify-chart');
        _renderShopifyChart(canvas, curRows, prevRows, metricKey, metricColor);
      });
    });
  }

  // ---- Bowtie Journey Map (RocketSource-inspired) ----
  _renderBowtieMap(container, d, days);
});

// ---- Helpers ----

function _renderBowtieMap(container, d, days) {
  const totalTickets = d.total_tickets || 0;
  const attended = d.attended || 0;
  const vip = d.vip || 0;
  const booked = d.booked || 0;
  const callsCompleted = d.calls_completed || 0;
  const enrolled = d.enrolled || 0;

  // Phase definitions (RocketSource bowtie structure)
  const PHASES = [
    { name: 'Acquisition', color: '#4F9CF9', stages: [
      { label: 'Ad Exposure',    vol: null,         tracking: 'partial', conv: null },
      { label: 'Landing Page',   vol: null,         tracking: 'partial', conv: null },
      { label: 'Ticket Purchase',vol: totalTickets,  tracking: 'full',    conv: null },
    ]},
    { name: 'Engagement', color: '#06b6d4', stages: [
      { label: 'Workshop',       vol: attended,      tracking: 'partial', conv: totalTickets > 0 ? (attended/totalTickets*100) : 0 },
      { label: 'VIP Upsell',     vol: vip,           tracking: 'full',    conv: totalTickets > 0 ? (vip/totalTickets*100) : 0 },
    ]},
    { name: 'Point of Purchase', color: '#eab308', stages: [
      { label: 'Call Booking',   vol: booked,        tracking: 'full',    conv: attended > 0 ? (booked/attended*100) : 0 },
      { label: 'Sales Call',     vol: callsCompleted, tracking: 'full',   conv: booked > 0 ? (callsCompleted/booked*100) : 0 },
      { label: 'Enrollment',     vol: enrolled,      tracking: 'full',    conv: callsCompleted > 0 ? (enrolled/callsCompleted*100) : 0 },
    ]},
    { name: 'Adopter', color: '#f97316', stages: [
      { label: 'Onboarding',     vol: null, tracking: 'missing', conv: null },
      { label: 'Delivery',       vol: null, tracking: 'missing', conv: null },
    ]},
    { name: 'Loyalist', color: '#a855f7', stages: [
      { label: 'Retention',      vol: null, tracking: 'missing', conv: null },
      { label: 'Advocacy',       vol: null, tracking: 'missing', conv: null },
    ]},
  ];

  const allStages = PHASES.flatMap(p => p.stages);
  const stageCount = allStages.length;

  // ---- Main bowtie container ----
  const bowtieCard = document.createElement('div');
  bowtieCard.className = 'card';
  bowtieCard.style.cssText = 'padding:0;margin-top:24px;overflow:hidden';

  // ==== ROW 1: Phase Header Bar ====
  let phaseBarHTML = '<div style="display:flex;width:100%">';
  PHASES.forEach((phase, pi) => {
    const width = (phase.stages.length / stageCount * 100).toFixed(1);
    const isWaist = pi === 2;
    phaseBarHTML += `<div style="width:${width}%;padding:10px 12px;background:${phase.color}${isWaist?'':'33'};border-bottom:3px solid ${phase.color};text-align:center;position:relative">
      <div style="font-size:12px;font-weight:700;color:${isWaist?'#000':phase.color};text-transform:uppercase;letter-spacing:1px">${phase.name}</div>
    </div>`;
  });
  phaseBarHTML += '</div>';
  bowtieCard.innerHTML = phaseBarHTML;

  // ==== ROW 2: Touchpoint Labels + Satisfaction Dots ====
  let touchpointHTML = '<div style="display:flex;width:100%;border-bottom:1px solid rgba(255,255,255,0.06)">';
  allStages.forEach(stage => {
    const dotColor = stage.tracking === 'full' ? '#22c55e' : stage.tracking === 'partial' ? '#eab308' : '#ef4444';
    const width = (100 / stageCount).toFixed(1);
    touchpointHTML += `<div style="width:${width}%;padding:10px 4px;text-align:center;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:10px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.5px;line-height:1.3">${stage.label}</div>
      <div style="margin-top:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor}" title="${stage.tracking} tracking"></span></div>
    </div>`;
  });
  touchpointHTML += '</div>';
  bowtieCard.innerHTML += touchpointHTML;

  // ==== ROW 3: Experience Map (multi-line chart) ====
  const expMapDiv = document.createElement('div');
  expMapDiv.style.cssText = 'padding:16px 12px;border-bottom:1px solid rgba(255,255,255,0.06)';

  // Legend
  expMapDiv.innerHTML = `<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;padding:0 8px">
    <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textSecondary}">EXPERIENCE MAP</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#22c55e"><span style="width:16px;height:2px;background:#22c55e;display:inline-block"></span>Volume</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#6366f1"><span style="width:16px;height:2px;background:#6366f1;display:inline-block"></span>Conversion %</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:10px;color:#ef4444"><span style="width:16px;height:2px;border-bottom:2px dashed #ef4444;display:inline-block"></span>Target</div>
  </div>`;

  const expChartDiv = document.createElement('div');
  expChartDiv.id = 'bowtie-experience-map';
  expChartDiv.style.height = '200px';
  expMapDiv.appendChild(expChartDiv);
  bowtieCard.appendChild(expMapDiv);

  // ==== ROW 4: Volume + Conversion Rate per stage (data bar) ====
  let dataRowHTML = '<div style="display:flex;width:100%;border-bottom:1px solid rgba(255,255,255,0.06)">';
  allStages.forEach(stage => {
    const width = (100 / stageCount).toFixed(1);
    const volStr = stage.vol !== null ? Theme.num(stage.vol) : '--';
    const convStr = stage.conv !== null ? stage.conv.toFixed(1) + '%' : '--';
    const convColor = stage.conv === null ? Theme.COLORS.textMuted :
      stage.conv >= 60 ? '#22c55e' : stage.conv >= 35 ? '#eab308' : '#ef4444';
    dataRowHTML += `<div style="width:${width}%;padding:10px 4px;text-align:center;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:16px;font-weight:700;color:${stage.vol !== null ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted}">${volStr}</div>
      <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:2px">volume</div>
      <div style="font-size:13px;font-weight:600;color:${convColor};margin-top:6px">${convStr}</div>
      <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:1px">conv rate</div>
    </div>`;
  });
  dataRowHTML += '</div>';
  bowtieCard.innerHTML += dataRowHTML;

  // ==== ROW 5: Platform Impact (horizontal bars showing data coverage/quality) ====
  let platformHTML = '<div style="display:flex;width:100%;border-bottom:1px solid rgba(255,255,255,0.06)">';
  const platformSources = [
    'Meta Ads', 'PostHog', 'Stripe', 'Wistia / Zoom', 'Stripe',
    'GHL / Sheets', 'Zoom / Sheets', 'Stripe / GHL',
    'N/A', 'N/A', 'N/A', 'N/A'
  ];
  allStages.forEach((stage, i) => {
    const width = (100 / stageCount).toFixed(1);
    const quality = stage.tracking === 'full' ? 10 : stage.tracking === 'partial' ? 5 : 0;
    const barColor = quality >= 8 ? '#22c55e' : quality >= 4 ? '#eab308' : '#ef4444';
    const barWidth = (quality / 10 * 100).toFixed(0);
    platformHTML += `<div style="width:${width}%;padding:8px 6px;text-align:center;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:9px;color:${Theme.COLORS.textMuted};margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${platformSources[i]}">${platformSources[i]}</div>
      <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
        <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:3px;transition:width .3s"></div>
      </div>
    </div>`;
  });
  platformHTML += '</div>';
  bowtieCard.innerHTML += platformHTML;

  // ==== ROW 6: Key Observations per Phase ====
  const observations = _computeObservations(d);
  let obsHTML = '<div style="display:flex;width:100%;border-bottom:1px solid rgba(255,255,255,0.06)">';
  PHASES.forEach((phase, pi) => {
    const width = (phase.stages.length / stageCount * 100).toFixed(1);
    const obs = observations[pi] || [];
    obsHTML += `<div style="width:${width}%;padding:12px 10px;border-right:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:10px;font-weight:600;color:${phase.color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Key Observations</div>
      <ul style="margin:0;padding-left:14px;font-size:10px;color:${Theme.COLORS.textSecondary};line-height:1.6">
        ${obs.map(o => `<li>${o}</li>`).join('')}
      </ul>
    </div>`;
  });
  obsHTML += '</div>';
  bowtieCard.innerHTML += obsHTML;

  // ==== ROW 7: Phase Health Gauges ====
  let gaugeHTML = '<div style="display:flex;width:100%;padding:12px 0">';
  const phaseScores = _computePhaseScores(d);
  PHASES.forEach((phase, pi) => {
    const width = (phase.stages.length / stageCount * 100).toFixed(1);
    const score = phaseScores[pi];
    const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
    const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Needs Work' : 'Critical';
    const arcPct = (score / 100 * 100).toFixed(0);
    gaugeHTML += `<div style="width:${width}%;text-align:center;padding:8px">
      <div style="position:relative;width:80px;height:44px;margin:0 auto;overflow:hidden">
        <div style="width:80px;height:80px;border-radius:50%;background:conic-gradient(${scoreColor} 0% ${arcPct / 2}%, rgba(255,255,255,0.06) ${arcPct / 2}% 50%, transparent 50% 100%);transform:rotate(-90deg)"></div>
      </div>
      <div style="font-size:20px;font-weight:700;color:${scoreColor};margin-top:-4px">${score}</div>
      <div style="font-size:9px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.5px">${label}</div>
      <div style="font-size:10px;color:${phase.color};font-weight:600;margin-top:2px">${phase.name}</div>
    </div>`;
  });
  gaugeHTML += '</div>';
  bowtieCard.innerHTML += gaugeHTML;

  // ==== Tracking Coverage Summary ====
  const fullCount = allStages.filter(s => s.tracking === 'full').length;
  const partialCount = allStages.filter(s => s.tracking === 'partial').length;
  const missingCount = allStages.filter(s => s.tracking === 'missing').length;
  const trackingBars = allStages.map(s => {
    const bg = s.tracking === 'full' ? '#22c55e' : s.tracking === 'partial' ? '#eab308' : 'rgba(239,68,68,0.35)';
    return `<span title="${s.label} (${s.tracking})" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${bg};margin:1px;cursor:default"></span>`;
  }).join('');
  bowtieCard.innerHTML += `<div style="padding:12px 16px;display:flex;align-items:center;gap:16px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
    <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textSecondary}">TRACKING COVERAGE</div>
    <div style="font-size:22px;font-weight:700;color:${fullCount >= 8 ? '#22c55e' : '#eab308'}">${fullCount}<span style="font-size:12px;color:${Theme.COLORS.textMuted};font-weight:400"> / ${stageCount} full</span></div>
    <div style="font-size:10px;color:${Theme.COLORS.textMuted}">${partialCount} partial, ${missingCount} missing</div>
    <div style="display:flex;flex-wrap:wrap;gap:2px;margin-left:auto">${trackingBars}</div>
  </div>`;

  container.appendChild(bowtieCard);

  // Render the experience map Plotly chart after DOM insert
  requestAnimationFrame(() => {
    _renderExperienceMap(document.getElementById('bowtie-experience-map'), allStages, d);
  });
}

function _computeObservations(d) {
  const showRate = d.show_rate || 0;
  const bookingRate = d.booking_rate || 0;
  const closeRate = d.close_rate || 0;
  const showToCall = d.show_to_call_rate || 0;

  return [
    // Acquisition
    [
      'Meta Ads primary traffic source',
      d.total_tickets ? `${Theme.num(d.total_tickets)} tickets in period` : 'No ticket data',
      'Landing page tracking is partial (needs PostHog)',
    ],
    // Engagement
    [
      showRate > 0 ? `${showRate.toFixed(0)}% show rate` : 'Show rate unknown',
      'Wistia tracks watch time',
      'VIP upsell tracked via Stripe',
    ],
    // Point of Purchase
    [
      bookingRate > 0 ? `${bookingRate.toFixed(0)}% booking rate from attendees` : 'Booking rate unknown',
      closeRate > 0 ? `${closeRate.toFixed(0)}% close rate on calls` : 'Close rate unknown',
      showToCall > 0 && showToCall < 70 ? 'Call no-show rate is a lever' : 'Call show rate healthy',
    ],
    // Adopter
    [
      'No onboarding tracking yet',
      'Delivery data not instrumented',
      'Priority: add enrollment success tracking',
    ],
    // Loyalist
    [
      'No retention metrics captured',
      'Churn tracking needed',
      'Referral/advocacy not measured',
    ],
  ];
}

function _computePhaseScores(d) {
  // Score each phase 0-100 based on data quality + performance
  const showRate = d.show_rate || 0;
  const bookingRate = d.booking_rate || 0;
  const closeRate = d.close_rate || 0;

  return [
    // Acquisition: have Stripe data, partial on ads/LP
    Math.min(100, 40 + (d.total_tickets > 0 ? 30 : 0) + 15), // ~85 if data exists
    // Engagement: show rate drives score
    Math.min(100, 30 + Math.round(showRate * 0.6) + (d.vip > 0 ? 15 : 0)),
    // Point of Purchase: booking + close rate
    Math.min(100, 20 + Math.round(bookingRate * 0.3) + Math.round(closeRate * 0.4) + 10),
    // Adopter: no data = low
    10,
    // Loyalist: no data = low
    5,
  ];
}

function _renderExperienceMap(el, allStages, d) {
  if (typeof Plotly === 'undefined' || !el) return;

  const labels = allStages.map(s => s.label);
  const volumes = allStages.map(s => s.vol);
  const convRates = allStages.map(s => s.conv);

  // Normalize volumes to 0-10 scale for display
  const maxVol = Math.max(...volumes.filter(v => v !== null)) || 1;
  const normVols = volumes.map(v => v !== null ? (v / maxVol * 10) : null);

  // Target line (industry benchmarks)
  const targets = [null, null, 8, 5, 3, 4, 6, 5, null, null, null, null];

  const volTrace = {
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Volume',
    x: labels,
    y: normVols,
    line: { color: '#22c55e', width: 2.5 },
    marker: { color: '#22c55e', size: 8 },
    connectgaps: false,
    hovertemplate: '%{x}: %{customdata:,}<extra>Volume</extra>',
    customdata: volumes,
  };

  const convTrace = {
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Conversion %',
    x: labels,
    y: convRates,
    yaxis: 'y2',
    line: { color: '#6366f1', width: 2 },
    marker: { color: '#6366f1', size: 7 },
    connectgaps: false,
    hovertemplate: '%{x}: %{y:.1f}%<extra>Conversion</extra>',
  };

  const targetTrace = {
    type: 'scatter',
    mode: 'lines',
    name: 'Target',
    x: labels,
    y: targets,
    line: { color: '#ef4444', width: 1.5, dash: 'dash' },
    connectgaps: false,
    hoverinfo: 'skip',
  };

  // Divergence fill between volume and target
  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 10, r: 50, b: 40, l: 40 },
    showlegend: false,
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      title: { text: 'Volume (norm)', font: { size: 10, color: '#22c55e' } },
      range: [0, 11],
      showgrid: true,
      gridcolor: 'rgba(255,255,255,0.04)',
    },
    yaxis2: {
      title: { text: 'Conv %', font: { size: 10, color: '#6366f1' } },
      overlaying: 'y',
      side: 'right',
      range: [0, 110],
      showgrid: false,
      tickfont: { color: '#6366f1', size: 10 },
      ticksuffix: '%',
    },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      tickangle: -25,
      tickfont: { size: 10, color: Theme.COLORS.textSecondary },
    },
    // Bowtie shape: divergence shading
    shapes: [{
      type: 'rect',
      x0: 'Call Booking', x1: 'Enrollment',
      y0: 0, y1: 11,
      fillcolor: 'rgba(234,179,8,0.06)',
      line: { width: 0 },
      layer: 'below',
    }],
    annotations: [{
      x: 'Sales Call', y: 10.5,
      text: 'CONVERSION WAIST',
      showarrow: false,
      font: { size: 9, color: '#eab308', weight: 700 },
    }],
  };

  Plotly.newPlot(el, [volTrace, convTrace, targetTrace], layout, Theme.PLOTLY_CONFIG);
}

function _funnelCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '16px 20px';
  if (title) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';margin-bottom:8px';
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}


function _renderShopifyChart(canvas, curRows, prevRows, metricKey, color) {
  // Normalize to same-length arrays by day index (day 0..N)
  const curVals = curRows.map(r => parseFloat(r[metricKey]) || 0);
  const prevVals = prevRows.map(r => parseFloat(r[metricKey]) || 0);
  const curLabels = curRows.map(r => {
    const d = r.dt?.value || r.dt;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Pad shorter array
  const maxLen = Math.max(curVals.length, prevVals.length);
  while (curVals.length < maxLen) curVals.push(0);
  while (prevVals.length < maxLen) prevVals.push(0);
  while (curLabels.length < maxLen) curLabels.push('');

  const config = {
    type: 'line',
    data: {
      labels: curLabels,
      datasets: [
        {
          label: 'Current',
          data: curVals,
          borderColor: color,
          backgroundColor: color + '18',
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
        },
        {
          label: 'Previous',
          data: prevVals,
          borderColor: color + '60',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#64748b', font: { size: 10 } },
        },
      },
    },
  };

  Theme.createChart(canvas.id, config);
}

