/* Placeholder pages -- Google Ads + Cold Email (Coming Soon) */

(function() {
  const PLACEHOLDERS = {
    'google-ads': {
      title: 'Google Ads',
      description: 'Search, Display, and YouTube campaign analytics',
      metrics: ['Total Spend', 'ROAS', 'CPC', 'CTR', 'Conversions', 'Cost/Conv'],
      charts: ['Campaign Performance', 'Keyword Analysis', 'Quality Score Trend', 'Search Terms'],
    },
    'cold-email': {
      title: 'Cold Email',
      description: 'Instantly + Vovik outreach metrics',
      metrics: ['Emails Sent', 'Open Rate', 'Reply Rate', 'Booking Rate', 'Sequences Active', 'Deliverability'],
      charts: ['Sequence Comparison', 'Reply Rate Trend', 'Domain Health', 'A/B Test Results'],
    },
  };

  Object.entries(PLACEHOLDERS).forEach(([pageName, config]) => {
    App.registerPage(pageName, async (container) => {
      container.innerHTML = '';

      // Coming Soon banner
      const banner = document.createElement('div');
      banner.className = 'card';
      banner.style.cssText = 'text-align:center;padding:32px;margin-bottom:24px;border:1px dashed rgba(255,255,255,0.15)';
      banner.innerHTML = `
        <div style="font-size:48px;margin-bottom:16px;opacity:0.3">🚧</div>
        <h2 style="color:${Theme.COLORS.textSecondary};margin-bottom:8px">${config.title}</h2>
        <p style="color:${Theme.COLORS.textMuted}">${config.description}</p>
        <div style="margin-top:16px;padding:8px 16px;display:inline-block;border-radius:20px;background:rgba(108,92,231,0.1);color:${Theme.COLORS.accent};font-size:12px;font-weight:600">Coming Soon</div>
      `;
      container.appendChild(banner);

      // Greyed-out KPI skeleton
      const kpiRow = document.createElement('div');
      kpiRow.className = 'kpi-grid';
      kpiRow.style.opacity = '0.25';
      kpiRow.style.pointerEvents = 'none';
      config.metrics.forEach(m => {
        const card = document.createElement('div');
        card.className = 'kpi-card';
        card.innerHTML = `
          <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:8px">${m}</div>
          <div style="height:28px;background:rgba(255,255,255,0.05);border-radius:4px;width:60%"></div>
        `;
        kpiRow.appendChild(card);
      });
      container.appendChild(kpiRow);

      // Greyed-out chart skeletons
      const chartGrid = document.createElement('div');
      chartGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;opacity:0.2;pointer-events:none';
      config.charts.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.minHeight = '200px';
        card.innerHTML = `
          <div style="font-size:13px;color:${Theme.COLORS.textMuted};margin-bottom:16px">${c}</div>
          <div style="height:150px;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-radius:8px;display:flex;align-items:center;justify-content:center">
            <div style="width:60%;height:2px;background:rgba(255,255,255,0.1)"></div>
          </div>
        `;
        chartGrid.appendChild(card);
      });
      container.appendChild(chartGrid);
    });
  });
})();
