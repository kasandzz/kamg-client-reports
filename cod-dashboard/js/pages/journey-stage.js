/* ============================================================
   Journey Stage -- config-driven template for all 12 stages
   Registered as stage-1 through stage-12.
   Each stage renders header, chart, nav based on STAGE_CONFIG.
   ============================================================ */

const STAGE_CONFIG = {
  1:  { title: 'Ad Exposure',    color: '#4F9CF9', icon: '&#128226;', chartType: 'table',  columns: ['Campaign', 'Spend', 'Impressions', 'Clicks', 'CTR'],   fields: ['campaign_name', 'spend', 'impressions', 'clicks', 'ctr'] },
  2:  { title: 'Landing Page',   color: '#6E56CF', icon: '&#128187;', chartType: 'table',  columns: ['Page', 'Views', 'Visitors'],                           fields: ['page', 'views', 'visitors'] },
  3:  { title: 'Ticket Purchase',color: '#3b82f6', icon: '&#127903;', chartType: 'bar',    xField: 'day',    yField: 'tickets',    yLabel: 'Tickets' },
  4:  { title: 'Workshop',       color: '#06b6d4', icon: '&#127916;', chartType: 'line',   xField: 'week',   yField: 'show_rate',  yLabel: 'Show Rate %' },
  5:  { title: 'VIP Upsell',     color: '#14b8a6', icon: '&#11088;',  chartType: 'gauge',  valueField: 'vip_rate', label: 'VIP Take Rate' },
  6:  { title: 'Call Booking',   color: '#22c55e', icon: '&#128222;', chartType: 'bar',    xField: 'day',    yField: 'bookings',   yLabel: 'Bookings' },
  7:  { title: 'Sales Call',     color: '#84cc16', icon: '&#129309;', chartType: 'hbar',   labelField: 'closer', valueField: 'close_rate', valueLabel: 'Close Rate %' },
  8:  { title: 'Enrollment',     color: '#eab308', icon: '&#127891;', chartType: 'bar',    xField: 'month',  yField: 'enrollments', yLabel: 'Enrollments' },
  9:  { title: 'Onboarding',     color: '#f97316', icon: '&#128203;', chartType: 'none' },
  10: { title: 'Lions Pride',          color: '#ef4444', icon: '&#129409;', chartType: 'none' },
  11: { title: 'Millionaires Alliance', color: '#ec4899', icon: '&#128081;', chartType: 'none' },
  12: { title: 'Advocacy',       color: '#a855f7', icon: '&#128227;', chartType: 'none' },
};

// ---- Format helpers ----
function _fmtCell(key, value, stageNum) {
  if (value === null || value === undefined) return '—';
  const v = parseFloat(value);
  if (key === 'spend' || key === 'revenue') return Theme.money(v);
  if (key === 'ctr' || key === 'close_rate' || key === 'vip_rate' || key === 'show_rate') return Theme.pct(v);
  if (!isNaN(v) && Number.isInteger(v)) return Theme.num(v);
  if (!isNaN(v)) return v.toFixed(2);
  return String(value);
}

// ---- Shared card builder ----
function _card(title, marginTop) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = `padding:20px; margin-top:${marginTop !== undefined ? marginTop : 16}px;`;
  if (title) {
    const h = document.createElement('h3');
    h.className = 'card-title';
    h.style.cssText = 'margin:0 0 16px; font-size:14px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.05em;';
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}

