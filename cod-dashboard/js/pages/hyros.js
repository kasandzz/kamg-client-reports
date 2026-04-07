/* ============================================
   Hyros -- attribution intelligence
   Attributed sales/revenue, lead tracking, match rate
   ============================================ */

App.registerPage('hyros', async (container) => {
  const days = Filters.getDays();

  let kpiData, sourcesData, dailyData;

  try {
    [kpiData, sourcesData, dailyData] = await Promise.all([
      API.query('hyros', 'default', { days }),
      API.query('hyros', 'sources', { days }),
      API.query('hyros', 'daily',   { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Hyros: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  const k           = (kpiData && kpiData.length > 0) ? kpiData[0] : {};
  const totalSales  = k.total_sales    || 0;
  const totalRev    = k.total_revenue  || 0;
  const avgRev      = k.avg_revenue    || 0;
  const totalLeads  = k.total_leads    || 0;
  const uniqueLeads = k.unique_leads   || 0;
  const matchRate   = k.lead_match_rate != null ? k.lead_match_rate : 0;

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Attributed Sales',   value: totalSales,  format: 'num'   },
    { label: 'Attributed Revenue', value: totalRev,    format: 'money' },
    { label: 'Avg Sale Value',     value: avgRev,      format: 'money' },
    { label: 'Leads Tracked',      value: totalLeads,  format: 'num'   },
    { label: 'Unique Leads',       value: uniqueLeads, format: 'num'   },
    { label: 'Lead Match Rate',    value: matchRate,   format: 'pct'   },
  ]);

  // ---- 2-column chart grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(grid);

  // -- Chart 1: Purchase Source Table --
  const sourceCard = document.createElement('div');
  sourceCard.className = 'card';
  sourceCard.style.cssText = 'padding:20px';
  sourceCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Purchase Sources</div>
  `;

  const sourceRows = sourcesData || [];
  const maxRevenue = sourceRows.reduce((m, r) => Math.max(m, r.revenue || 0), 1);

  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = 'overflow-x:auto';

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:500;border-bottom:1px solid rgba(255,255,255,0.07)">Source</th>
        <th style="text-align:right;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:500;border-bottom:1px solid rgba(255,255,255,0.07)">Sales</th>
        <th style="text-align:right;padding:6px 8px;color:${Theme.COLORS.textMuted};font-weight:500;border-bottom:1px solid rgba(255,255,255,0.07)">Revenue</th>
      </tr>
    </thead>
    <tbody id="hyros-source-tbody"></tbody>
  `;
  tableWrap.appendChild(table);
  sourceCard.appendChild(tableWrap);
  grid.appendChild(sourceCard);

  const tbody = table.querySelector('#hyros-source-tbody');
  if (sourceRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:${Theme.COLORS.textMuted}">No source data</td></tr>`;
  } else {
    sourceRows.forEach((r, i) => {
      const rev     = r.revenue || 0;
      const pct     = Math.round((rev / maxRevenue) * 100);
      const barColor = i === 0 ? Theme.FUNNEL.blue : `rgba(108,92,231,${0.7 - i * 0.06})`;
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid rgba(255,255,255,0.04);transition:background .15s`;
      tr.onmouseenter = () => tr.style.background = 'rgba(255,255,255,0.03)';
      tr.onmouseleave = () => tr.style.background = '';
      tr.innerHTML = `
        <td style="padding:8px 8px;color:${Theme.COLORS.textPrimary}">${r.source}</td>
        <td style="padding:8px 8px;text-align:right;color:${Theme.COLORS.textSecondary}">${Theme.num(r.sales || 0)}</td>
        <td style="padding:8px 8px;text-align:right">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
            <div style="width:60px;height:6px;border-radius:3px;background:rgba(255,255,255,0.06);overflow:hidden">
              <div style="width:${pct}%;height:100%;border-radius:3px;background:${barColor}"></div>
            </div>
            <span style="color:${Theme.COLORS.success};font-weight:500;min-width:60px;text-align:right">${Theme.money(rev)}</span>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // -- Chart 2: Daily Attribution (bar + line dual-axis) --
  const dailyCard = document.createElement('div');
  dailyCard.className = 'card';
  dailyCard.style.cssText = 'padding:20px';
  dailyCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Daily Attribution</div>`;

  const dailyCanvasId = 'hyros-daily-chart';
  const dailyCanvas   = document.createElement('canvas');
  dailyCanvas.id      = dailyCanvasId;
  dailyCanvas.style.height = '300px';
  dailyCard.appendChild(dailyCanvas);
  grid.appendChild(dailyCard);

  const dailyRows   = dailyData || [];
  const dayLabels   = dailyRows.map(r => r.day ? String(r.day).slice(0, 10) : '');
  const daySales    = dailyRows.map(r => r.sales   || 0);
  const dayRevenue  = dailyRows.map(r => r.revenue || 0);

  Theme.createChart(dailyCanvasId, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [
        {
          label:           'Sales',
          data:            daySales,
          backgroundColor: Theme.FUNNEL.blue,
          order:           2,
          yAxisID:         'y',
        },
        {
          label:           'Revenue',
          data:            dayRevenue,
          type:            'line',
          borderColor:     Theme.FUNNEL.green,
          backgroundColor: 'transparent',
          borderWidth:     2,
          pointRadius:     2,
          tension:         0.3,
          order:           1,
          yAxisID:         'y2',
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:  { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.dataset.yAxisID === 'y2'
              ? `${ctx.dataset.label}: ${Theme.money(ctx.parsed.y)}`
              : `${ctx.dataset.label}: ${Theme.num(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          position: 'left',
          ticks: { color: Theme.COLORS.textMuted, font: { size: 10 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Sales', color: Theme.COLORS.textMuted, font: { size: 10 } },
        },
        y2: {
          position: 'right',
          ticks: {
            color:    Theme.COLORS.textMuted,
            font:     { size: 10 },
            callback: (v) => Theme.money(v),
          },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Revenue', color: Theme.COLORS.textMuted, font: { size: 10 } },
        },
      },
    },
  });

  // ---- Row 2: Discrepancy Card + Lead Match Gauge ----
  const row2 = document.createElement('div');
  row2.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';
  container.appendChild(row2);

  // -- Hyros vs Meta Discrepancy Card --
  const discCard = document.createElement('div');
  discCard.className = 'card';
  discCard.style.cssText = 'padding:20px';
  discCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Hyros vs Meta Discrepancy</div>
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">
      <div style="width:40px;height:40px;border-radius:8px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px">&#128269;</div>
      <div>
        <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Attribution Scope Gap</div>
        <p style="font-size:13px;color:${Theme.COLORS.textMuted};line-height:1.6;margin:0">
          Hyros tracks $27 ticket attribution (not high-ticket enrollments).
          Cross-platform discrepancy analysis requires linking Hyros lead emails
          to Stripe enrollment transactions.
        </p>
      </div>
    </div>
    <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:6px">
      <span style="color:${Theme.COLORS.warning};font-size:14px">&#9888;</span>
      <span style="font-size:12px;color:${Theme.COLORS.warning};font-weight:600">Data Gap</span>
      <span style="font-size:12px;color:${Theme.COLORS.textMuted}">Email-based attribution linkage is in progress</span>
    </div>
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Hyros Tracks</div>
        <div style="font-size:13px;color:${Theme.COLORS.textPrimary};font-weight:500">$27 Workshop Tickets</div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:2px">Ad click to purchase</div>
      </div>
      <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.06)">
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Missing Link</div>
        <div style="font-size:13px;color:${Theme.COLORS.warning};font-weight:500">High-Ticket Enrollments</div>
        <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:2px">Requires email-based join</div>
      </div>
    </div>
  `;
  row2.appendChild(discCard);

  // -- Lead Match Rate Gauge (Plotly) --
  const gaugeCard = document.createElement('div');
  gaugeCard.className = 'card';
  gaugeCard.style.cssText = 'padding:20px';
  gaugeCard.innerHTML = `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">Lead Match Rate</div>`;

  const gaugeId  = 'hyros-match-gauge';
  const gaugeDiv = document.createElement('div');
  gaugeDiv.id    = gaugeId;
  gaugeDiv.style.height = '260px';
  gaugeCard.appendChild(gaugeDiv);

  const gaugeNote = document.createElement('div');
  gaugeNote.style.cssText = `margin-top:8px;font-size:12px;color:${Theme.COLORS.textMuted};text-align:center`;
  gaugeNote.textContent = 'Hyros leads matched to GHL contacts by email. Target: >80%.';
  gaugeCard.appendChild(gaugeNote);
  row2.appendChild(gaugeCard);

  const gaugeVal = Math.min(Math.max(matchRate, 0), 100);

  Plotly.newPlot(
    gaugeId,
    [
      {
        type:  'indicator',
        mode:  'gauge+number',
        value: gaugeVal,
        number: { suffix: '%', font: { size: 28, color: Theme.COLORS.textPrimary } },
        gauge: {
          axis: {
            range:     [0, 100],
            tickcolor: Theme.COLORS.textMuted,
            tickfont:  { size: 10, color: Theme.COLORS.textMuted },
            tickvals:  [0, 25, 50, 75, 100],
          },
          bar:         { color: gaugeVal >= 80 ? Theme.FUNNEL.green : gaugeVal >= 50 ? Theme.COLORS.warning : '#ef4444', thickness: 0.25 },
          bgcolor:     'transparent',
          borderwidth: 0,
          steps: [
            { range: [0, 50],  color: 'rgba(239,68,68,0.15)'  },
            { range: [50, 80], color: 'rgba(234,179,8,0.15)'  },
            { range: [80, 100],color: 'rgba(34,197,94,0.15)'  },
          ],
          threshold: {
            line:      { color: Theme.FUNNEL.green, width: 2 },
            thickness: 0.75,
            value:     80,
          },
        },
      },
    ],
    {
      ...Theme.PLOTLY_LAYOUT,
      margin: { t: 20, b: 20, l: 30, r: 30 },
    },
    Theme.PLOTLY_CONFIG
  );

  // ---- Row 3: Example Reports ----
  const reportsCard = document.createElement('div');
  reportsCard.className = 'card';
  reportsCard.style.cssText = 'padding:20px;margin-top:16px';
  reportsCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px">Example Reports</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <a href="https://kasandzz.github.io/kamg-client-reports/cod/hyros-7day-performance-2026-04-06.html" target="_blank" rel="noopener"
         style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;text-decoration:none;transition:border-color .15s,background .15s"
         onmouseenter="this.style.borderColor='rgba(108,92,231,0.4)';this.style.background='rgba(108,92,231,0.06)'"
         onmouseleave="this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.03)'">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(108,92,231,0.15);border:1px solid rgba(108,92,231,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px">&#128202;</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary}">7-Day Hyros Performance Report</div>
          <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">Segment breakdown, source attribution, daily trends, revenue by tag -- Apr 6 2026</div>
        </div>
        <div style="font-size:12px;color:${Theme.COLORS.textMuted};flex-shrink:0">&#8599;</div>
      </a>
    </div>
  `;
  container.appendChild(reportsCard);
});
