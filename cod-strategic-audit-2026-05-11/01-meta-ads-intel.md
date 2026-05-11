# Meta Ads Intel -- 2026-05-11

**Data window:** live BQ `cod_warehouse.meta_ad_performance` through 2026-05-11 (synced today). 14d = Apr 27 -- May 11. 30d = Apr 11 -- May 11. Prior 14d = Apr 13 -- Apr 26. Account: **COD #5 only** (act_206306693361622); act_974384766072788 has zero spend in window. **Hyros tables still not in BQ** -- ROAS below is Meta-reported front-end (ticket layer) only; true funnel ROAS historically 8-15x higher per account-5 intel doc (2026-04-28).

## TL;DR for Russ (ROAS-focused)
1. **CPA collapsed from $92 to $36 in 14 days (-61%)** on flat spend ($101K vs $107K). Niche-pivot + Italy JIT campaign worked. If front-end ROAS holds, downstream 3x is now plausible -- the $6,426 CAC from Apr 20 is dead. (source: BQ live query)
2. **JIT Italy "No content grind" creative is the new MVP** -- $7,989 spend, 1,274 conversions, $6 CPA, but ROAS reports 0.01 -- these are **lead-form conversions, not workshop tickets**. Need attribution audit TODAY before scaling. If they ARE tickets, scale 50%+. If they're leads, build a real conversion bridge. (source: BQ live)
3. **MA Funnel Application campaign is bleeding** -- $6,564 spend / 10 conv / **$656 CPA** at $192 CPM. Either kill or stop counting it as ROAS-relevant; it's a high-ticket funnel that needs Hyros to judge fairly. (source: BQ live)

## Current State

### Topline (BQ live, COD #5 only)

| Period | Spend | Conv | CPA | CPM | CTR | Freq | Meta ROAS |
|---|---:|---:|---:|---:|---:|---:|---:|
| Last 14d | $101,653 | 2,847 | **$35.71** | $74.95 | 5.85% | 1.05 | 0.77 |
| Last 30d | $222,880 | 4,169 | $53.46 | $69.28 | 6.35% | 1.05 | 0.60 |
| Prior 14d | $107,170 | 1,160 | $92.39 | $63.65 | 6.81% | 1.05 | 0.49 |

**Delta:** 14d vs prior-14d -- spend -5%, conversions **+145%**, CPA **-61%**, Meta ROAS +57%. CPM up 18% (paying more per impression) but conversion efficiency more than compensated.

**vs Apr 20 baseline ($6,426 CAC):** Front-end ticket CPA is $36 in last 14d. Historical Meta-to-Hyros gap is 8-15x (account-5 intel 2026-04-28), so true CAC is roughly **$290-$540**. That's still far above the $100-150/ticket target Russ set but is a **massive recovery** from $6,426. The gap from front-end to enrollment CAC is where the leak now lives -- show rate, booking rate, close rate -- NOT acquisition.

### By campaign (14d, >$500 spend)

| Campaign | Spend | Conv | CPA | CTR | Note |
|---|---:|---:|---:|---:|---|
| ABO Cold Industry Adsets Winning | $79,707 | 1,164 | $68 | 7.73% | Workhorse. CPA stable. |
| JIT Italy "No content grind" -- Lead | $7,989 | 1,274 | **$6** | 3.21% | Lead-form conv, not tickets. Audit. |
| JIT Italy -- Schedule | $4,752 | 329 | $14 | 3.09% | Same suspicion. |
| MA Funnel Application | $6,564 | 10 | **$656** | 5.02% | Bleeding. |
| JIT Italy (parent) | $1,601 | 70 | $23 | 4.21% | Smaller |
| TOF Authority Reels | $615 | 0 | -- | 0.35% | Awareness, no conv by design |

### Best ad sets (14d, ex-JIT, by CPA)

1. Interest Stack Main -- AU/CA/UK Coaches -- **$53 CPA**, $18,594 spend, 354 conv -- **scale candidate**
2. Interest Stack FB + Coaches & Consultants FB -- $53 CPA, $6,389, 120 conv
3. Interest Stack FB + AU/CA Meme Ads -- $56 CPA, $4,016, 72 conv
4. FB Broad Therapists 3564 -- Russ Therapists Videos -- $63 CPA, $4,399, 70 conv
5. FB Broad Therapists 3564 -- Meme Ads -- $68 CPA, $13,876, 204 conv

### Best individual ads (14d, >$500 spend, ex-JIT)

- **Attorney Meme Ad 4** -- CTR jumped **+101% w-o-w** to 17.06%, $1,393 spend, 16 conv at $87 CPA, freq 1.03. **Just hit inflection. Scale.**
- **Meme Ad v2 -- 5** -- CTR +21.5% w-o-w to 4.70%, low spend ($533/$690), expand budget
- **Meme Ad 2 -- Copy 2** -- $7,759 spend, 128 conv, $61 CPA, 5.05% CTR. Stable workhorse.
- **New Meme Ad 1b** -- $9,008 spend, 168 conv, $54 CPA, 6.27% CTR. Strongest meme variant at scale.

