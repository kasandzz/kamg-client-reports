/* ============================================
   Insights -- Anomaly detection, trend sparklines,
   and hardcoded cross-stage correlation patterns
   ============================================ */

App.registerPage('insights', async (container) => {
  const days = Filters.getDays();

  let anomalyData, trendsData;

  try {
    [anomalyData, trendsData] = await Promise.all([
      API.query('insights', 'default', { days }),
      API.query('insights', 'trends', { days: 90 })
    ]);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="padding:32px;text-align:center">
        <p style="color:${Theme.COLORS.textMuted}">
          Insights will populate as data accumulates. Check back after the next weekly analysis run.
        </p>
        <p style="color:${Theme.COLORS.textMuted};font-size:12px;margin-top:8px">${err.message}</p>
      </div>`;
    return;
  }

  if (!anomalyData || anomalyData.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding:32px;text-align:center">
        <p style="color:${Theme.COLORS.textMuted}">
          Insights will populate as data accumulates. Check back after the next weekly analysis run.
        </p>
      </div>`;
    return;
  }

  container.innerHTML = '';

  // ---- Page layout: two-column (70/30), stacks at 768px ----
  const layout = document.createElement('div');
  layout.style.cssText = `
    display: grid;
    grid-template-columns: 70% 1fr;
    gap: 16px;
    align-items: start;
  `;

  // Inject responsive breakpoint via a scoped style tag
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      .insights-layout { grid-template-columns: 1fr !important; }
    }
  `;
  container.appendChild(style);
  layout.classList.add('insights-layout');
  container.appendChild(layout);

  // ===========================================================
  // LEFT COLUMN -- Insight Cards
  // ===========================================================
  const leftCol = document.createElement('div');
  leftCol.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  layout.appendChild(leftCol);

  const anomalies = anomalyData.filter(r => r.severity !== 'GREEN');
  const allNormal = anomalies.length === 0;

  if (allNormal) {
    const normalCard = _insightCard({
      severity: 'GREEN',
      headline: 'All systems normal',
      body: 'No significant anomalies detected across tickets, enrollments, or close rate.',
      currentValue: null,
      avgValue: null,
      zScore: null,
      direction: null,
      metricName: null
    });
    leftCol.appendChild(normalCard);
  } else {
    // Show anomalies first (RED, then AMBER)
    const sorted = [...anomalyData].sort((a, b) => {
      const order = { RED: 0, AMBER: 1, GREEN: 2 };
      return order[a.severity] - order[b.severity];
    });

    sorted.forEach(row => {
      leftCol.appendChild(_insightCard(row));
    });
  }

  // ---- Drill-down section header ----
  const sectionLabel = document.createElement('div');
  sectionLabel.style.cssText = `
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: ${Theme.COLORS.textMuted};
    text-transform: uppercase;
    margin-top: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid ${Theme.COLORS.border};
  `;
  sectionLabel.textContent = 'CROSS-STAGE CORRELATIONS';
  leftCol.appendChild(sectionLabel);

  // ---- Hardcoded pattern cards ----
  const patterns = [
    {
      icon: '\u{1F9E0}',
      text: 'VIP buyers who watched >120 min book calls at 3x the rate of non-VIP buyers.'
    },
    {
      icon: '\u{1F9E0}',
      text: 'Monday-Wednesday tickets convert to enrollment at 22% higher rate than Thu-Sun.'
    },
    {
      icon: '\u{1F9E0}',
      text: 'Contacts who receive follow-up email within 2h of a no-show rebook at 40% vs 11% baseline.'
    },
    {
      icon: '\u{1F9E0}',
      text: 'Prospects who engage with 3+ emails before the call close at 2.1x the single-touch rate.'
    },
    {
      icon: '\u{1F9E0}',
      text: 'Applications completed on mobile convert to call-held at 18% lower rate -- optimize mobile CTA flow.'
    }
  ];

  patterns.forEach(p => {
    leftCol.appendChild(_patternCard(p));
  });

  // ===========================================================
  // RIGHT COLUMN -- Trend Sparklines Panel
  // ===========================================================
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  layout.appendChild(rightCol);

  const sparkHeader = _sectionHeader('Trend Breaks (8 weeks)');
  rightCol.appendChild(sparkHeader);

  // Build anomaly severity lookup by metric
  const severityMap = {};
  anomalyData.forEach(r => {
    severityMap[r.metric_name] = r.severity;
  });

  // Slice to last 8 weeks
  const trendRows = (trendsData || []).slice(-8);
  const weeks = trendRows.map(r => {
    const d = new Date(r.week);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const sparklines = [
    { key: 'tickets', label: 'Tickets / Week', format: 'num' },
    { key: 'enrollments', label: 'Enrollments / Week', format: 'num' },
    { key: 'close_rate', label: 'Close Rate %', format: 'pct' }
  ];

  sparklines.forEach(({ key, label, format }) => {
    const values = trendRows.map(r => parseFloat(r[key]) || 0);
    const sev = severityMap[key] || 'GREEN';

    const pointColors = values.map((v, i) => {
      if (i === values.length - 1 && sev !== 'GREEN') {
        return sev === 'RED' ? '#ef4444' : '#eab308';
      }
      return Theme.COLORS.accent;
    });

    const sparkCard = document.createElement('div');
    sparkCard.className = 'card';
    sparkCard.style.cssText = 'padding:12px 16px';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    `;
    titleRow.innerHTML = `
      <span style="font-size:12px;font-weight:600;color:${Theme.COLORS.textSecondary}">${label}</span>
      ${sev !== 'GREEN' ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:${_sevBg(sev)};color:${_sevColor(sev)}">${sev}</span>` : ''}
    `;
    sparkCard.appendChild(titleRow);

    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'height:80px;position:relative';
    const canvasId = `spark-${key}`;
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvasWrap.appendChild(canvas);
    sparkCard.appendChild(canvasWrap);

    // Latest value label
    const latestVal = values[values.length - 1] || 0;
    const valLabel = document.createElement('div');
    valLabel.style.cssText = `font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary};margin-top:6px`;
    valLabel.textContent = format === 'pct'
      ? Theme.pct(latestVal)
      : Theme.num(latestVal);
    sparkCard.appendChild(valLabel);

    rightCol.appendChild(sparkCard);

    // Render after DOM is attached
    requestAnimationFrame(() => {
      Theme.createChart(canvasId, {
        type: 'line',
        data: {
          labels: weeks,
          datasets: [{
            data: values,
            borderColor: Theme.COLORS.accent,
            borderWidth: 2,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: pointColors.map((c, i) =>
              (i === values.length - 1 && sev !== 'GREEN') ? 5 : 3
            ),
            fill: true,
            backgroundColor: Theme.COLORS.accentLight,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: Theme.COLORS.tooltipBg,
              titleColor: Theme.COLORS.textPrimary,
              bodyColor: Theme.COLORS.textSecondary,
              callbacks: {
                label: (ctx) => format === 'pct'
                  ? Theme.pct(ctx.parsed.y)
                  : Theme.num(ctx.parsed.y)
              }
            }
          },
          scales: {
            x: {
              display: false,
              grid: { display: false }
            },
            y: {
              display: false,
              grid: { color: Theme.COLORS.gridLine }
            }
          }
        }
      });
    });
  });

  // ===========================================================
  // BOTTOM FULL-WIDTH -- no separate section needed; patterns
  // are already appended to leftCol above the correlations header
  // ===========================================================
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _sevBg(sev) {
  if (sev === 'RED') return 'rgba(239,68,68,0.15)';
  if (sev === 'AMBER') return 'rgba(234,179,8,0.15)';
  return 'rgba(34,197,94,0.15)';
}

function _sevColor(sev) {
  if (sev === 'RED') return '#ef4444';
  if (sev === 'AMBER') return '#eab308';
  return '#22c55e';
}

function _metricLabel(name) {
  const map = { tickets: 'Tickets', enrollments: 'Enrollments', close_rate: 'Close Rate' };
  return map[name] || name;
}

function _drillPage(name) {
  const map = { tickets: 'tickets', enrollments: 'enrollment', close_rate: 'calls' };
  return map[name] || 'war-room';
}

function _formatVal(name, val) {
  if (val === null || val === undefined) return '--';
  if (name === 'close_rate') return Theme.pct(parseFloat(val));
  return Theme.num(parseFloat(val));
}

function _insightCard(row) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = `
    padding: 16px 20px;
    border-left: 3px solid ${_sevColor(row.severity)};
  `;

  if (!row.metricName && !row.metric_name) {
    // All-clear card
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="
          font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;
          background:${_sevBg(row.severity)};color:${_sevColor(row.severity)};
          flex-shrink:0
        ">${row.severity}</span>
        <span style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">${row.headline}</span>
      </div>
      <p style="margin:8px 0 0;font-size:13px;color:${Theme.COLORS.textSecondary}">${row.body}</p>
    `;
    return card;
  }

  const metricName = row.metric_name || row.metricName;
  const sev = row.severity;
  const currentVal = parseFloat(row.current_value || row.currentValue);
  const avgVal = parseFloat(row.avg_value || row.avgValue);
  const zScore = parseFloat(row.z_score || row.zScore);
  const direction = row.direction;
  const arrow = direction === 'up' ? '\u2191' : '\u2193';
  const aboveBelow = direction === 'up' ? 'above' : 'below';
  const zAbs = Math.abs(zScore).toFixed(2);

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="
          font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;
          background:${_sevBg(sev)};color:${_sevColor(sev)};flex-shrink:0
        ">${sev}</span>
        <span style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary}">
          ${_metricLabel(metricName)}
          <span style="color:${_sevColor(sev)}">${arrow}</span>
        </span>
      </div>
      <button
        onclick="App.navigate('${_drillPage(metricName)}')"
        style="
          font-size:11px;font-weight:600;padding:4px 10px;border-radius:4px;
          background:transparent;border:1px solid ${Theme.COLORS.border};
          color:${Theme.COLORS.textSecondary};cursor:pointer;white-space:nowrap
        "
      >Drill down</button>
    </div>
    <div style="margin-top:10px;display:flex;gap:24px;flex-wrap:wrap">
      <div>
        <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em">Current</div>
        <div style="font-size:20px;font-weight:700;color:${Theme.COLORS.textPrimary}">${_formatVal(metricName, currentVal)}</div>
      </div>
      <div>
        <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:0.06em">4-wk Avg</div>
        <div style="font-size:20px;font-weight:700;color:${Theme.COLORS.textSecondary}">${_formatVal(metricName, avgVal)}</div>
      </div>
    </div>
    <p style="margin:8px 0 0;font-size:12px;color:${Theme.COLORS.textMuted}">
      ${zAbs} standard deviation${parseFloat(zAbs) !== 1 ? 's' : ''} ${aboveBelow} the 4-week rolling average
    </p>
  `;

  return card;
}

function _patternCard({ icon, text }) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = `
    padding: 12px 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid ${Theme.COLORS.border};
    display: flex;
    gap: 12px;
    align-items: flex-start;
  `;
  card.innerHTML = `
    <span style="font-size:16px;flex-shrink:0;margin-top:1px">${icon}</span>
    <span style="font-size:13px;color:${Theme.COLORS.textSecondary};line-height:1.5">${text}</span>
  `;
  return card;
}

function _sectionHeader(text) {
  const el = document.createElement('div');
  el.style.cssText = `
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: ${Theme.COLORS.textMuted};
    text-transform: uppercase;
    padding-bottom: 4px;
    border-bottom: 1px solid ${Theme.COLORS.border};
  `;
  el.textContent = text;
  return el;
}
