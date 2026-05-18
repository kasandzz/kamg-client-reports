/* ============================================
   War Room v3 -- CEO 5-second scan
   Stacked sections:
     1. Staleness banner (only when stale)
     2. Shopify-style snapshot strip (6 hero KPIs)
     3. Customer-journey cards (Top -> Mid -> Bottom)
     4. Mini closer board (top 5 this week)
     5. Daily revenue stack (Tickets/VIP/HT/Total)
     6. This week's daily table
   Mobile-first vertical stack.
   Leak / anomaly strip removed 2026-05-13 per Kas.
   ============================================ */

App.registerPage('war-room', async (container) => {
  await renderWarRoom(container);
  // Filter-change re-renders are handled centrally in shell.js (Filters.onChange);
  // App.onFilterChange does not exist -- removing dead call that was throwing.
});

async function renderWarRoom(container) {
  const days = Filters.getDays();
  container.innerHTML = '';

  // ---- Helper: compute delta % ----
  function _delta(curVal, prevVal) {
    if (!prevVal || prevVal === 0) return null;
    return ((curVal - prevVal) / Math.abs(prevVal)) * 100;
  }

  // ---- Helper: create a card element ----
  function _card(title, opts) {
    opts = opts || {};
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = opts.padding || '24px';
    card.style.marginBottom = '16px';
    if (opts.borderLeft) {
      card.style.borderLeft = opts.borderLeft;
    }
    if (title) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:13px;font-weight:700;font-family:Manrope,sans-serif;color:' + Theme.COLORS.textPrimary + ';text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px';
      h.textContent = title;
      card.appendChild(h);
    }
    return card;
  }

  // ---- Helper: sum array of numbers ----
  function _sum(arr) {
    return arr.reduce(function (a, b) { return a + (b || 0); }, 0);
  }

  // ---- Fetch all data in parallel ----
  // Closer data lives in sales-team CF registry (war-room:closers does not exist).
  // leakDetection fetch removed in v3 -- anomaly strip deleted per Kas 2026-05-13.
  let defaultData, dailyRevenueData, stalenessData, closersData,
      dailyRevStackData, weeklyDailyData;

  try {
    const results = await Promise.allSettled([
      API.query('war-room', 'default', { days }),
      API.query('war-room', 'dailyRevenue', { days }),
      API.query('war-room', 'staleness', {}),
      API.query('sales-team', 'closers', { days }),
      API.query('war-room', 'dailyRevenueStack', { days }),
      API.query('war-room', 'weeklyDailyBreakdown', {}),
    ]);

    defaultData = results[0].status === 'fulfilled' ? results[0].value : [];
    dailyRevenueData = results[1].status === 'fulfilled' ? results[1].value : [];
    stalenessData = results[2].status === 'fulfilled' ? results[2].value : [];
    closersData = results[3].status === 'fulfilled' ? results[3].value : [];
    dailyRevStackData = results[4].status === 'fulfilled' ? results[4].value : [];
    weeklyDailyData = results[5].status === 'fulfilled' ? results[5].value : [];
  } catch (err) {
    container.innerHTML = '<div class="card" style="padding:24px"><p class="text-muted">Failed to load War Room: ' + err.message + '</p></div>';
    return;
  }

  if (!defaultData || defaultData.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-state-icon">&#128203;</span><p>No data for the selected period</p></div>';
    return;
  }

  // Current = first row (ORDER BY period DESC -> 'current' first), Previous = second
  const cur = defaultData[0] || {};
  const prev = defaultData[1] || {};

  // ================================================================
  // SECTION 1: Staleness Banner (WAR-04, D-11/D-12/D-13/D-14)
  // ================================================================
  var stalenessThresholds = {
    'Meta Ads': 2,
    'Stripe': 1,
    'Bookings': 1,
  };

  if (stalenessData && stalenessData.length > 0) {
    stalenessData.forEach(function (row) {
      if (!row.last_sync) return;
      var threshold = stalenessThresholds[row.source] || 2;
      var syncDate = new Date(row.last_sync);
      var now = new Date();
      var gapDays = (now - syncDate) / (1000 * 60 * 60 * 24);
      if (gapDays > threshold) {
        var banner = Components.renderStaleBanner(row.source, row.last_sync);
        if (banner) {
          container.appendChild(banner);
        }
      }
    });
  }

  // ================================================================
  // SECTION 2 (v3): Shopify-style Snapshot Strip
  // 6 hero KPIs Russ scans in 5 seconds:
  // Revenue / Ad Spend / Bookings / Blended CPBC / Show% / Close%
  // Each card: traffic-light dot, value, delta, optional sparkline,
  // optional z-score badge, data-calc tooltip (Show Calculations).
  // ================================================================
  // Methodology banner (2026-05-18): war-room snapshot is now blended Hyros + Stripe + GHL,
  // but the daily breakdown table + Daily Revenue Stack below still source Stripe-only buckets.
  // Until Plan 1B unifies sources, this banner explains the mismatch users will see.
  var methodBanner = document.createElement('div');
  methodBanner.style.cssText = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:8px 12px;margin-bottom:12px;line-height:1.5';
  methodBanner.textContent = 'Revenue figures blended across Stripe + Hyros + GHL (deduped) as of 2026-05-18. Daily breakdown + bucket totals below show Stripe-only and will not reconcile to snapshot until Phase 1B.';
  container.appendChild(methodBanner);

  var snapshotContainer = document.createElement('div');
  snapshotContainer.style.marginBottom = '20px';
  snapshotContainer.classList.add('kpi-grid--snapshot');
  container.appendChild(snapshotContainer);

  // BUG-2 (2026-05-18): heroSpark reads dailyRevenue.total_revenue which is Stripe-only daily,
  // but the Revenue KPI header above is blended (Stripe + Hyros-non-Stripe + GHL-non-Stripe).
  // No sparkline caption slot exists in Components.renderKPIStrip without DOM restructuring.
  // TODO (Plan 1B): wire a blended-daily series + sparkline caption "Daily trace: Stripe only"
  // OR rebuild dailyRevenue CF query to return blended daily totals.
  var heroSpark = (dailyRevenueData || []).map(function (r) { return Number(r.total_revenue || 0); });
  var heroZ = Components.computeZScore ? Components.computeZScore(heroSpark.slice(-30)) : null;

  // Show rate isn't in default query -- derive from total_calls + no_shows.
  var curShowed = Math.max(0, (cur.total_calls || 0) - (cur.no_shows || 0));
  var prevShowed = Math.max(0, (prev.total_calls || 0) - (prev.no_shows || 0));
  var curShowRate = (cur.total_calls || 0) > 0 ? (curShowed / cur.total_calls * 100) : 0;
  var prevShowRate = (prev.total_calls || 0) > 0 ? (prevShowed / prev.total_calls * 100) : 0;

  var periodLabel = 'last ' + days + 'd';

  var snapshotKpis = [
    {
      label: 'Revenue',
      value: cur.net_revenue || 0,
      prevValue: prev.net_revenue || 0,
      delta: _delta(cur.net_revenue || 0, prev.net_revenue || 0),
      format: 'money',
      sparkData: heroSpark,
      zScore: heroZ,
      source: 'Hyros + Stripe + GHL (deduped)',
      calc: 'stripe_gross_revenue + hyros_nonstripe_revenue + ghl_nonstripe_revenue − refunds',
      period: periodLabel,
      refresh: 'hourly',
    },
    {
      label: 'Ad Spend',
      value: cur.total_spend || 0,
      prevValue: prev.total_spend || 0,
      delta: _delta(cur.total_spend || 0, prev.total_spend || 0),
      format: 'money',
      invertCost: true,
      source: 'v_meta_ads_clean (Meta API)',
      calc: 'SUM(spend) per day',
      period: periodLabel,
      refresh: 'daily',
    },
    {
      label: 'Bookings',
      value: cur.total_calls || 0,
      prevValue: prev.total_calls || 0,
      delta: _delta(cur.total_calls || 0, prev.total_calls || 0),
      format: 'num',
      source: 'v_fact_bookings_clean (GHL)',
      calc: 'COUNT(*) calls booked in period',
      period: periodLabel,
      refresh: 'hourly',
    },
    {
      label: 'Blended CPBC',
      value: cur.cpb || 0,
      prevValue: prev.cpb || 0,
      delta: _delta(cur.cpb || 0, prev.cpb || 0),
      format: 'money',
      invertCost: true,
      source: 'Meta spend / GHL bookings',
      calc: 'total_spend / total_calls (truth metric)',
      period: periodLabel,
      refresh: 'hourly',
    },
    {
      label: 'Show %',
      value: curShowRate,
      prevValue: prevShowRate,
      delta: _delta(curShowRate, prevShowRate),
      format: 'pct',
      source: 'v_fact_bookings_clean (GHL)',
      calc: '(total_calls - no_shows) / total_calls * 100',
      period: periodLabel,
      refresh: 'hourly',
    },
    {
      label: 'Close %',
      value: cur.close_rate || 0,
      prevValue: prev.close_rate || 0,
      delta: _delta(cur.close_rate || 0, prev.close_rate || 0),
      format: 'pct',
      source: 'v_fact_bookings_clean + v_stripe_clean',
      calc: 'closed / total_calls * 100',
      period: periodLabel,
      refresh: 'hourly',
    },
  ];

  Components.renderKPIStrip(snapshotContainer, snapshotKpis);

  // SECTION 3 (v3) -- Anomaly / Leak Detection Strip REMOVED per Kas 2026-05-13.
  // leakData fetch removed below; if you need it back, restore the API.query
  // call and the chip-row render block in git history.

  // ================================================================
  // SECTION 4 (v3): Customer Journey Cards
  // Three stage-grouped cards: Top of Funnel -> Mid -> Bottom.
  // Each card aggregates the sources we have data for and deep-links
  // to the detail page. Avoids 8 repetitive boxes per PRD: war-room
  // is the executive summary, detail pages own the per-source data.
  // ================================================================
  var journeyRow = document.createElement('div');
  journeyRow.className = 'war-room-journey-row';
  journeyRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:16px';
  container.appendChild(journeyRow);

  function _stageCard(opts) {
    var card = document.createElement('a');
    card.href = opts.href || '#';
    card.className = 'card';
    card.style.cssText = 'padding:20px;text-decoration:none;color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:12px;border-top:2px solid ' + opts.color + ';transition:transform 0.15s, border-color 0.15s';
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', opts.stage + ' funnel: ' + opts.title);

    var header = '<div style="display:flex;align-items:baseline;justify-content:space-between"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:' + opts.color + '">' + opts.stage + '</span><span style="font-size:11px;color:' + Theme.COLORS.textMuted + '">' + (opts.subtitle || '') + '</span></div>';
    var title = '<div style="font-size:15px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">' + opts.title + '</div>';

    var rowsHTML = (opts.rows || []).map(function (r) {
      var valColor = r.valueColor || Theme.COLORS.textPrimary;
      var valStr = (r.value == null || r.value === '')
        ? '<span style="color:' + Theme.COLORS.textMuted + '">--</span>'
        : r.value;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,0.04);font-size:12px">' +
        '<span style="color:' + Theme.COLORS.textSecondary + '">' + _escText(r.label) + '</span>' +
        '<span style="font-family:var(--font-mono);font-weight:600;color:' + valColor + ';font-variant-numeric:tabular-nums">' + valStr + '</span>' +
        '</div>';
    }).join('');

    var footer = '<div style="font-size:11px;color:' + opts.color + ';margin-top:4px">View detail &rarr;</div>';

    card.innerHTML = header + title + '<div>' + rowsHTML + '</div>' + footer;
    return card;
  }

  // TOP -- per-platform table (DUMMY DATA, wired in Tail B from Hyros + Meta + EmailBison).
  // Cold Email CPBC is the pre-agreed $200 flat constant per memory rule.
  var topCard = document.createElement('a');
  topCard.href = '#attribution';
  topCard.className = 'card';
  topCard.style.cssText = 'padding:20px;text-decoration:none;color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:10px;border-top:2px solid #06b6d4';
  topCard.setAttribute('role', 'link');
  topCard.setAttribute('aria-label', 'Top of funnel: traffic + acquisition by platform');

  var COLD_EMAIL_CPBC = 200;
  // Provisional dummy rows -- real data lands in Tail B (Attribution page work).
  // Order: Organic / Meta / Google / Cold Email / Other (per Kas spec).
  // CPA Enroll = spend / enrolls (Inf when enrolls=0; rendered as "--").
  var platformRows = [
    { name: 'Organic',    spend: 0,      cpbc: 0,                bookings: 12, enrolls: 1, note: 'dummy' },
    { name: 'Meta',       spend: 8200,   cpbc: 1180,             bookings: 7,  enrolls: 1, note: 'dummy' },
    { name: 'Google',     spend: null,   cpbc: null,             bookings: null, enrolls: null, note: 'blocked' },
    { name: 'Cold Email', spend: 8400,   cpbc: COLD_EMAIL_CPBC,  bookings: 42, enrolls: 2, note: 'dummy' },
    { name: 'Other',      spend: 1200,   cpbc: 300,              bookings: 4,  enrolls: 0, note: 'dummy' },
  ];

  function _money(v) { return v == null ? '<span style="color:' + Theme.COLORS.textMuted + '">--</span>' : Theme.formatValue(v, 'money'); }
  function _num(v)   { return v == null ? '<span style="color:' + Theme.COLORS.textMuted + '">--</span>' : Number(v).toLocaleString(); }
  function _cpa(spend, enrolls) {
    if (spend == null || enrolls == null) return '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
    if (enrolls === 0) return '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
    return Theme.formatValue(spend / enrolls, 'money');
  }

  var topHeader =
    '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">' +
      '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#06b6d4">Top</span>' +
      '<span style="font-size:10px;color:' + Theme.COLORS.textMuted + ';font-style:italic">Dummy data -- wired in Tail B</span>' +
    '</div>' +
    '<div style="font-size:15px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">Traffic + Acquisition by Platform</div>';

  var th = function (label, align) {
    return '<th style="padding:6px 8px;text-align:' + (align || 'right') + ';color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:9px;white-space:nowrap">' + label + '</th>';
  };
  var bodyRows = platformRows.map(function (r) {
    var isBlocked = r.note === 'blocked';
    var rowOpacity = isBlocked ? 'opacity:0.5;' : '';
    var nameSuffix = isBlocked ? ' <span style="font-size:9px;color:' + Theme.COLORS.textMuted + '">(coming soon)</span>' : '';
    return [
      '<tr style="' + rowOpacity + '">',
      '  <td style="padding:6px 8px;color:' + Theme.COLORS.textPrimary + ';font-size:12px;white-space:nowrap">' + _escText(r.name) + nameSuffix + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textSecondary + '">' + _money(r.spend) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textSecondary + '">' + _money(r.cpbc) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textPrimary + '">' + _num(r.bookings) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.success + ';font-weight:600">' + _num(r.enrolls) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textSecondary + '">' + _cpa(r.spend, r.enrolls) + '</td>',
      '</tr>',
    ].join('');
  }).join('');

  var topTable =
    '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">' +
        th('Platform', 'left') + th('Spend') + th('CPBC') + th('Bookings') + th('Enrolls') + th('CPA Enroll') +
      '</tr></thead>' +
      '<tbody>' + bodyRows + '</tbody>' +
    '</table>';

  var topFooter = '<div style="font-size:11px;color:#06b6d4;margin-top:4px">View Attribution detail &rarr;</div>';

  topCard.innerHTML = topHeader + topTable + topFooter;
  journeyRow.appendChild(topCard);

  // MID -- per-funnel table (DUMMY DATA, real wire-up in Tail B).
  // Rows: $27 Workshop / MA/VSL Funnel / JIT Webinar / Cold Email
  // Cols: Spend / Regs (or Tickets) / Bookings / Enrollments
  var midCard = document.createElement('a');
  midCard.href = '#funnels';
  midCard.className = 'card';
  midCard.style.cssText = 'padding:20px;text-decoration:none;color:inherit;cursor:pointer;display:flex;flex-direction:column;gap:10px;border-top:2px solid #a855f7';
  midCard.setAttribute('role', 'link');
  midCard.setAttribute('aria-label', 'Mid funnel: per-funnel breakdown');

  // Provisional per-funnel dummy rows.
  // cpbc: explicit when fixed (Cold Email = $200 per pre-agreement), else computed
  // from spend / bookings when rendered. cpa: always computed from spend / enrolls.
  var funnelRows = [
    { name: '$27 Workshop',  spend: 7800, regs: 188, bookings: 142, enrolls: 9, regLabel: 'tickets', cpbcFixed: null              },
    { name: 'MA/VSL Funnel', spend: 1400, regs: 36,  bookings: 28,  enrolls: 3, regLabel: 'apps',    cpbcFixed: null              },
    { name: 'JIT Webinar',   spend: 600,  regs: 22,  bookings: 8,   enrolls: 1, regLabel: 'regs',    cpbcFixed: null              },
    { name: 'Cold Email',    spend: 8400, regs: 0,   bookings: 42,  enrolls: 2, regLabel: '--',      cpbcFixed: COLD_EMAIL_CPBC   },
  ];

  function _cpbc(row) {
    if (row.cpbcFixed != null) return Theme.formatValue(row.cpbcFixed, 'money');
    if (row.spend == null || row.bookings == null || row.bookings === 0) {
      return '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
    }
    return Theme.formatValue(row.spend / row.bookings, 'money');
  }

  var midHeader =
    '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">' +
      '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#a855f7">Mid</span>' +
      '<span style="font-size:10px;color:' + Theme.COLORS.textMuted + ';font-style:italic">Dummy data -- wired in Tail B</span>' +
    '</div>' +
    '<div style="font-size:15px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">Bookings by Funnel</div>';

  var midBodyRows = funnelRows.map(function (r) {
    return [
      '<tr>',
      '  <td style="padding:6px 8px;color:' + Theme.COLORS.textPrimary + ';font-size:12px;white-space:nowrap">' + _escText(r.name) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textSecondary + '">' + _money(r.spend) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textPrimary + '">' + (r.regLabel === '--' ? '<span style="color:' + Theme.COLORS.textMuted + '">--</span>' : _num(r.regs)) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textPrimary + '">' + _num(r.bookings) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textSecondary + '">' + _cpbc(r) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.success + ';font-weight:600">' + _num(r.enrolls) + '</td>',
      '  <td style="padding:6px 8px;text-align:right;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textSecondary + '">' + _cpa(r.spend, r.enrolls) + '</td>',
      '</tr>',
    ].join('');
  }).join('');

  var midTable =
    '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08)">' +
        th('Funnel', 'left') + th('Spend') + th('Regs/Tickets') + th('Bookings') + th('CPBC') + th('Enrollments') + th('CPA Enroll') +
      '</tr></thead>' +
      '<tbody>' + midBodyRows + '</tbody>' +
    '</table>';

  var midFooter = '<div style="font-size:11px;color:#a855f7;margin-top:4px">View funnel detail &rarr;</div>';

  midCard.innerHTML = midHeader + midTable + midFooter;
  journeyRow.appendChild(midCard);

  // BOTTOM -- MA / sales / enrollments
  journeyRow.appendChild(_stageCard({
    stage: 'Bottom',
    title: 'MA + Sales Close',
    subtitle: 'Applications + enrollments',
    color: '#22c55e',
    href: '#sales-team',
    rows: [
      { label: 'Calls showed',    value: curShowed.toLocaleString() },
      { label: 'Enrollments',     value: (cur.enrollments || 0).toLocaleString(), valueColor: Theme.COLORS.success },
      { label: 'Enrollment rev',  value: Theme.formatValue(cur.enrollment_revenue || 0, 'money'), valueColor: Theme.COLORS.success },
      { label: 'Close rate',      value: (cur.close_rate || 0).toFixed(1) + '%' },
    ],
  }));

  // ================================================================
  // SECTION 5 (v3): Mini Closer Board
  // Top 5 closers ranked by close_rate (>=3 calls). Deep-link to
  // Sales Team page. Data sourced from sales-team:closers CF query
  // (war-room:closers does not exist; old code was hitting a 400).
  // ================================================================
  var closerCard = _card('Mini Closer Board', { padding: '20px 24px' });
  var closerSub = document.createElement('div');
  closerSub.style.cssText = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:-6px;margin-bottom:12px';
  closerSub.textContent = 'Top 5 closers, ranked by close rate. Min 3 calls to qualify.';
  closerCard.appendChild(closerSub);

  if (closersData && closersData.length > 0) {
    var qualified = closersData.filter(function (c) { return (c.total_calls || 0) >= 3; });
    qualified.sort(function (a, b) { return (b.close_rate || 0) - (a.close_rate || 0); });
    var top5 = qualified.slice(0, 5);

    if (top5.length > 0) {
      var maxClose = top5[0].close_rate || 0;
      var listWrap = document.createElement('div');
      listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px';

      top5.forEach(function (c, idx) {
        var pct = Math.max(0, Math.min(100, c.close_rate || 0));
        var barPct = maxClose > 0 ? (pct / maxClose * 100) : 0;
        var rankLabel = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : (idx + 1) + 'th';

        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:36px 1fr 68px 64px;align-items:center;gap:12px;padding:8px 0;font-size:13px;border-top:1px solid rgba(255,255,255,0.04)';
        row.innerHTML = [
          '<span style="font-size:10px;font-weight:700;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">' + rankLabel + '</span>',
          '<div>',
          '  <div style="font-weight:600;color:' + Theme.COLORS.textPrimary + '">' + _escText(c.closer || 'Unknown') + '</div>',
          '  <div style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + barPct.toFixed(1) + '%;background:' + Theme.COLORS.success + ';border-radius:2px"></div></div>',
          '</div>',
          '<span style="font-family:var(--font-mono);text-align:right;color:' + Theme.COLORS.success + ';font-weight:600">' + pct.toFixed(1) + '%</span>',
          '<span style="font-family:var(--font-mono);text-align:right;color:' + Theme.COLORS.textMuted + ';font-size:12px">' + (c.total_calls || 0) + ' calls</span>',
        ].join('');
        listWrap.appendChild(row);
      });

      closerCard.appendChild(listWrap);

      var closerLink = document.createElement('a');
      closerLink.href = '#sales-team';
      closerLink.style.cssText = 'font-size:12px;color:' + Theme.COLORS.accentCyan + ';text-decoration:none;display:inline-block;margin-top:12px';
      closerLink.textContent = 'View full Sales Team →';
      closerCard.appendChild(closerLink);
    } else {
      var noQual = document.createElement('p');
      noQual.className = 'text-muted';
      noQual.style.fontSize = '13px';
      noQual.textContent = 'No closers with 3+ calls this period.';
      closerCard.appendChild(noQual);
    }
  } else {
    var noCloser = document.createElement('p');
    noCloser.className = 'text-muted';
    noCloser.style.fontSize = '13px';
    noCloser.textContent = 'No closer data for this period.';
    closerCard.appendChild(noCloser);
  }
  container.appendChild(closerCard);

  // ================================================================
  // SECTION 2b: Daily Revenue Stack (Wave 1.3) -- last 14d, 3 segments
  // Shopify-style: clickable mini-KPI strip + single-metric line chart
  // Pattern mirrors funnels.js renderFunnelChart for consistency.
  // ================================================================
  var stackCard = _card('Daily Revenue Stack', { padding: '20px 24px 24px' });

  // $ vs # People toggle (segmented control)
  var stackToggleId = 'war-stack-mode-toggle-' + Date.now();
  var toggleBar = document.createElement('div');
  toggleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:-6px;margin-bottom:10px;flex-wrap:wrap';
  toggleBar.innerHTML = [
    '<div style="font-size:11px;color:' + Theme.COLORS.textMuted + '">Click any metric to drill the line. Last 14 days.</div>',
    '<div id="' + stackToggleId + '" role="tablist" style="display:inline-flex;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:2px;font-size:11px;font-family:var(--font-mono)">',
    '  <button data-mode="money"  role="tab" aria-selected="true"  style="padding:4px 10px;border:none;background:transparent;color:' + Theme.COLORS.textPrimary + ';cursor:pointer;border-radius:4px">$ Revenue</button>',
    '  <button data-mode="people" role="tab" aria-selected="false" style="padding:4px 10px;border:none;background:transparent;color:' + Theme.COLORS.textMuted + ';cursor:pointer;border-radius:4px"># People</button>',
    '</div>'
  ].join('');
  stackCard.appendChild(toggleBar);

  // Mini-KPI strip (Shopify-style)
  var stackStripId = 'war-stack-strip-' + Date.now();
  var stackStrip = document.createElement('div');
  stackStrip.id = stackStripId;
  stackStrip.style.cssText = 'display:flex;gap:20px;flex-wrap:wrap;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)';
  stackCard.appendChild(stackStrip);

  // Canvas wrap
  var stackCanvasId = 'war-stack-' + Date.now();
  var stackCanvasWrap = document.createElement('div');
  stackCanvasWrap.style.cssText = 'position:relative;width:100%;height:240px';
  stackCanvasWrap.innerHTML = '<canvas id="' + stackCanvasId + '"></canvas>';
  stackCard.appendChild(stackCanvasWrap);

  // Legend
  var stackLegendId = 'war-stack-legend-' + Date.now();
  var stackLegend = document.createElement('div');
  stackLegend.id = stackLegendId;
  stackLegend.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:16px;margin-top:10px;font-family:var(--font-mono);font-size:11px;color:' + Theme.COLORS.textMuted;
  stackCard.appendChild(stackLegend);

  container.appendChild(stackCard);

  if (dailyRevStackData && dailyRevStackData.length > 0) {
    // Wire the $/# toggle: re-renders strip + chart in the chosen mode.
    var toggleEl = document.getElementById(stackToggleId);
    if (toggleEl) {
      toggleEl.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-mode]');
        if (!btn) return;
        _warStackMode = btn.dataset.mode === 'people' ? 'people' : 'money';
        Array.prototype.forEach.call(toggleEl.querySelectorAll('button'), function (b) {
          var on = b.dataset.mode === _warStackMode;
          b.setAttribute('aria-selected', on ? 'true' : 'false');
          b.style.background = on ? 'rgba(124,58,237,0.18)' : 'transparent';
          b.style.color = on ? Theme.COLORS.textPrimary : Theme.COLORS.textMuted;
        });
        _renderStackShopifyStyle(dailyRevStackData, stackStripId, stackCanvasId, stackLegendId);
      });
    }
    Components.lazyChart(stackCanvasId, function () {
      _renderStackShopifyStyle(dailyRevStackData, stackStripId, stackCanvasId, stackLegendId);
    });
  } else {
    var noStack = document.createElement('p');
    noStack.className = 'text-muted';
    noStack.style.cssText = 'font-size:13px;padding:16px';
    noStack.textContent = 'No revenue data for the last 14 days.';
    stackCard.appendChild(noStack);
  }

  // ================================================================
  // SECTION 2c: This Week's Daily Table (Phase 1c upgrade)
  // Renders Mon-Sun current week. For each occurred day (date <= today),
  // pairs with same-DOW row from the prior week and shows WoW delta
  // arrows on Tickets / VIP / Calls Booked / Calls Showed.
  // Adds VIP % / Booking % / Show % rate columns per Akari's reference
  // sheet. SQL extended to return 14 rows (this + last week).
  // ================================================================
  var weekCard = _card("This Week's Daily", { padding: '20px 24px 24px' });
  var weekSub = document.createElement('div');
  weekSub.style.cssText = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:-6px;margin-bottom:12px';
  weekSub.textContent = 'Mon to Sun current week, with Week-over-Week delta vs same DOW last week. VIP % = vip/tickets. Booking % = calls/tickets. Show % = showed/booked.';
  weekCard.appendChild(weekSub);

  if (weeklyDailyData && weeklyDailyData.length > 0) {
    var tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'overflow-x:auto';

    // Build a date -> row map so we can look up "same DOW last week"
    function _normDate(r) {
      var d = r.date && r.date.value ? r.date.value : r.date;
      return String(d || '');
    }
    var byDate = {};
    weeklyDailyData.forEach(function (r) { byDate[_normDate(r)] = r; });

    // Today (local ISO date) for "occurred?" check
    var todayISO = new Date().toISOString().slice(0, 10);
    var dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Filter to current-week rows only (week_offset=current, or fallback to
    // date >= this Monday for old cache lacking week_offset)
    function _isCurrentWeek(r) {
      if (r.week_offset) return r.week_offset === 'current';
      var d = _normDate(r);
      var now = new Date();
      var monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      var mondayISO = monday.toISOString().slice(0, 10);
      return d >= mondayISO;
    }
    var currentRows = weeklyDailyData.filter(_isCurrentWeek);

    function _prevWeekRow(curDateStr) {
      if (!curDateStr) return null;
      var dt = new Date(curDateStr + 'T00:00:00');
      if (isNaN(dt.getTime())) return null;
      dt.setDate(dt.getDate() - 7);
      var prevISO = dt.toISOString().slice(0, 10);
      return byDate[prevISO] || null;
    }

    // Delta arrow renderer: only renders if prev exists and date has occurred.
    // Up = green when metric is good (tickets/vip/calls/showed all favor higher).
    function _arrow(cur, prev, hasOccurred) {
      if (!hasOccurred) return '';
      if (prev == null || prev === undefined) return '';
      var c = Number(cur || 0), p = Number(prev || 0);
      if (p === 0 && c === 0) return '';
      if (p === 0) return '<span style="color:' + Theme.COLORS.success + ';font-size:10px;margin-left:6px" title="No prior-week baseline">&#9650;</span>';
      var diff = c - p;
      if (diff === 0) return '<span style="color:' + Theme.COLORS.textMuted + ';font-size:10px;margin-left:6px">—</span>';
      var pct = (diff / Math.abs(p)) * 100;
      var color = diff > 0 ? Theme.COLORS.success : Theme.COLORS.danger;
      var arrow = diff > 0 ? '&#9650;' : '&#9660;';
      var pctStr = (diff > 0 ? '+' : '') + pct.toFixed(0) + '%';
      var tip = 'vs ' + Math.round(p).toLocaleString() + ' same DOW last week';
      return '<span style="color:' + color + ';font-size:10px;margin-left:6px;font-family:var(--font-mono)" title="' + tip + '">' + arrow + ' ' + pctStr + '</span>';
    }

    function _pct(num, den) {
      var n = Number(num || 0), d = Number(den || 0);
      if (d <= 0) return '<span style="color:' + Theme.COLORS.textMuted + '">--</span>';
      return (n / d * 100).toFixed(1) + '%';
    }

    var rowsHtml = currentRows.map(function (r) {
      var dateStr = _normDate(r);
      var dow = '';
      if (dateStr) {
        var dt = new Date(dateStr + 'T00:00:00');
        if (!isNaN(dt.getTime())) dow = dowNames[dt.getDay()];
      }
      var hasOccurred = dateStr && dateStr <= todayISO;
      var isToday = dateStr === todayISO;
      var rowStyle = isToday ? 'background:rgba(6,182,212,0.06)' : '';
      var dateLabel = dow ? (dow + ' ' + dateStr.slice(5)) : dateStr;
      var dimStyle = hasOccurred ? '' : 'opacity:0.4;';

      var prev = _prevWeekRow(dateStr);
      var prevTickets = prev ? prev.tickets : null;
      var prevVip = prev ? prev.vip : null;
      var prevBooked = prev ? prev.calls_booked : null;
      var prevShowed = prev ? prev.calls_showed : null;

      var ticketsN = Number(r.tickets || 0);
      var vipN = Number(r.vip || 0);
      var bookedN = Number(r.calls_booked || 0);
      var showedN = Number(r.calls_showed || 0);
      var enrollsN = Number(r.enrollments || 0);
      var grossN = Number(r.gross_revenue || 0);

      var nbsp = '&nbsp;';
      return [
        '<tr style="' + rowStyle + dimStyle + '">',
        '  <td style="padding:8px 10px;color:' + Theme.COLORS.textPrimary + ';font-weight:' + (isToday ? '700' : '500') + ';white-space:nowrap">' + _escText(dateLabel) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + ';white-space:nowrap">' + ticketsN.toLocaleString() + _arrow(ticketsN, prevTickets, hasOccurred) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:#a855f7;white-space:nowrap">' + vipN.toLocaleString() + _arrow(vipN, prevVip, hasOccurred) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + ';white-space:nowrap">' + bookedN.toLocaleString() + _arrow(bookedN, prevBooked, hasOccurred) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + ';white-space:nowrap">' + showedN.toLocaleString() + _arrow(showedN, prevShowed, hasOccurred) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-family:var(--font-mono);font-size:12px">' + _pct(vipN, ticketsN) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-family:var(--font-mono);font-size:12px">' + _pct(bookedN, ticketsN) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-family:var(--font-mono);font-size:12px">' + _pct(showedN, bookedN) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.success + ';font-weight:600">' + enrollsN.toLocaleString() + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + ';font-weight:600">' + Theme.formatValue(grossN, 'money') + '</td>',
        '</tr>',
      ].join('');
    }).join('');

    function _th(label) {
      return '<th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;white-space:nowrap">' + label + '</th>';
    }
    tableWrap.innerHTML = [
      '<table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Manrope,sans-serif">',
      '  <thead>',
      '    <tr style="border-bottom:1px solid ' + (Theme.COLORS.gridLine || 'rgba(255,255,255,0.08)') + '">',
      '      <th style="padding:10px;text-align:left;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Date</th>',
      _th('Tickets'),
      _th('VIP'),
      _th('Calls Booked'),
      _th('Calls Showed'),
      _th('VIP %'),
      _th('Booking %'),
      _th('Show %'),
      _th('Enrollments'),
      _th('Stripe Rev'),
      '    </tr>',
      '  </thead>',
      '  <tbody>' + rowsHtml + '</tbody>',
      '</table>',
    ].join('');

    weekCard.appendChild(tableWrap);
  } else {
    var noWeek = document.createElement('p');
    noWeek.className = 'text-muted';
    noWeek.style.cssText = 'font-size:13px;padding:16px';
    noWeek.textContent = 'No weekly data available yet.';
    weekCard.appendChild(noWeek);
  }
  container.appendChild(weekCard);

  // ================================================================
  // SWR cache-refresh wiring (was tied to old KPI grid in v2).
  // When api.js detects row-count delta from a background live fetch,
  // re-fetch and re-render the snapshot strip only. AbortController
  // guards against listener leaks across re-renders.
  // ================================================================
  if (container._cacheRefreshController) {
    try { container._cacheRefreshController.abort(); } catch (e) {}
  }
  container._cacheRefreshController = new AbortController();
  window.addEventListener('cache-refresh', function (e) {
    if (!e || !e.detail || e.detail.page !== 'war-room' || e.detail.queryName !== 'default') return;
    API.query('war-room', 'default', { days: days }).then(function (rows) {
      if (!rows || rows.length === 0) return;
      var c2 = rows[0] || {};
      var p2 = rows[1] || {};
      var showed2 = Math.max(0, (c2.total_calls || 0) - (c2.no_shows || 0));
      var prevShowed2 = Math.max(0, (p2.total_calls || 0) - (p2.no_shows || 0));
      var sr2 = (c2.total_calls || 0) > 0 ? (showed2 / c2.total_calls * 100) : 0;
      var psr2 = (p2.total_calls || 0) > 0 ? (prevShowed2 / p2.total_calls * 100) : 0;
      var refreshed = snapshotKpis.map(function (k) { return Object.assign({}, k); });
      refreshed[0].value = c2.net_revenue || 0; refreshed[0].prevValue = p2.net_revenue || 0; refreshed[0].delta = _delta(c2.net_revenue || 0, p2.net_revenue || 0);
      refreshed[1].value = c2.total_spend || 0; refreshed[1].prevValue = p2.total_spend || 0; refreshed[1].delta = _delta(c2.total_spend || 0, p2.total_spend || 0);
      refreshed[2].value = c2.total_calls || 0; refreshed[2].prevValue = p2.total_calls || 0; refreshed[2].delta = _delta(c2.total_calls || 0, p2.total_calls || 0);
      refreshed[3].value = c2.cpb || 0; refreshed[3].prevValue = p2.cpb || 0; refreshed[3].delta = _delta(c2.cpb || 0, p2.cpb || 0);
      refreshed[4].value = sr2; refreshed[4].prevValue = psr2; refreshed[4].delta = _delta(sr2, psr2);
      refreshed[5].value = c2.close_rate || 0; refreshed[5].prevValue = p2.close_rate || 0; refreshed[5].delta = _delta(c2.close_rate || 0, p2.close_rate || 0);
      Components.renderKPIStrip(snapshotContainer, refreshed);
    }).catch(function () { /* live fetch already failed once */ });
  }, { signal: container._cacheRefreshController.signal });

  // Sections 4-6 (Leak Detection, Funnel Summary, Sales Pulse) and the
  // responsive funnelRow handler are removed in v3 -- replaced upstream
  // by Section 3 (Anomaly Strip), Section 4 (Journey Cards), and
  // Section 5 (Mini Closer Board). Snapshot strip + journey cards rely
  // on auto-fit grid for responsive layout.
}

