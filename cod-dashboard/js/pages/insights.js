/* ============================================
   Insights -- Intelligence feed, priority actions,
   anomaly detection, source attribution, watchlist
   ============================================ */

App.registerPage('insights', async (container) => {
  const days = Filters.getDays();

  // Attempt live anomaly data as fallback context
  let anomalyData = [];
  try {
    anomalyData = await API.query('insights', 'default', { days });
  } catch (_) { /* proceed with dummy data */ }

  container.innerHTML = '';

  // Scoped styles
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      .insights-layout { grid-template-columns: 1fr !important; }
      .insights-priority-grid { grid-template-columns: 1fr !important; }
    }
    .insights-tab {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: ${Theme.COLORS.textMuted};
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
    }
    .insights-tab:hover {
      color: ${Theme.COLORS.textSecondary};
    }
    .insights-tab.active {
      color: ${Theme.FUNNEL.blue};
      border-bottom-color: ${Theme.FUNNEL.blue};
    }
    .insights-feed-card {
      padding: 16px 20px;
      cursor: default;
      transition: background 0.15s;
    }
    .insights-feed-card:hover {
      background: rgba(255,255,255,0.03);
    }
    .insights-expand-link {
      font-size: 11px;
      color: ${Theme.FUNNEL.blue};
      cursor: pointer;
      margin-top: 10px;
      display: inline-block;
      user-select: none;
    }
    .insights-expand-link:hover {
      text-decoration: underline;
    }
    .insights-expand-area {
      display: none;
      margin-top: 12px;
      padding: 12px;
      border-radius: 6px;
      background: rgba(255,255,255,0.02);
      border: 1px solid ${Theme.COLORS.border};
    }
    .insights-expand-area.open {
      display: block;
    }
    .insights-source-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(99,102,241,0.12);
      color: ${Theme.FUNNEL.blue};
      margin-right: 4px;
      margin-top: 4px;
    }
    .attr-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .attr-table th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${Theme.COLORS.textMuted};
      padding: 8px 12px;
      border-bottom: 1px solid ${Theme.COLORS.border};
    }
    .attr-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      color: ${Theme.COLORS.textSecondary};
    }
    .attr-table tr:hover td {
      background: rgba(255,255,255,0.02);
    }
    .attr-table .mono {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
    }
  `;
  container.appendChild(style);

  // ===================================================================
  // 1. BLUF -- Daily Intelligence Brief
  // ===================================================================
  const bluf = document.createElement('div');
  bluf.className = 'card';
  bluf.style.cssText = `
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(56,189,248,0.08), rgba(168,85,247,0.08));
    border: 1px solid rgba(56,189,248,0.2);
    border-radius: 10px;
    margin-bottom: 16px;
  `;
  bluf.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:260px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${Theme.FUNNEL.blue}">DAILY INTELLIGENCE BRIEF</span>
        </div>
        <p style="font-size:14px;line-height:1.7;color:${Theme.COLORS.textPrimary};margin:0">
          Ticket volume up 18% WoW driven by therapist niche creative (now 34% of all tickets). Close rate dropped to 6.2% -- Colby's removal hasn't been offset by remaining closers. Action needed: 82% of enrolled customers are women aged 35-54 -- current Meta targeting skews male. Reallocate budget to match buyer profile.
        </p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
        <span style="font-size:11px;color:${Theme.COLORS.textMuted}">Last run: 7:02am today</span>
        <button style="
          font-size:11px;font-weight:600;padding:6px 14px;border-radius:6px;
          background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);
          color:${Theme.FUNNEL.blue};cursor:pointer;white-space:nowrap;
          transition:background 0.2s
        " onmouseover="this.style.background='rgba(56,189,248,0.2)'"
           onmouseout="this.style.background='rgba(56,189,248,0.12)'"
        >Refresh Now</button>
      </div>
    </div>
  `;
  container.appendChild(bluf);

  // ===================================================================
  // 2. Priority Actions Strip
  // ===================================================================
  const priorityGrid = document.createElement('div');
  priorityGrid.className = 'insights-priority-grid';
  priorityGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  `;

  const priorityActions = [
    {
      severity: 'ACTION',
      color: Theme.COLORS.danger,
      headline: 'Retarget Meta Ads to Women 35-54',
      body: '82% of enrollees are women but ad spend skews 60% male. Est. +$4K/mo revenue impact.',
      chartLabel: 'Chart: Gender targeting vs enrollment demographics'
    },
    {
      severity: 'WATCH',
      color: Theme.COLORS.warning,
      headline: 'Close Rate Declining 3 Weeks',
      body: '6.2% vs 8.4% 4-wk avg. Down since Colby removed. Monitor Marcus & Lucah loads.',
      chartLabel: 'Chart: Close rate trend by closer'
    },
    {
      severity: 'WIN',
      color: Theme.COLORS.success,
      headline: 'Therapist Creative Outperforming 3x',
      body: '$8.12 CPL vs $24.50 avg. 34% of tickets from 12% of spend. Scale immediately.',
      chartLabel: 'Chart: CPL by creative type'
    }
  ];

  priorityActions.forEach((action, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `
      padding: 16px 20px;
      border-left: 3px solid ${action.color};
      background: ${_rgbaFromHex(action.color, 0.06)};
    `;

    const expandId = `priority-expand-${idx}`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="
          font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;
          background:${_rgbaFromHex(action.color, 0.15)};color:${action.color};
          letter-spacing:0.06em
        ">${action.severity}</span>
      </div>
      <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">
        ${action.headline}
      </div>
      <p style="font-size:12px;color:${Theme.COLORS.textSecondary};margin:0;line-height:1.5">
        ${action.body}
      </p>
      <span class="insights-expand-link" data-target="${expandId}">Expand for chart + sources</span>
      <div class="insights-expand-area" id="${expandId}">
        <div style="height:60px;display:flex;align-items:center;justify-content:center;color:${Theme.COLORS.textMuted};font-size:12px;border:1px dashed ${Theme.COLORS.border};border-radius:6px;margin-bottom:8px">
          ${action.chartLabel}
        </div>
        <div style="font-size:10px;color:${Theme.COLORS.textMuted}">Sources: hyros_sales, meta_ad_performance, ghl_contacts</div>
      </div>
    `;
    priorityGrid.appendChild(card);
  });

  container.appendChild(priorityGrid);

  // ===================================================================
  // 3. Tabbed Feed (70%) + Sidebar Sparklines (30%)
  // ===================================================================
  const layout = document.createElement('div');
  layout.className = 'insights-layout';
  layout.style.cssText = `
    display: grid;
    grid-template-columns: 70% 1fr;
    gap: 16px;
    align-items: start;
    margin-bottom: 16px;
  `;
  container.appendChild(layout);

  // -- LEFT: Tabs + Feed --
  const leftCol = document.createElement('div');
  leftCol.style.cssText = 'display:flex;flex-direction:column;gap:0';
  layout.appendChild(leftCol);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.style.cssText = `
    display: flex;
    gap: 0;
    border-bottom: 1px solid ${Theme.COLORS.border};
    margin-bottom: 12px;
  `;
  const tabNames = ['All', 'Ads', 'Funnel', 'Sales', 'Revenue', 'Behavioral'];
  tabNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'insights-tab' + (i === 0 ? ' active' : '');
    btn.textContent = name;
    btn.dataset.filter = name.toLowerCase();
    btn.addEventListener('click', () => {
      tabBar.querySelectorAll('.insights-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      feedContainer.querySelectorAll('.insights-feed-card').forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
    tabBar.appendChild(btn);
  });
  leftCol.appendChild(tabBar);

  // Feed container
  const feedContainer = document.createElement('div');
  feedContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  leftCol.appendChild(feedContainer);

  const feedInsights = [
    {
      category: 'ads',
      tags: ['ADS', 'TARGETING'],
      title: 'Attorneys convert 2.4x higher than educators on VIP upsell',
      body: 'Attorney segment: 41% VIP take rate vs 17% educator. Attorney avg deal size $12.4K vs $8.9K. Consider attorney-specific VIP creative.',
      sources: ['hyros_sales', 'ghl_contacts', 'meta_ad_performance'],
      borderColor: Theme.FUNNEL.blue,
      type: 'pattern',
      action: 'TEST: Launch attorney-specific VIP ad creative with $500 budget over 5 days. Compare VIP take rate vs general creative.'
    },
    {
      category: 'funnel',
      tags: ['FUNNEL'],
      title: 'Monday-Wednesday tickets convert 22% better to enrollment',
      body: 'Tickets purchased Mon-Wed: 11.2% overall conversion. Thu-Sun: 9.1%. Workshop timing effect -- earlier buyers more engaged.',
      sources: ['vw_workshop_funnel_pipeline', 'dim_dates'],
      borderColor: Theme.COLORS.success,
      type: 'win',
      action: 'TEST: Shift 60% of ad spend to Mon-Wed delivery. Measure enrollment conversion lift over 2 weeks.'
    },
    {
      category: 'sales',
      tags: ['SALES', 'PATTERN'],
      title: 'No-show rate spiking on Friday VIP calls',
      body: 'Friday VIP no-show: 38% vs 22% avg. Consider moving VIP calls to Tue-Thu window. 2h follow-up email rebook rate: 40% vs 11%.',
      sources: ['zoom_meetings', 'ghl_calendar_events', 'sendgrid_events'],
      borderColor: Theme.COLORS.warning,
      type: 'concern',
      action: 'ACTION: Remove Friday VIP call slots. Add 2h automated rebook email for all no-shows. Target 25% no-show rate.'
    },
    {
      category: 'revenue',
      tags: ['REVENUE', 'CROSS-SOURCE'],
      title: 'PIF buyers have 31% higher completion rate than split-pay',
      body: 'Pay-in-full customers complete onboarding at 89% vs 61% for split-pay. Consider PIF incentive to improve LTV.',
      sources: ['fact_stripe_charges', 'ghl_contacts'],
      borderColor: Theme.FUNNEL.blue,
      type: 'pattern',
      action: 'TEST: Offer $500 PIF discount for 2 weeks. Track if completion rate delta offsets discount cost.'
    },
    {
      category: 'behavioral',
      tags: ['BEHAVIORAL'],
      title: '3+ email touches before call = 2.1x close rate',
      body: 'Prospects engaging with 3+ emails before the sales call close at 2.1x the single-touch rate. Optimize email sequence timing.',
      sources: ['sendgrid_events', 'ghl_opportunities'],
      borderColor: Theme.COLORS.success,
      type: 'win',
      action: 'ACTION: Add 2 nurture emails before call booking step. Gate call scheduling behind 3+ email engagements.'
    },
    {
      category: 'ads',
      tags: ['ADS', 'CREATIVE'],
      title: 'Video ads outperforming static 2.8x on CPL',
      body: 'Video creative CPL: $9.40 vs static $26.30. Video share rate 4.2x higher. Shift budget to video-first.',
      sources: ['meta_ad_performance'],
      borderColor: Theme.FUNNEL.blue,
      type: 'pattern',
      action: 'ACTION: Reallocate 70% of creative budget to video. Pause bottom 3 static ads by CPL immediately.'
    }
  ];

  feedInsights.forEach((insight, idx) => {
    const card = document.createElement('div');
    card.className = 'card insights-feed-card';
    card.dataset.category = insight.category;
    card.style.cssText = `border-left: 3px solid ${insight.borderColor};`;

    const expandId = `feed-expand-${idx}`;
    const tagsHtml = insight.tags.map(t =>
      `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:${_rgbaFromHex(insight.borderColor, 0.12)};color:${insight.borderColor};letter-spacing:0.05em">${t}</span>`
    ).join(' ');

    const sourcesHtml = insight.sources.map(s =>
      `<span class="insights-source-tag">${s}</span>`
    ).join('');

    const actionColor = insight.type === 'concern' ? Theme.COLORS.warning : insight.type === 'win' ? Theme.COLORS.success : Theme.FUNNEL.blue;

    card.innerHTML = `
      <div style="display:flex;gap:16px;align-items:stretch">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
            ${tagsHtml}
          </div>
          <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">
            ${insight.title}
          </div>
          <p style="font-size:12px;color:${Theme.COLORS.textSecondary};margin:0;line-height:1.5">
            ${insight.body}
          </p>
          <span class="insights-expand-link" data-target="${expandId}">Expand for chart + sources</span>
          <div class="insights-expand-area" id="${expandId}">
            <div style="height:60px;display:flex;align-items:center;justify-content:center;color:${Theme.COLORS.textMuted};font-size:12px;border:1px dashed ${Theme.COLORS.border};border-radius:6px;margin-bottom:8px">
              Chart: ${insight.title}
            </div>
            <div>${sourcesHtml}</div>
          </div>
        </div>
        <div style="
          flex:0 0 180px;
          border:1px solid ${_rgbaFromHex(actionColor, 0.35)};
          border-radius:8px;
          padding:12px 14px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          background:${_rgbaFromHex(actionColor, 0.04)};
        ">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${actionColor};margin-bottom:6px">SUGGESTED ACTION</div>
          <div style="font-size:11px;color:${Theme.COLORS.textSecondary};line-height:1.5">${insight.action}</div>
        </div>
      </div>
    `;
    feedContainer.appendChild(card);
  });

  // -- RIGHT: Watchlist Sparklines --
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  layout.appendChild(rightCol);

  const watchHeader = document.createElement('div');
  watchHeader.style.cssText = `
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: ${Theme.COLORS.textMuted};
    text-transform: uppercase;
    padding-bottom: 6px;
    border-bottom: 1px solid ${Theme.COLORS.border};
  `;
  watchHeader.textContent = 'WATCHLIST';
  rightCol.appendChild(watchHeader);

  const sparkMetrics = [
    { label: 'TICKETS/WEEK', value: '42', data: [32, 38, 41, 35, 44, 39, 47, 42], color: Theme.FUNNEL.blue, status: 'normal' },
    { label: 'CLOSE RATE', value: '6.2%', data: [9.1, 8.8, 8.4, 7.9, 7.2, 6.8, 6.5, 6.2], color: Theme.COLORS.warning, status: 'warning' },
    { label: 'ENROLLMENTS/WEEK', value: '4', data: [2, 3, 4, 2, 3, 5, 3, 4], color: Theme.FUNNEL.blue, status: 'normal' },
    { label: 'AVG CPL', value: '$14.30', data: [22, 19, 18, 16, 15, 14, 13, 14.30], color: Theme.COLORS.success, status: 'positive' },
    { label: 'SHOW RATE', value: '72%', data: [71, 68, 72, 69, 73, 70, 74, 72], color: Theme.FUNNEL.blue, status: 'normal' },
    { label: 'VIP TAKE RATE', value: '34%', data: [28, 31, 29, 33, 30, 35, 32, 34], color: Theme.COLORS.success, status: 'positive' }
  ];

  sparkMetrics.forEach((metric, idx) => {
    const sparkCard = document.createElement('div');
    sparkCard.className = 'card';
    sparkCard.style.cssText = 'padding:12px 14px';

    const canvasId = `insights-spark-${idx}`;

    const valueColor = metric.status === 'warning' ? Theme.COLORS.warning : metric.status === 'positive' ? Theme.COLORS.success : Theme.COLORS.textPrimary;
    sparkCard.style.cssText = `padding:12px 14px;border-left:3px solid ${metric.color}`;

    sparkCard.innerHTML = `
      <div style="font-size:10px;font-weight:600;letter-spacing:0.08em;color:${Theme.COLORS.textMuted};margin-bottom:4px">${metric.label}</div>
      <div style="font-size:20px;font-weight:700;color:${valueColor};margin-bottom:6px">${metric.value}</div>
      <div style="height:60px;position:relative">
        <canvas id="${canvasId}" style="height:60px"></canvas>
      </div>
    `;
    rightCol.appendChild(sparkCard);

    requestAnimationFrame(() => {
      const baseColor = metric.color;
      Theme.createChart(canvasId, {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
          datasets: [{
            data: metric.data,
            borderColor: baseColor,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            fill: true,
            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const { ctx: c, chartArea } = chart;
              if (!chartArea) return _rgbaFromHex(baseColor, 0.1);
              const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, _rgbaFromHex(baseColor, 0.25));
              gradient.addColorStop(1, _rgbaFromHex(baseColor, 0.02));
              return gradient;
            },
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false }
          },
          elements: { point: { radius: 0 } }
        }
      });
    });
  });

  // ===================================================================
  // Global expand/collapse handler (event delegation)
  // ===================================================================
  container.addEventListener('click', (e) => {
    const link = e.target.closest('.insights-expand-link');
    if (!link) return;
    const targetId = link.dataset.target;
    const area = document.getElementById(targetId);
    if (!area) return;
    const isOpen = area.classList.contains('open');
    area.classList.toggle('open');
    link.textContent = isOpen ? 'Expand for chart + sources' : 'Collapse';
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _rgbaFromHex(hex, alpha) {
  // Handle named/rgba colors by returning a fallback
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
    // Extract rgb values and apply new alpha
    const match = hex.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      return `rgba(${match[0]},${match[1]},${match[2]},${alpha})`;
    }
    return hex;
  }
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