// ---- No-data card for stages 9-12 ----
function _renderNoDataCard(container, cfg) {
  const card = _card(null, 16);
  card.style.cssText += 'border-left:3px solid ' + cfg.color + ';';
  card.innerHTML = `
    <div style="display:flex; align-items:flex-start; gap:14px;">
      <span style="font-size:28px; flex-shrink:0;">${cfg.icon}</span>
      <div>
        <p style="margin:0 0 8px; font-size:15px; font-weight:600; color:var(--text-primary, #e2e8f0);">Data collection not yet active</p>
        <p style="margin:0; font-size:13px; color:var(--text-secondary, #94a3b8); line-height:1.6;">
          This stage is tracked conceptually but data collection is not yet active.
          Planned data sources will be connected in future phases.
        </p>
        <div style="display:inline-flex; align-items:center; gap:6px; margin-top:12px; padding:4px 10px; border-radius:999px; background:rgba(234,179,8,0.1); border:1px solid rgba(234,179,8,0.3);">
          <span style="color:#eab308; font-size:12px;">&#9888;</span>
          <span style="font-size:11px; font-weight:600; color:#eab308; text-transform:uppercase; letter-spacing:.06em;">Tracking Gap</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(card);
}

// ---- Register all 12 stages ----
for (let s = 1; s <= 12; s++) {
  (function (stageNum) {
    App.registerPage('stage-' + stageNum, async (container) => {
      const cfg = STAGE_CONFIG[stageNum];
      const days = Filters.getDays();

      container.innerHTML = '';

      // ---- Stage header ----
      const header = document.createElement('div');
      header.style.cssText = 'display:flex; align-items:center; gap:16px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border, rgba(255,255,255,0.08));';
      header.innerHTML = `
        <div style="width:4px; height:48px; border-radius:2px; background:${cfg.color}; flex-shrink:0;"></div>
        <span style="font-size:28px; line-height:1;">${cfg.icon}</span>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:var(--text-muted, #64748b); padding:2px 8px; border-radius:999px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);">Stage ${stageNum} of 12</span>
          </div>
          <h2 style="margin:4px 0 0; font-size:22px; font-weight:700; color:var(--text-primary, #e2e8f0);">${cfg.title}</h2>
        </div>
        <a href="#" onclick="App.navigate('journey-explorer'); return false;" style="font-size:12px; color:var(--text-secondary, #94a3b8); text-decoration:none; white-space:nowrap; padding:6px 12px; border:1px solid rgba(255,255,255,0.1); border-radius:6px; hover:color:#fff;">
          &#8592; Journey Explorer
        </a>
      `;
      container.appendChild(header);

      // ---- Stages 9-12: no data ----
      if (cfg.chartType === 'none') {
        _renderNoDataCard(container, cfg);
        _renderStageNav(container, stageNum);
        return;
      }

      // ---- Fetch data ----
      let rows;
      try {
        rows = await API.query('journey-stage', 'default', { days, stage: stageNum });
      } catch (err) {
        container.innerHTML += `<div class="card" style="padding:24px"><p class="text-muted">Failed to load stage ${stageNum}: ${err.message}</p></div>`;
        _renderStageNav(container, stageNum);
        return;
      }

      if (!rows || rows.length === 0 || (rows[0] && rows[0].status === 'no_data')) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = `<span class="empty-state-icon">&#9888;</span><p>No data for the selected period</p>`;
        container.appendChild(empty);
        _renderStageNav(container, stageNum);
        return;
      }

      // ---- Render by chartType ----
      if (cfg.chartType === 'table') {
        _renderTable(container, cfg, rows);
      } else if (cfg.chartType === 'bar') {
        _renderBarChart(container, cfg, rows, stageNum);
      } else if (cfg.chartType === 'line') {
        _renderLineChart(container, cfg, rows, stageNum);
      } else if (cfg.chartType === 'gauge') {
        _renderGauge(container, cfg, rows, stageNum);
      } else if (cfg.chartType === 'hbar') {
        _renderHBar(container, cfg, rows, stageNum);
      }

      _renderStageNav(container, stageNum);
    });
  })(s);
}

// ---- Table renderer ----
function _renderTable(container, cfg, rows) {
  const card = _card(cfg.title + ' — Top Results', 0);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%; border-collapse:collapse; font-size:13px;';

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  cfg.columns.forEach(col => {
    const th = document.createElement('th');
    th.style.cssText = 'text-align:left; padding:8px 12px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--text-secondary, #94a3b8); border-bottom:1px solid var(--border, rgba(255,255,255,0.08)); white-space:nowrap;';
    th.textContent = col;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.style.cssText = i % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02);';
    cfg.fields.forEach(field => {
      const td = document.createElement('td');
      td.style.cssText = 'padding:9px 12px; color:var(--text-primary, #e2e8f0); border-bottom:1px solid var(--border, rgba(255,255,255,0.05)); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
      td.textContent = _fmtCell(field, row[field]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(table);
  container.appendChild(card);
}

// ---- Bar chart renderer ----
function _renderBarChart(container, cfg, rows, stageNum) {
  const card = _card(cfg.title + ' — ' + cfg.yLabel, 0);
  const canvas = document.createElement('canvas');
  canvas.id = 'stage-chart-' + stageNum;
  card.appendChild(canvas);
  container.appendChild(card);

  requestAnimationFrame(() => {
    const labels = rows.map(r => r[cfg.xField] || '');
    const data = rows.map(r => parseFloat(r[cfg.yField]) || 0);

    Theme.createChart('stage-chart-' + stageNum, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: cfg.yLabel,
          data,
          backgroundColor: cfg.color + 'cc',
          borderColor: cfg.color,
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${cfg.yLabel}: ${Theme.num(ctx.parsed.y)}` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => Theme.num(v) } }
        }
      }
    });
  });
}

// ---- Line chart renderer ----
function _renderLineChart(container, cfg, rows, stageNum) {
  const card = _card(cfg.title + ' — ' + cfg.yLabel, 0);
  const canvas = document.createElement('canvas');
  canvas.id = 'stage-chart-' + stageNum;
  card.appendChild(canvas);
  container.appendChild(card);

  requestAnimationFrame(() => {
    const labels = rows.map(r => r[cfg.xField] || '');
    const data = rows.map(r => Math.min(parseFloat(r[cfg.yField]) || 0, 100));

    Theme.createChart('stage-chart-' + stageNum, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: cfg.yLabel,
          data,
          borderColor: cfg.color,
          backgroundColor: cfg.color + '22',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${cfg.yLabel}: ${Theme.pct(ctx.parsed.y)}` } }
        },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } }
        }
      }
    });
  });
}