// ---- Text escape helper (outside registerPage for reuse) ----
function _escText(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ================================================================
// Shopify-style Daily Revenue Strip + Single-Metric Line Chart
// Mirrors funnels.js renderFunnelChart pattern. Self-contained.
// ================================================================
var _warStackChartInstance = null;
var _warStackActiveMetric = 3; // 0=Tickets, 1=VIP, 2=Lions Pride, 3=Total (Stripe)
var _warStackMode = 'money';   // 'money' or 'people' (toggle in card header)

// Lions Pride = COD program payment bucket per product taxonomy v2 ($60-$1000, canonical
// $497 event ticket); cache field renamed from high_ticket_* to lions_pride_* (2026-05-15).
// VIP includes single $54 AND the second $27 within 7 days from the same email (paired upgrade).
// "Total" here is Stripe-bucket sum only -- NOT the blended war-room snapshot total.
// Each metric has BOTH a money key and a people key (COUNT DISTINCT email).
var _WAR_STACK_METRICS = [
  { keyMoney: 'ticket_revenue',       keyPeople: 'ticket_people',       label: 'Tickets',        color: '#06b6d4', tip: 'Initial $27 workshop ticket purchase, first per customer in 7-day window.' },
  { keyMoney: 'vip_revenue',          keyPeople: 'vip_people',          label: 'VIP',            color: '#a855f7', tip: 'VIP upgrade revenue: single $54 charge, or second $27 from same customer within 7 days.' },
  { keyMoney: 'lions_pride_revenue',  keyPeople: 'lions_pride_people',  label: 'Lions Pride',    color: '#22c55e', tip: 'Lions Pride event bucket ($60-$1000, canonical $497) per COD product taxonomy v2.' },
  { keyMoney: '_total_money',         keyPeople: '_total_people',       label: 'Total (Stripe)', color: '#f59e0b', tip: 'Sum of Tickets + VIP + Lions Pride per day (Stripe-only; not blended war-room total).' }
];

function _renderStackShopifyStyle(rows, stripId, canvasId, legendId) {
  if (!rows || rows.length === 0) return;

  var isPeople = _warStackMode === 'people';

  // Normalize rows: pull both money + people fields; compute synthetic totals.
  // Cache fields renamed high_ticket_* -> lions_pride_* (2026-05-15 product taxonomy v2);
  // fall back to legacy keys so stale caches still render non-zero during rollover.
  var normRows = rows.map(function (r) {
    var tM = Number(r.ticket_revenue || 0);
    var vM = Number(r.vip_revenue || 0);
    var hM = Number(r.lions_pride_revenue != null ? r.lions_pride_revenue : (r.high_ticket_revenue || 0));
    var tP = Number(r.ticket_people || 0);
    var vP = Number(r.vip_people || 0);
    var hP = Number(r.lions_pride_people != null ? r.lions_pride_people : (r.high_ticket_people || 0));
    var d = r.date && r.date.value ? r.date.value : r.date;
    return {
      dt: String(d || ''),
      ticket_revenue: tM,
      vip_revenue: vM,
      lions_pride_revenue: hM,
      ticket_people: tP,
      vip_people: vP,
      lions_pride_people: hP,
      _total_money: tM + vM + hM,
      _total_people: tP + vP + hP
    };
  });

  // Totals + deltas: split into first-half / second-half to compute period-over-period
  var half = Math.floor(normRows.length / 2);
  function sumKey(arr, key) { return arr.reduce(function (s, r) { return s + (r[key] || 0); }, 0); }
  var first = normRows.slice(0, half);
  var second = normRows.slice(half);

  function fmtMoney(v) {
    if (v >= 1000) return '$' + (Math.round(v / 100) / 10) + 'k';
    return '$' + Math.round(v).toLocaleString();
  }
  function fmtPeople(v) {
    return Math.round(v).toLocaleString();
  }
  function deltaPct(c, p) {
    if (!p || p === 0) return null;
    return ((c - p) / Math.abs(p)) * 100;
  }

  var miniKpis = _WAR_STACK_METRICS.map(function (m) {
    var key = isPeople ? m.keyPeople : m.keyMoney;
    var cur = sumKey(second, key);
    var prev = sumKey(first, key);
    var fmt = isPeople ? fmtPeople : fmtMoney;
    return { label: m.label, value: fmt(cur), delta: deltaPct(cur, prev) };
  });

  // Render strip with clickable metric cards
  var strip = document.getElementById(stripId);
  if (!strip) return;
  strip.innerHTML = miniKpis.map(function (mk, idx) {
    var d = mk.delta;
    var dStr = d === null ? '' : ((d >= 0 ? '+' : '') + d.toFixed(0) + '%');
    var dColor = d === null ? 'transparent' : (d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#64748b');
    var active = idx === _warStackActiveMetric;
    var bg = active ? 'rgba(255,255,255,0.06)' : 'transparent';
    var border = active ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)';
    var shadow = active ? 'box-shadow:0 0 8px rgba(124,58,237,0.15);' : '';
    var tip = _WAR_STACK_METRICS[idx].tip;
    return '<div class="war-stack-metric" data-idx="' + idx + '" title="' + tip + '" style="cursor:pointer;padding:6px 12px;border-radius:8px;border:' + border + ';background:' + bg + ';' + shadow + 'transition:all 150ms">' +
      '<div style="font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-bottom:2px">' + mk.label + '</div>' +
      '<div style="display:flex;align-items:baseline;gap:6px">' +
        '<span style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:' + Theme.COLORS.textPrimary + ';font-variant-numeric:tabular-nums">' + mk.value + '</span>' +
        (dStr ? '<span style="font-family:var(--font-mono);font-size:11px;font-weight:600;color:' + dColor + '">' + dStr + '</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // Click handlers
  strip.querySelectorAll('.war-stack-metric').forEach(function (el) {
    el.addEventListener('click', function () {
      _warStackActiveMetric = parseInt(this.dataset.idx, 10);
      _renderStackShopifyStyle(rows, stripId, canvasId, legendId);
    });
  });

  // Legend (date range)
  var startLbl = normRows.length ? normRows[0].dt.slice(5) : '';
  var endLbl = normRows.length ? normRows[normRows.length - 1].dt.slice(5) : '';
  var legend = document.getElementById(legendId);
  if (legend) {
    var color = _WAR_STACK_METRICS[_warStackActiveMetric].color;
    legend.innerHTML =
      '<span style="display:inline-flex;align-items:center;gap:6px">' +
        '<span style="width:16px;height:2px;background:' + color + ';display:inline-block"></span>' +
        '<strong style="color:#f1f5f9">' + _WAR_STACK_METRICS[_warStackActiveMetric].label + '</strong> ' +
        '<span style="opacity:0.6">' + startLbl + ' to ' + endLbl + '</span>' +
      '</span>';
  }

  // Draw chart
  var ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (_warStackChartInstance) { try { _warStackChartInstance.destroy(); } catch (e) {} }

  var metric = _WAR_STACK_METRICS[_warStackActiveMetric];
  var seriesKey = isPeople ? metric.keyPeople : metric.keyMoney;
  var labels = normRows.map(function (r) {
    if (!r.dt) return '';
    var parts = r.dt.split('-');
    return parts.length >= 3 ? (parts[1] + '/' + parts[2]) : r.dt;
  });
  var data = normRows.map(function (r) { return r[seriesKey]; });

  _warStackChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: metric.label,
        data: data,
        borderColor: metric.color,
        backgroundColor: metric.color + '22',
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          callbacks: {
            label: function (c) {
              var raw = Number(c.raw);
              return metric.label + ': ' + (isPeople ? raw.toLocaleString() + ' people' : '$' + raw.toLocaleString());
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: Theme.COLORS.textMuted,
            font: { size: 10 },
            callback: function (v) {
              if (isPeople) return Math.round(v).toLocaleString();
              return '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v);
            }
          }
        }
      }
    }
  });
}
