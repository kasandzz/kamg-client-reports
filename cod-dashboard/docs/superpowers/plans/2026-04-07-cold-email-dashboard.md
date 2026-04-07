# Cold Email Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cold-email dashboard page for COD's Command Center with static seed data, replacing the current placeholder.

**Architecture:** Single file `js/pages/cold-email.js` with 8 section renderers, static seed data arrays, and local niche/status filters. Follows the exact pattern established by `ads-meta.js`: IIFE-scoped helpers, `App.registerPage()` entry point, `Components.*` for KPI strips and drill-downs, `Theme.*` for formatting and charts.

**Tech Stack:** Vanilla JS (no framework), Chart.js for charts, existing Components/Theme/Filters/App modules.

**Spec:** `docs/superpowers/specs/2026-04-07-cold-email-dashboard-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `js/pages/cold-email.js` | All 8 sections: KPIs, campaign table, charts, reply tracker, domain health, conversion bridge, A/B tests, insights |
| Modify | `index.html:59` | Remove `dimmed` class from cold-email nav item |
| Modify | `index.html:165` | Add `<script>` tag for cold-email.js before placeholder.js |
| Modify | `js/pages/placeholder.js:11-16` | Remove cold-email from PLACEHOLDERS object |

---

### Task 1: Enable Nav + Script Tag

**Files:**
- Modify: `index.html:59` (nav item)
- Modify: `index.html:165` (script tag)
- Modify: `js/pages/placeholder.js:11-16` (remove cold-email placeholder)

- [ ] **Step 1: Remove dimmed class from cold-email nav**

In `index.html` line 59, change:
```html
        <a class="nav-item dimmed" data-page="cold-email"><span class="nav-icon">&#9993;&#65039;</span><span class="nav-label">Cold Email</span><span class="nav-dot" hidden></span></a>
```
to:
```html
        <a class="nav-item" data-page="cold-email"><span class="nav-icon">&#9993;&#65039;</span><span class="nav-label">Cold Email</span><span class="nav-dot" hidden></span></a>
```

- [ ] **Step 2: Add script tag for cold-email.js**

In `index.html`, add this line before `<script src="js/pages/placeholder.js"></script>` (line 165):
```html
  <script src="js/pages/cold-email.js"></script>
```

- [ ] **Step 3: Remove cold-email from placeholder.js**

In `js/pages/placeholder.js`, remove lines 11-16 (the `'cold-email'` entry from the PLACEHOLDERS object):
```javascript
    'cold-email': {
      title: 'Cold Email',
      description: 'Instantly + Vovik outreach metrics',
      metrics: ['Emails Sent', 'Open Rate', 'Reply Rate', 'Booking Rate', 'Sequences Active', 'Deliverability'],
      charts: ['Sequence Comparison', 'Reply Rate Trend', 'Domain Health', 'A/B Test Results'],
    },
```

- [ ] **Step 4: Commit**

```bash
git add index.html js/pages/placeholder.js
git commit -m "feat(cold-email): enable nav item and script tag for cold email page"
```

---

### Task 2: Seed Data + Page Skeleton

**Files:**
- Create: `js/pages/cold-email.js`

- [ ] **Step 1: Create cold-email.js with seed data and page skeleton**

Create `js/pages/cold-email.js` with the full seed data arrays and the page registration shell. This is a large file -- all seed data goes at the top, followed by the `App.registerPage` call that renders sections in order.

```javascript
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
// Seed Data
// ---------------------------------------------------------------------------