// ---- Gauge renderer (Plotly) ----
function _renderGauge(container, cfg, rows, stageNum) {
  const card = _card(cfg.title + ' — ' + cfg.label, 0);
  const div = document.createElement('div');
  div.id = 'stage-chart-' + stageNum;
  div.style.minHeight = '260px';
  card.appendChild(div);
  container.appendChild(card);

  const row = Array.isArray(rows) ? rows[0] : rows;
  const val = parseFloat(row ? row[cfg.valueField] : 0) || 0;

  requestAnimationFrame(() => {
    if (typeof Plotly === 'undefined') return;
    Plotly.newPlot('stage-chart-' + stageNum, [{
      type: 'indicator',
      mode: 'gauge+number',
      value: Math.min(val, 100),
      number: { suffix: '%', font: { size: 36, color: Theme.COLORS.textPrimary || '#e2e8f0' } },
      title: { text: cfg.label, font: { size: 14, color: Theme.COLORS.textSecondary || '#94a3b8' } },
      gauge: {
        axis: { range: [0, 100], tickcolor: Theme.COLORS.textSecondary || '#94a3b8' },
        bar: { color: cfg.color },
        bgcolor: 'rgba(255,255,255,0.04)',
        bordercolor: 'rgba(255,255,255,0.08)',
        steps: [
          { range: [0, 33],  color: 'rgba(239,68,68,0.15)' },
          { range: [33, 66], color: 'rgba(234,179,8,0.15)' },
          { range: [66, 100],color: 'rgba(34,197,94,0.15)' },
        ]
      }
    }], {
      ...Theme.PLOTLY_LAYOUT,
      margin: { t: 40, r: 30, b: 20, l: 30 },
    }, Theme.PLOTLY_CONFIG);
  });
}

// ---- Horizontal bar renderer (Plotly) ----
function _renderHBar(container, cfg, rows, stageNum) {
  const card = _card(cfg.title + ' — ' + cfg.valueLabel, 0);
  const div = document.createElement('div');
  div.id = 'stage-chart-' + stageNum;
  div.style.minHeight = Math.max(200, rows.length * 44) + 'px';
  card.appendChild(div);
  container.appendChild(card);

  requestAnimationFrame(() => {
    if (typeof Plotly === 'undefined') return;
    const labels = rows.map(r => r[cfg.labelField] || 'Unknown');
    const values = rows.map(r => parseFloat(r[cfg.valueField]) || 0);

    Plotly.newPlot('stage-chart-' + stageNum, [{
      type: 'bar',
      orientation: 'h',
      y: labels,
      x: values,
      marker: { color: cfg.color + 'cc', line: { color: cfg.color, width: 1 } },
      text: values.map(v => Theme.pct(v)),
      textposition: 'outside',
      hovertemplate: '%{y}: %{text}<extra></extra>',
    }], {
      ...Theme.PLOTLY_LAYOUT,
      xaxis: { ...Theme.PLOTLY_LAYOUT.xaxis, ticksuffix: '%', range: [0, Math.max(...values) * 1.2] },
      yaxis: { ...Theme.PLOTLY_LAYOUT.yaxis, autorange: 'reversed' },
      margin: { t: 20, r: 80, b: 40, l: 120 },
      showlegend: false,
    }, Theme.PLOTLY_CONFIG);
  });
}

// ---- Prev / Next stage navigation ----
function _renderStageNav(container, stageNum) {
  const nav = document.createElement('div');
  nav.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:24px; gap:12px;';

  const prevBtn = document.createElement('button');
  if (stageNum > 1) {
    const prevCfg = STAGE_CONFIG[stageNum - 1];
    prevBtn.className = 'btn btn-secondary';
    prevBtn.style.cssText = 'padding:8px 16px; font-size:13px; cursor:pointer;';
    prevBtn.innerHTML = `&#8592; Stage ${stageNum - 1}: ${prevCfg.title}`;
    prevBtn.addEventListener('click', () => App.navigate('stage-' + (stageNum - 1)));
  } else {
    prevBtn.style.cssText = 'visibility:hidden;';
  }

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-ghost';
  backBtn.style.cssText = 'padding:8px 16px; font-size:13px; cursor:pointer;';
  backBtn.innerHTML = '&#128506; Journey Explorer';
  backBtn.addEventListener('click', () => App.navigate('journey-explorer'));

  const nextBtn = document.createElement('button');
  if (stageNum < 12) {
    const nextCfg = STAGE_CONFIG[stageNum + 1];
    nextBtn.className = 'btn btn-secondary';
    nextBtn.style.cssText = 'padding:8px 16px; font-size:13px; cursor:pointer;';
    nextBtn.innerHTML = `Stage ${stageNum + 1}: ${nextCfg.title} &#8594;`;
    nextBtn.addEventListener('click', () => App.navigate('stage-' + (stageNum + 1)));
  } else {
    nextBtn.style.cssText = 'visibility:hidden;';
  }

  nav.appendChild(prevBtn);
  nav.appendChild(backBtn);
  nav.appendChild(nextBtn);
  container.appendChild(nav);
}
