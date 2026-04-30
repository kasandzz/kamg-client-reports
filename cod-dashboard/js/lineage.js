/* ============================================
   Lineage -- Data source legend for every page.
   Auto-injected at page bottom by Shell.
   ============================================ */

const Lineage = (() => {

  // ---- ETL Pipeline stages (shared across all tables) ----
  const PIPELINES = {
    ghl: {
      name: 'GoHighLevel CRM',
      steps: [
        'GHL CRM (source of truth for contacts, tags, UTMs)',
        'Cloud Function: ghl-sync extracts contacts + transactions via GHL API',
        'BigQuery: ghl_contacts / ghl_transactions (raw, ~19K contacts)',
        'View: v_ghl_clean (deduped by email, test records excluded, email normalized)',
      ],
      schedule: 'Every 6h via Cloud Scheduler',
      validate: 'Compare GHL contact count vs v_ghl_clean row count; check loaded_at recency'
    },
    stripe: {
      name: 'Stripe Payments',
      steps: [
        'Stripe dashboard (source of truth for all payments)',
        'Cloud Function: stripe-sync pulls charges via Stripe API',
        'BigQuery: stripe_charges (~52K rows, ~$103M total)',
        'View: v_stripe_clean (test-excluded, seconds_since_prev for double-charge detection)',
      ],
      schedule: 'Every 6h via Cloud Scheduler',
      validate: 'Stripe dashboard total vs SUM(amount_captured) in v_stripe_clean'
    },
    meta: {
      name: 'Meta Ads (Facebook/Instagram)',
      steps: [
        'Meta Ads Manager (account act_206306693361622)',
        'Cloud Function: meta-sync pulls insights via Meta Marketing API',
        'BigQuery: meta_ad_performance (campaign/adset/ad level daily metrics)',
        'View: v_meta_ads_clean (filtered to active account, date-bounded)',
      ],
      schedule: 'Every 6h via Cloud Scheduler',
      validate: 'Meta Ads Manager spend vs SUM(spend) in meta_ad_performance for same date range'
    },
    hyros: {
      name: 'Hyros Attribution',
      steps: [
        'Hyros tracking pixel + server postbacks (tracks $27 ticket attribution, NOT high-ticket enrollment)',
        'Cloud Function: hyros-sync pulls leads + sales via Hyros API',
        'BigQuery: hyros_leads (~30K), hyros_sales (~4K), hyros_calls',
        'View: v_hyros_clean (deduped, email normalized)',
      ],
      schedule: 'Every 6h via Cloud Scheduler',
      validate: 'Hyros dashboard revenue vs SUM(revenue) in hyros_sales; note: Hyros tracks tickets only, enrollment attribution is modeled'
    },
    sheets: {
      name: 'Google Sheets (Manual Tracking)',
      steps: [
        'Google Sheets: "Booked Calls" tab (filled by sales team + Franzi)',
        'BigQuery Connected Sheet (auto-sync to sheets_bookings)',
        'View: v_sheets_bookings_clean (deduped by email, most recent booking wins)',
      ],
      schedule: 'Near-real-time via BigQuery Connected Sheets',
      validate: 'Row count in Google Sheet vs sheets_bookings; check for email mismatches or blank rows'
    },
    sendgrid: {
      name: 'SendGrid Email',
      steps: [
        'SendGrid (blast/newsletter email delivery)',
        'Cloud Function: sendgrid-sync pulls message events via SendGrid API',
        'BigQuery: sendgrid_messages (delivery, open, click, bounce events)',
      ],
      schedule: 'Every 6h via Cloud Scheduler',
      validate: 'SendGrid dashboard stats vs aggregated sendgrid_messages for same period'
    },
    posthog: {
      name: 'PostHog Analytics',
      steps: [
        'PostHog JS snippet on COD pages (pageviews, clicks, scroll depth)',
        'PostHog warehouse export or API pull',
        'BigQuery: posthog_events',
      ],
      schedule: 'Dependent on PostHog export config',
      validate: 'PostHog dashboard event count vs COUNT(*) in posthog_events'
    },
    cold_outbound: {
      name: 'EmailBison (Cold Outbound)',
      steps: [
        'EmailBison platform (managed by Vovik/Chapters Agency)',
        'Cloud Function: emailbison-sync pulls campaigns, leads, replies via EmailBison API',
        'BigQuery: cold_outbound_campaigns, cold_outbound_leads, cold_outbound_replies',
        'Views: v_cold_outbound_replies_clean, v_cold_outbound_leads_clean, v_cold_outbound_sender_health',
        'Bridge: v_cold_outbound_to_cod_bridge (joins cold leads to master_customers by email)',
      ],
      schedule: 'Every 6h via Cloud Scheduler + real-time webhook for new replies',
      validate: 'EmailBison dashboard campaign stats vs cold_outbound_campaigns totals'
    },
    master: {
      name: 'Master Customers (Identity Resolution)',
      steps: [
        'All source systems feed unique emails into all_emails union',
        'View: master_customers joins GHL + Hyros + Stripe + Sheets by email',
        'Auto-segments: customer > enrolled > vip_attendee > workshop_attendee > applicant > registrant > lead',
        'Attribution: Hyros first/last touch preferred, GHL UTMs as fallback',
      ],
      schedule: 'Real-time VIEW (recomputed on every query)',
      validate: 'SELECT COUNT(*) FROM master_customers; check segment distribution; verify call_booked_date IS NOT NULL count'
    },
    funnel: {
      name: 'Workshop Funnel Pipeline',
      steps: [
        'Source: master_customers + Stripe + Sheets (stage flags)',
        'View: vw_workshop_funnel_pipeline (one row per contact with boolean stage flags)',
        'Stages: reached_ticket > reached_attended > reached_vip > reached_booked > reached_call > reached_enrolled',
        'Velocity: days_to_book, days_to_enroll, hours_to_book computed per contact',
      ],
      schedule: 'Real-time VIEW (recomputed on every query)',
      validate: 'SUM(reached_ticket::INT) should match v_stripe_clean ticket count for period'
    },
    geo: {
      name: 'Geo Revenue (Materialized)',
      steps: [
        'Source: master_customers + Stripe + Meta Ads (city-level)',
        'Materialized table: mat_geo_revenue (precomputed city/state rollup)',
      ],
      schedule: 'Refreshed periodically via scheduled query',
      validate: 'SUM(revenue) in mat_geo_revenue vs SUM in master_customers'
    },
    customer_events: {
      name: 'Customer Events (Unified Timeline)',
      steps: [
        'Source: 12 event types from GHL, Stripe, Sheets, Hyros, SendGrid',
        'View: customer_events (one row per event with normalized schema)',
      ],
      schedule: 'Real-time VIEW',
      validate: 'SELECT event_type, COUNT(*) FROM customer_events GROUP BY 1'
    },
  };

  // ---- Per-page element lineage ----
  const PAGES = {
    'war-room': {
      title: 'War Room',
      elements: [
        { name: 'Gross Revenue', type: 'KPI', pipelines: ['stripe'], query: 'default', detail: 'SUM(amount_captured) from Stripe charges WHERE status=succeeded. Includes $27 tickets + high-ticket enrollment payments.' },
        { name: 'ROAS', type: 'KPI', pipelines: ['hyros', 'meta'], query: 'default', detail: 'SUM(hyros_sales.revenue) / SUM(meta_ads_insights.spend). Hyros attributes ticket revenue only; enrollment ROAS is modeled from proportional spend share.' },
        { name: 'Enrollments', type: 'KPI', pipelines: ['hyros'], query: 'default', detail: 'COUNT(DISTINCT sale_id) WHERE product_type != "ticket" from Hyros sales.' },
        { name: 'Cost per Booking', type: 'KPI', pipelines: ['meta', 'stripe'], query: 'default', detail: 'SUM(ad_spend) / COUNT(Stripe charges at $27). Booking = $27 ticket purchase.' },
        { name: 'CPA (Enrollment)', type: 'KPI', pipelines: ['meta', 'hyros'], query: 'default', detail: 'SUM(ad_spend) / COUNT(enrollment_id). Meta spend divided by Hyros enrollment count.' },
        { name: 'CPM', type: 'KPI', pipelines: ['meta'], query: 'default', detail: '(SUM(spend) / SUM(impressions)) * 1000 across all active Meta campaigns.' },
        { name: 'Channel Performance', type: 'Table', pipelines: ['hyros', 'sheets'], query: 'sourcesAttrib + bookings', detail: 'Hyros first/last/scientific attribution model splits revenue by source channel. Tickets=$27/$54 (Stripe-verified). Enrollments=sales>$500. ROAS=proportional spend share. Bookings from sheets_bookings.' },
        { name: 'Daily Trend Table', type: 'Table', pipelines: ['stripe', 'sheets', 'meta'], query: 'dailyTable', detail: 'Daily row: tickets from Stripe, VIP from Stripe ($54), bookings from Sheets, ad spend from Meta. CPB and rates computed.' },
        { name: 'Wins / Leaks', type: 'Signals', pipelines: ['stripe', 'meta', 'hyros', 'sheets'], query: 'default', detail: 'Period-over-period delta detection. >5% swing in any KPI triggers win (positive) or leak (negative). Absolute targets: show rate 65%, close rate 25%, ROAS 3.0x.' },
        { name: 'Closer Performance', type: 'Table', pipelines: ['sheets'], query: 'closers', detail: 'Per-closer breakdown from v_sheets_bookings_clean: total calls, closed, no-shows, close rate. team_member field from Google Sheet.' },
        { name: 'Sales Hierarchy', type: 'Drill-down', pipelines: ['hyros', 'meta'], query: 'salesHierarchy', detail: 'Campaign > Adset > Ad tree. Hyros sales joined to Meta ad names. Supports first/last/scientific attribution toggle.' },
      ]
    },
    'ads-meta': {
      title: 'Meta Ads',
      elements: [
        { name: 'Spend / Impressions / Clicks / CTR / CPM / CPC', type: 'KPI Strip', pipelines: ['meta'], query: 'default', detail: 'Account-level aggregation from meta_ad_performance for act_206306693361622.' },
        { name: 'Campaign Breakdown', type: 'Table', pipelines: ['meta'], query: 'campaigns', detail: 'Campaign-level: spend, impressions, clicks, CTR, CPC, CPM, conversions, revenue, ROAS.' },
        { name: 'Ad Set ROAS Ranking', type: 'Table', pipelines: ['meta'], query: 'adsets', detail: 'Ad set level: spend, clicks, conversions, revenue, ROAS. Sorted by ROAS desc.' },
        { name: 'Daily Trend', type: 'Chart', pipelines: ['meta'], query: 'daily', detail: 'Daily spend, clicks, CTR, CPM line chart.' },
        { name: 'Unit Economics', type: 'Panel', pipelines: ['stripe', 'meta'], query: 'unitEcon', detail: 'Stripe ticket count + AOV merged with Meta spend for CPA calculation.' },
        { name: 'Campaign Status', type: 'Table', pipelines: ['meta'], query: 'campaignStatus', detail: 'Active vs paused at campaign/adset/ad level with last active date and 30-day spend.' },
      ]
    },
    'cold-email': {
      title: 'Cold Email',
      elements: [
        { name: 'Emails Sent / Reply Rate / Interested / Bounce Rate', type: 'KPI Strip', pipelines: ['cold_outbound'], query: 'kpis', detail: 'Aggregate from cold_outbound_campaigns: SUM(sent), SUM(replied)/SUM(contacted), SUM(interested), SUM(bounced)/SUM(sent).' },
        { name: 'Campaign Table', type: 'Table', pipelines: ['cold_outbound'], query: 'campaigns', detail: 'All EmailBison campaigns with reply rate, bounce rate, completion %.' },
        { name: 'Reply Feed', type: 'Feed', pipelines: ['cold_outbound'], query: 'replies', detail: 'Last 100 replies joined with lead company/industry and campaign name. Includes sentiment and interest flag.' },
        { name: 'Cold Email Funnel', type: 'Chart', pipelines: ['cold_outbound', 'master'], query: 'bridge', detail: 'v_cold_outbound_to_cod_bridge: joins cold_outbound_leads to master_customers by email. Stages: replied > interested > registered > call_booked > enrolled.' },
        { name: 'Sender Health', type: 'Table', pipelines: ['cold_outbound'], query: 'sender_health', detail: 'Per-sender account: daily limit, emails sent, reply/bounce rate, health score from v_cold_outbound_sender_health.' },
        { name: 'Industry Breakdown', type: 'Chart', pipelines: ['cold_outbound'], query: 'lead_breakdown', detail: 'Leads grouped by industry with reply rate and engagement score from v_cold_outbound_leads_clean.' },
        { name: 'Reply Hour Distribution', type: 'Chart', pipelines: ['cold_outbound'], query: 'reply_hours', detail: '90-day reply distribution by hour: total, human, interested replies.' },
        { name: 'Meta CPA Comparison', type: 'Panel', pipelines: ['meta'], query: 'meta_cpa', detail: 'Weekly Meta Ads CPA for cost-per-lead comparison against cold email channel.' },
      ]
    },
    'funnels': {
      title: '$27 Workshop Funnel',
      elements: [
        { name: 'Show Rate / Booking Rate / Close Rate', type: 'KPI Strip', pipelines: ['funnel'], query: 'default', detail: 'Boolean stage flags from vw_workshop_funnel_pipeline: reached_attended / reached_ticket = show rate, etc.' },
        { name: 'Daily Funnel Breakdown', type: 'Chart', pipelines: ['funnel'], query: 'daily', detail: 'Current vs previous period: daily tickets, attended, booked, enrolled counts.' },
        { name: 'Weekly Funnel', type: 'Chart', pipelines: ['funnel'], query: 'weekly', detail: 'Weekly tickets, attended, booked, enrolled per ISO week.' },
      ]
    },
    'revenue': {
      title: 'Revenue & LTV',
      elements: [
        { name: 'Enrollments / Cash Collected / Avg Deal Size / Refund Rate / ROAS', type: 'KPI Strip', pipelines: ['stripe', 'meta'], query: 'default', detail: 'Enrollment = Stripe charges > $500. Cash = SUM(amount_captured). ROAS = cash / Meta spend.' },
        { name: 'Monthly Trend', type: 'Chart', pipelines: ['stripe'], query: 'monthly', detail: 'Monthly enrollment count and revenue from v_stripe_clean.' },
        { name: 'Pipeline Conversion', type: 'Panel', pipelines: ['funnel'], query: 'pipeline', detail: 'Total tickets to enrolled conversion rate from vw_workshop_funnel_pipeline.' },
      ]
    },
    'email-intel': {
      title: 'Email',
      elements: [
        { name: 'Sent / Delivered / Opened / Clicked / Bounced / Rates', type: 'KPI Strip', pipelines: ['sendgrid'], query: 'default', detail: 'Aggregated from sendgrid_messages: delivery, open, click, bounce events.' },
        { name: 'Daily Performance', type: 'Chart', pipelines: ['sendgrid'], query: 'daily', detail: 'Daily sent, delivered, opened, bounced.' },
        { name: 'Subject Line Performance', type: 'Table', pipelines: ['sendgrid'], query: 'subjects', detail: 'Top 20 subjects ranked by open rate with sent, opened, clicked counts.' },
      ]
    },
    'journey-explorer': {
      title: 'Journey Explorer',
      elements: [
        { name: 'Funnel Stage Counts', type: 'Funnel', pipelines: ['funnel'], query: 'default', detail: 'Full pipeline: tickets > attended > VIP > booked > calls > enrolled. Boolean stage flags from vw_workshop_funnel_pipeline.' },
      ]
    },
    'live-feed': {
      title: 'Live Feed',
      elements: [
        { name: 'Event Stream', type: 'Feed', pipelines: ['customer_events'], query: 'default', detail: 'Last 100 events from customer_events VIEW. 12 event types unified from all source systems.' },
      ]
    },
    'sales-team': {
      title: 'Sales Team',
      elements: [
        { name: 'Per-Closer Performance', type: 'Table', pipelines: ['sheets'], query: 'default', detail: 'Per team_member: total calls, showed, closed, no-shows, close rate, show rate from v_sheets_bookings_clean.' },
        { name: 'Monthly Trend', type: 'Table', pipelines: ['sheets'], query: 'monthly', detail: 'Monthly per-closer: calls, closed, close rate.' },
      ]
    },
    'geo-intel': {
      title: 'Geo Intel',
      elements: [
        { name: 'City Revenue Map', type: 'Map', pipelines: ['geo'], query: 'default', detail: 'Top 100 cities by revenue from mat_geo_revenue (materialized from master_customers + Stripe + Meta).' },
        { name: 'State Rollup', type: 'Table', pipelines: ['geo'], query: 'states', detail: 'Top 15 states: revenue, spend, enrollments, tickets, ROAS.' },
        { name: 'Dead Zones', type: 'Table', pipelines: ['geo'], query: 'deadZones', detail: 'Cities with >$500 ad spend but zero enrollments -- wasted geo targeting.' },
      ]
    },
    'segments': {
      title: 'Segments',
      elements: [
        { name: 'Segment Breakdown', type: 'Chart', pipelines: ['master'], query: 'N/A (client-side)', detail: 'Auto-derived segments from master_customers: customer, enrolled, vip_attendee, workshop_attendee, applicant, registrant, lead.' },
      ]
    },
    'experiments': {
      title: 'Experiments',
      elements: [
        { name: 'Experiment Registry', type: 'Table', pipelines: [], query: 'default', detail: 'Placeholder -- experiment_registry table not yet created. Returns zeroes.' },
      ]
    },
    'journey-stage': {
      title: 'Journey Stages',
      elements: [
        { name: 'Stage 1: Ad Campaigns', type: 'Table', pipelines: ['meta'], query: 'stage_1', detail: 'Meta campaigns: spend, impressions, clicks for the period.' },
        { name: 'Stage 2: Page Views', type: 'Table', pipelines: ['posthog'], query: 'stage_2', detail: 'PostHog page-level: pageviews, unique visitors, scroll depth.' },
        { name: 'Stage 3: Ticket Purchase', type: 'Table', pipelines: ['stripe'], query: 'stage_3', detail: 'Stripe ticket purchases: daily count and revenue.' },
        { name: 'Stage 4: Workshop Attendance', type: 'Table', pipelines: ['funnel'], query: 'stage_4', detail: 'Show rate from vw_workshop_funnel_pipeline.' },
        { name: 'Stage 5: VIP Upgrade', type: 'Table', pipelines: ['funnel'], query: 'stage_5', detail: 'VIP take rate from vw_workshop_funnel_pipeline.' },
        { name: 'Stage 6: Call Booking', type: 'Table', pipelines: ['sheets'], query: 'stage_6', detail: 'Daily bookings from v_sheets_bookings_clean.' },
        { name: 'Stage 7: Call Outcome', type: 'Table', pipelines: ['sheets'], query: 'stage_7', detail: 'Per-closer show/close rates from v_sheets_bookings_clean.' },
        { name: 'Stage 8: Enrollment', type: 'Table', pipelines: ['stripe'], query: 'stage_8', detail: 'Monthly enrollment count and revenue from v_stripe_clean.' },
      ]
    },
  };

  // ---- Render legend into a container ----
  function render(pageName) {
    const page = PAGES[pageName];
    if (!page) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'lineage-legend';
    wrapper.innerHTML = _buildHTML(page, pageName);

    // Rotate chevron when outer <details> opens/closes
    const details = wrapper.querySelector('details.lineage-dropdown');
    if (details) {
      details.addEventListener('toggle', () => {
        const chevron = details.querySelector('.lineage-chevron');
        if (chevron) chevron.textContent = details.open ? '\u25BC' : '\u25B6';
      });
    }

    // Toggle expand/collapse for inner pipeline sections
    wrapper.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-lineage-toggle]');
      if (toggle) {
        const target = toggle.nextElementSibling;
        if (target) {
          const isOpen = target.style.display !== 'none';
          target.style.display = isOpen ? 'none' : 'block';
          toggle.querySelector('.lineage-arrow').textContent = isOpen ? '\u25B6' : '\u25BC';
        }
      }
    });

    return wrapper;
  }

  function _buildHTML(page, pageName) {
    const muted = Theme.COLORS.textMuted;
    const secondary = Theme.COLORS.textSecondary;
    const border = 'rgba(255,255,255,0.06)';

    let html = `
      <div style="border-top:1px solid ${border};margin-top:32px;padding-top:20px">
        <details class="lineage-dropdown">
          <summary style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:8px 0;list-style:none;user-select:none">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="lineage-chevron" style="font-size:10px;color:${muted};transition:transform .2s">\u25B6</span>
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${muted}">
                Data Lineage & Sources
              </span>
            </div>
            <div style="font-size:10px;color:${muted}">
              ${page.elements.length} data element${page.elements.length !== 1 ? 's' : ''} on this page
            </div>
          </summary>
          <div style="padding-top:12px">
    `;

    // Element table
    html += `<div style="display:grid;gap:2px;margin-bottom:20px">`;
    html += `<div style="display:grid;grid-template-columns:minmax(140px,1fr) 80px minmax(100px,1fr) 2fr;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:4px 4px 0 0">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${muted}">Element</div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${muted}">Type</div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${muted}">Sources</div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${muted}">Calculation / Logic</div>
    </div>`;

    page.elements.forEach((el, i) => {
      const bg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)';
      const sourceNames = el.pipelines.map(p => PIPELINES[p] ? PIPELINES[p].name : p).join(', ') || 'N/A';
      const sourceBadges = el.pipelines.map(p => {
        const color = _pipelineColor(p);
        return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;background:${color}20;color:${color};margin-right:3px;margin-bottom:2px">${PIPELINES[p] ? PIPELINES[p].name.split(' ')[0] : p}</span>`;
      }).join('') || '<span style="font-size:10px;color:' + muted + '">--</span>';

      html += `<div style="display:grid;grid-template-columns:minmax(140px,1fr) 80px minmax(100px,1fr) 2fr;gap:8px;padding:6px 8px;background:${bg};border-radius:2px;align-items:start">
        <div style="font-size:11px;color:${secondary};font-weight:500">${_esc(el.name)}</div>
        <div style="font-size:10px;color:${muted}">${_esc(el.type)}</div>
        <div>${sourceBadges}</div>
        <div style="font-size:10px;color:${muted};line-height:1.5">${_esc(el.detail)}</div>
      </div>`;
    });
    html += '</div>';

    // Pipeline details (collapsible)
    const usedPipelines = new Set();
    page.elements.forEach(el => el.pipelines.forEach(p => usedPipelines.add(p)));

    if (usedPipelines.size > 0) {
      html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${muted};margin-bottom:10px">
        Data Pipelines Used on This Page
      </div>`;

      [...usedPipelines].sort().forEach(pKey => {
        const p = PIPELINES[pKey];
        if (!p) return;
        const color = _pipelineColor(pKey);

        html += `
          <div style="margin-bottom:8px;border:1px solid ${border};border-radius:6px;overflow:hidden">
            <div data-lineage-toggle style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:rgba(255,255,255,0.02)">
              <span class="lineage-arrow" style="font-size:10px;color:${muted};width:12px">\u25B6</span>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
              <span style="font-size:12px;font-weight:600;color:${secondary}">${_esc(p.name)}</span>
              <span style="font-size:10px;color:${muted};margin-left:auto">${_esc(p.schedule)}</span>
            </div>
            <div style="display:none;padding:8px 12px 12px 32px;font-size:11px;color:${muted};line-height:1.8">
              <div style="margin-bottom:8px">
                ${p.steps.map((s, i) => `<div style="display:flex;align-items:flex-start;gap:8px">
                  <span style="color:${color};flex-shrink:0">${i < p.steps.length - 1 ? '\u2502' : '\u2514'}</span>
                  <span>${_esc(s)}</span>
                </div>`).join('')}
              </div>
              <div style="padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:4px;font-size:10px">
                <strong style="color:${secondary}">Validate:</strong> ${_esc(p.validate)}
              </div>
            </div>
          </div>
        `;
      });
    }

    // Cloud Function schedule summary
    html += `
      <div style="margin-top:16px;padding:10px 12px;background:rgba(255,255,255,0.02);border-radius:6px;border:1px solid ${border}">
        <div style="font-size:10px;color:${muted};line-height:1.7">
          <strong style="color:${secondary}">ETL Schedule:</strong> Cloud Functions sync GHL, Stripe, Meta, Hyros, SendGrid, EmailBison every 6h. Cloud Function API caches results for 6h (server-side). Dashboard client caches for 5m (client-side). Views are real-time (recomputed on query).
          <br><strong style="color:${secondary}">Identity Resolution:</strong> master_customers joins all systems by LOWER(TRIM(email)). Segments auto-derived from funnel position. Attribution prefers Hyros first/last touch, falls back to GHL UTMs.
          <br><strong style="color:${secondary}">Known Limitations:</strong> Hyros tracks $27 ticket attribution only, NOT high-ticket enrollments. GHL API lacks workflow execution + email analytics. PostHog identify() integration incomplete. EmailBison API lacks open rates, niche labels, and per-step data.
        </div>
      </div>
    `;

    html += '</div></details></div>';
    return html;
  }

  function _pipelineColor(key) {
    const colors = {
      ghl: '#8b5cf6',
      stripe: '#6366f1',
      meta: '#1877F2',
      hyros: '#f59e0b',
      sheets: '#22c55e',
      sendgrid: '#3b82f6',
      posthog: '#f97316',
      cold_outbound: '#06b6d4',
      master: '#a855f7',
      funnel: '#14b8a6',
      geo: '#84cc16',
      customer_events: '#ec4899',
    };
    return colors[key] || '#64748b';
  }

  function _esc(str) {
    const div = document.createElement('span');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render, PIPELINES, PAGES };
})();