const _CE_CAMPAIGNS = [
  // -- Therapists --
  { id: 'camp_001', name: 'Therapists - Clinical Psychologists', niche: 'therapists', status: 'active', leads: 2450, sent: 1823, opened: 894, replied: 47, interested: 18, bounced: 32, unsubscribed: 5,
    steps: [
      { step: 1, subject: 'Your practice deserves more', sent: 1823, opened: 894, replied: 28,
        variant_a: { subject: 'Your practice deserves more', sent: 912, opened: 458, replied: 17 },
        variant_b: { subject: 'Thought about scaling beyond sessions?', sent: 911, opened: 436, replied: 11 } },
      { step: 2, subject: 'Quick follow-up on my last note', sent: 1450, opened: 624, replied: 12, variant_a: null, variant_b: null },
      { step: 3, subject: 'Last note - the video I mentioned', sent: 980, opened: 382, replied: 7, variant_a: null, variant_b: null },
    ],
  },
  { id: 'camp_002', name: 'Therapists - Licensed Counselors (LCSW)', niche: 'therapists', status: 'active', leads: 1890, sent: 1342, opened: 631, replied: 34, interested: 14, bounced: 22, unsubscribed: 3,
    steps: [
      { step: 1, subject: 'Beyond the session-based grind', sent: 1342, opened: 631, replied: 21,
        variant_a: { subject: 'Beyond the session-based grind', sent: 671, opened: 322, replied: 13 },
        variant_b: { subject: 'What if your income wasn\'t tied to sessions?', sent: 671, opened: 309, replied: 8 } },
      { step: 2, subject: 'Following up', sent: 1080, opened: 432, replied: 9, variant_a: null, variant_b: null },
      { step: 3, subject: 'One last thing', sent: 720, opened: 252, replied: 4, variant_a: null, variant_b: null },
    ],
  },
  // -- Attorneys --
  { id: 'camp_003', name: 'Attorneys - Solo Practitioners', niche: 'attorneys', status: 'active', leads: 1650, sent: 1180, opened: 496, replied: 22, interested: 8, bounced: 28, unsubscribed: 4,
    steps: [
      { step: 1, subject: 'Scaling a law practice without more billable hours', sent: 1180, opened: 496, replied: 14,
        variant_a: { subject: 'Scaling a law practice without more billable hours', sent: 590, opened: 254, replied: 9 },
        variant_b: { subject: 'Most attorneys miss this revenue lever', sent: 590, opened: 242, replied: 5 } },
      { step: 2, subject: 'Quick follow-up', sent: 940, opened: 338, replied: 5, variant_a: null, variant_b: null },
      { step: 3, subject: 'Last note', sent: 610, opened: 195, replied: 3, variant_a: null, variant_b: null },
    ],
  },
  { id: 'camp_004', name: 'Attorneys - Family Law Focus', niche: 'attorneys', status: 'paused', leads: 980, sent: 720, opened: 288, replied: 11, interested: 3, bounced: 19, unsubscribed: 2,
    steps: [
      { step: 1, subject: 'Family law attorneys - a different model', sent: 720, opened: 288, replied: 7, variant_a: null, variant_b: null },
      { step: 2, subject: 'Following up on my note', sent: 580, opened: 203, replied: 3, variant_a: null, variant_b: null },
      { step: 3, subject: 'Last reach-out', sent: 380, opened: 114, replied: 1, variant_a: null, variant_b: null },
    ],
  },
  // -- Coaches --
  { id: 'camp_005', name: 'Coaches - Life & Transformation', niche: 'coaches', status: 'active', leads: 2100, sent: 1560, opened: 718, replied: 38, interested: 15, bounced: 25, unsubscribed: 6,
    steps: [
      { step: 1, subject: 'Coaching beyond 1-on-1 sessions', sent: 1560, opened: 718, replied: 24,
        variant_a: { subject: 'Coaching beyond 1-on-1 sessions', sent: 780, opened: 366, replied: 15 },
        variant_b: { subject: 'What top coaches know about scaling', sent: 780, opened: 352, replied: 9 } },
      { step: 2, subject: 'Circling back', sent: 1240, opened: 496, replied: 10, variant_a: null, variant_b: null },
      { step: 3, subject: 'Final note', sent: 830, opened: 282, replied: 4, variant_a: null, variant_b: null },
    ],
  },
  // -- Educators --
  { id: 'camp_006', name: 'Educators - Online Course Creators', niche: 'educators', status: 'completed', leads: 1200, sent: 1180, opened: 496, replied: 19, interested: 6, bounced: 18, unsubscribed: 3,
    steps: [
      { step: 1, subject: 'Your teaching skills are worth more', sent: 1180, opened: 496, replied: 12,
        variant_a: { subject: 'Your teaching skills are worth more', sent: 590, opened: 254, replied: 8 },
        variant_b: { subject: 'Educators: build a business that matches your impact', sent: 590, opened: 242, replied: 4 } },
      { step: 2, subject: 'Quick follow-up', sent: 940, opened: 338, replied: 5, variant_a: null, variant_b: null },
      { step: 3, subject: 'Last note from me', sent: 620, opened: 186, replied: 2, variant_a: null, variant_b: null },
    ],
  },
  { id: 'camp_007', name: 'Educators - Corporate Trainers', niche: 'educators', status: 'draft', leads: 850, sent: 0, opened: 0, replied: 0, interested: 0, bounced: 0, unsubscribed: 0,
    steps: [],
  },
];

