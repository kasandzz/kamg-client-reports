/* ============================================
   Funnels -- COD acquisition funnel analysis
   KPI strip, Hero Sankey, Conversion Waterfall,
   Per-100 Dropout visualization
   ============================================ */

App.registerPage('funnels', async (container) => {
  const days = Filters.getDays();
  let kpis, weekly;

  try {
    [kpis, weekly] = await Promise.all([
      API.query('funnels', 'default', { days }),
      API.query('funnels', 'weekly', { days: Math.max(days, 90) })
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

  // ---- Hero: Funnel Sankey (full width) ----
  const sankeyCard = _funnelCard('Funnel Flow');
  sankeyCard.style.marginTop = '16px';
  const sankeyDiv = document.createElement('div');
  sankeyDiv.id = 'funnels-sankey';
  sankeyDiv.style.minHeight = '400px';
  sankeyCard.appendChild(sankeyDiv);
  container.appendChild(sankeyCard);

  // ---- Conversion Waterfall ----
  const waterfallCard = _funnelCard('Stage-to-Stage Conversion Rates');
  waterfallCard.style.marginTop = '16px';
  const waterfallDiv = document.createElement('div');
  waterfallDiv.id = 'funnels-waterfall';
  waterfallDiv.style.minHeight = '320px';
  waterfallCard.appendChild(waterfallDiv);
  container.appendChild(waterfallCard);

  // ---- Per-100 Dropout ----
  const dropoutCard = _funnelCard('Per-100 Dropout Analysis');
  dropoutCard.style.marginTop = '16px';
  dropoutCard.appendChild(_renderDropoutFlow(d));
  container.appendChild(dropoutCard);

  // ---- Weekly Trend (if data available) ----
  if (weekly && weekly.length > 1) {
    const trendCard = _funnelCard('Weekly Funnel Trend');
    trendCard.style.marginTop = '16px';
    const trendDiv = document.createElement('div');
    trendDiv.id = 'funnels-trend';
    trendDiv.style.minHeight = '280px';
    trendCard.appendChild(trendDiv);
    container.appendChild(trendCard);

    requestAnimationFrame(() => {
      _renderWeeklyTrend(trendDiv, weekly);
    });
  }

  // Render charts after DOM paint
  requestAnimationFrame(() => {
    _renderSankey(sankeyDiv, d);
    _renderConversionWaterfall(waterfallDiv, d);
  });

  // ---- Journey Stage Cards ----
  const STAGES = [
    { num: 1,  name: 'Ad Exposure',    color: '#4F9CF9', field: null,         tracking: 'partial'  },
    { num: 2,  name: 'Landing Page',   color: '#6E56CF', field: null,         tracking: 'partial'  },
    { num: 3,  name: 'Ticket Purchase',color: '#3b82f6', field: 'total_tickets', tracking: 'full'  },
    { num: 4,  name: 'Workshop',       color: '#06b6d4', field: 'attended',   tracking: 'partial'  },
    { num: 5,  name: 'VIP Upsell',     color: '#14b8a6', field: null,         tracking: 'full'     },
    { num: 6,  name: 'Call Booking',   color: '#22c55e', field: 'booked',     tracking: 'full'     },
    { num: 7,  name: 'Sales Call',     color: '#84cc16', field: 'calls_completed', tracking: 'full' },
    { num: 8,  name: 'Enrollment',     color: '#eab308', field: 'enrolled',   tracking: 'full'     },
    { num: 9,  name: 'Onboarding',     color: '#f97316', field: null,         tracking: 'missing'  },
    { num: 10, name: 'Delivery',       color: '#ef4444', field: null,         tracking: 'missing'  },
    { num: 11, name: 'Retention',      color: '#ec4899', field: null,         tracking: 'missing'  },
    { num: 12, name: 'Advocacy',       color: '#a855f7', field: null,         tracking: 'missing'  },
  ];

  const stageHeader = document.createElement('div');
  stageHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:24px 0 12px';
  stageHeader.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Customer Journey Stages</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Click any stage to drill into detail.</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:${Theme.COLORS.textSecondary}">
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.success};display:inline-block"></span>Full</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.warning};display:inline-block"></span>Partial</span>
      <span style="display:inline-flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.danger};display:inline-block"></span>Missing</span>
    </div>
  `;
  container.appendChild(stageHeader);

  const scrollWrap = document.createElement('div');
  scrollWrap.style.cssText = 'overflow-x:auto;padding-bottom:8px';
  const stageRow = document.createElement('div');
  stageRow.style.cssText = 'display:flex;align-items:stretch;gap:0;min-width:max-content;padding:16px 4px';

  STAGES.forEach((stage, idx) => {
    const vol = stage.field ? (d[stage.field] || 0) : null;
    const isRetention = stage.num >= 9;
    const cardOpacity = isRetention ? '0.65' : '1';

    let badgeBg, badgeColor, badgeBorder, badgeLabel;
    if (stage.tracking === 'full') { badgeBg='rgba(34,197,94,0.12)'; badgeColor=Theme.COLORS.success; badgeBorder='1px solid rgba(34,197,94,0.3)'; badgeLabel='Full'; }
    else if (stage.tracking === 'partial') { badgeBg='rgba(234,179,8,0.12)'; badgeColor=Theme.COLORS.warning; badgeBorder='1px solid rgba(234,179,8,0.3)'; badgeLabel='Partial'; }
    else { badgeBg='rgba(239,68,68,0.08)'; badgeColor=Theme.COLORS.danger; badgeBorder='1px dashed rgba(239,68,68,0.4)'; badgeLabel='Missing'; }

    const card = document.createElement('div');
    card.style.cssText = `width:148px;min-width:148px;min-height:180px;background:${Theme.COLORS.bgCard};border:1px solid ${isRetention?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.08)'};border-top:3px solid ${stage.color};border-radius:8px;padding:14px 12px 12px;opacity:${cardOpacity};transition:opacity .15s,border-color .15s,transform .15s;display:flex;flex-direction:column;gap:8px;flex-shrink:0`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:10px;font-weight:700;color:${stage.color};text-transform:uppercase;letter-spacing:.06em">Stage ${stage.num}</span>
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${badgeBg};color:${badgeColor};border:${badgeBorder};font-weight:500">${badgeLabel}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};line-height:1.3">${stage.name}</div>
      <div style="margin-top:auto">
        <div style="font-size:22px;font-weight:700;color:${vol !== null ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted}">${vol !== null ? Theme.num(vol) : '--'}</div>
        <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:1px">${vol !== null ? 'last ' + days + 'd' : 'no data'}</div>
      </div>
    `;
    card.addEventListener('mouseenter', () => { card.style.opacity='1'; card.style.borderColor=stage.color; card.style.transform='translateY(-2px)'; });
    card.addEventListener('mouseleave', () => { card.style.opacity=cardOpacity; card.style.borderColor=isRetention?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.08)'; card.style.transform='translateY(0)'; });
    stageRow.appendChild(card);

    if (idx < STAGES.length - 1) {
      const arrow = document.createElement('div');
      const isWaist = idx === 7;
      arrow.style.cssText = `display:flex;align-items:center;justify-content:center;width:${isWaist?'28px':'20px'};min-width:${isWaist?'28px':'20px'};flex-shrink:0;color:${isWaist?Theme.COLORS.warning:Theme.COLORS.textMuted};font-size:${isWaist?'16px':'12px'};opacity:${isWaist?'0.9':'0.5'}`;
      arrow.innerHTML = isWaist ? '&#10234;' : '&#10142;';
      stageRow.appendChild(arrow);
    }
  });

  scrollWrap.appendChild(stageRow);
  container.appendChild(scrollWrap);

  // ---- Tracking Coverage ----
  const fullCount = STAGES.filter(s => s.tracking === 'full').length;
  const partialCount = STAGES.filter(s => s.tracking === 'partial').length;
  const coverageCard = _funnelCard('Tracking Coverage');
  coverageCard.style.marginTop = '16px';
  const trackingBars = STAGES.map(s => {
    const bg = s.tracking === 'full' ? Theme.COLORS.success : s.tracking === 'partial' ? Theme.COLORS.warning : 'rgba(239,68,68,0.35)';
    return `<span title="Stage ${s.num}: ${s.name} (${s.tracking})" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${bg};margin:1px;cursor:default"></span>`;
  }).join('');
  coverageCard.innerHTML += `
    <div style="display:flex;align-items:center;gap:16px">
      <div style="font-size:28px;font-weight:700;color:${fullCount >= 8 ? Theme.COLORS.success : Theme.COLORS.warning}">${fullCount} <span style="font-size:14px;font-weight:400;color:${Theme.COLORS.textMuted}">of 12 full</span></div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted}">${partialCount} partial, ${12-fullCount-partialCount} missing</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px;margin-left:auto">${trackingBars}</div>
    </div>
  `;
  container.appendChild(coverageCard);
});