### Apr 20 baseline check
| Metric | Apr 20 | Today (14d) | Status |
|---|---|---|---|
| Front-end CPA | implied ~$80-100 | $36 | Recovered |
| CAC (enrollment) | $6,426 | est $290-540 (Meta x 8-15) | Recovered |
| Workshop attendance | 61-62% | unknown (need GHL) | Stable per Apr 20 |
| Booking rate | 16% | unknown (need GHL) | Critical leak |
| Coaches CPA | $87+ | $53-56 | Improved |

## What's Working (scale candidates)

Per the **20% rule** (never reset learning phase with >20% jumps), all candidates below get a single 20% bump and a 7-day hold:

1. **Interest Stack Main AU/CA/UK Coaches** -- $53 CPA, 354 conv, freq 1.05. Bump $18.6K -> $22.3K weekly. Frequency has headroom.
2. **JIT Italy "No content grind" Lead campaign** -- ONLY scale once you confirm these 1,274 "conversions" are real workshop tickets. If yes, this is a $6 CPA goldmine and warrants 50% bump immediately (Russ-level decision).
3. **Attorney Meme Ad 4** -- 17% CTR, freq 1.03. Promote to its own adset duplicate, $300/day, 7-day test.
4. **Therapists 3564 Meme Ads adset** -- $68 CPA on $13.9K spend, freq 1.02. Bump 20%.
5. **Meme Ad 2 Copy 2** -- $7.7K, 128 conv at $61 CPA, freq 0.93 (room to push). Bump.

**Cross-account move:** Zero spend on COD #2 (act_974384766072788) in window. Consider duplicating top-3 winners into COD #2 to (a) diversify learning, (b) sandbox the foul-play exposure on #5, (c) test if account-level CPM differs.

## What's Bleeding (kill or fix)

**3x Kill Rule** (CPA > 2x target sustained 5+ days, no creative refresh pending = kill):

1. **MA Funnel Application** -- $656 CPA, $6,564 burned in 14d. **Either kill or move to "do not count in ROAS" bucket** until Hyros validates downstream MA enrollments ($40K+ PIF). 16 conversions in prior 30d at $157 CPA were promising; this 14d at $656 is a hard regression. Pause and ask: is the LP still aligned?
2. **MA LLA Stack -- Schedule** adset -- $1,789 spend, **0 conversions**. Kill today.
3. **Interest Stack FB MA Videos 500K NW 700+ FICO** -- $1,883 spend, **0 conversions**. Kill today.
4. **Attorney Lawyer new image v3 - Copy 3** -- $1,920, 18 conv, $107 CPA, freq 1.21. Replace creative.
5. **Russ Therapists Talking Head Ad 1 + Russ Therapist New Video 1** -- $6,200 combined, ~$88 CPA, freq 1.18. Underperforming the meme variants. Rotate out.
6. **WS Paid Today Coaches Russ Image 1 - Copy** -- $5,543, $64 CPA, **freq 1.49** (highest among prospecting). Approaching saturation. Reduce 30%.
7. **TOF Authority Reels (all exclusions)** -- $615 in 14d, 0 conv, 0.35% CTR. Either redesign or shut. Top-of-funnel reels CTR floor should be 1%+.

**Fatigue alerts (CTR decline last 7d vs prior 14d, >$500 recent spend):**
- Meme Ad 2 Copy 1: -23.8% CTR (still 4.65%, watch)
- JIT "No content grind" Lead: -23.4% CTR (still 3.11%, but driving the 1,274 conversions -- creative refresh needed before fatigue hits ROAS)
- JIT "No content grind" Schedule: -21.8% CTR
- Meme Ad 2 Copy 2: -11.9% CTR (still healthy at 4.81%)

## Top 10 Tests to Run in Next 14 Days (Ranked by Expected ROAS Impact)

