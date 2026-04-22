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
  let defaultData, dailyRevenueData, stalenessData, leakData, closersData;

  try {
    const results = await Promise.allSettled([
      API.query('war-room', 'default', { days }),
      API.query('war-room', 'dailyRevenue', { days }),
      API.query('war-room', 'staleness', {}),
      API.query('war-room', 'leakDetection', { days }),
      API.query('war-room', 'closers', { days }),
    ]);

    defaultData = results[0].status === 'fulfilled' ? results[0].value : [];
    dailyRevenueData = results[1].status === 'fulfilled' ? results[1].value : [];
    stalenessData = results[2].status === 'fulfilled' ? results[2].value : [];
    leakData = results[3].status === 'fulfilled' ? results[3].value : [];
    closersData = results[4].status === 'fulfilled' ? results[4].value : [];
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

  var sparkId = 'hero-spark-' + Date.now();

  heroCard.innerHTML = [
    '<div style="font-size:11px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Revenue</div>',
    '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">',
    '  <span style="font-size:36px;font-weight:800;color:#fff;font-family:Manrope,sans-serif">' + Theme.formatValue(netRevenue, 'money') + '</span>',
    '  <span class="kpi-delta ' + deltaClass + '" style="font-size:16px">' + deltaArrow + ' ' + deltaStr + '</span>',
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
  // SECTION 3: KPI Strip (WAR-07)
  // ================================================================
  var kpiContainer = document.createElement('div');
  kpiContainer.style.marginBottom = '16px';
  container.appendChild(kpiContainer);

  // Build spark arrays from dailyRevenue where applicable
  var spendSpark = []; // no daily spend in dailyRevenue query, leave empty
  var enrollSpark = dailyRevenueData.map(function (r) { return r.enrollment_revenue || 0; });

  Components.renderKPIStrip(kpiContainer, [
    {
      label: 'Ad Spend',
      value: cur.total_spend || 0,
      prevValue: prev.total_spend || 0,
      format: 'money',
      delta: _delta(cur.total_spend, prev.total_spend),
      invertCost: true,
      source: 'v_meta_ads_clean',
      calc: 'SUM(spend)',
    },
    {
      label: 'CPB',
      value: cur.cpb || 0,
      prevValue: prev.cpb || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cpb, prev.cpb),
      source: 'v_meta_ads_clean + v_sheets_bookings',
      calc: 'total_spend / total_calls',
    },
    {
      label: 'Cost/Enrollment',
      value: cur.cost_per_enrollment || 0,
      prevValue: prev.cost_per_enrollment || 0,
      format: 'money',
      invertCost: true,
      delta: _delta(cur.cost_per_enrollment, prev.cost_per_enrollment),
      source: 'v_meta_ads_clean + v_stripe_clean',
      calc: 'total_spend / enrollments',
    },
    {
      label: 'Enrollments',
      value: cur.enrollments || 0,
      prevValue: prev.enrollments || 0,
      format: 'num',
      delta: _delta(cur.enrollments, prev.enrollments),
      sparkData: enrollSpark,
      source: 'v_stripe_clean',
      calc: 'COUNT(DISTINCT email) WHERE amount > 500',
    },
    {
      label: 'ROAS',
      value: cur.roas || 0,
      prevValue: prev.roas || 0,
      format: 'num',
      delta: _delta(cur.roas, prev.roas),
      source: 'v_stripe_clean + v_meta_ads_clean',
      calc: '(gross_revenue - refunds) / total_spend',
    },
    {
      label: 'Close Rate',
      value: cur.close_rate || 0,
      prevValue: prev.close_rate || 0,
      format: 'pct',
      delta: _delta(cur.close_rate, prev.close_rate),
      source: 'v_sheets_bookings_enriched',
      calc: 'closed / total_calls * 100',
    },
  ]);

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

  // MA/VSL Funnel card (placeholder)
  var funnelCardMA = document.createElement('a');
  funnelCardMA.href = '#ma-funnel';
  funnelCardMA.className = 'card';
  funnelCardMA.style.cssText = 'padding:24px;flex:1;min-width:280px;text-decoration:none;color:inherit;cursor:pointer;opacity:0.5';

  funnelCardMA.innerHTML = [
    '<div style="font-size:13px;font-weight:700;color:' + Theme.COLORS.textPrimary + ';text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">MA/VSL Funnel</div>',
    '<div style="font-size:14px;color:' + Theme.COLORS.textMuted + '">Coming in Phase 4</div>',
    '<div style="font-size:11px;color:' + Theme.COLORS.textMuted + ';margin-top:8px">View funnel &rarr;</div>',
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
