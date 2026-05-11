# New Opportunities Not Yet in Flight — 2026-05-11

**Context:** Russ goal = 3x blended ROAS. Current CAC ~$6,426 (Apr 20 baseline). AOV $13.5K-$15K. Math: hit 3x by driving CAC to ~$5K AND/OR lifting LTV via Lions Pride/MA/Advocacy AND/OR closing more of the booked-but-unconverted backlog.

This list excludes anything already in flight: war-room dashboard, $27 reg-page B-test, niche LPs, mobile video bug, VIP confusion fix, value-stack rebuild, Akari conduct file, cold email build, segment analysis, BQ warehouse, master journey table, ICP V2 transcripts, CPM tab, Google Ads via Hyros proxy.

---

## TL;DR — Top 3 Highest-Leverage Adds

1. **Booked-no-show + applied-not-booked resurrection engine** — biggest immediate ROAS unlock. Money already spent acquiring these humans; conversion is the cheapest math in the funnel.
2. **Sales-team conversion-rate gap close (10% → 14% floor)** — Russ' own SOP says 5% delta = $35K/rep/mo. Three reps + 4 points = $420K/mo at zero added spend. Highest-leverage lever in the entire business.
3. **LTV expansion via Lions Pride 30-day upsell trigger** — the only lever that lets us KEEP current CAC and still hit 3x by lifting the denominator. Currently undefined post-enrollment monetization motion.

---

## The 15 Opportunities

### 1. Booked-no-show resurrection sequence
- **Category:** Conv
- **Hypothesis:** Show rate sits near 60%. The 40% no-show pool is already CAC-paid. A 7-touch resurrection sequence (SMS Day 0 + 1 + 3, email Day 2 + 7, Loom from EC Day 4, retargeting pixel Day 5-14) can rebook 15-25% of them at near-zero incremental cost.
- **ROAS lever:** Lifts effective show rate from 60% to ~68%, ~13% more closes per spend dollar.
- **Effort:** M
- **Risk:** SMS deliverability, fatigue if not segmented by reason-code.
- **Test:** Cohort 30 no-shows into resurrection vs control; measure rebook + close at 21 days.

### 2. Applied-but-didn't-book reactivation
- **Category:** Conv
- **Hypothesis:** Apr 20 flagged "booking crash." Anyone who submitted application and didn't book within 24h has already self-qualified. A same-hour call attempt + voicemail + SMS + Calendly resend within 60 min beats a 4-hour latency by 2-3x book rate.
- **ROAS lever:** Pulls 10-20 more booked calls/wk at zero ad cost.
- **Effort:** S (mostly EC ops + SMS template)
- **Risk:** EC time tradeoff vs fresh leads.
- **Test:** Even-application-IDs get 60-min outreach, odd get current flow; compare booked rate at 72h.

### 3. EC-level conversion coaching loop (Russ SOP Sec 5)
- **Category:** Sales
- **Hypothesis:** Russ' own manual says 10% is the floor, 15% is the target, gap = $35K/rep/mo. We have no current per-rep coaching cadence reading transcripts → flagging script breaks → flash-training. Building this loop with AI transcript scoring + weekly 1-on-1 lifts the bottom rep first.
- **ROAS lever:** Each 1pt close-rate gain = ~$7K/rep/mo at current AOV.
- **Effort:** M (Fathom + AI scoring rubric + weekly cadence)
- **Risk:** EC resistance to being scored.
- **Test:** Score every call for 2 weeks, share Friday digest, recoach bottom 2 reps, measure close delta at week 4.

### 4. Lions Pride 30-day upsell trigger
- **Category:** LTV
- **Hypothesis:** Stages 9-12 (Onboarding → Lions Pride → MA → Advocacy) have no defined trigger for the LP upsell. A "First-30-Day Win" gate that auto-invites students who hit milestone X into a LP discovery call lifts LTV without lifting CAC.
- **ROAS lever:** If 15% of new enrollees take LP at $5K incremental, blended AOV moves from $15K to ~$15.75K, equivalent to a 5% CAC reduction.
- **Effort:** M (milestone definition + Slack/email trigger + EC playbook)
- **Risk:** Pushing too early kills core program completion.
- **Test:** Cohort 1 gets LP invite at Day 30, Cohort 2 at Day 60; measure uptake + core completion.

