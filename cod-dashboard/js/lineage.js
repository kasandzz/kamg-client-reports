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
        { name: 'Total Spend / ROAS / CPM / CPC / CTR / Cost Per Ticket', type: 'KPI Strip', pipelines: ['meta', 'stripe'], query: 'default', detail: 'Account-level aggregation from v_meta_ads_clean for act_206306693361622. Cost Per Ticket = spend / Stripe ticket count. Spend card shows daily sparkline. Prior-period deltas from 2x-window query.' },
        { name: 'ROAS by Ad Set (Top 5 + Bottom 5)', type: 'Chart', pipelines: ['meta'], query: 'adsets', detail: 'Plotly horizontal bar. Color-coded by ROAS tier (green >= 3x, amber 1-3x, red < 1x). Surfaces highest and lowest performers in same view.' },
        { name: 'Daily Spend & CTR (Dual-Axis)', type: 'Chart', pipelines: ['meta'], query: 'daily', detail: 'Chart.js mixed: bars for daily spend (y-axis), line for CTR (y1-axis). Compare toggle overlays prior period.' },
        { name: 'Campaign Performance Table', type: 'Table', pipelines: ['meta'], query: 'campaigns', detail: 'Campaign-level: spend, impressions, clicks, CTR, CPC, CPM, conversions, revenue, ROAS. Grouped by niche tag (therapists / attorneys / coaches / educators / broad) + status filter. Row drill-down to ad sets.' },
        { name: 'Unit Economics Panel', type: 'Panel', pipelines: ['stripe', 'meta'], query: 'unitEcon', detail: 'Editable inputs: ticket price / cogs / margin / 12-month LTV. Computes breakeven and 12-month gravy. Meta spend + Stripe ticket count are read-only sources.' },
        { name: 'Retargeting Performance', type: 'Table', pipelines: ['meta'], query: 'retargeting', detail: 'Spend, conversions, CPA, ROAS, frequency per retargeting campaign. Frequency >2.5 flagged as fatigue risk.' },
        { name: 'Wasted Spend Alerts', type: 'Signals', pipelines: ['meta'], query: 'wastedSpend', detail: 'Campaigns with >$200 spend and zero conversions in window. Surfaces immediate kill-or-fix candidates.' },
        { name: 'Creative Fatigue Watch', type: 'Table', pipelines: ['meta'], query: 'creativeFatigue', detail: 'Ad sets with declining CTR: current avg CTR, % change vs prior, spend during decline. Identifies creative refresh priority.' },
        { name: 'Source Attribution Table', type: 'Table', pipelines: ['meta', 'hyros'], query: 'sourceAttribution', detail: 'Hyros-attributed sources cross-referenced with Meta spend. Per-source CAC and ROAS using Hyros revenue divided by Meta spend share.' },
        { name: 'Age x Gender Heatmap', type: 'Chart', pipelines: ['meta'], query: 'demographicsAgeGender', detail: 'Plotly heatmap. ROAS color, spend + revenue on hover. Sourced from meta_demographics_age_gender breakdown.' },
        { name: 'Device Split (Donut + Table)', type: 'Chart', pipelines: ['meta'], query: 'demographicsDevice', detail: 'Spend share donut + per-device conversion/ROAS table. Sourced from meta_demographics_device breakdown (mobile / desktop / tablet).' },
        { name: 'Spend x ROAS Scatter', type: 'Chart', pipelines: ['meta'], query: 'scatterAdSets', detail: 'Log-scale scatter: x = spend, y = ROAS, bubble size = conversions. Quadrant labels (scale, optimize, kill, test) for tactical decisions.' },
        { name: 'Campaign Staleness', type: 'Table', pipelines: ['meta'], query: 'staleness', detail: 'Active vs paused at campaign/adset/ad level. Last active date, 30d spend, days since last edit. Flags zombie campaigns burning budget.' },
      ]
    },
    'cold-email': {
      title: 'Cold Email',
      elements: [
        { name: 'Emails Sent / Reply Rate / Interested / Bounce Rate', type: 'KPI Strip', pipelines: ['cold_outbound'], query: 'kpis', detail: 'Aggregate from cold_outbound_campaigns: SUM(sent), SUM(replied)/SUM(contacted), SUM(interested), SUM(bounced)/SUM(sent). Prior-period deltas from 2x-window query.' },
        { name: 'Daily Send + Reply Trend', type: 'Chart', pipelines: ['cold_outbound'], query: 'daily', detail: 'Daily line/bar: sends, replies, interested replies. Surfaces deliverability dips and reply-rate decay.' },
        { name: 'Campaign Table', type: 'Table', pipelines: ['cold_outbound'], query: 'campaigns', detail: 'All EmailBison campaigns with reply rate, bounce rate, completion %. Sortable; status filter (active / paused / completed).' },
        { name: 'Reply Feed', type: 'Feed', pipelines: ['cold_outbound'], query: 'replies', detail: 'Last 100 replies joined with lead company/industry and campaign name. Includes sentiment and interest flag.' },
        { name: 'Cold Email Funnel', type: 'Chart', pipelines: ['cold_outbound', 'master'], query: 'bridge', detail: 'v_cold_outbound_to_cod_bridge: joins cold_outbound_leads to master_customers by email. Stages: replied > interested > registered > call_booked > enrolled.' },
        { name: 'Reply-to-Booking Conversion', type: 'Table', pipelines: ['cold_outbound', 'sheets'], query: 'reply_conversions', detail: 'Replied leads that subsequently booked a call (via v_sheets_bookings_clean email match). Surfaces actual pipeline outcome per campaign, not just reply count.' },
        { name: 'Sender Health', type: 'Table', pipelines: ['cold_outbound'], query: 'sender_health', detail: 'Per-sender account: daily limit, emails sent, reply/bounce rate, health score from v_cold_outbound_sender_health.' },
        { name: 'Industry Breakdown', type: 'Chart', pipelines: ['cold_outbound'], query: 'lead_breakdown', detail: 'Leads grouped by industry with reply rate and engagement score from v_cold_outbound_leads_clean.' },
        { name: 'Reply Hour Distribution', type: 'Chart', pipelines: ['cold_outbound'], query: 'reply_hours', detail: '90-day reply distribution by hour: total, human, interested replies.' },
        { name: 'Meta CPA Comparison', type: 'Panel', pipelines: ['meta'], query: 'meta_cpa', detail: 'Weekly Meta Ads CPA for cost-per-lead comparison against cold email channel.' },
      ]
    },
    'funnels': {
      title: '$27 Workshop Funnel',
      elements: [
        { name: 'Ticket Show Rate / Booking Rate / Close Rate / Enrollment Rate / Revenue', type: 'KPI Strip', pipelines: ['funnel', 'stripe'], query: 'default', detail: 'Boolean stage flags from vw_workshop_funnel_pipeline: reached_attended/reached_ticket = show rate; reached_booked/reached_attended = booking rate; reached_enrolled/reached_booked = close rate. Revenue from v_stripe_clean for enrolled cohort.' },
        { name: 'Daily Funnel Breakdown', type: 'Chart', pipelines: ['funnel'], query: 'daily', detail: 'Stacked bar: daily tickets / attended / booked / enrolled. Current vs previous period overlay when Compare toggle is active.' },
        { name: 'Weekly Cohort Table', type: 'Table', pipelines: ['funnel', 'stripe'], query: 'weekly', detail: 'Sortable: cohort week, tickets, show rate, close rate, revenue. Each row = ISO week of ticket purchase.' },
        { name: 'VIP Upsell Rate Daily', type: 'Chart', pipelines: ['funnel', 'stripe'], query: 'vip_rate_daily', detail: 'Line chart of VIP conversion: daily count of paired $27+$54 charges divided by ticket count. Migrated to LAG-based detection per VIP undercount bug fix.' },
        { name: 'Show Rate Trend', type: 'Chart', pipelines: ['funnel'], query: 'show_rate_daily', detail: 'Line chart of daily show rate from vw_workshop_funnel_pipeline.' },
        { name: 'Close Rate by Closer', type: 'Chart', pipelines: ['sheets', 'funnel'], query: 'funnel_breakdown', detail: 'Horizontal bar: per-closer close rate on $27-sourced calls. Joins v_sheets_bookings_clean.team_member to enrollment outcomes.' },
      ]
    },
    'revenue': {
      title: 'Revenue & LTV',
      elements: [
        { name: 'Enrollments / Cash Collected / Refunds (Stripe) / ROAS (Cash) / Avg Deal Size / Refund Rate / Ticket-to-Enrollment', type: 'KPI Strip', pipelines: ['stripe', 'meta', 'funnel'], query: 'enrollment.default + enrollment.pipeline', detail: 'Enrollments = COUNT of Stripe charges > $100 with status=succeeded. Cash Collected = gross succeeded MINUS Stripe refund_amount. Refunds (Stripe) = SUM(refund_amount) where refund_amount > 0 and refund_date is in window (rebuilt 2026-05-13 Phase 01-04c; old query used amount<0 which Stripe never emits). Refund Rate = refund_count / total_enrolled. ROAS = net cash / Meta spend (v_meta_ads_clean). Ticket-to-Enrollment from vw_workshop_funnel_pipeline. Enrollments card includes sparkline.' },
        { name: 'LTV by Enrollment Cohort (Heatmap)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.ltvCohorts', detail: 'Plotly heatmap. Y = cohort_month (last 12), X = LTV window (30d / 60d / 90d / 180d). z = cumulative revenue per enrolled customer cohort. Cohort sizes shown in hover. Empty if no cohort has 30d post-enrollment runway.' },
        { name: 'Revenue by Payment Method (Doughnut)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.processorBreakdown', detail: 'Doughnut of revenue grouped by Stripe payment_method_type (Card / Affirm BNPL / Klarna BNPL / ACH US Bank / Stripe Link). Rebuilt 2026-05-13 Phase 01-04d -- previously bucketed by description strings (always 100% Stripe) and double-counted Hyros revenue. Center label = grand total. Legend shows $ + % per method.' },
        { name: 'Revenue Concentration by Closer', type: 'Cards', pipelines: ['sheets', 'stripe'], query: 'enrollment.jodiConcentration', detail: 'Per-closer cards: closer name, total revenue, enrollment count, % of total. >40% concentration triggers single-point-of-failure danger styling (red border + glow + warning chip). Closer attribution from v_sheets_bookings_clean.team_member.' },
        { name: 'Revenue Protection (Churn Absorption)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.churnAbsorption', detail: 'Mixed bar/line: monthly New Revenue (green bar) + Refund Amount (red bar) on y-axis, Refund Rate % (line) on y1. Footer shows total failed payments across last 12 months.' },
        { name: 'Monthly Enrollments (Bar + Trend)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.monthly', detail: '12-month bar chart of enrollment count with overlaid linear trend line (least-squares fit over the series).' },
        { name: 'Monthly Cash Collected (Bar)', type: 'Chart', pipelines: ['stripe'], query: 'enrollment.monthly', detail: '12-month bar chart of revenue (cash) from v_stripe_clean grouped by month.' },
        { name: 'Recent Enrollments (Table)', type: 'Table', pipelines: ['stripe'], query: 'enrollment.recentEnrollments', detail: 'Last 20 Stripe transactions $100+ across all processors. Columns: when (CDMX), customer, email, amount, processor badge, card brand + country, description. Client-side filter pills: All / Tickets / Enrollments classified by description regex.' },
      ]
    },
    'email-intel': {
      title: 'Email Intel',
      elements: [
        { name: 'Total Sent / Delivered / Delivery Rate / Open Rate / Click Rate / Bounced / Unsubscribed', type: 'KPI Strip', pipelines: ['sendgrid'], query: 'default', detail: 'Aggregated from sendgrid_messages: delivered, opened, clicked, bounced, unsubscribed events. Prior-period deltas from 2x-window query.' },
        { name: 'Daily Send Volume (Stacked Bar)', type: 'Chart', pipelines: ['sendgrid'], query: 'daily', detail: 'Per day: delivered + bounced counts stacked. Surfaces send-rate consistency and bounce spikes.' },
        { name: 'Daily Open Rate (Line)', type: 'Chart', pipelines: ['sendgrid'], query: 'daily', detail: 'Per-day open rate = opened / delivered. Trend line for engagement decay.' },
        { name: 'Subject Performance Top 20', type: 'Chart', pipelines: ['sendgrid'], query: 'subjects', detail: 'Plotly horizontal bar: open rate by subject, click-rate as color intensity. Last 20 subjects by send volume.' },
        { name: 'Click-to-Booking Conversion Data Gap', type: 'Placeholder', pipelines: ['sendgrid', 'sheets'], query: 'not built', detail: 'Planned integration: SendGrid click events joined to sheets_bookings by email + click timestamp. Not implemented; surfaced as honest empty-state.' },
        { name: 'Delivered Share by Provider (Donut)', type: 'Chart', pipelines: ['sendgrid'], query: 'mailboxProvider', detail: 'Donut: share of delivered messages by mailbox provider (Gmail / Yahoo / Outlook / Hotmail / corporate / other).' },
        { name: 'Provider Rates Table', type: 'Table', pipelines: ['sendgrid'], query: 'mailboxProvider', detail: 'Per-provider: delivered count, delivery %, open %, click %, bounce %, spam %. Color-coded by tier (green / amber / red). Surfaces deliverability problems per inbox provider.' },
      ]
    },
    'journey-explorer': {
      title: 'Journey Explorer',
      elements: [
        { name: 'Tickets Sold / Attended / Enrolled / Overall CVR / Close Rate / Show Rate', type: 'KPI Strip', pipelines: ['funnel', 'master'], query: 'default', detail: 'Aggregated from master_journey + bridge_customer_journey. Enrolled card includes weekly sparkline. Prior-period deltas via 2x-window query.' },
        { name: '12-Stage Journey Bow-Tie', type: 'Funnel', pipelines: ['funnel', 'master'], query: 'default', detail: 'Carousel cards: exposure > landing > ticket > workshop > vip > booking > call > enrollment > onboarding > Lions Pride > Millionaires Alliance > advocacy. Each stage has traffic-light CVR indicator + volume.' },
        { name: 'Overall CVR Summary Card', type: 'Panel', pipelines: ['funnel'], query: 'default', detail: 'Ticket-to-enrolled CVR vs benchmark band (2-5% typical for COD). Shows current rate, prior period, and where it sits in the band.' },
        { name: 'Pipeline Velocity Placeholder', type: 'Panel', pipelines: ['funnel'], query: 'speedToClose', detail: 'Days from first-touch to enrollment. Requires per-stage timestamp linkage; currently shows histogram only, ETA-prediction is planned.' },
        { name: 'Tracking Coverage Stat', type: 'Signals', pipelines: ['master'], query: 'default', detail: 'Stage tracking quality: count of stages flagged Full / Partial / Missing. Shown as a horizontal bar so data gaps are visible at a glance.' },
        { name: 'Sankey Journey Flow', type: 'Chart', pipelines: ['master', 'funnel'], query: 'sankey', detail: 'Plotly end-to-end sankey from acquisition platform through each stage. Branch widths show drop-off. Sourced from bridge_customer_journey.' },
        { name: 'Speed-to-Close Histogram', type: 'Chart', pipelines: ['funnel'], query: 'speedToClose', detail: 'Days from first-touch to enrollment, bucketed. Color-coded by velocity (fast / medium / slow).' },
        { name: 'Cohort Velocity Table', type: 'Table', pipelines: ['funnel', 'stripe'], query: 'cohortVelocity', detail: 'Weekly cohorts: tickets / booked / enrolled / CVR / avg days to enroll / cash. Clickable rows for drill-in.' },
        { name: 'Individual Lookup Form', type: 'Drill-down', pipelines: ['master'], query: 'individualLookup', detail: 'Email search returns full journey table per person (up to 25 matches). Pulls bridge_customer_journey filtered by LOWER(email).' },
        { name: 'Post-Enrollment Tracking Gap Alert', type: 'Signals', pipelines: ['master'], query: 'default', detail: 'Callout: stages 9-12 (onboarding / Lions Pride / MA / advocacy) not yet flowing into bridge_customer_journey. Surfaces the known data gap.' },
      ]
    },
    'live-feed': {
      title: 'Live Feed',
      elements: [
        { name: 'Event Filter Dropdown', type: 'Control', pipelines: ['customer_events'], query: 'default', detail: 'Client-side filter: all / ticket_purchased / lead_created / call_booked / lp_enrollment / vip_purchased. Filters the event table without re-fetching.' },
        { name: 'Event Count Badge', type: 'Signals', pipelines: ['customer_events'], query: 'default', detail: 'Live count of currently-displayed events given the active filter.' },
        { name: 'Last Updated Relative Time', type: 'Signals', pipelines: ['customer_events'], query: 'default', detail: 'Just refreshed / Updated Xs ago / next poll in Xs. Surfaces polling cadence so user knows the data is live.' },
        { name: 'Enrollment Sound Toggle', type: 'Control', pipelines: [], query: 'N/A (client-side)', detail: 'Checkbox to play a chime on new enrollment events. Persisted to localStorage so preference survives reloads.' },
        { name: 'VIP Uptake Stats Bar', type: 'Signals', pipelines: ['funnel'], query: 'default', detail: 'Mini bars showing VIP% with checkbox / upsell / unknown breakdown of how the VIP was identified.' },
        { name: 'Refresh Error Banner', type: 'Signals', pipelines: ['customer_events'], query: 'default', detail: 'Shown post-initial load if the polling fetch fails. Hidden when the next successful poll lands. Prevents silent staleness.' },
        { name: 'Real-Time Event Table', type: 'Feed', pipelines: ['customer_events', 'master', 'sheets'], query: 'default', detail: 'Last 100 events from customer_events VIEW. 9 columns: when (CDMX), event type, contact (with closer + source), segment, amount, conversion page, first ad click, last ad click, PostHog session replay link. New rows pulse-animate on arrival.' },
      ]
    },
    'sales-team': {
      title: 'Sales Team',
      elements: [
        { name: 'Calls Booked / Calls Taken / Enrollments / DPL / Total Cash / Total Contracts / Ad Spend / CAC / ROAS', type: 'KPI Strip', pipelines: ['sheets', 'stripe', 'meta'], query: 'default', detail: 'Aggregate from vw_sales_team_metrics. Calls from v_sheets_bookings_clean; cash + contracts from v_stripe_clean (>= $500); spend from v_meta_ads_clean. DPL = cash / calls taken.' },
        { name: 'Calls Booked by Funnel Source', type: 'Chart', pipelines: ['sheets'], query: 'funnelSource', detail: 'Stacked bar per closer: bookings split by source funnel ($27 Workshop / MA-VSL / Cold Email / Referral / Other). Source classified from sheets_bookings.source.' },
        { name: 'Per-Rep Performance Table', type: 'Table', pipelines: ['sheets', 'stripe', 'meta'], query: 'perRep', detail: 'Sortable 9 columns: Booked / Taken / Show% / Close% / DPL / Cash / Contracts / CAC / ROAS. Per team_member from v_sheets_bookings_clean joined to enrollment + spend.' },
        { name: 'Revenue by Closer', type: 'Chart', pipelines: ['sheets', 'stripe'], query: 'perRep', detail: 'Horizontal bar sorted by cash. Visual concentration risk indicator.' },
        { name: 'Close Rate Trends 6-Month', type: 'Chart', pipelines: ['sheets'], query: 'monthly', detail: 'Multi-line by closer: monthly close rate over last 6 months.' },
        { name: 'No-Show Cost Stat Card', type: 'Panel', pipelines: ['sheets', 'stripe'], query: 'noShowCost', detail: 'Calculated lost revenue: no-show count x close rate x avg deal size. Surfaces cost of low show rate.' },
        { name: 'Top Objections (Donut)', type: 'Chart', pipelines: ['sheets'], query: 'objections', detail: 'Objection categorization from bridge_call_objections (manual closer tagging). Empty state shown when tagging not done.' },
        { name: 'Day-of-Week Close Rate Heatmap', type: 'Chart', pipelines: ['sheets'], query: 'dowCloseRate', detail: 'Per closer x day-of-week close rate. Surfaces calendar patterns (Monday vs Friday performance).' },
        { name: 'Monthly DPL Trend 6-Month', type: 'Chart', pipelines: ['sheets', 'stripe'], query: 'monthly', detail: 'Multi-line by closer: monthly DPL (dollars per lead) progression.' },
      ]
    },
    'geo-intel': {
      title: 'Geo Intel',
      elements: [
        { name: 'States with Revenue / Top State / Total Geo Revenue / Dead Zones / Wasted in Dead Zones / Best ROAS State', type: 'KPI Strip', pipelines: ['geo', 'hyros', 'meta'], query: 'default', detail: 'Aggregated from mat_geo_revenue + hyros_sales + v_meta_ads_clean. Top State by revenue; Best ROAS State by revenue/spend ratio. Wasted = SUM(spend) where enrollments = 0.' },
        { name: 'US Choropleth Map', type: 'Map', pipelines: ['geo'], query: 'states', detail: 'Plotly choropleth: revenue by state, color gradient. Hover shows revenue / enrollments / ROAS.' },
        { name: 'Top 15 States by Revenue', type: 'Chart', pipelines: ['geo'], query: 'states', detail: 'Horizontal bar chart, reverse-sorted by revenue. Quick leaderboard view.' },
        { name: 'Top 20 Cities Table', type: 'Table', pipelines: ['geo'], query: 'default', detail: 'City, state, revenue, spend, enrollments, ROAS. Sourced from mat_geo_revenue precomputed rollup.' },
        { name: 'Dead Zones Table', type: 'Table', pipelines: ['geo', 'meta'], query: 'deadZones', detail: 'Cities with >$500 ad spend AND zero enrollments. Columns: state / city / wasted spend / enroll count. Direct targeting kill candidates.' },
      ]
    },
    'segments': {
      title: 'Segments',
      elements: [
        { name: 'Total Contacts / Enrollments / Revenue / Top Segment / Best Conversion / Segments Tracked', type: 'KPI Strip', pipelines: ['master', 'posthog'], query: 'nicheFunnel', detail: 'Aggregated from master_journey + bridge_session_attribution. Top Segment = highest-enrollment niche; Best Conversion = highest enrollment-rate niche.' },
        { name: 'Niche Funnel Comparison Table', type: 'Table', pipelines: ['master', 'stripe', 'sheets'], query: 'nicheFunnel', detail: 'Sortable: profession / contacts / tickets / ticket% / attended / show% / booked / book% / enrolled / enroll% / revenue / avg deal. One row per profession tag from PostHog identify() + GHL profession field.' },
        { name: 'Segment Funnel Progression Bars', type: 'Chart', pipelines: ['master'], query: 'nicheFunnel', detail: 'Per-profession horizontal bars showing contacts > tickets > attended > booked > enrolled progression. Bar width = stage count / max per stage across profession.' },
        { name: 'Geographic Intelligence Section', type: 'Chart', pipelines: ['geo'], query: 'location', detail: 'States table + US choropleth + state bars + dead zones table. Sourced from mat_geo_revenue. Duplicates Geo Intel page content; absorbed into segments for one-shot segment + geo view.' },
        { name: 'Demographic Intelligence Cards', type: 'Chart', pipelines: ['meta'], query: 'ageGender + device + placement', detail: 'Bar charts per dimension (gender / age band / device / placement) with stat toggles (Spend / Conversions / ROAS). Sourced from Meta demographics breakdowns.' },
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
