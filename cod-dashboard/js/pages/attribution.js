/* ============================================
   Attribution -- multi-source attribution comparison
   PRD components:
     1. Grouped Bar -- Model Comparison (Hyros first / last / scientific blend)
     2. Treemap -- Revenue by Platform (Plotly)
     3. Variance Table -- Reconciliation gaps >20%
     4. Source Performance Table
   ============================================ */

App.registerPage('attribution', async (container) => {
  const days = (typeof Filters !== 'undefined' && Filters.getDays) ? Filters.getDays() : 30;

  let kpiData, modelRows, sourceRows;
  try {
    [kpiData, modelRows, sourceRows] = await Promise.all([
      API.query('attribution', 'default', { days }),
      API.query('attribution', 'multiModel', { days }),
      API.query('attribution', 'multiSource', { days }),
    ]);
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p style="color:${Theme.COLORS.textMuted}">Failed to load Attribution: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';
  const k = (kpiData && kpiData.length > 0) ? kpiData[0] : {};

  // ---- Page Header ----
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:24px';
  header.innerHTML = `
    <h2 style="font-size:20px;font-weight:700;color:${Theme.COLORS.textPrimary};margin:0 0 4px 0">Attribution</h2>
    <div style="font-size:12px;color:${Theme.COLORS.textMuted}">Multi-source attribution comparison &middot; Hyros vs Meta &middot; reconciliation gaps</div>
  `;
  container.appendChild(header);

  // ---- KPI Strip ----
  const kpiEl = document.createElement('div');
  container.appendChild(kpiEl);
  Components.renderKPIStrip(kpiEl, [
    { label: 'Total Revenue (Hyros)', value: parseFloat(k.total_revenue) || 0, format: 'money' },
    { label: 'Total Sales',           value: parseInt(k.total_sales) || 0,     format: 'num' },
    { label: 'Ticket Revenue',        value: parseFloat(k.ticket_revenue) || 0, format: 'money' },
    { label: 'Ad Spend (Meta)',       value: parseFloat(k.total_spend) || 0,    format: 'money' },
    { label: 'Total ROAS',            value: ((parseFloat(k.total_roas) || 0)).toFixed(2) + 'x', format: 'text' },
    { label: 'Ticket ROAS',           value: ((parseFloat(k.ticket_roas) || 0)).toFixed(2) + 'x', format: 'text' },
  ]);

  // Helpers
  function fmtMoney(n) {
    var v = Math.round(parseFloat(n) || 0);
    if (Math.abs(v) >= 1000) return '$' + (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'k';
    return '$' + v.toLocaleString();
  }
  function fmtNum(n) { return (parseInt(n) || 0).toLocaleString(); }
  function shortSource(src) {
    if (!src) return 'Unknown';
    if (src === 'Unknown' || src === 'None' || src === 'Direct') return src;
    if (src.length <= 32) return src;
    return src.slice(0, 30) + '...';
  }

  const allRows = modelRows || [];
  const firstTouchRows = allRows.filter(r => r.model === 'first_touch');
  const lastTouchRows  = allRows.filter(r => r.model === 'last_touch');
  const sciRows        = allRows.filter(r => r.model === 'scientific');

  // ---- Section 1: Grouped Bar -- Model Comparison ----
  const modelSection = document.createElement('div');
  modelSection.style.cssText = 'margin-top:32px';
  modelSection.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Model Comparison &middot; Top 8 Sources</h3>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:16px">Revenue by source under 3 Hyros models. First-touch credits the entry source; Last-touch credits the closing source; Scientific = 50/50 blend.</div>`;
  container.appendChild(modelSection);

  const modelCard = document.createElement('div');
  modelCard.className = 'card';
  modelCard.style.cssText = 'padding:20px';
  const modelCanvas = document.createElement('canvas');
  modelCanvas.id = 'attr-model-comparison';
  modelCanvas.style.height = '340px';
  modelCard.appendChild(modelCanvas);
  modelSection.appendChild(modelCard);

  const topSources = [...firstTouchRows]
    .sort((a, b) => (parseFloat(b.revenue) || 0) - (parseFloat(a.revenue) || 0))
    .slice(0, 8)
    .map(r => r.source);

  function revFor(rows, src) {
    const r = rows.find(x => x.source === src);
    return r ? (parseFloat(r.revenue) || 0) : 0;
  }

  Theme.createChart('attr-model-comparison', {
    type: 'bar',
    data: {
      labels: topSources.map(shortSource),
      datasets: [
        { label: 'Hyros First-Touch', data: topSources.map(s => revFor(firstTouchRows, s)), backgroundColor: '#06b6d4', borderRadius: 3 },
        { label: 'Hyros Last-Touch',  data: topSources.map(s => revFor(lastTouchRows, s)),  backgroundColor: '#a855f7', borderRadius: 3 },
        { label: 'Scientific (50/50)', data: topSources.map(s => revFor(sciRows, s)),       backgroundColor: '#22c55e', borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: Theme.COLORS.textSecondary, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, autoSkip: false, maxRotation: 30, minRotation: 30 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: Theme.COLORS.textMuted, font: { size: 10 }, callback: v => fmtMoney(v) }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  // ---- Section 2: Treemap -- Revenue by Platform ----
  const treeSection = document.createElement('div');
  treeSection.style.cssText = 'margin-top:32px';
  treeSection.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Revenue by Platform</h3>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:16px">First-touch source classified into platforms. Size = revenue.</div>`;
  container.appendChild(treeSection);

  const treeCard = document.createElement('div');
  treeCard.className = 'card';
  treeCard.style.cssText = 'padding:20px';
  const treeDiv = document.createElement('div');
  treeDiv.id = 'attr-platform-treemap';
  treeDiv.style.cssText = 'width:100%;height:380px';
  treeCard.appendChild(treeDiv);
  treeSection.appendChild(treeCard);

  function classifyPlatform(src) {
    var s = (src || '').toLowerCase();
    if (s.includes('facebook') || s.includes('meta') || /\bfb\b/.test(s) || s.includes('instagram')) return 'Facebook / Meta';
    if (s.includes('google') || s.includes('adwords')) return 'Google';
    if (s.includes('youtube') || s.startsWith('yt ')) return 'YouTube';
    if (s.includes('cold') || s.includes('email') || s.includes('bison') || s.includes('outbound')) return 'Cold Email';
    if (s.includes('referral') || s.includes('franzi') || s.includes('partner')) return 'Referral';
    if (s.includes('organic') || s.includes('direct') || src === 'Unknown' || !src) return 'Organic / Direct';
    return 'Other';
  }

  const platformAgg = {};
  firstTouchRows.forEach(function(r) {
    var p = classifyPlatform(r.source);
    if (!platformAgg[p]) platformAgg[p] = { revenue: 0, sales: 0 };
    platformAgg[p].revenue += parseFloat(r.revenue) || 0;
    platformAgg[p].sales += parseInt(r.sales) || 0;
  });

  const platformOrder = ['Facebook / Meta', 'Google', 'YouTube', 'Cold Email', 'Referral', 'Organic / Direct', 'Other'];
  const platformColors = {
    'Facebook / Meta': '#1877f2',
    'Google':          '#4285f4',
    'YouTube':         '#ff0000',
    'Cold Email':      '#22d3ee',
    'Referral':        '#facc15',
    'Organic / Direct': '#22c55e',
    'Other':           '#6b7280',
  };
  const platformLabels = [], platformValues = [], platformText = [], platformBg = [];
  platformOrder.forEach(function(p) {
    if (platformAgg[p] && platformAgg[p].revenue > 0) {
      platformLabels.push(p);
      platformValues.push(platformAgg[p].revenue);
      platformText.push(p + '<br>' + fmtMoney(platformAgg[p].revenue) + ' &middot; ' + platformAgg[p].sales + ' sales');
      platformBg.push(platformColors[p]);
    }
  });

  if (platformLabels.length && typeof Plotly !== 'undefined') {
    Plotly.newPlot(treeDiv, [{
      type: 'treemap',
      labels: platformLabels,
      parents: platformLabels.map(() => ''),
      values: platformValues,
      text: platformText,
      textinfo: 'text',
      hoverinfo: 'text',
      marker: { colors: platformBg, line: { width: 2, color: '#0f1117' } },
      textfont: { family: 'Inter, sans-serif', size: 13, color: '#fff' },
    }], {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 0, r: 0, t: 0, b: 0 },
      font: { family: 'Inter, sans-serif', color: '#f1f5f9' },
    }, { displayModeBar: false, responsive: true });
  } else {
    treeDiv.innerHTML = '<div style="padding:40px;text-align:center;color:' + Theme.COLORS.textMuted + ';font-size:12px">No first-touch revenue in window.</div>';
  }

  // ---- Section 3: Variance Table -- Reconciliation Gaps ----
  const varSection = document.createElement('div');
  varSection.style.cssText = 'margin-top:32px';
  varSection.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Reconciliation Gaps</h3>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:16px">Where Hyros first-touch and last-touch disagree by >20%. Kas debugging tool.</div>`;
  container.appendChild(varSection);

  const varCard = document.createElement('div');
  varCard.className = 'card';
  varCard.style.cssText = 'padding:20px;overflow-x:auto';
  varSection.appendChild(varCard);

  const varSources = new Set();
  firstTouchRows.forEach(r => varSources.add(r.source));
  lastTouchRows.forEach(r => varSources.add(r.source));

  const varRows = [];
  varSources.forEach(function(src) {
    var fr = firstTouchRows.find(x => x.source === src);
    var lr = lastTouchRows.find(x => x.source === src);
    var firstRev = fr ? (parseFloat(fr.revenue) || 0) : 0;
    var lastRev  = lr ? (parseFloat(lr.revenue) || 0) : 0;
    if (firstRev < 100 && lastRev < 100) return;
    var maxRev = Math.max(firstRev, lastRev);
    var pctDiff = maxRev > 0 ? (Math.abs(firstRev - lastRev) / maxRev) * 100 : 0;
    if (pctDiff < 20) return;
    varRows.push({ source: src, firstRev: firstRev, lastRev: lastRev, delta: lastRev - firstRev, pctDiff: pctDiff });
  });
  varRows.sort((a, b) => b.pctDiff - a.pctDiff);

  if (!varRows.length) {
    varCard.innerHTML = `<div style="padding:30px 20px;text-align:center;color:${Theme.COLORS.textMuted};font-size:12px">No sources with >20% disagreement between first-touch and last-touch. Attribution is reconciled.</div>`;
  } else {
    var vh = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Source</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">First-Touch</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Last-Touch</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Delta</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">% Diff</th>
      </tr></thead><tbody>`;
    varRows.forEach(function(r) {
      var deltaColor = r.delta > 0 ? '#22c55e' : '#ef4444';
      var pctColor = r.pctDiff >= 50 ? '#ef4444' : r.pctDiff >= 30 ? '#f59e0b' : '#06b6d4';
      vh += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:8px 10px;color:${Theme.COLORS.textPrimary};white-space:nowrap" title="${r.source}">${shortSource(r.source)}</td>
        <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace">${fmtMoney(r.firstRev)}</td>
        <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace">${fmtMoney(r.lastRev)}</td>
        <td style="padding:8px 10px;text-align:right;color:${deltaColor};font-family:'JetBrains Mono',monospace;font-weight:600">${r.delta > 0 ? '+' : ''}${fmtMoney(r.delta)}</td>
        <td style="padding:8px 10px;text-align:right;color:${pctColor};font-family:'JetBrains Mono',monospace;font-weight:700">${r.pctDiff.toFixed(1)}%</td>
      </tr>`;
    });
    vh += '</tbody></table>';
    varCard.innerHTML = vh;
  }

  // ---- Section 4: Source Performance Table ----
  const srcSection = document.createElement('div');
  srcSection.style.cssText = 'margin-top:32px';
  srcSection.innerHTML = `
    <h3 style="font-size:15px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Source Performance</h3>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:16px">Top sources by first-touch revenue. Counts split into ticket sales (&lt;= $100) vs enrollment sales (&gt; $500).</div>`;
  container.appendChild(srcSection);

  const srcCard = document.createElement('div');
  srcCard.className = 'card';
  srcCard.style.cssText = 'padding:20px;overflow-x:auto';
  srcSection.appendChild(srcCard);

  const sortedSources = [...firstTouchRows]
    .sort((a, b) => (parseFloat(b.revenue) || 0) - (parseFloat(a.revenue) || 0))
    .slice(0, 25);

  if (!sortedSources.length) {
    srcCard.innerHTML = `<div style="padding:30px 20px;text-align:center;color:${Theme.COLORS.textMuted};font-size:12px">No source data in last ${days} days.</div>`;
  } else {
    var sh = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="text-align:left;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Source</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Sales</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Tickets</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Enrollments</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Ticket Rev</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Enroll Rev</th>
        <th style="text-align:right;padding:8px 10px;color:${Theme.COLORS.textMuted};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.07)">Total Rev</th>
      </tr></thead><tbody>`;
    sortedSources.forEach(function(r) {
      sh += `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:8px 10px;color:${Theme.COLORS.textPrimary};white-space:nowrap" title="${r.source}">${shortSource(r.source)}</td>
        <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace">${fmtNum(r.sales)}</td>
        <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace">${fmtNum(r.ticket_sales)}</td>
        <td style="padding:8px 10px;text-align:right;color:#22c55e;font-family:'JetBrains Mono',monospace;font-weight:600">${fmtNum(r.enrollment_sales)}</td>
        <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace">${fmtMoney(r.ticket_revenue)}</td>
        <td style="padding:8px 10px;text-align:right;color:#22c55e;font-family:'JetBrains Mono',monospace;font-weight:600">${fmtMoney(r.enrollment_revenue)}</td>
        <td style="padding:8px 10px;text-align:right;color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace;font-weight:700">${fmtMoney(r.revenue)}</td>
      </tr>`;
    });
    sh += '</tbody></table>';
    srcCard.innerHTML = sh;
  }

  // ---- Source Comparison Footer ----
  const ms = sourceRows || [];
  const metaRow = ms.find(r => r.platform === 'Meta Reported') || {};
  const hyrosFirst = ms.find(r => r.platform === 'Hyros (First Touch)') || {};
  const hyrosLast  = ms.find(r => r.platform === 'Hyros (Last Touch)') || {};
  const footer = document.createElement('div');
  footer.style.cssText = `margin-top:24px;padding:16px;background:rgba(124,58,237,0.04);border:1px solid rgba(124,58,237,0.15);border-radius:8px;font-size:11px;color:${Theme.COLORS.textSecondary};line-height:1.6`;
  footer.innerHTML = `
    <div style="font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:8px;font-size:12px">Source Reconciliation Summary &middot; ${days}d</div>
    <div>Meta reported spend: <strong style="color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace">${fmtMoney(metaRow.spend)}</strong></div>
    <div>Hyros first-touch revenue: <strong style="color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace">${fmtMoney(hyrosFirst.attributed_revenue)}</strong></div>
    <div>Hyros last-touch revenue: <strong style="color:${Theme.COLORS.textPrimary};font-family:'JetBrains Mono',monospace">${fmtMoney(hyrosLast.attributed_revenue)}</strong></div>
    <div style="margin-top:8px;font-size:10px;color:${Theme.COLORS.textMuted};font-family:'JetBrains Mono',monospace">Note: Google Ads attribution data pending INFRA-04 -- Hyros is the source of truth for revenue, Meta for spend.</div>
  `;
  container.appendChild(footer);
});

if (typeof App !== 'undefined' && App.onFilterChange) {
  App.onFilterChange(() => App.navigate('attribution'));
}
