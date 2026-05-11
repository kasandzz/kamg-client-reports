/* ============================================
   Journey Map Overview -- 12-stage bow-tie visualization
   Full customer journey from Ad Exposure to Advocacy
   ============================================ */

App.registerPage('journey-explorer', async (container) => {
  const days = Filters.getDays();

  let raw, sankeyRows, speedRows, cohortRows;
  const _jeErrors = {};
  try {
    const settled = await Promise.allSettled([
      API.query('journey-explorer', 'default',        { days }),
      API.query('journey-explorer', 'sankey',         { days }),
      API.query('journey-explorer', 'speedToClose',   { days: Math.max(days, 180) }),
      API.query('journey-explorer', 'cohortVelocity', { weeks: 12 }),
    ]);
    raw         = settled[0].status === 'fulfilled' ? settled[0].value : (_jeErrors.default = settled[0].reason?.message, null);
    sankeyRows  = settled[1].status === 'fulfilled' ? settled[1].value : (_jeErrors.sankey = settled[1].reason?.message, null);
    speedRows   = settled[2].status === 'fulfilled' ? settled[2].value : (_jeErrors.speed = settled[2].reason?.message, null);
    cohortRows  = settled[3].status === 'fulfilled' ? settled[3].value : (_jeErrors.cohort = settled[3].reason?.message, null);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Journey Map: ${err.message}</p></div>`;
    return;
  }

  const d = (raw && raw.length > 0) ? raw[0] : {};
  container.innerHTML = '';

  // ---- Stage definitions ----
  const STAGES = [
    { num: 1,  name: 'Ad Exposure',    color: '#4F9CF9', field: null,         tracking: 'partial'  },
    { num: 2,  name: 'Landing Page',   color: '#6E56CF', field: null,         tracking: 'partial'  },
    { num: 3,  name: 'Ticket Purchase',color: '#3b82f6', field: 'tickets',    tracking: 'full'     },
    { num: 4,  name: 'Workshop',       color: '#06b6d4', field: 'attended',   tracking: 'partial'  },
    { num: 5,  name: 'VIP Upsell',     color: '#14b8a6', field: 'vip',        tracking: 'full'     },
    { num: 6,  name: 'Call Booking',   color: '#22c55e', field: 'booked',     tracking: 'full'     },
    { num: 7,  name: 'Sales Call',     color: '#84cc16', field: 'calls_done', tracking: 'full'     },
    { num: 8,  name: 'Enrollment',     color: '#eab308', field: 'enrolled',   tracking: 'full'     },
    { num: 9,  name: 'Onboarding',     color: '#f97316', field: null,         tracking: 'missing'  },
    { num: 10, name: 'Lions Pride',          color: '#ef4444', field: null,         tracking: 'missing'  },
    { num: 11, name: 'Millionaires Alliance', color: '#ec4899', field: null,         tracking: 'missing'  },
    { num: 12, name: 'Advocacy',       color: '#a855f7', field: null,         tracking: 'missing'  },
  ];

  // Pre-computed CVR fields from BQ (field -> next stage)
  const CVR_MAP = {
    tickets:    { label: 'Show Rate',      value: d.show_rate        },
    attended:   { label: 'Booking Rate',   value: d.booking_rate     },
    vip:        { label: null,             value: null               },
    booked:     { label: 'Call Show',      value: d.call_show_rate   },
    calls_done: { label: 'Close Rate',     value: d.close_rate       },
  };

  // Count tracking coverage
  const fullCount    = STAGES.filter(s => s.tracking === 'full').length;
  const partialCount = STAGES.filter(s => s.tracking === 'partial').length;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Tickets Sold',    value: d.tickets     || 0, format: 'num', source: 'BQ stripe_charges', calc: 'COUNT(charges WHERE amount IN (27, 54) AND status = succeeded)' },
    { label: 'Attended',        value: d.attended    || 0, format: 'num', source: 'BQ zoom_attendance', calc: 'COUNT(DISTINCT email WHERE attended = true)' },
    { label: 'Enrolled',        value: d.enrolled    || 0, format: 'num', source: 'BQ hyros_sales', calc: 'COUNT(sales WHERE tag = enrolled)' },
    { label: 'Overall CVR',     value: d.overall_cvr || 0, format: 'pct', source: 'BQ master_journey table', calc: 'enrolled / tickets_sold' },
    { label: 'Close Rate',      value: d.close_rate  || 0, format: 'pct', source: 'BQ master_journey table', calc: 'enrolled / showed_on_call' },
    { label: 'Show Rate',       value: d.show_rate   || 0, format: 'pct', source: 'BQ zoom_attendance JOIN ghl_appointments', calc: 'attended / booked' },
  ]);

  // ---- Section header ----
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px';
  headerRow.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Customer Journey Stages</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Click any stage to drill into detail. Arrows show conversion to next stage.</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:${Theme.COLORS.textSecondary}">
      <span style="display:inline-flex;align-items:center;gap:4px">
        <span style="width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.success};display:inline-block"></span>Full
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px">
        <span style="width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.warning};display:inline-block"></span>Partial
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px">
        <span style="width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.danger};border:1px dashed ${Theme.COLORS.danger};display:inline-block"></span>Missing
      </span>
    </div>
  `;
  container.appendChild(headerRow);

  // ---- Bow-tie scroll container ----
  const scrollWrap = document.createElement('div');
  scrollWrap.style.cssText = 'overflow-x:auto;padding-bottom:8px';

  const stageRow = document.createElement('div');
  stageRow.style.cssText = `
    display:flex;
    align-items:stretch;
    gap:0;
    min-width:max-content;
    padding:16px 4px;
  `;

  STAGES.forEach((stage, idx) => {
    const vol = stage.field ? (d[stage.field] || 0) : null;

    // CVR to next stage (from current stage's field -> next)
    let cvrLabel = null;
    let cvrValue = null;
    if (stage.field && CVR_MAP[stage.field]) {
      const entry = CVR_MAP[stage.field];
      if (entry.label && entry.value != null) {
        cvrLabel = entry.label;
        cvrValue = entry.value;
      }
    }

    // Traffic light color based on CVR value
    let trafficColor = Theme.COLORS.textMuted;
    let trafficIcon  = '';
    if (cvrValue !== null) {
      if (cvrValue >= 70)       { trafficColor = Theme.COLORS.success; trafficIcon = '&#9679;'; }
      else if (cvrValue >= 40)  { trafficColor = Theme.COLORS.warning; trafficIcon = '&#9679;'; }
      else                      { trafficColor = Theme.COLORS.danger;  trafficIcon = '&#9679;'; }
    }

    // Tracking badge styles
    let badgeBg, badgeColor, badgeBorder, badgeLabel;
    if (stage.tracking === 'full') {
      badgeBg     = 'rgba(34,197,94,0.12)';
      badgeColor  = Theme.COLORS.success;
      badgeBorder = `1px solid rgba(34,197,94,0.3)`;
      badgeLabel  = 'Full';
    } else if (stage.tracking === 'partial') {
      badgeBg     = 'rgba(234,179,8,0.12)';
      badgeColor  = Theme.COLORS.warning;
      badgeBorder = `1px solid rgba(234,179,8,0.3)`;
      badgeLabel  = 'Partial';
    } else {
      badgeBg     = 'rgba(239,68,68,0.08)';
      badgeColor  = Theme.COLORS.danger;
      badgeBorder = `1px dashed rgba(239,68,68,0.4)`;
      badgeLabel  = 'Missing';
    }

    // Visual waist: stages 1-8 are "acquisition funnel", 9-12 are "retention"
    // Represent waist at stage 8->9 boundary with subtle opacity change
    const isRetention    = stage.num >= 9;
    const cardOpacity    = isRetention ? '0.65' : '1';

    // Build card
    const card = document.createElement('div');
    card.style.cssText = `
      width:148px;
      min-width:148px;
      min-height:210px;
      background:${Theme.COLORS.bgCard};
      border:1px solid ${isRetention ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'};
      border-top:3px solid ${stage.color};
      border-radius:8px;
      padding:14px 12px 12px;
      cursor:pointer;
      opacity:${cardOpacity};
      transition:opacity .15s,border-color .15s,transform .15s;
      display:flex;
      flex-direction:column;
      gap:8px;
      position:relative;
      flex-shrink:0;
    `;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:10px;font-weight:700;color:${stage.color};text-transform:uppercase;letter-spacing:.06em">Stage ${stage.num}</span>
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:${badgeBg};color:${badgeColor};border:${badgeBorder};font-weight:500">${badgeLabel}</span>
      </div>
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};line-height:1.3">${stage.name}</div>
      <div style="margin-top:auto">
        <div style="font-size:22px;font-weight:700;color:${vol !== null ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted};letter-spacing:-.5px">
          ${vol !== null ? Theme.num(vol) : '--'}
        </div>
        <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:1px">${vol !== null ? `last ${days}d` : 'no data'}</div>
      </div>
      ${cvrLabel ? `
      <div style="margin-top:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em">${cvrLabel}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:3px">
          <span style="font-size:16px;font-weight:700;color:${trafficColor}">${Theme.pct(cvrValue)}</span>
          <span style="font-size:12px;color:${trafficColor}">${trafficIcon}</span>
        </div>
      </div>
      ` : `<div style="height:44px"></div>`}
    `;

    card.addEventListener('mouseenter', () => {
      card.style.opacity       = '1';
      card.style.borderColor   = stage.color;
      card.style.transform     = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.opacity       = cardOpacity;
      card.style.borderColor   = isRetention ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
      card.style.transform     = 'translateY(0)';
    });
    card.addEventListener('click', () => {
      _showStageDetail(stage.num, days);
    });

    stageRow.appendChild(card);

    // Arrow connector between cards (not after last card)
    if (idx < STAGES.length - 1) {
      const arrow = document.createElement('div');
      const isWaist = idx === 7; // between stage 8 and 9

      arrow.style.cssText = `
        display:flex;
        align-items:center;
        justify-content:center;
        width:${isWaist ? '28px' : '20px'};
        min-width:${isWaist ? '28px' : '20px'};
        flex-shrink:0;
        color:${isWaist ? Theme.COLORS.warning : Theme.COLORS.textMuted};
        font-size:${isWaist ? '16px' : '12px'};
        opacity:${isWaist ? '0.9' : '0.5'};
        position:relative;
      `;
      arrow.innerHTML = isWaist
        ? `<span title="Acquisition funnel ends here. Post-enrollment tracking gap." style="cursor:help">&#10234;</span>`
        : `&#10142;`;

      stageRow.appendChild(arrow);
    }
  });

  scrollWrap.appendChild(stageRow);
  container.appendChild(scrollWrap);

  // ---- Summary Stats Row ----
  const summaryGrid = document.createElement('div');
  summaryGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(summaryGrid);

  // Card builder helper
  function summaryCard(icon, title, content) {
    const c = document.createElement('div');
    c.className = 'card';
    c.style.cssText = 'padding:20px';
    c.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:20px;line-height:1">${icon}</div>
        <div style="flex:1">
          <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${title}</div>
          ${content}
        </div>
      </div>
    `;
    return c;
  }

  // 1. Overall CVR
  const overallCvr     = d.overall_cvr || 0;
  const cvrColor       = overallCvr >= 5 ? Theme.COLORS.success : overallCvr >= 2 ? Theme.COLORS.warning : Theme.COLORS.danger;
  summaryGrid.appendChild(summaryCard(
    '&#127919;',
    'Overall CVR (Ticket → Enrolled)',
    `
      <div style="font-size:32px;font-weight:700;color:${cvrColor}">${Theme.pct(overallCvr)}</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:4px">
        ${Theme.num(d.tickets || 0)} tickets &rarr; ${Theme.num(d.enrolled || 0)} enrollments
      </div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:4px">Benchmark: 2-5%</div>
    `
  ));

  // 2. Pipeline velocity placeholder
  summaryGrid.appendChild(summaryCard(
    '&#9203;',
    'Pipeline Velocity',
    `
      <div style="font-size:13px;color:${Theme.COLORS.textMuted};line-height:1.6">
        Velocity data requires timestamp linkage between stages (time from ticket purchase to enrollment).
      </div>
      <div style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 10px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:6px">
        <span style="color:${Theme.COLORS.warning};font-size:13px">&#9888;</span>
        <span style="font-size:11px;color:${Theme.COLORS.warning};font-weight:500">Requires stage timestamp linkage</span>
      </div>
    `
  ));

  // 3. Tracking coverage
  const coveragePct  = Math.round((fullCount / STAGES.length) * 100);
  const coverageColor = coveragePct >= 80 ? Theme.COLORS.success : coveragePct >= 50 ? Theme.COLORS.warning : Theme.COLORS.danger;

  const trackingBars = STAGES.map(s => {
    let bg;
    if (s.tracking === 'full')    bg = Theme.COLORS.success;
    else if (s.tracking === 'partial') bg = Theme.COLORS.warning;
    else                          bg = 'rgba(239,68,68,0.35)';
    return `<span title="Stage ${s.num}: ${s.name} (${s.tracking})" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${bg};margin:1px;cursor:default"></span>`;
  }).join('');

  summaryGrid.appendChild(summaryCard(
    '&#128268;',
    'Tracking Coverage',
    `
      <div style="font-size:28px;font-weight:700;color:${coverageColor}">${fullCount} <span style="font-size:14px;font-weight:400;color:${Theme.COLORS.textMuted}">of 12 full</span></div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:2px">${partialCount} partial &bull; ${12 - fullCount - partialCount} missing</div>
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:2px">${trackingBars}</div>
    `
  ));

  // ---- Stage Detail Section (inline deep-dive) ----
  const stageDetailSection = document.createElement('div');
  stageDetailSection.id = 'stage-detail-section';
  stageDetailSection.style.cssText = 'margin-top:16px';
  container.appendChild(stageDetailSection);

  // ===================================================================
  // SECTION: Sankey Journey Flow
  // Source: bridge_customer_journey
  // ===================================================================
  const sankeyHeader = document.createElement('div');
  sankeyHeader.style.cssText = 'margin:24px 0 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px';
  sankeyHeader.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Sankey Journey Flow</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">End-to-end flow from first-touch platform through every stage. Drop-offs visible as branching weight.</div>
    </div>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};padding:4px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.06)">
      <span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:6px"></span>BQ: bridge_customer_journey
    </div>
  `;
  container.appendChild(sankeyHeader);

  const sankeyCard = document.createElement('div');
  sankeyCard.className = 'card';
  sankeyCard.style.cssText = 'padding:20px';
  container.appendChild(sankeyCard);

  if (_jeErrors.sankey) {
    sankeyCard.innerHTML = `<div class="text-muted" style="text-align:center;padding:24px">Sankey unavailable: ${_jeErrors.sankey}</div>`;
  } else if (!sankeyRows || sankeyRows.length === 0) {
    sankeyCard.innerHTML = '<div class="text-muted" style="text-align:center;padding:24px">No journey flow data in selected window.</div>';
  } else {
    const sankeyDivId = 'journey-sankey-flow';
    const sankeyDiv = document.createElement('div');
    sankeyDiv.id = sankeyDivId;
    sankeyDiv.style.cssText = 'height:480px;width:100%';
    sankeyCard.appendChild(sankeyDiv);

    const _nodeColors = {
      'Lead':                 '#6366f1',
      'Ticket':               '#3b82f6',
      'Lost: No Ticket':      '#ef4444',
      'Attended':             '#06b6d4',
      'No Show':              '#ef4444',
      'Booked':               '#22c55e',
      'No Booking':           '#ef4444',
      'Showed':               '#84cc16',
      'Call No Show':         '#ef4444',
      'Enrolled':             '#eab308',
      'Lost: Did Not Close':  '#ef4444',
    };
    const _platformColors = {
      'facebook':  '#1877f2',
      'google':    '#4285f4',
      'youtube':   '#ff0000',
      'tiktok':    '#69c9d0',
      'general':   '#a855f7',
      'unknown':   '#6b7280',
      'automatic': '#14b8a6',
    };

    const nodeSet = new Set();
    sankeyRows.forEach(r => {
      nodeSet.add(r.from_node);
      nodeSet.add(r.to_node);
    });
    const nodes = Array.from(nodeSet);
    const nodeIdx = Object.fromEntries(nodes.map((n, i) => [n, i]));
    const nodeColors = nodes.map(n => _nodeColors[n] || _platformColors[n] || '#6366f1');

    // Precompute total outflow per source node so each link can show its
    // conversion-rate % vs the source. Also precompute total inflow per
    // target node for the node-level hover.
    const outflowBySource = {};
    const inflowByTarget = {};
    sankeyRows.forEach(r => {
      const v = Number(r.value) || 0;
      outflowBySource[r.from_node] = (outflowBySource[r.from_node] || 0) + v;
      inflowByTarget[r.to_node]   = (inflowByTarget[r.to_node]   || 0) + v;
    });

    // Per-link customdata = [conversion_pct, source_label, target_label, source_total, target_total]
    const linkCustomData = sankeyRows.map(r => {
      const v = Number(r.value) || 0;
      const sourceTotal = outflowBySource[r.from_node] || 0;
      const pct = sourceTotal > 0 ? (v / sourceTotal) * 100 : 0;
      return [pct, r.from_node, r.to_node, sourceTotal, inflowByTarget[r.to_node] || 0];
    });

    // Per-node customdata = [inflow_total, outflow_total]
    const nodeCustomData = nodes.map(n => [inflowByTarget[n] || 0, outflowBySource[n] || 0]);

    Plotly.newPlot(
      sankeyDivId,
      [{
        type: 'sankey',
        orientation: 'h',
        node: {
          pad: 14,
          thickness: 18,
          line: { color: 'rgba(255,255,255,0.08)', width: 0.5 },
          label: nodes,
          color: nodeColors,
          customdata: nodeCustomData,
          hovertemplate:
            '<b>%{label}</b><br>' +
            'In: %{customdata[0]:,}<br>' +
            'Out: %{customdata[1]:,}' +
            '<extra></extra>',
        },
        link: {
          source: sankeyRows.map(r => nodeIdx[r.from_node]),
          target: sankeyRows.map(r => nodeIdx[r.to_node]),
          value:  sankeyRows.map(r => Number(r.value) || 0),
          color: sankeyRows.map(r =>
            r.to_node && r.to_node.startsWith('Lost') ? 'rgba(239,68,68,0.20)'
            : r.to_node === 'No Show' || r.to_node === 'Call No Show' || r.to_node === 'No Booking' ? 'rgba(239,68,68,0.18)'
            : r.to_node === 'Enrolled' ? 'rgba(234,179,8,0.35)'
            : 'rgba(99,102,241,0.18)'
          ),
          customdata: linkCustomData,
          hovertemplate:
            '<b>%{customdata[1]} &rarr; %{customdata[2]}</b><br>' +
            'Volume: %{value:,}<br>' +
            'Conversion: %{customdata[0]:.1f}%<br>' +
            '<span style="opacity:.7">of %{customdata[3]:,} from source</span>' +
            '<extra></extra>',
        },
      }],
      {
        ...Theme.PLOTLY_LAYOUT,
        font: { family: 'Manrope, sans-serif', size: 11, color: Theme.COLORS.textPrimary },
        margin: { t: 10, b: 10, l: 10, r: 10 },
      },
      Theme.PLOTLY_CONFIG
    );
  }

  // ===================================================================
  // SECTION: Speed-to-Close Histogram + Cohort Velocity (2-col grid)
  // ===================================================================
  const splitGrid = document.createElement('div');
  splitGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(splitGrid);

  // ---- Speed-to-Close Histogram ----
  const speedCard = document.createElement('div');
  speedCard.className = 'card';
  speedCard.style.cssText = 'padding:20px';
  speedCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em">Speed-to-Close Histogram</div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:2px">Days from first-touch to enrollment. Tail = nurture-driven closes.</div>
      </div>
    </div>
  `;
  splitGrid.appendChild(speedCard);

  if (_jeErrors.speed || !speedRows || speedRows.length === 0) {
    speedCard.innerHTML += `<div class="text-muted" style="text-align:center;padding:32px 16px">${_jeErrors.speed || 'No close-velocity data.'}</div>`;
  } else {
    const speedDivId = 'journey-speed-histogram';
    const speedDiv = document.createElement('div');
    speedDiv.id = speedDivId;
    speedDiv.style.cssText = 'height:340px;width:100%';
    speedCard.appendChild(speedDiv);

    Plotly.newPlot(
      speedDivId,
      [{
        type: 'bar',
        x: speedRows.map(r => r.bucket),
        y: speedRows.map(r => Number(r.enrollments) || 0),
        text: speedRows.map(r => {
          const cash = Number(r.cash) || 0;
          return cash > 0 ? Theme.money(cash) : '';
        }),
        textposition: 'outside',
        marker: {
          color: speedRows.map(r => {
            if (r.bucket === 'Unknown') return '#6b7280';
            const ord = Number(r.ord);
            if (ord <= 1) return '#22c55e';
            if (ord <= 3) return '#06b6d4';
            if (ord <= 5) return '#eab308';
            return '#ef4444';
          }),
        },
        hovertemplate: '<b>%{x}</b><br>%{y} enrollments<extra></extra>',
      }],
      {
        ...Theme.PLOTLY_LAYOUT,
        margin: { t: 20, b: 60, l: 50, r: 20 },
        xaxis: { ...Theme.PLOTLY_LAYOUT.xaxis, tickangle: -30 },
        yaxis: { ...Theme.PLOTLY_LAYOUT.yaxis, title: 'Enrollments' },
      },
      Theme.PLOTLY_CONFIG
    );
  }

  // ---- Cohort Velocity Table ----
  const cohortCard = document.createElement('div');
  cohortCard.className = 'card';
  cohortCard.style.cssText = 'padding:20px;overflow-x:auto';
  cohortCard.innerHTML = `
    <div style="margin-bottom:8px">
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em">Cohort Velocity (Weekly)</div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:2px">Week-of-first-touch cohorts. Compare CVR + close speed across cohorts.</div>
    </div>
  `;
  splitGrid.appendChild(cohortCard);

  if (_jeErrors.cohort || !cohortRows || cohortRows.length === 0) {
    cohortCard.innerHTML += `<div class="text-muted" style="text-align:center;padding:32px 16px">${_jeErrors.cohort || 'No cohort data.'}</div>`;
  } else {
    let html = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02)">
            <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Week</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Cohort</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Tickets</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Booked</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Enrolled</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">CVR</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Avg Days</th>
            <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Cash</th>
          </tr>
        </thead>
        <tbody>
    `;
    cohortRows.forEach((r, i) => {
      const altBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      const cvr = Number(r.overall_cvr_pct) || 0;
      const cvrColor = cvr >= 5 ? Theme.COLORS.success : cvr >= 2 ? Theme.COLORS.warning : Theme.COLORS.textSecondary;
      const week = (r.cohort_week && (r.cohort_week.value || r.cohort_week)) || '';
      const weekIso = String(week).slice(0, 10);
      html += `
        <tr class="cohort-drill-row" data-week="${_esc(weekIso)}" data-size="${Number(r.cohort_size) || 0}" data-cvr="${cvr.toFixed(2)}" style="background:${altBg};border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:background 0.15s" title="Click to drill into this cohort's individuals">
          <td style="padding:8px 10px;color:${Theme.COLORS.textPrimary};font-weight:500"><span style="display:inline-flex;align-items:center;gap:6px">${_esc(weekIso)}<span style="font-size:9px;color:${Theme.COLORS.textMuted};opacity:0.6">&rarr;</span></span></td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${Theme.num(Number(r.cohort_size) || 0)}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${Theme.num(Number(r.tickets) || 0)}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${Theme.num(Number(r.booked) || 0)}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textPrimary};font-weight:600;font-variant-numeric:tabular-nums">${Theme.num(Number(r.enrolled) || 0)}</td>
          <td style="padding:8px 10px;text-align:right;color:${cvrColor};font-weight:600;font-variant-numeric:tabular-nums">${cvr.toFixed(2)}%</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${r.avg_days_to_close != null ? Number(r.avg_days_to_close).toFixed(1) : '–'}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textPrimary};font-variant-numeric:tabular-nums">${Theme.money(Number(r.cohort_cash) || 0)}</td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    cohortCard.innerHTML += html;

    // Wire cohort row click handlers (drill-in to individual journey list).
    // The row uses the same Components.openDrillDown panel as KPI drill-downs.
    setTimeout(() => {
      const drillRows = cohortCard.querySelectorAll('.cohort-drill-row');
      drillRows.forEach(row => {
        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(99,102,241,0.08)'; });
        row.addEventListener('mouseleave', () => {
          const idx = Array.from(drillRows).indexOf(row);
          row.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
        });
        row.addEventListener('click', () => _openCohortDrill(row.dataset.week, Number(row.dataset.size), Number(row.dataset.cvr)));
      });
    }, 0);
  }

  // ===================================================================
  // SECTION: Individual Lookup
  // Source: bridge_customer_journey by email substring
  // ===================================================================
  const lookupHeader = document.createElement('div');
  lookupHeader.style.cssText = 'margin:24px 0 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px';
  lookupHeader.innerHTML = `
    <div>
      <div style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Individual Lookup</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Search any contact's full journey by email. Returns up to 25 most recent matches.</div>
    </div>
  `;
  container.appendChild(lookupHeader);

  const lookupCard = document.createElement('div');
  lookupCard.className = 'card';
  lookupCard.style.cssText = 'padding:20px';
  container.appendChild(lookupCard);

  const lookupForm = document.createElement('div');
  lookupForm.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  lookupForm.innerHTML = `
    <input id="je-lookup-input" type="text" placeholder="Search by email (e.g. gmail.com or jane@example)" style="flex:1;min-width:240px;padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:${Theme.COLORS.textPrimary};font-family:inherit;font-size:13px" />
    <button id="je-lookup-btn" style="padding:10px 18px;background:${Theme.COLORS.accent};border:none;border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit">Search</button>
    <span id="je-lookup-status" style="font-size:11px;color:${Theme.COLORS.textMuted};margin-left:4px"></span>
  `;
  lookupCard.appendChild(lookupForm);

  const lookupResults = document.createElement('div');
  lookupResults.id = 'je-lookup-results';
  lookupResults.style.cssText = 'margin-top:16px';
  lookupCard.appendChild(lookupResults);

  function _yn(v) { return v ? '✓' : '–'; }
  function _fmtTs(t) {
    if (!t) return '–';
    const v = t.value || t;
    return String(v).replace('T', ' ').slice(0, 16);
  }

  async function _runLookup() {
    const input = document.getElementById('je-lookup-input');
    const status = document.getElementById('je-lookup-status');
    const results = document.getElementById('je-lookup-results');
    const q = (input.value || '').trim();
    if (q.length < 3) {
      status.textContent = 'Min 3 characters.';
      status.style.color = '#eab308';
      return;
    }
    status.textContent = 'Searching…';
    status.style.color = Theme.COLORS.textMuted;
    results.innerHTML = '';

    let rows;
    try {
      rows = await API.query('journey-explorer', 'individualLookup', { q });
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
      status.style.color = '#ef4444';
      return;
    }

    if (!rows || rows.length === 0) {
      status.textContent = 'No matches';
      status.style.color = Theme.COLORS.textMuted;
      results.innerHTML = '<div class="text-muted" style="text-align:center;padding:24px">No journey data for that email.</div>';
      return;
    }

    status.textContent = `${rows.length} match${rows.length === 1 ? '' : 'es'}`;
    status.style.color = '#22c55e';

    let html = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02)">
              <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Email</th>
              <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Source</th>
              <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">First Touch</th>
              <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Lead</th>
              <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Ticket</th>
              <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Attended</th>
              <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Booked</th>
              <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Showed</th>
              <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Enrolled</th>
              <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Cash</th>
              <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Days</th>
            </tr>
          </thead>
          <tbody>
    `;
    rows.forEach((r, i) => {
      const altBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      const enrolled = r.enrolled === true || r.enrolled === 'true';
      html += `
        <tr style="background:${altBg};border-bottom:1px solid rgba(255,255,255,0.04)">
          <td style="padding:8px 10px;color:${Theme.COLORS.textPrimary};font-weight:500;font-family:JetBrains Mono,monospace;font-size:11px">${_esc(r.email || '')}</td>
          <td style="padding:8px 10px;color:${Theme.COLORS.textSecondary};font-size:11px">${_esc(r.first_touch_platform || '–')}</td>
          <td style="padding:8px 10px;color:${Theme.COLORS.textMuted};font-size:11px">${_fmtTs(r.first_touch_date)}</td>
          <td style="padding:8px 10px;text-align:center;color:${r.lead_created ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.lead_created)}</td>
          <td style="padding:8px 10px;text-align:center;color:${r.ticket_purchased ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.ticket_purchased)}</td>
          <td style="padding:8px 10px;text-align:center;color:${r.workshop_attended ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.workshop_attended)}</td>
          <td style="padding:8px 10px;text-align:center;color:${r.call_booked ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.call_booked)}</td>
          <td style="padding:8px 10px;text-align:center;color:${r.call_showed ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.call_showed)}</td>
          <td style="padding:8px 10px;text-align:center;color:${enrolled ? '#eab308' : Theme.COLORS.textMuted};font-weight:${enrolled ? '700' : '400'}">${enrolled ? '★' : '–'}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textPrimary};font-variant-numeric:tabular-nums">${Theme.money(Number(r.total_cash) || 0)}</td>
          <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${r.days_lead_to_sale != null ? r.days_lead_to_sale : '–'}</td>
        </tr>
      `;
    });
    html += '</tbody></table></div>';
    results.innerHTML = html;
  }

  setTimeout(() => {
    const btn = document.getElementById('je-lookup-btn');
    const input = document.getElementById('je-lookup-input');
    if (btn) btn.addEventListener('click', _runLookup);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') _runLookup(); });
  }, 0);

  // Cohort drill-in: open the side panel and render a per-individual journey
  // table for the clicked cohort week. Uses the same Components.openDrillDown
  // panel that KPI cards use, so the UX is consistent.
  async function _openCohortDrill(week, size, cvr) {
    const title = `Cohort ${week} -- ${Theme.num(size)} contacts -- ${cvr}% CVR`;
    Components.openDrillDown(title, async () => {
      let rows;
      try {
        rows = await API.query('journey-explorer', 'cohortDrillIn', { week });
      } catch (err) {
        return `<div class="text-muted" style="padding:24px;text-align:center">Error loading cohort: ${_esc(err.message || String(err))}</div>`;
      }
      if (!rows || rows.length === 0) {
        return '<div class="text-muted" style="padding:24px;text-align:center">No individuals found for this cohort.</div>';
      }
      const truncated = rows.length === 200 ? '<div style="font-size:11px;color:#eab308;padding:8px 12px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:6px;margin-bottom:12px">Showing first 200 contacts (cohort may be larger). Sorted by enrolled, then total cash, then first-touch date.</div>' : '';
      let html = truncated + `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02)">
                <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Email</th>
                <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Source</th>
                <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">First Touch</th>
                <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Lead</th>
                <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Ticket</th>
                <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Att.</th>
                <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Booked</th>
                <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Showed</th>
                <th style="text-align:center;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Enr.</th>
                <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Cash</th>
                <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">Days</th>
              </tr>
            </thead>
            <tbody>
      `;
      rows.forEach((r, i) => {
        const altBg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
        const enrolled = r.enrolled === true || r.enrolled === 'true';
        html += `
          <tr style="background:${altBg};border-bottom:1px solid rgba(255,255,255,0.04)">
            <td style="padding:8px 10px;color:${Theme.COLORS.textPrimary};font-weight:500;font-family:JetBrains Mono,monospace;font-size:11px">${_esc(r.email || '')}</td>
            <td style="padding:8px 10px;color:${Theme.COLORS.textSecondary};font-size:11px">${_esc(r.first_touch_platform || '–')}</td>
            <td style="padding:8px 10px;color:${Theme.COLORS.textMuted};font-size:11px">${_fmtTs(r.first_touch_date)}</td>
            <td style="padding:8px 10px;text-align:center;color:${r.lead_created ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.lead_created)}</td>
            <td style="padding:8px 10px;text-align:center;color:${r.ticket_purchased ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.ticket_purchased)}</td>
            <td style="padding:8px 10px;text-align:center;color:${r.workshop_attended ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.workshop_attended)}</td>
            <td style="padding:8px 10px;text-align:center;color:${r.call_booked ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.call_booked)}</td>
            <td style="padding:8px 10px;text-align:center;color:${r.call_showed ? '#22c55e' : Theme.COLORS.textMuted}">${_yn(r.call_showed)}</td>
            <td style="padding:8px 10px;text-align:center;color:${enrolled ? '#eab308' : Theme.COLORS.textMuted};font-weight:${enrolled ? '700' : '400'}">${enrolled ? '★' : '–'}</td>
            <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textPrimary};font-variant-numeric:tabular-nums">${Theme.money(Number(r.total_cash) || 0)}</td>
            <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-variant-numeric:tabular-nums">${r.days_lead_to_sale != null ? r.days_lead_to_sale : '–'}</td>
          </tr>
        `;
      });
      html += '</tbody></table></div>';
      return html;
    });
  }

  // ---- Data gap callout ----
  const gapCard = document.createElement('div');
  gapCard.className = 'card';
  gapCard.style.cssText = 'padding:20px;margin-top:16px';
  gapCard.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="width:34px;height:34px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px">&#9888;&#65039;</div>
      <div>
        <div style="font-size:12px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Post-Enrollment Tracking Gap (Stages 9-12)</div>
        <p style="font-size:13px;color:${Theme.COLORS.textMuted};line-height:1.6;margin:0">
          Onboarding, Lions Pride, Millionaires Alliance, and Advocacy data is not yet flowing into BigQuery.
          These stages represent the post-sale customer lifecycle -- critical for LTV and churn analysis.
          PostHog identification (Rehan) and GHL tagging are the primary data sources needed to close this gap.
        </p>
      </div>
    </div>
  `;
  container.appendChild(gapCard);
});

