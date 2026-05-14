/* ============================================
   Competitors -- market intelligence placeholder
   ============================================ */

App.registerPage('competitors', async (container) => {
  container.innerHTML = '';

  // Coming Soon banner
  const banner = document.createElement('div');
  banner.className = 'card';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-label', 'Competitors page status — not yet built');
  banner.style.cssText = 'text-align:center;padding:40px;margin-bottom:24px;border:1px dashed rgba(255,255,255,0.18)';
  banner.innerHTML = `
    <div aria-hidden="true" style="font-size:52px;margin-bottom:16px;opacity:0.35">&#9876;&#65039;</div>
    <h2 style="color:${Theme.COLORS.textSecondary};margin-bottom:8px">Competitors</h2>
    <p style="color:${Theme.COLORS.textMuted};margin-bottom:16px;max-width:520px;margin-left:auto;margin-right:auto;line-height:1.55">
      Competitive intelligence requires manual research + ad-library scraping — neither is automated yet. This page is a placeholder until those upstream sources are wired in.
    </p>
    <div style="padding:8px 20px;display:inline-block;border-radius:20px;background:rgba(108,92,231,0.1);color:${Theme.COLORS.accent};font-size:12px;font-weight:600;letter-spacing:.05em">Not Built · ETA TBD</div>
  `;
  container.appendChild(banner);

  // Skeleton sections — each lists the upstream source the section will consume.
  const skeletons = [
    { title: 'Positioning Map',   desc: 'Price vs. promise matrix across top competitors',                  source: 'Manual research (quarterly)' },
    { title: 'Pricing Table',     desc: 'Offer comparisons, tiers, and price anchoring intel',              source: 'Manual research + public funnel snapshots' },
    { title: 'Intelligence Feed', desc: 'Ad creative monitoring, funnel changes, and launch activity',      source: 'Meta Ad Library + Google Ads Transparency' },
  ];

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;opacity:0.2;pointer-events:none';
  container.appendChild(grid);

  skeletons.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    // Positioning Map spans full width
    if (i === 0) card.style.gridColumn = '1 / -1';
    card.style.minHeight = '200px';
    card.style.padding   = '20px';
    card.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${s.title}</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:6px">${s.desc}</div>
      <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;opacity:0.8">Source: ${s.source}</div>
      <div aria-hidden="true" style="height:130px;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-radius:8px;display:flex;align-items:center;justify-content:center">
        <div style="width:55%;height:2px;background:rgba(255,255,255,0.08);border-radius:2px"></div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Implementation plan — three phases, each phase = upstream source + target BQ table.
  // Surfaces concrete next steps so the page is informative even while empty.
  const planCard = document.createElement('div');
  planCard.className = 'card';
  planCard.style.cssText = 'padding:20px;margin-top:16px';
  const plan = [
    { phase: 'Phase 1', what: 'Quarterly manual research', target: 'bridge_competitors',         status: 'Not started' },
    { phase: 'Phase 2', what: 'Meta Ad Library scrape (weekly)', target: 'meta_competitor_ads',   status: 'Not started' },
    { phase: 'Phase 3', what: 'Public funnel snapshots (monthly)', target: 'competitor_funnel_snapshots', status: 'Not started' },
  ];
  let planRows = '';
  plan.forEach((p) => {
    planRows += `
      <div style="display:grid;grid-template-columns:90px 1fr 220px 110px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid ${Theme.COLORS.gridLine};font-size:12px">
        <span style="font-weight:700;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace;font-size:11px">${p.phase}</span>
        <span style="color:${Theme.COLORS.textPrimary}">${p.what}</span>
        <span style="color:${Theme.COLORS.textMuted};font-family:'JetBrains Mono',monospace;font-size:11px">→ ${p.target}</span>
        <span style="text-align:right"><span style="padding:3px 8px;border-radius:10px;background:${Theme.COLORS.accentGhost};color:${Theme.COLORS.accentLight};font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">${p.status}</span></span>
      </div>
    `;
  });
  planCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Implementation Plan</div>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:12px">To populate this page, each phase below must ship its upstream source + BQ target.</div>
    ${planRows}
  `;
  container.appendChild(planCard);

  // Manual logging template — bridge until automation ships. Lets ops paste a
  // structured note into #intel Slack now so research isn't lost while phase 1-3
  // pipelines remain "Not started". Copy button mirrors experiments.js pattern.
  const tplCard = document.createElement('div');
  tplCard.className = 'card';
  tplCard.style.cssText = 'padding:20px;margin-top:16px';
  const TPL_ID = 'comp-tpl-copy-btn';
  const TPL = `COMPETITOR FINDING — ${new Date().toISOString().slice(0, 10)}
- Competitor:
- Channel:        (Meta / Google / IG / email / other)
- Finding type:   (creative / pricing / funnel / launch / other)
- URL or screenshot:
- Threat level:   (low / med / high)
- Notes:`;
  tplCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:6px;flex-wrap:wrap">
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary}">Manual Logging Template</div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted}">Use until phase 1 ships</div>
    </div>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:10px;line-height:1.55">Copy this block, paste into #intel Slack, fill the fields. Findings accumulate in chat until the manual-research pipeline writes them to <code style="font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:3px">bridge_competitors</code>.</div>
    <div style="position:relative">
      <pre style="background:var(--bg-primary,rgba(255,255,255,0.02));border:1px solid ${Theme.COLORS.border};border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:${Theme.COLORS.textPrimary};line-height:1.7;overflow-x:auto;margin:0;white-space:pre">${TPL}</pre>
      <button id="${TPL_ID}" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.04);border:1px solid ${Theme.COLORS.border};border-radius:6px;color:${Theme.COLORS.textSecondary};font-size:11px;font-weight:600;padding:4px 10px;cursor:pointer">Copy</button>
    </div>
  `;
  container.appendChild(tplCard);
  const tplBtn = tplCard.querySelector(`#${TPL_ID}`);
  if (tplBtn) {
    tplBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(TPL).then(() => {
        tplBtn.textContent = 'Copied!';
        setTimeout(() => { tplBtn.textContent = 'Copy'; }, 1800);
      }).catch(() => {
        tplBtn.textContent = 'Error';
        setTimeout(() => { tplBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }
});
