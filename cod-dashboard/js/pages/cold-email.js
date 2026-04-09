/* ============================================
   Cold Email -- EmailBison campaign intelligence
   KPI strip, campaign table, charts, reply tracker,
   domain health, conversion bridge, A/B tests, insights
   ============================================ */

// ---------------------------------------------------------------------------
// Niche color map (consistent across all sections)
// ---------------------------------------------------------------------------
const _CE_NICHE_COLORS = {
  therapists: '#06b6d4',
  attorneys:  '#eab308',
  coaches:    '#22c55e',
  educators:  '#a855f7',
};

const _CE_NICHE_LABELS = {
  therapists: 'Therapists',
  attorneys:  'Attorneys',
  coaches:    'Coaches',
  educators:  'Educators',
};

const _CE_STATUS_COLORS = {
  active:    '#22c55e',
  paused:    '#eab308',
  completed: '#64748b',
  draft:     '#475569',
  error:     '#ef4444',
};

// ---------------------------------------------------------------------------
// Live Data (populated from BQ via API on page load)
// ---------------------------------------------------------------------------
let _CE_CAMPAIGNS = [];
let _CE_REPLIES = [];
let _CE_SENDERS = [];
let _CE_DAILY = [];
let _CE_KPI = {};
let _CE_BRIDGE = [];
let _CE_INDUSTRY = [];
let _CE_REPLY_HOURS = [];
let _CE_META_CPA = [];
let _CE_REPLY_CONVERSIONS = {}; // email -> funnel_stage

// ---------------------------------------------------------------------------
// Page Registration
// ---------------------------------------------------------------------------

