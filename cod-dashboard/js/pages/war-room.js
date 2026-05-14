/* ============================================
   War Room v2 -- CEO 5-second pulse page
   6 stacked sections: staleness, hero revenue,
   KPI strip, leak detection, funnel summary,
   sales pulse.
   Mobile-first vertical stack (D-02).
   ============================================ */

App.registerPage('war-room', async (container) => {
  await renderWarRoom(container);
  App.onFilterChange(() => renderWarRoom(container));
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
  let defaultData, dailyRevenueData, stalenessData, leakData, closersData,
      dailyRevStackData, weeklyDailyData;

  try {
    const results = await Promise.allSettled([
      API.query('war-room', 'default', { days }),
      API.query('war-room', 'dailyRevenue', { days }),
      API.query('war-room', 'staleness', {}),
      API.query('war-room', 'leakDetection', { days }),
      API.query('war-room', 'closers', { days }),
      API.query('war-room', 'dailyRevenueStack', { days: 14 }),
      API.query('war-room', 'weeklyDailyBreakdown', {}),
    ]);

    defaultData = results[0].status === 'fulfilled' ? results[0].value : [];
    dailyRevenueData = results[1].status === 'fulfilled' ? results[1].value : [];
    stalenessData = results[2].status === 'fulfilled' ? results[2].value : [];
    leakData = results[3].status === 'fulfilled' ? results[3].value : [];
    closersData = results[4].status === 'fulfilled' ? results[4].value : [];
    dailyRevStackData = results[5].status === 'fulfilled' ? results[5].value : [];
    weeklyDailyData = results[6].status === 'fulfilled' ? results[6].value : [];
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
  // SECTION 2: Hero Revenue Card (WAR-01)
  // ================================================================
  var heroCard = document.createElement('div');
  heroCard.className = 'card hero-revenue-card';
  heroCard.style.cssText = 'padding:32px;margin-bottom:16px';

  var netRevenue = cur.net_revenue || 0;
  var prevNetRevenue = prev.net_revenue || 0;
  var revDelta = _delta(netRevenue, prevNetRevenue);

  // Build sparkline data from dailyRevenue
  var sparkData = (dailyRevenueData || []).map(function (r) { return r.total_revenue || 0; });

  // Compute today / 7d / 30d sub-metrics from dailyRevenue
  var drLen = dailyRevenueData ? dailyRevenueData.length : 0;
  var todayRev = drLen > 0 ? (dailyRevenueData[drLen - 1].total_revenue || 0) : 0;
  var last7 = drLen >= 7 ? dailyRevenueData.slice(-7) : dailyRevenueData || [];
  var last30 = drLen >= 30 ? dailyRevenueData.slice(-30) : dailyRevenueData || [];
  var rev7d = _sum(last7.map(function (r) { return r.total_revenue || 0; }));
  var rev30d = _sum(last30.map(function (r) { return r.total_revenue || 0; }));

  // Delta arrow + class
  var deltaClass = revDelta != null ? Theme.deltaClass(revDelta, false) : 'neutral';
  var deltaArrow = revDelta > 0 ? '&#9650;' : revDelta < 0 ? '&#9660;' : '';
  var deltaSign = revDelta >= 0 ? '+' : '';
  var deltaStr = revDelta != null ? (deltaSign + revDelta.toFixed(1) + '%') : '--';

  // Hero z-score badge: today's revenue vs trailing 30 days. We compute
  // against the per-day series so the badge captures intra-day anomalies,
  // not period vs prior-period.
  var heroDailySeries = dailyRevenueData.slice(-30).map(function (r) { return Number(r.total_revenue || 0); });
  var heroZ = Components.computeZScore ? Components.computeZScore(heroDailySeries) : null;
  var heroZBadgeHTML = '';
  if (heroZ != null && Math.abs(heroZ) >= 1.5) {
    var heroSeverity = Math.abs(heroZ) >= 2.5 ? 'severe' : 'mild';
    var heroFavorable = heroZ > 0; // hero is revenue, so positive is good
    var heroBg = heroFavorable
      ? (heroSeverity === 'severe' ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.10)')
      : (heroSeverity === 'severe' ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.10)');
    var heroFg = heroFavorable ? '#22c55e' : '#ef4444';
    var heroBorder = heroFavorable ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)';
    var heroSign = heroZ > 0 ? '+' : '';
    var heroTip = "Today is " + Math.abs(heroZ).toFixed(1) + "σ " + (heroZ > 0 ? "above" : "below") + " the trailing 30-day mean";
    heroZBadgeHTML = '<span title="' + heroTip + '" style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:5px;background:' + heroBg + ';color:' + heroFg + ';border:1px solid ' + heroBorder + ';font-size:12px;font-weight:700;letter-spacing:0.04em;font-family:Manrope,sans-serif"><span style="font-size:13px;line-height:1">σ</span>' + heroSign + heroZ.toFixed(1) + '</span>';
  }

  var sparkId = 'hero-spark-' + Date.now();

  heroCard.innerHTML = [
    '<div style="font-size:11px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Revenue</div>',
    '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">',
    '  <span style="font-size:36px;font-weight:800;color:#fff;font-family:Manrope,sans-serif">' + Theme.formatValue(netRevenue, 'money') + '</span>',
    '  <span class="kpi-delta ' + deltaClass + '" style="font-size:16px">' + deltaArrow + ' ' + deltaStr + '</span>',
    heroZBadgeHTML,
    '  <canvas id="' + sparkId + '" width="120" height="32" style="width:120px;height:32px"></canvas>',
    '</div>',
    '<div style="display:flex;gap:24px;margin-top:16px;flex-wrap:wrap">',
    '  <div>',
    '    <div style="font-size:10px;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">Today</div>',
    '    <div style="font-size:18px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">' + Theme.formatValue(todayRev, 'money') + '</div>',
    '  </div>',
    '  <div>',
    '    <div style="font-size:10px;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">7d</div>',
    '    <div style="font-size:18px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">' + Theme.formatValue(rev7d, 'money') + '</div>',
    '  </div>',
    '  <div>',
    '    <div style="font-size:10px;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">30d</div>',
    '    <div style="font-size:18px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">' + Theme.formatValue(rev30d, 'money') + '</div>',
    '  </div>',
    '</div>',
  ].join('\n');

  container.appendChild(heroCard);

  // Render hero sparkline after DOM insert
  if (sparkData.length > 1) {
    requestAnimationFrame(function () {
      Components.renderSparkline(sparkId, sparkData);
    });
  }

  // ================================================================
  // SECTION 2b: Daily Revenue Stack (Wave 1.3) -- last 14d, 3 segments
  // Shopify-style: clickable mini-KPI strip + single-metric line chart
  // Pattern mirrors funnels.js renderFunnelChart for consistency.
  // ================================================================
  var stackCard = _card('Daily Revenue Stack', { padding: '20px 24px 24px' });
  var stackSub = document.createElement('div');
  stackSub.style.cssText = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:-6px;margin-bottom:12px';
  stackSub.textContent = 'Click any metric to drill the line. Tickets, VIP, and high-ticket revenue per day, last 14 days.';
  stackCard.appendChild(stackSub);

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
    // Lazy-init: defer Chart.js construction until the canvas scrolls into
    // view. Metric-switching click handler (inside _renderStackShopifyStyle)
    // re-invokes the function directly, bypassing lazyChart's once-flag —
    // so subsequent metric switches still re-render normally.
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
  // SECTION 2c: This Week's Daily Table (Wave 1.3) -- Mon-Sun
  // ================================================================
  var weekCard = _card("This Week's Daily", { padding: '20px 24px 24px' });
  var weekSub = document.createElement('div');
  weekSub.style.cssText = 'font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:-6px;margin-bottom:12px';
  weekSub.textContent = 'Mon to Sun current week. Tickets and VIP from Stripe; calls + enrollments from workshop pipeline.';
  weekCard.appendChild(weekSub);

  if (weeklyDailyData && weeklyDailyData.length > 0) {
    var tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'overflow-x:auto';

    var dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var rowsHtml = weeklyDailyData.map(function (r) {
      var d = r.date && r.date.value ? r.date.value : r.date;
      var dateStr = String(d || '');
      var dow = '';
      if (dateStr) {
        var dt = new Date(dateStr + 'T00:00:00');
        if (!isNaN(dt.getTime())) dow = dowNames[dt.getDay()];
      }
      var isToday = dateStr === new Date().toISOString().slice(0, 10);
      var rowStyle = isToday ? 'background:rgba(6,182,212,0.06)' : '';
      var dateLabel = dow ? (dow + ' ' + dateStr.slice(5)) : dateStr;
      return [
        '<tr style="' + rowStyle + '">',
        '  <td style="padding:8px 10px;color:' + Theme.COLORS.textPrimary + ';font-weight:' + (isToday ? '700' : '500') + '">' + _escText(dateLabel) + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + '">' + Number(r.tickets || 0).toLocaleString() + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:#a855f7">' + Number(r.vip || 0).toLocaleString() + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + '">' + Number(r.calls_booked || 0).toLocaleString() + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + '">' + Number(r.calls_showed || 0).toLocaleString() + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.success + ';font-weight:600">' + Number(r.enrollments || 0).toLocaleString() + '</td>',
        '  <td style="padding:8px 10px;text-align:right;color:' + Theme.COLORS.textPrimary + ';font-weight:600">' + Theme.formatValue(Number(r.gross_revenue || 0), 'money') + '</td>',
        '</tr>',
      ].join('');
    }).join('');

    tableWrap.innerHTML = [
      '<table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Manrope,sans-serif">',
      '  <thead>',
      '    <tr style="border-bottom:1px solid ' + (Theme.COLORS.gridLine || 'rgba(255,255,255,0.08)') + '">',
      '      <th style="padding:10px;text-align:left;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Date</th>',
      '      <th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Tickets</th>',
      '      <th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">VIP</th>',
      '      <th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Calls Booked</th>',
      '      <th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Calls Showed</th>',
      '      <th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Enrollments</th>',
      '      <th style="padding:10px;text-align:right;color:' + Theme.COLORS.textMuted + ';font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px">Gross Rev</th>',
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
  // SECTION 3: KPI Metric Grid (WAR-07) -- Mode 2 conversion from KPI strip
  // to dense f27-style metric cards. Hero card above remains big; this grid
  // packs the 6 supporting metrics into a denser visual rhythm matching the
  // $27 Funnel Unit Economics pattern. PRD §2 Mode 2.
  // ================================================================
  var kpiContainer = document.createElement('div');
  kpiContainer.style.marginBottom = '16px';
  container.appendChild(kpiContainer);

  // Daily enrollment-revenue series doubles as a sparkline trend hint for
  // the Enrollments card. Other metrics lack a daily series in the current
  // war-room queries (no daily spend, no daily close rate); leave them blank.
  var enrollSpark = (dailyRevenueData || []).map(function (r) { return Number(r.enrollment_revenue || 0); });

  function _buildWarRoomMetrics(curRow, prevRow) {
    return [
      { label: 'Ad Spend',        value: curRow.total_spend,         prevValue: prevRow.total_spend,         format: 'money', invertDelta: true },
      { label: 'CPB',             value: curRow.cpb,                 prevValue: prevRow.cpb,                 format: 'money', invertDelta: true },
      { label: 'Cost/Enrollment', value: curRow.cost_per_enrollment, prevValue: prevRow.cost_per_enrollment, format: 'money', invertDelta: true },
      { label: 'Enrollments',     value: curRow.enrollments,         prevValue: prevRow.enrollments,         format: 'num',   sparklineData: enrollSpark },
      { label: 'ROAS',            value: curRow.roas,                prevValue: prevRow.roas,                format: 'roas'  },
      { label: 'Close Rate',      value: curRow.close_rate,          prevValue: prevRow.close_rate,          format: 'pct'   },
    ];
  }

  Components.renderMetricGrid(kpiContainer, _buildWarRoomMetrics(cur, prev));

  // SWR cache-refresh wiring (discharges Stage 2 deferred follow-up #3 for
  // war-room). When api.js detects row-count delta from a background live
  // fetch, re-fetch the in-memory-cached result and re-render the grid only.
  // AbortController guards against listener leaks across re-renders.
  if (container._cacheRefreshController) {
    try { container._cacheRefreshController.abort(); } catch (e) {}
  }
  container._cacheRefreshController = new AbortController();
  window.addEventListener('cache-refresh', function (e) {
    if (!e || !e.detail || e.detail.page !== 'war-room' || e.detail.queryName !== 'default') return;
    API.query('war-room', 'default', { days: days }).then(function (rows) {
      if (!rows || rows.length === 0) return;
      Components.renderMetricGrid(kpiContainer, _buildWarRoomMetrics(rows[0] || {}, rows[1] || {}));
    }).catch(function () { /* swallow; live fetch already failed once */ });
  }, { signal: container._cacheRefreshController.signal });

  // ================================================================
  // SECTION 4: Leak Detection Panel (WAR-03)
  // ================================================================
  var leakCard = _card('Leak Detection', { borderLeft: '3px solid ' + Theme.COLORS.danger });
  container.appendChild(leakCard);

  if (leakData && leakData.length > 0) {
    // Sort by dollar_value descending (biggest leak first)
    leakData.sort(function (a, b) { return (b.dollar_value || 0) - (a.dollar_value || 0); });

    var leakGrid = document.createElement('div');
    leakGrid.style.cssText = 'display:flex;flex-direction:column;gap:12px';

    leakData.forEach(function (leak) {
      var leakRow = document.createElement('div');
      leakRow.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:12px 16px',
        'background:rgba(239,68,68,0.06)',
        'border-radius:8px',
        'border:1px solid rgba(239,68,68,0.15)',
      ].join(';');

      var dollarFormatted = Theme.formatValue(leak.dollar_value || 0, 'money');
      var countText = (leak.count || 0).toLocaleString();

      leakRow.innerHTML = [
        '<div style="display:flex;flex-direction:column;gap:2px">',
        '  <span style="font-size:16px;font-weight:700;color:' + Theme.COLORS.danger + '">' + dollarFormatted + '</span>',
        '  <span style="font-size:12px;color:' + Theme.COLORS.textSecondary + '">leaked to ' + _escText(leak.leak_type || 'Unknown') + '</span>',
        '</div>',
        '<div style="font-size:13px;color:' + Theme.COLORS.textMuted + '">' + countText + ' ' + (leak.leak_type === 'Refunds' ? 'refunds' : 'contacts') + '</div>',
      ].join('');

      leakGrid.appendChild(leakRow);
    });

    leakCard.appendChild(leakGrid);
  } else {
    var noLeaks = document.createElement('p');
    noLeaks.className = 'text-muted';
    noLeaks.style.fontSize = '13px';
    noLeaks.textContent = 'No leaks detected for this period';
    leakCard.appendChild(noLeaks);
  }

  // ================================================================
  // SECTION 5: Funnel Summary Cards (WAR-05)
  // ================================================================
  var funnelRow = document.createElement('div');
  funnelRow.className = 'war-room-funnel-row';
  funnelRow.style.cssText = 'display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap';
  container.appendChild(funnelRow);

  // $27 Funnel card
  var funnelCard27 = document.createElement('a');
  funnelCard27.href = '#funnels';
  funnelCard27.className = 'card';
  funnelCard27.style.cssText = 'padding:24px;flex:1;min-width:280px;text-decoration:none;color:inherit;cursor:pointer;transition:border-color 0.15s';
  funnelCard27.setAttribute('role', 'link');

  // Try to compute a conversion rate from default data
  var ticketToEnrollRate = 0;
  if (cur.enrollments && cur.total_calls && cur.total_calls > 0) {
    ticketToEnrollRate = (cur.enrollments / cur.total_calls * 100);
  }

  funnelCard27.innerHTML = [
    '<div style="font-size:13px;font-weight:700;color:' + Theme.COLORS.textPrimary + ';text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">$27 Funnel</div>',
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">',
    '  <span style="font-size:24px;font-weight:700;color:' + Theme.COLORS.accentCyan + '">' + ticketToEnrollRate.toFixed(1) + '%</span>',
    '  <span style="font-size:12px;color:' + Theme.COLORS.textSecondary + '">call-to-enrollment rate</span>',
    '</div>',
    '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">',
    '  <div style="height:100%;width:' + Math.min(ticketToEnrollRate * 2, 100) + '%;background:' + Theme.COLORS.accentCyan + ';border-radius:3px;transition:width 0.3s"></div>',
    '</div>',
    '<div style="font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:8px">View full funnel &rarr;</div>',
  ].join('');
  funnelRow.appendChild(funnelCard27);

  // MA/VSL Funnel card -- links to ma-funnel page
  var funnelCardMA = document.createElement('a');
  funnelCardMA.href = '#ma-funnel';
  funnelCardMA.className = 'card';
  funnelCardMA.style.cssText = 'padding:24px;flex:1;min-width:280px;text-decoration:none;color:inherit;cursor:pointer;transition:border-color 0.15s';
  funnelCardMA.setAttribute('role', 'link');

  funnelCardMA.innerHTML = [
    '<div style="font-size:13px;font-weight:700;color:' + Theme.COLORS.textPrimary + ';text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">MA/VSL Funnel</div>',
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">',
    '  <span style="font-size:14px;color:' + Theme.COLORS.textSecondary + '">Millionaires Alliance + VSL pipeline</span>',
    '</div>',
    '<div style="font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:8px">View MA/VSL funnel &rarr;</div>',
  ].join('');
  funnelRow.appendChild(funnelCardMA);

  // ================================================================
  // SECTION 6: Sales Team Pulse (WAR-06)
  // ================================================================
  var salesCard = _card('Sales Pulse');
  container.appendChild(salesCard);

  if (closersData && closersData.length > 0) {
    // Aggregate totals
    var totalCallsToday = 0; // We use total_calls from closers as an approximation
    var totalCalls = 0;
    var totalClosed = 0;
    var topCloser = closersData[0]; // Already sorted by total_calls DESC

    closersData.forEach(function (c) {
      totalCalls += (c.total_calls || 0);
      totalClosed += (c.closed || 0);
    });

    var teamCloseRate = totalCalls > 0 ? ((totalClosed / totalCalls) * 100) : 0;

    // Find the closer with highest close_rate (min 3 calls)
    var bestCloser = null;
    closersData.forEach(function (c) {
      if ((c.total_calls || 0) >= 3) {
        if (!bestCloser || (c.close_rate || 0) > (bestCloser.close_rate || 0)) {
          bestCloser = c;
        }
      }
    });

    var salesGrid = document.createElement('div');
    salesGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:12px';

    // Calls metric
    salesGrid.innerHTML = [
      '<div>',
      '  <div style="font-size:10px;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">Total Calls</div>',
      '  <div style="font-size:22px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">' + totalCalls.toLocaleString() + '</div>',
      '</div>',
      '<div>',
      '  <div style="font-size:10px;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">Team Close Rate</div>',
      '  <div style="font-size:22px;font-weight:700;color:' + (teamCloseRate >= 20 ? Theme.COLORS.success : Theme.COLORS.warning) + '">' + teamCloseRate.toFixed(1) + '%</div>',
      '</div>',
      bestCloser ? [
        '<div>',
        '  <div style="font-size:10px;color:' + Theme.COLORS.textMuted + ';text-transform:uppercase;letter-spacing:0.06em">Top Closer</div>',
        '  <div style="font-size:16px;font-weight:700;color:' + Theme.COLORS.textPrimary + '">' + _escText(bestCloser.closer || 'Unknown') + '</div>',
        '  <div style="font-size:12px;color:' + Theme.COLORS.success + '">' + (bestCloser.close_rate || 0).toFixed(1) + '% close rate</div>',
        '</div>',
      ].join('') : '',
    ].join('');

    salesCard.appendChild(salesGrid);

    // Link to Sales Team page
    var salesLink = document.createElement('a');
    salesLink.href = '#sales-team';
    salesLink.style.cssText = 'font-size:12px;color:' + Theme.COLORS.accentCyan + ';text-decoration:none;display:inline-block;margin-top:4px';
    salesLink.textContent = 'View Sales Team \u2192';
    salesCard.appendChild(salesLink);
  } else {
    var noSales = document.createElement('p');
    noSales.className = 'text-muted';
    noSales.style.fontSize = '13px';
    noSales.textContent = 'No closer data for this period';
    salesCard.appendChild(noSales);
  }

  // ---- Responsive: funnel cards side-by-side on desktop only ----
  var mq = window.matchMedia('(max-width: 768px)');
  function handleMobile(e) {
    if (e.matches) {
      funnelRow.style.flexDirection = 'column';
    } else {
      funnelRow.style.flexDirection = 'row';
    }
  }
  handleMobile(mq);
  mq.addEventListener('change', handleMobile);
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
var _warStackActiveMetric = 3; // 0=Tickets, 1=VIP, 2=High-Ticket, 3=Total

var _WAR_STACK_METRICS = [
  { key: 'ticket_revenue',      label: 'Tickets',     color: '#06b6d4', tip: 'Daily $27 workshop ticket revenue from Stripe charges.' },
  { key: 'vip_revenue',         label: 'VIP',         color: '#a855f7', tip: 'Daily VIP upgrade revenue ($27 -> $54) from Stripe charges.' },
  { key: 'high_ticket_revenue', label: 'High-Ticket', color: '#22c55e', tip: 'Daily core program enrollment revenue ($13.5k+ contracts).' },
  { key: '_total',              label: 'Total',       color: '#f59e0b', tip: 'Sum of Tickets + VIP + High-Ticket per day.' }
];

function _renderStackShopifyStyle(rows, stripId, canvasId, legendId) {
  if (!rows || rows.length === 0) return;

  // Normalize rows: ensure every metric is a number; compute synthetic _total
  var normRows = rows.map(function (r) {
    var t = Number(r.ticket_revenue || 0);
    var v = Number(r.vip_revenue || 0);
    var h = Number(r.high_ticket_revenue || 0);
    var d = r.date && r.date.value ? r.date.value : r.date;
    return {
      dt: String(d || ''),
      ticket_revenue: t,
      vip_revenue: v,
      high_ticket_revenue: h,
      _total: t + v + h
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
  function deltaPct(c, p) {
    if (!p || p === 0) return null;
    return ((c - p) / Math.abs(p)) * 100;
  }

  var miniKpis = _WAR_STACK_METRICS.map(function (m) {
    var cur = sumKey(second, m.key);
    var prev = sumKey(first, m.key);
    return { label: m.label, value: fmtMoney(cur), delta: deltaPct(cur, prev) };
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
  var labels = normRows.map(function (r) {
    if (!r.dt) return '';
    var parts = r.dt.split('-');
    return parts.length >= 3 ? (parts[1] + '/' + parts[2]) : r.dt;
  });
  var data = normRows.map(function (r) { return r[metric.key]; });

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
            label: function (c) { return metric.label + ': $' + Number(c.raw).toLocaleString(); }
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
            callback: function (v) { return '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v); }
          }
        }
      }
    }
  });
}