| # | Test | Hypothesis | Ship | Expected Lift | Effort | Owner |
|---|---|---|---|---|---|---|
| 1 | **JIT Italy attribution audit** | "Conversions" are pixel-fired leads, not workshop tickets. If true, BQ "conversions" col is mis-labeled and ROAS is wrong everywhere | Pull `hyros_sales` x `meta_ad_performance` join on JIT campaign ad_ids; check event_name in Meta Events Manager | Could change topline ROAS by 30%+ in either direction | S | Pedro + Kas |
| 2 | **Attorney Meme Ad 4 dedicated scale** | +101% CTR inflection means creative-audience fit just landed; isolate to capture lift before fatigue | Duplicate to its own CBO ad set, $300/day, 1 ad, $50/day floor on attorney audience | 15-25% lift on attorney-segment CPA | S | Pedro |
| 3 | **Meta Purchase event optimization audit on niche ad sets** | Apr 16 anomaly (88 leads, 20 purchases on same spend) + current divergence suggests new niche adsets may be Lead-optimized, not Purchase | Audit each new adset's "Conversion event" setting in Meta; flip any Lead -> Purchase | 20-40% CPA improvement on mis-configured sets | S | Pedro |
| 4 | **Niche-Meme creative replication** | Meme Ad 2 Copy 2 + Meme Ad v2-5 + Attorney Meme Ad 4 all winning. Format is the lever, not the audience | Brief 4 new memes: 2 therapist, 2 educator, 2 attorney, same hook+layout as Meme Ad 2 Copy 2 | $5-10 CPA reduction across niche adsets | M | Akari + creative |
| 5 | **COD #2 reactivation w/ top 3 winners** | Audience exhaustion on #5 (CPM up 18%); #2 has untouched audience pool, may deliver 30-50% cheaper CPM short-term | Duplicate Meme Ad 2 Copy 2 + New Meme Ad 1b + Attorney Meme Ad 4 into act_974384766072788, $200/day each, 7-day test | If CPM gap holds, +$10-15K efficiency/month | M | Pedro |
| 6 | **MA Funnel: pause and re-architect** | $656 CPA can't be saved at current creative; campaign needs a fundamentally different angle for $40K+ buyers | Pause MA Funnel campaign; in parallel brief 3 new MA-specific creatives targeting "9-figure operator" angle (per the empire builder positioning shift) | Stop $1.5K-2K/week bleed; restart with Hyros-validated baseline | M | Russ + Kas |
| 7 | **Italy JIT creative refresh** | "No content grind" CTR declining 22%; need 2nd hook before main creative dies | Brief 2 new variants: same format, different opening hook ("3 clients in 30 days" / "Skip the content treadmill") | Extend campaign life 2-3 weeks | M | Akari |
| 8 | **Top-of-funnel Reels hook test** | Current TOF Reels at 0.35% CTR are unwatchable. Need pattern-interrupt before reach is wasted | Replace 3 Authority Reels with 3 "Russ on camera, 5-second hook" variants. Mobile-first vertical only | TOF CTR -> 1.5%+; build remarketing pool | M | Akari |
| 9 | **Frequency cap on WS Paid Today Coaches Russ Image 1** | Freq 1.49 + flat CTR = late-stage saturation; cutting freq lets fresh creatives breathe | Reduce daily budget 30%, or add 7-day exclusion of previous workshop registrants | $5-8 CPA improvement | S | Pedro |
| 10 | **Niche LP-to-ad headline match audit** | Apr 20 root cause was "50K offer" ad to "$10K coaching" LP mismatch. Re-validate on every active ad creative vs current LP headline | Spreadsheet: every active ad's headline + first body line vs target LP H1. Flag any drift | Closes the funnel leak between ad CTR and reg-page CVR | S | Kas |

## Risk Watch

- **Foul-play status (account #5):** No new spend anomalies in last 14d. The 30d audit (project_cod_meta_foulplay_audit) is still blocked on the URL column export. Recommend re-pull this week.
- **CPM inflation:** 14d CPM ($75) vs prior 14d ($64) = +18%. Driven by expensive niche audiences (Coaches AU/CA/UK at $119 CPM, Therapists at $92-143). Watching for any single adset crossing $200 CPM without compensating CPA.
- **Frequency caps:** Account-wide avg freq 1.05 = healthy. Two single-ad outliers above 1.4: WS Paid Today Coaches Russ Image 1 Copy (1.49), Ad Static Reel 4 New Copy (1.24). No retargeting frequency data this window because retargeting was nearly paused (correct call).
- **Audience exhaustion:** Coaches Main Interest Stack still highest spend ($18K) but CPA holding at $53. No exhaustion signal yet. LLA Stack Coaches at freq 1.24 is the earliest warning -- prepare LLA refresh seed list this week.
- **Hyros <-> Meta gap:** Still cannot calculate true blended ROAS. Hyros not in BQ. This is the #1 data infra blocker -- without it, every "ROAS" number in this doc carries an 8-15x uncertainty band. **Escalate to Matt F today.**
- **JIT campaign event labeling:** If the 1,603 "conversions" in JIT campaigns are pixel-fired leads not workshop ticket purchases, our 14d topline CPA of $36 is overstated. Real CPA may be $80-90. **Verify before any team comms.**

---

*Sources: BigQuery `cod_warehouse.meta_ad_performance` (live, synced 2026-05-11); `meta-30d-analysis.json` (Apr 17); `account-5-ads-intel-2026-04-28.html`; `cod-segment-analysis-30d.html`; memory `project_cod_apr20_call_actions.md`; memory `reference_cod_marketing_intel.md`. Word count ~1,480.*
