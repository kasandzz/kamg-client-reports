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

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Active Experiments', value: kpi.active_experiments    || 0, format: 'num', source: 'BQ experiment_registry', calc: 'COUNT(experiments WHERE status = active)' },
    { label: 'Completed',          value: kpi.completed_experiments || 0, format: 'num', source: 'BQ experiment_registry', calc: 'COUNT(experiments WHERE status = completed)' },
    { label: 'Win Rate',           value: kpi.win_rate              || 0, format: 'pct', source: 'BQ experiment_registry', calc: 'COUNT(winner IS NOT NULL) / COUNT(completed)' },
    { label: 'Avg Confidence',     value: kpi.avg_confidence        || 0, format: 'pct', source: 'BQ experiment_registry', calc: 'AVG(confidence WHERE status = completed)' },
    { label: 'Planned Tests',      value: 24,                            format: 'num', source: 'Static (roadmap target)', calc: 'Hardcoded: 24 planned tests across COD funnel' },
  ]);

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