const _CE_REPLIES = [
  { contact: { name: 'Dr. Sarah Chen', company: 'Mindful Therapy Group' }, campaign_id: 'camp_001', niche: 'therapists', reply_date: '2026-04-06', sentiment: 'interested', reply_preview: 'Yes, I would love to see that video. I\'ve been thinking about this for a while.', conversions: { workshop_reg: true, vip: false, call_booked: true, call_showed: false, enrolled: false }, current_stage: 'Call Booked' },
  { contact: { name: 'Dr. Michael Rivera', company: 'Rivera Counseling PLLC' }, campaign_id: 'camp_001', niche: 'therapists', reply_date: '2026-04-06', sentiment: 'interested', reply_preview: 'This sounds interesting. Can you tell me more about the time commitment?', conversions: { workshop_reg: true, vip: true, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'VIP Registered' },
  { contact: { name: 'Jennifer Walsh, LCSW', company: 'Healing Horizons' }, campaign_id: 'camp_002', niche: 'therapists', reply_date: '2026-04-05', sentiment: 'interested', reply_preview: 'Please send the video. I\'m interested in learning more.', conversions: { workshop_reg: true, vip: false, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'Workshop Registered' },
  { contact: { name: 'Dr. Amanda Torres', company: 'Torres Psychology' }, campaign_id: 'camp_001', niche: 'therapists', reply_date: '2026-04-05', sentiment: 'not_interested', reply_preview: 'Thanks but I\'m not looking to change my practice model right now.', conversions: { workshop_reg: false, vip: false, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'Declined' },
  { contact: { name: 'Robert Kim, JD', company: 'Kim & Associates Law' }, campaign_id: 'camp_003', niche: 'attorneys', reply_date: '2026-04-05', sentiment: 'interested', reply_preview: 'I\'m intrigued. I\'ve been looking for ways to scale without adding associates.', conversions: { workshop_reg: true, vip: true, call_booked: true, call_showed: true, enrolled: true }, current_stage: 'Enrolled' },
  { contact: { name: 'Lisa Park, Esq.', company: 'Park Family Law' }, campaign_id: 'camp_004', niche: 'attorneys', reply_date: '2026-04-04', sentiment: 'ooo', reply_preview: 'I\'m out of office until April 14th. I\'ll review when I return.', conversions: { workshop_reg: false, vip: false, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'OOO' },
  { contact: { name: 'David Brooks', company: 'Transformative Coaching Co' }, campaign_id: 'camp_005', niche: 'coaches', reply_date: '2026-04-04', sentiment: 'interested', reply_preview: 'Yes! Send me the video. I\'ve been doing 1-on-1 for 5 years and ready for a change.', conversions: { workshop_reg: true, vip: true, call_booked: true, call_showed: true, enrolled: false }, current_stage: 'Call Completed' },
  { contact: { name: 'Maria Gonzalez', company: 'MG Life Coaching' }, campaign_id: 'camp_005', niche: 'coaches', reply_date: '2026-04-04', sentiment: 'interested', reply_preview: 'Very interested. What\'s the investment look like?', conversions: { workshop_reg: true, vip: false, call_booked: true, call_showed: false, enrolled: false }, current_stage: 'Call Booked' },
  { contact: { name: 'Tom Sullivan', company: 'Sullivan Training Academy' }, campaign_id: 'camp_006', niche: 'educators', reply_date: '2026-04-03', sentiment: 'auto_reply', reply_preview: 'Thanks for reaching out! I receive many emails and will respond if interested.', conversions: { workshop_reg: false, vip: false, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'Auto-Reply' },
  { contact: { name: 'Dr. Karen Wright', company: 'Wright Counseling' }, campaign_id: 'camp_002', niche: 'therapists', reply_date: '2026-04-03', sentiment: 'interested', reply_preview: 'I watched a similar webinar last year but didn\'t follow through. I\'m ready now.', conversions: { workshop_reg: true, vip: true, call_booked: true, call_showed: true, enrolled: true }, current_stage: 'Enrolled' },
  { contact: { name: 'James Carter, JD', company: 'Carter Legal Group' }, campaign_id: 'camp_003', niche: 'attorneys', reply_date: '2026-04-03', sentiment: 'not_interested', reply_preview: 'Not interested. Please remove me from your list.', conversions: { workshop_reg: false, vip: false, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'Unsubscribed' },
  { contact: { name: 'Patricia Lane', company: 'Lane Wellness Center' }, campaign_id: 'camp_001', niche: 'therapists', reply_date: '2026-04-02', sentiment: 'interested', reply_preview: 'Send me the video please. My practice has been stagnant for two years.', conversions: { workshop_reg: true, vip: false, call_booked: false, call_showed: false, enrolled: false }, current_stage: 'Workshop Registered' },
];

const _CE_SENDERS = [
  { email: 'russ@clientsondemand.co', domain: 'clientsondemand.co', status: 'active', sent_30d: 4200, bounce_rate: 1.2, warmup: 100 },
  { email: 'info@codcoaching.com', domain: 'codcoaching.com', status: 'active', sent_30d: 3800, bounce_rate: 1.8, warmup: 100 },
  { email: 'team@clientsondemand.co', domain: 'clientsondemand.co', status: 'active', sent_30d: 2900, bounce_rate: 0.9, warmup: 100 },
  { email: 'outreach@codbusiness.com', domain: 'codbusiness.com', status: 'warming', sent_30d: 480, bounce_rate: 0.4, warmup: 62 },
  { email: 'connect@codresults.com', domain: 'codresults.com', status: 'warming', sent_30d: 320, bounce_rate: 0.2, warmup: 45 },
  { email: 'hello@codpractice.com', domain: 'codpractice.com', status: 'error', sent_30d: 150, bounce_rate: 4.8, warmup: 30 },
];

const _CE_DAILY = [
  { date: '2026-03-08', sent: 120, opened: 54, replied: 2, bounced: 3 },
  { date: '2026-03-09', sent: 135, opened: 62, replied: 3, bounced: 2 },
  { date: '2026-03-10', sent: 180, opened: 83, replied: 4, bounced: 4 },
  { date: '2026-03-11', sent: 210, opened: 97, replied: 5, bounced: 3 },
  { date: '2026-03-12', sent: 195, opened: 88, replied: 3, bounced: 5 },
  { date: '2026-03-13', sent: 240, opened: 115, replied: 6, bounced: 4 },
  { date: '2026-03-14', sent: 85, opened: 38, replied: 1, bounced: 1 },
  { date: '2026-03-15', sent: 260, opened: 125, replied: 7, bounced: 3 },
  { date: '2026-03-16', sent: 275, opened: 132, replied: 5, bounced: 4 },
  { date: '2026-03-17', sent: 310, opened: 149, replied: 8, bounced: 5 },
  { date: '2026-03-18', sent: 290, opened: 136, replied: 6, bounced: 3 },
  { date: '2026-03-19', sent: 320, opened: 150, replied: 7, bounced: 4 },
  { date: '2026-03-20', sent: 305, opened: 143, replied: 9, bounced: 3 },
  { date: '2026-03-21', sent: 100, opened: 45, replied: 2, bounced: 1 },
  { date: '2026-03-22', sent: 340, opened: 163, replied: 8, bounced: 5 },
  { date: '2026-03-23', sent: 355, opened: 170, replied: 10, bounced: 4 },
  { date: '2026-03-24', sent: 380, opened: 182, replied: 9, bounced: 6 },
  { date: '2026-03-25', sent: 365, opened: 175, replied: 11, bounced: 4 },
  { date: '2026-03-26', sent: 390, opened: 187, replied: 8, bounced: 5 },
  { date: '2026-03-27', sent: 370, opened: 174, replied: 10, bounced: 3 },
  { date: '2026-03-28', sent: 110, opened: 50, replied: 3, bounced: 2 },
  { date: '2026-03-29', sent: 410, opened: 197, replied: 12, bounced: 5 },
  { date: '2026-03-30', sent: 425, opened: 204, replied: 9, bounced: 6 },
  { date: '2026-03-31', sent: 440, opened: 211, replied: 13, bounced: 4 },
  { date: '2026-04-01', sent: 420, opened: 198, replied: 11, bounced: 5 },
  { date: '2026-04-02', sent: 450, opened: 216, replied: 14, bounced: 4 },
  { date: '2026-04-03', sent: 435, opened: 205, replied: 10, bounced: 6 },
  { date: '2026-04-04', sent: 130, opened: 58, replied: 3, bounced: 2 },
  { date: '2026-04-05', sent: 460, opened: 221, replied: 15, bounced: 5 },
  { date: '2026-04-06', sent: 475, opened: 228, replied: 12, bounced: 4 },
];

// Segment performance (cross-channel insights seed)
const _CE_SEGMENT_PERF = {
  therapists: { reply_rate: 2.6, book_rate: 38, show_rate: 76, enroll_rate: 8.4, avg_ltv: 12800, revenue: 38400 },
  attorneys:  { reply_rate: 1.7, book_rate: 32, show_rate: 72, enroll_rate: 6.2, avg_ltv: 11200, revenue: 22400 },
  coaches:    { reply_rate: 2.3, book_rate: 28, show_rate: 68, enroll_rate: 5.1, avg_ltv: 9600,  revenue: 19200 },
  educators:  { reply_rate: 1.6, book_rate: 22, show_rate: 64, enroll_rate: 3.8, avg_ltv: 7800,  revenue: 7800 },
};

// Meta Ads comparison data (for conversion bridge)
const _CE_META_CPA_TREND = [
  { date: '2026-03-W1', cold_email: null, meta: 342 },
  { date: '2026-03-W2', cold_email: null, meta: 328 },
  { date: '2026-03-W3', cold_email: 285, meta: 351 },
  { date: '2026-03-W4', cold_email: 248, meta: 338 },
  { date: '2026-04-W1', cold_email: 212, meta: 345 },
];

// ---------------------------------------------------------------------------
// Page Registration
// ---------------------------------------------------------------------------

App.registerPage('cold-email', async (container) => {
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
```

- [ ] **Step 2: Verify the page loads**

Open the dashboard in a browser, navigate to Cold Email. Should see an empty page (no errors in console). The 8 render functions don't exist yet so we need to stub them first -- add these empty functions after the `App.registerPage` block:

```javascript
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

// Stub section renderers (will be implemented in subsequent tasks)
function _renderColdEmailKPIs(container) {}
function _renderCampaignTable(container) {}
function _renderCampaignCharts(container) {}
function _renderReplyTracker(container) {}
function _renderDomainHealth(container) {}
function _renderConversionBridge(container) {}
function _renderABTests(container) {}
function _renderInsights(container) {}
```

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): seed data, helpers, and page skeleton with stub renderers"
```

---

### Task 3: KPI Strip (Section 1)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderColdEmailKPIs` stub)

- [ ] **Step 1: Implement KPI strip renderer**

Replace the `_renderColdEmailKPIs` stub with:

```javascript
function _renderColdEmailKPIs(container) {
  const campaigns = _CE_CAMPAIGNS.filter(c => c.status !== 'draft');
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);
  const totalInterested = campaigns.reduce((s, c) => s + c.interested, 0);
  const totalBounced = campaigns.reduce((s, c) => s + c.bounced, 0);
  const activeCampaigns = _CE_CAMPAIGNS.filter(c => c.status === 'active').length;

  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;
  const interestedRate = totalReplied > 0 ? (totalInterested / totalReplied) * 100 : 0;
  const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
  const deliverability = 100 - bounceRate;

  // Meetings booked = replies with call_booked conversion
  const meetingsBooked = _CE_REPLIES.filter(r => r.conversions.call_booked).length;

  // Sparkline data from daily seed
  const dailySent = _CE_DAILY.map(d => d.sent);
  const dailyOpenRate = _CE_DAILY.map(d => d.sent > 0 ? (d.opened / d.sent) * 100 : 0);
  const dailyReplyRate = _CE_DAILY.map(d => d.sent > 0 ? (d.replied / d.sent) * 100 : 0);
  const dailyReplied = _CE_DAILY.map(d => d.replied);
  const dailyMeetings = _CE_DAILY.map(d => Math.round(d.replied * 0.35));

  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Emails Sent',       value: totalSent,       format: 'num',   sparkData: dailySent,       delta: 18.4 },
    { label: 'Open Rate',         value: openRate,         format: 'pct',   sparkData: dailyOpenRate,   delta: 2.1 },
    { label: 'Reply Rate',        value: replyRate,        format: 'pct',   sparkData: dailyReplyRate,  delta: 0.8 },
    { label: 'Interested Rate',   value: interestedRate,   format: 'pct',   sparkData: dailyReplied,    delta: 3.2 },
    { label: 'Meetings Booked',   value: meetingsBooked,   format: 'num',   sparkData: dailyMeetings,   delta: 12.5 },
    { label: 'Active Campaigns',  value: activeCampaigns,  format: 'num' },
    { label: 'Deliverability',    value: deliverability,   format: 'pct',   delta: 0.3 },
  ]);
}
```

- [ ] **Step 2: Verify in browser**

Navigate to Cold Email page. 7 KPI cards should render with values and sparklines. Deliverability should show ~98.4%.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): KPI strip with 7 metrics and sparklines"
```

---

### Task 4: Campaign Performance Table (Section 2)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderCampaignTable` stub)

- [ ] **Step 1: Implement campaign table with niche grouping, filters, and drill-down**

Replace the `_renderCampaignTable` stub with:

```javascript
let _ceActiveNiche = 'all';
let _ceActiveStatus = 'all';

function _renderCampaignTable(container) {
  _ceSectionHeader(container, 'Campaign Performance', 'EmailBison campaigns grouped by niche segment');

  // Filter bar
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap';

  const nicheSelect = document.createElement('select');
  nicheSelect.style.cssText = `background:${Theme.COLORS.bgCard};color:${Theme.COLORS.textPrimary};border:1px solid ${Theme.COLORS.border};border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer`;
  nicheSelect.innerHTML = `<option value="all">All Niches</option>` +
    Object.entries(_CE_NICHE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  nicheSelect.value = _ceActiveNiche;

  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = nicheSelect.style.cssText;
  statusSelect.innerHTML = `<option value="all">All Statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option>`;
  statusSelect.value = _ceActiveStatus;

  filterBar.appendChild(nicheSelect);
  filterBar.appendChild(statusSelect);
  container.appendChild(filterBar);

  const tableContainer = document.createElement('div');
  tableContainer.className = 'card';
  tableContainer.style.cssText = 'padding:0;overflow-x:auto';
  container.appendChild(tableContainer);

  function renderTable() {
    let filtered = _CE_CAMPAIGNS;
    if (_ceActiveNiche !== 'all') filtered = filtered.filter(c => c.niche === _ceActiveNiche);
    if (_ceActiveStatus !== 'all') filtered = filtered.filter(c => c.status === _ceActiveStatus);

    const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
    const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap`;

    // Group by niche if showing all
    const niches = _ceActiveNiche === 'all' ? ['therapists', 'attorneys', 'coaches', 'educators'] : [_ceActiveNiche];
    let rowsHtml = '';

    niches.forEach(niche => {
      const nicheRows = filtered.filter(c => c.niche === niche);
      if (nicheRows.length === 0) return;

      if (_ceActiveNiche === 'all') {
        rowsHtml += `<tr><td colspan="9" style="padding:14px;font-size:12px;font-weight:700;color:${_CE_NICHE_COLORS[niche]};text-transform:uppercase;letter-spacing:.06em;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.06)">${_CE_NICHE_LABELS[niche]}</td></tr>`;
      }

      nicheRows.forEach(c => {
        const openRate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(1) : '0.0';
        const replyRate = c.sent > 0 ? ((c.replied / c.sent) * 100).toFixed(1) : '0.0';
        const intRate = c.replied > 0 ? ((c.interested / c.replied) * 100).toFixed(1) : '0.0';
        const bounceRate = c.sent > 0 ? ((c.bounced / c.sent) * 100).toFixed(1) : '0.0';
        const bounceColor = parseFloat(bounceRate) > 3 ? Theme.COLORS.danger : (parseFloat(bounceRate) > 2 ? Theme.COLORS.warning : Theme.COLORS.textSecondary);
        const nameDisplay = c.name.length > 35 ? c.name.slice(0, 35) + '...' : c.name;

        rowsHtml += `<tr style="cursor:pointer" class="ce-campaign-row" data-id="${c.id}">
          <td style="${tdStyle};color:${Theme.COLORS.textPrimary};font-weight:500;font-family:Inter,sans-serif" title="${c.name}">${nameDisplay}</td>
          <td style="${tdStyle}">${_ceNichePill(c.niche)}</td>
          <td style="${tdStyle}">${_ceStatusDot(c.status)}</td>
          <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.leads)}</td>
          <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.sent)}</td>
          <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.opened)} <span style="color:${Theme.COLORS.textMuted};font-size:11px">${openRate}%</span></td>
          <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.replied)} <span style="color:${Theme.COLORS.textMuted};font-size:11px">${replyRate}%</span></td>
          <td style="${tdStyle};font-family:'JetBrains Mono',monospace">${Theme.num(c.interested)} <span style="color:${Theme.COLORS.textMuted};font-size:11px">${intRate}%</span></td>
          <td style="${tdStyle};font-family:'JetBrains Mono',monospace;color:${bounceColor}">${bounceRate}%</td>
        </tr>`;
      });
    });

    tableContainer.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle}">Campaign</th>
          <th style="${thStyle}">Niche</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Leads</th>
          <th style="${thStyle}">Sent</th>
          <th style="${thStyle}">Opened</th>
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
              html += `<div style="padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid ${_CE_NICHE_COLORS[r.niche]}">
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

  nicheSelect.addEventListener('change', () => { _ceActiveNiche = nicheSelect.value; renderTable(); });
  statusSelect.addEventListener('change', () => { _ceActiveStatus = statusSelect.value; renderTable(); });
}
```

- [ ] **Step 2: Verify in browser**

Campaigns should appear grouped by niche with color-coded segment headers. Dropdowns filter. Clicking a row opens the drill-down side panel with sequence steps and reply previews.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): campaign performance table with niche grouping, filters, drill-down"
```

---

### Task 5: Campaign Analytics Charts (Section 3)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderCampaignCharts` stub)

- [ ] **Step 1: Implement 3 charts**

Replace the `_renderCampaignCharts` stub with:

```javascript
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
      labels: activeCampaigns.map(c => c.name.length > 25 ? c.name.slice(0, 25) + '...' : c.name),
      datasets: [{
        data: activeCampaigns.map(c => ((c.replied / c.sent) * 100).toFixed(2)),
        backgroundColor: activeCampaigns.map(c => _CE_NICHE_COLORS[c.niche] + 'cc'),
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

  // -- Chart 3: Cold Email Funnel (horizontal stacked bars) --
  const funnelCard = _ceCard('Cold Email Funnel');
  funnelCard.style.gridColumn = '1 / -1';
  const funnelCanvas = document.createElement('canvas');
  funnelCanvas.id = 'ce-funnel-chart';
  funnelCanvas.style.height = '200px';
  funnelCard.appendChild(funnelCanvas);
  grid.appendChild(funnelCard);

  const campaigns = _CE_CAMPAIGNS.filter(c => c.sent > 0);
  const funnelStages = [
    { label: 'Sent', value: campaigns.reduce((s, c) => s + c.sent, 0) },
    { label: 'Opened', value: campaigns.reduce((s, c) => s + c.opened, 0) },
    { label: 'Replied', value: campaigns.reduce((s, c) => s + c.replied, 0) },
    { label: 'Interested', value: campaigns.reduce((s, c) => s + c.interested, 0) },
    { label: 'Meetings', value: _CE_REPLIES.filter(r => r.conversions.call_booked).length },
    { label: 'Enrolled', value: _CE_REPLIES.filter(r => r.conversions.enrolled).length },
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
}
```

- [ ] **Step 2: Verify in browser**

Three charts should render: horizontal bar (reply rates), area chart (volume + replies dual axis), and vertical bar funnel. Charts use Theme colors.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): campaign analytics charts (reply rate, volume, funnel)"
```

---

### Task 6: Reply Tracker (Section 4)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderReplyTracker` stub)

- [ ] **Step 1: Implement reply tracker table with conversion badges and drill-down**

Replace the `_renderReplyTracker` stub with:

```javascript
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

  filterBar.appendChild(searchInput);
  filterBar.appendChild(sentimentSelect);
  container.appendChild(filterBar);

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
      const camp = _CE_CAMPAIGNS.find(c => c.id === r.campaign_id);
      const campName = camp ? (camp.name.length > 20 ? camp.name.slice(0, 20) + '...' : camp.name) : r.campaign_id;

      return `<tr style="cursor:pointer" class="ce-reply-row" data-contact="${r.contact.name}">
        <td style="${tdStyle}">
          <div style="font-weight:600;color:${Theme.COLORS.textPrimary};font-size:13px">${r.contact.name}</div>
          <div style="font-size:11px;color:${Theme.COLORS.textMuted}">${r.contact.company}</div>
        </td>
        <td style="${tdStyle};font-size:12px;color:${Theme.COLORS.textSecondary}" title="${camp ? camp.name : ''}">${campName}</td>
        <td style="${tdStyle}">${_ceNichePill(r.niche)}</td>
        <td style="${tdStyle};font-size:12px;color:${Theme.COLORS.textSecondary}">${_ceRelativeDate(r.reply_date)}</td>
        <td style="${tdStyle}">${_ceSentimentPill(r.sentiment)}</td>
        <td style="${tdStyle};white-space:nowrap">
          ${convBadge('Reg', r.conversions.workshop_reg)}${convBadge('VIP', r.conversions.vip)}${convBadge('Booked', r.conversions.call_booked)}${convBadge('Showed', r.conversions.call_showed)}${convBadge('Enrolled', r.conversions.enrolled)}
        </td>
        <td style="${tdStyle};font-size:12px;color:${Theme.COLORS.textSecondary}">${r.current_stage}</td>
      </tr>`;
    }).join('');

    tableContainer.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle}">Contact</th>
          <th style="${thStyle}">Campaign</th>
          <th style="${thStyle}">Niche</th>
          <th style="${thStyle}">Reply Date</th>
          <th style="${thStyle}">Sentiment</th>
          <th style="${thStyle}">Conversion Events</th>
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
            <div style="padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid ${_CE_NICHE_COLORS[reply.niche]};margin-bottom:16px">
              <div style="font-size:12px;color:${Theme.COLORS.textSecondary};font-style:italic;line-height:1.5">"${reply.reply_preview}"</div>
              <div style="font-size:10px;color:${Theme.COLORS.textMuted};margin-top:8px">${reply.reply_date} &middot; ${_CE_NICHE_LABELS[reply.niche]}</div>
            </div>
            <div style="font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;margin-bottom:8px">Journey</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${convBadge('Workshop Reg', reply.conversions.workshop_reg)}
              ${convBadge('VIP Upgrade', reply.conversions.vip)}
              ${convBadge('Call Booked', reply.conversions.call_booked)}
              ${convBadge('Call Showed', reply.conversions.call_showed)}
              ${convBadge('Enrolled', reply.conversions.enrolled)}
            </div>
            <div style="margin-top:16px;font-size:12px;color:${Theme.COLORS.textSecondary}">Current Stage: <span style="font-weight:600;color:${Theme.COLORS.textPrimary}">${reply.current_stage}</span></div>
          </div>`;
        });
      });
    });
  }

  renderReplies();
  searchInput.addEventListener('input', renderReplies);
  sentimentSelect.addEventListener('change', renderReplies);
}
```

- [ ] **Step 2: Verify in browser**

Reply tracker shows 12 contacts with name/company, colored niche pills, sentiment badges, conversion event checkmarks. Search filters in real-time. Clicking a row shows full reply text and journey in drill-down.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): reply tracker with conversion badges, search, and drill-down"
```