### 5. Sales-floor "doctor frame" drill mornings
- **Category:** Sales
- **Hypothesis:** Russ' SOP names doctor-frame as the single biggest close lever. We have zero structured daily drill. 15-min daily roleplay (one objection per morning, rotating) compounds within 30 days.
- **ROAS lever:** Same as #3, attacks the conviction half of the equation.
- **Effort:** S (calendar + script bank)
- **Risk:** EC pushback on time.
- **Test:** 30-day drill cohort vs baseline; close-rate delta.

### 6. $27 → "no-show recovery" Loom from EC
- **Category:** Conv
- **Hypothesis:** Workshop attendees who didn't apply get a personalized 90-second Loom from a named EC within 6 hours referencing the niche they self-selected. Personal video crushes generic email.
- **ROAS lever:** Lifts $27-to-app rate by est. 2-4 pts.
- **Effort:** M (Loom template + niche switch + EC ops)
- **Risk:** EC capacity. Auto-personalized AI video viable if real Loom doesn't scale.
- **Test:** Tuesday cohort gets Loom, Wednesday cohort doesn't; measure app submit by Day 5.

### 7. Application abandon recovery (form-level)
- **Category:** Conv
- **Hypothesis:** Application form completion is a known leak (the Rehan redesign is in flight on layout, but no abandon recovery). Capture email on field-1 fill, fire a "you're 80% done" email + SMS at minute 30, 24h, 72h with deep-link to resume.
- **ROAS lever:** Even 10% abandon recovery = meaningful book volume.
- **Effort:** S (partial-form capture + drip)
- **Risk:** Privacy framing.
- **Test:** A/B form versions with/without partial capture; compare completion.

### 8. Retargeting pixel by funnel-stage with bespoke creative
- **Category:** CAC
- **Hypothesis:** Current retargeting (per attribution doc) is broad. Splitting pools into (a) workshop-viewed-no-app, (b) app-no-book, (c) booked-no-show, (d) sales-call-no-close, with creative + offer per pool, drops blended CPM and lifts re-engagement.
- **ROAS lever:** Pulls 5-15% more conversions from already-paid traffic.
- **Effort:** M (4 audience builds + 4 creative sets)
- **Risk:** Audience size at top end; combine with lookalike to keep scale.
- **Test:** 14-day stage-split campaign vs current broad RT.

### 9. Cold-email TOFU into licensed-niche LinkedIn ABM list
- **Category:** Brand/CAC
- **Hypothesis:** The cross-niche research isolates 5 verticals with regulatory-pain hooks. Cold-email + LinkedIn voice-note combo to scraped state-bar / AICPA / licensure rosters at $0 CPM beats Meta CPMs for the deepest pockets in each niche.
- **ROAS lever:** Adds zero-CPM channel for the highest-AOV prospects; long-tail demand capture.
- **Effort:** M (list build + 4-step sequence + reply handling)
- **Risk:** Deliverability if not warmed; compliance per state.
- **Test:** 500-name CPA cohort; measure reply + workshop registration.

### 10. Niche-LP → niche-EC routing
- **Category:** Sales/Conv
- **Hypothesis:** If therapist LP → therapist-trained EC who has language for the licensure question, close rate jumps. Niche LPs exist (in flight) but routing doesn't.
- **ROAS lever:** 2-5 pt close-rate gain on niche-sourced calls.
- **Effort:** S (Calendly logic + EC training brief per niche)
- **Risk:** EC capacity per niche; start with top 2 niches.
- **Test:** Therapist LP cohort routed to therapist-trained EC for 2 weeks vs round-robin.

### 11. Workshop-attendee NPS + qualitative capture
- **Category:** Data/Conv
- **Hypothesis:** We do not currently capture WHY non-buyers didn't apply post-workshop. A 1-question + free-text immediately after workshop completion (still on the success page, still hot) reveals the actual objection bank we should be inoculating in the workshop itself.
- **ROAS lever:** Indirect — feeds workshop script revisions that lift end-of-workshop app rate.
- **Effort:** S
- **Risk:** Sample bias toward extreme opinions.
- **Test:** Add capture; ship; analyze 200 responses; revise workshop hook 7 + close 3.

