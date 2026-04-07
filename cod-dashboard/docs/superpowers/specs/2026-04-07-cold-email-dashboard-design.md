# Cold Email Dashboard Page - Design Spec

**Date:** 2026-04-07
**Page:** `cold-email` (replaces current placeholder)
**File:** `js/pages/cold-email.js`
**Status:** Static seed data first, wire to EmailBison API later

## Context

COD is launching cold email via Vovik / Chapters Agency (preferred vendor). First campaign: therapist targeting, launched 2026-04-06. Platform will be EmailBison ($599/mo, REST API, Bearer token auth). Strategy TBD -- dashboard must flexibly support workshop regs, direct call bookings, or hybrid CTA approaches.

**Audiences:** Kas (oversight), Russ (ROI), Vovik (optimization)
**Stage:** Just starting -- campaigns launching, no historical data yet

## Data Architecture

### Phase 1: Static Seed Data (Build)
- Hardcoded realistic data arrays in `cold-email.js`
- Modeled after EmailBison's data structures
- Niche segments: Therapists, Attorneys, Coaches, Educators (matching COD's targeting)

### Phase 2: Live Data (Wire Later)
- Cloud Function endpoint: `codDashboard?page=cold-email&query=<name>`
- BigQuery tables needed:
  - `emailbison_campaigns` -- campaign metadata + aggregate stats
  - `emailbison_leads` -- contacts with status, tags, reply data
  - `emailbison_events` -- webhook event log (sent, opened, replied, bounced, interested, unsubscribed)
  - `emailbison_sender_accounts` -- domain health, warmup status
- ETL via Cloud Function pulling EmailBison API endpoints:
  - `GET /api/campaigns` -- campaign list + status
  - `GET /api/leads` -- contact data
  - `GET /api/replies` -- reply tracking
  - `GET /api/sender-emails` -- sender account health
  - `GET /api/tags` -- niche segment tags
  - `GET /api/campaigns/sequence-steps` -- A/B variant data
- Webhook ingestion for real-time events (sent, reply, interested, bounced, unsubscribed, tag added)

### Cross-Reference Layer
- JOIN `emailbison_leads` with existing BigQuery tables:
  - `sheets_bookings` (workshop registrations)
  - `hyros_sales` (attribution)
  - `stripe_charges` (revenue)
  - `zoom_participants` (call attendance)
  - Master journey table (when available)
- Match on email address as primary key

## Page Sections

### 1. KPI Strip

7 KPIs using `Components.renderKPIStrip()` with sparklines and period deltas:

| # | KPI | Format | Source | Notes |
|---|-----|--------|--------|-------|
| 1 | Emails Sent | `Theme.num()` | Aggregate from campaigns | Sparkline: daily trend |
| 2 | Open Rate | `Theme.pct()` | opened / sent | Sparkline: daily trend |
| 3 | Reply Rate | `Theme.pct()` | replied / sent | Sparkline: daily trend |
| 4 | Interested Rate | `Theme.pct()` | interested / replied | Sparkline: daily trend |
| 5 | Meetings Booked | `Theme.num()` | Webhook or HotHawk | Sparkline: daily trend |
| 6 | Active Campaigns | `Theme.num()` | Campaigns where status=active | No sparkline |
| 7 | Deliverability Score | `Theme.pct()` | 100% - bounce_rate - spam_rate | Color: green >95%, amber >90%, red <90% |

All KPIs respect the global filter system (days: 7/14/30/90/MTD/YTD). Period comparison deltas shown when `compare` filter is active.

### 2. Campaign Performance Table

**Header area:**
- Section title: "Campaign Performance"
- Niche segment dropdown filter: All / Therapists / Attorneys / Coaches / Educators
- Campaign status filter: All / Active / Paused / Completed

**Table columns:**

| Column | Format | Sort | Notes |
|--------|--------|------|-------|
| Campaign | text | alpha | Truncated at 35 chars, full name on hover |
| Niche | pill badge | -- | Color-coded: Therapists=cyan, Attorneys=amber, Coaches=green, Educators=purple |
| Status | dot + label | -- | Active=green, Paused=amber, Completed=muted, Draft=gray, Error=red |
| Leads | `Theme.num()` | desc | Total contacts loaded |
| Sent | `Theme.num()` | desc | Emails delivered |
| Opened | `Theme.num()` + pct | desc | Opens + open rate |
| Replied | `Theme.num()` + pct | desc | Replies + reply rate |
| Interested | `Theme.num()` + pct | desc | Marked interested + rate |
| Bounced | pct | asc | Bounce rate, red if >3% |

**Row behavior:**
- Click row -> opens `Components.openDrillDown()` side panel with:
  - Sequence step breakdown (step #, subject line, sent, replies per step)
  - Reply timeline (mini chart: replies over time)
  - Top replies (latest 5 reply snippets from `GET /api/replies`)

**Grouping:** Campaigns grouped under niche segment headers when "All" is selected. When a specific niche is filtered, flat table.

**Default sort:** Sent (desc)

### 3. Campaign Analytics Charts

Three charts in a responsive grid (2-column on desktop, stacked on mobile):

**3a. Reply Rate by Campaign (horizontal bar)**
- One bar per campaign, colored by niche segment
- Sorted by reply rate descending
- Benchmark line at industry average (1-3% for cold email)

**3b. Send Volume Over Time (area chart)**
- X-axis: date range matching global filter
- Y-axis: emails sent per day
- Stacked by niche segment (or by campaign if <5 campaigns)
- Uses Chart.js with Theme defaults

**3c. Cold Email Funnel (vertical funnel/waterfall)**
- Stages: Sent -> Opened -> Replied -> Interested -> Meeting Booked -> Converted
- Shows absolute count + conversion rate at each step
- Color gradient from Theme.FUNNEL_PALETTE
- Rendered as stacked horizontal bars (not Plotly -- keep lightweight)

### 4. Reply Tracker (Contact-Level)

**Header:** "Reply Tracker" with search input (filter by name/company)

**Table columns:**

| Column | Format | Notes |
|--------|--------|-------|
| Contact | Name + Company | Two-line cell: name bold, company muted below |
| Campaign | text | Which campaign produced this reply |
| Niche | pill badge | Color-coded segment |
| Reply Date | relative date | "2d ago", "Apr 3" etc. |
| Sentiment | pill badge | Interested=green, Not Interested=red, OOO=gray, Auto-reply=muted |
| Conversion Events | status badges | Horizontal row of small badges: Workshop Reg, VIP, Call Booked, Call Showed, Enrolled. Green check if completed, gray dash if not. |
| Current Stage | text | Latest journey stage (from master journey table) |

**Row behavior:**
- Click -> drill-down showing full reply text, all touchpoints, timeline of events

**Sorting:** Reply Date (desc) by default. Filterable by sentiment, niche.

**Data source (Phase 2):** JOIN `emailbison_leads` (where replied=true) with BigQuery journey tables on email match.

### 5. Domain Health & Deliverability

**Header:** "Sender Infrastructure"

**Table columns:**

| Column | Format | Notes |
|--------|--------|-------|
| Sender Account | email address | Monospace font |
| Domain | domain name | -- |
| Status | dot + label | Active=green, Warming=amber, Error=red |
| Sent (30d) | `Theme.num()` | Volume sent in period |
| Bounce Rate | pct | Red if >3%, amber if >2% |
| Warmup Progress | progress bar | Visual indicator of warmup completion |

**Source:** `GET /api/sender-emails` -> BigQuery `emailbison_sender_accounts`

### 6. Conversion Bridge

**Header:** "Cold Email -> Revenue" with subtitle "How cold outreach connects to COD's funnel"

**Layout:** 4 metric cards in a row (like KPI strip but larger):

| Card | Value | Subtitle |
|------|-------|----------|
| Workshop Regs from Cold Email | count | "X% of total regs" |
| Direct Calls Booked | count | "X% of total calls" |
| Enrollments from Cold Email | count + revenue | "$X revenue" |
| Cold Email CPA | dollar | "vs $338 Meta CPA" with delta color |

**Below cards:** Mini comparison chart -- Cold Email CPA vs Meta Ads CPA over time (line chart, two lines).

**Data source:** BigQuery cross-reference: emailbison_leads.email -> sheets_bookings, hyros_sales, stripe_charges.

### 7. A/B Test Performance

**Header:** "A/B Tests" with subtitle "Subject line and copy variant performance"

**Table columns:**

| Column | Format | Notes |
|--------|--------|-------|
| Campaign | text | Parent campaign name |
| Step | number | Sequence step (1, 2, 3...) |
| Variant A | text | Subject line or first 60 chars of copy |
| Variant B | text | Subject line or first 60 chars of copy |
| Winner | badge | "A" green, "B" green, or "Running" amber |
| Open Rate | A vs B | Two values side by side, winner bolded |
| Reply Rate | A vs B | Two values side by side, winner bolded |
| Sample Size | number | Emails per variant |

**Visual:** Below the table, paired horizontal bar chart showing A vs B for active tests. Green highlight on the winning variant.

**Source:** `GET /api/campaigns/sequence-steps` -> variant-level data

### 8. Cross-Channel Insights (BigQuery-Powered)

**Header:** "Intelligence" with subtitle "Cross-channel performance analysis"

**8a. Segment Performance Matrix**

Heatmap-style table showing performance by niche across the full funnel:

| Niche | Reply Rate | Book Rate | Show Rate | Enroll Rate | Avg LTV | Revenue |
|-------|-----------|-----------|-----------|-------------|---------|---------|
| Therapists | X% | X% | X% | X% | $X | $X |
| Attorneys | X% | X% | X% | X% | $X | $X |
| Coaches | X% | X% | X% | X% | $X | $X |
| Educators | X% | X% | X% | X% | $X | $X |

Cells color-coded: darker green = better performance relative to others. This tells Vovik which niches to double down on.

**8b. Channel Comparison**

Side-by-side: Cold Email vs Meta Ads by niche segment:
- Which niches convert better from cold email vs ads
- Cost comparison per acquisition
- Volume comparison

Rendered as grouped bar chart (cold email bars vs meta bars per niche).

**8c. Journey Funnel by Source**

Stacked funnel showing: of all cold email contacts, what % reach each stage:
- Replied -> Workshop Reg -> VIP Upgrade -> Call Booked -> Call Showed -> Enrolled

With comparison overlay from Meta Ads funnel (same stages but starting from ad click). Both funnels query BigQuery journey tables directly -- no cross-page data dependency.

**8d. Campaign Intelligence Cards**

Auto-generated insight cards (similar to insights.js pattern):
- "Therapist campaigns produce 3.2x higher enrollment rate than Attorney campaigns"
- "Step 3 follow-ups generate 42% of all interested replies"
- "Cold email CPA is $X vs $338 from Meta -- Y% cheaper/more expensive"
- "Average time from cold email reply to enrollment: X days"

These are computed from the data and rendered as styled insight cards with the relevant metric highlighted.

## Technical Implementation

### File: `js/pages/cold-email.js`

**Pattern:** Follow `ads-meta.js` structure:
- Register page with `App.registerPage('cold-email', async (container) => { ... })`
- Section renderer functions: `_renderColdEmailKPIs()`, `_renderCampaignTable()`, `_renderCampaignCharts()`, `_renderReplyTracker()`, `_renderDomainHealth()`, `_renderConversionBridge()`, `_renderABTests()`, `_renderInsights()`
- Use `Filters.getDays()` for period selection
- Use `Theme.*` formatters for all values
- Use `Components.*` for KPI strip, tables, drill-downs

### Static Seed Data Structure

```javascript
const SEED_CAMPAIGNS = [
  {
    id: 'camp_001',
    name: 'Therapists - Clinical Psychologists',
    niche: 'therapists',
    status: 'active',
    leads: 2450,
    sent: 1823,
    opened: 894,
    replied: 47,
    interested: 18,
    bounced: 32,
    unsubscribed: 5,
    steps: [
      { step: 1, subject: 'Your practice deserves more', sent: 1823, replied: 28, variant_a: {...}, variant_b: {...} },
      { step: 2, subject: 'Quick follow-up', sent: 1450, replied: 12 },
      { step: 3, subject: 'Last note', sent: 980, replied: 7 },
    ]
  },
  // ... more campaigns per niche
];

const SEED_REPLIES = [
  {
    contact: { name: 'Dr. Sarah Chen', company: 'Mindful Therapy Group' },
    campaign: 'camp_001',
    niche: 'therapists',
    reply_date: '2026-04-06',
    sentiment: 'interested',
    reply_preview: 'Yes, I would love to see that video...',
    conversions: { workshop_reg: true, vip: false, call_booked: true, call_showed: false, enrolled: false },
    current_stage: 'Call Booked'
  },
  // ...
];

const SEED_SENDERS = [
  { email: 'russ@clientsondemand.co', domain: 'clientsondemand.co', status: 'active', sent_30d: 4200, bounce_rate: 1.2, warmup: 100 },
  // ...
];
```

### Nav Update

In `index.html`: Remove `dimmed` class from cold-email nav item. Update description to "EmailBison campaign intelligence".

### Filter Integration

The existing `cold_email` channel filter value already exists in `filters.js`. The cold email page should also expose its own niche segment filter (local to the page, not global).

## Design System

- Dark glassmorphism cards matching existing dashboard
- `Theme.COLORS` for all colors
- `JetBrains Mono` for data values, `Inter` for labels
- Chart.js for bar/line/area charts (no Plotly dependency needed)
- Responsive: sections stack vertically on mobile
- Tooltips on hover for truncated text and chart data points

## Out of Scope (Phase 1)

- Live EmailBison API integration (Phase 2)
- BigQuery table creation for emailbison_* tables (Phase 2)
- Cloud Function endpoint for cold-email queries (Phase 2)
- HotHawk inbox management integration
- LinkedIn outreach data (EmailBison supports multi-channel but not wiring yet)
- Webhook ingestion pipeline
- Real-time notifications for new replies