App.registerPage('cold-email', async (container) => {
  const days = Filters.getDays();
  container.innerHTML = `<div class="card" style="padding:24px;text-align:center"><p style="color:${Theme.COLORS.textMuted}">Loading cold outbound data...</p></div>`;

  try {
    const [kpiData, campData, replyData, senderData, dailyData, bridgeData, industryData, replyHoursData, metaCpaData, replyConvData] = await Promise.all([
      API.query('cold-email', 'kpis',              { days }),
      API.query('cold-email', 'campaigns',         { days }),
      API.query('cold-email', 'replies',           { days }),
      API.query('cold-email', 'sender_health',     { days }),
      API.query('cold-email', 'daily',             { days }),
      API.query('cold-email', 'bridge',            { days }),
      API.query('cold-email', 'lead_breakdown',    { days }),
      API.query('cold-email', 'reply_hours',       { days: 90 }),
      API.query('cold-email', 'meta_cpa').catch(() => []),
      API.query('cold-email', 'reply_conversions', { days }),
    ]);

    _CE_KPI = (kpiData && kpiData.length > 0) ? kpiData[0] : {};
    _CE_BRIDGE = bridgeData || [];
    _CE_INDUSTRY = industryData || [];

    // Helper: BQ returns dates as {value: "..."} objects
    const _bqVal = (v) => v && typeof v === 'object' && v.value ? v.value : v;

    // Transform BQ campaigns -> shape render functions expect
    _CE_CAMPAIGNS = (campData || []).map(c => ({
      id: c.campaign_id || '',
      name: c.name || '',
      niche: null, // EmailBison doesn't track niche
      status: (c.status || 'active').toLowerCase(),
      leads: c.total_leads || 0,
      sent: c.emails_sent || 0,
      opened: 0, // EmailBison doesn't track opens
      replied: c.unique_replies || 0,
      interested: c.interested || 0,
      bounced: c.bounced || 0,
      unsubscribed: 0,
      steps: [], // No step-level data from EmailBison
    }));

    // Filter out system/bounce/test emails before mapping
    const JUNK_PATTERNS = /mailer-daemon|postmaster|noreply|no-reply|dmarc|abuse@|^google$|^microsoft$|autoresponder/i;
    const replyFiltered = (replyData || []).filter(r => {
      if (r.is_automated || r.reply_type === 'Bounced') return false;
      const email = (r.from_email || '').toLowerCase();
      const name = (r.from_name || '').toLowerCase();
      if (JUNK_PATTERNS.test(email) || JUNK_PATTERNS.test(name)) return false;
      // Filter out DMARC aggregate reports
      if ((r.text_body || '').toLowerCase().includes('dmarc aggregate report')) return false;
      if (name === 'dmarc aggregate report') return false;
      return true;
    });

    // Client-side sentiment override for obvious patterns
    function _detectSentiment(r) {
      const bqSentiment = r.reply_sentiment || 'neutral';
      const body = (r.text_body || '').toLowerCase();
      // OOO / vacation patterns
      if (/out of (the )?office|on vacation|on leave|away from|auto.?reply|automatic reply/i.test(body)) return 'ooo';
      // Unsubscribe / not interested patterns
      if (/unsubscribe|remove me|stop (emailing|contacting)|not interested|do not contact|take me off/i.test(body)) return 'not_interested';
      // Positive interest patterns
      if (/interested|tell me more|love to (hear|learn|chat)|schedule|set up a (call|time|meeting)|sounds good|let'?s (talk|connect|chat)/i.test(body)) return 'interested';
      return bqSentiment;
    }

    // Transform BQ replies -> shape render functions expect
    _CE_REPLIES = replyFiltered.map(r => ({
      contact: { name: r.from_name || r.from_email || 'Unknown', company: r.lead_company || '' },
      campaign_id: r.campaign_id || '',
      niche: null,
      reply_date: _bqVal(r.date_received),
      sentiment: _detectSentiment(r),
      reply_preview: (r.text_body || '').replace(/<[^>]*>/g, '').substring(0, 200),
      conversions: { workshop_reg: false, vip: false, call_booked: false, call_showed: false, enrolled: false },
      current_stage: r.is_interested ? 'Interested' : 'Replied',
      // Extra BQ fields for display
      _title: r.lead_title || '',
      _industry: r.lead_industry || '',
      _campaign_name: r.campaign_name || '',
    }));

    // Transform BQ senders -> shape render functions expect
    _CE_SENDERS = (senderData || []).map(s => ({
      email: s.sender_email || '',
      domain: (s.sender_email || '').split('@')[1] || '',
      status: (s.account_status || 'unknown').toLowerCase(),
      sent_30d: s.emails_sent_count || 0,
      bounce_rate: s.bounce_rate || 0,
      warmup: s.warmup_enabled ? 100 : 0,
      // Extra BQ fields
      _health_score: s.health_score || 0,
      _health_status: s.health_status || '',
      _reply_rate: s.reply_rate || 0,
      _daily_limit: s.daily_limit || 0,
    }));

    // Transform BQ daily -> shape render functions expect
    _CE_DAILY = (dailyData || []).map(d => ({
      date: _bqVal(d.day) || '',
      sent: d.emails_sent || 0,
      opened: 0, // EmailBison doesn't track opens
      replied: d.replies || 0,
      bounced: 0,
    }));

    // Reply hours data
    _CE_REPLY_HOURS = replyHoursData || [];

    // Meta CPA comparison data
    _CE_META_CPA = (metaCpaData || []).map(d => ({
      week: _bqVal(d.week) || '',
      spend: d.total_spend || 0,
      conversions: d.total_conversions || 0,
      cpa: d.cpa || 0,
    }));

    // Build reply conversion lookup (lead_email -> funnel_stage)
    _CE_REPLY_CONVERSIONS = {};
    (replyConvData || []).forEach(rc => {
      if (rc.lead_email && rc.funnel_stage) {
        _CE_REPLY_CONVERSIONS[rc.lead_email.toLowerCase()] = rc.funnel_stage;
      }
    });

    // Enrich replies with conversion data from bridge
    _CE_REPLIES.forEach(r => {
      const email = (r.contact.name.includes('@') ? r.contact.name : '').toLowerCase();
      const stage = _CE_REPLY_CONVERSIONS[email];
      if (stage) {
        if (stage === 'enrolled') {
          r.conversions = { workshop_reg: true, vip: true, call_booked: true, call_showed: true, enrolled: true };
          r.current_stage = 'Enrolled';
        } else if (stage === 'call_booked') {
          r.conversions = { workshop_reg: true, vip: false, call_booked: true, call_showed: false, enrolled: false };
          r.current_stage = 'Call Booked';
        } else if (stage === 'ticket') {
          r.conversions = { workshop_reg: true, vip: false, call_booked: false, call_showed: false, enrolled: false };
          r.current_stage = '$27 Ticket';
        } else if (stage === 'registered') {
          r.conversions = { workshop_reg: true, vip: false, call_booked: false, call_showed: false, enrolled: false };
          r.current_stage = 'Registered';
        }
      }
    });

  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p style="color:${Theme.COLORS.textMuted}">Failed to load cold email data: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  _renderColdEmailKPIs(container);
  _renderCampaignTable(container);
  _renderCampaignCharts(container);
  _renderReplyTracker(container);
  _renderDomainHealth(container);
  _renderConversionBridge(container);
  _renderABTests(container);
  _renderInsights(container);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _ceCard(title, subtitle) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:20px';
  let html = `<div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${title}</div>`;
  if (subtitle) html += `<div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:12px">${subtitle}</div>`;
  else html += `<div style="margin-bottom:12px"></div>`;
  card.innerHTML = html;
  return card;
}

function _ceSectionHeader(container, title, subtitle) {
  const header = document.createElement('div');
  header.style.cssText = 'margin-top:32px;margin-bottom:12px';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:${Theme.COLORS.textPrimary}">${title}</div>
    ${subtitle ? `<div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-top:2px">${subtitle}</div>` : ''}
  `;
  container.appendChild(header);
}

function _ceNichePill(niche) {
  const color = _CE_NICHE_COLORS[niche] || Theme.COLORS.textMuted;
  const label = _CE_NICHE_LABELS[niche] || niche;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;letter-spacing:.03em;background:${color}22;color:${color}">${label}</span>`;
}

function _ceStatusDot(status) {
  const color = _CE_STATUS_COLORS[status] || Theme.COLORS.textMuted;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:${color}"><span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block"></span>${label}</span>`;
}

function _ceSentimentPill(sentiment) {
  const map = {
    interested: { color: '#22c55e', label: 'Interested' },
    not_interested: { color: '#ef4444', label: 'Not Interested' },
    ooo: { color: '#64748b', label: 'OOO' },
    auto_reply: { color: '#475569', label: 'Auto-Reply' },
  };
  const s = map[sentiment] || { color: Theme.COLORS.textMuted, label: sentiment };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${s.color}22;color:${s.color}">${s.label}</span>`;
}

function _ceRelativeDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 7) return diff + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Section 1: KPI Strip
// ---------------------------------------------------------------------------

function _renderColdEmailKPIs(container) {
  const k = _CE_KPI;
  const activeCampaigns = _CE_CAMPAIGNS.filter(c => c.status === 'active').length;

  // Sparkline data from daily BQ data
  const dailySent = _CE_DAILY.map(d => d.sent);
  const dailyReplyRate = _CE_DAILY.map(d => d.sent > 0 ? (d.replied / d.sent) * 100 : 0);
  const dailyReplied = _CE_DAILY.map(d => d.replied);

  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Leads',       value: k.total_leads || 0,         format: 'num',   sparkData: dailySent },
    { label: 'Emails Sent',       value: k.total_sent || 0,          format: 'num',   sparkData: dailySent },
    { label: 'Reply Rate',        value: k.reply_rate || 0,          format: 'pct',   sparkData: dailyReplyRate },
    { label: 'Interested',        value: k.total_interested || 0,    format: 'num',   sparkData: dailyReplied },
    { label: 'Bounce Rate',       value: k.bounce_rate || 0,         format: 'pct' },
    { label: 'Active Campaigns',  value: activeCampaigns,            format: 'num' },
    { label: 'Deliverability',    value: k.deliverability_rate || 0, format: 'pct' },
  ]);
}

// ---------------------------------------------------------------------------
// Section 2: Campaign Performance Table
// ---------------------------------------------------------------------------

let _ceActiveStatus = 'all';

