# Funnel Leak Quantification — 2026-05-11

**Window:** 2026-04-11 to 2026-05-11 (30d) / 2026-04-27 to 2026-05-11 (14d)
**Spend (30d):** $222,880 Meta | **Spend (14d):** $101,653 Meta
**Enrolled cash (30d):** $363,000 | **Contract value (30d):** $478,000
**Blended ROAS (Meta-only basis, cash/contract):** 1.63x / 2.14x (target = 3x)
**Note:** master_customers workshop/call/enrollment date columns are 100% NULL (Phase-10 bridges not yet wired). Best-available funnel is Stripe tickets joined to `fact_bookings_enriched`. Source attribution is largely missing (UTMs don't flow through to GHL); Hyros captures only ~50% of enrollments. Numbers below use the most reliable per-stage source and flag overlaps where they exist.

## TL;DR (biggest leaks by ROAS impact)

- **Sales-call show rate at 56% on Tue-Thu and Monday at 25%** — every 10pp of show recovered = ~17 extra shows / 30d = ~5 enrollments = ~$65K cash. Monday bookings are bleeding (40% cancellation rate).
- **Close rate on shown calls is 28.6% (28/98) for 30d** vs typical COD benchmark of 35-45% — fixing back to 40% = +11 enrollments / 30d = ~$143K cash. Two GHL user IDs show 0 closes on 82 calls — they're not real closers or names didn't enrich.
- **Ticket-to-sales-booked is invisible right now** (fact_bookings.email is 100% NULL — can't join Stripe to bookings cleanly). The single highest-leverage fix is engineering, not marketing: get this join working.

## Funnel Conversion Table

| Stage | 14d Volume | 14d Rate | 30d Volume | 30d Rate | Notes |
|---|---|---|---|---|---|
| 1. Ad click -> reg page view | gap | gap | gap | gap | No PostHog/GA join to Meta clicks at warehouse level |
| 2. Reg page -> $27 ticket | gap | gap | gap | gap | Need landing-page sessions; PostHog has events but no reg-page funnel view |
| 3. Ticket purchase | 185 | — | 332 | — | Stripe ground truth, $27 + $54 |
| 4. $27 -> VIP ($54) | 115 VIP | 62.2% | 220 VIP | 66.3% | VIP bump rate is HEALTHY; not the leak |
| 5. Ticket -> workshop watch (>50%/>80%) | NULL | NULL | NULL | NULL | `master_customers.workshop_attended` = 100% NULL, `watch_time_seconds` = STRING (broken) |
| 6. Workshop -> application | NULL | NULL | NULL | NULL | `master_customers.app_submitted_at` exists but not aggregated; need bridge |
| 7. Application -> call booked | n/a | n/a | n/a | n/a | Application -> call link uses same calendar API; can't separate steps in current data |
| 8. Sales-calls booked (all sources) | 93 | 50% of tickets | 174 | 52% of tickets | Bookings cohort includes non-ticket-buyers; cohort-pure join blocked by null emails in fact_bookings |
| 9. Booked -> showed (Breakthrough) | 44 | 47.3% | 98 | 56.3% | Below 65% benchmark |
| 10. Cancellations | 31 | 33% of booked | 53 | 30% of booked | High — Monday is the worst |
| 11. No-shows | 10 | 10.8% | 21 | 12.1% | Inside acceptable range |
| 12. Showed -> closed | 17 | 38.6% | 28 | 28.6% | 30d close rate well below 35-45% target |
| 13. Cash collected | $? | — | $363,000 | — | $13K avg per close |
| 14. Contract value | $? | — | $478,000 | — | $17K avg per close |
| 15. Onboarded -> Lions Pride | gap | gap | gap | gap | No Lions Pride flag in master_customers or fact_payments (empty) |

**SQL used (representative):**
```sql
-- Tickets + VIP (Stripe, dollars not cents)
WITH base AS (
  SELECT LOWER(TRIM(email)) AS email, DATE(created_at) AS dt, amount, is_combo_vip
  FROM `green-segment-491604-j8.cod_warehouse.stripe_transactions`
  WHERE status='succeeded' AND amount IN (27,54)
)
SELECT bucket, COUNT(*) tickets, COUNTIF(combo_vip=1 OR ct_54>0) vip_buyers
FROM (... 14d / 30d aggregations ...) GROUP BY bucket;

-- Booked / show / close
SELECT
  COUNT(*) AS booked,
  COUNTIF(appointment_status='confirmed' AND call_date<CURRENT_DATE()) AS showed,
  COUNTIF(appointment_status IN ('cancelled','canceled')) AS cancelled,
  COUNTIF(appointment_status='noshow') AS noshow,
  COUNTIF(enriched_outcome='closed') AS enrolled
FROM `green-segment-491604-j8.cod_warehouse.fact_bookings_enriched`
WHERE call_date BETWEEN DATE_SUB(CURRENT_DATE(),INTERVAL 30 DAY) AND CURRENT_DATE()
  AND LOWER(calendar) LIKE '%breakthrough%';
```

## Top 5 Leaks (Ranked by $ Recoverable / 30d)

1. **Close rate 28.6% vs 40% benchmark** — recovering to 40% = +11 enrollments = **+$143K cash / 30d**. Hypothesis: two unnamed closer IDs (`arlY3hbKHE2SvdQfJ8H5`, `ZjzzwaUReBcV5caNXCvx`) took 82 calls and closed 0 — either rookie reps, mis-assigned shows, or enrichment fail. Audit first.
2. **Monday cancellation rate 40% (21/52)** — cutting Monday cancellations in half = ~10 recovered shows = ~3 enrollments = **+$39K cash / 30d**. Hypothesis: Monday calls booked Sat/Sun on impulse, reality hits Monday AM. Test confirmation flow + reschedule offer.
3. **Show rate Tue-Thu at 61% (avg)** — getting to 70% = +6 shows = ~2 enrollments = **+$26K cash / 30d**. Reminder cadence, confirmation friction.
4. **VIP bump healthy at 66% but no downstream lift visible** — can't measure VIP vs std close rate because workshop_attended is NULL. Once Phase-10 bridges land we'll see if VIP is buying outcomes or just a tip.
5. **Friday show rate 67% but only 4 enrollments on 14 shows (29%)** — Friday closes worse than Tue-Thu (Tue 28%, Wed 24%, Thu 33%). Hypothesis: Friday cohort is later-stage delays, less qualified. Worth a closer-by-day cut next week.

## Source Comparison

| Source | Bookings (30d) | Shows | Enrollments | Hyros Rev | Meta Spend | CPBC | CAC |
|---|---|---|---|---|---|---|---|
| Meta paid (Hyros first-touch) | n/a | n/a | 11 | $89,000 | $222,880 | n/a | $20,262 |
| Google paid (Hyros first-touch) | n/a | n/a | 2 | $25,000 | $0 tracked | n/a | $0 |
| Cold email | n/a | n/a | not attributed | n/a | n/a | n/a | n/a |
| Organic / direct / unknown | 191 booked | 99 | 27 (enriched) / 4 (Hyros null) | $46K | — | — | — |

**Major gap:** 100% of `fact_bookings_enriched.fa_utm_source` rolls up to `direct_or_unknown`. UTMs aren't flowing from Meta to GHL bookings (this is the known infra issue). Hyros catches only 18 enrollments out of 28 actual closes — **35% of enrollment revenue is unattributed**. CAC by source is unreliable; only the blended figure ($222,880 / 28 enrollments = **$7,960 CAC blended**) is trustworthy.

CPBC (cost per booked call, blended) = $222,880 / 174 = **$1,281**. Way over the COD historical $400-600 zone.

## Show Rate Diagnostic

| DOW | Booked | Show% | Cancel% | NoShow% | Closed | Close% on Shows |
|---|---|---|---|---|---|---|
| Monday | 52 | **25.0%** | 40.4% | 7.7% | 5 | 38% |
| Tuesday | 32 | 56.3% | 25.0% | 18.8% | 5 | 28% |
| Wednesday | 34 | 61.8% | 20.6% | 17.6% | 5 | 24% |
| Thursday | 27 | 66.7% | 22.2% | 11.1% | 6 | 33% |
| Friday | 21 | 66.7% | 28.6% | 4.8% | 4 | 29% |
| Saturday | 23 | 56.5% | 34.8% | 8.7% | 2 | 15% |

**Friday vs Tue-Thu (30d):** Friday show 67% vs Tue-Thu show 61%. Friday is slightly *better* — Friday is not the show-rate leak. **Monday is the catastrophe** (25% show, 40% cancel). Two interventions for AM call:
- Confirm Monday call bookers Sun PM with a "still on?" SMS.
- Test moving Monday slots into a Tue-Thu band; the team may be losing capacity to a day that doesn't convert.

## Data Gaps Flagged

1. **`fact_bookings.email` is 100% NULL** (11,823 rows). Blocks cohort-pure ticket-to-call joins. Highest-leverage fix.
2. **`master_customers.workshop_attended` is 100% NULL** for last 30d cohort. Blocks workshop -> call funnel. PostHog null-partition backfill spec (2026-05-07) is the prerequisite.
3. **`master_customers.watch_time_seconds` is STRING type** — should be INT64. Casts fail.
4. **`fact_workshop_economics` table is EMPTY** (0 rows). The pre-built net-ROAS view doesn't exist yet.
5. **`fact_workshop_bookings` table is EMPTY**. Workshop attendance bridge not loaded.
6. **`fact_payments` table is EMPTY**. Phase-10 unified-payments not yet built.
7. **`fact_calls` table is EMPTY**. Enriched call data has to come from `fact_bookings_enriched.enriched_*` cols.
8. **UTM rolls up to ~100% direct_or_unknown** on bookings — Meta/Google/email sources lost between ad click and GHL booking. Known issue per `reference_cod_attribution_tracking.md`.
9. **Hyros captures 18/28 enrollments (64%)** — undercounting. Cross-reconcile `enriched_outcome='closed'` (truth) vs `hyros_sales` (attribution).
10. **Closer name enrichment fails on 82 calls** — two raw GHL user IDs show up instead of names. `dim_closers` mapping has gaps.
11. **kamg_cod dataset is empty.** All data lives in `cod_warehouse` only.

**ETL freshness:** Stripe 2026-05-11, Hyros 2026-05-11, master_customers ticket_purchase 2026-05-11, Meta ad_perf 2026-05-11. Live data is healthy; the gaps are in transformation/bridge tables, not source ingestion.

---
*Word count: ~1,150. SQL inline above and in commit history at `c:\Users\Kas Andz\Documents\kamg-ops\output\cod\morning-strategic-audit-2026-05-11\`.*
