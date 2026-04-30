/* ============================================
   Attribution -- multi-model comparison placeholder
   PRD spec: Grouped Bar (Meta Pixel / Google Ads / Hyros First / Hyros Last),
             Treemap by Platform, Variance Table (>20% disagreement),
             Source Performance Table.
   Awaiting: mv_attribution_comparison + bridge_data_reconciliation BQ tables.
   ============================================ */

App.registerPage('attribution', async (container) => {
  container.innerHTML = '';

  // Coming Soon banner
  const banner = document.createElement('div');
  banner.className = 'card';
  banner.style.cssText = 'text-align:center;padding:40px;margin-bottom:24px;border:1px dashed rgba(255,255,255,0.15)';
  banner.innerHTML = `
    <div style="font-size:52px;margin-bottom:16px;opacity:0.35">&#128200;</div>
    <h2 style="color:${Theme.COLORS.textSecondary};margin-bottom:8px">Attribution</h2>
    <p style="color:${Theme.COLORS.textMuted};margin-bottom:16px">Cross-source reconciliation across Meta Pixel, Google Ads, Hyros First-Click, and Hyros Last-Click</p>
    <div style="padding:8px 20px;display:inline-block;border-radius:20px;background:rgba(108,92,231,0.1);color:${Theme.COLORS.accent};font-size:12px;font-weight:600;letter-spacing:.05em">Coming Soon</div>
    <p style="color:${Theme.COLORS.textMuted};font-size:11px;margin-top:14px">Awaiting <code style="font-family:'JetBrains Mono',monospace;font-size:10px;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">mv_attribution_comparison</code> + <code style="font-family:'JetBrains Mono',monospace;font-size:10px;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">bridge_data_reconciliation</code> tables</p>
  `;
  container.appendChild(banner);

  // Skeleton sections matching PRD 4-component spec
  const skeletons = [
    { title: 'Model Comparison',     desc: 'Grouped bar chart: revenue attributed by Meta Pixel / Google Ads / Hyros First / Hyros Last per source' },
    { title: 'Platform Treemap',     desc: 'Spend share vs. attributed revenue share by platform' },
    { title: 'Variance Table',       desc: 'Sources with >20% disagreement between models -- where to investigate first' },
    { title: 'Source Performance',   desc: 'Per-source CAC, ROAS, and confidence score across all 4 attribution models' },
  ];

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;opacity:0.2;pointer-events:none';
  container.appendChild(grid);

  skeletons.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    // Model Comparison spans full width
    if (i === 0) card.style.gridColumn = '1 / -1';
    card.style.minHeight = '200px';
    card.style.padding   = '20px';
    card.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">${s.title}</div>
      <div style="font-size:12px;color:${Theme.COLORS.textMuted};margin-bottom:20px">${s.desc}</div>
      <div style="height:130px;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-radius:8px;display:flex;align-items:center;justify-content:center">
        <div style="width:55%;height:2px;background:rgba(255,255,255,0.08);border-radius:2px"></div>
      </div>
    `;
    grid.appendChild(card);
  });
});
