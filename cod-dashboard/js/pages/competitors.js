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
});
