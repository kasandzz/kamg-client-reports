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
    aevent: {
      name: 'MA/VSL Sheets (Aevent)',
      steps: [
        'Google Sheets tracked by Franzi/COD team: Aevent registrants, attendees, applications + sheets_ad_daily_stats',
        'BigQuery Connected Sheet (auto-sync)',
        'Tables: fact_aevent_registrants (~188 rows), fact_aevent_attendees (~96 rows), v_sheets_applications_clean (~1,282 rows), sheets_ad_daily_stats',
        'Joins to: fact_bookings (call outcomes), v_stripe_clean (enrollment dollars)',
      ],
      schedule: 'Near-real-time via BigQuery Connected Sheets',
      validate: 'Row count in source Sheet vs BQ; spot-check most recent registration_date against Aevent platform export'
    },
    bq_meta: {
      name: 'BigQuery INFORMATION_SCHEMA',
      steps: [
        'Source: BigQuery INFORMATION_SCHEMA.TABLES on green-segment-491604-j8.cod_warehouse',
        'CF endpoint: meta/dataFreshness returns last_modified_ms per table',
        'Classified client-side by SOURCES regex map (hyros_*, meta_*, stripe_*, etc.)',
        'Per-source SLA thresholds drive Fresh/Stale/Critical states',
      ],
      schedule: 'On-demand (CF queries INFORMATION_SCHEMA live; 5m client cache)',
      validate: 'Compare last_modified_ms vs Cloud Scheduler run logs for each source CF'
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
        { name: 'Enrollments / Cash Collected / ROAS (Cash) / Avg Deal Size / Refund Rate / Ticket-to-Enrollment', type: 'KPI Strip', pipelines: ['stripe', 'meta', 'funnel'], query: 'enrollment.default + enrollment.pipeline', detail: 'Enrollment = Stripe charges > $500 / "succeeded". Cash = SUM(amount_captured). ROAS = cash / Meta spend (v_meta_ads_clean). Avg Deal Size = cash / enrollments. Refund Rate from enrollment.default. Ticket-to-Enrollment % from vw_workshop_funnel_pipeline. Enrollments card includes sparkline of monthly enrollments series.' },
        { name: 'LTV by Enrollment Cohort (Heatmap)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.ltvCohorts', detail: 'Plotly heatmap. Y = cohort_month (last 12), X = LTV window (30d / 60d / 90d / 180d). z = cumulative revenue per enrolled customer cohort. Cohort sizes shown in hover. Empty if no cohort has 30d post-enrollment runway.' },
        { name: 'Revenue by Processor (Doughnut)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.processorBreakdown', detail: 'Doughnut chart of total_revenue grouped by processor (Stripe / Authorize.net / PayPal / Fanbasis). Center label = grand total. Legend shows $ + % of total per processor.' },
        { name: 'Revenue Concentration by Closer', type: 'Cards', pipelines: ['sheets', 'stripe'], query: 'enrollment.jodiConcentration', detail: 'Per-closer cards: closer name, total revenue, enrollment count, % of total. >40% concentration triggers single-point-of-failure danger styling (red border + glow + warning chip). Closer attribution from v_sheets_bookings_clean.team_member.' },
        { name: 'Revenue Protection (Churn Absorption)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.churnAbsorption', detail: 'Mixed bar/line: monthly New Revenue (green bar) + Refund Amount (red bar) on y-axis, Refund Rate % (line) on y1. Footer shows total failed payments across last 12 months.' },
        { name: 'Monthly Enrollments (Bar + Trend)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.monthly', detail: '12-month bar chart of enrollment count with overlaid linear trend line (least-squares fit over the series).' },
        { name: 'Monthly Cash Collected (Bar)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.monthly', detail: '12-month bar chart of revenue (cash) from v_stripe_clean grouped by month.' },
        { name: 'Recent Enrollments (Table)', type: 'Table', pipelines: ['stripe'], query: 'enrollment.recentEnrollments', detail: 'Last 20 Stripe transactions $100+ across all processors. Columns: when (CDMX), customer, email, amount, processor badge, card brand + country, description. Client-side filter pills: All / Tickets / Enrollments classified by description regex.' },
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
    'ma-funnel': {
      title: 'MA/VSL Funnel',
      elements: [
        { name: 'Ad Spend', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'SUM(ad_spend) from sheets_ad_daily_stats for the selected window. MA campaigns ad spend is tracked manually in the daily sheet; not pulled from Meta API (Meta page covers paid social separately).' },
        { name: 'Page Visits', type: 'KPI', pipelines: ['posthog'], query: 'default', detail: 'Placeholder. CAST(NULL AS INT64) in the SQL. Blocked on Rehan PostHog identify() integration (see docs/cod/ma-funnel-posthog-identify-spec.md).' },
        { name: 'Registrations', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'COUNT(*) FROM fact_aevent_registrants WHERE registration_date in window.' },
        { name: 'Applications', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'COUNT(*) FROM v_sheets_applications_clean WHERE application_date in window. Migrated 2026-05-13 from legacy fact_applications.' },
        { name: 'Booked Calls', type: 'KPI', pipelines: ['aevent', 'sheets'], query: 'default', detail: 'COUNT(DISTINCT email) where contact is in BOTH fact_bookings AND fact_aevent_registrants. Excludes $27-sourced bookings.' },
        { name: 'CPBC', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'Calculated: ad_spend / booked_calls. MA-funnel-only cost per booked call.' },
        { name: 'Enrollments', type: 'KPI', pipelines: ['aevent', 'stripe'], query: 'default', detail: 'COUNT(DISTINCT email) where contact in MA registrants AND has a successful Stripe charge >$500 AND booking status not in (no show, cancelled, pending).' },
        { name: 'Cash Collected', type: 'KPI', pipelines: ['stripe', 'aevent'], query: 'default', detail: 'SUM(amount) from v_stripe_clean for the same MA-attributable enrollment set.' },
        { name: 'Contracts', type: 'KPI', pipelines: ['stripe', 'aevent'], query: 'default', detail: 'Same as Cash Collected today; placeholder for future contract-value field (signed vs collected).' },
        { name: 'Cash ROAS', type: 'KPI', pipelines: ['stripe', 'aevent'], query: 'default', detail: 'Calculated: cash_collected / ad_spend.' },
        { name: 'Contract ROAS', type: 'KPI', pipelines: ['stripe', 'aevent'], query: 'default', detail: 'Calculated: contracts / ad_spend (= Cash ROAS until contract field is wired).' },
        { name: 'CAC', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'Calculated: ad_spend / enrollments. MA-funnel customer acquisition cost.' },
        { name: 'Play Rate (Proxy)', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'Proxy until PostHog identify() lands: COUNT(fact_aevent_attendees) / COUNT(fact_aevent_registrants). Labelled "Proxy" in UI.' },
        { name: 'Avg Engagement (Proxy)', type: 'KPI', pipelines: ['aevent'], query: 'default', detail: 'Proxy until PostHog identify() lands: AVG(attendance_seconds) from fact_aevent_attendees. Real gauge will use PostHog watch-time events.' },
        { name: 'Customer Journey Stages', type: 'Funnel', pipelines: ['aevent', 'sheets', 'stripe'], query: 'sankey', detail: '7-stage flow with CVR bars: Page Visits (placeholder) > Registrations > Watched > Applications > Booked Calls > Showed > Enrolled. Each stage card shows volume + CVR to next stage + tracking badge (Full/Partial/Missing).' },
        { name: 'Daily Registrations', type: 'Chart', pipelines: ['aevent'], query: 'registrations', detail: 'Daily bar chart of fact_aevent_registrants grouped by registration_date.' },
        { name: 'Daily Applications', type: 'Chart', pipelines: ['aevent'], query: 'applications', detail: 'Daily bar chart of v_sheets_applications_clean grouped by application_date.' },
      ]
    },
    'attribution': {
      title: 'Attribution',
      elements: [
        { name: 'Total Revenue (Hyros) / Total Sales / Ticket Revenue / Ad Spend (Meta) / Total ROAS / Ticket ROAS', type: 'KPI Strip', pipelines: ['hyros', 'meta'], query: 'default', detail: 'Hyros sales (gross_price) aggregated across all attribution models. Ticket = gross_price <= $100. Spend from v_meta_ads_clean. ROAS = revenue / spend.' },
        { name: 'Model Comparison (Top 8 Sources)', type: 'Chart', pipelines: ['hyros'], query: 'multiModel', detail: 'Grouped bar chart: First-Touch, Last-Touch, and Scientific (50/50 blend) revenue per source. Source = Hyros first_source_name / last_source_name. Top 8 by first-touch revenue.' },
        { name: 'Revenue by Platform (Treemap)', type: 'Chart', pipelines: ['hyros'], query: 'multiModel', detail: 'First-touch revenue grouped into Facebook/Meta, Google, YouTube, Cold Email, Referral, Organic/Direct, Other via classifyPlatform() string match on source name.' },
        { name: 'Reconciliation Gaps', type: 'Table', pipelines: ['hyros'], query: 'multiModel', detail: 'Sources where first-touch and last-touch disagree by >20%. Sources with both revenues <$100 excluded as noise. Kas debugging tool.' },
        { name: 'Source Performance', type: 'Table', pipelines: ['hyros'], query: 'multiModel', detail: 'Top 25 first-touch sources. Splits Sales / Ticket sales (<= $100) / Enrollment sales (> $500) and corresponding revenue columns. Capped at 25 rows.' },
        { name: 'Source Reconciliation Summary', type: 'Panel', pipelines: ['meta', 'hyros'], query: 'multiSource', detail: 'Meta-reported spend vs Hyros first-touch revenue vs Hyros last-touch revenue. Google Ads pending INFRA-04 (blocked on Leo team@ manager account).' },
      ]
    },
    'data-health': {
      title: 'Data Health',
      elements: [
        { name: 'Tables Tracked / Fresh / Stale / Critical / No Data', type: 'KPI Strip', pipelines: ['bq_meta'], query: 'meta/dataFreshness', detail: 'Counts of cod_warehouse tables by status. Status = ageHours vs per-source SLA (warn / crit thresholds defined in data-health.js SOURCES map).' },
        { name: 'ETL Freshness by Source', type: 'Cards', pipelines: ['bq_meta'], query: 'meta/dataFreshness', detail: 'One card per source (Hyros / Meta / Google / Stripe / GHL / PostHog / SendGrid / Sheets / Bison / Mat Views / Other). Each lists matching tables + age + worst-status badge. SLA: Stripe/GHL/PostHog warn 6h crit 24h; Hyros warn 12h crit 24h; Meta/Google/SendGrid warn 36h crit 72h; Sheets warn 168h crit 336h; Bison warn 24h crit 72h; Mat views warn 24h crit 48h.' },
        { name: 'Dashboard Page Coverage', type: 'Table', pipelines: ['bq_meta'], query: 'meta/dataFreshness', detail: 'Cross-reference of Api.PAGE_TABLES map vs INFORMATION_SCHEMA freshness. Sorted by worst-status > oldest age > page name. Surfaces which dashboard pages will show stale data.' },
        { name: 'ETL Run Log', type: 'Placeholder', pipelines: [], query: 'not built', detail: 'Backend pending. Requires etl_run_log BQ table tracking per-sync success/fail/duration history.' },
        { name: 'Cross-Source Reconciliation', type: 'Placeholder', pipelines: [], query: 'not built', detail: 'Backend pending. Requires bridge_data_reconciliation table tracking variance between Stripe / Hyros / Meta / GHL on the same orders.' },
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
