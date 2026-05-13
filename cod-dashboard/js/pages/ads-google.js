/* ============================================
   Ads (Google) -- search, display, YouTube,
   cross-platform comparison
   ============================================ */

App.registerPage('ads-google', async (container) => {
  const days    = Filters.getDays();
  const compare = Filters.getCompare();

  container.innerHTML = '';

  // ---- Staleness check ----
  try {
    const dailyCheck = await API.query('google-ads', 'daily', { days: 7 }).catch(() => null);
    if (dailyCheck && dailyCheck.length > 0) {
      const lastDate = dailyCheck[dailyCheck.length - 1].ad_date;
      const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
      if (daysSince > 3) {
        const banner = Components.renderStaleBanner('Google Ads', lastDate);
        if (banner) container.appendChild(banner);
      }
    } else if (!dailyCheck || dailyCheck.length === 0) {
      const banner = Components.renderStaleBanner('Google Ads', new Date(Date.now() - 30 * 86400000).toISOString());
      if (banner) container.appendChild(banner);
    }
  } catch (_) {}

  // ---- Parallel data fetch ----
  // The doubled-window prev fetch follows the ads-meta.js f7eca46 pattern: the
  // page's `default` query returns headline KPIs for the selected window; we
  // also request the 2x-window flavor so we can derive prior-period deltas
  // (curRow - prevDoubleRow + curRow ≈ prev window) without a server-side change.
  let kpis, kpisPrev, campaigns, keywords, youtube, crossPlatform, daily, landingPages;

  try {
    [kpis, kpisPrev, campaigns, keywords, youtube, crossPlatform, daily, landingPages] = await Promise.all([
      API.query('google-ads', 'default',       { days }),
      API.query('google-ads', 'default',       { days: days * 2 }).catch(() => null),
      API.query('google-ads', 'campaigns',     { days }),
      API.query('google-ads', 'keywords',      { days }),
      API.query('google-ads', 'youtube',       { days }).catch(() => null),
      API.query('google-ads', 'crossPlatform', { days }).catch(() => null),
      API.query('google-ads', 'daily',         { days }),
      API.query('google-ads', 'landingPages',  { days }).catch(() => null),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Google Ads: ${err.message}</p></div>`;
    return;
  }

  const kpi = (kpis && kpis.length > 0) ? kpis[0] : {};
  const kpiDouble = (kpisPrev && kpisPrev.length > 0) ? kpisPrev[0] : {};

  // ---- KPI metric grid (Mode 2 conversion 2026-05-13) ----
  const kpiContainer = document.createElement('div');
  kpiContainer.style.marginBottom = '16px';
  container.appendChild(kpiContainer);

  function _prev(field) {
    const cur = Number(kpi[field] || 0);
    const dbl = Number(kpiDouble[field] || 0);
    if (!dbl || dbl <= cur) return null;
    return dbl - cur;
  }

  // Daily spend series doubles as a sparkline trend hint for Total Spend.
  const spendSpark = (daily || []).map(d => Number(d.spend || 0));

  function _buildGoogleAdsMetrics() {
    return [
      { label: 'Total Spend', value: kpi.total_spend       || 0, prevValue: _prev('total_spend'),       format: 'money', invertDelta: true, sparklineData: spendSpark },
      { label: 'Impressions', value: kpi.total_impressions || 0, prevValue: _prev('total_impressions'), format: 'num'   },
      { label: 'Clicks',      value: kpi.total_clicks      || 0, prevValue: _prev('total_clicks'),      format: 'num'   },
      { label: 'CTR',         value: kpi.avg_ctr           || 0, prevValue: _prev('avg_ctr'),           format: 'pct'   },
      { label: 'CPC',         value: kpi.avg_cpc           || 0, prevValue: _prev('avg_cpc'),           format: 'money', invertDelta: true },
      { label: 'Conversions', value: kpi.total_conversions || 0, prevValue: _prev('total_conversions'), format: 'num'   },
      { label: 'CPA',         value: kpi.avg_cpa           || 0, prevValue: _prev('avg_cpa'),           format: 'money', invertDelta: true },
      { label: 'ROAS',        valueHtml: Components.guardROAS(kpi.account_roas || 0) === 'N/A' ? '<span style="color:var(--text-muted,#64748b)">N/A</span>' : Number(Components.guardROAS(kpi.account_roas)).toFixed(2) + 'x' },
    ];
  }

  Components.renderMetricGrid(kpiContainer, _buildGoogleAdsMetrics());

  // ---- Campaign Performance Table ----
  try { _renderGoogleCampaignTable(container, campaigns || []); } catch (e) { console.warn('Campaign table error:', e); }

  // ---- Daily Spend & CTR Chart ----
  try { _renderGoogleDailyChart(container, daily || []); } catch (e) { console.warn('Daily chart error:', e); }

  // ---- Keyword Performance Table ----
  try { _renderKeywordTable(container, keywords || []); } catch (e) { console.warn('Keyword table error:', e); }

  // ---- Landing Page Performance Table ----
  try { _renderLandingPageTable(container, landingPages || []); } catch (e) { console.warn('LP table error:', e); }

  // ---- YouTube Performance ----
  try { _renderYouTubePanel(container, youtube); } catch (e) { console.warn('YouTube error:', e); }

  // ---- Cross-Platform Comparison ----
  try { _renderCrossPlatform(container, crossPlatform); } catch (e) { console.warn('Cross-platform error:', e); }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _googleCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:20px;margin-top:16px';
  card.innerHTML = `<div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">${title}</div>`;
  return card;
}

const _CHANNEL_LABELS = {
  'SEARCH': 'Search',
  'DISPLAY': 'Display',
  'VIDEO': 'YouTube',
  'PERFORMANCE_MAX': 'PMax',
  'SHOPPING': 'Shopping',
  'DISCOVERY': 'Discovery',
};

function _channelLabel(type) {
  return _CHANNEL_LABELS[type] || type || 'Other';
}

// ---------------------------------------------------------------------------
// Campaign Performance Table
// ---------------------------------------------------------------------------

function _renderGoogleCampaignTable(container, campaigns) {
  const card = _googleCard('Campaign Performance');

  if (!campaigns || campaigns.length === 0) {
    card.innerHTML += `<p style="color:${Theme.COLORS.textMuted};font-size:13px">No campaign data available.</p>`;
    container.appendChild(card);
    return;
  }

  const thStyle = `padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:10px 12px;font-size:13px;color:${Theme.COLORS.textPrimary};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;font-family:'JetBrains Mono',monospace`;

  const sorted = [...campaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0));

  const rows = sorted.map(r => {
    const roasVal = Components.guardROAS(r.roas);
    const roasDisplay = roasVal === 'N/A'
      ? `<span style="color:${Theme.COLORS.textMuted}">N/A</span>`
      : `<span style="font-weight:700;color:${+roasVal >= 3 ? Theme.COLORS.success : +roasVal >= 1 ? Theme.COLORS.warning : Theme.COLORS.danger}">${(+roasVal).toFixed(2)}x</span>`;

    return `<tr>
      <td style="${tdStyle};font-family:Inter,sans-serif;font-weight:500;max-width:260px;overflow:hidden;text-overflow:ellipsis">${r.campaign_name || '--'}</td>
      <td style="${tdStyle}"><span style="font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,0.06);color:${Theme.COLORS.textSecondary}">${_channelLabel(r.channel_type)}</span></td>
      <td style="${tdStyle}">${Theme.money(r.spend || 0)}</td>
      <td style="${tdStyle}">${Theme.num(r.impressions || 0)}</td>
      <td style="${tdStyle}">${Theme.num(r.clicks || 0)}</td>
      <td style="${tdStyle}">${(+(r.ctr || 0)).toFixed(2)}%</td>
      <td style="${tdStyle}">${Theme.money(r.cpc || 0)}</td>
      <td style="${tdStyle}">${Theme.num(r.conversions || 0)}</td>
      <td style="${tdStyle}">${Theme.money(r.cpa || 0)}</td>
      <td style="${tdStyle}">${roasDisplay}</td>
    </tr>`;
  }).join('');

  card.innerHTML += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="${thStyle}">Campaign</th>
      <th style="${thStyle}">Type</th>
      <th style="${thStyle}">Spend</th>
      <th style="${thStyle}">Impr.</th>
      <th style="${thStyle}">Clicks</th>
      <th style="${thStyle}">CTR</th>
      <th style="${thStyle}">CPC</th>
      <th style="${thStyle}">Conv.</th>
      <th style="${thStyle}">CPA</th>
      <th style="${thStyle}">ROAS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Daily Spend & CTR Chart
// ---------------------------------------------------------------------------

function _renderGoogleDailyChart(container, daily) {
  const card = _googleCard('Daily Spend & CTR');

  if (!daily || daily.length === 0) {
    card.innerHTML += `<p style="color:${Theme.COLORS.textMuted};font-size:13px">No daily data available.</p>`;
    container.appendChild(card);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'google-daily-chart';
  card.appendChild(canvas);
  container.appendChild(card);

  const labels = daily.map(d => d.ad_date || '');
  const spend  = daily.map(d => +(d.spend || 0).toFixed(2));
  const ctr    = daily.map(d => +(d.ctr   || 0).toFixed(2));

  requestAnimationFrame(() => {
    Theme.createChart(canvas.id, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Spend ($)',
            data: spend,
            backgroundColor: '#FBBC04cc',
            borderColor: '#FBBC04',
            borderWidth: 1,
            yAxisID: 'ySpend',
            order: 2,
          },
          {
            label: 'CTR (%)',
            data: ctr,
            type: 'line',
            borderColor: '#4285F4',
            backgroundColor: 'transparent',
            pointBackgroundColor: '#4285F4',
            pointRadius: 3,
            tension: 0.3,
            yAxisID: 'yCtr',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'ySpend') return ` Spend: ${Theme.money(ctx.parsed.y)}`;
                return ` CTR: ${ctx.parsed.y.toFixed(2)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, maxRotation: 45 },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          ySpend: {
            position: 'left',
            ticks: { color: Theme.COLORS.textSecondary, font: { size: 10 }, callback: (v) => Theme.money(v) },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          yCtr: {
            position: 'right',
            ticks: { color: '#4285F4', font: { size: 10 }, callback: (v) => v.toFixed(1) + '%' },
            grid: { display: false },
          },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Keyword Performance Table
// ---------------------------------------------------------------------------

function _renderKeywordTable(container, keywords) {
  const card = _googleCard('Keyword Performance (Top 50)');

  if (!keywords || keywords.length === 0) {
    card.innerHTML += `<p style="color:${Theme.COLORS.textMuted};font-size:13px">No keyword data available.</p>`;
    container.appendChild(card);
    return;
  }

  const thStyle = `padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:10px 12px;font-size:13px;color:${Theme.COLORS.textPrimary};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;font-family:'JetBrains Mono',monospace`;

  const rows = keywords.map(r => {
    const qs = +(r.quality_score || 0);
    const qsColor = qs >= 7 ? Theme.COLORS.success : qs >= 5 ? Theme.COLORS.warning : Theme.COLORS.danger;
    return `<tr>
      <td style="${tdStyle};font-family:Inter,sans-serif;font-weight:500">${r.keyword || '--'}</td>
      <td style="${tdStyle}"><span style="font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,0.06)">${(r.match_type || '').toLowerCase()}</span></td>
      <td style="${tdStyle};font-family:Inter,sans-serif;max-width:180px;overflow:hidden;text-overflow:ellipsis">${r.campaign_name || '--'}</td>
      <td style="${tdStyle}">${Theme.num(r.impressions || 0)}</td>
      <td style="${tdStyle}">${Theme.num(r.clicks || 0)}</td>
      <td style="${tdStyle}">${(+(r.ctr || 0)).toFixed(2)}%</td>
      <td style="${tdStyle}">${Theme.money(r.cpc || 0)}</td>
      <td style="${tdStyle}">${Theme.money(r.spend || 0)}</td>
      <td style="${tdStyle}">${Theme.num(r.conversions || 0)}</td>
      <td style="${tdStyle};font-weight:600;color:${qsColor}">${qs > 0 ? qs : '--'}</td>
    </tr>`;
  }).join('');

  card.innerHTML += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="${thStyle}">Keyword</th>
      <th style="${thStyle}">Match</th>
      <th style="${thStyle}">Campaign</th>
      <th style="${thStyle}">Impr.</th>
      <th style="${thStyle}">Clicks</th>
      <th style="${thStyle}">CTR</th>
      <th style="${thStyle}">CPC</th>
      <th style="${thStyle}">Spend</th>
      <th style="${thStyle}">Conv.</th>
      <th style="${thStyle}">QS</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Landing Page Performance Table (GA4 paid Google traffic)
// ---------------------------------------------------------------------------

function _renderLandingPageTable(container, lps) {
  const card = _googleCard('Landing Page Performance (Paid Google Traffic)');

  const note = document.createElement('div');
  note.style.cssText = `font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:12px;padding:8px 10px;border-left:2px solid ${Theme.COLORS.textMuted};background:rgba(255,255,255,0.02)`;
  note.innerHTML = `Source: <code style="font-family:'JetBrains Mono',monospace;color:${Theme.COLORS.textSecondary}">ga4_landing_pages</code> filtered to medium=cpc, source=google. $27 sales / CAC by LP not yet shown -- requires LP-to-Stripe attribution bridge.`;
  card.appendChild(note);

  if (!lps || lps.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = `color:${Theme.COLORS.textMuted};font-size:13px`;
    empty.textContent = 'No landing page data available for paid Google traffic.';
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  const totalConv = lps.reduce((s, r) => s + (+r.conversions || 0), 0);
  const conversionsAllZero = totalConv === 0;

  const thStyle = `padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;cursor:pointer;user-select:none`;
  const tdStyle = `padding:10px 12px;font-size:13px;color:${Theme.COLORS.textPrimary};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;font-family:'JetBrains Mono',monospace`;

  const sorted = [...lps].sort((a, b) => (+b.sessions || 0) - (+a.sessions || 0));

  const rows = sorted.map(r => {
    const lp = (r.landing_page || '--').replace(/</g, '&lt;');
    const lpDisplay = lp.length > 60 ? lp.slice(0, 57) + '...' : lp;
    const cr = +(r.cr_pct || 0);
    const crColor = cr >= 5 ? Theme.COLORS.success : cr >= 1 ? Theme.COLORS.warning : Theme.COLORS.textMuted;
    const br = +(r.bounce_rate || 0) * 100;
    const er = +(r.engagement_rate || 0) * 100;
    return `<tr>
      <td style="${tdStyle};font-family:Inter,sans-serif;font-weight:500;max-width:320px;overflow:hidden;text-overflow:ellipsis" title="${lp}">${lpDisplay}</td>
      <td style="${tdStyle}">${Theme.num(+r.sessions || 0)}</td>
      <td style="${tdStyle}">${Theme.num(+r.users || 0)}</td>
      <td style="${tdStyle}">${Theme.num(+r.conversions || 0)}</td>
      <td style="${tdStyle};font-weight:600;color:${crColor}">${cr.toFixed(2)}%</td>
      <td style="${tdStyle}">${br.toFixed(1)}%</td>
      <td style="${tdStyle}">${er.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  const headerHtml = `<thead><tr>
    <th style="${thStyle}" data-sort="landing_page">Landing Page</th>
    <th style="${thStyle}" data-sort="sessions">Sessions</th>
    <th style="${thStyle}" data-sort="users">Users</th>
    <th style="${thStyle}" data-sort="conversions">Conv.</th>
    <th style="${thStyle}" data-sort="cr_pct">CR %</th>
    <th style="${thStyle}" data-sort="bounce_rate">Bounce %</th>
    <th style="${thStyle}" data-sort="engagement_rate">Engagement %</th>
  </tr></thead>`;

  const tableWrap = document.createElement('div');
  tableWrap.style.cssText = 'overflow-x:auto';
  tableWrap.innerHTML = `<table style="width:100%;border-collapse:collapse">${headerHtml}<tbody>${rows}</tbody></table>`;
  card.appendChild(tableWrap);

  if (conversionsAllZero) {
    const warn = document.createElement('div');
    warn.style.cssText = `margin-top:12px;font-size:11px;color:${Theme.COLORS.warning};padding:8px 10px;border-left:2px solid ${Theme.COLORS.warning};background:rgba(245,158,11,0.06)`;
    warn.innerHTML = 'Heads up: GA4 conversions are 0 across all LPs in the selected window. Likely a GA4 conversion-event tagging gap (Google Ads conversion may not be configured to fire GA4 events). The session and engagement numbers are still accurate.';
    card.appendChild(warn);
  }

  // Sortable: click any column header to sort by that field
  const thEls = tableWrap.querySelectorAll('th[data-sort]');
  let sortField = 'sessions';
  let sortDir = 'desc';
  thEls.forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (field === sortField) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sortField = field;
        sortDir = 'desc';
      }
      const reSorted = [...lps].sort((a, b) => {
        const av = field === 'landing_page' ? (a[field] || '') : +a[field] || 0;
        const bv = field === 'landing_page' ? (b[field] || '') : +b[field] || 0;
        if (typeof av === 'string') {
          return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
        }
        return sortDir === 'desc' ? bv - av : av - bv;
      });
      const newRows = reSorted.map(r => {
        const lp = (r.landing_page || '--').replace(/</g, '&lt;');
        const lpDisplay = lp.length > 60 ? lp.slice(0, 57) + '...' : lp;
        const cr = +(r.cr_pct || 0);
        const crColor = cr >= 5 ? Theme.COLORS.success : cr >= 1 ? Theme.COLORS.warning : Theme.COLORS.textMuted;
        const br = +(r.bounce_rate || 0) * 100;
        const er = +(r.engagement_rate || 0) * 100;
        return `<tr>
          <td style="${tdStyle};font-family:Inter,sans-serif;font-weight:500;max-width:320px;overflow:hidden;text-overflow:ellipsis" title="${lp}">${lpDisplay}</td>
          <td style="${tdStyle}">${Theme.num(+r.sessions || 0)}</td>
          <td style="${tdStyle}">${Theme.num(+r.users || 0)}</td>
          <td style="${tdStyle}">${Theme.num(+r.conversions || 0)}</td>
          <td style="${tdStyle};font-weight:600;color:${crColor}">${cr.toFixed(2)}%</td>
          <td style="${tdStyle}">${br.toFixed(1)}%</td>
          <td style="${tdStyle}">${er.toFixed(1)}%</td>
        </tr>`;
      }).join('');
      tableWrap.querySelector('tbody').innerHTML = newRows;
    });
  });

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// YouTube Performance Panel
// ---------------------------------------------------------------------------

function _renderYouTubePanel(container, youtube) {
  const card = _googleCard('YouTube Performance');

  if (!youtube || youtube.length === 0) {
    card.innerHTML += `<p style="color:${Theme.COLORS.textMuted};font-size:13px">No YouTube campaigns detected.</p>`;
    container.appendChild(card);
    return;
  }

  const thStyle = `padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:10px 12px;font-size:13px;color:${Theme.COLORS.textPrimary};border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;font-family:'JetBrains Mono',monospace`;

  const rows = youtube.map(r => `<tr>
    <td style="${tdStyle};font-family:Inter,sans-serif;font-weight:500;max-width:280px;overflow:hidden;text-overflow:ellipsis">${r.video_title || '--'}</td>
    <td style="${tdStyle}">${Theme.num(r.video_views || 0)}</td>
    <td style="${tdStyle}">${(+(r.view_rate || 0)).toFixed(1)}%</td>
    <td style="${tdStyle}">${Theme.money(r.cost_per_view || 0)}</td>
    <td style="${tdStyle}">${Theme.money(r.spend || 0)}</td>
    <td style="${tdStyle}">${Theme.num(r.clicks || 0)}</td>
    <td style="${tdStyle}">${Theme.num(r.conversions || 0)}</td>
  </tr>`).join('');

  card.innerHTML += `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="${thStyle}">Video</th>
      <th style="${thStyle}">Views</th>
      <th style="${thStyle}">View Rate</th>
      <th style="${thStyle}">Cost/View</th>
      <th style="${thStyle}">Spend</th>
      <th style="${thStyle}">Clicks</th>
      <th style="${thStyle}">Conv.</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Cross-Platform Comparison (Google vs Meta)
// ---------------------------------------------------------------------------

function _renderCrossPlatform(container, data) {
  const card = _googleCard('Google vs Meta: Platform Comparison');

  if (!data || data.length === 0) {
    card.innerHTML += `<p style="color:${Theme.COLORS.textMuted};font-size:13px">Cross-platform data unavailable.</p>`;
    container.appendChild(card);
    return;
  }

  const google = data.find(r => r.platform === 'Google Ads') || {};
  const meta   = data.find(r => r.platform === 'Meta Ads')   || {};

  const gSpend = +(google.total_spend || 0);
  const mSpend = +(meta.total_spend || 0);
  const totalSpend = gSpend + mSpend;
  const gPct = totalSpend > 0 ? (gSpend / totalSpend * 100).toFixed(0) : 50;
  const mPct = totalSpend > 0 ? (mSpend / totalSpend * 100).toFixed(0) : 50;

  const GOOGLE_COLOR = '#FBBC04';
  const META_COLOR   = '#1877F2';

  function platformCard(name, color, d) {
    const roas = Components.guardROAS(d.roas);
    const roasDisplay = roas === 'N/A' ? 'N/A' : (+roas).toFixed(2) + 'x';
    return `<div style="flex:1;padding:16px;border-radius:8px;border:1px solid ${color}33;background:${color}08">
      <div style="font-size:13px;font-weight:600;color:${color};margin-bottom:12px">${name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:2px">Spend</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.money(d.total_spend || 0)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:2px">Conv.</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.num(d.total_conversions || 0)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:2px">CPA</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${Theme.COLORS.textPrimary}">${Theme.money(d.avg_cpa || 0)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:2px">ROAS</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${Theme.COLORS.textPrimary}">${roasDisplay}</div>
        </div>
      </div>
    </div>`;
  }

  card.innerHTML += `
    <div style="display:flex;gap:16px;margin-bottom:16px">
      ${platformCard('Google Ads', GOOGLE_COLOR, google)}
      ${platformCard('Meta Ads', META_COLOR, meta)}
    </div>
    <div style="margin-top:8px">
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:6px">Spend Share</div>
      <div style="display:flex;height:8px;border-radius:4px;overflow:hidden">
        <div style="width:${gPct}%;background:${GOOGLE_COLOR};transition:width .3s"></div>
        <div style="width:${mPct}%;background:${META_COLOR};transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;font-family:'JetBrains Mono',monospace">
        <span style="color:${GOOGLE_COLOR}">Google ${gPct}%</span>
        <span style="color:${META_COLOR}">Meta ${mPct}%</span>
      </div>
    </div>
  `;

  container.appendChild(card);
}
