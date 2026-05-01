/* ============================================
   Journey Map Overview -- 12-stage bow-tie visualization
   Full customer journey from Ad Exposure to Advocacy
   ============================================ */

App.registerPage('journey-explorer', async (container) => {
  const days = Filters.getDays();

  let raw;
  try {
    raw = await API.query('journey-explorer', 'default', { days });
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