function _renderCampaignTable(container) {
  _ceSectionHeader(container, 'Campaign Performance', 'Live from EmailBison via BigQuery');

  // Filter bar (status only -- niche not available from EmailBison)
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap';

  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = `background:${Theme.COLORS.bgCard};color:${Theme.COLORS.textPrimary};border:1px solid ${Theme.COLORS.border};border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer`;
  statusSelect.innerHTML = `<option value="all">All Statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option>`;
  statusSelect.value = _ceActiveStatus;

  filterBar.appendChild(statusSelect);
  container.appendChild(filterBar);

  const tableContainer = document.createElement('div');
  tableContainer.className = 'card';
  tableContainer.style.cssText = 'padding:0;overflow-x:auto';
  container.appendChild(tableContainer);

  function renderTable() {
    let filtered = _CE_CAMPAIGNS;
    if (_ceActiveStatus !== 'all') filtered = filtered.filter(c => c.status === _ceActiveStatus);

    const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
    const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap`;

    let rowsHtml = '';

    filtered.forEach(c => {
      const replyRate = c.sent > 0 ? ((c.replied / c.sent) * 100).toFixed(1) : '0.0';
      const intRate = c.replied > 0 ? ((c.interested / c.replied) * 100).toFixed(1) : '0.0';
      const bounceRate = c.sent > 0 ? ((c.bounced / c.sent) * 100).toFixed(1) : '0.0';
      const bounceColor = parseFloat(bounceRate) > 3 ? Theme.COLORS.danger : (parseFloat(bounceRate) > 2 ? Theme.COLORS.warning : Theme.COLORS.textSecondary);
      const nameDisplay = c.name.length > 45 ? c.name.slice(0, 45) + '...' : c.name;

      rowsHtml += `<tr style="cursor:pointer" class="ce-campaign-row" data-id="${c.id}">
        <td style="${tdStyle};color:${Theme.COLORS.textPrimary};font-weight:500;font-family:Inter,sans-serif" title="${c.name}">${nameDisplay}</td>
        <td style="${tdStyle}">${_ceStatusDot(c.status)}</td>
        <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.leads)}</td>
        <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.sent)}</td>
        <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.replied)} <span style="color:${Theme.COLORS.textMuted};font-size:11px">${replyRate}%</span></td>
        <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.interested)} <span style="color:${Theme.COLORS.textMuted};font-size:11px">${intRate}%</span></td>
        <td style="${tdStyle};font-family:'JetBrains Mono',monospace;color:${bounceColor}">${bounceRate}%</td>
      </tr>`;
    });

    tableContainer.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle}">Campaign</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Leads</th>
          <th style="${thStyle}">Sent</th>
          <th style="${thStyle}">Replied</th>
          <th style="${thStyle}">Interested</th>
          <th style="${thStyle}">Bounced</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    // Drill-down on row click
    tableContainer.querySelectorAll('.ce-campaign-row').forEach(row => {
      row.addEventListener('click', () => {
        const campId = row.dataset.id;
        const camp = _CE_CAMPAIGNS.find(c => c.id === campId);
        if (!camp) return;

        Components.openDrillDown(camp.name, async () => {
          const replies = _CE_REPLIES.filter(r => r.campaign_id === campId);
          let html = `<div style="padding:4px 0">`;

          // Sequence steps
          html += `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:12px">Sequence Steps</div>`;
          if (camp.steps.length === 0) {
            html += `<div style="color:${Theme.COLORS.textMuted};font-size:12px;margin-bottom:20px">No steps configured (draft campaign)</div>`;
          } else {
            html += `<table style="width:100%;border-collapse:collapse;margin-bottom:20px">`;
            html += `<thead><tr><th style="padding:6px 10px;font-size:10px;color:${Theme.COLORS.textMuted};text-align:left">Step</th><th style="padding:6px 10px;font-size:10px;color:${Theme.COLORS.textMuted};text-align:left">Subject</th><th style="padding:6px 10px;font-size:10px;color:${Theme.COLORS.textMuted};text-align:right">Sent</th><th style="padding:6px 10px;font-size:10px;color:${Theme.COLORS.textMuted};text-align:right">Replied</th></tr></thead><tbody>`;
            camp.steps.forEach(s => {
              const rate = s.sent > 0 ? ((s.replied / s.sent) * 100).toFixed(1) : '0.0';
              html += `<tr><td style="padding:8px 10px;font-size:12px;color:${Theme.COLORS.textPrimary}">#${s.step}</td><td style="padding:8px 10px;font-size:12px;color:${Theme.COLORS.textSecondary}">${s.subject}</td><td style="padding:8px 10px;font-size:12px;font-family:'JetBrains Mono',monospace;text-align:right">${Theme.num(s.sent)}</td><td style="padding:8px 10px;font-size:12px;font-family:'JetBrains Mono',monospace;text-align:right">${s.replied} <span style="color:${Theme.COLORS.textMuted};font-size:10px">${rate}%</span></td></tr>`;
            });
            html += `</tbody></table>`;
          }

          // Recent replies
          html += `<div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:12px">Recent Replies (${replies.length})</div>`;
          if (replies.length === 0) {
            html += `<div style="color:${Theme.COLORS.textMuted};font-size:12px">No replies yet</div>`;
          } else {
            replies.slice(0, 5).forEach(r => {
              const borderColor = _CE_NICHE_COLORS[r.niche] || Theme.COLORS.accent;
              html += `<div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid ${borderColor}">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="font-size:12px;font-weight:600;color:${Theme.COLORS.textPrimary}">${r.contact.name}</span>
                  ${_ceSentimentPill(r.sentiment)}
                </div>
                <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:4px">${r.contact.company}</div>
                <div style="font-size:12px;color:${Theme.COLORS.textSecondary};font-style:italic">"${r.reply_preview}"</div>
              </div>`;
            });
          }

          html += `</div>`;
          return html;
        });
      });
    });
  }

  renderTable();

  statusSelect.addEventListener('change', () => { _ceActiveStatus = statusSelect.value; renderTable(); });
}

// ---------------------------------------------------------------------------
// Section 3: Campaign Analytics Charts
// ---------------------------------------------------------------------------

