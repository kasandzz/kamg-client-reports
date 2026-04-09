/* ============================================
   Leaks -- Revenue leak detection page
   KPI strip, leak waterfall, detail cards,
   per-100 dropout funnel visualization
   ============================================ */

App.registerPage('leaks', async (container) => {
  const days = Filters.getDays();
  let data;

  try {
    data = await API.query('leaks', 'default', { days });
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Leaks: ${err.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9888;</span><p>No data for the selected period</p></div>`;
    return;
  }

  const d = Array.isArray(data) ? data[0] : data;
  container.innerHTML = '';

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Revenue Leaked', value: d.total_leaked || 0, format: 'money', invertCost: true, source: 'BQ aggregated leak view', calc: 'no_show_cost + wasted_spend + refund_total' },
    { label: 'No-Show Cost', value: d.no_show_cost || 0, format: 'money', invertCost: true, source: 'BQ derived from GHL calendar', calc: 'COUNT(no_shows) * $877 avg deal value' },
    { label: 'VIP Non-Booker Gap', value: d.vip_non_booker_count || 0, format: 'num', invertCost: true, source: 'BQ zoom_attendance LEFT JOIN ghl_appointments', calc: 'COUNT(vip_attendees WHERE no booking found)' },
    { label: 'Wasted Ad Spend', value: d.wasted_spend || 0, format: 'money', invertCost: true, source: 'BQ meta_ads JOIN hyros_leads geo view', calc: 'SUM(spend WHERE state IN dead_zones)' },
    { label: 'Refund Total', value: d.refund_total || 0, format: 'money', invertCost: true, source: 'BQ stripe_charges', calc: 'SUM(amount WHERE status = refunded)' },
  ]);

  // ---- Hero: Revenue Leak Waterfall (full width) ----
  const waterfallCard = _leakCard('Revenue Leak Waterfall');
  waterfallCard.style.marginTop = '16px';
  const waterfallDiv = document.createElement('div');
  waterfallDiv.id = 'leaks-waterfall';
  waterfallDiv.style.height = '340px';
  waterfallCard.appendChild(waterfallDiv);
  container.appendChild(waterfallCard);

  requestAnimationFrame(() => {
    _renderLeakWaterfall(waterfallDiv, d);
  });

  // ---- 5 Leak Detail Cards (2-column grid) ----
  const detailGrid = document.createElement('div');
  detailGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(detailGrid);

  // 1. No-Show Crisis
  const noShowCard = _leakCard('No-Show Crisis');
  noShowCard.innerHTML += `
    <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px">
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">No-Shows</div>
        <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.danger}">${Theme.num(d.no_show_count || 0)}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">Leaked Revenue</div>
        <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.danger}">${Theme.money(d.no_show_cost || 0)}</div>
      </div>
    </div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">Each no-show costs $877 in missed opportunity</div>
  `;
  detailGrid.appendChild(noShowCard);

  // 2. VIP Non-Bookers
  const vipNonBookerCard = _leakCard('VIP Non-Bookers');
  const vnbCount = d.vip_non_booker_count || 0;
  // Estimate: 30% booking rate * 40% close rate * $10,000 avg deal
  const vnbPotential = Math.round(vnbCount * 0.30 * 0.40 * 10000);
  vipNonBookerCard.innerHTML += `
    <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px">
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">VIP Attendees Not Booked</div>
        <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.warning}">${Theme.num(vnbCount)}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">Revenue Potential</div>
        <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.warning}">${Theme.money(vnbPotential)}</div>
      </div>
    </div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">Est. 30% booking rate x 40% close x $10K avg deal</div>
  `;
  detailGrid.appendChild(vipNonBookerCard);

  // 3. Wasted Ad Spend
  const wastedCard = _leakCard('Wasted Ad Spend');
  const wastedSpend = d.wasted_spend || 0;
  wastedCard.innerHTML += `
    <div style="margin-top:8px">
      <div class="text-muted" style="font-size:12px;margin-bottom:4px">Zero-Conversion Campaign Spend</div>
      <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.danger}">${Theme.money(wastedSpend)}</div>
    </div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">Ad spend on campaigns that generated zero conversions</div>
  `;
  detailGrid.appendChild(wastedCard);

  // 4. Refunds
  const refundCard = _leakCard('Refunds');
  const refundTotal = d.refund_total || 0;
  refundCard.innerHTML += `
    <div style="margin-top:8px">
      <div class="text-muted" style="font-size:12px;margin-bottom:4px">Total Refunded</div>
      <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.danger}">${Theme.money(refundTotal)}</div>
    </div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">Revenue returned to customers via Stripe refunds</div>
  `;
  detailGrid.appendChild(refundCard);

  // 5. Booking Gap
  const showed = d.showed_count || 0;
  const booked = d.booked_count || 0;
  const bookingGap = Math.max(0, showed - booked);
  const bookingGapPct = showed > 0 ? ((bookingGap / showed) * 100).toFixed(1) : 0;
  const bookingGapCard = _leakCard('Booking Gap');
  bookingGapCard.innerHTML += `
    <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px">
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">Showed But Not Booked</div>
        <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.warning}">${Theme.num(bookingGap)}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">Gap Rate</div>
        <div style="font-size:36px;font-weight:700;color:${Theme.COLORS.warning}">${bookingGapPct}%</div>
      </div>
    </div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">${Theme.num(showed)} attended, only ${Theme.num(booked)} booked a call</div>
  `;
  detailGrid.appendChild(bookingGapCard);

  // ---- Per-100 Dropout Visualization ----
  const funnelCard = _leakCard('Per-100 Dropout Analysis');
  funnelCard.style.marginTop = '16px';
  funnelCard.appendChild(_renderDropoutFunnel(d));
  container.appendChild(funnelCard);

  // ---- Responsive stack ----
  const mq = window.matchMedia('(max-width: 768px)');
  function handleMobile(e) {
    detailGrid.style.gridTemplateColumns = e.matches ? '1fr' : '1fr 1fr';
  }
  handleMobile(mq);
  mq.addEventListener('change', handleMobile);
});

// ---- Helpers ----

function _leakCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '16px 20px';
  if (title) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';margin-bottom:4px';
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}

function _renderLeakWaterfall(el, d) {
  if (typeof Plotly === 'undefined') return;

  const noShowCost = d.no_show_cost || 0;
  const wastedSpend = d.wasted_spend || 0;
  const refundTotal = d.refund_total || 0;
  const totalLeaked = d.total_leaked || 0;

  const trace = {
    type: 'waterfall',
    orientation: 'v',
    x: ['No-Shows', 'Wasted Ad Spend', 'Refunds', 'Total Leaked'],
    y: [noShowCost, wastedSpend, refundTotal, totalLeaked],
    measure: ['relative', 'relative', 'relative', 'total'],
    connector: { line: { color: Theme.COLORS.border, width: 1 } },
    increasing: { marker: { color: Theme.COLORS.danger } },
    decreasing: { marker: { color: Theme.COLORS.danger } },
    totals: { marker: { color: Theme.FUNNEL.orange } },
    textposition: 'outside',
    text: [
      Theme.money(noShowCost),
      Theme.money(wastedSpend),
      Theme.money(refundTotal),
      Theme.money(totalLeaked),
    ],
    textfont: { color: Theme.COLORS.textSecondary, size: 11 },
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 30, r: 20, b: 50, l: 80 },
    showlegend: false,
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      tickformat: '$,.0f',
    },
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderDropoutFunnel(d) {
  const tickets = d.tickets_total || 0;
  const showed = d.showed_count || 0;
  const booked = d.booked_count || 0;
  const enrolled = d.enrolled_count || 0;

  // Normalize to per-100
  const base = tickets || 1;
  const per100 = (n) => Math.round((n / base) * 100);

  const p100Tickets = 100;
  const p100Showed = per100(showed);
  const p100Booked = per100(booked);
  const p100Enrolled = per100(enrolled);

  const dropShowRate = p100Tickets - p100Showed;
  const dropBookRate = p100Showed - p100Booked;
  const dropEnrollRate = p100Booked - p100Enrolled;

  const stages = [
    { label: 'Tickets', value: p100Tickets, color: Theme.FUNNEL.blue },
    { label: 'Showed', value: p100Showed, color: Theme.FUNNEL.teal },
    { label: 'Booked', value: p100Booked, color: Theme.FUNNEL.yellow },
    { label: 'Enrolled', value: p100Enrolled, color: Theme.FUNNEL.green },
  ];

  const dropouts = [dropShowRate, dropBookRate, dropEnrollRate];

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-top:16px;overflow-x:auto';

  const flow = document.createElement('div');
  flow.style.cssText = 'display:flex;align-items:center;gap:0;min-width:480px;padding:8px 0';
  wrapper.appendChild(flow);

  stages.forEach((stage, i) => {
    // Stage block
    const block = document.createElement('div');
    block.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;justify-content:center',
      'border-radius:8px;padding:12px 16px;min-width:90px',
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
      connector.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:60px';

      const arrow = document.createElement('div');
      arrow.style.cssText = [
        'width:100%;height:2px;background:' + Theme.COLORS.border,
        'position:relative;display:flex;align-items:center;justify-content:center',
      ].join(';');

      const arrowHead = document.createElement('div');
      arrowHead.style.cssText = [
        'position:absolute;right:-1px',
        'border-top:5px solid transparent',
        'border-bottom:5px solid transparent',
        'border-left:7px solid ' + Theme.COLORS.border,
      ].join(';');
      arrow.appendChild(arrowHead);

      const dropout = document.createElement('div');
      dropout.style.cssText = 'margin-top:6px;text-align:center';

      const dropVal = document.createElement('div');
      dropVal.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.danger;
      dropVal.textContent = '-' + dropouts[i];

      const dropLabel = document.createElement('div');
      dropLabel.style.cssText = 'font-size:10px;color:' + Theme.COLORS.textMuted;
      dropLabel.textContent = 'drop';

      dropout.appendChild(dropVal);
      dropout.appendChild(dropLabel);

      connector.appendChild(arrow);
      connector.appendChild(dropout);
      flow.appendChild(connector);
    }
  });

  const legend = document.createElement('div');
  legend.style.cssText = 'margin-top:12px;font-size:11px;color:' + Theme.COLORS.textMuted + ';text-align:center';
  legend.textContent = 'Out of every 100 ticket buyers. Actuals: ' + tickets + ' tickets / ' + showed + ' showed / ' + booked + ' booked / ' + enrolled + ' enrolled';
  wrapper.appendChild(legend);

  return wrapper;
}