---

### Task 7: Domain Health (Section 5)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderDomainHealth` stub)

- [ ] **Step 1: Implement domain health table**

Replace the `_renderDomainHealth` stub with:

```javascript
function _renderDomainHealth(container) {
  _ceSectionHeader(container, 'Sender Infrastructure', 'Domain health and deliverability monitoring');

  const card = document.createElement('div');
  card.className = 'card';
  card.style.cssText = 'padding:0;overflow-x:auto';

  const thStyle = `padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04)`;

  const rows = _CE_SENDERS.map(s => {
    const bounceColor = s.bounce_rate > 3 ? Theme.COLORS.danger : (s.bounce_rate > 2 ? Theme.COLORS.warning : Theme.COLORS.success);
    const warmupPct = Math.min(s.warmup, 100);
    const warmupBarColor = warmupPct === 100 ? Theme.COLORS.success : (warmupPct > 50 ? Theme.COLORS.warning : Theme.COLORS.accent);

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
```

- [ ] **Step 2: Verify in browser**

6 sender accounts with status dots, bounce rate coloring (red for >3%), and animated warmup progress bars.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): domain health table with warmup progress bars"
```

---

### Task 8: Conversion Bridge (Section 6)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderConversionBridge` stub)

- [ ] **Step 1: Implement conversion bridge cards + CPA comparison chart**

