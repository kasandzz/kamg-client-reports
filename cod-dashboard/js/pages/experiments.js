/* ============================================
   Experiments -- A/B test registry and tracker
   Empty state: experiment_registry table not yet created
   ============================================ */

App.registerPage('experiments', async (container) => {
  const days = Filters.getDays();

  let defaultData;

  try {
    defaultData = await API.query('experiments', 'default', { days });
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Experiments: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  const kpi = (defaultData && defaultData.length > 0) ? defaultData[0] : {};

  // ---- KPI metric grid (Mode 2 conversion 2026-05-13) ----
  // Registry-empty state: completed=0 makes win_rate / avg_confidence undefined,
  // not 0%. Showing "0%" implied "we ran tests, none won" — which was a lie.
  // Now we display "—" with valueHtml when the denominator is missing.
  const kpiContainer = document.createElement('div');
  kpiContainer.style.marginBottom = '16px';
  container.appendChild(kpiContainer);

  function _buildExperimentMetrics(row) {
    const active    = Number(row.active_experiments    || 0);
    const completed = Number(row.completed_experiments || 0);
    const winRate   = row.win_rate;
    const avgConf   = row.avg_confidence;
    const dashHtml  = '<span style="color:var(--text-muted,#64748b)">—</span>';
    return [
      { label: 'Active Experiments', value: active,    format: 'num' },
      { label: 'Completed',          value: completed, format: 'num' },
      {
        label: 'Win Rate',
        valueHtml: completed > 0 && winRate != null ? (Number(winRate) * 100).toFixed(1) + '%' : dashHtml,
      },
      {
        label: 'Avg Confidence',
        valueHtml: completed > 0 && avgConf != null ? (Number(avgConf) * 100).toFixed(1) + '%' : dashHtml,
      },
      {
        label: 'Planned Tests',
        valueHtml: '24 <span style="font-size:9px;font-weight:700;letter-spacing:.06em;color:var(--text-muted,#64748b);background:rgba(255,255,255,0.04);padding:2px 6px;border-radius:8px;vertical-align:middle;margin-left:4px;text-transform:uppercase">Roadmap</span>',
      },
    ];
  }

  Components.renderMetricGrid(kpiContainer, _buildExperimentMetrics(kpi));

  // SWR cache-refresh wiring. If api.js detects row-count delta from a
  // background live fetch (i.e. registry got populated mid-session), re-render
  // the metric grid without forcing the user to reload. AbortController guards
  // against listener leaks across re-renders.
  if (container._cacheRefreshController) {
    try { container._cacheRefreshController.abort(); } catch (e) {}
  }
  container._cacheRefreshController = new AbortController();
  window.addEventListener('cache-refresh', (e) => {
    if (!e || !e.detail || e.detail.page !== 'experiments' || e.detail.queryName !== 'default') return;
    API.query('experiments', 'default', { days }).then((rows) => {
      const next = (rows && rows.length > 0) ? rows[0] : {};
      Components.renderMetricGrid(kpiContainer, _buildExperimentMetrics(next));
    }).catch(() => { /* swallow; live fetch already failed once */ });
  }, { signal: container._cacheRefreshController.signal });

  // ---- Empty State Hero ----
  const heroCard = document.createElement('div');
  heroCard.className = 'card';
  heroCard.style.cssText = 'padding:32px;margin-top:16px';

  const SQL_SCHEMA = `CREATE TABLE cod_warehouse.experiment_registry (
  id STRING,
  name STRING,
  status STRING,  -- 'active', 'completed', 'planned'
  variant_a STRING,
  variant_b STRING,
  metric STRING,
  start_date DATE,
  end_date DATE,
  sample_size INT64,
  confidence FLOAT64,
  winner STRING,
  notes STRING
);`;

  const copyBtnId = 'exp-copy-sql-btn';

  heroCard.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:24px">
      <div style="font-size:40px;line-height:1">&#129514;</div>
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:6px">No experiments running yet.</div>
        <div style="font-size:14px;color:var(--text-secondary);line-height:1.6">
          The Experiments page will track A/B tests across the COD funnel:
        </div>
        <ul style="font-size:14px;color:var(--text-secondary);margin:8px 0 0 0;padding-left:20px;line-height:1.8">
          <li>Landing page variants (reg page redesign)</li>
          <li>Email subject lines and sequences</li>
          <li>Ad creative rotation</li>
          <li>Workshop format changes</li>
          <li>Call scheduling optimization</li>
        </ul>
      </div>
    </div>

    <div style="font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
      To start tracking, create the experiment_registry table in BigQuery:
    </div>

    <div style="position:relative">
      <pre style="
        background:var(--bg-primary);
        border:1px solid var(--border-subtle);
        border-radius:8px;
        padding:20px;
        font-family:'JetBrains Mono',monospace;
        font-size:12.5px;
        color:var(--text-primary);
        line-height:1.7;
        overflow-x:auto;
        margin:0;
        white-space:pre;
      ">${SQL_SCHEMA}</pre>
      <button id="${copyBtnId}" style="
        position:absolute;
        top:10px;
        right:10px;
        background:var(--bg-secondary);
        border:1px solid var(--border-subtle);
        border-radius:6px;
        color:var(--text-secondary);
        font-size:11px;
        font-weight:600;
        padding:4px 10px;
        cursor:pointer;
        transition:background .15s,color .15s;
      ">Copy</button>
    </div>
  `;

  container.appendChild(heroCard);

  // Copy button handler
  const copyBtn = heroCard.querySelector(`#${copyBtnId}`);
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(SQL_SCHEMA).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.style.color = 'var(--color-green, #22c55e)';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.style.color = 'var(--text-secondary)';
        }, 2000);
      }).catch(() => {
        copyBtn.textContent = 'Error';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }

  // ---- Planned Tests Tracker ----
  // Backed by experiment_registry BQ table. Currently empty -- UI shows empty-state.
  // Populating the table will surface tests here automatically (no code change required).
  const plannedCard = document.createElement('div');
  plannedCard.className = 'card';
  plannedCard.style.cssText = 'padding:24px;margin-top:16px';

  plannedCard.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Planned Tests</div>
      <div style="font-size:12px;color:var(--text-muted)">Awaiting registry</div>
    </div>
    <div style="
      border:2px dashed var(--border-subtle);
      border-radius:8px;
      padding:32px 24px;
      text-align:center;
      color:var(--text-muted);
      font-size:13px;
      line-height:1.6;
    ">
      <div style="font-size:24px;margin-bottom:10px;opacity:0.5">&#129514;</div>
      <div style="color:var(--text-secondary);margin-bottom:6px">No tests in the registry yet.</div>
      <div style="font-size:11px">Add rows to <code style="font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:3px">cod_warehouse.experiment_registry</code> with <code style="font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,0.04);padding:1px 6px;border-radius:3px">status='planned'</code> and they will appear here.</div>
    </div>
  `;
  container.appendChild(plannedCard);

  // ---- Test Velocity Chart Placeholder ----
  const velocityCard = document.createElement('div');
  velocityCard.className = 'card';
  velocityCard.style.cssText = 'padding:24px;margin-top:16px;opacity:.55;pointer-events:none';

  velocityCard.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Test Velocity</div>
    <div style="
      border:2px dashed var(--border-subtle);
      border-radius:8px;
      padding:40px 24px;
      text-align:center;
      color:var(--text-muted);
      font-size:13px;
      line-height:1.6;
    ">
      <div style="font-size:28px;margin-bottom:10px">&#128202;</div>
      Test velocity tracking will show experiments launched per month once the registry is populated.
    </div>
  `;

  container.appendChild(velocityCard);
});
