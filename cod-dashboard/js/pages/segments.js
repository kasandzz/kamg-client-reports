/* ============================================
   Segments -- Hyros Attribution Segment Analysis
   Replicates hyros-segment-comparison report
   ============================================ */

App.registerPage('segments', async (container) => {

  container.innerHTML = '';

  // ---- Segment data (Hyros attribution since Mar 10 2026 + Meta spend since Mar 10) ----
  // Source: BQ hyros_sales by source, classified by niche. Bookings from hyros_calls.
  // Spend: Meta campaigns by niche (CBO niche-specific + ABO Cold split proportionally by sales volume)
  // ABO Cold ($137K) split: Therapists 35%, Coaches 25%, Attorneys 11%, Educators 6%, Other 23% (by Hyros sales share)
  const SEGMENTS = [
    { name: 'Therapists',            color: '#3b82f6', calls: 73,  showRate: 91.2, sales: 160, tickets: 157, enrollments: 3, revenue: 22833, bookings: 73, costCall: 1126, costSale: 515,  slRatio: 1.02, adSets: ['Broad + CBO Licensed Therapists (111)', '03. Broad - Therapists 3065 (16)', '0.1 LLA Stack 01 - Licensed Therapists (13)', 'FB. Broad - Therapists 3564 (8)', 'LLA Stack 01 - Licensed Therapists - Copy (6)', '01. Broad + - Licensed Therapists (6)'] },
    { name: 'Coaches & Consultants', color: '#a855f7', calls: 57,  showRate: 92.8, sales: 115, tickets: 111, enrollments: 4, revenue: 39618, bookings: 57, costCall: 877,  costSale: 435,  slRatio: 1.04, adSets: ['Main Interest Stack - FB - Coaches (31)', 'Interest Stack Main - CBO Coaches (35)', 'LLA Stack - FB - Coaches (22)', '03. Broad - Coaches - Video (10)', '01. Broad - Coaches - Video Ad 6 (9)', '02. Broad - Coaches WITH CASH MONEY (8)'] },
    { name: 'Attorneys',             color: '#06b6d4', calls: 9,   showRate: 88.9, sales: 51,  tickets: 50, enrollments: 1, revenue: 10566, bookings: 9,  costCall: 1673, costSale: 295,  slRatio: 0.18, adSets: ['Broad + - Attorney / Financial Advisor 1 (35)', 'Fb. Broad - Attorney Only (11)', 'Fb. Broad - Attorney Only v2 (5)'] },
    { name: 'Educators',             color: '#f97316', calls: 0,   showRate: null, sales: 28,  tickets: 26, enrollments: 2, revenue: 12972, bookings: 0,  costCall: null, costSale: 329,  slRatio: null, adSets: ['FB. 3064 Broad - Educator / Teacher (16)', 'Broad + - Educator / Teacher (7)', 'FB. 3564 Broad - Educator / Teacher (5)'] },
    { name: 'Health & Wellness',     color: '#ec4899', calls: 0,   showRate: null, sales: 11,  tickets: 11, enrollments: 0, revenue: 297,   bookings: 0,  costCall: null, costSale: null, slRatio: null, lowSample: true, adSets: ['Fb. Broad 3064 - Health & Wellness Coaches (11)'] },
  ];

  const UNATTR = { name: 'Unattributed / Other', color: '#64748b', calls: 69, sales: 87, leads: 87 };

  const totalCalls = 208, totalSales = 452, totalLeads = 452;

  const T = Theme.COLORS;
  const money = Theme.money;

  // ==== DEMOGRAPHIC INTELLIGENCE (top of page) ====
  _renderDemographicIntel(container);

  // ==== SECTION 1: SCORECARD TABLE ====
  const s1 = _section(container, '1', 'Segment Scorecard');
  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = 'overflow-x:auto';

  const thS = `padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:${T.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid ${T.border};white-space:nowrap`;

  let thtml = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr>
      <th style="${thS}">Segment</th>
      <th style="${thS}">Calls</th>
      <th style="${thS}">Show Rate</th>
      <th style="${thS}">Sales</th>
      <th style="${thS}">Leads</th>
      <th style="${thS}">Cost / Call</th>
      <th style="${thS}">Cost / Sale</th>
    </tr></thead><tbody>`;

  const maxCalls = Math.max(...SEGMENTS.map(s => s.calls));
  const maxSales = Math.max(...SEGMENTS.map(s => s.sales));
  const maxLeads = Math.max(...SEGMENTS.map(s => s.leads));
  const bestShowRate = Math.max(...SEGMENTS.map(s => s.showRate));
  const bestCostCall = Math.min(...SEGMENTS.filter(s => s.costCall).map(s => s.costCall));
  const bestCostSale = Math.min(...SEGMENTS.filter(s => s.costSale).map(s => s.costSale));

  SEGMENTS.forEach(seg => {
    const callPct = (seg.calls / maxCalls * 80);
    const salePct = (seg.sales / maxSales * 80);
    const leadPct = (seg.leads / maxLeads * 80);

    const callClass = seg.calls === maxCalls ? `color:${T.success};font-weight:600` : '';
    const saleClass = seg.sales === maxSales ? `color:${T.success};font-weight:600` : '';
    const leadClass = seg.leads === maxLeads ? `color:${T.success};font-weight:600` : '';
    const showClass = seg.showRate === bestShowRate ? `color:${T.success};font-weight:600` : '';
    const ccClass = seg.costCall === bestCostCall ? `color:${T.success};font-weight:600` : (seg.costCall && seg.costCall > 1400 ? `color:#f59e0b;font-weight:600` : '');
    const csClass = seg.costSale === bestCostSale ? `color:${T.success};font-weight:600` : (seg.costSale && seg.costSale > 800 ? `color:#f59e0b;font-weight:600` : '');

    const lowTag = seg.lowSample ? `<span style="display:inline-block;padding:2px 6px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);border-radius:4px;font-size:10px;color:#f59e0b;margin-left:6px">n=${seg.calls}</span>` : '';

    thtml += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
      <td style="padding:10px 12px;white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seg.color};margin-right:8px;vertical-align:middle"></span><span style="font-weight:600;color:#fff">${seg.name}</span>${lowTag}</td>
      <td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px"><div style="height:8px;border-radius:4px;width:${callPct}px;background:${seg.color}"></div><span style="font-variant-numeric:tabular-nums;${callClass}">${seg.calls}</span></div></td>
      <td style="padding:10px 12px"><span style="font-variant-numeric:tabular-nums;${showClass}">${seg.showRate}%</span></td>
      <td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px"><div style="height:8px;border-radius:4px;width:${salePct}px;background:${seg.color}"></div><span style="font-variant-numeric:tabular-nums;${saleClass}">${seg.sales}</span></div></td>
      <td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px"><div style="height:8px;border-radius:4px;width:${leadPct}px;background:${seg.color}"></div><span style="font-variant-numeric:tabular-nums;${leadClass}">${seg.leads}</span></div></td>
      <td style="padding:10px 12px"><span style="font-variant-numeric:tabular-nums;${ccClass}">${seg.costCall ? '$' + seg.costCall.toLocaleString() : '<i style=color:' + T.textMuted + '>N/A</i>'}</span></td>
      <td style="padding:10px 12px"><span style="font-variant-numeric:tabular-nums;${csClass}">${seg.costSale ? '$' + seg.costSale.toLocaleString() : '<i style=color:' + T.textMuted + '>N/A</i>'}</span></td>
    </tr>`;
  });

  thtml += '</tbody></table>';
  tableWrap.innerHTML = thtml;
  s1.appendChild(tableWrap);

  // ==== SECTION 2: SHOW RATE COMPARISON ====
  const s2 = _section(container, '2', 'Show Rate Comparison');
  const showSorted = [...SEGMENTS].sort((a, b) => b.showRate - a.showRate);

  let showHtml = '<div style="margin:12px 0">';
  showSorted.forEach((seg, i) => {
    const isBest = i === 0;
    const isWorst = i === showSorted.length - 1;
    const badge = isBest ? `<span style="font-size:12px;font-weight:600;color:${T.success};width:50px;flex-shrink:0;text-align:right">BEST</span>` : (isWorst ? `<span style="font-size:12px;font-weight:600;color:#f59e0b;width:50px;flex-shrink:0;text-align:right">WORST</span>` : '<span style="width:50px;flex-shrink:0"></span>');
    const lowTag = seg.lowSample ? ` <span style="font-size:10px;color:#f59e0b">n=${seg.calls}</span>` : '';
    showHtml += `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="width:180px;flex-shrink:0;font-size:13px;text-align:right;color:${T.textSecondary}">${seg.name}${lowTag}</div>
        <div style="flex:1;height:28px;background:rgba(255,255,255,0.04);border-radius:6px;overflow:hidden">
          <div style="height:100%;width:${seg.showRate}%;background:${isWorst ? '#ef4444' : seg.color};border-radius:6px;display:flex;align-items:center;padding:0 10px;font-size:12px;font-weight:600;color:#fff">${seg.showRate}%</div>
        </div>
        ${badge}
      </div>`;
  });
  showHtml += '</div>';
  showHtml += `<div style="font-size:12px;color:${T.textMuted};padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:8px;margin-top:8px;border-left:3px solid #3b82f6">Show Rate = Hyros QUALIFIED state / Total Calls</div>`;
  s2.innerHTML += showHtml;

  // ==== SECTION 3: EFFICIENCY RANKINGS ====
  const s3 = _section(container, '3', 'Efficiency Rankings');
  const rankGrid = document.createElement('div');
  rankGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px';
  s3.appendChild(rankGrid);

  // Cost per Call
  const costCallSorted = SEGMENTS.filter(s => s.costCall).sort((a, b) => a.costCall - b.costCall);
  rankGrid.appendChild(_rankingCard('Cost per Call', '(lower = better)', costCallSorted.map(s => ({ name: s.name, value: '$' + s.costCall.toLocaleString() })), 'Healthcare Providers: N/A'));

  // Cost per Sale
  const costSaleSorted = SEGMENTS.filter(s => s.costSale).sort((a, b) => a.costSale - b.costSale);
  rankGrid.appendChild(_rankingCard('Cost per Sale', '(lower = better)', costSaleSorted.map(s => ({ name: s.name, value: '$' + s.costSale.toLocaleString() })), 'Healthcare Providers: N/A'));

  // Sales / Lead Ratio
  const slSorted = [...SEGMENTS].sort((a, b) => b.slRatio - a.slRatio);
  rankGrid.appendChild(_rankingCard('Sales / Lead Ratio', '(higher = better)', slSorted.map(s => ({ name: s.name, value: s.slRatio.toFixed(2) + 'x' }))));

  // ==== SECTION 4: VOLUME DISTRIBUTION ====
  const s4 = _section(container, '4', 'Volume Distribution');

  const allSegs = [...SEGMENTS, UNATTR];
  s4.appendChild(_stackedBar('Calls (' + totalCalls + ' total)', allSegs.map(s => ({ name: s.name, value: s.calls, color: s.color })), totalCalls));
  s4.appendChild(_stackedBar('Sales (' + totalSales + ' total)', allSegs.map(s => ({ name: s.name, value: s.sales, color: s.color })), totalSales));
  s4.appendChild(_stackedBar('Leads (' + totalLeads + ' total)', allSegs.map(s => ({ name: s.name, value: s.leads, color: s.color })), totalLeads));

  // Legend
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin-top:12px';
  allSegs.forEach(s => {
    legend.innerHTML += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:${T.textSecondary}"><div style="width:12px;height:12px;border-radius:3px;background:${s.color}"></div>${s.name}</div>`;
  });
  s4.appendChild(legend);

  // ==== SECTION 5: TOP AD SETS PER SEGMENT ====
  const s5 = _section(container, '5', 'Top Ad Sets per Segment');
  const accordion = document.createElement('div');
  s5.appendChild(accordion);

  SEGMENTS.forEach((seg, idx) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.cssText = 'margin-bottom:8px;overflow:hidden';

    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'padding:12px 16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none';
    headerDiv.innerHTML = `
      <div>
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seg.color};margin-right:8px;vertical-align:middle"></span>
        <span style="font-weight:600;color:#fff">${seg.name}</span>
        <span style="font-size:12px;color:${T.textMuted}"> -- ${seg.calls} calls, ${seg.sales} sales</span>
        ${seg.lowSample ? `<span style="display:inline-block;padding:2px 6px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);border-radius:4px;font-size:10px;color:#f59e0b;margin-left:6px">n=${seg.calls}</span>` : ''}
      </div>
      <span class="accordion-arrow" style="transition:transform .2s;color:${T.textMuted};font-size:14px">&#9660;</span>
    `;

    const content = document.createElement('div');
    content.style.cssText = 'padding:0 16px 12px;display:' + (idx === 0 ? 'block' : 'none');
    if (idx === 0) headerDiv.querySelector('.accordion-arrow').style.transform = 'rotate(180deg)';

    let adHtml = '';
    seg.adSets.forEach((ad, ai) => {
      adHtml += `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px">
        <span style="color:${T.textMuted};font-weight:600;width:24px;text-align:center;flex-shrink:0">${ai + 1}</span>
        <span style="flex:1;color:${T.textSecondary};word-break:break-word">${ad}</span>
      </div>`;
    });
    content.innerHTML = adHtml;

    headerDiv.addEventListener('click', () => {
      const isOpen = content.style.display === 'block';
      content.style.display = isOpen ? 'none' : 'block';
      headerDiv.querySelector('.accordion-arrow').style.transform = isOpen ? '' : 'rotate(180deg)';
    });

    item.appendChild(headerDiv);
    item.appendChild(content);
    accordion.appendChild(item);
  });

  // Add Unattributed accordion
  const uItem = document.createElement('div');
  uItem.className = 'card';
  uItem.style.cssText = 'margin-bottom:8px;overflow:hidden';
  const uHeader = document.createElement('div');
  uHeader.style.cssText = 'padding:12px 16px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none';
  uHeader.innerHTML = `<div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${UNATTR.color};margin-right:8px;vertical-align:middle"></span><span style="font-weight:600;color:#fff">Unattributed</span><span style="font-size:12px;color:${T.textMuted}"> -- 194 calls, 130 sales</span></div><span class="accordion-arrow" style="transition:transform .2s;color:${T.textMuted};font-size:14px">&#9660;</span>`;
  const uContent = document.createElement('div');
  uContent.style.cssText = 'padding:0 16px 12px;display:none';
  uContent.innerHTML = [
    'unknown (190)', 'Broad - Masterclass HOME (57)', 'Broad - "AND THEN" HOME 1 WIFI (26)', 'Book Call - Workshop Purchases 030226 (14)', 'TOF | Video | MC | KW Broad: Coaching (12)'
  ].map((ad, i) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px"><span style="color:${T.textMuted};font-weight:600;width:24px;text-align:center;flex-shrink:0">${i+1}</span><span style="flex:1;color:${T.textSecondary}">${ad}</span></div>`).join('');
  uHeader.addEventListener('click', () => {
    const isOpen = uContent.style.display === 'block';
    uContent.style.display = isOpen ? 'none' : 'block';
    uHeader.querySelector('.accordion-arrow').style.transform = isOpen ? '' : 'rotate(180deg)';
  });
  uItem.appendChild(uHeader);
  uItem.appendChild(uContent);
  accordion.appendChild(uItem);



  // ---- Footer ----
  const footer = document.createElement('div');
  footer.style.cssText = `text-align:center;padding:16px;color:${T.textMuted};font-size:12px;border-top:1px solid ${T.border};margin-top:16px`;
  footer.textContent = 'Generated: Apr 2, 2026 | Source: Hyros API Full Pull (531 calls, 628 sales, 641 leads)';
  container.appendChild(footer);

  // ===== HELPER FUNCTIONS =====

  function _section(parent, num, title) {
    const sec = document.createElement('div');
    sec.className = 'card';
    sec.style.cssText = 'padding:24px;margin-bottom:16px';
    sec.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#3b82f6;color:#fff;border-radius:6px;font-size:12px;font-weight:700;flex-shrink:0">${num}</div>
        <div style="font-size:16px;font-weight:700;color:#fff">${title}</div>
      </div>`;
    parent.appendChild(sec);
    return sec;
  }

  function _rankingCard(title, direction, items, footnote) {
    const card = document.createElement('div');
    card.style.cssText = `background:rgba(255,255,255,0.03);border-radius:12px;padding:20px;border:1px solid ${T.border}`;

    let html = `<div style="font-size:14px;font-weight:600;color:${T.textPrimary};margin-bottom:12px">${title} <span style="font-size:11px;color:${T.textMuted};font-weight:400">${direction}</span></div>`;
    html += '<ol style="list-style:none;padding:0;margin:0">';
    items.forEach((item, i) => {
      const isFirst = i === 0;
      const isLast = i === items.length - 1;
      const bg = isFirst ? 'rgba(34,197,94,0.12)' : (isLast ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)');
      const border = isFirst ? 'rgba(34,197,94,0.3)' : (isLast ? 'rgba(245,158,11,0.2)' : 'transparent');
      const numBg = isFirst ? '#22c55e' : T.border;
      const numColor = isFirst ? '#fff' : T.textSecondary;
      const valColor = isFirst ? T.success : (isLast ? '#f59e0b' : T.textPrimary);
      html += `<li style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:${bg};border:1px solid ${border}">
        <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:12px;font-weight:700;background:${numBg};color:${numColor};flex-shrink:0">${i+1}</div>
        <div style="flex:1;font-weight:500;color:${T.textPrimary}">${item.name}</div>
        <div style="font-weight:700;font-variant-numeric:tabular-nums;color:${valColor}">${item.value}</div>
      </li>`;
    });
    html += '</ol>';
    if (footnote) html += `<div style="font-size:11px;color:${T.textMuted};margin-top:6px;padding-left:6px">${footnote}</div>`;
    card.innerHTML = html;
    return card;
  }

  function _stackedBar(label, segments, total) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:16px';
    let html = `<div style="font-size:13px;color:${T.textSecondary};margin-bottom:6px;font-weight:600">${label}</div>`;
    html += '<div style="display:flex;height:36px;border-radius:8px;overflow:hidden">';
    segments.forEach(s => {
      const pct = (s.value / total * 100);
      if (pct < 0.5) return;
      const showLabel = pct > 8;
      html += `<div style="width:${pct}%;background:${s.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;min-width:2px;transition:width .3s;cursor:default" title="${s.name}: ${pct.toFixed(1)}%">${showLabel ? s.name + ' ' + pct.toFixed(1) + '%' : ''}</div>`;
    });
    html += '</div>';
    wrap.innerHTML = html;
    return wrap;
  }
});

// ---- Demographic Intelligence Panel ----
// Tier 1 (Gender, Age, Device, Placement): Meta Ads aggregate metrics -- toggle between Spend/CPM/CTR/CPC/Purchases
// Tier 2 (Location, Profession): Per-contact funnel -- all rates shown inline per group (no toggles)
let _segDemoT1Stat = 'spend';

function _renderDemographicIntel(container) {
  const T = Theme.COLORS;
  const FC = [Theme.FUNNEL.blue, Theme.FUNNEL.cyan, Theme.FUNNEL.green, Theme.FUNNEL.orange, Theme.FUNNEL.purple];

  // Responsive style
  const styleId = 'seg-demo-intel-responsive';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `@media (max-width: 768px) { .seg-demo-intel-grid { grid-template-columns: 1fr !important; } }`;
    document.head.appendChild(s);
  }

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:${T.textPrimary};letter-spacing:-.01em">Demographic Intelligence</div>
    <div style="font-size:12px;color:${T.textMuted};margin-top:2px">Meta ad demographic breakdowns + per-contact funnel data</div>
  `;
  container.appendChild(header);

  // 3x2 grid
  const grid = document.createElement('div');
  grid.className = 'seg-demo-intel-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px';
  container.appendChild(grid);

  const days = Filters.getDays();

  // ---- Label cleaners ----
  function cleanLabel(raw) {
    if (!raw) return '(unknown)';
    // "facebook facebook_reels" -> "Facebook Reels", "instagram instagram_stories" -> "Instagram Stories"
    // Remove duplicate platform prefix, replace underscores, title-case
    let s = String(raw);
    // Remove redundant platform prefix from position (e.g. "facebook facebook_reels" -> "facebook reels")
    s = s.replace(/^(facebook|instagram|audience_network|messenger)\s+\1_/i, '$1 ');
    // Replace underscores with spaces
    s = s.replace(/_/g, ' ');
    // Title case
    return s.replace(/\b\w/g, c => c.toUpperCase());
  }

  // ---- Shared bar renderer (single metric) ----
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
      const label = cleanLabel(row[labelField]);
      html += `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;color:${T.textSecondary}">${label}</span>
          <span style="font-size:11px;font-weight:600;color:${T.textPrimary};font-family:'JetBrains Mono',monospace">${formatFn(val, statKey)}</span>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .3s ease"></div>
        </div>
      </div>`;
    });
    barContainer.innerHTML = html;
  }

  // ---- Toggle builder (Tier 1 only) ----
  function buildToggles(toggleRow, statLabels, getActive, setActive, allCardRefs) {
    toggleRow.innerHTML = '';
    Object.entries(statLabels).forEach(([sk, label]) => {
      const isActive = sk === getActive();
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;font-weight:${isActive ? '600' : '400'};border:1px solid ${isActive ? 'transparent' : T.border};background:${isActive ? T.accent : 'transparent'};color:${isActive ? '#fff' : T.textMuted};transition:all .15s;outline:none;line-height:1.4`;
      btn.addEventListener('click', () => {
        setActive(sk);
        allCardRefs.forEach(fn => fn());
      });
      toggleRow.appendChild(btn);
    });
  }

  // ---- Source badge ----
  function sourceBadge(text) {
    return `<div style="font-size:10px;color:${T.textMuted};margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05)">${text}</div>`;
  }

  // ============================================================
  // TIER 1 -- Meta Ads aggregate metrics (with toggles)
  // ============================================================
  const T1_STAT_LABELS = {
    spend:     'Spend',
    cpm:       'CPM',
    ctr:       'CTR',
    cpc:       'CPC',
    purchases: 'Purchases',
  };

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
    try {
      const rows = await API.query('segments', queryName, { days });
      _t1Cache[queryName] = rows || [];
    } catch (e) {
      _t1Cache[queryName] = [];
    }
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
      if (r.clicks > 0)      r.cpc = r.spend / r.clicks;
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

  // ============================================================
  // TIER 2 -- Per-contact funnel (NO toggles -- all rates inline)
  // ============================================================
  const FUNNEL_STAGES = [
    { key: 'ticket_rate', label: 'Ticket',  color: Theme.FUNNEL.blue },
    { key: 'show_rate',   label: 'Show',    color: Theme.FUNNEL.cyan },
    { key: 'book_rate',   label: 'Book',    color: Theme.FUNNEL.green },
    { key: 'enroll_rate', label: 'Enroll',  color: Theme.FUNNEL.orange },
  ];

  const T2_CARDS = [
    { title: 'Location (Top States)', queryName: 'location',   labelField: 'state' },
    { title: 'Profession / Segment',  queryName: 'profession', labelField: 'profession' },
  ];

  function renderFunnelCard(barContainer, rows, labelField) {
    if (!rows || rows.length === 0) {
      barContainer.innerHTML = `<div style="font-size:12px;color:${T.textMuted};padding:16px 0">No contact data for this period.</div>`;
      return;
    }

    // Legend row
    let html = `<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">`;
    FUNNEL_STAGES.forEach(s => {
      html += `<div style="display:flex;align-items:center;gap:4px">
        <div style="width:8px;height:8px;border-radius:2px;background:${s.color}"></div>
        <span style="font-size:10px;color:${T.textMuted}">${s.label}</span>
      </div>`;
    });
    html += `</div>`;

    // Each group = label + contacts count + 4 stacked rate bars
    rows.forEach(row => {
      const label = row[labelField] || '(unknown)';
      const contacts = parseInt(row.contacts) || 0;

      html += `<div style="margin-bottom:14px">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <span style="font-size:12px;font-weight:600;color:${T.textPrimary}">${label}</span>
        <span style="font-size:10px;color:${T.textMuted}">${contacts.toLocaleString()} contacts</span>
      </div>`;

      // 4 rate bars side by side
      html += `<div style="display:flex;gap:3px;align-items:flex-end;height:32px">`;
      FUNNEL_STAGES.forEach(s => {
        const val = parseFloat(row[s.key]) || 0;
        const h = Math.max(val, 2); // min 2% height so empty bars are visible
        html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:9px;font-weight:600;color:${T.textPrimary};font-family:'JetBrains Mono',monospace">${val.toFixed(0)}%</span>
          <div style="width:100%;height:${h * 0.3}px;min-height:2px;max-height:30px;background:${s.color};border-radius:2px;opacity:${val > 0 ? 0.85 : 0.2}"></div>
        </div>`;
      });
      html += `</div>`;
      html += `</div>`;
    });

    barContainer.innerHTML = html;
  }

  T2_CARDS.forEach(cfg => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:20px';

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `font-size:14px;font-weight:600;color:${T.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px`;
    titleDiv.textContent = cfg.title;
    card.appendChild(titleDiv);

    const barContainer = document.createElement('div');
    card.appendChild(barContainer);
    barContainer.innerHTML = `<div style="font-size:11px;color:${T.textMuted}">Loading...</div>`;

    (async () => {
      let rows = [];
      try {
        rows = await API.query('segments', cfg.queryName, { days }) || [];
      } catch (e) { /* empty */ }
      renderFunnelCard(barContainer, rows, cfg.labelField);
    })();

    const badge = document.createElement('div');
    badge.innerHTML = sourceBadge('Source: GHL + Stripe (per-contact)');
    card.appendChild(badge);
    grid.appendChild(card);
  });
}
