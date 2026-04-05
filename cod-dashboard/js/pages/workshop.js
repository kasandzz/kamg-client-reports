/* ============================================================
   Workshop -- COD show rate, VIP attendance, day-of-week
   KPI strip, Show Rate Trend, VIP vs Standard bar,
   Day-of-Week Heatmap, Nurture gap card
   ============================================================ */

App.registerPage('workshop', async (container) => {
  const days = Filters.getDays();
  let kpis, monthly, dayofweek;

  try {
    [kpis, monthly, dayofweek] = await Promise.all([
      API.query('workshop', 'default', { days }),
      API.query('workshop', 'monthly', { days: Math.max(days, 365) }),
      API.query('workshop', 'dayofweek', { days })
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Workshop: ${err.message}</p></div>`;
    return;
  }

  if (!kpis || kpis.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9888;</span><p>No data for the selected period</p></div>`;
    return;
  }

  const d = Array.isArray(kpis) ? kpis[0] : kpis;
  container.innerHTML = '';

  // ---- KPI Strip (6) ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  // Cap rates at 100
  const showRate = Math.min(parseFloat(d.show_rate) || 0, 100);
  const vipShowRate = Math.min(parseFloat(d.vip_show_rate) || 0, 100);
  const sameSessionBookingRate = Math.min(parseFloat(d.same_session_booking_rate) || 0, 100);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Show Rate',                   value: showRate,              format: 'pct' },
    { label: 'Total Attended',              value: d.attended || 0,       format: 'num' },
    { label: 'VIP Show Rate',               value: vipShowRate,           format: 'pct' },
    { label: 'Same-Session Booking Rate',   value: sameSessionBookingRate, format: 'pct' },
    { label: 'VIP Count',                   value: d.vip_count || 0,      format: 'num' },
    { label: 'Total Tickets',               value: d.total_tickets || 0,  format: 'num' },
  ]);

  // ---- Helper: card wrapper ----
  function _card(title) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:20px; margin-top:16px;';
    if (title) {
      const h = document.createElement('h3');
      h.className = 'card-title';
      h.style.cssText = 'margin:0 0 16px; font-size:14px; font-weight:600; color:var(--text-secondary);';
      h.textContent = title;
      card.appendChild(h);
    }
    return card;
  }

  // ---- Data gap badge: watch time ----
  const watchGap = document.createElement('div');
  watchGap.style.cssText = 'background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.25); border-radius:8px; padding:12px 16px; margin-top:16px; display:flex; align-items:flex-start; gap:10px;';
  watchGap.innerHTML = `
    <span style="color:var(--warning, #eab308); font-size:16px; flex-shrink:0;">&#9888;</span>
    <p style="margin:0; font-size:13px; color:var(--text-secondary, #94a3b8); line-height:1.5;">
      <strong style="color:var(--text-primary, #e2e8f0);">Watch time data pending</strong> &mdash;
      Watch time data requires AEvent integration (in progress). Distribution charts will populate once session-level viewing data flows to BigQuery.
    </p>
  `;
  container.appendChild(watchGap);

  // ---- 2-column grid ----
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;';
  container.appendChild(grid);

  // ---- Chart 1: Show Rate Trend (Chart.js line) ----
  const trendCard = _card('Show Rate Trend (Monthly)');
  trendCard.style.marginTop = '0';
  const trendCanvas = document.createElement('canvas');
  trendCanvas.id = 'workshop-show-rate-trend';
  trendCard.appendChild(trendCanvas);
  grid.appendChild(trendCard);

  // ---- Chart 2: VIP vs Standard Show Rate (Plotly grouped bar) ----
  const vipCard = _card('VIP vs Standard Show Rate');
  vipCard.style.marginTop = '0';
  const vipDiv = document.createElement('div');
  vipDiv.id = 'workshop-vip-bar';
  vipDiv.style.minHeight = '280px';
  vipCard.appendChild(vipDiv);
  grid.appendChild(vipCard);

  // ---- Chart 3: Day-of-Week Heatmap (Plotly) ----
  const heatmapCard = _card('Day-of-Week Performance Heatmap');
  heatmapCard.style.marginTop = '0';
  const heatmapDiv = document.createElement('div');
  heatmapDiv.id = 'workshop-dow-heatmap';
  heatmapDiv.style.minHeight = '280px';
  heatmapCard.appendChild(heatmapDiv);
  grid.appendChild(heatmapCard);

  // ---- Chart 4: Nurture Effectiveness (gap card) ----
  const nurtureCard = _card('Nurture Effectiveness');
  nurtureCard.style.marginTop = '0';
  const nurtureGap = document.createElement('div');
  nurtureGap.style.cssText = 'background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.25); border-radius:8px; padding:16px; display:flex; align-items:flex-start; gap:10px;';
  nurtureGap.innerHTML = `
    <span style="color:var(--warning, #eab308); font-size:18px; flex-shrink:0;">&#9888;</span>
    <p style="margin:0; font-size:13px; color:var(--text-secondary, #94a3b8); line-height:1.6;">
      <strong style="color:var(--text-primary, #e2e8f0);">AEvent + SendGrid integration pending.</strong><br>
      Workshop-specific nurture tracking will appear here once email sequence data is linked to booking outcomes.
    </p>
  `;
  nurtureCard.appendChild(nurtureGap);
  grid.appendChild(nurtureCard);

  // ---- Render charts after layout ----
  requestAnimationFrame(() => {

    // Chart 1: Show Rate Trend with annotation
    if (monthly && monthly.length > 0) {
      const labels = monthly.map(r => r.month);
      const rates  = monthly.map(r => Math.min(parseFloat(r.show_rate) || 0, 100));

      // Find index closest to 2025-11 for annotation
      const annotationIndex = labels.indexOf('2025-11') !== -1
        ? labels.indexOf('2025-11')
        : labels.findIndex(l => l >= '2025-11');

      const annotationPlugins = annotationIndex >= 0 ? {
        annotation: {
          annotations: {
            automationSwitch: {
              type: 'line',
              xMin: annotationIndex,
              xMax: annotationIndex,
              borderColor: Theme.COLORS.warning || '#eab308',
              borderWidth: 2,
              borderDash: [6, 4],
              label: {
                display: true,
                content: 'Automation Switch',
                position: 'start',
                color: Theme.COLORS.warning || '#eab308',
                font: { size: 11 },
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: { x: 6, y: 4 }
              }
            }
          }
        }
      } : {};

      Theme.createChart('workshop-show-rate-trend', {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Show Rate %',
            data: rates,
            borderColor: Theme.FUNNEL ? Theme.FUNNEL.teal : Theme.COLORS.accent,
            backgroundColor: Theme.FUNNEL ? Theme.FUNNEL.teal + '22' : Theme.COLORS.accent + '22',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: ctx => `Show Rate: ${Theme.pct(ctx.parsed.y)}` }
            },
            ...annotationPlugins
          },
          scales: {
            y: {
              min: 0,
              max: 100,
              ticks: { callback: v => `${v}%` }
            }
          }
        }
      });
    }

    // Chart 2: VIP vs Standard Show Rate
    if (typeof Plotly !== 'undefined') {
      const vipColor      = Theme.FUNNEL ? Theme.FUNNEL.purple : '#a855f7';
      const standardColor = Theme.FUNNEL ? Theme.FUNNEL.blue   : '#3b82f6';

      Plotly.newPlot('workshop-vip-bar', [
        {
          type: 'bar',
          name: 'VIP',
          x: ['VIP', 'Standard'],
          y: [vipShowRate, showRate],
          marker: { color: [vipColor, standardColor] },
          text: [Theme.pct(vipShowRate), Theme.pct(showRate)],
          textposition: 'outside'
        }
      ], {
        ...Theme.PLOTLY_LAYOUT,
        title: { text: '', font: { size: 13 } },
        yaxis: { ...Theme.PLOTLY_LAYOUT.yaxis, range: [0, 105], ticksuffix: '%' },
        showlegend: false,
        bargap: 0.5
      }, Theme.PLOTLY_CONFIG);

      // Chart 3: Day-of-Week Heatmap
      if (dayofweek && dayofweek.length > 0) {
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const metricLabels = ['Show Rate', 'Booking Rate', 'Close Rate'];
        const metricKeys   = ['show_rate', 'booking_rate', 'close_rate'];

        // Build 3x7 matrix (rows = metrics, cols = days)
        const matrix = metricKeys.map(key => {
          return dayLabels.map((_, idx) => {
            const dow = idx + 1; // BQ DAYOFWEEK: 1=Sun
            const row = dayofweek.find(r => parseInt(r.dow) === dow);
            return row ? Math.min(parseFloat(row[key]) || 0, 100) : null;
          });
        });

        Plotly.newPlot('workshop-dow-heatmap', [{
          type: 'heatmap',
          z: matrix,
          x: dayLabels,
          y: metricLabels,
          colorscale: [
            [0,   '#ef4444'],
            [0.5, '#eab308'],
            [1,   '#22c55e']
          ],
          zmin: 0,
          zmax: 100,
          text: matrix.map(row => row.map(v => v !== null ? `${v.toFixed(1)}%` : 'N/A')),
          texttemplate: '%{text}',
          hovertemplate: '%{y} on %{x}: %{text}<extra></extra>',
          showscale: true,
          colorbar: { ticksuffix: '%', thickness: 14 }
        }], {
          ...Theme.PLOTLY_LAYOUT,
          margin: { t: 20, r: 80, b: 40, l: 100 }
        }, Theme.PLOTLY_CONFIG);
      }
    }
  });
});
