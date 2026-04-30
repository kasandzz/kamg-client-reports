/* ============================================
   Data Health -- ETL freshness, reconciliation, quality alerts
   Kas-only diagnostic page (hidden from Russ).

   Backend dependencies:
     - dataFreshness query (LIVE) -> per-table last_modified_ms via INFORMATION_SCHEMA
     - etl_run_log query           (NOT BUILT) -> per-sync run history
     - reconciliation query        (NOT BUILT) -> cross-source variance
   ============================================ */

App.registerPage('data-health', async (container) => {
  container.innerHTML = '';

  // ---- Source classification + per-source SLA thresholds ----
  // [warn_hours, critical_hours] -- staleness windows per data source.
  const SOURCES = [
    { key: 'hyros',     label: 'Hyros',         match: /^hyros_/,             warn: 12, crit: 24 },
    { key: 'meta',      label: 'Meta Ads',      match: /^meta_/,              warn: 36, crit: 72 },
    { key: 'google',    label: 'Google Ads',    match: /^google_ads_/,        warn: 36, crit: 72 },
    { key: 'stripe',    label: 'Stripe',        match: /^stripe_/,            warn: 6,  crit: 24 },
    { key: 'ghl',       label: 'GoHighLevel',   match: /^ghl_/,               warn: 6,  crit: 24 },
    { key: 'posthog',   label: 'PostHog',       match: /^posthog_/,           warn: 6,  crit: 24 },
    { key: 'sendgrid',  label: 'SendGrid',      match: /^sendgrid_/,          warn: 36, crit: 72 },
    { key: 'sheets',    label: 'Google Sheets', match: /^sheets_/,            warn: 168, crit: 336 },
    { key: 'bison',     label: 'Cold (Bison)',  match: /^cold_outbound_/,     warn: 24, crit: 72 },
    { key: 'mat',       label: 'BQ Mat Views',  match: /^(mat_|v_|vw_)/,      warn: 24, crit: 48 },
  ];

  function classify(tableName) {
    return SOURCES.find(s => s.match.test(tableName)) || { key: 'other', label: 'Other', warn: 24, crit: 72 };
  }

  function statusFor(ageHours, warn, crit) {
    if (ageHours == null || !isFinite(ageHours)) return { state: 'unknown', color: Theme.COLORS.textMuted, label: 'NO DATA' };
    if (ageHours >= crit) return { state: 'critical', color: Theme.COLORS.danger,  label: 'CRITICAL' };
    if (ageHours >= warn) return { state: 'warning',  color: Theme.COLORS.warning, label: 'STALE' };
    return                    { state: 'fresh',    color: Theme.COLORS.success, label: 'FRESH' };
  }

  function ageHoursFromMs(ms) {
    if (!ms || ms <= 0) return null;
    return (Date.now() - ms) / (1000 * 60 * 60);
  }

  function fmtAge(hours) {
    if (hours == null) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    if (hours < 24) return `${hours.toFixed(1)}h ago`;
    const days = hours / 24;
    if (days < 14) return `${days.toFixed(1)}d ago`;
    return `${Math.round(days)}d ago`;
  }

  // ---- Loading state ----
  const loadingNote = document.createElement('div');
  loadingNote.style.cssText = `padding:24px;color:${Theme.COLORS.textMuted};font-size:13px`;
  loadingNote.textContent = 'Loading freshness data from BQ INFORMATION_SCHEMA…';
  container.appendChild(loadingNote);

  let freshnessMap;
  try {
    freshnessMap = await Api.getDataFreshness();
  } catch (err) {
    loadingNote.textContent = `Failed to load: ${err.message}`;
    loadingNote.style.color = Theme.COLORS.danger;
    return;
  }

  container.removeChild(loadingNote);

  // ---- Build table rows with classification ----
  const rows = [];
  for (const [tableName, ms] of freshnessMap.entries()) {
    const src = classify(tableName);
    const age = ageHoursFromMs(ms);
    const status = statusFor(age, src.warn, src.crit);
    rows.push({ table: tableName, ms, age, src, status });
  }
  rows.sort((a, b) => (b.age ?? -1) - (a.age ?? -1));

  // ---- Top KPI strip ----
  const totalTables = rows.length;
  const stale = rows.filter(r => r.status.state === 'warning').length;
  const critical = rows.filter(r => r.status.state === 'critical').length;
  const unknown = rows.filter(r => r.status.state === 'unknown').length;
  const fresh = rows.filter(r => r.status.state === 'fresh').length;

  const kpiStrip = document.createElement('div');
  kpiStrip.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px';
  const kpis = [
    { label: 'Tables Tracked',   value: totalTables, color: Theme.COLORS.textPrimary },
    { label: 'Fresh',             value: fresh,       color: Theme.COLORS.success },
    { label: 'Stale (warn)',      value: stale,       color: Theme.COLORS.warning },
    { label: 'Critical',          value: critical,    color: Theme.COLORS.danger },
    { label: 'No Data',           value: unknown,     color: Theme.COLORS.textMuted },
  ];
  kpis.forEach(k => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:16px';
    card.innerHTML = `
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${Theme.COLORS.textMuted};margin-bottom:8px">${k.label}</div>
      <div style="font-size:28px;font-weight:700;color:${k.color};font-family:'JetBrains Mono',monospace">${k.value}</div>
    `;
    kpiStrip.appendChild(card);
  });
  container.appendChild(kpiStrip);

  // ---- Header ----
  const headerCard = document.createElement('div');
  headerCard.className = 'card';
  headerCard.style.cssText = 'padding:16px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px';
  headerCard.innerHTML = `
    <div>
      <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary}">ETL Freshness by Source</div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-top:4px">SLA windows per data source. Click table for details.</div>
    </div>
    <div style="display:flex;gap:14px;font-size:11px;color:${Theme.COLORS.textMuted}">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.success};margin-right:4px"></span>Fresh</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.warning};margin-right:4px"></span>Stale</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${Theme.COLORS.danger};margin-right:4px"></span>Critical</span>
    </div>
  `;
  container.appendChild(headerCard);

  // ---- Per-source cards ----
  const sourceGrid = document.createElement('div');
  sourceGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px;margin-bottom:24px';
  container.appendChild(sourceGrid);

  // Group rows by source
  const bySource = new Map();
  for (const r of rows) {
    if (!bySource.has(r.src.key)) bySource.set(r.src.key, { src: r.src, items: [] });
    bySource.get(r.src.key).items.push(r);
  }

  // Render one card per source (sort by worst status first)
  const sourceOrder = [...bySource.values()].sort((a, b) => {
    const score = (g) => g.items.reduce((s, r) => s + (r.status.state === 'critical' ? 100 : r.status.state === 'warning' ? 10 : 0), 0);
    return score(b) - score(a);
  });

  for (const group of sourceOrder) {
    const worst = group.items.reduce((w, r) => {
      const rank = { critical: 3, warning: 2, unknown: 1, fresh: 0 };
      return rank[r.status.state] > rank[w.status.state] ? r : w;
    }, group.items[0]);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `padding:16px;border-left:3px solid ${worst.status.color}`;
    let rowsHTML = '';
    for (const r of group.items) {
      rowsHTML += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid ${Theme.COLORS.gridLine};font-size:12px">
          <span style="font-family:'JetBrains Mono',monospace;color:${Theme.COLORS.textSecondary};font-size:11px">${r.table}</span>
          <span style="display:flex;gap:8px;align-items:center">
            <span style="color:${Theme.COLORS.textMuted};font-size:10px">${fmtAge(r.age)}</span>
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${r.status.color}"></span>
          </span>
        </div>
      `;
    }
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textPrimary}">${group.src.label}</div>
          <div style="font-size:10px;color:${Theme.COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em;margin-top:2px">SLA: warn ${group.src.warn}h · crit ${group.src.crit}h</div>
        </div>
        <span style="padding:3px 8px;border-radius:10px;background:${worst.status.color}22;color:${worst.status.color};font-size:9px;font-weight:700;letter-spacing:.05em">${worst.status.label}</span>
      </div>
      ${rowsHTML}
    `;
    sourceGrid.appendChild(card);
  }

  // ---- Page coverage table: which dashboard pages are at risk ----
  const coverageCard = document.createElement('div');
  coverageCard.className = 'card';
  coverageCard.style.cssText = 'padding:20px;margin-bottom:24px';
  coverageCard.innerHTML = `
    <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.textPrimary};margin-bottom:6px">Dashboard Page Coverage</div>
    <div style="font-size:11px;color:${Theme.COLORS.textMuted};margin-bottom:14px">A page is "at risk" if any source table breaches its SLA window.</div>
  `;
  const pageMap = Api.PAGE_TABLES || {};
  const pageRows = [];
  for (const [pageName, tables] of Object.entries(pageMap)) {
    const matchedRows = tables.map(t => rows.find(r => r.table === t)).filter(Boolean);
    if (!matchedRows.length) continue;
    const worstRow = matchedRows.reduce((w, r) => {
      const rank = { critical: 3, warning: 2, unknown: 1, fresh: 0 };
      return rank[r.status.state] > rank[w?.status.state ?? 'fresh'] ? r : w;
    }, null);
    pageRows.push({ pageName, tables, worstRow, allRows: matchedRows });
  }
  pageRows.sort((a, b) => {
    const rank = { critical: 3, warning: 2, unknown: 1, fresh: 0 };
    return rank[b.worstRow.status.state] - rank[a.worstRow.status.state];
  });

  const tableEl = document.createElement('table');
  tableEl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px';
  tableEl.innerHTML = `
    <thead>
      <tr style="text-align:left;color:${Theme.COLORS.textMuted};font-size:10px;text-transform:uppercase;letter-spacing:.05em">
        <th style="padding:8px 6px;border-bottom:1px solid ${Theme.COLORS.border}">Page</th>
        <th style="padding:8px 6px;border-bottom:1px solid ${Theme.COLORS.border}">Tables</th>
        <th style="padding:8px 6px;border-bottom:1px solid ${Theme.COLORS.border}">Worst Source</th>
        <th style="padding:8px 6px;border-bottom:1px solid ${Theme.COLORS.border}">Oldest</th>
        <th style="padding:8px 6px;border-bottom:1px solid ${Theme.COLORS.border};text-align:right">Status</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = tableEl.querySelector('tbody');
  pageRows.forEach(pr => {
    const tr = document.createElement('tr');
    tr.style.cssText = `border-bottom:1px solid ${Theme.COLORS.gridLine}`;
    tr.innerHTML = `
      <td style="padding:10px 6px;font-weight:600;color:${Theme.COLORS.textPrimary}">${pr.pageName}</td>
      <td style="padding:10px 6px;color:${Theme.COLORS.textMuted};font-family:'JetBrains Mono',monospace;font-size:10px">${pr.tables.length}</td>
      <td style="padding:10px 6px;color:${Theme.COLORS.textSecondary};font-family:'JetBrains Mono',monospace;font-size:10px">${pr.worstRow.table}</td>
      <td style="padding:10px 6px;color:${Theme.COLORS.textMuted}">${fmtAge(pr.worstRow.age)}</td>
      <td style="padding:10px 6px;text-align:right">
        <span style="padding:3px 8px;border-radius:10px;background:${pr.worstRow.status.color}22;color:${pr.worstRow.status.color};font-size:9px;font-weight:700;letter-spacing:.05em">${pr.worstRow.status.label}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
  coverageCard.appendChild(tableEl);
  container.appendChild(coverageCard);

  // ---- Backend gaps placeholder cards ----
  const gapsGrid = document.createElement('div');
  gapsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px';
  const gaps = [
    { title: 'ETL Run Log',          desc: 'Per-sync run history with success/fail/duration. Requires etl_run_log BQ table.', status: 'Backend pending' },
    { title: 'Cross-Source Reconciliation', desc: 'Variance between Stripe / Hyros / Meta / GHL on the same orders. Requires bridge_data_reconciliation table.', status: 'Backend pending' },
  ];
  gaps.forEach(g => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = `padding:18px;border:1px dashed ${Theme.COLORS.border};opacity:0.7`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:600;color:${Theme.COLORS.textSecondary}">${g.title}</div>
        <span style="padding:3px 8px;border-radius:10px;background:${Theme.COLORS.accentGhost};color:${Theme.COLORS.accentLight};font-size:9px;font-weight:700;letter-spacing:.05em">${g.status}</span>
      </div>
      <div style="font-size:11px;color:${Theme.COLORS.textMuted};line-height:1.5">${g.desc}</div>
    `;
    gapsGrid.appendChild(card);
  });
  container.appendChild(gapsGrid);
});