// ---- Helpers ----

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

function _renderSankey(el, d) {
  if (typeof Plotly === 'undefined') return;

  const totalTickets = d.total_tickets || 0;
  const attended = d.attended || 0;
  const booked = d.booked || 0;
  const callsCompleted = d.calls_completed || 0;
  const enrolled = d.enrolled || 0;

  const didntShow = Math.max(0, totalTickets - attended);
  const didntBook = Math.max(0, attended - booked);
  const noShowCall = Math.max(0, booked - callsCompleted);
  const notEnrolled = Math.max(0, callsCompleted - enrolled);

  const nodes = [
    'Tickets',          // 0
    'Attended',         // 1
    "Didn't Show",      // 2
    'Booked',           // 3
    "Didn't Book",      // 4
    'Showed to Call',   // 5
    'No-Show Call',     // 6
    'Enrolled',         // 7
    'Not Enrolled'      // 8
  ];

  const nodeColors = [
    Theme.FUNNEL.blue,
    Theme.FUNNEL.cyan,
    'rgba(239,68,68,0.4)',
    Theme.FUNNEL.teal,
    'rgba(239,68,68,0.4)',
    Theme.FUNNEL.green,
    'rgba(239,68,68,0.4)',
    Theme.FUNNEL.purple,
    'rgba(239,68,68,0.4)'
  ];

  const links = {
    source: [0, 0, 1, 1, 3, 3, 5, 5],
    target: [1, 2, 3, 4, 5, 6, 7, 8],
    value: [
      attended, didntShow,
      booked, didntBook,
      callsCompleted, noShowCall,
      enrolled, notEnrolled
    ],
    color: [
      'rgba(59,130,246,0.3)',  'rgba(239,68,68,0.2)',
      'rgba(6,182,212,0.3)',   'rgba(239,68,68,0.2)',
      'rgba(20,184,166,0.3)',  'rgba(239,68,68,0.2)',
      'rgba(168,85,247,0.3)',  'rgba(239,68,68,0.2)'
    ]
  };

  // Filter out zero-value links to avoid Plotly rendering artifacts
  const validIdx = links.value.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0);
  const filteredLinks = {
    source: validIdx.map(i => links.source[i]),
    target: validIdx.map(i => links.target[i]),
    value: validIdx.map(i => links.value[i]),
    color: validIdx.map(i => links.color[i])
  };

  const trace = {
    type: 'sankey',
    orientation: 'h',
    arrangement: 'snap',
    node: {
      pad: 20,
      thickness: 24,
      line: { color: Theme.COLORS.border, width: 0.5 },
      label: nodes,
      color: nodeColors,
      hovertemplate: '%{label}: %{value:,}<extra></extra>'
    },
    link: {
      ...filteredLinks,
      hovertemplate: '%{source.label} -> %{target.label}: %{value:,}<extra></extra>'
    }
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    font: { ...Theme.PLOTLY_LAYOUT.font, size: 12 },
    margin: { t: 20, r: 20, b: 20, l: 20 },
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderConversionWaterfall(el, d) {
  if (typeof Plotly === 'undefined') return;

  const showRate = d.show_rate || 0;
  const bookingRate = d.booking_rate || 0;
  const showToCallRate = d.show_to_call_rate || 0;
  const closeRate = d.close_rate || 0;

  const stages = ['Ticket -> Show', 'Show -> Book', 'Book -> Call', 'Call -> Enroll'];
  const values = [showRate, bookingRate, showToCallRate, closeRate];

  const barColors = values.map(v =>
    v >= 60 ? Theme.FUNNEL.green :
    v >= 35 ? Theme.FUNNEL.yellow :
    Theme.COLORS.danger
  );

  const trace = {
    type: 'bar',
    x: stages,
    y: values,
    marker: { color: barColors },
    text: values.map(v => v.toFixed(1) + '%'),
    textposition: 'outside',
    textfont: { color: Theme.COLORS.textSecondary, size: 12 },
    hovertemplate: '%{x}: %{y:.1f}%<extra></extra>',
    cliponaxis: false
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 40, r: 20, b: 60, l: 60 },
    showlegend: false,
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      tickformat: '.0f',
      ticksuffix: '%',
      range: [0, Math.min(100, Math.max(...values) * 1.3)],
    },
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      tickfont: { color: Theme.COLORS.textSecondary, size: 11 }
    },
    annotations: values.map((v, i) => ({
      x: stages[i],
      y: v,
      text: v >= 60 ? 'On Track' : v >= 35 ? 'Watch' : 'Needs Work',
      showarrow: false,
      yanchor: 'bottom',
      yshift: 22,
      font: {
        size: 10,
        color: v >= 60 ? Theme.FUNNEL.green : v >= 35 ? Theme.FUNNEL.yellow : Theme.COLORS.danger
      }
    }))
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderDropoutFlow(d) {
  const totalTickets = d.total_tickets || 1;
  const attended = d.attended || 0;
  const booked = d.booked || 0;
  const callsCompleted = d.calls_completed || 0;
  const enrolled = d.enrolled || 0;

  const per100 = (n) => Math.round((n / totalTickets) * 100);

  const p100Tickets  = 100;
  const p100Attended = per100(attended);
  const p100Booked   = per100(booked);
  const p100Called   = per100(callsCompleted);
  const p100Enrolled = per100(enrolled);

  const stages = [
    { label: 'Tickets',      value: p100Tickets,  color: Theme.FUNNEL.blue },
    { label: 'Attended',     value: p100Attended, color: Theme.FUNNEL.cyan },
    { label: 'Booked',       value: p100Booked,   color: Theme.FUNNEL.teal },
    { label: 'Called',       value: p100Called,   color: Theme.FUNNEL.green },
    { label: 'Enrolled',     value: p100Enrolled, color: Theme.FUNNEL.purple },
  ];

  const dropouts = [
    p100Tickets  - p100Attended,
    p100Attended - p100Booked,
    p100Booked   - p100Called,
    p100Called   - p100Enrolled,
  ];

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-top:8px;overflow-x:auto';

  const flow = document.createElement('div');
  flow.style.cssText = 'display:flex;align-items:center;gap:0;min-width:560px;padding:8px 0';
  wrapper.appendChild(flow);

  stages.forEach((stage, i) => {
    // Stage block
    const block = document.createElement('div');
    block.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;justify-content:center',
      'border-radius:8px;padding:12px 16px;min-width:88px',
      'background:' + stage.color + '22',
      'border:1.5px solid ' + stage.color,
    ].join(';');

    const valEl = document.createElement('div');
    valEl.style.cssText = 'font-size:28px;font-weight:700;color:' + stage.color;
    valEl.textContent = stage.value;

    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:4px;text-align:center';
    labelEl.textContent = stage.label;

    block.appendChild(valEl);
    block.appendChild(labelEl);
    flow.appendChild(block);

    // Connector + dropout if not last
    if (i < stages.length - 1) {
      const connector = document.createElement('div');
      connector.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:56px';

      const arrowWrap = document.createElement('div');
      arrowWrap.style.cssText = 'width:100%;height:2px;background:' + Theme.COLORS.border + ';position:relative';

      const arrowHead = document.createElement('div');
      arrowHead.style.cssText = [
        'position:absolute;right:-1px;top:50%;transform:translateY(-50%)',
        'width:0;height:0',
        'border-top:5px solid transparent;border-bottom:5px solid transparent',
        'border-left:7px solid ' + Theme.COLORS.border,
      ].join(';');
      arrowWrap.appendChild(arrowHead);

      const dropLabel = document.createElement('div');
      const dropVal = dropouts[i];
      dropLabel.style.cssText = 'font-size:10px;margin-top:6px;text-align:center;color:' +
        (dropVal > 30 ? Theme.COLORS.danger : dropVal > 15 ? Theme.FUNNEL.yellow : Theme.COLORS.textMuted);
      dropLabel.textContent = '-' + dropVal;

      connector.appendChild(arrowWrap);
      connector.appendChild(dropLabel);
      flow.appendChild(connector);
    }
  });

  // Summary line
  const summary = document.createElement('div');
  summary.style.cssText = 'margin-top:12px;font-size:11px;color:' + Theme.COLORS.textMuted;
  summary.textContent = `Per 100 tickets: ${p100Attended} attend, ${p100Booked} book a call, ${p100Called} show up, ${p100Enrolled} enroll`;
  wrapper.appendChild(summary);

  return wrapper;
}

