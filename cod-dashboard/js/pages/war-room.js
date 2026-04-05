/* ============================================
   War Room -- CEO 5-second pulse page
   KPI strip, revenue waterfall, funnel gauge,
   team zone, biggest lever callout
   ============================================ */

App.registerPage('war-room', async (container) => {
  const days = Filters.getDays();
  let data;

  try {
    data = await API.query('war-room', 'default', { days });
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load War Room: ${err.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#128203;</span><p>No data for the selected period</p></div>`;
    return;
  }

  const d = Array.isArray(data) ? data[0] : data;
  container.innerHTML = '';

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  const funnelHealth = _computeFunnelHealth(d);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Revenue (Collected)', value: d.gross_revenue || 0, format: 'money' },
    { label: 'ROAS', value: d.roas || 0, format: 'num' },
    { label: 'Enrollments', value: d.enrollments || 0, format: 'num' },
    { label: 'Cost Per Enrollment', value: d.cost_per_enrollment || 0, format: 'money', invertCost: true },
    { label: 'Funnel Health Score', value: funnelHealth, format: 'num' },
    { label: 'Net Revenue', value: d.net_revenue || 0, format: 'money' },
  ]);

  // ---- Charts Row ----
  const chartsRow = document.createElement('div');
  chartsRow.className = 'grid-2';
  chartsRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(chartsRow);

  // Revenue Waterfall
  const waterfallCard = _card('Revenue Waterfall');
  const waterfallDiv = document.createElement('div');
  waterfallDiv.id = 'war-room-waterfall';
  waterfallDiv.style.height = '320px';
  waterfallCard.appendChild(waterfallDiv);
  chartsRow.appendChild(waterfallCard);

  // Funnel Health Gauge
  const gaugeCard = _card('Funnel Health');
  const gaugeDiv = document.createElement('div');
  gaugeDiv.id = 'war-room-gauge';
  gaugeDiv.style.height = '320px';
  gaugeCard.appendChild(gaugeDiv);
  chartsRow.appendChild(gaugeCard);

  // Render Plotly charts after DOM insert
  requestAnimationFrame(() => {
    _renderWaterfall(waterfallDiv, d);
    _renderGauge(gaugeDiv, funnelHealth);
  });

  // ---- Team Zone ----
  const teamRow = document.createElement('div');
  teamRow.style.cssText = 'margin-top:16px';
  container.appendChild(teamRow);

  const noShows = d.no_shows || 0;
  const noShowCost = noShows * 877;

  const wasteCard = _card('Waste Monitor');
  wasteCard.innerHTML += `
    <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px">
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">No-Show Cost</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.danger}">${Theme.money(noShowCost)}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:12px;margin-bottom:4px">No-Shows</div>
        <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.textPrimary}">${noShows}</div>
      </div>
    </div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">Estimated at $877 per missed call opportunity</div>
  `;
  teamRow.appendChild(wasteCard);

  // ---- Biggest Lever Callout ----
  const leverText = _computeBiggestLever(d);
  const leverCard = document.createElement('div');
  leverCard.className = 'card';
  leverCard.style.cssText = 'margin-top:16px;padding:20px 24px;border:2px solid transparent;border-image:linear-gradient(135deg, ' + Theme.COLORS.accent + ', ' + Theme.COLORS.accentLight + ') 1;position:relative;overflow:hidden';
  leverCard.innerHTML = `
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${Theme.COLORS.accentLight};margin-bottom:8px;font-weight:600">Biggest Lever</div>
    <div style="font-size:15px;line-height:1.5;color:${Theme.COLORS.textPrimary}">${leverText}</div>
  `;
  container.appendChild(leverCard);

  // ---- Responsive: stack charts on mobile ----
  const mq = window.matchMedia('(max-width: 768px)');
  function handleMobile(e) {
    chartsRow.style.gridTemplateColumns = e.matches ? '1fr' : '1fr 1fr';
  }
  handleMobile(mq);
  mq.addEventListener('change', handleMobile);
});

// ---- Helpers ----

