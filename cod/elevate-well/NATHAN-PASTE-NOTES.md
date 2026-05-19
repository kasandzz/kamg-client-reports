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

**Preferred path (GHL native):** Replace the entire custom `<form>` block (lines ~1382-1432 inside the `#applicationSection`) with the GHL native form / survey widget that already feeds Michelle's CRM. The custom HTML provides the section framing; the GHL widget owns the inputs, validation, and submit. This way no JS wiring is needed and the data lands in GHL automatically.

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

Affected line: `elevate-well-registration-merged.html` line ~1680 (inside the form-submit handler).

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