function _renderWeeklyTrend(el, weekly) {
  if (typeof Plotly === 'undefined') return;

  const weeks = weekly.map(r => r.week ? String(r.week).substring(0, 10) : '');
  const tickets = weekly.map(r => r.tickets || 0);
  const attended = weekly.map(r => r.attended || 0);
  const booked = weekly.map(r => r.booked || 0);
  const enrolledW = weekly.map(r => r.enrolled || 0);

  const traces = [
    { name: 'Tickets',  y: tickets,  marker: { color: Theme.FUNNEL.blue },   line: { color: Theme.FUNNEL.blue } },
    { name: 'Attended', y: attended, marker: { color: Theme.FUNNEL.cyan },   line: { color: Theme.FUNNEL.cyan } },
    { name: 'Booked',   y: booked,   marker: { color: Theme.FUNNEL.teal },   line: { color: Theme.FUNNEL.teal } },
    { name: 'Enrolled', y: enrolledW, marker: { color: Theme.FUNNEL.purple }, line: { color: Theme.FUNNEL.purple } },
  ].map(t => ({
    type: 'scatter',
    mode: 'lines+markers',
    x: weeks,
    name: t.name,
    y: t.y,
    line: { ...t.line, width: 2 },
    marker: { ...t.marker, size: 5 },
    hovertemplate: t.name + ': %{y:,}<extra></extra>'
  }));

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 20, r: 20, b: 60, l: 60 },
    showlegend: true,
    legend: { ...Theme.PLOTLY_LAYOUT.legend, orientation: 'h', y: -0.25 },
    yaxis: { ...Theme.PLOTLY_LAYOUT.yaxis, tickformat: ',' },
    xaxis: { ...Theme.PLOTLY_LAYOUT.xaxis, tickangle: -30 }
  };

  Plotly.newPlot(el, traces, layout, Theme.PLOTLY_CONFIG);
}
