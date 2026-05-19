# Michelle Diniakos MA Funnel - Nathan Paste Notes

**Status:** Paste-ready. Click-to-timestamp video navigation has been removed per ADR-022 (Russ approved May 13).

**Funnel order:** Registration -> Training (webinar) -> Booking -> Thank-you

**Files:**

| Step | File | Paste into |
|------|------|------------|
| 1 | `elevate-well-registration-merged.html` | GHL "Registration" page Custom HTML block |
| 2 | `elevate-well-training-rebuilt.html`    | GHL "Training" page Custom HTML block |
| 3 | `elevate-well-booking-rebuilt.html`     | GHL "Booking" page Custom HTML block |
| 4 | `elevate-well-thankyou-rebuilt.html`    | GHL "Thank-You" page Custom HTML block |

---

## Preference: GHL native features over custom HTML

Per Kas: use GHL's native widgets (calendar, forms, etc.) wherever they fit. The HTML in this bundle handles the page chrome (hero, copy, layout, social proof, footer), but for any interactive feature GHL ships natively, **drop the GHL widget in place of the corresponding placeholder block** instead of trying to wire JS into the custom HTML. If the native widget visually breaks the page framing, fall back to a passthrough (e.g. GHL Liquid tokens for booking dates on the thank-you page). Nathan knows GHL's native widget catalog better than the HTML markers; trust his judgment on which native widget to drop where.

The swaps below are ordered so the GHL-native path is always option A.

---

## Find-and-replace swaps before paste

### 1. Michelle's headshot (appears on reg + training + thank-you)

| Find | Replace with |
|------|--------------|
| `src="michelle-headshot.png"` | Full GHL Media URL of Michelle's headshot (must be absolute `https://` URL) |

Affected lines:
- `elevate-well-registration-merged.html` line ~1326
- `elevate-well-training-rebuilt.html` line ~1080
- `elevate-well-thankyou-rebuilt.html` line ~995

**Why this matters:** Relative paths like `michelle-headshot.png` will 404 when pasted into a GHL Custom HTML block; the page URL resolves the relative reference against the GHL domain (not this folder). You MUST use an absolute `https://` URL.

Per ADR-022, upload `michelle-headshot.png` to GHL Media first, then drop the resulting URL in. Don't reference the GitHub-raw URL.

---

### 2. Webinar video (training page)

| Find | Replace with |
|------|--------------|
| `https://player.vimeo.com/video/YOUR_VIDEO_ID?autoplay=1` | Michelle's actual Vimeo/Wistia/YouTube embed URL |

Affected line: `elevate-well-training-rebuilt.html` line ~1075 (the `data-src` attribute on the videoIframe).

The iframe loads on play-button click. Click-to-seek timestamps removed - the section now reads as a static chapter preview.

---

### 3. Training-page application form submit

**Preferred path (GHL native):** Replace the entire `#applicationSection` form block (lines ~1370-1410) with the GHL native form / survey widget that feeds Michelle's CRM. Note: the training page doesn't use a `<form>` tag; the application widget is a series of bare `<input>` elements plus a `<button onclick="submitApplication()">` that JS-handles the submit. So "replace the form" means: replace the whole question + name/email/phone/goal block + the submit button with a single GHL form widget. The custom HTML provides the section framing; the GHL widget owns inputs, validation, and CRM submit. No JS wiring needed.

**Fallback (keep the custom form):** If the native widget visually breaks the section, keep the custom form and:

| Find | Replace with |
|------|--------------|
| `window.location.href = '#thank-you'; // Placeholder` | Full GHL booking-page URL (absolute `https://`) |

Affected line: `elevate-well-training-rebuilt.html` line ~1592 (inside `submitApplication()`).

> **Warning:** The line directly below (~1593) is an example comment showing a Calendly URL like `https://calendly.com/michelle-elevatewell/strategy-call`. **This is illustrative only; that URL does NOT exist.** Use Michelle's real GHL booking page URL.

For data-passthrough on the fallback path: wire a `fetch()` POST to a GHL inbound webhook inside `submitApplication()` before the redirect.

---

### 4. Booking-page calendar embed (use GHL native)