Replace the `_renderConversionBridge` stub with:

```javascript
function _renderConversionBridge(container) {
  _ceSectionHeader(container, 'Cold Email → Revenue', 'How cold outreach connects to COD\'s funnel');

  // Derived metrics from replies
  const workshopRegs = _CE_REPLIES.filter(r => r.conversions.workshop_reg).length;
  const callsBooked = _CE_REPLIES.filter(r => r.conversions.call_booked).length;
  const enrolled = _CE_REPLIES.filter(r => r.conversions.enrolled).length;
  const enrollRevenue = enrolled * 10000; // Seed: assume $10K avg enrollment

  // Total baseline (seed: assume 120 total workshop regs, 45 total calls in period)
  const totalRegs = 120;
  const totalCalls = 45;
  const coldEmailCPA = 212; // From seed CPA trend data
  const metaCPA = 338;
  const cpaDelta = ((metaCPA - coldEmailCPA) / metaCPA * 100).toFixed(0);

  const cardGrid = document.createElement('div');
  cardGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px';

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

  cardGrid.appendChild(metricCard('Workshop Regs', workshopRegs, `${((workshopRegs / totalRegs) * 100).toFixed(0)}% of total regs`));
  cardGrid.appendChild(metricCard('Calls Booked', callsBooked, `${((callsBooked / totalCalls) * 100).toFixed(0)}% of total calls`));
  cardGrid.appendChild(metricCard('Enrollments', `${enrolled} / ${Theme.money(enrollRevenue)}`, `${Theme.money(enrollRevenue)} revenue`));
  cardGrid.appendChild(metricCard('Cold Email CPA', Theme.money(coldEmailCPA), `<span style="color:${Theme.COLORS.success}">-${cpaDelta}%</span> vs $338 Meta CPA`));

  container.appendChild(cardGrid);

  // CPA comparison line chart
  const chartCard = _ceCard('CPA Comparison: Cold Email vs Meta Ads');
  const chartCanvas = document.createElement('canvas');
  chartCanvas.id = 'ce-cpa-compare-chart';
  chartCanvas.style.height = '220px';
  chartCard.appendChild(chartCanvas);
  container.appendChild(chartCard);

  const validCE = _CE_META_CPA_TREND.filter(d => d.cold_email !== null);

  Theme.createChart('ce-cpa-compare-chart', {
    type: 'line',
    data: {
      labels: _CE_META_CPA_TREND.map(d => d.date),
      datasets: [
        {
          label: 'Cold Email CPA',
          data: _CE_META_CPA_TREND.map(d => d.cold_email),
          borderColor: Theme.COLORS.accent,
          backgroundColor: Theme.COLORS.accent + '18',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: false,
        },
        {
          label: 'Meta Ads CPA',
          data: _CE_META_CPA_TREND.map(d => d.meta),
          borderColor: Theme.COLORS.warning,
          backgroundColor: Theme.COLORS.warning + '18',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
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
```

