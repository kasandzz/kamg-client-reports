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
    { label: 'Active Experiments', value: kpi.active_experiments    || 0, format: 'num' },
    { label: 'Completed',          value: kpi.completed_experiments || 0, format: 'num' },
    { label: 'Win Rate',           value: kpi.win_rate              || 0, format: 'pct' },
    { label: 'Avg Confidence',     value: kpi.avg_confidence        || 0, format: 'pct' },
    { label: 'Planned Tests',      value: 24,                           format: 'num' },
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
  const PLANNED_TESTS = [
    { name: 'Reg Page Redesign ($27)',       priority: 'P0' },
    { name: 'VIP Upsell Price Point',        priority: 'P0' },
    { name: 'Workshop Show Rate Nudges',     priority: 'P0' },
    { name: 'No-Show Recovery Email',        priority: 'P1' },
    { name: 'Same-Day Booking Incentive',    priority: 'P1' },
    { name: 'Black Text vs Video Ads',       priority: 'P1' },
    { name: 'Email Subject Line A/B',        priority: 'P1' },
    { name: 'Call Scheduling Time Slots',    priority: 'P1' },
    { name: 'VIP Friday Format',             priority: 'P2' },
    { name: 'Closer Script Variants',        priority: 'P2' },
    { name: 'Follow-Up Sequence Timing',     priority: 'P2' },
    { name: 'Mobile vs Desktop LP',          priority: 'P2' },
    { name: 'CTA Button Copy Variants',      priority: 'P2' },
    { name: 'Workshop Replay Offer Test',    priority: 'P2' },
    { name: 'Pre-Call SMS Reminder',         priority: 'P1' },
    { name: 'Urgency vs Scarcity Frame',     priority: 'P1' },
    { name: 'Video Thumbnail Variants',      priority: 'P2' },
    { name: 'Social Proof Placement',        priority: 'P2' },
    { name: 'Application Form Length',       priority: 'P2' },
    { name: 'Offer Stack Ordering',          priority: 'P2' },
    { name: 'Closer Assignment Routing',     priority: 'P1' },
    { name: 'Post-Call Follow-Up Timing',    priority: 'P2' },
    { name: 'Thank You Page Upsell',         priority: 'P2' },
    { name: 'Workshop Day/Time Variants',    priority: 'P2' },
  ];

  const PRIORITY_COLORS = {
    P0: 'var(--color-red,   #ef4444)',
    P1: 'var(--color-amber, #f59e0b)',
    P2: 'var(--color-muted, #6b7280)',
  };

  const plannedCard = document.createElement('div');
  plannedCard.className = 'card';
  plannedCard.style.cssText = 'padding:24px;margin-top:16px';

  const plannedHeader = document.createElement('div');
  plannedHeader.style.cssText = 'display:flex;align-items:baseline;gap:12px;margin-bottom:16px';
  plannedHeader.innerHTML = `
    <div style="font-size:14px;font-weight:700;color:var(--text-primary)">Planned Tests</div>
    <div style="font-size:12px;color:var(--text-muted)">${PLANNED_TESTS.length} queued</div>
  `;
  plannedCard.appendChild(plannedHeader);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px';

  PLANNED_TESTS.forEach(test => {
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--bg-secondary);
      border:1px solid var(--border-subtle);
      border-radius:8px;
      padding:12px 14px;
      display:flex;
      flex-direction:column;
      gap:8px;
    `;

    const priorityColor = PRIORITY_COLORS[test.priority] || PRIORITY_COLORS.P2;

    card.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.4">${test.name}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="
          font-size:10px;
          font-weight:700;
          color:var(--bg-primary,#0f172a);
          background:${priorityColor};
          border-radius:4px;
          padding:2px 6px;
          letter-spacing:.04em;
        ">${test.priority}</span>
        <span style="
          font-size:10px;
          font-weight:600;
          color:var(--text-muted);
          background:var(--bg-primary);
          border:1px solid var(--border-subtle);
          border-radius:4px;
          padding:2px 6px;
          letter-spacing:.04em;
        ">Planned</span>
      </div>
    `;

    grid.appendChild(card);
  });

  plannedCard.appendChild(grid);
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
