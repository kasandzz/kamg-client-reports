/* ============================================
   Funnels -- COD acquisition funnel analysis
   KPI strip, Hero Sankey, Conversion Waterfall,
   Per-100 Dropout visualization
   ============================================ */

App.registerPage('funnels', async (container) => {
  const days = Filters.getDays();
  const SHOPIFY_METRICS = [
    { key: 'tickets', label: 'Tickets', color: '#6366f1' },
    { key: 'attended', label: 'Attended', color: '#06b6d4' },
    { key: 'booked', label: 'Booked', color: '#22c55e' },
    { key: 'enrolled', label: 'Enrolled', color: '#a855f7' },
  ];

  // Fast queries first -- don't wait for the slow weekly query
  let kpis, daily;
  try {
    [kpis, daily] = await Promise.all([
      API.query('funnels', 'default', { days }),
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

  // COD touchpoints mapped to RocketSource structure
  const TOUCHPOINTS = [
    'Meta Ads', 'YouTube', 'Landing Page', 'Webinar Reg', 'Free Trial',
    'Email', 'Workshop', 'VIP Call', 'Call Book', 'Sales Call', 'Check Out',
    'Onboarding', 'Delivery', 'Retention', 'Advocacy'
  ];

  // 5 phases matching RocketSource exactly
  const PHASES = [
    { name: 'Acquisition', color: '#4F9CF9', span: 5 },
    { name: 'Engagement', color: '#06b6d4', span: 3 },
    { name: 'Point of Purchase', color: '#ef4444', span: 3 },
    { name: 'Adopter', color: '#f97316', span: 2 },
    { name: 'Loyalist', color: '#a855f7', span: 2 },
  ];
  const totalSpan = PHASES.reduce((s, p) => s + p.span, 0);

  // Experience scores (1-10 scale, like RocketSource chart lines)
  // Business perception (what team thinks) vs Customer reality
  const bizScores  = [6, 5, 7, 8, 4,  7, 6, 5,  3, 4, 6,  2, 2, 1, 1];
  const opsScores  = [5, 4, 6, 7, 3,  5, 8, 4,  5, 3, 5,  1, 1, 1, 1];
  const cxScores   = [4, 3, 5, 3, 2,  6, 5, 3,  2, 6, 4,  1, 1, 1, 1];

  // Satisfaction indicators per touchpoint
  const satisfaction = [
    'partial', 'partial', 'partial', 'good', 'low',
    'good', 'partial', 'low', 'good', 'partial', 'good',
    'none', 'none', 'none', 'none'
  ];

  // Perspective text per phase (CIO/CMO equivalent for COD)
  const perspectives = [
    { role: 'Marketing', texts: ['Need more data on case studies', 'Migrate campaigns to multi-channel', 'Want to reduce shiny object syndrome'] },
    { role: 'Operations', texts: ['Workshop platform saves me time', 'The automated data streams are limited', 'Eager to try new engagement tech'] },
    { role: 'Sales', texts: ['What behaviors predict close?', 'Need better pre-call intelligence', 'How can we track call quality?'] },
    { role: 'Delivery', texts: ['How can we eliminate buyer remorse?', 'Which content builds confidence?', 'Nervous about churn'] },
    { role: 'Growth', texts: ['How do we get people to talk?', 'Can we leverage success stories?', 'Need referral mechanism'] },
  ];

  // Data sources per touchpoint
  const dataSources = [
    'Meta API', 'YouTube API', 'PostHog', 'Stripe', 'PostHog',
    'SendGrid', 'Wistia', 'Zoom', 'GHL', 'Sheets', 'Stripe',
    'N/A', 'N/A', 'N/A', 'N/A'
  ];

  // Platform impact (0-10 scale)
  const platformImpact = [8, 5, 6, 9, 3, 7, 8, 4, 7, 6, 9, 0, 0, 0, 0];

  // Volumes per touchpoint
  const volumes = [null, null, null, totalTickets, null, null, attended, vip, booked, callsCompleted, enrolled, null, null, null, null];

  // KPI metrics per phase
  const phaseKPIs = [
    ['CPM', 'CPC', 'CTR', 'Cost per Ticket'],
    ['Show Rate', 'Watch Time', 'VIP Rate'],
    ['Booking Rate', 'Close Rate', 'Call Show Rate'],
    ['Onboarding NPS', 'First-Value Time'],
    ['Churn Rate', 'LTV', 'Referral Rate'],
  ];

  // Phase health scores
  const phaseScores = _computePhaseScores(d);

  // ---- Build the bowtie (single innerHTML pass to avoid reflows) ----
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:48px;overflow-x:auto';

  const bowtie = document.createElement('div');
  bowtie.style.cssText = 'min-width:1200px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;background:#0a0e1a';

  const html = [];

  // ==== ROW 1: Phase Headers (colored bars) ====
  html.push('<div style="display:flex">');
  PHASES.forEach(phase => {
    const w = (phase.span / totalSpan * 100).toFixed(2);
    html.push(`<div style="width:${w}%;padding:8px 0;text-align:center;background:${phase.color};border-right:1px solid rgba(0,0,0,0.3)">
      <div style="font-size:11px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:1.5px">${phase.name}</div>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 2: Internal Perspectives (CIO/CMO text) ====
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  PHASES.forEach((phase, pi) => {
    const w = (phase.span / totalSpan * 100).toFixed(2);
    const persp = perspectives[pi];
    html.push(`<div style="width:${w}%;padding:10px 8px;border-right:1px solid rgba(255,255,255,0.04);font-size:9px;color:${Theme.COLORS.textMuted};line-height:1.5">
      <div style="font-size:8px;font-weight:700;color:${phase.color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${persp.role}</div>
      <ul style="margin:0;padding-left:12px">${persp.texts.map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 3: Satisfaction Indicators ====
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  PHASES.forEach((phase, pi) => {
    const w = (phase.span / totalSpan * 100).toFixed(2);
    const startIdx = PHASES.slice(0, pi).reduce((s, p) => s + p.span, 0);
    let cells = '';
    for (let i = 0; i < phase.span; i++) {
      const sat = satisfaction[startIdx + i];
      const label = sat === 'good' ? 'Satisfied' : sat === 'partial' ? 'Limited' : sat === 'low' ? 'Wary' : 'Unknown';
      const color = sat === 'good' ? '#22c55e' : sat === 'partial' ? '#eab308' : sat === 'low' ? '#ef4444' : '#333';
      cells += `<div style="flex:1;text-align:center;padding:4px 2px">
        <div style="font-size:8px;color:${color};font-weight:600">${label}</div>
      </div>`;
    }
    html.push(`<div style="width:${w}%;display:flex;border-right:1px solid rgba(255,255,255,0.04);padding:4px 0">${cells}</div>`);
  });
  html.push('</div>');

  // ==== ROW 4: Experience Map Indicators (legend) ====
  html.push(`<div style="display:flex;align-items:center;gap:16px;padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.04)">
    <div style="font-size:9px;font-weight:700;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:1px">Experience Map Indicators</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#22c55e"><span style="width:20px;height:2px;background:#22c55e;display:inline-block"></span>Business</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#06b6d4"><span style="width:20px;height:2px;background:#06b6d4;display:inline-block"></span>Operations</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#ef4444"><span style="width:20px;height:2px;border-bottom:2px dashed #ef4444;display:inline-block"></span>Customer (CX)</div>
    <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#ef4444;margin-left:8px"><span style="width:10px;height:10px;border-radius:50%;border:2px solid #ef4444;display:inline-block"></span>Divergence</div>
  </div>`);

  // ==== ROW 5: Experience Map Chart placeholder ====
  html.push('<div id="bowtie-exp-chart" style="height:280px;padding:0 8px;border-bottom:1px solid rgba(255,255,255,0.06)"></div>');

  // ==== ROW 6: Touchpoint Labels ====
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  TOUCHPOINTS.forEach(tp => {
    const w = (100 / totalSpan).toFixed(2);
    html.push(`<div style="width:${w}%;text-align:center;padding:6px 2px;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:8px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.3px">${tp}</div>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 7: Platform Impact Bars ====
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  TOUCHPOINTS.forEach((tp, i) => {
    const w = (100 / totalSpan).toFixed(2);
    const impact = platformImpact[i];
    const barW = (impact / 10 * 100).toFixed(0);
    const barColor = impact >= 7 ? '#22c55e' : impact >= 4 ? '#eab308' : impact > 0 ? '#ef4444' : '#222';
    html.push(`<div style="width:${w}%;padding:6px 4px;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:7px;color:${Theme.COLORS.textMuted};text-align:center;margin-bottom:3px">${dataSources[i]}</div>
      <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
        <div style="width:${barW}%;height:100%;background:${barColor};border-radius:3px"></div>
      </div>
      <div style="font-size:7px;color:${Theme.COLORS.textMuted};text-align:center;margin-top:2px">${impact}/10</div>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 8: Key Observations + Opportunities (text per phase) ====
  const observations = _computeObservations(d);
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  PHASES.forEach((phase, pi) => {
    const w = (phase.span / totalSpan * 100).toFixed(2);
    const obs = observations[pi] || [];
    html.push(`<div style="width:${w}%;padding:10px 8px;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:8px;font-weight:700;color:${phase.color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Opportunities</div>
      <ul style="margin:0;padding-left:12px;font-size:9px;color:${Theme.COLORS.textSecondary};line-height:1.5">
        ${obs.map(o => `<li>${o}</li>`).join('')}
      </ul>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 9: KPI Metrics per Phase ====
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  PHASES.forEach((phase, pi) => {
    const w = (phase.span / totalSpan * 100).toFixed(2);
    const kpis = phaseKPIs[pi];
    html.push(`<div style="width:${w}%;padding:8px;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:8px;font-weight:700;color:${phase.color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Metrics</div>
      <div style="display:flex;flex-wrap:wrap;gap:3px">
        ${kpis.map(k => `<span style="font-size:8px;padding:2px 5px;border-radius:3px;background:rgba(255,255,255,0.04);color:${Theme.COLORS.textMuted};border:1px solid rgba(255,255,255,0.06)">${k}</span>`).join('')}
      </div>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 10: Path Satisfaction Scale (face emojis) ====
  const faces = ['X', 'X', ':|', ':|', ':|', ':)', ':)', ':|', ':)', ':|', ':)', 'X', 'X', 'X', 'X'];
  const faceColors = faces.map(f => f === ':)' ? '#22c55e' : f === ':|' ? '#eab308' : '#ef4444');
  html.push('<div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06)">');
  TOUCHPOINTS.forEach((tp, i) => {
    const w = (100 / totalSpan).toFixed(2);
    html.push(`<div style="width:${w}%;text-align:center;padding:6px 2px;border-right:1px solid rgba(255,255,255,0.04)">
      <div style="width:18px;height:18px;border-radius:50%;background:${faceColors[i]}22;border:1.5px solid ${faceColors[i]};margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;color:${faceColors[i]}">${faces[i]}</div>
    </div>`);
  });
  html.push('</div>');

  // ==== ROW 11: Phase Health Gauges (circular CSAT-style) ====
  html.push('<div style="display:flex;padding:16px 0;background:rgba(255,255,255,0.02)">');
  PHASES.forEach((phase, pi) => {
    const w = (phase.span / totalSpan * 100).toFixed(2);
    const score = phaseScores[pi];
    const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
    const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Needs Work' : 'Critical';

    // SVG semi-circle gauge (like RocketSource CSAT gauges)
    const angle = (score / 100) * 180;
    const rad = angle * Math.PI / 180;
    const x = 50 + 35 * Math.cos(Math.PI - rad);
    const y = 50 - 35 * Math.sin(Math.PI - rad);
    const largeArc = angle > 90 ? 1 : 0;

    html.push(`<div style="width:${w}%;text-align:center;padding:0 8px">
      <svg viewBox="0 0 100 60" width="90" height="54" style="margin:0 auto;display:block">
        <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6" stroke-linecap="round"/>
        <path d="M 15 50 A 35 35 0 ${largeArc} 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${scoreColor}" stroke-width="6" stroke-linecap="round"/>
        <text x="50" y="48" text-anchor="middle" font-size="18" font-weight="700" fill="${scoreColor}">${score}</text>
      </svg>
      <div style="font-size:9px;color:${scoreColor};font-weight:600;margin-top:2px">${label}</div>
      <div style="font-size:8px;color:${Theme.COLORS.textMuted};margin-top:1px">${phase.name}</div>
    </div>`);
  });
  html.push('</div>');

  // Single DOM write instead of 10+ innerHTML += reflows
  bowtie.innerHTML = html.join('');

  wrap.appendChild(bowtie);
  container.appendChild(wrap);

  // Render the experience map chart
  requestAnimationFrame(() => {
    _renderExperienceMapRS(document.getElementById('bowtie-exp-chart'), TOUCHPOINTS, bizScores, opsScores, cxScores);
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

function _renderExperienceMapRS(el, touchpoints, biz, ops, cx) {
  if (typeof Plotly === 'undefined' || !el) return;

  // Find divergence points (where biz/ops and CX differ by 2+)
  const divergeAnnotations = [];
  cx.forEach((cxVal, i) => {
    const maxBiz = Math.max(biz[i], ops[i]);
    if (maxBiz - cxVal >= 2 && cxVal > 0) {
      divergeAnnotations.push({
        x: touchpoints[i], y: cxVal,
        xref: 'x', yref: 'y',
        text: '', showarrow: false,
        ax: 0, ay: 0,
      });
    }
  });

  // Divergence marker circles (open red circles at divergence points)
  const divergeX = [], divergeY = [];
  cx.forEach((cxVal, i) => {
    if (Math.max(biz[i], ops[i]) - cxVal >= 2 && cxVal > 0) {
      divergeX.push(touchpoints[i]);
      divergeY.push(cxVal);
    }
  });

  const bizTrace = {
    type: 'scatter', mode: 'lines+markers', name: 'Business',
    x: touchpoints, y: biz,
    line: { color: '#22c55e', width: 2.5, shape: 'spline' },
    marker: { color: '#22c55e', size: 6 },
    hovertemplate: '%{x}: %{y}<extra>Business</extra>',
  };

  const opsTrace = {
    type: 'scatter', mode: 'lines+markers', name: 'Operations',
    x: touchpoints, y: ops,
    line: { color: '#06b6d4', width: 2, shape: 'spline' },
    marker: { color: '#06b6d4', size: 5 },
    hovertemplate: '%{x}: %{y}<extra>Operations</extra>',
  };

  const cxTrace = {
    type: 'scatter', mode: 'lines+markers', name: 'Customer (CX)',
    x: touchpoints, y: cx,
    line: { color: '#ef4444', width: 2, dash: 'dash', shape: 'spline' },
    marker: { color: '#ef4444', size: 5 },
    hovertemplate: '%{x}: %{y}<extra>CX</extra>',
  };

  // Divergence warning circles
  const divergeTrace = {
    type: 'scatter', mode: 'markers', name: 'Divergence',
    x: divergeX, y: divergeY, showlegend: false,
    marker: { color: 'rgba(239,68,68,0)', size: 16, line: { color: '#ef4444', width: 2.5 } },
    hovertemplate: 'Divergence at %{x}<extra></extra>',
  };

  // Shaded divergence area between biz (max) and CX
  const fillUpper = biz.map((b, i) => Math.max(b, ops[i]));
  const fillTrace = {
    type: 'scatter', mode: 'lines', name: 'BizMax',
    x: touchpoints, y: fillUpper,
    line: { color: 'transparent', shape: 'spline' },
    showlegend: false, hoverinfo: 'skip',
  };
  const fillCXTrace = {
    type: 'scatter', mode: 'lines', name: 'CXfill',
    x: touchpoints, y: cx,
    line: { color: 'transparent', shape: 'spline' },
    fill: 'tonexty', fillcolor: 'rgba(239,68,68,0.08)',
    showlegend: false, hoverinfo: 'skip',
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 10, r: 20, b: 50, l: 30 },
    showlegend: false,
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      range: [0, 10.5],
      dtick: 2,
      showgrid: true,
      gridcolor: 'rgba(255,255,255,0.04)',
      tickfont: { size: 9, color: Theme.COLORS.textMuted },
    },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      tickangle: -30,
      tickfont: { size: 9, color: Theme.COLORS.textSecondary },
    },
    // Vertical phase dividers
    shapes: [
      { type: 'line', x0: 4.5, x1: 4.5, y0: 0, y1: 10.5, line: { color: 'rgba(255,255,255,0.08)', width: 1, dash: 'dot' } },
      { type: 'line', x0: 7.5, x1: 7.5, y0: 0, y1: 10.5, line: { color: 'rgba(255,255,255,0.08)', width: 1, dash: 'dot' } },
      { type: 'line', x0: 10.5, x1: 10.5, y0: 0, y1: 10.5, line: { color: 'rgba(255,255,255,0.08)', width: 1, dash: 'dot' } },
      { type: 'line', x0: 12.5, x1: 12.5, y0: 0, y1: 10.5, line: { color: 'rgba(255,255,255,0.08)', width: 1, dash: 'dot' } },
    ],
  };

  Plotly.newPlot(el, [fillTrace, fillCXTrace, bizTrace, opsTrace, cxTrace, divergeTrace], layout, Theme.PLOTLY_CONFIG);
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