- [ ] **Step 2: Verify in browser**

4 large metric cards (workshop regs, calls, enrollments, CPA) followed by a dual-line CPA comparison chart.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): conversion bridge cards and CPA comparison chart"
```

---

### Task 9: A/B Test Performance (Section 7)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderABTests` stub)

- [ ] **Step 1: Implement A/B test table and paired bar chart**

Replace the `_renderABTests` stub with:

```javascript
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
```

- [ ] **Step 2: Verify in browser**

A/B test table shows all campaigns with variants, winner badges (A/B/Running), and side-by-side rates. Paired bar chart below.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): A/B test table and paired bar comparison chart"
```

---

### Task 10: Cross-Channel Insights (Section 8)

**Files:**
- Modify: `js/pages/cold-email.js` (replace `_renderInsights` stub)

- [ ] **Step 1: Implement segment heatmap, channel comparison, and insight cards**

Replace the `_renderInsights` stub with:

```javascript
function _renderInsights(container) {
  _ceSectionHeader(container, 'Intelligence', 'Cross-channel performance analysis');

  // -- 8a: Segment Performance Matrix (heatmap table) --
  const matrixCard = _ceCard('Segment Performance Matrix', 'Full-funnel metrics by niche from cold email campaigns');

  const thStyle = `padding:10px 14px;text-align:center;font-size:11px;font-weight:600;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap`;
  const tdStyle = `padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.04);text-align:center;font-family:'JetBrains Mono',monospace`;

  // Find max values for heatmap coloring
  const allVals = {};
  ['reply_rate', 'book_rate', 'show_rate', 'enroll_rate', 'avg_ltv', 'revenue'].forEach(key => {
    allVals[key] = Object.values(_CE_SEGMENT_PERF).map(s => s[key]);
  });

  function heatColor(val, key) {
    const vals = allVals[key];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pct = max > min ? (val - min) / (max - min) : 0.5;
    const alpha = (0.08 + pct * 0.25).toFixed(2);
    return `background:rgba(34,197,94,${alpha})`;
  }

  const niches = Object.keys(_CE_SEGMENT_PERF);
  const matrixRows = niches.map(niche => {
    const s = _CE_SEGMENT_PERF[niche];
    return `<tr>
      <td style="${tdStyle};text-align:left">${_ceNichePill(niche)}</td>
      <td style="${tdStyle};${heatColor(s.reply_rate, 'reply_rate')}">${s.reply_rate.toFixed(1)}%</td>
      <td style="${tdStyle};${heatColor(s.book_rate, 'book_rate')}">${s.book_rate}%</td>
      <td style="${tdStyle};${heatColor(s.show_rate, 'show_rate')}">${s.show_rate}%</td>
      <td style="${tdStyle};${heatColor(s.enroll_rate, 'enroll_rate')}">${s.enroll_rate.toFixed(1)}%</td>
      <td style="${tdStyle};${heatColor(s.avg_ltv, 'avg_ltv')}">${Theme.money(s.avg_ltv)}</td>
      <td style="${tdStyle};${heatColor(s.revenue, 'revenue')}">${Theme.money(s.revenue)}</td>
    </tr>`;
  }).join('');

  matrixCard.innerHTML += `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${thStyle};text-align:left">Niche</th>
        <th style="${thStyle}">Reply Rate</th>
        <th style="${thStyle}">Book Rate</th>
        <th style="${thStyle}">Show Rate</th>
        <th style="${thStyle}">Enroll Rate</th>
        <th style="${thStyle}">Avg LTV</th>
        <th style="${thStyle}">Revenue</th>
      </tr></thead>
      <tbody>${matrixRows}</tbody>
    </table>
  `;
  container.appendChild(matrixCard);

  // -- 8b: Channel Comparison (grouped bar chart) --
  const compareCard = _ceCard('Channel Comparison: Cold Email vs Meta Ads', 'Enrollment rate by niche across acquisition channels');
  const compareCanvas = document.createElement('canvas');
  compareCanvas.id = 'ce-channel-compare-chart';
  compareCanvas.style.height = '260px';
  compareCard.appendChild(compareCanvas);
  container.appendChild(compareCard);

  // Meta Ads comparison data (from demographic intel seed on ads-meta page)
  const metaEnrollRates = { therapists: 9.1, attorneys: 7.8, coaches: 5.2, educators: 4.1 };

  Theme.createChart('ce-channel-compare-chart', {
    type: 'bar',
    data: {
      labels: niches.map(n => _CE_NICHE_LABELS[n]),
      datasets: [
        {
          label: 'Cold Email',
          data: niches.map(n => _CE_SEGMENT_PERF[n].enroll_rate),
          backgroundColor: Theme.COLORS.accent + 'cc',
          borderRadius: 4,
        },
        {
          label: 'Meta Ads',
          data: niches.map(n => metaEnrollRates[n]),
          backgroundColor: Theme.COLORS.warning + 'cc',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.raw + '% enroll rate' } },
      },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: Theme.COLORS.gridLine }, ticks: { callback: v => v + '%' } },
      },
    },
  });

  // -- 8d: Campaign Intelligence Cards --
  const insightsGrid = document.createElement('div');
  insightsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px';

  // Generate insights from seed data
  const bestNiche = niches.reduce((best, n) => _CE_SEGMENT_PERF[n].enroll_rate > _CE_SEGMENT_PERF[best].enroll_rate ? n : best, niches[0]);
  const worstNiche = niches.reduce((worst, n) => _CE_SEGMENT_PERF[n].enroll_rate < _CE_SEGMENT_PERF[worst].enroll_rate ? n : worst, niches[0]);
  const bestVsWorst = (_CE_SEGMENT_PERF[bestNiche].enroll_rate / _CE_SEGMENT_PERF[worstNiche].enroll_rate).toFixed(1);

  // Find which step gets most replies
  let step1Replies = 0, step2Replies = 0, step3Replies = 0;
  _CE_CAMPAIGNS.forEach(c => {
    c.steps.forEach(s => {
      if (s.step === 1) step1Replies += s.replied;
      if (s.step === 2) step2Replies += s.replied;
      if (s.step === 3) step3Replies += s.replied;
    });
  });
  const totalStepReplies = step1Replies + step2Replies + step3Replies;
  const step1Pct = totalStepReplies > 0 ? ((step1Replies / totalStepReplies) * 100).toFixed(0) : 0;

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

  insightsGrid.appendChild(insightCard(
    'Top Performing Niche',
    `<span style="color:${_CE_NICHE_COLORS[bestNiche]};font-weight:700">${_CE_NICHE_LABELS[bestNiche]}</span> produce <span style="color:${Theme.COLORS.success};font-weight:700">${bestVsWorst}x</span> higher enrollment rate than ${_CE_NICHE_LABELS[worstNiche]} campaigns.`,
    _CE_NICHE_COLORS[bestNiche]
  ));

  insightsGrid.appendChild(insightCard(
    'First Touch Dominance',
    `Step 1 emails generate <span style="color:${Theme.COLORS.accent};font-weight:700">${step1Pct}%</span> of all replies. Initial outreach copy is the highest-leverage optimization point.`,
    Theme.COLORS.accent
  ));

  insightsGrid.appendChild(insightCard(
    'Cold Email vs Meta CPA',
    `Cold email CPA is <span style="color:${Theme.COLORS.success};font-weight:700">$212</span> vs <span style="color:${Theme.COLORS.warning};font-weight:700">$338</span> from Meta Ads -- <span style="color:${Theme.COLORS.success};font-weight:700">37% cheaper</span> per acquisition.`,
    Theme.COLORS.success
  ));

  insightsGrid.appendChild(insightCard(
    'Reply-to-Enrollment Speed',
    `Average time from cold email reply to enrollment: <span style="color:${Theme.COLORS.textPrimary};font-weight:700">11 days</span>. Fastest conversion: attorneys (8 days). Slowest: educators (16 days).`,
    Theme.COLORS.warning
  ));

  container.appendChild(insightsGrid);
}
```

- [ ] **Step 2: Verify in browser**

Segment heatmap table with green shading, grouped bar chart comparing cold email vs Meta by niche, and 4 insight cards with highlighted metrics.

- [ ] **Step 3: Commit**

```bash
git add js/pages/cold-email.js
git commit -m "feat(cold-email): cross-channel insights with segment matrix, comparison chart, and intelligence cards"
```

---

### Task 11: Final Polish + Full Page Commit

**Files:**
- Modify: `js/pages/cold-email.js` (remove stub functions, verify all renderers are wired)

- [ ] **Step 1: Remove all stub function declarations**

The stub functions (`function _renderColdEmailKPIs(container) {}` etc.) from Task 2 should have been replaced by the real implementations in Tasks 3-10. Verify no empty stubs remain. If any do, delete them.

- [ ] **Step 2: Full browser test**

Open the dashboard, navigate to Cold Email. Verify all 8 sections render:
1. KPI strip (7 cards with sparklines)
2. Campaign table (grouped by niche, filterable, clickable drill-down)
3. Charts (reply rate bar, send volume area, funnel)
4. Reply tracker (12 contacts, search, sentiment filter, conversion badges)
5. Domain health (6 senders, warmup bars)
6. Conversion bridge (4 metric cards, CPA comparison chart)
7. A/B tests (table + paired bar chart)
8. Intelligence (heatmap, channel comparison, 4 insight cards)

Also verify:
- No console errors
- Nav item is not dimmed
- Drill-downs open and close properly
- Filters work (niche, status, sentiment, search)
- Charts render with correct colors

- [ ] **Step 3: Final commit**

```bash
git add -A js/pages/cold-email.js index.html js/pages/placeholder.js
git commit -m "feat(cold-email): complete cold email dashboard page with 8 sections (static seed data)"
```