// HTML-escape helper used by the Cohort Velocity table + Individual Lookup search.
function _esc(str) {
  const el = document.createElement('span');
  el.textContent = str == null ? '' : String(str);
  return el.innerHTML;
}

// ---- Stage Detail inline renderer ----
const _STAGE_DEFS = {
  1:  { title: 'Ad Exposure',     color: '#4F9CF9', icon: '&#128226;' },
  2:  { title: 'Landing Page',    color: '#6E56CF', icon: '&#128187;' },
  3:  { title: 'Ticket Purchase', color: '#3b82f6', icon: '&#127903;' },
  4:  { title: 'Workshop',        color: '#06b6d4', icon: '&#127916;' },
  5:  { title: 'VIP Upsell',      color: '#14b8a6', icon: '&#11088;' },
  6:  { title: 'Call Booking',    color: '#22c55e', icon: '&#128222;' },
  7:  { title: 'Sales Call',      color: '#84cc16', icon: '&#129309;' },
  8:  { title: 'Enrollment',      color: '#eab308', icon: '&#127891;' },
  9:  { title: 'Onboarding',      color: '#f97316', icon: '&#128203;' },
  10: { title: 'Lions Pride',          color: '#ef4444', icon: '&#129409;' },
  11: { title: 'Millionaires Alliance', color: '#ec4899', icon: '&#128081;' },
  12: { title: 'Advocacy',        color: '#a855f7', icon: '&#128227;' },
};