**Preferred path (GHL native):** Replace the `.calendar-embed-placeholder` div with the GHL native calendar widget embed snippet (e.g. `<iframe src="https://link.gohighlevel.com/widget/booking/your-slug" ...></iframe>` OR whatever drag-drop calendar block COD uses on Michelle's other pages). The surrounding `.calendar-card` container holds the trust-elements and section framing; only swap the inner placeholder.

| Find | Replace with |
|------|--------------|
| `<div class="calendar-embed-placeholder">...</div>` | GHL native calendar widget snippet (iframe or drop-in block) |

Affected lines: `elevate-well-booking-rebuilt.html` lines ~903-915.

**Fallback (only if GHL native breaks the layout):** Calendly inline widget `<div class="calendly-inline-widget" data-url="https://calendly.com/..." style="min-width:320px;height:630px;"></div>`. This is a fallback only; Calendly events don't write back into GHL CRM without a separate Zap.

---

### 5. Registration-page form redirect

| Find | Replace with |
|------|--------------|
| `'NATHAN_REPLACE_WITH_TRAINING_URL_FROM_GHL'` | Full GHL training-page URL (absolute `https://`) |

Affected line: `elevate-well-registration-merged.html` line ~1707 (the `window.location.href` line inside the form-submit handler at ~line 1697).

Same reason as swap #1: relative paths don't resolve inside GHL HTML blocks. Must be absolute.

---

### 6. Booking-page Privacy / Terms links

| Find | Replace with |
|------|--------------|
| `<a href="#">Privacy Policy</a>` | `<a href="<GHL-PRIVACY-URL>">Privacy Policy</a>` |
| `<a href="#">Terms of Service</a>` | `<a href="<GHL-TERMS-URL>">Terms of Service</a>` |

Affected line: `elevate-well-booking-rebuilt.html` line ~1131. FTC scrutiny on a $4.5k weight-loss page makes dead Privacy/Terms a compliance risk; fix before launch.

---

### 7. Thank-you page video + calendar dates

**Video (line ~990 + JS at line ~1274):**

| Find | Replace with |
|------|--------------|
| Inside `playVideo()` function | Real Wistia/Vimeo embed URL setter |

Currently shows "Video coming soon"; swap with Michelle's intro/welcome video when ready.

**Calendar add-to-calendar dates (line ~1292-1295):**

The `startISO` and `endISO` defaults now compute as `now + 24h` so the buttons don't generate past-dated events if you paste-test before swapping. For production:

| Find | Replace with |
|------|--------------|
| The `startISO: (function(){...})()` IIFE | `startISO: '{{appointment.start_time | date: "%Y%m%dT%H%M%SZ"}}',` (GHL Liquid token) |
| The `endISO: (function(){...})()` IIFE | `endISO: '{{appointment.end_time | date: "%Y%m%dT%H%M%SZ"}}',` |

Easiest path: GHL exposes booking date/time tokens. Drop them into the `startISO`/`endISO` strings during paste. If GHL Liquid syntax is different, ask in the COD Slack; default behavior (24h-from-now) is safe for paste-testing.

---

## Form connections to GHL (deep dive)

The bundle has **3 forms** that need to land in GHL's CRM. Pick a tier per form based on what Michelle's GHL account supports and how much routing the data needs to do. (This section is wiring strategy reference, NOT an 8th find-and-replace swap; it informs swaps 3 and 5.)

### Forms in the bundle

| Page | Form ID | Fields | Captures |
|------|---------|--------|----------|
| Registration | `#reg-form` (single form, 2 visual steps) | Step 1 radio `name="struggle"` (4 options: `stubborn-weight` / `zero-energy` / `hormonal-chaos` / `all-above`). Step 2 inputs `id="reg-name"` (`name="name"`) + `id="reg-email"` (`name="email"`) + hidden `id="struggle-value"` (`name="struggle"`) that carries the Step 1 value. | Lead contact + intent qualifier |
| Training | inline application (no `<form>` tag; bare inputs + `<button onclick="submitApplication()">`) | `id="firstName"` + `id="email"` + `id="phone"` + `id="goal"` + `name="frustration"` radio (4 options) | Application data + qualifier |

### Tier A: GHL native form embed (preferred)

**When to use:** Default for both forms unless visual framing breaks.

**How:** In the GHL page builder, drop a Form/Survey element WHERE the current `<form>` block lives in the HTML. Build the GHL form with the same field labels (or as close as possible). The custom HTML provides hero/copy/section framing; the GHL widget owns inputs, validation, submit, and CRM landing. No JS wiring needed.

**Gotcha (per internal research):** Multi-checkbox or multi-radio fields can show as separate contact properties in GHL CRM rather than one combined field. Workaround: create 4 separate contact properties (one per radio option) OR create a single property with predefined dropdown options matching the radio values. Map via a GHL workflow on form submit.

### Tier B: fetch() POST to GHL inbound webhook (interim, no admin perm needed)

**Source attribution:** This is Kas's recommendation. Internal research toward Tier C (private integration) is in progress; Tier B is a "ship today, no admin perm needed" interim path. Verify it actually works in Michelle's GHL location before relying on it.

**When to use:** If Tier A breaks layout, or you need to keep the multi-step UX exactly as designed.

**How:**
1. In GHL: `Automation > Create Workflow > Add Trigger` and pick the webhook-style trigger (label varies by GHL version: "Inbound Webhook", "Webhook", or "Custom Webhook"). Copy the generated webhook URL.
2. Add a `pushToGHL` helper to the page's existing `<script>` block:

```js
async function pushToGHL(payload) {
  try {
    await fetch('NATHAN_REPLACE_WITH_GHL_INBOUND_WEBHOOK_URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('GHL webhook push failed', e);
  }
}
```

3. Call `pushToGHL({...formData})` inside `submitApplication()` (training) and the reg-form submit handler, BEFORE the redirect.
4. Configure the GHL workflow to map webhook JSON fields to contact properties, apply tags, trigger follow-up automations.

**CORS caveat (IMPORTANT):** GHL inbound webhooks may not return CORS headers on the response. With `Content-Type: application/json`, the browser issues a preflight `OPTIONS` request first; if GHL doesn't respond with the right `Access-Control-Allow-*` headers, the browser blocks the POST and the `catch` block runs silently (Nathan thinks it works; no contact lands in GHL). **Test in browser console first.** If you see a CORS error, swap to the no-cors fire-and-forget pattern:

```js
fetch('NATHAN_REPLACE_WITH_GHL_INBOUND_WEBHOOK_URL', {
  method: 'POST',
  mode: 'no-cors',
  keepalive: true,
  headers: { 'Content-Type': 'text/plain' },  // text/plain avoids preflight
  body: JSON.stringify(payload)
});
```
With `no-cors`, the request fires but you can't read the response (always opaque). The POST still lands in GHL. Trade-off: zero confirmation of delivery in the browser. For confirmation, route through a server-side proxy (Cloudflare Worker, Vercel function) where you control CORS on your domain.

**Reg page is already structured for this:** form-submit handler at `elevate-well-registration-merged.html` ~line 1697 already calls `preventDefault()` and runs validation; the redirect is line ~1707. Just add `await pushToGHL({...})` before the `window.location.href` line.

**Pros:** No GHL admin permission required. Nathan can ship today.
**Cons:** Fire-and-forget (especially in no-cors mode); calendar booking still needs separate handling.

### Tier C: GHL Private Integration (preferred internal path, currently BLOCKED)

This is the path our team uses for COD's application page Step 5 (calendar booking from custom HTML). It requires Private Integration access in GHL Location Settings:

> `app.clientsondemand.app/v2/location/h83O4TKy09yLLdfnIw3K/settings/private-integrations`

**STATUS:** Permission to create a private integration on the COD GHL location is currently blocked. A ticket was filed with GHL support on 2026-05-18; awaiting response at `kas@russruffino.com`. Until resolved, this tier is unavailable.

**When resolved:** Generate a Private Integration token, call GHL API endpoints (`/contacts/upsert`, `/calendars/events`) from a server-side proxy (Cloudflare Worker, Vercel function) to keep the token out of the browser. Map fields via the API payload directly.

### Calendar booking on the training page

The training page application form is conceptually the same as the COD application page Step 5 work in progress: capture applicant data AND book a calendar slot. Two paths:

**If Tier C unblocks first:** Use the private-integration pattern.

**Interim path (Tier B + GHL native calendar):**
1. Capture data via fetch -> GHL webhook (Tier B above)
2. Redirect to the booking page (step 3 of funnel) which already has the calendar embed placeholder
3. GHL workflow on contact creation can pre-populate the booking calendar URL with the user's email so they don't re-enter it

### Open questions before Nathan starts

1. **Is Michelle's funnel on the same GHL sub-account (`h83O4TKy09yLLdfnIw3K`) or a different location?** Private integrations are per-location. If different, the COD permission block may not apply (could mean Tier C is available immediately).
2. **GHL support ticket status** (opened 2026-05-18 about private-integration permission on the COD location). Open as of doc creation date. Monitor `kas@russruffino.com` for the reply; until then Tier C is unavailable on the COD location.
3. **What GHL contact field IDs are pre-existing on Michelle's location?** Especially: a "biggest struggle" qualifier property and a "goal" long-text property. May need Nathan to create these before wiring.
4. **Does the application form need to trigger a specific GHL pipeline stage / tag / follow-up sequence on submit?** Affects workflow design.
5. **Are we okay with the reg form being fire-and-forget (Tier B) or do we need confirmation back to the user that the contact landed in GHL?** If the latter, server-side proxy required.

### Internal research notes (anonymized)

- Tier C blocker: "Private integration access is blocking finishing Step 5 of the application page; needs to book meeting in calendar from that step." (2026-05-18)
- Ticket status: "GHL support reported the issue to higher support and will respond at `kas@russruffino.com`." (2026-05-18)
- Email passthrough pattern: append `?email={{GHL email field}}` to URL when sending from a GHL workflow/email; on-page JS reads the param to identify the user. (2026-05-07, used on COD /maf funnel)
- Multi-radio mapping (Yodel Mobile 2024): native integration showed form checkbox field separately instead of one combined field; workaround = create 4 fields on contact property and update the main one using new fields via a workflow.

---

## What was changed from the originals (audit fixes, 2026-05-18)

1. **Removed click-to-timestamp video navigation** from the training page (per ADR-022; GHL doesn't support).
   - 6 timestamp items are now static chapter-preview cards (titles + descriptions + times still visible).
   - `seekVideo()` JS function deleted.
   - Subheadline copy updated from "Click any timestamp to jump..." to "Here is what you will cover...".

2. **Registration-page countdown widget now renders and counts down.** The original build shipped the countdown CSS + JS but never added the HTML widget; the JS was failing every tick on missing IDs (`cd-days` / `cd-hours` / `cd-mins` / `cd-secs`) and silently breaking the rest of the script. Added the missing `<div class="countdown-card">` widget directly under the registration form with the right IDs, plus kept the null-safe guard as a defense-in-depth fallback. Behavior: each pageload sets the target to `now + 3 days at 7pm`, counts down live until then. (Evergreen-style scarcity, matches the "Only 47 spots remaining" copy choice; flag with Russ if needed.)

3. **Registration-page social proof number** changed from "1,247+ other women" to "hundreds of other women" (unverifiable specific count is FTC-exposed).

4. **Thank-you-page calendar ISO defaults** now compute as `now + 24h` instead of hardcoded `20241201T100000Z`. So the add-to-calendar buttons don't generate past-dated events if Nathan paste-tests before swapping in GHL booking tokens.

5. **FTC disclaimer block added to booking + thank-you footers** (matching the reg + training footers). Specific weight claims like "Down 28 lbs" / "42 lbs down" need the disclaimer on every page they appear.

6. **Kept** the "Only 6 spots per month" / "Only 47 spots remaining" scarcity copy per Kas's direction on this funnel (note: overrides the general COD no-fake-scarcity rule for Michelle's MA tier; flag with Russ if it becomes an issue).

7. **Copyright year** bumped to 2026 on booking + thank-you footers (was 2024).

No layout, brand-token, or major copy changes; same flow.

---

## Paste checklist (5 minutes per page)

For each page:
- [ ] Open GHL page builder, add a Custom HTML block (full-width, no padding)
- [ ] Open the matching `.html` file in a text editor
- [ ] Run the find-and-replace swaps above that apply to that page (swaps 1-7)
- [ ] Copy the entire file contents (Cmd/Ctrl + A, Cmd/Ctrl + C)
- [ ] Paste into the GHL HTML block
- [ ] Save and preview
- [ ] Mobile-check (form + CTA buttons + video player)

---

## If something breaks

- Forms not submitting: GHL HTML blocks DO execute inline `<script>`, but if a form doesn't fire, double-check there's no GHL form widget overriding it on the same page.
- Calendar buttons broken on thank-you page: dates default to `now + 24h`; for real booking times, see swap #7.
- Video player blank: confirm the embed URL is correct AND that the host allows iframe embedding on the GHL domain.

---

*Built by Kas | Last updated 2026-05-18*
