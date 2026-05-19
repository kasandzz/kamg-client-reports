# Michelle Diniakos MA Funnel — Nathan Paste Notes

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

## Find-and-replace swaps before paste

### 1. Michelle's headshot (appears in reg + training)

| Find | Replace with |
|------|--------------|
| `src="michelle-headshot.png"` | Full GHL Media URL of Michelle's headshot |

Affected lines:
- `elevate-well-registration-merged.html` line ~1326
- `elevate-well-training-rebuilt.html` line ~1080

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

| Find | Replace with |
|------|--------------|
| `window.location.href = '#thank-you'; // Placeholder` | Real redirect URL to the GHL booking page or Calendly link |

Affected line: `elevate-well-training-rebuilt.html` line ~1592 (inside `submitApplication()`).

Recommendation: redirect straight to the GHL booking page (step 3 of funnel) so the email/phone capture flow is unified. If you want the form data into GHL CRM, either:
- (a) Replace the entire `<form>` block (lines ~1382-1432) with a GHL form embed, or
- (b) Wire a `fetch()` POST to a GHL webhook before the redirect.

---

### 4. Booking-page calendar embed

| Find | Replace with |
|------|--------------|
| `<div class="calendar-embed-placeholder">...</div>` | Calendly iframe OR GHL booking widget snippet |

Affected lines: `elevate-well-booking-rebuilt.html` lines ~903-915.

Example replacements left as comments inline:
- `<div class="calendly-inline-widget" data-url="https://calendly.com/..." style="min-width:320px;height:630px;"></div>`
- `<iframe src="https://link.gohighlevel.com/widget/booking/your-slug" ...></iframe>`

---

### 5. Thank-you page video + calendar dates

**Video (line ~990 + JS at line ~1274):**

| Find | Replace with |
|------|--------------|
| Inside `playVideo()` function | Real Wistia/Vimeo embed URL setter |

Currently shows "Video coming soon" — swap with Michelle's intro/welcome video when ready.

**Calendar add-to-calendar dates (line ~1292-1293):**

| Find | Replace with |
|------|--------------|
| `startISO: '20241201T100000Z',` | Dynamic injection of the user's actual booking time |
| `endISO:   '20241201T104000Z',` | Booking time + 40 minutes |

Easiest path: GHL exposes booking date/time tokens (e.g., `{{appointment.start_time}}`) — drop those into the `startISO`/`endISO` strings during paste.

---

## What was changed from the originals (audit fixes)

1. **Removed click-to-timestamp video navigation** from the training page (per ADR-022 — GHL doesn't support).
   - 6 timestamp items are now static chapter-preview cards (titles + descriptions + times still visible).
   - `seekVideo()` JS function deleted.
   - Subheadline copy updated from "Click any timestamp to jump..." to "Here is what you will cover...".

2. **Kept** the "Only 6 spots per month" / "Only 47 spots remaining" scarcity copy per Kas's direction on this funnel (note: this overrides the general COD no-fake-scarcity rule for Michelle's MA tier — flag with Russ if it becomes an issue).

3. No other copy or design changes — same layout, same brand tokens, same flow.

---

## Paste checklist (5 minutes per page)

For each page:
- [ ] Open GHL page builder, add a Custom HTML block (full-width, no padding)
- [ ] Open the matching `.html` file in a text editor
- [ ] Run the 5 find-and-replace swaps above (only the ones that apply to that page)
- [ ] Copy the entire file contents (Cmd/Ctrl + A, Cmd/Ctrl + C)
- [ ] Paste into the GHL HTML block
- [ ] Save and preview
- [ ] Mobile-check (form + CTA buttons + video player)

---

## If something breaks

- Forms not submitting: GHL HTML blocks DO execute inline `<script>`, but if a form doesn't fire, double-check there's no GHL form widget overriding it on the same page.
- Calendar buttons broken on thank-you page: dates are hardcoded placeholders — see swap #5.
- Video player blank: confirm the embed URL is correct AND that the host allows iframe embedding on the GHL domain.

---

*Built by Kas | Last updated 2026-05-18*