function _renderCampaignCharts(container) {
  _ceSectionHeader(container, 'Campaign Analytics', 'Visual breakdown of cold email performance');

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px';
  container.appendChild(grid);

  // -- Chart 1: Reply Rate by Campaign (horizontal bar) --
  const replyCard = _ceCard('Reply Rate by Campaign');
  const replyCanvas = document.createElement('canvas');
  replyCanvas.id = 'ce-reply-rate-chart';
  replyCanvas.style.height = '280px';
  replyCard.appendChild(replyCanvas);
  grid.appendChild(replyCard);

  const activeCampaigns = _CE_CAMPAIGNS.filter(c => c.sent > 0).sort((a, b) => (b.replied / b.sent) - (a.replied / a.sent));

  Theme.createChart('ce-reply-rate-chart', {
    type: 'bar',
    data: {
      labels: activeCampaigns.map(c => c.name.length > 40 ? c.name.slice(0, 40) + '...' : c.name),
      datasets: [{
        data: activeCampaigns.map(c => ((c.replied / c.sent) * 100).toFixed(2)),
        backgroundColor: activeCampaigns.map(c => (_CE_NICHE_COLORS[c.niche] || Theme.COLORS.accent) + 'cc'),
        borderRadius: 4,
        barThickness: 22,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.raw + '% reply rate' } },
        annotation: {
          annotations: {
            benchmark: {
              type: 'line',
              xMin: 2.0, xMax: 2.0,
              borderColor: Theme.COLORS.warning + '88',
              borderWidth: 1,
              borderDash: [4, 4],
              label: { display: true, content: '2% benchmark', position: 'start', font: { size: 10 }, color: Theme.COLORS.warning },
            },
          },
        },
      },
      scales: {
        x: { grid: { color: Theme.COLORS.gridLine }, ticks: { callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  });

  // -- Chart 2: Send Volume Over Time (area chart) --
  const volumeCard = _ceCard('Send Volume Over Time');
  const volumeCanvas = document.createElement('canvas');
  volumeCanvas.id = 'ce-volume-chart';
  volumeCanvas.style.height = '280px';
  volumeCard.appendChild(volumeCanvas);
  grid.appendChild(volumeCard);

  Theme.createChart('ce-volume-chart', {
    type: 'line',
    data: {
      labels: _CE_DAILY.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }),
      datasets: [{
        label: 'Emails Sent',
        data: _CE_DAILY.map(d => d.sent),
        borderColor: Theme.COLORS.accent,
        backgroundColor: Theme.COLORS.accent + '18',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      }, {
        label: 'Replies',
        data: _CE_DAILY.map(d => d.replied),
        borderColor: Theme.COLORS.success,
        backgroundColor: Theme.COLORS.success + '18',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        yAxisID: 'y1',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle' } } },
      scales: {
        x: { grid: { color: Theme.COLORS.gridLine }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
        y: { grid: { color: Theme.COLORS.gridLine }, title: { display: true, text: 'Sent', font: { size: 10 } } },
        y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Replies', font: { size: 10 } } },
      },
    },
  });

  // -- Chart 3: Cold Email Funnel (without Sent -- too large, skews chart) --
  const funnelCard = _ceCard('Cold Email Funnel');
  const funnelCanvas = document.createElement('canvas');
  funnelCanvas.id = 'ce-funnel-chart';
  funnelCanvas.style.height = '200px';
  funnelCard.appendChild(funnelCanvas);
  grid.appendChild(funnelCard);

  const campaigns = _CE_CAMPAIGNS.filter(c => c.sent > 0);
  const bridgeByStage = {};
  _CE_BRIDGE.forEach(b => { bridgeByStage[b.funnel_stage] = b.lead_count || 0; });
  const funnelStages = [
    { label: 'Replied', value: campaigns.reduce((s, c) => s + c.replied, 0) },
    { label: 'Interested', value: campaigns.reduce((s, c) => s + c.interested, 0) },
    { label: 'Registered', value: bridgeByStage['registered'] || 0 },
    { label: 'Call Booked', value: bridgeByStage['call_booked'] || 0 },
    { label: 'Enrolled', value: bridgeByStage['enrolled'] || 0 },
  ];

  const funnelColors = ['#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#eab308', '#f97316'];

  Theme.createChart('ce-funnel-chart', {
    type: 'bar',
    data: {
      labels: funnelStages.map(s => s.label),
      datasets: [{
        data: funnelStages.map(s => s.value),
        backgroundColor: funnelColors.map(c => c + 'cc'),
        borderRadius: 4,
        barThickness: 32,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const idx = ctx.dataIndex;
              if (idx === 0) return '';
              const prev = funnelStages[idx - 1].value;
              const rate = prev > 0 ? ((funnelStages[idx].value / prev) * 100).toFixed(1) : '0.0';
              return rate + '% conversion from ' + funnelStages[idx - 1].label;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: Theme.COLORS.gridLine } },
      },
    },
  });

  // Conversion rate labels below funnel
  const rateRow = document.createElement('div');
  rateRow.style.cssText = 'display:flex;justify-content:space-around;padding:8px 0;font-size:10px;color:' + Theme.COLORS.textMuted;
  funnelStages.forEach((s, i) => {
    const prev = i > 0 ? funnelStages[i - 1].value : null;
    const rate = prev ? ((s.value / prev) * 100).toFixed(1) + '%' : '';
    rateRow.innerHTML += `<span style="text-align:center">${rate}</span>`;
  });
  funnelCard.appendChild(rateRow);

  // -- Reply Hour Distribution (inline in same grid, next to funnel) --
  if (_CE_REPLY_HOURS.length === 0) return;
  const hourCard = _ceCard('Replies by Hour of Day', 'Human replies vs automated/bounced');
  const hourCanvas = document.createElement('canvas');
  hourCanvas.id = 'ce-reply-hours-chart';
  hourCanvas.style.height = '280px';
  hourCard.appendChild(hourCanvas);
  grid.appendChild(hourCard);

  // Fill in missing hours with 0
  const hourMap = {};
  _CE_REPLY_HOURS.forEach(h => { hourMap[h.hour] = h; });
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = hourMap[i] || { hour: i, total_replies: 0, human_replies: 0, interested_replies: 0 };
    return h;
  });

  const hourLabels = hours.map(h => {
    const ampm = h.hour >= 12 ? 'PM' : 'AM';
    const hr = h.hour % 12 || 12;
    return hr + ampm;
  });

  Theme.createChart('ce-reply-hours-chart', {
    type: 'bar',
    data: {
      labels: hourLabels,
      datasets: [{
        label: 'Human Replies',
        data: hours.map(h => h.human_replies),
        backgroundColor: Theme.COLORS.accent + 'cc',
        borderRadius: 3,
      }, {
        label: 'Automated/Bounce',
        data: hours.map(h => h.total_replies - h.human_replies),
        backgroundColor: Theme.COLORS.textMuted + '66',
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { mode: 'index' },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { color: Theme.COLORS.gridLine } },
      },
    },
  });

  // -- CPA Comparison (if Meta data available) --
  if (_CE_META_CPA.length > 0) {
    const cpaCard = _ceCard('CPA Comparison: Cold Email vs Meta Ads', 'Weekly cost per acquisition');
    const cpaCanvas = document.createElement('canvas');
    cpaCanvas.id = 'ce-cpa-compare-chart';
    cpaCanvas.style.height = '280px';
    cpaCard.appendChild(cpaCanvas);
    grid.appendChild(cpaCard);

    Theme.createChart('ce-cpa-compare-chart', {
      type: 'line',
      data: {
        labels: _CE_META_CPA.map(d => {
          const dt = new Date(d.week);
          return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        datasets: [{
          label: 'Meta Ads CPA',
          data: _CE_META_CPA.map(d => d.cpa > 0 ? d.cpa.toFixed(2) : null),
          borderColor: Theme.COLORS.warning,
          backgroundColor: Theme.COLORS.warning + '18',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': $' + ctx.raw } },
        },
        scales: {
          x: { grid: { color: Theme.COLORS.gridLine } },
          y: { grid: { color: Theme.COLORS.gridLine }, ticks: { callback: v => '$' + v } },
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Section 4: Reply Tracker
// ---------------------------------------------------------------------------

function _renderReplyTracker(container) {
  _ceSectionHeader(container, 'Reply Tracker', 'Contact-level replies with conversion event tracking');

  // Search + filter bar
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:center';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by name or company...';
  searchInput.style.cssText = `background:${Theme.COLORS.bgCard};color:${Theme.COLORS.textPrimary};border:1px solid ${Theme.COLORS.border};border-radius:6px;padding:6px 12px;font-size:12px;width:220px`;

  const sentimentSelect = document.createElement('select');
  sentimentSelect.style.cssText = `background:${Theme.COLORS.bgCard};color:${Theme.COLORS.textPrimary};border:1px solid ${Theme.COLORS.border};border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer`;
  sentimentSelect.innerHTML = `<option value="all">All Sentiments</option><option value="interested">Interested</option><option value="not_interested">Not Interested</option><option value="ooo">OOO</option><option value="auto_reply">Auto-Reply</option>`;

  // Notification toggle
  const notifyLabel = document.createElement('label');
  notifyLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:' + Theme.COLORS.textSecondary + ';cursor:pointer;margin-left:auto';
  const notifyCb = document.createElement('input');
  notifyCb.type = 'checkbox';
  notifyCb.id = 'ce-notify-toggle';
  notifyCb.style.cssText = 'accent-color:#22c55e;cursor:pointer';
  notifyLabel.appendChild(notifyCb);
  notifyLabel.appendChild(document.createTextNode('Notify on interested replies'));
  // Bell icon
  const bellIcon = document.createElement('span');
  bellIcon.textContent = '\uD83D\uDD14';
  bellIcon.style.fontSize = '14px';
  notifyLabel.insertBefore(bellIcon, notifyLabel.firstChild);

  filterBar.appendChild(searchInput);
  filterBar.appendChild(sentimentSelect);
  filterBar.appendChild(notifyLabel);
  container.appendChild(filterBar);

  // Notification sound (short ding via Web Audio API)
  let _audioCtx = null;
  function _playDing() {
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, _audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.3, _audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.5);
      osc.start(_audioCtx.currentTime);
      osc.stop(_audioCtx.currentTime + 0.5);
    } catch (e) { /* silent fail if audio blocked */ }
  }

  // Track seen replies to detect new ones
  let _seenReplyIds = new Set(_CE_REPLIES.map(r => r.contact.name + '|' + r.reply_date));

  // Request notification permission when toggled on
  notifyCb.addEventListener('change', () => {
    if (notifyCb.checked && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (notifyCb.checked) localStorage.setItem('ce-notify-interested', '1');
    else localStorage.removeItem('ce-notify-interested');
  });
  // Restore state from localStorage
  if (localStorage.getItem('ce-notify-interested') === '1') notifyCb.checked = true;

  // Poll for new interested replies every 60s
  let _notifyInterval = null;
  function _startNotifyPolling() {
    if (_notifyInterval) return;
    _notifyInterval = setInterval(async () => {
      if (!notifyCb.checked) return;
      try {
        const freshReplies = await API.query('cold-outbound', 'replies', { days: 1 });
        if (!freshReplies) return;
        const JUNK = /mailer-daemon|postmaster|noreply|no-reply|dmarc|abuse@|^google$|^microsoft$|autoresponder/i;
        freshReplies.forEach(r => {
          const email = (r.from_email || '').toLowerCase();
          const name = (r.from_name || '').toLowerCase();
          if (JUNK.test(email) || JUNK.test(name)) return;
          const id = (r.from_name || r.from_email) + '|' + (r.date_received && r.date_received.value ? r.date_received.value : r.date_received);
          if (_seenReplyIds.has(id)) return;
          _seenReplyIds.add(id);
          // Check if interested
          const body = (r.text_body || '').toLowerCase();
          const isInterested = r.is_interested || /interested|tell me more|schedule|set up a (call|time)|sounds good|let'?s (talk|connect|chat)/i.test(body);
          if (!isInterested) return;
          // Fire notification
          _playDing();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Interested Reply!', {
              body: (r.from_name || r.from_email) + (r.lead_company ? ' at ' + r.lead_company : '') + ' replied with interest',
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="%2322c55e"/><text x="16" y="22" text-anchor="middle" fill="white" font-size="20">✓</text></svg>',
            });
          }
        });
      } catch (e) { /* silent */ }
    }, 60000);
  }
  _startNotifyPolling();

  const tableContainer = document.createElement('div');
  tableContainer.className = 'card';
  tableContainer.style.cssText = 'padding:0;overflow-x:auto';
  container.appendChild(tableContainer);

  function renderReplies() {
    let filtered = [..._CE_REPLIES];
    const q = searchInput.value.toLowerCase();
    if (q) filtered = filtered.filter(r => r.contact.name.toLowerCase().includes(q) || r.contact.company.toLowerCase().includes(q));
    if (sentimentSelect.value !== 'all') filtered = filtered.filter(r => r.sentiment === sentimentSelect.value);

    const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
    const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04)`;

    const convBadge = (label, done) => {
      const bg = done ? '#22c55e22' : 'rgba(255,255,255,0.04)';
      const color = done ? '#22c55e' : '#475569';
      const icon = done ? '&#10003;' : '&#8211;';
      return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;background:${bg};color:${color};margin-right:3px" title="${label}">${icon} ${label}</span>`;
    };

    const rows = filtered.map(r => {
      const campName = r._campaign_name || r.campaign_id || '--';
      const campDisplay = campName.length > 25 ? campName.slice(0, 25) + '...' : campName;
      const title = r._title || '';

      return `<tr style="cursor:pointer" class="ce-reply-row" data-contact="${r.contact.name}">
        <td style="${tdStyle}">
          <div style="font-weight:600;color:${Theme.COLORS.textPrimary};font-size:13px">${r.contact.name}</div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted}">${r.contact.company}${title ? ' -- ' + title : ''}</div>
        </td>
        <td style="${tdStyle};font-size:12px;color:${Theme.COLORS.textSecondary}" title="${campName}">${campDisplay}</td>
        <td style="${tdStyle};font-size:12px;color:${Theme.COLORS.textSecondary}">${_ceRelativeDate(r.reply_date)}</td>
        <td style="${tdStyle}">${_ceSentimentPill(r.sentiment)}</td>
        <td style="${tdStyle};white-space:nowrap">
          ${convBadge('Reg', r.conversions.workshop_reg)}${convBadge('Booked', r.conversions.call_booked)}${convBadge('Enrolled', r.conversions.enrolled)}
        </td>
        <td style="${tdStyle};font-size:12px;color:${Theme.COLORS.textSecondary}">${r.current_stage}</td>
      </tr>`;
    }).join('');

    tableContainer.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle}">Contact</th>
          <th style="${thStyle}">Campaign</th>
          <th style="${thStyle}">Reply Date</th>
          <th style="${thStyle}">Sentiment</th>
          <th style="${thStyle}">Funnel Events</th>
          <th style="${thStyle}">Stage</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Drill-down on reply row click
    tableContainer.querySelectorAll('.ce-reply-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.dataset.contact;
        const reply = _CE_REPLIES.find(r => r.contact.name === name);
        if (!reply) return;

        Components.openDrillDown(reply.contact.name, async () => {
          return `<div style="padding:4px 0">
            <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:4px">${reply.contact.name}</div>
            <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:16px">${reply.contact.company}</div>
            <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:8px">Reply</div>
            <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid ${Theme.COLORS.accent};margin-bottom:16px">
              <div style="font-size:12px;color:${Theme.COLORS.textSecondary};font-style:italic;line-height:1.5">"${reply.reply_preview}"</div>
              <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px">${reply.reply_date}${reply._campaign_name ? ' &middot; ' + reply._campaign_name : ''}</div>
            </div>
            <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:8px">Journey</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${convBadge('Registered', reply.conversions.workshop_reg)}
              ${convBadge('Call Booked', reply.conversions.call_booked)}
              ${convBadge('Call Showed', reply.conversions.call_showed)}
              ${convBadge('Enrolled', reply.conversions.enrolled)}
            </div>
            <div style="margin-top:16px;font-size:12px;color:${Theme.COLORS.textSecondary}">Sentiment: <span style="font-weight:600;color:${Theme.COLORS.textPrimary}">${reply.sentiment}</span> &middot; Stage: <span style="font-weight:600;color:${Theme.COLORS.textPrimary}">${reply.current_stage}</span></div>
          </div>`;
        });
      });
    });
  }

  renderReplies();
  searchInput.addEventListener('input', renderReplies);
  sentimentSelect.addEventListener('change', renderReplies);
}