### 12. MA → Advocacy referral mechanic
- **Category:** LTV/CAC
- **Hypothesis:** Stage 12 Advocacy exists but no formal referral mechanic ships students named clients. A "refer 1, get X" structure with a tracked link drives sub-$2K CAC enrollments from warm intros.
- **ROAS lever:** Blends down CAC: every referral enrollment at $500 referral fee is a 92% CAC cut.
- **Effort:** M (tracking + reward + comms cadence)
- **Risk:** Cannibalizing paid (low risk — different pool).
- **Test:** Open referral to current MA members for 30 days; measure intros + close.

### 13. Pre-workshop SMS hype sequence (mobile-first)
- **Category:** Conv
- **Hypothesis:** 90% mobile traffic + low show-up rate on workshop = SMS opportunity. T-24h, T-2h, T-15min SMS with one-tap launch beats email at mobile show rate by 15-30 pts industry standard.
- **ROAS lever:** Lifts workshop show, which is the input to every downstream metric.
- **Effort:** S (Twilio + GHL trigger)
- **Risk:** Opt-in compliance, list churn.
- **Test:** Half the upcoming registrants on SMS opt-in; measure show + app rate.

### 14. Workshop-mid-roll "what to do next" micro-CTA
- **Category:** Conv
- **Hypothesis:** Mobile users drop at ~minute 45. A mid-roll friction-free overlay ("Save your seat to the Friday live group Q&A — yes/later") captures intent before the drop. Friday is the only live element; lean in.
- **ROAS lever:** Lifts VIP attach + downstream call book.
- **Effort:** S (Wistia overlay)
- **Risk:** Interrupting flow if mistimed.
- **Test:** Show overlay at 42min for 2 weeks vs no overlay.

### 15. Per-rep "objection library" with weekly winning-line digest
- **Category:** Sales
- **Hypothesis:** Top performers' specific phrasings for the top 5 objections are not being captured + redistributed weekly. Fathom + AI summarization can extract winning lines and post to a private EC Slack canvas every Friday.
- **ROAS lever:** Compounds floor improvement across all reps via lateral knowledge transfer.
- **Effort:** S-M (Fathom hook + Claude prompt + Slack canvas update)
- **Risk:** Reps gaming the system; mitigate with verification listen.
- **Test:** Roll for 4 weeks; measure objection-handling score delta in randomly sampled calls.

---

## Strategic Reframes (3-5)

**A. CAC alone won't get to 3x at $15K AOV. LTV is the math.** Three of the top 15 above are LTV plays (#4, #12, partially #6). If we shift program economics from $15K LTV to $22K LTV (LP attach 25%, MA attach 10%), 3x ROAS is achievable at current CAC. The team is currently treating ROAS as a media metric; it's a lifecycle metric.

**B. The sales team is the cheapest media buy in the building.** Spending another $50K on Meta to lower CAC 8% is harder than coaching the bottom-quartile EC up 4 points. Reframe team meeting: this week's #1 ROAS lever is sales-floor coaching, not media.

**C. Stop treating workshop as the conversion event. Treat it as the qualification event.** The workshop's job is to identify and route. The application + EC call is the close. Workshop optimization plateaus; the real leak is application-to-close (we don't have clean numbers — this should also become a P0 measurement).

**D. Friday VIP Q&A is the only live moment. It is the most underleveraged asset in the funnel.** It's where 1-to-many psychology meets live close energy. Build the entire VIP upsell ladder around making Friday the unmissable moment, not "an extra Q&A."

**E. We don't have a "name and shame the regulator" creative in test.** Cross-niche research is unanimous: regulatory frame earns 30 seconds. Top of funnel creative should include one variant naming the licensure body (state bar, AICPA, licensing board) per niche.

---

## Things to STOP doing

- **Stop running broad Meta retargeting** at single audience — split by funnel stage or kill (see #8).
- **Stop optimizing the $27 reg page in isolation** of the downstream funnel — the application + booking flow is the actual bottleneck given app-no-book volume.
- **Stop adding new niche LPs** before the niche-routing → niche-EC structure exists (otherwise gain is capped).
- **Stop relying on email only** for time-sensitive funnel moments (booking confirm, workshop reminder, no-show) — 90% mobile = SMS-primary.
- **Stop treating "more leads" as the brief.** Brief is now: convert the leads we already paid for. Top-funnel scaling beyond current spend should pause until app-to-close conversion is measured + fixed.