function _card(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '16px 20px';
  if (title) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';margin-bottom:12px';
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}

function _computeFunnelHealth(d) {
  const roasComponent = Math.min(((d.roas || 0) / 5) * 25, 25);
  const closeRate = d.close_rate || 0;
  const closeComponent = Math.min((closeRate / 25) * 25, 25);
  // Remaining 50 points: baseline 25+25 (show/booking rates need separate queries)
  const baseline = 50;
  const total = Math.min(Math.round(roasComponent + closeComponent + baseline), 100);
  return total;
}

function _computeBiggestLever(d) {
  const noShows = d.no_shows || 0;
  const noShowCost = noShows * 877;

  if (noShows > 20) {
    const savings = Math.round(noShowCost * 0.1);
    return `Fix no-show rate: ${noShows} no-shows cost ${Theme.money(noShowCost)}. A 10% improvement saves ${Theme.money(savings)}/period.`;
  }

  if ((d.roas || 0) < 3) {
    const roasVal = (d.roas || 0).toFixed(1);
    return `ROAS at ${roasVal}x (target: 3x). Focus on cutting worst-performing ad sets.`;
  }

  const closeRate = d.close_rate != null ? Theme.pct(d.close_rate) : 'N/A';
  return `Close rate at ${closeRate} -- equalizing closers could add significant revenue.`;
}

function _renderWaterfall(el, d) {
  if (typeof Plotly === 'undefined') return;

  const ticketRev = d.ticket_revenue || 0;
  const enrollmentRev = d.enrollment_revenue || 0;
  const vipRev = (d.gross_revenue || 0) - ticketRev - enrollmentRev;
  const refunds = d.refunds || 0;
  const netRev = d.net_revenue || 0;

  const trace = {
    type: 'waterfall',
    orientation: 'v',
    x: ['Tickets', 'VIP', 'Enrollments', 'Refunds', 'Net Revenue'],
    y: [ticketRev, vipRev > 0 ? vipRev : 0, enrollmentRev, -refunds, netRev],
    measure: ['relative', 'relative', 'relative', 'relative', 'total'],
    connector: { line: { color: Theme.COLORS.border, width: 1 } },
    increasing: { marker: { color: Theme.FUNNEL.green } },
    decreasing: { marker: { color: Theme.FUNNEL.red } },
    totals: { marker: { color: Theme.FUNNEL.blue } },
    textposition: 'outside',
    text: [
      Theme.money(ticketRev),
      Theme.money(vipRev > 0 ? vipRev : 0),
      Theme.money(enrollmentRev),
      refunds ? '-' + Theme.money(refunds) : '$0',
      Theme.money(netRev),
    ],
    textfont: { color: Theme.COLORS.textSecondary, size: 11 },
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 20, r: 20, b: 40, l: 60 },
    showlegend: false,
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      tickformat: '$,.0f',
    },
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderGauge(el, score) {
  if (typeof Plotly === 'undefined') return;

  const trace = {
    type: 'indicator',
    mode: 'gauge+number',
    value: score,
    number: {
      font: { size: 48, color: Theme.COLORS.textPrimary },
      suffix: '',
    },
    gauge: {
      axis: {
        range: [0, 100],
        tickwidth: 1,
        tickcolor: Theme.COLORS.textMuted,
        dtick: 20,
        tickfont: { color: Theme.COLORS.textMuted, size: 10 },
      },
      bar: { color: Theme.COLORS.accent, thickness: 0.3 },
      bgcolor: 'transparent',
      borderwidth: 0,
      steps: [
        { range: [0, 40], color: 'rgba(239,68,68,0.15)' },
        { range: [40, 70], color: 'rgba(234,179,8,0.15)' },
        { range: [70, 100], color: 'rgba(34,197,94,0.15)' },
      ],
      threshold: {
        line: { color: Theme.COLORS.textPrimary, width: 2 },
        thickness: 0.8,
        value: score,
      },
    },
  };

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 30, r: 30, b: 10, l: 30 },
    showlegend: false,
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}