// ---------------------------------------------------------------------------
// Section 5: Domain Health
// ---------------------------------------------------------------------------

function _renderDomainHealth(container) {
  _ceSectionHeader(container, 'Sender Infrastructure', 'Domain health and deliverability monitoring');

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:0;overflow-x:auto';

  const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04)`;

  const rows = _CE_SENDERS.map(s => {
    const bounceColor = s.bounce_rate > 3 ? Theme.COLORS.danger : (s.bounce_rate > 2 ? Theme.COLORS.warning : Theme.COLORS.success);
    const healthScore = s._health_score || 0;
    const warmupPct = healthScore > 0 ? Math.min(healthScore, 100) : Math.min(s.warmup, 100);
    const warmupBarColor = warmupPct >= 70 ? Theme.COLORS.success : (warmupPct >= 40 ? Theme.COLORS.warning : Theme.COLORS.danger);

    return `<tr>
      <td style="${tdStyle};font-family:'JetBrains Mono',monospace;font-size:12px;color:${Theme.COLORS.textPrimary}">${s.email}</td>
      <td style="${tdStyle};color:${Theme.COLORS.textSecondary}">${s.domain}</td>
      <td style="${tdStyle}">${_ceStatusDot(s.status)}</td>
      <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(s.sent_30d)}</td>
      <td style="${tdStyle};font-family:'JetBrains Mono',monospace;color:${bounceColor};font-weight:600">${s.bounce_rate.toFixed(1)}%</td>
      <td style="${tdStyle}">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
            <div style="width:${warmupPct}%;height:100%;background:${warmupBarColor};border-radius:3px;transition:width 0.3s"></div>
          </div>
          <span style="font-size:11px;color:${Theme.COLORS.textMuted};font-family:'JetBrains Mono',monospace;min-width:32px">${warmupPct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  card.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${thStyle}">Sender Account</th>
        <th style="${thStyle}">Domain</th>
        <th style="${thStyle}">Status</th>
        <th style="${thStyle}">Sent (30d)</th>
        <th style="${thStyle}">Bounce Rate</th>
        <th style="${thStyle};min-width:160px">Warmup Progress</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Section 6: Conversion Bridge
// ---------------------------------------------------------------------------

function _renderConversionBridge(container) {
  _ceSectionHeader(container, 'Cold Email → COD Funnel', 'How cold outreach prospects enter the pipeline');

  if (_CE_BRIDGE.length === 0) {
    const empty = _ceCard('No Bridge Data Yet');
    empty.innerHTML += `<div style="text-align:center;padding:24px;color:${Theme.COLORS.textMuted};font-size:13px">Cold email leads haven't been matched to the COD funnel yet. Bridge VIEW will populate as leads enter the pipeline.</div>`;
    container.appendChild(empty);
    return;
  }

  const stageColors = {
    enrolled: Theme.COLORS.success,
    call_booked: '#06b6d4',
    ticket: '#a855f7',
    registered: '#eab308',
    not_in_funnel: Theme.COLORS.textMuted,
  };

  const stageLabels = {
    enrolled: 'Enrolled',
    call_booked: 'Call Booked',
    ticket: '$27 Ticket',
    registered: 'Registered',
    not_in_funnel: 'Not in Funnel',
  };

  // Metric cards from bridge data
  const cardGrid = document.createElement('div');
  cardGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:16px';

  const metricCard = (label, value, subtitle) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:20px;text-align:center';
    card.innerHTML = `
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${label}</div>
      <div style="font-size:28px;font-weight:700;color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace">${value}</div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:4px">${subtitle}</div>
    `;
    return card;
  };

  _CE_BRIDGE.forEach(b => {
    const label = stageLabels[b.funnel_stage] || b.funnel_stage;
    const color = stageColors[b.funnel_stage] || Theme.COLORS.textMuted;
    const rev = b.total_revenue > 0 ? Theme.money(b.total_revenue) + ' revenue' : `${b.revenue_leads || 0} with revenue`;
    cardGrid.appendChild(metricCard(label, Theme.num(b.lead_count || 0), rev));
  });

  container.appendChild(cardGrid);

  // Bridge bar chart
  const chartCard = _ceCard('Funnel Stage Distribution');
  const chartCanvas = document.createElement('canvas');
  chartCanvas.id = 'ce-bridge-chart';
  chartCanvas.style.height = '220px';
  chartCard.appendChild(chartCanvas);
  container.appendChild(chartCard);

  const bridgeColors = ['#22c55e', '#06b6d4', '#a855f7', '#eab308', '#64748b', '#ef4444'];

  Theme.createChart('ce-bridge-chart', {
    type: 'bar',
    data: {
      labels: _CE_BRIDGE.map(b => stageLabels[b.funnel_stage] || b.funnel_stage),
      datasets: [{
        data: _CE_BRIDGE.map(b => b.lead_count || 0),
        backgroundColor: _CE_BRIDGE.map((_, i) => (bridgeColors[i] || '#64748b') + 'cc'),
        borderRadius: 4,
        barThickness: 32,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const b = _CE_BRIDGE[ctx.dataIndex];
              return b && b.total_revenue > 0 ? 'Revenue: ' + Theme.money(b.total_revenue) : '';
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: Theme.COLORS.gridLine } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Section 7: A/B Tests
// ---------------------------------------------------------------------------

function _renderABTests(container) {
  _ceSectionHeader(container, 'A/B Tests', 'Subject line and copy variant performance');

  // Collect all steps with A/B variants
  const tests = [];
  _CE_CAMPAIGNS.forEach(c => {
    c.steps.forEach(s => {
      if (s.variant_a && s.variant_b) {
        const aReplyRate = s.variant_a.sent > 0 ? (s.variant_a.replied / s.variant_a.sent * 100) : 0;
        const bReplyRate = s.variant_b.sent > 0 ? (s.variant_b.replied / s.variant_b.sent * 100) : 0;
        const aOpenRate = s.variant_a.sent > 0 ? (s.variant_a.opened / s.variant_a.sent * 100) : 0;
        const bOpenRate = s.variant_b.sent > 0 ? (s.variant_b.opened / s.variant_b.sent * 100) : 0;
        const winner = Math.abs(aReplyRate - bReplyRate) < 0.3 ? 'running' : (aReplyRate > bReplyRate ? 'a' : 'b');

        tests.push({
          campaign: c.name,
          niche: c.niche,
          step: s.step,
          a_subject: s.variant_a.subject,
          b_subject: s.variant_b.subject,
          a_open: aOpenRate,
          b_open: bOpenRate,
          a_reply: aReplyRate,
          b_reply: bReplyRate,
          a_sent: s.variant_a.sent,
          b_sent: s.variant_b.sent,
          winner,
        });
      }
    });
  });

  if (tests.length === 0) {
    const empty = _ceCard('No A/B Tests Running');
    empty.innerHTML += `<div style="text-align:center;padding:24px;color:${Theme.COLORS.textMuted};font-size:13px">No campaigns have active A/B test variants</div>`;
    container.appendChild(empty);
    return;
  }

  // Table
  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:0;overflow-x:auto;margin-bottom:16px';

  const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:12px 14px;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04)`;

  const rows = tests.map(t => {
    const winBadge = t.winner === 'a' ? `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#22c55e22;color:#22c55e">A</span>`
      : t.winner === 'b' ? `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#22c55e22;color:#22c55e">B</span>`
      : `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:#eab30822;color:#eab308">Running</span>`;

    const boldA = t.winner === 'a' ? 'font-weight:700' : '';
    const boldB = t.winner === 'b' ? 'font-weight:700' : '';
    const campShort = t.campaign.length > 25 ? t.campaign.slice(0, 25) + '...' : t.campaign;

    return `<tr>
      <td style="${tdStyle};color:${Theme.COLORS.textSecondary}" title="${t.campaign}">${campShort}</td>
      <td style="${tdStyle};text-align:center;color:${Theme.COLORS.textPrimary}">#${t.step}</td>
      <td style="${tdStyle};color:${Theme.COLORS.textSecondary};max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${t.a_subject}">${t.a_subject}</td>
      <td style="${tdStyle};color:${Theme.COLORS.textSecondary};max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${t.b_subject}">${t.b_subject}</td>
      <td style="${tdStyle};text-align:center">${winBadge}</td>
      <td style="${tdStyle};font-family:'JetBrains Mono',monospace;text-align:center"><span style="${boldA}">${t.a_open.toFixed(1)}%</span> / <span style="${boldB}">${t.b_open.toFixed(1)}%</span></td>
      <td style="${tdStyle};font-family:'JetBrains Mono',monospace;text-align:center"><span style="${boldA}">${t.a_reply.toFixed(1)}%</span> / <span style="${boldB}">${t.b_reply.toFixed(1)}%</span></td>
      <td style="${tdStyle};font-family:'JetBrains Mono',monospace;text-align:center">${t.a_sent + t.b_sent}</td>
    </tr>`;
  }).join('');

  card.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${thStyle}">Campaign</th>
        <th style="${thStyle};text-align:center">Step</th>
        <th style="${thStyle}">Variant A</th>
        <th style="${thStyle}">Variant B</th>
        <th style="${thStyle};text-align:center">Winner</th>
        <th style="${thStyle};text-align:center">Open Rate (A/B)</th>
        <th style="${thStyle};text-align:center">Reply Rate (A/B)</th>
        <th style="${thStyle};text-align:center">Sample</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  container.appendChild(card);

  // Paired bar chart for reply rates
  const chartCard = _ceCard('A/B Reply Rate Comparison');
  const chartCanvas = document.createElement('canvas');
  chartCanvas.id = 'ce-ab-chart';
  chartCanvas.style.height = '220px';
  chartCard.appendChild(chartCanvas);
  container.appendChild(chartCard);

  Theme.createChart('ce-ab-chart', {
    type: 'bar',
    data: {
      labels: tests.map(t => {
        const short = t.campaign.length > 15 ? t.campaign.slice(0, 15) + '...' : t.campaign;
        return short + ' #' + t.step;
      }),
      datasets: [
        { label: 'Variant A', data: tests.map(t => t.a_reply.toFixed(2)), backgroundColor: Theme.COLORS.accent + 'cc', borderRadius: 4 },
        { label: 'Variant B', data: tests.map(t => t.b_reply.toFixed(2)), backgroundColor: Theme.COLORS.accentLight + 'cc', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.raw + '% reply rate' } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: Theme.COLORS.gridLine }, ticks: { callback: v => v + '%' } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Section 8: Cross-Channel Insights
// ---------------------------------------------------------------------------

function _renderInsights(container) {
  _ceSectionHeader(container, 'Intelligence', 'Data-driven insights from live EmailBison data');

  // -- 8a: Industry Performance Matrix (replaces niche matrix with BQ data) --
  if (_CE_INDUSTRY.length > 0) {
    const matrixCard = _ceCard('Industry Performance', 'Lead volume and reply rates by industry segment');

    const thStyle = `padding:10px 14px;text-align:center;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
    const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-family:'JetBrains Mono',monospace`;

    const maxLeads = Math.max(..._CE_INDUSTRY.map(i => i.total_leads || 0), 1);
    const maxRate = Math.max(..._CE_INDUSTRY.map(i => i.reply_rate || 0), 1);

    const matrixRows = _CE_INDUSTRY.slice(0, 12).map(ind => {
      const leadPct = ((ind.total_leads || 0) / maxLeads);
      const ratePct = ((ind.reply_rate || 0) / maxRate);
      const leadAlpha = (0.08 + leadPct * 0.25).toFixed(2);
      const rateAlpha = (0.08 + ratePct * 0.25).toFixed(2);
      return `<tr>
        <td style="${tdStyle};text-align:left;color:${Theme.COLORS.textPrimary}">${ind.industry}</td>
        <td style="${tdStyle};background:rgba(59,130,246,${leadAlpha})">${Theme.num(ind.total_leads || 0)}</td>
        <td style="${tdStyle}">${ind.replied_leads || 0}</td>
        <td style="${tdStyle};background:rgba(34,197,94,${rateAlpha})">${(ind.reply_rate || 0).toFixed(1)}%</td>
        <td style="${tdStyle}">${(ind.avg_engagement || 0).toFixed(1)}</td>
      </tr>`;
    }).join('');

    matrixCard.innerHTML += `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle};text-align:left">Industry</th>
          <th style="${thStyle}">Total Leads</th>
          <th style="${thStyle}">Replied</th>
          <th style="${thStyle}">Reply Rate</th>
          <th style="${thStyle}">Avg Engagement</th>
        </tr></thead>
        <tbody>${matrixRows}</tbody>
      </table>
    `;
    container.appendChild(matrixCard);
  }

  // -- 8b: Campaign Intelligence Cards (derived from live data) --
  const insightsGrid = document.createElement('div');
  insightsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';

  const insightCard = (title, body, accentColor) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `padding:20px;border-left:3px solid ${accentColor}`;
    card.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:8px">${title}</div>
      <div style="font-size:12px;color:${Theme.COLORS.textSecondary};line-height:1.6">${body}</div>
    `;
    return card;
  };

  // Best campaign by reply rate
  const activeCamps = _CE_CAMPAIGNS.filter(c => c.sent > 0);
  if (activeCamps.length > 0) {
    const best = activeCamps.reduce((a, b) => (b.replied / b.sent) > (a.replied / a.sent) ? b : a);
    const bestRate = ((best.replied / best.sent) * 100).toFixed(1);
    insightsGrid.appendChild(insightCard(
      'Top Campaign',
      `<span style="color:${Theme.COLORS.accent};font-weight:700">${best.name}</span> has the highest reply rate at <span style="color:${Theme.COLORS.success};font-weight:700">${bestRate}%</span> across ${Theme.num(best.sent)} emails sent.`,
      Theme.COLORS.accent
    ));
  }

  // Reply quality
  const interestedReplies = _CE_REPLIES.filter(r => r.sentiment === 'interested' || r.current_stage === 'Interested').length;
  const totalReplies = _CE_REPLIES.length;
  if (totalReplies > 0) {
    const intPct = ((interestedReplies / totalReplies) * 100).toFixed(0);
    insightsGrid.appendChild(insightCard(
      'Reply Quality',
      `<span style="color:${Theme.COLORS.success};font-weight:700">${intPct}%</span> of human replies show interest (${interestedReplies} of ${totalReplies}). The rest are declines, OOO, or neutral responses.`,
      Theme.COLORS.success
    ));
  }

  // Sender health
  const healthySenders = _CE_SENDERS.filter(s => s._health_score >= 70).length;
  const totalSenders = _CE_SENDERS.length;
  if (totalSenders > 0) {
    const healthPct = ((healthySenders / totalSenders) * 100).toFixed(0);
    insightsGrid.appendChild(insightCard(
      'Sender Infrastructure',
      `<span style="color:${healthySenders === totalSenders ? Theme.COLORS.success : Theme.COLORS.warning};font-weight:700">${healthySenders}/${totalSenders}</span> sender accounts are healthy (${healthPct}%). Monitor accounts with high bounce rates.`,
      healthySenders === totalSenders ? Theme.COLORS.success : Theme.COLORS.warning
    ));
  }

  // Top industry
  if (_CE_INDUSTRY.length > 0) {
    const topInd = _CE_INDUSTRY[0];
    insightsGrid.appendChild(insightCard(
      'Largest Industry Segment',
      `<span style="color:${Theme.COLORS.accent};font-weight:700">${topInd.industry}</span> has ${Theme.num(topInd.total_leads)} leads with a <span style="font-weight:700">${(topInd.reply_rate || 0).toFixed(1)}%</span> reply rate.`,
      Theme.COLORS.accent
    ));
  }

  // Meta CPA vs cold email cost
  if (_CE_META_CPA.length > 0) {
    const latestCpa = _CE_META_CPA[_CE_META_CPA.length - 1];
    if (latestCpa.cpa > 0) {
      insightsGrid.appendChild(insightCard(
        'Meta Ads CPA Benchmark',
        `Latest Meta Ads CPA is <span style="color:${Theme.COLORS.warning};font-weight:700">$${latestCpa.cpa.toFixed(0)}</span> per conversion. Track cold email cost per reply to compare channel efficiency.`,
        Theme.COLORS.warning
      ));
    }
  }

  // Peak reply hour
  if (_CE_REPLY_HOURS.length > 0) {
    const peakHour = _CE_REPLY_HOURS.reduce((best, h) => h.human_replies > best.human_replies ? h : best, _CE_REPLY_HOURS[0]);
    const ampm = peakHour.hour >= 12 ? 'PM' : 'AM';
    const hr = peakHour.hour % 12 || 12;
    insightsGrid.appendChild(insightCard(
      'Peak Prospect Reply Time',
      `Most human replies arrive at <span style="color:${Theme.COLORS.accent};font-weight:700">${hr}:00 ${ampm} UTC</span> (${peakHour.human_replies} replies). Optimize send timing to land in inbox 1-2 hours before this window.`,
      Theme.COLORS.accent
    ));
  }

  container.appendChild(insightsGrid);
}