async function _showStageDetail(stageNum, days) {
  const section = document.getElementById('stage-detail-section');
  if (!section) return;

  const cfg = _STAGE_DEFS[stageNum];
  section.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'card';
  header.style.cssText = `padding:16px 20px;border-top:3px solid ${cfg.color};`;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:24px">${cfg.icon}</span>
      <div>
        <div style="font-size:11px;font-weight:600;color:${cfg.color};text-transform:uppercase;letter-spacing:.08em">Stage ${stageNum} of 12</div>
        <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">${cfg.title}</div>
      </div>
      <button onclick="document.getElementById('stage-detail-section').innerHTML=''" style="margin-left:auto;background:none;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:${Theme.COLORS.textSecondary};padding:4px 10px;font-size:12px;cursor:pointer">&times; Close</button>
    </div>
  `;
  section.appendChild(header);

  // Stages 9-12: no data
  if (stageNum >= 9) {
    const noData = document.createElement('div');
    noData.className = 'card';
    noData.style.cssText = 'padding:20px;margin-top:8px;border-left:3px solid ' + cfg.color;
    noData.innerHTML = `
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">Data collection not yet active</p>
      <p style="margin:0;font-size:13px;color:${Theme.COLORS.textMuted};line-height:1.6">This stage is tracked conceptually but data collection is not yet active. PostHog identification and GHL tagging are the primary data sources needed.</p>
      <div style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:4px 10px;border-radius:999px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3)">
        <span style="color:#eab308;font-size:12px">&#9888;</span>
        <span style="font-size:11px;font-weight:600;color:#eab308;text-transform:uppercase;letter-spacing:.06em">Tracking Gap</span>
      </div>
    `;
    section.appendChild(noData);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Loading state
  const loading = document.createElement('div');
  loading.className = 'card';
  loading.style.cssText = 'padding:24px;margin-top:8px;text-align:center';
  loading.innerHTML = '<div class="spinner" style="margin:0 auto"></div>';
  section.appendChild(loading);
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Fetch data
  let rows;
  try {
    rows = await API.query('journey-stage', 'default', { days, stage: stageNum });
  } catch (err) {
    loading.innerHTML = `<p class="text-muted">Failed to load stage ${stageNum}: ${err.message}</p>`;
    return;
  }

  loading.remove();

  if (!rows || rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.style.cssText = 'padding:24px;margin-top:8px';
    empty.innerHTML = '<div class="empty-state"><span class="empty-state-icon">&#9888;</span><p>No data for the selected period</p></div>';
    section.appendChild(empty);
    return;
  }

  // Render the stage data as a table (universal approach)
  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  tableCard.style.cssText = 'padding:16px 20px;margin-top:8px;overflow-x:auto';
  tableCard.innerHTML = Components.renderTable(rows, { limit: 50 });
  section.appendChild(tableCard);
}
