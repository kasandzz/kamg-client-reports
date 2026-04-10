/* ============================================
   Funnels -- $27 Workshop Performance Dashboard
   Full standalone page injected into shell.
   ============================================ */

App.registerPage('funnels', async (container) => {

  // ---- Inject page-specific CSS ----
  if (!document.getElementById('funnels-page-css')) {
    const style = document.createElement('style');
    style.id = 'funnels-page-css';
    style.textContent = `
    /* =========================================================
       Design Tokens -- near-black fintech palette
       ========================================================= */
    :root {
      --bg-primary:            #08080d;
      --bg-card:               #0f1117;
      --bg-card-hover:         #161822;
      --bg-elevated:           #1a1c28;
      --bg-input:              #0c0d14;
      --border:                rgba(255,255,255,0.06);
      --border-subtle:         rgba(255,255,255,0.04);
      --border-hover:          rgba(255,255,255,0.12);
      --border-accent:         rgba(124,58,237,0.3);
      --accent-primary:        #7c3aed;
      --accent-primary-bright: #a78bfa;
      --accent-cyan:           #22d3ee;
      --accent-gold:           #facc15;
      --status-up:             #22c55e;
      --status-down:           #ef4444;
      --status-warning:        #f59e0b;
      --status-neutral:        #64748b;
      --text-primary:          #f1f5f9;
      --text-secondary:        #7c8da4;
      --text-muted:            #475569;

      /* Legacy aliases kept so existing rules still resolve */
      --bg-overlay:            rgba(8, 8, 13, 0.85);
      --bg-subtle:             rgba(124,58,237,0.04);
      --accent-primary-ghost:  rgba(124,58,237,0.08);
      --accent-primary-glow:   rgba(124,58,237,0.15);
      --accent-gold-dim:       rgba(250,204,21,0.12);
      --status-up-bg:          rgba(34,197,94,0.1);
      --status-down-bg:        rgba(239,68,68,0.1);
      --status-neutral-bg:     rgba(100,116,139,0.08);
      --status-warning-bg:     rgba(245,158,11,0.1);
      --text-disabled:         #334155;
      --text-inverse:          #08080d;
      --border-focus:          #7c3aed;
      --shadow-card:           0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px var(--border);
      --shadow-elevated:       0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px var(--border);
      --shadow-glow:           0 0 30px rgba(124,58,237,0.06);
      --shadow-inset:          inset 0 1px 2px rgba(0,0,0,0.4);
      --transition-fast:   150ms ease;
      --transition-base:   250ms ease;
      --transition-slow:   400ms ease;

      --font-display: 'Manrope', sans-serif;
      --font-body:    'Inter', system-ui, -apple-system, sans-serif;
      --font-mono:    'JetBrains Mono', 'Fira Code', monospace;

      --text-xs:   0.6875rem;
      --text-sm:   0.75rem;
      --text-base: 0.875rem;
      --text-lg:   1rem;
      --text-xl:   1.25rem;
      --text-2xl:  1.5rem;
      --text-3xl:  2rem;

      --space-1:  0.25rem;
      --space-2:  0.5rem;
      --space-3:  0.75rem;
      --space-4:  1rem;
      --space-5:  1.25rem;
      --space-6:  1.5rem;
      --space-8:  2rem;
      --space-10: 2.5rem;
      --space-12: 3rem;
      --space-16: 4rem;

      --radius-sm:   4px;
      --radius-md:   8px;
      --radius-lg:   12px;
      --radius-xl:   16px;
      --radius-full: 9999px;
    }

    /* =========================================================
       Reset & Base
       ========================================================= */
    .funnels-page {
      font-family: var(--font-body);
      font-weight: 400;
      line-height: 1.6;
      color: var(--text-primary);
      padding: var(--space-4);
      max-width: 1440px;
      margin: 0 auto;
      position: relative;
    }
    .funnels-page *, .funnels-page *::before, .funnels-page *::after {
      box-sizing: border-box;
    }

    /* Dot-grid overlay instead of noise grain */
    body::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 0;
      background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 24px 24px;
    }

    /* Make all content sit above the grid overlay */
    body > * { position: relative; z-index: 1; }

    /* =========================================================
       Page Header
       ========================================================= */
    .ws-page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
    }
    .ws-page-header__left {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .ws-page-title {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: var(--text-2xl);
      letter-spacing: -0.03em;
      line-height: 1.2;
      color: var(--text-primary);
    }
    .ws-page-subtitle {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Pill-shaped preset group */
    .date-preset-group {
      display: flex;
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      overflow: hidden;
      gap: 0;
    }
    .date-preset {
      padding: 7px 14px;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-secondary);
      border-right: 1px solid rgba(255,255,255,0.1);
      transition: background var(--transition-fast), color var(--transition-fast);
      cursor: pointer;
      background: none;
      border-top: none;
      border-bottom: none;
      white-space: nowrap;
      letter-spacing: 0.03em;
    }
    .date-preset:first-child { border-radius: var(--radius-full) 0 0 var(--radius-full); padding-left: 16px; }
    .date-preset:last-of-type { border-right: none; }
    .date-preset:hover {
      background: var(--bg-card-hover);
      color: var(--text-primary);
    }
    .date-preset--active {
      background: rgba(124,58,237,0.2);
      color: var(--accent-primary-bright);
      box-shadow: inset 0 -2px 0 0 var(--accent-primary);
    }

    /* Compare toggle */
    .compare-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 6px 14px;
      border-left: 1px solid var(--border);
      user-select: none;
    }
    .compare-toggle input { display: none; }
    .compare-toggle__box {
      width: 14px;
      height: 14px;
      border: 1px solid var(--border-hover);
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background var(--transition-fast), border-color var(--transition-fast);
    }
    .compare-toggle input:checked + .compare-toggle__box {
      background: var(--accent-primary);
      border-color: var(--accent-primary);
    }
    .compare-toggle input:checked + .compare-toggle__box::after {
      content: '';
      display: block;
      width: 8px;
      height: 8px;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 8 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3l2 2 4-4' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
    }

    /* =========================================================
       Card Base -- no blur, solid dark surface
       ========================================================= */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: var(--space-5);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    .card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-glow);
    }

    /* =========================================================
       KPI Cards Grid
       ========================================================= */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--status-neutral);
      border-radius: var(--radius-xl);
      padding: var(--space-4) var(--space-5);
      min-width: 200px;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      position: relative;
      overflow: hidden;
    }
    /* Top-glow based on status */
    .kpi-card--up::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(34,197,94,0.5), transparent);
    }
    .kpi-card--down::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(239,68,68,0.5), transparent);
    }
    .kpi-card--warn::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent);
    }
    .kpi-card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-glow);
    }
    .kpi-card--up    { border-left-color: var(--status-up); }
    .kpi-card--down  { border-left-color: var(--status-down); }
    .kpi-card--warn  { border-left-color: var(--status-warning); }

    .kpi-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-2);
    }
    .kpi-card__label {
      font-size: var(--text-xs);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }
    .kpi-card__traffic-light {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .kpi-card__traffic-light--green  { background: var(--status-up); box-shadow: 0 0 8px rgba(34,197,94,0.6); }
    .kpi-card__traffic-light--yellow { background: var(--status-warning); box-shadow: 0 0 8px rgba(245,158,11,0.6); }
    .kpi-card__traffic-light--red    { background: var(--status-down); box-shadow: 0 0 8px rgba(239,68,68,0.6); }

    .kpi-card__value {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: var(--text-3xl);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.03em;
      line-height: 1;
      color: var(--text-primary);
      margin-bottom: var(--space-2);
    }
    .kpi-card__target {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin-bottom: var(--space-1);
    }
    .kpi-card__delta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .kpi-card__delta--up      { color: var(--status-up); }
    .kpi-card__delta--down    { color: var(--status-down); }
    .kpi-card__delta--neutral { color: var(--status-neutral); }

    .kpi-card__sparkline {
      margin-top: var(--space-3);
      height: 44px;
    }

    /* =========================================================
       Chart Card
       ========================================================= */
    .chart-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: var(--space-5);
      margin-bottom: var(--space-6);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    .chart-card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-glow);
    }
    .chart-card__title {
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.9375rem;
      color: var(--text-primary);
      margin-bottom: var(--space-4);
    }
    .chart-card__canvas-wrap {
      position: relative;
      width: 100%;
      height: 300px;
    }

    /* =========================================================
       Funnel Analytics Strip (Shopify-style)
       ========================================================= */
    .funnel-strip {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .funnel-metric {
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.06);
      transition: all 150ms;
    }
    .funnel-metric:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.15); }
    .funnel-metric--active { background: rgba(255,255,255,0.06); border-color: rgba(124,58,237,0.4); box-shadow: 0 0 8px rgba(124,58,237,0.15); }
    .funnel-metric__label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }
    .funnel-metric__row {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .funnel-metric__value {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .funnel-metric__delta {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
    }
    .funnel-metric__delta--up { color: var(--status-down); }
    .funnel-metric__delta--down { color: var(--status-down); }
    .funnel-legend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-top: 10px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
    }

    /* =========================================================
       Split Row (Completion + Heatmap)
       ========================================================= */
    .split-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }
    @media (max-width: 768px) {
      .split-row { grid-template-columns: 1fr; }
    }

    /* =========================================================
       YTD Summary Strip
       ========================================================= */
    .ytd-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(34,211,238,0.06) 50%, rgba(34,197,94,0.04) 100%);
      border: 1px solid rgba(124,58,237,0.15);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(12px);
    }
    .ytd-strip__title {
      grid-column: 1 / -1;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--accent-primary-bright);
      margin-bottom: 2px;
    }
    .ytd-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .ytd-item__label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
    }
    .ytd-item__value {
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .ytd-item__value--accent { color: var(--accent-cyan); }
    .ytd-item__value--green { color: var(--status-up); }
    .ytd-item__value--gold { color: var(--accent-gold); }

    /* =========================================================
       Heatmap -- compact glassy deep gradient
       ========================================================= */
    .heatmap-grid {
      display: grid;
      grid-template-columns: 42px repeat(7, 1fr);
      gap: 2px;
      margin-top: var(--space-2);
    }
    .heatmap-header {
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 600;
      color: var(--text-secondary);
      text-align: center;
      padding: 2px 0;
    }
    .heatmap-row-label {
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 500;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 4px;
    }
    .heatmap-cell {
      border-radius: 3px;
      padding: 0;
      text-align: center;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.92);
      min-height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.04);
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .heatmap-cell:hover {
      transform: scale(1.08);
      box-shadow: 0 0 12px rgba(124,58,237,0.3);
      z-index: 1;
    }
    .heatmap-legend {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-3);
      justify-content: center;
    }
    .heatmap-legend__bar {
      width: 200px;
      height: 12px;
      border-radius: var(--radius-sm);
      background: linear-gradient(to right, rgba(239,68,68,0.7), rgba(245,158,11,0.7), rgba(34,197,94,0.85));
    }
    .heatmap-legend__label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    /* =========================================================
       Completion Breakdown
       ========================================================= */
    .completion-bars {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-top: var(--space-3);
    }
    .completion-toggle {
      display: flex;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }
    .completion-toggle__btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.08);
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      padding: 5px 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.03em;
    }
    .completion-toggle__btn:hover {
      color: var(--text-primary);
      border-color: rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.04);
    }
    .completion-toggle__btn--active {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
      box-shadow: 0 0 12px rgba(124,58,237,0.3);
    }
    .completion-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .completion-row__label {
      font-size: var(--text-base);
      font-weight: 500;
      color: var(--text-secondary);
      width: 80px;
      flex-shrink: 0;
    }
    .completion-row__bar-track {
      flex: 1;
      height: 28px;
      background: rgba(255,255,255,0.03);
      border-radius: var(--radius-sm);
      overflow: hidden;
      position: relative;
    }
    .completion-row__bar-fill {
      height: 100%;
      border-radius: var(--radius-sm);
      transition: width var(--transition-slow);
      display: flex;
      align-items: center;
      padding-left: var(--space-2);
      min-width: 40px;
    }
    .completion-row__bar-label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: 600;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      white-space: nowrap;
    }
    .completion-row__pct {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--text-muted);
      width: 48px;
      text-align: right;
      flex-shrink: 0;
    }
    /* Sankey Chart - Vertical Card Style */
    .sankey-node-card {
      cursor: default;
    }
    .sankey-node-card .node-bg {
      rx: 10; ry: 10;
    }
    .sankey-node-card .node-border {
      rx: 10; ry: 10;
    }
    .sankey-node-card .node-value {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 700;
      fill: #fff;
    }
    .sankey-node-card .node-label {
      font-family: var(--font-body);
      font-size: 9px;
      font-weight: 500;
      fill: rgba(255,255,255,0.7);
    }
    .sankey-node-card .node-pct {
      font-family: var(--font-mono);
      font-size: 8px;
      font-weight: 600;
      fill: rgba(255,255,255,0.45);
    }
    .sankey-node-card.is-dropoff .node-value { font-size: 12px; }
    .sankey-node-card.is-dropoff .node-label { font-size: 8px; }
    .sankey-link {
      opacity: 0.25;
      transition: opacity 0.2s;
    }
    .sankey-link:hover {
      opacity: 0.5;
    }
    .sankey-link.is-dropoff {
      opacity: 0.15;
    }
    .sankey-link.is-dropoff:hover {
      opacity: 0.35;
    }
    #sankeyControls {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    #sankeyControls label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--text-secondary);
      cursor: pointer;
      user-select: none;
    }
    #sankeyControls input[type="checkbox"] {
      accent-color: var(--accent-purple);
      width: 14px;
      height: 14px;
    }
    .watch-time-table-wrap { overflow-x: auto; }
    .watch-time-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .watch-time-table th {
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      padding: 6px 8px;
      text-align: right;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .watch-time-table th:first-child { text-align: left; }
    .watch-time-table td {
      padding: 5px 8px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-primary);
      text-align: right;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .watch-time-table td:first-child {
      text-align: left;
      font-family: var(--font-body);
      font-weight: 500;
      color: var(--text-secondary);
    }
    .watch-time-table tr:hover td { background: rgba(255,255,255,0.02); }
    .watch-time-table .wt-bar {
      display: inline-block;
      height: 10px;
      border-radius: 3px;
      vertical-align: middle;
      margin-right: 6px;
      min-width: 3px;
    }
    .watch-time-table .wt-status {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .completion-footnote {
      font-size: var(--text-xs);
      color: var(--text-muted);
      margin-top: var(--space-3);
      font-style: italic;
    }

    /* =========================================================
       Daily Table
       ========================================================= */
    .table-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      margin-bottom: var(--space-6);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    .table-card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-glow);
    }
    .table-card__title {
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.9375rem;
      color: var(--text-primary);
      padding: var(--space-4) var(--space-5);
    }
    .data-table-wrap {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    .data-table th {
      text-align: left;
      padding: var(--space-2) var(--space-4);
      font-weight: 600;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .data-table td {
      padding: var(--space-2) var(--space-4);
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-subtle);
      font-variant-numeric: tabular-nums;
    }
    .data-table tr:hover td {
      background: rgba(124,58,237,0.04);
    }
    .data-table td.mono {
      font-family: var(--font-mono);
      font-weight: 500;
    }
    .data-table td .trend-cell {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }
    .trend-box {
      display: inline-block;
      width: 32px;
      height: 18px;
      border-radius: 3px;
      vertical-align: middle;
      flex-shrink: 0;
      box-shadow: inset 0 1px 2px rgba(255,255,255,0.15);
    }
    .trend-box--up-strong   { background: #16a34a; box-shadow: inset 0 1px 2px rgba(255,255,255,0.15), 0 0 6px rgba(22,163,74,0.4); }
    .trend-box--up-mid      { background: #22c55e; box-shadow: inset 0 1px 2px rgba(255,255,255,0.15), 0 0 4px rgba(34,197,94,0.3); }
    .trend-box--up-light    { background: rgba(34,197,94,0.45); }
    .trend-box--flat        { background: rgba(100,116,139,0.2); }
    .trend-box--down-light  { background: rgba(239,68,68,0.45); }
    .trend-box--down-mid    { background: #ef4444; box-shadow: inset 0 1px 2px rgba(255,255,255,0.1), 0 0 4px rgba(239,68,68,0.3); }
    .trend-box--down-strong { background: #dc2626; box-shadow: inset 0 1px 2px rgba(255,255,255,0.1), 0 0 6px rgba(220,38,38,0.4); }

    /* ---- Separator rows ---- */
    .sep-row td {
      padding: 0 !important;
      border-bottom: none !important;
      height: 0;
      line-height: 0;
      position: relative;
    }
    .sep-row:hover td { background: none !important; }
    .sep-tab {
      position: absolute;
      top: -1px;
      left: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 14px 4px 12px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-radius: 0 0 8px 8px;
      z-index: 1;
    }
    .sep-tab__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    /* Time-of-day row tints */
    .slot-row--morning td { background: rgba(251,191,36,0.04); }
    .slot-row--morning:hover td { background: rgba(251,191,36,0.08) !important; }
    .slot-row--morning td:first-child { border-left: 3px solid rgba(251,191,36,0.4); }
    .slot-row--afternoon td { background: rgba(249,115,22,0.04); }
    .slot-row--afternoon:hover td { background: rgba(249,115,22,0.08) !important; }
    .slot-row--afternoon td:first-child { border-left: 3px solid rgba(249,115,22,0.4); }
    .slot-row--evening td { background: rgba(124,58,237,0.04); }
    .slot-row--evening:hover td { background: rgba(124,58,237,0.08) !important; }
    .slot-row--evening td:first-child { border-left: 3px solid rgba(124,58,237,0.4); }
    .slot-row--new td:last-child { position: relative; }
    .slot-row--new td:last-child::after {
      content: 'NEW';
      display: inline-block;
      margin-left: 8px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 1px 5px;
      border-radius: 3px;
      background: #7c3aed;
      color: #fff;
      vertical-align: middle;
    }
    /* Day break -- per-day colors */
    .sep-row--day td { border-top: 1px solid rgba(124,58,237,0.1) !important; }
    .sep-tab--day {
      padding: 3px 14px 4px 12px;
      border-top: none;
    }
    /* Monday */    .sep-tab--day[data-day="monday"]    { background: rgba(56,189,248,0.10); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); border-top: none; }
                    .sep-tab--day[data-day="monday"] .sep-tab__dot { background: #38bdf8; }
    /* Tuesday */   .sep-tab--day[data-day="tuesday"]   { background: rgba(34,197,94,0.10); color: #22c55e; border: 1px solid rgba(34,197,94,0.25); border-top: none; }
                    .sep-tab--day[data-day="tuesday"] .sep-tab__dot { background: #22c55e; }
    /* Wednesday */ .sep-tab--day[data-day="wednesday"] { background: rgba(250,204,21,0.10); color: #facc15; border: 1px solid rgba(250,204,21,0.25); border-top: none; }
                    .sep-tab--day[data-day="wednesday"] .sep-tab__dot { background: #facc15; }
    /* Thursday */  .sep-tab--day[data-day="thursday"]  { background: rgba(249,115,22,0.10); color: #f97316; border: 1px solid rgba(249,115,22,0.25); border-top: none; }
                    .sep-tab--day[data-day="thursday"] .sep-tab__dot { background: #f97316; }
    /* Friday */    .sep-tab--day[data-day="friday"]    { background: rgba(168,85,247,0.10); color: #a855f7; border: 1px solid rgba(168,85,247,0.25); border-top: none; }
                    .sep-tab--day[data-day="friday"] .sep-tab__dot { background: #a855f7; }
    /* Saturday */  .sep-tab--day[data-day="saturday"]  { background: rgba(236,72,153,0.10); color: #ec4899; border: 1px solid rgba(236,72,153,0.25); border-top: none; }
                    .sep-tab--day[data-day="saturday"] .sep-tab__dot { background: #ec4899; }
    /* Sunday */    .sep-tab--day[data-day="sunday"]    { background: rgba(239,68,68,0.10); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); border-top: none; }
                    .sep-tab--day[data-day="sunday"] .sep-tab__dot { background: #ef4444; }
    /* Week break */
    .sep-row--week td { border-top: 2px solid rgba(168,85,247,0.2) !important; }
    .sep-tab--week {
      background: rgba(168,85,247,0.08);
      color: #c084fc;
      border: 1px solid rgba(168,85,247,0.2);
      border-top: none;
    }
    .sep-tab--week .sep-tab__dot { background: #a855f7; }
    /* Month break */
    .sep-row--month td { border-top: 2px solid rgba(250,204,21,0.25) !important; }
    .sep-tab--month {
      background: rgba(250,204,21,0.08);
      color: var(--accent-gold);
      border: 1px solid rgba(250,204,21,0.2);
      border-top: none;
    }
    .sep-tab--month .sep-tab__dot { background: var(--accent-gold); }

    /* =========================================================
       Footer Disclaimer
       ========================================================= */
    .disclaimer {
      font-size: var(--text-sm);
      color: var(--text-muted);
      text-align: center;
      padding: var(--space-4) 0 var(--space-8);
      border-top: 1px solid var(--border);
    }

    /* =========================================================
       Responsive
       ========================================================= */
    @media (max-width: 768px) {
      .funnels-page { padding: var(--space-3); }
      .ws-page-header { flex-direction: column; align-items: flex-start; }
      .kpi-grid { grid-template-columns: 1fr; }
      .split-row { grid-template-columns: 1fr; }
    }

    /* Date picker CSS now in shared components.css */
    `;
    document.head.appendChild(style);
  }

  // ---- Scope styles: override body bg only inside page-container ----
  container.closest('.page-container').style.background = 'transparent';

  // ---- Inject HTML ----
  container.innerHTML = `<div class="funnels-page">
  <!-- ====== Page-specific controls (Average toggle) ====== -->
  <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);flex-wrap:wrap;">
    <label class="compare-toggle">
      <input type="checkbox" id="compareToggle">
      <span class="compare-toggle__box"></span>
      Compare
    </label>
    <label class="compare-toggle">
      <input type="checkbox" id="averageToggle" checked style="display:none">
      <span class="compare-toggle__box" style="display:none"></span>
    </label>
    <div id="avgGroupToggle" style="display:flex;align-items:center;gap:2px;background:rgba(255,255,255,0.04);border-radius:6px;padding:2px">
      <span style="font-size:11px;color:var(--color-text-muted);padding:0 8px">Avg:</span>
      <button class="filter-btn active" data-avg="off" style="padding:4px 10px;font-size:11px">Off</button>
      <button class="filter-btn" data-avg="days" style="padding:4px 10px;font-size:11px">Days</button>
      <button class="filter-btn" data-avg="weeks" style="padding:4px 10px;font-size:11px">Weeks</button>
      <button class="filter-btn" data-avg="months" style="padding:4px 10px;font-size:11px">Months</button>
    </div>
  </div>
  <!-- Hidden elements needed by date picker JS (prevent errors) -->
  <div id="datePresets" hidden></div>
  <div id="dpWrap" hidden><button id="dpTrigger"></button><div id="dpDropdown" hidden><div id="dpCal"></div><div id="dpSide"></div><span id="dpRangeLabel"></span><button id="dpCancel"></button><button id="dpApply"></button></div></div>

  <!-- ====== 2b. YTD Summary Strip ====== -->
  <div class="ytd-strip" id="ytdStrip" style="display:none"></div>

  <!-- ====== 3. KPI Card Grid ====== -->
  <div class="kpi-grid" id="kpiGrid"></div>

  <!-- ====== 3b. Funnel Analytics (Shopify-style) ====== -->
  <div class="chart-card" id="funnelAnalyticsCard">
    <div class="funnel-strip" id="funnelStrip"></div>
    <div class="chart-card__canvas-wrap" style="height:220px;">
      <canvas id="funnelChart"></canvas>
    </div>
    <div class="funnel-legend" id="funnelLegend"></div>
  </div>

  <!-- ====== 4. Show Rate Trends ====== -->
  <div class="chart-card" id="showRateTrendsCard">
    <div class="funnel-strip" id="showRateStrip"></div>
    <div class="chart-card__canvas-wrap" style="height:220px;">
      <canvas id="showRateTrendChart"></canvas>
    </div>
    <div class="funnel-legend" id="showRateLegend"></div>
  </div>

  <!-- ====== 4b. Customer Journey Sankey ====== -->
  <div class="chart-card" id="sankeyCard">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <div>
        <div class="chart-card__title" style="margin:0">Customer Journey Flow</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">Every stage from ad click to enrollment. Width = volume at each transition.</div>
      </div>
      <div id="sankeyControls">
        <div class="completion-toggle" id="sankeyToggle">
          <button class="completion-toggle__btn completion-toggle__btn--active" data-view="all">All</button>
          <button class="completion-toggle__btn" data-view="vip">VIP Only</button>
        </div>
        <label id="sankeyHideAds"><input type="checkbox" id="sankeyHideAdsCheck"> Hide Impressions</label>
        <label><input type="checkbox" id="sankeyCompactCheck"> Compact</label>
      </div>
    </div>
    <div id="sankeyContainer" style="width:100%;overflow-x:auto;"></div>
  </div>

  <!-- ====== 5 & 6. Completion Breakdown + Day/Time Heatmap ====== -->
  <div class="split-row">
    <div class="chart-card" style="margin-bottom: 0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div class="chart-card__title" style="margin:0">Watch Time Breakdown</div>
        <div class="completion-toggle" id="completionToggle">
          <button class="completion-toggle__btn completion-toggle__btn--active" data-segment="all">All</button>
          <button class="completion-toggle__btn" data-segment="vip">VIP</button>
          <button class="completion-toggle__btn" data-segment="standard">Non-VIP</button>
        </div>
      </div>
      <div class="watch-time-table-wrap" id="watchTimeTable"></div>
      <div class="completion-footnote">Based on 96 AEvent records (partial month). Drop-off = left during this segment.</div>
    </div>
    <div class="chart-card" style="margin-bottom: 0;">
      <div class="chart-card__title">Day / Time Show Rate Heatmap</div>
      <div class="heatmap-grid" id="heatmapGrid"></div>
      <div class="heatmap-legend">
        <span class="heatmap-legend__label">52%</span>
        <div class="heatmap-legend__bar"></div>
        <span class="heatmap-legend__label">74%</span>
      </div>
    </div>
  </div>

  <!-- ====== 6b. Ticket Purchase Heatmap ====== -->
  <div class="chart-card">
    <div class="chart-card__title">Ticket Purchases by Day &amp; Time</div>
    <div class="heatmap-grid" id="ticketHeatmapGrid"></div>
    <div class="heatmap-legend">
      <span class="heatmap-legend__label">Low</span>
      <div class="heatmap-legend__bar" style="background:linear-gradient(90deg,rgba(124,58,237,0.2),rgba(124,58,237,0.5),rgba(34,211,238,0.7),rgba(34,197,94,0.85))"></div>
      <span class="heatmap-legend__label">High</span>
    </div>
  </div>

  <!-- ====== 6c. Sales Dynamic ====== -->
  <div class="chart-card" style="padding:20px 24px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">Sales Dynamic</div>
      <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.2px">Hyros First-Click Attribution</div>
    </div>
    <div class="calc-annotation">Sources: Ticket Revenue from Stripe charges ($27/$54 filter) | Enrollment Revenue from Hyros first-click attribution. Calc: SUM(amount) per day, grouped by revenue type.</div>
    <div style="font-size:10px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">REVENUE</div>
    <div style="position:relative;height:220px;width:100%"><canvas id="salesDynamicRevenueChart"></canvas></div>
    <div style="display:flex;gap:20px;margin:10px 0 24px 0;font-size:11px;color:var(--text-muted)">
      <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:3px;background:#6366f1;border-radius:2px;display:inline-block"></span>Ticket Revenue</span>
      <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:3px;background:#22c55e;border-radius:2px;display:inline-block"></span>Enrollment Revenue</span>
    </div>
    <div class="calc-annotation">Source: Meta Marketing API (daily spend), Google Ads API (daily spend), YouTube via Google Ads. Calc: SUM(spend) per day per channel, stacked.</div>
    <div style="font-size:10px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">AD SPEND BY CHANNEL</div>
    <div style="position:relative;height:200px;width:100%"><canvas id="salesDynamicAdSpendChart"></canvas></div>
  </div>

  <!-- ====== 7. Ticket Sales Velocity & Journey Table ====== -->
  <div class="table-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div class="table-card__title" style="margin:0" id="tableTitle">Ticket Sales Velocity &amp; Journey -- Per-Session Metrics</div>
      <div class="completion-toggle" id="tableGranularity">
        <button class="completion-toggle__btn completion-toggle__btn--active" data-grain="session">Session</button>
        <button class="completion-toggle__btn" data-grain="day">Day</button>
        <button class="completion-toggle__btn" data-grain="week">Week</button>
        <button class="completion-toggle__btn" data-grain="month">Month</button>
      </div>
    </div>
    <div class="data-table-wrap">
      <table class="data-table" id="bookingTable">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time Slot</th>
            <th>Attendees</th>
            <th>Bookings</th>
            <th>Booking %</th>
            <th>VIP %</th>
          </tr>
        </thead>
        <tbody id="bookingTableBody"></tbody>
      </table>
    </div>
  </div>

  <!-- ====== 8. Footer Disclaimer ====== -->
  <footer class="disclaimer">
    Workshop data based on AEvent + Zoom records. Show rate = attended / registered. VIP upgrade = VIP tickets / total attendees. Completion = full watch vs partial vs bounced.
  </footer>
  </div>`;  // close .funnels-page

  // ---- Load Chart.js if not already loaded ----
  if (typeof Chart === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---- Initialize page logic ----
  (function() {
// ============================================================================
// TODO: Replace MOCK_DATA with API.query('workshop-performance', 'default', {days})
// API URL: us-central1-green-segment-491604-j8.cloudfunctions.net/codDashboard
// Params: ?page=workshop-performance&query=default&days=30
// Auth: cod_auth localStorage key
// ============================================================================

// ---- Chart.js color constants ----
var COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  neutral: '#64748b',
  warning: '#f59e0b',
  accent: '#7c3aed',
  cyan: '#22d3ee',
  gold: '#facc15',
  gridLine: 'rgba(255,255,255,0.05)',
  textMuted: '#475569',
  textSecondary: '#7c8da4'
};

// ---- Weekend & Holiday Shading ----
var US_HOLIDAYS_2025_2026 = [
  '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19',
  '2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
  '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19',
  '2026-07-03','2026-07-04','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25'
];

function isWeekend(dateStr) {
  var d = new Date(dateStr);
  var day = d.getUTCDay();
  return day === 0 || day === 6;
}

function isHoliday(dateStr) {
  return US_HOLIDAYS_2025_2026.indexOf(dateStr) !== -1;
}


// Chart.js plugin to shade weekend/holiday columns
var weekendHolidayPlugin = {
  id: 'weekendHoliday',
  beforeDraw: function(chart) {
    var meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;
    var dates = chart._customDates;
    if (!dates || !dates.length) return;
    var ctx = chart.ctx;
    var yAxis = chart.scales.y;
    var top = yAxis.top;
    var bottom = yAxis.bottom;
    var barWidth = meta.data.length > 1 ? (meta.data[1].x - meta.data[0].x) : 40;
    var half = barWidth / 2;

    for (var i = 0; i < dates.length && i < meta.data.length; i++) {
      var dt = dates[i];
      var x = meta.data[i].x;
      var holiday = isHoliday(dt);
      var weekend = isWeekend(dt);
      if (weekend || holiday) {
        ctx.save();
        ctx.fillStyle = holiday ? 'rgba(250,204,21,0.08)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(x - half, top, barWidth, bottom - top);
        ctx.restore();
      }
    }
  }
};

// ---- Mock Data ----
// Data aligned with BQ (Hyros since Mar 10 2026 + War Room KPIs)
// Current: 452 tickets, 208 calls booked, 16 enrollments, $79.7K rev, $216K spend
// Previous: 295 calls, 29 enrollments, $190K rev, $231K spend
var MOCK_DATA = {
  periods: {
    current: {
      show_rate: 58.3,
      vip_upgrade_rate: 38.7,
      completion_rate_full: 57,
      completion_rate_partial: 26,
      completion_rate_bounced: 17,
      booking_pct: 46.0,
      total_sessions: 90,
      total_attendees: 452,
      vip_attendees: 175,
      standard_attendees: 277
    },
    previous: {
      show_rate: 62.1,
      vip_upgrade_rate: 41.2,
      completion_rate_full: 61,
      completion_rate_partial: 24,
      completion_rate_bounced: 15,
      booking_pct: 50.2,
      total_sessions: 96,
      total_attendees: 628,
      vip_attendees: 258,
      standard_attendees: 370
    }
  },
  session_data: [],
  heatmap_data: {
    '9am':  { Mon: 52, Tue: 58, Wed: 61, Thu: 63, Fri: 59, Sat: 55, Sun: 53 },
    '4pm':  { Mon: 60, Tue: 74, Wed: 68, Thu: 66, Fri: 64, Sat: 57, Sun: 54 },
    '7pm':  { Mon: 56, Tue: 62, Wed: 65, Thu: 64, Fri: 58, Sat: 52, Sun: 50 }
  },
  ticket_heatmap: {
    '6am':  { Mon: 3, Tue: 4, Wed: 2, Thu: 5, Fri: 3, Sat: 1, Sun: 1 },
    '8am':  { Mon: 8, Tue: 11, Wed: 9, Thu: 10, Fri: 7, Sat: 4, Sun: 3 },
    '10am': { Mon: 14, Tue: 18, Wed: 16, Thu: 15, Fri: 12, Sat: 6, Sun: 5 },
    '12pm': { Mon: 19, Tue: 24, Wed: 21, Thu: 22, Fri: 17, Sat: 9, Sun: 7 },
    '2pm':  { Mon: 16, Tue: 20, Wed: 18, Thu: 19, Fri: 14, Sat: 8, Sun: 6 },
    '4pm':  { Mon: 12, Tue: 15, Wed: 13, Thu: 14, Fri: 11, Sat: 7, Sun: 5 },
    '6pm':  { Mon: 9, Tue: 12, Wed: 10, Thu: 11, Fri: 8, Sat: 5, Sun: 4 },
    '8pm':  { Mon: 6, Tue: 8, Wed: 7, Thu: 7, Fri: 5, Sat: 3, Sun: 2 },
    '10pm': { Mon: 2, Tue: 3, Wed: 2, Thu: 3, Fri: 2, Sat: 2, Sun: 1 }
  },
  sparklines: {},
  daily_show_rates: []
};

// ---- Generate session data (30 days, 2 sessions per day) ----
(function() {
  var now = new Date();
  var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var timeSlots = ['9am', '4pm', '7pm'];

  for (var i = 29; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i - 1);
    var dateStr = d.toISOString().slice(0, 10);
    var dow = d.getDay();
    var dayName = dayNames[dow];

    // Generate two sessions per day
    for (var s = 0; s < timeSlots.length; s++) {
      var slot = timeSlots[s];
      // Base show rate from heatmap, add variance
      var baseRate = MOCK_DATA.heatmap_data[slot][dayName] || 60;
      var showRate = Math.max(45, Math.min(80, baseRate + (Math.random() * 12 - 6)));
      var attendees = Math.round(12 + Math.random() * 20);
      var showed = Math.round(attendees * showRate / 100);
      var vipCount = Math.round(showed * (0.35 + Math.random() * 0.3));
      var bookings = Math.round(showed * (0.25 + Math.random() * 0.15));
      var compFull = Math.round(showed * (0.55 + Math.random() * 0.15));
      var compPartial = Math.round(showed * (0.18 + Math.random() * 0.12));
      var compBounced = showed - compFull - compPartial;
      if (compBounced < 0) compBounced = 0;

      MOCK_DATA.session_data.push({
        date: dateStr,
        time_slot: slot,
        day_of_week: dayName,
        show_rate: +showRate.toFixed(1),
        registered: attendees,
        attendees: showed,
        vip_count: vipCount,
        bookings: bookings,
        booking_pct: showed > 0 ? +(bookings / showed * 100).toFixed(1) : 0,
        vip_pct: showed > 0 ? +(vipCount / showed * 100).toFixed(1) : 0,
        completion_full: compFull,
        completion_partial: compPartial,
        completion_bounced: compBounced
      });
    }
  }

  // Generate daily show rate aggregates (for trend chart)
  var dateMap = {};
  MOCK_DATA.session_data.forEach(function(s) {
    if (!dateMap[s.date]) {
      dateMap[s.date] = { totalReg: 0, totalShowed: 0, vipShowed: 0, vipReg: 0 };
    }
    dateMap[s.date].totalReg += s.registered;
    dateMap[s.date].totalShowed += s.attendees;
    dateMap[s.date].vipShowed += s.vip_count;
    dateMap[s.date].vipReg += Math.round(s.vip_count * 1.3);
  });
  var dates = Object.keys(dateMap).sort();
  dates.forEach(function(dt) {
    var dm = dateMap[dt];
    MOCK_DATA.daily_show_rates.push({
      date: dt,
      overall_show_rate: dm.totalReg > 0 ? +(dm.totalShowed / dm.totalReg * 100).toFixed(1) : 0,
      vip_show_rate: dm.vipReg > 0 ? +(dm.vipShowed / dm.vipReg * 100).toFixed(1) : 0,
      completion_rate: +(60 + Math.random() * 25).toFixed(1),
      seat_fill_rate: +(40 + Math.random() * 35).toFixed(1)
    });
  });

  // Generate previous period daily show rates (for compare mode)
  MOCK_DATA.prev_daily_show_rates = [];
  for (var pi = 29; pi >= 0; pi--) {
    var pd = new Date(now);
    pd.setDate(pd.getDate() - pi - 31);
    MOCK_DATA.prev_daily_show_rates.push({
      date: pd.toISOString().slice(0, 10),
      overall_show_rate: +(50 + Math.random() * 18).toFixed(1),
      vip_show_rate: +(45 + Math.random() * 20).toFixed(1),
      completion_rate: +(55 + Math.random() * 25).toFixed(1),
      seat_fill_rate: +(35 + Math.random() * 35).toFixed(1)
    });
  }

  // Generate sparkline data (4 weekly points per KPI)
  function pctSpread(base, weeks) {
    var pts = [];
    for (var w = 0; w < weeks; w++) {
      pts.push(+(base * (0.85 + Math.random() * 0.3)).toFixed(1));
    }
    return pts;
  }
  function weeklySpread(total, weeks) {
    var pts = [];
    var remaining = total;
    for (var w = 0; w < weeks - 1; w++) {
      var v = (total / weeks) * (0.7 + Math.random() * 0.6);
      pts.push(Math.round(v));
      remaining -= v;
    }
    pts.push(Math.round(remaining));
    return pts;
  }

  MOCK_DATA.sparklines = {
    show_rate: pctSpread(61.1, 4),
    vip_rate: pctSpread(49.4, 4),
    booking_pct: pctSpread(32.1, 4),
    completion: pctSpread(62, 4),
    sessions: weeklySpread(121, 4)
  };
})();

// ---- Multiplied mock data for different date ranges ----
function getScaledData(days) {
  var scale = days / 30;
  var cur = MOCK_DATA.periods.current;
  var prev = MOCK_DATA.periods.previous;
  function scaleP(p) {
    return {
      show_rate: p.show_rate,
      vip_upgrade_rate: p.vip_upgrade_rate,
      completion_rate_full: p.completion_rate_full,
      completion_rate_partial: p.completion_rate_partial,
      completion_rate_bounced: p.completion_rate_bounced,
      booking_pct: p.booking_pct,
      total_sessions: Math.round(p.total_sessions * scale),
      total_attendees: Math.round(p.total_attendees * scale),
      vip_attendees: Math.round(p.vip_attendees * scale),
      standard_attendees: Math.round(p.standard_attendees * scale)
    };
  }
  return { current: scaleP(cur), previous: scaleP(prev) };
}

// ---- Formatters ----
function formatPct(val) {
  if (val == null || isNaN(val)) return '0.0%';
  return val.toFixed(1) + '%';
}
function formatInt(val) { return Math.round(val).toLocaleString(); }

// ---- Traffic Light Logic ----
var KPI_TARGETS = {
  show_rate:       { target: 65, warn: 60, inverted: false },
  vip_upgrade_rate:{ target: 35, warn: 30, inverted: false },
  booking_pct:     { target: 35, warn: 28, inverted: false },
  completion:      { target: 60, warn: 50, inverted: false },
  sessions:        { target: null, inverted: false }
};

function getTrafficLight(kpi, value, prevValue) {
  var spec = KPI_TARGETS[kpi];
  if (!spec) return 'neutral';
  var t = spec.target;
  // For vs-prior metrics (no absolute target)
  if (t === null) {
    if (prevValue == null) return 'neutral';
    var pctChange = ((value - prevValue) / Math.abs(prevValue || 1)) * 100;
    if (spec.inverted) pctChange = -pctChange;
    if (pctChange >= 0) return 'green';
    if (pctChange > -10) return 'yellow';
    return 'red';
  }
  if (spec.inverted) {
    if (value <= t) return 'green';
    if (value <= spec.warn) return 'yellow';
    return 'red';
  }
  if (value >= t) return 'green';
  if (value >= spec.warn) return 'yellow';
  return 'red';
}

// ---- Render: YTD Summary Strip ----
async function renderYTD() {
  var strip = document.getElementById('ytdStrip');
  try {
    var data = await API.query('workshop', 'ytd');
    if (!data || data.length === 0) { strip.style.display = 'none'; return; }
    var d = data[0];
    var fmtN = function(n) { return (n || 0).toLocaleString(); };
    var fmtP = function(n) { return (n || 0).toFixed(1) + '%'; };
    var fmtM = function(n) { return '$' + Math.round(n || 0).toLocaleString(); };
    strip.style.display = '';
    strip.innerHTML =
      '<div class="ytd-strip__title">2026 Year-to-Date</div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Tickets</span><span class="ytd-item__value">' + fmtN(d.tickets) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Attended</span><span class="ytd-item__value">' + fmtN(d.attended) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Show Rate</span><span class="ytd-item__value ytd-item__value--accent">' + fmtP(d.show_rate) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">VIP</span><span class="ytd-item__value ytd-item__value--gold">' + fmtN(d.vip) + ' (' + fmtP(d.vip_rate) + ')</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Booked</span><span class="ytd-item__value">' + fmtN(d.booked) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Booking Rate</span><span class="ytd-item__value ytd-item__value--accent">' + fmtP(d.booking_rate) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Enrolled</span><span class="ytd-item__value ytd-item__value--green">' + fmtN(d.enrolled) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Close Rate</span><span class="ytd-item__value ytd-item__value--green">' + fmtP(d.close_rate) + '</span></div>' +
      '<div class="ytd-item"><span class="ytd-item__label">Enrollment Rev</span><span class="ytd-item__value ytd-item__value--green">' + fmtM(d.enrollment_revenue) + '</span></div>';
  } catch(e) { strip.style.display = 'none'; }
}

// ---- Delta ----
function calcDelta(current, previous) {
  if (previous === 0 || previous == null) return { pct: 0, direction: 'neutral' };
  var pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral', raw: pct };
}

// ---- Render: KPI Cards ----
var sparkCharts = {};

function renderKPICards(cur, prev, currentRows, previousRows) {
  // If real BQ data available, compute aggregates from it
  if (currentRows && currentRows.length > 0) {
    function sumF(rows, key) { return rows.reduce(function(s,r){ return s + (r[key]||0); }, 0); }
    var curTix = sumF(currentRows, 'tickets');
    var curAtt = sumF(currentRows, 'attended');
    var curBkd = sumF(currentRows, 'booked');
    var curVip = sumF(currentRows, 'vip');
    var curEnr = sumF(currentRows, 'enrolled');
    cur = {
      show_rate: curTix > 0 ? (curAtt / curTix * 100) : cur.show_rate,
      vip_upgrade_rate: curTix > 0 ? (curVip / curTix * 100) : cur.vip_upgrade_rate,
      booking_pct: curAtt > 0 ? (curBkd / curAtt * 100) : cur.booking_pct,
      completion_rate_full: cur.completion_rate_full, // no BQ source yet
      total_attendees: curAtt
    };
    if (previousRows && previousRows.length > 0) {
      var prevTix = sumF(previousRows, 'tickets');
      var prevAtt = sumF(previousRows, 'attended');
      var prevBkd = sumF(previousRows, 'booked');
      var prevVip = sumF(previousRows, 'vip');
      prev = {
        show_rate: prevTix > 0 ? (prevAtt / prevTix * 100) : prev.show_rate,
        vip_upgrade_rate: prevTix > 0 ? (prevVip / prevTix * 100) : prev.vip_upgrade_rate,
        booking_pct: prevAtt > 0 ? (prevBkd / prevAtt * 100) : prev.booking_pct,
        completion_rate_full: prev.completion_rate_full,
        total_attendees: prevAtt
      };
    }
    // Build sparklines by grouping currentRows by ISO week
    var weekBuckets = {};
    currentRows.forEach(function(r) {
      var d = new Date(r.dt);
      var dayOfWeek = (d.getDay() + 6) % 7;
      var thu = new Date(d); thu.setDate(d.getDate() - dayOfWeek + 3);
      var ys = new Date(thu.getFullYear(), 0, 1);
      var wk = thu.getFullYear() + '-W' + Math.ceil(((thu - ys) / 86400000 + 1) / 7);
      if (!weekBuckets[wk]) weekBuckets[wk] = { tickets: 0, attended: 0, booked: 0, vip: 0 };
      weekBuckets[wk].tickets += (r.tickets||0);
      weekBuckets[wk].attended += (r.attended||0);
      weekBuckets[wk].booked += (r.booked||0);
      weekBuckets[wk].vip += (r.vip||0);
    });
    var wkKeys = Object.keys(weekBuckets).sort();
    MOCK_DATA.sparklines.show_rate = wkKeys.map(function(k){ var b = weekBuckets[k]; return b.tickets > 0 ? +(b.attended/b.tickets*100).toFixed(1) : 0; });
    MOCK_DATA.sparklines.vip_rate = wkKeys.map(function(k){ var b = weekBuckets[k]; return b.tickets > 0 ? +(b.vip/b.tickets*100).toFixed(1) : 0; });
    MOCK_DATA.sparklines.booking_pct = wkKeys.map(function(k){ var b = weekBuckets[k]; return b.attended > 0 ? +(b.booked/b.attended*100).toFixed(1) : 0; });
    MOCK_DATA.sparklines.sessions = wkKeys.map(function(k){ return weekBuckets[k].attended; });
  }

  // KPI-to-funnel-metric index mapping for click handling
  var kpiToFunnelIdx = { 'show_rate': 0, 'vip_upgrade_rate': 0, 'booking_pct': 2, 'completion': 1, 'sessions': 0 };

  var kpis = [
    { id: 'show_rate', label: 'Show Rate', value: cur.show_rate, prev: prev.show_rate, format: formatPct, sparkKey: 'show_rate', target: '65%', tip: 'Percentage of registered attendees who actually showed up to the workshop. Source: AEvent attendance records.', source: 'BigQuery: aevent_attendance', calc: 'attended / registered * 100' },
    { id: 'vip_upgrade_rate', label: 'VIP Upgrade Rate', value: cur.vip_upgrade_rate, prev: prev.vip_upgrade_rate, format: formatPct, sparkKey: 'vip_rate', target: '35%', tip: 'Percentage of attendees who upgraded to VIP tickets before or during the workshop. Source: Stripe $54 VIP ticket purchases.', source: 'Stripe charges ($54 filter)', calc: 'COUNT(vip_tickets) / COUNT(all_attendees) * 100' },
    { id: 'booking_pct', label: 'Booking Rate', value: cur.booking_pct, prev: prev.booking_pct, format: formatPct, sparkKey: 'booking_pct', target: '35%', tip: 'Percentage of attendees who booked a strategy call after the workshop. Source: GHL calendar bookings linked to workshop contacts.', source: 'BigQuery: ghl_calendar_bookings', calc: 'bookings / attended * 100' },
    { id: 'completion', label: 'Completion Rate', value: cur.completion_rate_full, prev: prev.completion_rate_full, format: function(v) { return v + '% full'; }, sparkKey: 'completion', target: '>50% full', tip: 'Percentage of attendees who watched the full workshop (>8000 seconds). Source: AEvent watch time tracking.', source: 'AEvent watch time API', calc: 'COUNT(watch_time > 8000s) / total_attendees * 100' },
    { id: 'sessions', label: 'Total Unique Visitors', value: cur.total_attendees, prev: prev.total_attendees, format: formatInt, sparkKey: 'sessions', target: null, tip: 'Total unique attendees across all workshop sessions in this period. Source: AEvent + Zoom attendance records, deduplicated by email.', source: 'BigQuery: aevent_attendance + zoom_participants', calc: 'COUNT(DISTINCT email) WHERE status = attended' }
  ];

  var grid = document.getElementById('kpiGrid');
  grid.innerHTML = '';

  kpis.forEach(function(kpi) {
    var light = getTrafficLight(kpi.id, kpi.value, kpi.prev);
    var delta = calcDelta(kpi.value, kpi.prev);
    var deltaClass = delta.direction === 'up' ? 'up' : delta.direction === 'down' ? 'down' : 'neutral';
    var arrow = delta.direction === 'up' ? '&#9650;' : delta.direction === 'down' ? '&#9660;' : '&#8212;';
    var cardClass = light === 'green' ? 'kpi-card--up' : light === 'red' ? 'kpi-card--down' : light === 'yellow' ? 'kpi-card--warn' : '';

    var targetHtml = kpi.target ? '<div class="kpi-card__target">target: ' + kpi.target + '</div>' : '';

    var html = '<div class="kpi-card ' + cardClass + '" data-kpi-id="' + kpi.id + '" style="cursor:pointer" title="' + (kpi.tip || '').replace(/"/g, '&quot;') + '">' +
      '<div class="kpi-card__header">' +
        '<span class="kpi-card__label">' + kpi.label + '</span>' +
        '<span class="kpi-card__traffic-light kpi-card__traffic-light--' + light + '"></span>' +
      '</div>' +
      '<div class="kpi-card__value">' + kpi.format(kpi.value) + '</div>' +
      targetHtml +
      '<div class="kpi-card__delta kpi-card__delta--' + deltaClass + '">' +
        '<span>' + arrow + '</span> ' + delta.pct.toFixed(1) + '% vs prior' +
      '</div>' +
      '<div class="kpi-card__sparkline"><canvas id="spark-' + kpi.id + '"></canvas></div>' +
      (kpi.source || kpi.calc ? '<div class="kpi-calc-meta">' +
        (kpi.source ? '<div class="kpi-calc-row"><span class="kpi-calc-label">Source</span> ' + kpi.source + '</div>' : '') +
        (kpi.calc ? '<div class="kpi-calc-row"><span class="kpi-calc-label">Calc</span> ' + kpi.calc + '</div>' : '') +
      '</div>' : '') +
    '</div>';

    grid.insertAdjacentHTML('beforeend', html);

    // Sparkline with gradient fill
    setTimeout(function() {
      var canvas = document.getElementById('spark-' + kpi.id);
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var color = light === 'green' ? COLORS.up : light === 'red' ? COLORS.down : COLORS.warning;

      // Build gradient fill
      var grad = ctx.createLinearGradient(0, 0, 0, 44);
      // parse color to get RGB for alpha
      var hex = color.replace('#','');
      var r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0.15)');
      grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

      if (sparkCharts[kpi.id]) sparkCharts[kpi.id].destroy();
      sparkCharts[kpi.id] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4'],
          datasets: [{
            data: MOCK_DATA.sparklines[kpi.sparkKey] || [0, 0, 0, 0],
            borderColor: color,
            backgroundColor: grad,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false }
          },
          events: []
        }
      });
    }, 0);
  });

  // Make KPI cards clickable to switch funnel chart metric
  grid.querySelectorAll('.kpi-card[data-kpi-id]').forEach(function(card) {
    card.addEventListener('click', function() {
      var kpiId = this.getAttribute('data-kpi-id');
      var funnelIdx = kpiToFunnelIdx[kpiId];
      if (funnelIdx != null && funnelIdx < FUNNEL_METRICS.length) {
        activeFunnelMetric = funnelIdx;
        var canvas = document.getElementById('funnelChart');
        if (canvas && canvas._curRows && canvas._prevRows) {
          // Update strip active state
          var strip = document.getElementById('funnelStrip');
          strip.querySelectorAll('.funnel-metric').forEach(function(m, i) { m.classList.toggle('funnel-metric--active', i === funnelIdx); });
          drawFunnelLine(canvas._curRows, canvas._prevRows, FUNNEL_METRICS[funnelIdx].key, FUNNEL_METRICS[funnelIdx].color);
        }
      }
    });
  });
}

// ---- Grouped Average Utility ----
// Given an array of values and matching date strings (YYYY-MM-DD),
// returns an array of the same length where each value is replaced
// with the average of its time-group bucket.
function computeGroupedAvg(vals, dates, mode) {
  if (!vals || vals.length === 0 || mode === 'off') return null;
  if (mode === 'days') {
    // Each day is its own bucket -- flat line per day (same as raw data for daily, useful for hourly)
    var globalAvg = vals.reduce(function(s,v){return s+v;},0) / vals.length;
    return vals.map(function(){return globalAvg;});
  }
  // Build bucket keys
  function bucketKey(dateStr, m) {
    if (!dateStr) return '0';
    var parts = dateStr.split('-');
    var y = parseInt(parts[0]), mo = parseInt(parts[1]), d = parseInt(parts[2]);
    if (m === 'weeks') {
      // ISO week: get Monday-based week number
      var dt = new Date(y, mo - 1, d);
      var dayOfWeek = (dt.getDay() + 6) % 7; // Mon=0
      var thursday = new Date(dt);
      thursday.setDate(dt.getDate() - dayOfWeek + 3);
      var yearStart = new Date(thursday.getFullYear(), 0, 1);
      var weekNum = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
      return thursday.getFullYear() + '-W' + weekNum;
    }
    if (m === 'months') return y + '-' + mo;
    return '0';
  }
  // Group indices by bucket
  var buckets = {};
  for (var i = 0; i < vals.length; i++) {
    var key = bucketKey(dates[i], mode);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(i);
  }
  // Compute average per bucket and assign
  var result = new Array(vals.length);
  Object.keys(buckets).forEach(function(key) {
    var indices = buckets[key];
    var sum = 0, count = 0;
    indices.forEach(function(idx) { if (vals[idx] != null) { sum += vals[idx]; count++; } });
    var avg = count > 0 ? sum / count : 0;
    indices.forEach(function(idx) { result[idx] = avg; });
  });
  return result;
}

// ---- Render: Show Rate Trend Chart (Shopify-style) ----
var trendChartInstance = null;
var activeShowRateMetric = 0;

var SHOWRATE_METRICS = [
  { key: 'overall_show_rate', label: 'Show Rate', color: '#22d3ee', tip: 'Daily average show rate: attended / registered. Source: AEvent attendance vs registration counts.' },
  { key: 'vip_show_rate', label: 'VIP Rate', color: '#facc15', tip: 'Daily average VIP show rate: VIP attendees / VIP registrants. Source: Stripe VIP ticket purchases + AEvent attendance.' },
  { key: 'completion_rate', label: 'Completion', color: '#22c55e', tip: 'Daily average full completion rate (watched >8000s). Source: AEvent watch time tracking.' },
  { key: 'seat_fill_rate', label: 'Seat Fill', color: '#a855f7', tip: 'Daily average seat fill: attendees / available seats per session. Source: AEvent capacity settings.' }
];

async function renderShowRateTrend(dailyData, prevData) {
  var cur = dailyData;
  var prev = prevData && prevData.length > 0 ? prevData : [];

  // Try fetching real data from BQ
  try {
    var raw = await API.query('workshop', 'showRateTrend', { days: currentDays });
    if (raw && raw.length > 0) {
      var bqCur = raw.filter(function(r){ return r.period === 'current'; }).sort(function(a,b){ return a.dt < b.dt ? -1 : 1; });
      var bqPrev = raw.filter(function(r){ return r.period === 'previous'; }).sort(function(a,b){ return a.dt < b.dt ? -1 : 1; });
      if (bqCur.length > 0) {
        // Map BQ dt field to date field expected by drawShowRateLine
        cur = bqCur.map(function(r) { return { date: r.dt, overall_show_rate: r.overall_show_rate || 0, vip_show_rate: r.vip_show_rate || 0, completion_rate: r.completion_rate || 0, seat_fill_rate: r.attended_count || 0 }; });
        prev = bqPrev.map(function(r) { return { date: r.dt, overall_show_rate: r.overall_show_rate || 0, vip_show_rate: r.vip_show_rate || 0, completion_rate: r.completion_rate || 0, seat_fill_rate: r.attended_count || 0 }; });
      }
    }
  } catch(e) { /* keep mock fallback */ }

  // Calculate averages for mini KPIs
  function avg(rows, key) {
    if (!rows.length) return 0;
    return rows.reduce(function(s, r) { return s + (r[key] || 0); }, 0) / rows.length;
  }

  var miniKpis = SHOWRATE_METRICS.map(function(m) {
    var curAvg = avg(cur, m.key);
    var prevAvg = avg(prev, m.key);
    var d = prevAvg > 0 ? ((curAvg - prevAvg) / Math.abs(prevAvg) * 100) : 0;
    return { label: m.label, cur: curAvg, delta: d };
  });

  // Render mini KPI strip
  var strip = document.getElementById('showRateStrip');
  strip.innerHTML = miniKpis.map(function(mk, idx) {
    var dStr = (mk.delta >= 0 ? '+' : '') + mk.delta.toFixed(0) + '%';
    var dColor = mk.delta > 0 ? '#22c55e' : mk.delta < 0 ? '#ef4444' : '#64748b';
    var active = idx === activeShowRateMetric ? ' funnel-metric--active' : '';
    var tip = SHOWRATE_METRICS[idx].tip || '';
    return '<div class="funnel-metric' + active + '" data-idx="' + idx + '" title="' + tip + '">' +
      '<div class="funnel-metric__label">' + mk.label + '</div>' +
      '<div class="funnel-metric__row">' +
        '<span class="funnel-metric__value">' + mk.cur.toFixed(1) + '%</span>' +
        '<span class="funnel-metric__delta" style="color:' + dColor + '">' + dStr + '</span>' +
      '</div></div>';
  }).join('');

  // Click handler for metric switching
  strip.querySelectorAll('.funnel-metric').forEach(function(el) {
    el.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      activeShowRateMetric = idx;
      strip.querySelectorAll('.funnel-metric').forEach(function(m) { m.classList.remove('funnel-metric--active'); });
      this.classList.add('funnel-metric--active');
      drawShowRateLine(cur, prev, SHOWRATE_METRICS[idx].key, SHOWRATE_METRICS[idx].color);
    });
  });

  // Legend
  var curStart = cur.length ? cur[0].date.substring(5) : '';
  var curEnd = cur.length ? cur[cur.length - 1].date.substring(5) : '';
  var prevStart = prev.length ? prev[0].date.substring(5) : '';
  var prevEnd = prev.length ? prev[prev.length - 1].date.substring(5) : '';
  document.getElementById('showRateLegend').innerHTML =
    '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:2px;background:currentColor;display:inline-block"></span><strong style="color:#f1f5f9">This period</strong> <span style="opacity:0.6">' + curStart + ' to ' + curEnd + '</span></span>' +
    (prev.length ? '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:2px;border-bottom:2px dashed currentColor;display:inline-block"></span><strong style="color:#f1f5f9">Previous period</strong> <span style="opacity:0.6">' + prevStart + ' to ' + prevEnd + '</span></span>' : '');

  // Draw chart for active metric
  drawShowRateLine(cur, prev, SHOWRATE_METRICS[activeShowRateMetric].key, SHOWRATE_METRICS[activeShowRateMetric].color);
}

function drawShowRateLine(curRows, prevRows, metricKey, color) {
  var canvas = document.getElementById('showRateTrendChart');
  var ctx = canvas.getContext('2d');
  if (trendChartInstance) trendChartInstance.destroy();

  var curVals = curRows.map(function(r) { return r[metricKey] || 0; });
  var prevVals = prevRows.map(function(r) { return r[metricKey] || 0; });
  var rawDates = curRows.map(function(r) { return r.date; });
  var labels = curRows.map(function(r) {
    var d = new Date(r.date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  var datasets = [
    {
      label: 'Current',
      data: curVals,
      borderColor: color,
      backgroundColor: color + '18',
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3
    }
  ];

  if (prevVals.length > 0) {
    datasets.push({
      label: 'Previous',
      data: prevVals,
      borderColor: color + '60',
      borderDash: [5, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: false
    });
  }

  var chartConfig = {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + '%';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#475569', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#475569',
            font: { size: 10 },
            callback: function(v) { return v + '%'; }
          }
        }
      }
    },
    plugins: [weekendHolidayPlugin]
  };
  // Grouped average line
  if (_avgMode !== 'off' && curVals.length > 0) {
    var avgData = computeGroupedAvg(curVals, rawDates, _avgMode);
    if (avgData) {
      var globalAvg = curVals.reduce(function(s,v){return s+v;},0) / curVals.length;
      var modeLabels = {days:'Overall',weeks:'Weekly',months:'Monthly'};
      chartConfig.data.datasets.push({
        label: (modeLabels[_avgMode]||'') + ' Avg (' + globalAvg.toFixed(1) + '%)',
        data: avgData,
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        stepped: _avgMode !== 'days' ? 'middle' : false,
        fill: false
      });
    }
  }

  trendChartInstance = new Chart(ctx, chartConfig);
  trendChartInstance._customDates = rawDates;
  trendChartInstance.update();
}

// ---- Render: Watch Time Breakdown (30-min segments) ----
var activeCompletionSegment = 'all';

// Mock watch-time segment data: 30-min intervals across a ~2.5hr workshop
var WATCH_SEGMENTS = [
  { label: '0 - 30 min',   tag: 'Intro / Hook',       allIn: 1847, allDrop: 259, vipIn: 912, vipDrop: 82,  stdIn: 935, stdDrop: 177, enrolled: 0 },
  { label: '30 - 60 min',  tag: 'Teaching Block 1',    allIn: 1588, allDrop: 143, vipIn: 830, vipDrop: 50,  stdIn: 758, stdDrop: 93,  enrolled: 0 },
  { label: '60 - 90 min',  tag: 'Teaching Block 2',    allIn: 1445, allDrop: 127, vipIn: 780, vipDrop: 39,  stdIn: 665, stdDrop: 88,  enrolled: 3 },
  { label: '90 - 120 min', tag: 'Case Studies',        allIn: 1318, allDrop: 89,  vipIn: 741, vipDrop: 25,  stdIn: 577, stdDrop: 64,  enrolled: 8 },
  { label: '120 - 150 min',tag: 'Pitch / Offer',       allIn: 1229, allDrop: 52,  vipIn: 716, vipDrop: 14,  stdIn: 513, stdDrop: 38,  enrolled: 47 },
  { label: '150+ min',     tag: 'Q&A / Close',         allIn: 1177, allDrop: 32,  vipIn: 702, vipDrop: 8,   stdIn: 475, stdDrop: 24,  enrolled: 39 }
];

async function renderCompletionBreakdown(cur, prev) {
  // Try fetching real watch time data from BQ
  try {
    var wtData = await API.query('workshop', 'watchTime', { days: currentDays });
    if (wtData && wtData.length > 0) {
      // Sort by sort_order
      wtData.sort(function(a,b){ return (a.sort_order||0) - (b.sort_order||0); });
      var segLabels = { '0-30min': '0 - 30 min', '30-60min': '30 - 60 min', '60-90min': '60 - 90 min', '90min+': '90+ min' };
      var segTags = { '0-30min': 'Intro / Hook', '30-60min': 'Teaching Block 1', '60-90min': 'Teaching Block 2', '90min+': 'Pitch / Close' };
      WATCH_SEGMENTS = wtData.map(function(r, idx) {
        var allIn = r.viewers || 0;
        var vipIn = r.vip_viewers || 0;
        var stdIn = r.standard_viewers || 0;
        var nextAll = idx < wtData.length - 1 ? (wtData[idx+1].viewers || 0) : allIn;
        var nextVip = idx < wtData.length - 1 ? (wtData[idx+1].vip_viewers || 0) : vipIn;
        var nextStd = idx < wtData.length - 1 ? (wtData[idx+1].standard_viewers || 0) : stdIn;
        return {
          label: segLabels[r.segment] || r.segment,
          tag: segTags[r.segment] || '',
          allIn: allIn,
          allDrop: Math.max(0, allIn - nextAll),
          vipIn: vipIn,
          vipDrop: Math.max(0, vipIn - nextVip),
          stdIn: stdIn,
          stdDrop: Math.max(0, stdIn - nextStd),
          enrolled: r.enrolled || 0
        };
      });
    }
  } catch(e) { /* keep mock WATCH_SEGMENTS */ }

  var seg = activeCompletionSegment;
  var container = document.getElementById('watchTimeTable');
  var maxIn = WATCH_SEGMENTS[0][seg === 'vip' ? 'vipIn' : seg === 'standard' ? 'stdIn' : 'allIn'];

  var html = '<table class="watch-time-table"><thead><tr>' +
    '<th>Segment</th><th>Content</th><th>Watching</th><th>Drop-off</th><th>Drop %</th><th>Retention</th><th>VIPs</th><th>Enrolled</th>' +
    '</tr></thead><tbody>';

  WATCH_SEGMENTS.forEach(function(s, idx) {
    var inKey = seg === 'vip' ? 'vipIn' : seg === 'standard' ? 'stdIn' : 'allIn';
    var dropKey = seg === 'vip' ? 'vipDrop' : seg === 'standard' ? 'stdDrop' : 'allDrop';
    var watching = s[inKey];
    var drop = s[dropKey];
    var dropPct = watching > 0 ? (drop / watching * 100) : 0;
    var retention = maxIn > 0 ? (watching / maxIn * 100) : 0;
    var barW = Math.max(3, retention);

    // Color: green if retention > 70%, yellow 40-70%, red < 40%
    var barColor = retention >= 70 ? COLORS.up : retention >= 40 ? COLORS.warning : COLORS.down;
    var dropColor = dropPct > 10 ? COLORS.down : dropPct > 5 ? COLORS.warning : COLORS.up;

    // Status badge for high drop-off segments
    var statusBadge = '';
    if (dropPct > 10) {
      statusBadge = '<span class="wt-status" style="background:rgba(239,68,68,0.15);color:#ef4444">LEAK</span>';
    } else if (dropPct < 4) {
      statusBadge = '<span class="wt-status" style="background:rgba(34,197,94,0.15);color:#22c55e">HOLD</span>';
    }

    var vipCount = seg === 'standard' ? '-' : s.vipIn;

    html += '<tr>' +
      '<td>' + s.label + '</td>' +
      '<td style="font-size:10px;color:#94a3b8">' + s.tag + '</td>' +
      '<td>' + watching.toLocaleString() + '</td>' +
      '<td style="color:' + dropColor + '">' + drop.toLocaleString() + ' ' + statusBadge + '</td>' +
      '<td style="color:' + dropColor + '">' + dropPct.toFixed(1) + '%</td>' +
      '<td><span class="wt-bar" style="width:' + barW + '%;background:' + barColor + '"></span>' + retention.toFixed(0) + '%</td>' +
      '<td>' + (typeof vipCount === 'number' ? vipCount.toLocaleString() : vipCount) + '</td>' +
      '<td style="color:' + (s.enrolled > 0 ? '#a855f7' : '#334155') + '">' + s.enrolled + '</td>' +
    '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Wire toggle
  var toggle = document.getElementById('completionToggle');
  toggle.querySelectorAll('.completion-toggle__btn').forEach(function(btn) {
    btn.onclick = function() {
      toggle.querySelectorAll('.completion-toggle__btn').forEach(function(b) { b.classList.remove('completion-toggle__btn--active'); });
      this.classList.add('completion-toggle__btn--active');
      activeCompletionSegment = this.dataset.segment;
      renderCompletionBreakdown(cur, prev);
    };
  });
}

// ---- Render: Heatmap ----
async function renderHeatmap() {
  // Try fetching real heatmap data from BQ
  var heatData = MOCK_DATA.heatmap_data;
  try {
    var hmData = await API.query('workshop', 'heatmapShowRate', { days: currentDays });
    if (hmData && hmData.length > 0) {
      var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var bqHeat = {};
      hmData.forEach(function(r) {
        var day = dayNames[r.dow - 1];
        if (!bqHeat[r.time_slot]) bqHeat[r.time_slot] = {};
        bqHeat[r.time_slot][day] = Math.round(r.show_rate);
      });
      if (Object.keys(bqHeat).length > 0) heatData = bqHeat;
    }
  } catch(e) { /* keep mock fallback */ }

  var grid = document.getElementById('heatmapGrid');
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var slots = Object.keys(heatData);

  // Find min/max for color scaling
  var allVals = [];
  slots.forEach(function(slot) {
    days.forEach(function(day) {
      allVals.push(heatData[slot][day] || 0);
    });
  });
  var minVal = Math.min.apply(null, allVals);
  var maxVal = Math.max.apply(null, allVals);

  // Header row: empty corner + day labels
  var html = '<div class="heatmap-header"></div>';
  days.forEach(function(day) {
    html += '<div class="heatmap-header">' + day + '</div>';
  });

  // Data rows -- green-to-red gradient based on value
  slots.forEach(function(slot) {
    html += '<div class="heatmap-row-label">' + slot + '</div>';
    days.forEach(function(day) {
      var val = (heatData[slot] && heatData[slot][day]) || 0;
      var norm = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
      var bg;
      if (norm >= 0.66) {
        bg = 'linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.65))';
      } else if (norm >= 0.33) {
        bg = 'linear-gradient(135deg, rgba(245,158,11,0.75), rgba(217,119,6,0.55))';
      } else {
        bg = 'linear-gradient(135deg, rgba(239,68,68,0.7), rgba(185,28,28,0.55))';
      }
      html += '<div class="heatmap-cell" style="background:' + bg + '">' + val + '%</div>';
    });
  });

  grid.innerHTML = html;
}

// ---- Render: Ticket Purchase Heatmap ----
async function renderTicketHeatmap() {
  // Try fetching real ticket heatmap data from BQ
  var ticketHeat = MOCK_DATA.ticket_heatmap;
  try {
    var thData = await API.query('workshop', 'heatmapTickets', { days: currentDays });
    if (thData && thData.length > 0) {
      var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var bqTicketHeat = {};
      thData.forEach(function(r) {
        var day = dayNames[r.dow - 1];
        var h = r.hour_of_day;
        var label = h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
        if (!bqTicketHeat[label]) bqTicketHeat[label] = {};
        bqTicketHeat[label][day] = r.tickets || 0;
      });
      if (Object.keys(bqTicketHeat).length > 0) ticketHeat = bqTicketHeat;
    }
  } catch(e) { /* keep mock fallback */ }

  var grid = document.getElementById('ticketHeatmapGrid');
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var slots = Object.keys(ticketHeat);

  var allVals = [];
  slots.forEach(function(slot) {
    days.forEach(function(day) {
      allVals.push((ticketHeat[slot] && ticketHeat[slot][day]) || 0);
    });
  });
  var minVal = Math.min.apply(null, allVals);
  var maxVal = Math.max.apply(null, allVals);

  var html = '<div class="heatmap-header"></div>';
  days.forEach(function(day) {
    html += '<div class="heatmap-header">' + day + '</div>';
  });

  slots.forEach(function(slot) {
    html += '<div class="heatmap-row-label">' + slot + '</div>';
    days.forEach(function(day) {
      var val = (ticketHeat[slot] && ticketHeat[slot][day]) || 0;
      var norm = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
      var bg;
      if (norm >= 0.75) {
        bg = 'linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.7))';
      } else if (norm >= 0.55) {
        bg = 'linear-gradient(135deg, rgba(34,211,238,0.75), rgba(6,182,212,0.6))';
      } else if (norm >= 0.35) {
        bg = 'linear-gradient(135deg, rgba(99,102,241,0.7), rgba(124,58,237,0.55))';
      } else if (norm >= 0.15) {
        bg = 'linear-gradient(135deg, rgba(124,58,237,0.45), rgba(88,28,135,0.4))';
      } else {
        bg = 'linear-gradient(135deg, rgba(88,28,135,0.3), rgba(55,15,100,0.25))';
      }
      html += '<div class="heatmap-cell" style="background:' + bg + '">' + val + '</div>';
    });
  });

  grid.innerHTML = html;
}

// ---- Render: Ticket Sales Velocity & Journey Table ----
// ---- Row color class by time-of-day ----
var SLOT_FIRST_SEEN = { '9am': '2025-01-01', '4pm': '2025-01-01' };

function getSlotRowClass(slot, sessionDate) {
  var hour = parseInt(slot);
  var isPM = slot.toLowerCase().indexOf('pm') > -1;
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;

  var cls = 'slot-row--';
  if (hour < 12) cls += 'morning';
  else if (hour < 17) cls += 'afternoon';
  else cls += 'evening';

  // Detect newly added slots
  if (!SLOT_FIRST_SEEN[slot]) {
    SLOT_FIRST_SEEN[slot] = sessionDate;
    cls += ' slot-row--new';
  } else {
    var first = new Date(SLOT_FIRST_SEEN[slot] + 'T00:00:00');
    if (Math.floor((new Date() - first) / 86400000) <= 14) cls += ' slot-row--new';
  }
  return cls;
}

function getTrendBox(current, previous) {
  if (previous == null) return '<span class="trend-box trend-box--flat"></span>';
  var diff = current - previous;
  if (diff > 5)       return '<span class="trend-box trend-box--up-strong"></span>';
  if (diff > 2)       return '<span class="trend-box trend-box--up-mid"></span>';
  if (diff > 0.5)     return '<span class="trend-box trend-box--up-light"></span>';
  if (diff >= -0.5)   return '<span class="trend-box trend-box--flat"></span>';
  if (diff >= -2)     return '<span class="trend-box trend-box--down-light"></span>';
  if (diff >= -5)     return '<span class="trend-box trend-box--down-mid"></span>';
  return '<span class="trend-box trend-box--down-strong"></span>';
}

function getWeekNumber(d) {
  var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  dt.setDate(dt.getDate() + 4 - (dt.getDay() || 7));
  var yearStart = new Date(dt.getFullYear(), 0, 1);
  return Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
}

function makeSepRow(type, label) {
  var dataAttr = type === 'day' ? ' data-day="' + label.toLowerCase() + '"' : '';
  return '<tr class="sep-row sep-row--' + type + '">' +
    '<td colspan="6" style="position:relative;height:22px;">' +
      '<span class="sep-tab sep-tab--' + type + '"' + dataAttr + '>' +
        '<span class="sep-tab__dot"></span>' + label +
      '</span>' +
    '</td></tr>';
}

var activeTableGrain = 'session';

function aggregateByDay(sessions) {
  var map = {};
  sessions.forEach(function(r) {
    if (!map[r.date]) map[r.date] = { date: r.date, attendees: 0, bookings: 0, vipTotal: 0, count: 0 };
    map[r.date].attendees += r.attendees;
    map[r.date].bookings += r.bookings;
    map[r.date].vipTotal += Math.round(r.attendees * r.vip_pct / 100);
    map[r.date].count++;
  });
  var dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Object.keys(map).sort().reverse().map(function(dt) {
    var m = map[dt];
    var d = new Date(dt + 'T00:00:00');
    return { date: dt, dayName: dayLabels[d.getDay()], isWeekend: d.getDay() === 0 || d.getDay() === 6, time_slot: m.count + ' sessions', attendees: m.attendees, bookings: m.bookings,
      booking_pct: m.attendees > 0 ? m.bookings / m.attendees * 100 : 0,
      vip_pct: m.attendees > 0 ? m.vipTotal / m.attendees * 100 : 0 };
  });
}

function aggregateByWeek(sessions) {
  var map = {};
  sessions.forEach(function(r) {
    var d = new Date(r.date + 'T00:00:00');
    var wk = getWeekNumber(d);
    var yr = d.getFullYear();
    var key = yr + '-W' + wk;
    if (!map[key]) map[key] = { key: key, date: r.date, attendees: 0, bookings: 0, vipTotal: 0, count: 0, minDate: r.date, maxDate: r.date };
    map[key].attendees += r.attendees;
    map[key].bookings += r.bookings;
    map[key].vipTotal += Math.round(r.attendees * r.vip_pct / 100);
    map[key].count++;
    if (r.date < map[key].minDate) map[key].minDate = r.date;
    if (r.date > map[key].maxDate) map[key].maxDate = r.date;
  });
  return Object.keys(map).sort().reverse().map(function(k) {
    var m = map[k];
    return { date: m.minDate + ' to ' + m.maxDate, time_slot: 'Week ' + k.split('-W')[1], attendees: m.attendees, bookings: m.bookings,
      booking_pct: m.attendees > 0 ? m.bookings / m.attendees * 100 : 0,
      vip_pct: m.attendees > 0 ? m.vipTotal / m.attendees * 100 : 0 };
  });
}

function aggregateByMonth(sessions) {
  var map = {};
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  sessions.forEach(function(r) {
    var d = new Date(r.date + 'T00:00:00');
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!map[key]) map[key] = { key: key, attendees: 0, bookings: 0, vipTotal: 0, count: 0, month: d.getMonth(), year: d.getFullYear() };
    map[key].attendees += r.attendees;
    map[key].bookings += r.bookings;
    map[key].vipTotal += Math.round(r.attendees * r.vip_pct / 100);
    map[key].count++;
  });
  return Object.keys(map).sort().reverse().map(function(k) {
    var m = map[k];
    return { date: monthNames[m.month] + ' ' + m.year, time_slot: m.count + ' sessions', attendees: m.attendees, bookings: m.bookings,
      booking_pct: m.attendees > 0 ? m.bookings / m.attendees * 100 : 0,
      vip_pct: m.attendees > 0 ? m.vipTotal / m.attendees * 100 : 0 };
  });
}

async function renderBookingTable(days) {
  var tbody = document.getElementById('bookingTableBody');
  var sessions = MOCK_DATA.session_data.slice(-days * 2);
  var grain = activeTableGrain;

  // Subtitle update
  var subtitles = { session: 'Per-Session Metrics', day: 'Daily Aggregates', week: 'Weekly Aggregates', month: 'Monthly Aggregates' };
  document.getElementById('tableTitle').innerHTML = 'Ticket Sales Velocity &amp; Journey -- ' + subtitles[grain];

  if (grain === 'day') {
    // Try BQ dailyVelocity first
    try {
      var bqDay = await API.query('workshop', 'dailyVelocity', { days: days });
      if (bqDay && bqDay.length > 0) {
        var agg = bqDay.map(function(r) {
          var d = new Date(r.day + 'T00:00:00');
          var dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          return {
            date: r.day,
            dayName: dayLabels[d.getDay()],
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
            time_slot: '-',
            attendees: r.attendees || 0,
            bookings: r.bookings || 0,
            booking_pct: r.booking_pct || 0,
            vip_pct: r.vip_pct || 0
          };
        }).sort(function(a,b){ return a.date > b.date ? -1 : 1; });
        renderAggregatedTable(tbody, agg);
        wireTableToggle(days);
        return;
      }
    } catch(e) { /* fall through to mock */ }
    var agg = aggregateByDay(sessions);
    renderAggregatedTable(tbody, agg);
    wireTableToggle(days);
    return;
  }
  if (grain === 'week') {
    // Try BQ weeklyVelocity first
    try {
      var bqWeek = await API.query('workshop', 'weeklyVelocity', { days: days });
      if (bqWeek && bqWeek.length > 0) {
        var agg = bqWeek.map(function(r) {
          return {
            date: (r.week_start || '') + ' to ' + (r.week_end || ''),
            time_slot: 'Week ' + r.week_num,
            attendees: r.attendees || 0,
            bookings: r.bookings || 0,
            booking_pct: r.booking_pct || 0,
            vip_pct: r.vip_pct || 0
          };
        }).sort(function(a,b){ return a.date > b.date ? -1 : 1; });
        renderAggregatedTable(tbody, agg);
        wireTableToggle(days);
        return;
      }
    } catch(e) { /* fall through to mock */ }
    var agg = aggregateByWeek(sessions);
    renderAggregatedTable(tbody, agg);
    wireTableToggle(days);
    return;
  }
  if (grain === 'month') {
    var agg = aggregateByMonth(sessions);
    renderAggregatedTable(tbody, agg);
    return;
  }

  // Default: session view with separators
  var rows = sessions.slice().reverse();
  var html = '';
  var lastDate = null;
  var lastWeek = null;
  var lastMonth = null;

  rows.forEach(function(r, idx) {
    var prevRow = idx < rows.length - 1 ? rows[idx + 1] : null;
    var prevBooking = prevRow ? prevRow.booking_pct : null;
    var prevVip = prevRow ? prevRow.vip_pct : null;
    var d = new Date(r.date + 'T00:00:00');
    var weekNum = getWeekNumber(d);
    var monthKey = d.getFullYear() + '-' + d.getMonth();

    if (idx > 0) {
      if (lastMonth !== null && monthKey !== lastMonth) {
        var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        html += makeSepRow('month', monthNames[d.getMonth()] + ' ' + d.getFullYear());
      } else if (lastWeek !== null && weekNum !== lastWeek) {
        html += makeSepRow('week', 'Week ' + weekNum);
      } else if (lastDate !== null && r.date !== lastDate) {
        var dayLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        html += makeSepRow('day', dayLabels[d.getDay()]);
      }
    }

    lastDate = r.date;
    lastWeek = weekNum;
    lastMonth = monthKey;

    var bookingClass = r.booking_pct >= 35 ? 'color:' + COLORS.up : r.booking_pct >= 28 ? 'color:' + COLORS.warning : 'color:' + COLORS.down;
    var vipClass = r.vip_pct >= 45 ? 'color:' + COLORS.up : r.vip_pct >= 30 ? 'color:' + COLORS.warning : '';
    html += '<tr class="' + getSlotRowClass(r.time_slot, r.date) + '">' +
      '<td>' + r.date + '</td>' +
      '<td class="mono">' + r.time_slot + '</td>' +
      '<td class="mono">' + r.attendees.toLocaleString() + '</td>' +
      '<td class="mono">' + r.bookings.toLocaleString() + '</td>' +
      '<td class="mono" style="' + bookingClass + '"><span class="trend-cell">' + r.booking_pct.toFixed(1) + '%' + getTrendBox(r.booking_pct, prevBooking) + '</span></td>' +
      '<td class="mono" style="' + vipClass + '"><span class="trend-cell">' + r.vip_pct.toFixed(1) + '%' + getTrendBox(r.vip_pct, prevVip) + '</span></td>' +
    '</tr>';
  });

  tbody.innerHTML = html;

  // Wire toggle
  wireTableToggle(days);
}

function renderAggregatedTable(tbody, rows) {
  var html = '';
  rows.forEach(function(r, idx) {
    var prevRow = idx < rows.length - 1 ? rows[idx + 1] : null;
    var prevBooking = prevRow ? prevRow.booking_pct : null;
    var prevVip = prevRow ? prevRow.vip_pct : null;
    var bookingClass = r.booking_pct >= 35 ? 'color:' + COLORS.up : r.booking_pct >= 28 ? 'color:' + COLORS.warning : 'color:' + COLORS.down;
    var vipClass = r.vip_pct >= 45 ? 'color:' + COLORS.up : r.vip_pct >= 30 ? 'color:' + COLORS.warning : '';
    var weekendStyle = r.isWeekend ? ' style="background:rgba(124,58,237,0.06)"' : '';
    var dayCol = r.dayName ? '<td style="color:' + (r.isWeekend ? '#a78bfa' : '#94a3b8') + ';font-weight:500">' + r.dayName + '</td>' : '';
    html += '<tr' + weekendStyle + '>' +
      '<td>' + r.date + '</td>' +
      dayCol +
      '<td class="mono" style="color:#94a3b8">' + r.time_slot + '</td>' +
      '<td class="mono">' + r.attendees.toLocaleString() + '</td>' +
      '<td class="mono">' + r.bookings.toLocaleString() + '</td>' +
      '<td class="mono" style="' + bookingClass + '"><span class="trend-cell">' + r.booking_pct.toFixed(1) + '%' + getTrendBox(r.booking_pct, prevBooking) + '</span></td>' +
      '<td class="mono" style="' + vipClass + '"><span class="trend-cell">' + r.vip_pct.toFixed(1) + '%' + getTrendBox(r.vip_pct, prevVip) + '</span></td>' +
    '</tr>';
  });
  tbody.innerHTML = html;
}

function wireTableToggle(days) {
  var toggle = document.getElementById('tableGranularity');
  toggle.querySelectorAll('.completion-toggle__btn').forEach(function(btn) {
    btn.onclick = function() {
      toggle.querySelectorAll('.completion-toggle__btn').forEach(function(b) { b.classList.remove('completion-toggle__btn--active'); });
      this.classList.add('completion-toggle__btn--active');
      activeTableGrain = this.dataset.grain;
      renderBookingTable(days);
    };
  });
}

// ---- Funnel Analytics Chart (Shopify-style) ----
var FUNNEL_METRICS = [
  { key: 'tickets', label: 'Tickets', color: '#6366f1', tip: 'Total $27 workshop tickets purchased. Source: Stripe charges.' },
  { key: 'attended', label: 'Attended', color: '#22d3ee', tip: 'Unique attendees who joined the live workshop. Source: AEvent + Zoom records.' },
  { key: 'booked', label: 'Booked', color: '#22c55e', tip: 'Attendees who booked a strategy/enrollment call. Source: GHL calendar.' },
  { key: 'enrolled', label: 'Enrolled', color: '#a855f7', tip: 'Attendees who enrolled in the main program. Source: Hyros attribution + GHL pipeline.' }
];
var funnelChartInstance = null;
var activeFunnelMetric = 0;

function generateFunnelDaily(days) {
  // Generate mock daily funnel data for current and previous periods
  var result = { current: [], previous: [] };
  var now = new Date();
  for (var p = 0; p < 2; p++) {
    var offset = p === 0 ? 0 : days;
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i - offset);
      var dateStr = d.toISOString().slice(0, 10);
      var base = p === 0 ? 1 : 0.85;
      result[p === 0 ? 'current' : 'previous'].push({
        dt: dateStr,
        tickets: Math.round((8 + Math.random() * 14) * base),
        attended: Math.round((3 + Math.random() * 8) * base),
        booked: Math.round((1 + Math.random() * 5) * base),
        enrolled: Math.round(Math.random() * 2 * base)
      });
    }
  }
  return result;
}

function renderFunnelChart(days, currentRows, previousRows) {
  var cur, prev;
  if (currentRows && currentRows.length > 0) {
    cur = currentRows;
    prev = previousRows && previousRows.length > 0 ? previousRows : [];
  } else {
    var data = generateFunnelDaily(days);
    cur = data.current;
    prev = data.previous;
  }

  // Calculate totals for mini KPIs
  function sum(rows, key) { return rows.reduce(function(s, r) { return s + (r[key] || 0); }, 0); }
  var curTotals = {}, prevTotals = {};
  FUNNEL_METRICS.forEach(function(m) {
    curTotals[m.key] = sum(cur, m.key);
    prevTotals[m.key] = sum(prev, m.key);
  });
  var curConv = curTotals.tickets > 0 ? (curTotals.enrolled / curTotals.tickets * 100) : 0;
  var prevConv = prevTotals.tickets > 0 ? (prevTotals.enrolled / prevTotals.tickets * 100) : 0;

  function delta(c, p) { return p > 0 ? ((c - p) / Math.abs(p) * 100) : 0; }

  var miniKpis = [
    { label: 'Tickets', cur: curTotals.tickets, prev: prevTotals.tickets },
    { label: 'Attended', cur: curTotals.attended, prev: prevTotals.attended },
    { label: 'Booked', cur: curTotals.booked, prev: prevTotals.booked },
    { label: 'Enrolled', cur: curTotals.enrolled, prev: prevTotals.enrolled },
    { label: 'Conversion', cur: curConv, prev: prevConv, isPct: true }
  ];

  // Render mini KPI strip
  var strip = document.getElementById('funnelStrip');
  strip.innerHTML = miniKpis.map(function(mk, idx) {
    var d = delta(mk.cur, mk.prev);
    var dStr = (d >= 0 ? '+' : '') + d.toFixed(0) + '%';
    var dColor = d > 0 ? '#22c55e' : d < 0 ? '#ef4444' : '#64748b';
    var valStr = mk.isPct ? mk.cur.toFixed(2) + '%' : Math.round(mk.cur).toLocaleString();
    var active = idx === activeFunnelMetric ? ' funnel-metric--active' : '';
    var tip = idx < FUNNEL_METRICS.length ? FUNNEL_METRICS[idx].tip : 'End-to-end conversion: enrolled / tickets. Source: calculated.';
    return '<div class="funnel-metric' + active + '" data-idx="' + idx + '" title="' + tip + '">' +
      '<div class="funnel-metric__label">' + mk.label + '</div>' +
      '<div class="funnel-metric__row">' +
        '<span class="funnel-metric__value">' + valStr + '</span>' +
        '<span class="funnel-metric__delta" style="color:' + dColor + '">' + dStr + '</span>' +
      '</div></div>';
  }).join('');

  // Click handler for metric switching
  strip.querySelectorAll('.funnel-metric').forEach(function(el) {
    el.addEventListener('click', function() {
      var idx = parseInt(this.dataset.idx);
      if (idx === 4) return; // Conversion has no daily series
      activeFunnelMetric = idx;
      strip.querySelectorAll('.funnel-metric').forEach(function(m) { m.classList.remove('funnel-metric--active'); });
      this.classList.add('funnel-metric--active');
      drawFunnelLine(cur, prev, FUNNEL_METRICS[idx].key, FUNNEL_METRICS[idx].color);
    });
  });

  // Legend
  var curStart = cur[0].dt.substring(5);
  var curEnd = cur[cur.length - 1].dt.substring(5);
  var prevStart = prev[0].dt.substring(5);
  var prevEnd = prev[prev.length - 1].dt.substring(5);
  document.getElementById('funnelLegend').innerHTML =
    '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:2px;background:currentColor;display:inline-block"></span><strong style="color:#f1f5f9">This period</strong> <span style="opacity:0.6">' + curStart + ' to ' + curEnd + '</span></span>' +
    '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:2px;border-bottom:2px dashed currentColor;display:inline-block"></span><strong style="color:#f1f5f9">Previous period</strong> <span style="opacity:0.6">' + prevStart + ' to ' + prevEnd + '</span></span>';

  // Draw chart
  drawFunnelLine(cur, prev, FUNNEL_METRICS[activeFunnelMetric].key, FUNNEL_METRICS[activeFunnelMetric].color);

  // Store rows on canvas for KPI card click reuse
  var canvas = document.getElementById('funnelChart');
  canvas._curRows = cur;
  canvas._prevRows = prev;
}

function drawFunnelLine(curRows, prevRows, metricKey, color) {
  var canvas = document.getElementById('funnelChart');
  var ctx = canvas.getContext('2d');
  if (funnelChartInstance) funnelChartInstance.destroy();

  var curVals = curRows.map(function(r) { return r[metricKey] || 0; });
  var prevVals = prevRows.map(function(r) { return r[metricKey] || 0; });
  var rawDates = curRows.map(function(r) { return r.dt; });
  var labels = curRows.map(function(r) {
    var d = new Date(r.dt);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  var chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Current',
          data: curVals,
          borderColor: color,
          backgroundColor: color + '18',
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3
        },
        {
          label: 'Previous',
          data: prevVals,
          borderColor: color + '60',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#475569', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#475569', font: { size: 10 } }
        }
      }
    },
    plugins: [weekendHolidayPlugin]
  };

  // Grouped average line
  if (_avgMode !== 'off' && curVals.length > 0) {
    var avgData = computeGroupedAvg(curVals, rawDates, _avgMode);
    if (avgData) {
      var globalAvg = curVals.reduce(function(s,v){return s+v;},0) / curVals.length;
      var modeLabels = {days:'Overall',weeks:'Weekly',months:'Monthly'};
      chartConfig.data.datasets.push({
        label: (modeLabels[_avgMode]||'') + ' Avg (' + globalAvg.toFixed(1) + ')',
        data: avgData,
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
        stepped: _avgMode !== 'days' ? 'middle' : false,
        fill: false
      });
    }
  }

  funnelChartInstance = new Chart(ctx, chartConfig);
  funnelChartInstance._customDates = rawDates;
  funnelChartInstance.update();
}

// ---- Render: Customer Journey Sankey ----
var activeSankeyView = 'all';

// Column-based layout: each node has a col (x position) and row (y position within that column)
// Columns: 0=Ads, 1=Landing Page, 2=Checkout, 3=Post-Purchase, 4=Pre-Workshop, 5=Workshop, 6=Post-Workshop, 7=Booking, 8=Enrollment
var SANKEY_DATA = {
  all: {
    nodes: [
      // Col 0: Traffic
      { id: 'ads',           label: 'Ad Impressions',     value: 48200, color: '#6366f1', col: 0, row: 0 },
      // Col 1: Landing Page
      { id: 'clicks',        label: 'LP Visitors',        value: 6840,  color: '#818cf8', col: 1, row: 0 },
      { id: 'bounce',        label: 'Bounced',            value: 2394,  color: '#ef4444', col: 1, row: 1 },
      // Col 2: VSL + Engagement
      { id: 'vsl_played',    label: 'VSL Played',         value: 4446,  color: '#8b5cf6', col: 2, row: 0 },
      { id: 'engaged',       label: 'Engaged User',       value: 3890,  color: '#a78bfa', col: 2, row: 1 },
      // Col 3: Checkout
      { id: 'start_checkout',label: 'Started Checkout',   value: 3540,  color: '#c084fc', col: 3, row: 0 },
      { id: 'abandon_checkout',label:'Abandoned Checkout', value: 330,   color: '#ef4444', col: 3, row: 1 },
      { id: 'done_checkout', label: 'Completed Checkout',  value: 3210,  color: '#22c55e', col: 3, row: 2 },
      // Col 4: VIP Upsell
      { id: 'vip_tick',      label: 'VIP Checkbox',       value: 641,   color: '#facc15', col: 4, row: 0 },
      { id: 'vip_upsell',    label: 'VIP Upsell Page',    value: 2569,  color: '#fbbf24', col: 4, row: 1 },
      { id: 'vip_total',     label: 'Total VIP',          value: 912,   color: '#facc15', col: 4, row: 2 },
      // Col 5: Pre-Workshop
      { id: 'email_open',    label: 'Email Opened',       value: 2247,  color: '#38bdf8', col: 5, row: 0 },
      // Col 6: Workshop
      { id: 'attend',        label: 'Attended',           value: 1847,  color: '#22d3ee', col: 6, row: 0 },
      { id: 'watch_30',      label: 'Watched 30min',      value: 1588,  color: '#06b6d4', col: 6, row: 1 },
      { id: 'watch_full',    label: 'Watched Full',       value: 1145,  color: '#0891b2', col: 6, row: 2 },
      // Col 7: Booking
      { id: 'book',          label: 'Call Booked',        value: 592,   color: '#34d399', col: 7, row: 0 },
      { id: 'vip_email_book',label: 'VIP Email Book',     value: 87,    color: '#fbbf24', col: 7, row: 1 },
      { id: 'cancel',        label: 'Cancelled',          value: 64,    color: '#ef4444', col: 7, row: 2 },
      { id: 'reschedule',    label: 'Rescheduled',        value: 41,    color: '#f97316', col: 7, row: 3 },
      // Col 8: Enrollment
      { id: 'enroll_cod',    label: 'Enroll COD',         value: 52,    color: '#a855f7', col: 8, row: 0 },
      { id: 'enroll_ma',     label: 'Enroll MA',          value: 31,    color: '#ec4899', col: 8, row: 1 },
      { id: 'enroll_lp',     label: 'Enroll LP',          value: 14,    color: '#f43f5e', col: 8, row: 2 }
    ],
    links: [
      // Ads -> LP
      { from: 'ads',           to: 'clicks',         value: 6840 },
      // LP -> Bounce / VSL
      { from: 'clicks',        to: 'bounce',         value: 2394 },
      { from: 'clicks',        to: 'vsl_played',     value: 4446 },
      // VSL -> Engaged
      { from: 'vsl_played',    to: 'engaged',        value: 3890 },
      // Engaged -> Checkout
      { from: 'engaged',       to: 'start_checkout', value: 3540 },
      // Checkout split
      { from: 'start_checkout',to: 'abandon_checkout',value: 330 },
      { from: 'start_checkout',to: 'done_checkout',  value: 3210 },
      // Post-checkout -> VIP paths
      { from: 'done_checkout', to: 'vip_tick',       value: 641 },
      { from: 'done_checkout', to: 'vip_upsell',     value: 2569 },
      { from: 'vip_tick',      to: 'vip_total',      value: 641 },
      { from: 'vip_upsell',    to: 'vip_total',      value: 271 },
      // Pre-workshop email
      { from: 'done_checkout', to: 'email_open',     value: 2247 },
      // Workshop attendance
      { from: 'email_open',    to: 'attend',         value: 1847 },
      // Watch progression
      { from: 'attend',        to: 'watch_30',       value: 1588 },
      { from: 'watch_30',      to: 'watch_full',     value: 1145 },
      // Booking
      { from: 'watch_full',    to: 'book',           value: 592 },
      { from: 'vip_total',     to: 'vip_email_book', value: 87 },
      // Cancel / Reschedule from booked
      { from: 'book',          to: 'cancel',         value: 64 },
      { from: 'book',          to: 'reschedule',     value: 41 },
      // Enrollment
      { from: 'book',          to: 'enroll_cod',     value: 52 },
      { from: 'book',          to: 'enroll_ma',      value: 31 },
      { from: 'book',          to: 'enroll_lp',      value: 14 },
      { from: 'vip_email_book',to: 'enroll_cod',     value: 18 },
      { from: 'vip_email_book',to: 'enroll_ma',      value: 9 }
    ]
  },
  vip: {
    nodes: [
      { id: 'vip_total',     label: 'Total VIP',         value: 912,  color: '#facc15', col: 0, row: 0 },
      { id: 'email_open',    label: 'Email Opened',      value: 724,  color: '#38bdf8', col: 1, row: 0 },
      { id: 'attend',        label: 'VIP Attended',      value: 780,  color: '#22d3ee', col: 2, row: 0 },
      { id: 'watch_30',      label: 'Watched 30min',     value: 702,  color: '#06b6d4', col: 2, row: 1 },
      { id: 'watch_full',    label: 'Watched Full',      value: 648,  color: '#0891b2', col: 2, row: 2 },
      { id: 'book',          label: 'Call Booked',       value: 389,  color: '#34d399', col: 3, row: 0 },
      { id: 'vip_email_book',label: 'VIP Email Book',    value: 87,   color: '#fbbf24', col: 3, row: 1 },
      { id: 'cancel',        label: 'Cancelled',         value: 38,   color: '#ef4444', col: 3, row: 2 },
      { id: 'reschedule',    label: 'Rescheduled',       value: 22,   color: '#f97316', col: 3, row: 3 },
      { id: 'enroll_cod',    label: 'Enroll COD',        value: 38,   color: '#a855f7', col: 4, row: 0 },
      { id: 'enroll_ma',     label: 'Enroll MA',         value: 22,   color: '#ec4899', col: 4, row: 1 },
      { id: 'enroll_lp',     label: 'Enroll LP',         value: 11,   color: '#f43f5e', col: 4, row: 2 }
    ],
    links: [
      { from: 'vip_total',     to: 'email_open',     value: 724 },
      { from: 'vip_total',     to: 'attend',         value: 780 },
      { from: 'attend',        to: 'watch_30',       value: 702 },
      { from: 'watch_30',      to: 'watch_full',     value: 648 },
      { from: 'watch_full',    to: 'book',           value: 389 },
      { from: 'vip_total',     to: 'vip_email_book', value: 87 },
      { from: 'book',          to: 'cancel',         value: 38 },
      { from: 'book',          to: 'reschedule',     value: 22 },
      { from: 'book',          to: 'enroll_cod',     value: 38 },
      { from: 'book',          to: 'enroll_ma',      value: 22 },
      { from: 'book',          to: 'enroll_lp',      value: 11 },
      { from: 'vip_email_book',to: 'enroll_cod',     value: 18 },
      { from: 'vip_email_book',to: 'enroll_ma',      value: 9 }
    ]
  }
};

async function renderSankey() {
  // Try fetching real sankey data from BQ and patch node values
  try {
    var sk = await API.query('workshop', 'sankey', { days: currentDays });
    if (sk && sk.length > 0) {
      var s = sk[0];
      // Patch 'all' view node values
      var nm = {};
      SANKEY_DATA.all.nodes.forEach(function(n){ nm[n.id] = n; });
      if (nm.attend && s.attended) nm.attend.value = s.attended;
      if (nm.book && s.booked) nm.book.value = s.booked;
      if (nm.enroll_cod && s.enrolled) nm.enroll_cod.value = s.enrolled;
      if (nm.enroll_lp && s.enrolled_lp) nm.enroll_lp.value = s.enrolled_lp;
      if (nm.enroll_ma && s.enrolled_ma) nm.enroll_ma.value = s.enrolled_ma;
      if (nm.done_checkout && s.tickets) nm.done_checkout.value = s.tickets;
      if (nm.vip_total && s.vip) nm.vip_total.value = s.vip;
      if (nm.watch_30 && s.watched_most) nm.watch_30.value = s.watched_most;
      if (nm.watch_full && s.watched_full) nm.watch_full.value = s.watched_full;
      if (nm.cancel && s.no_show_call) nm.cancel.value = s.no_show_call;
      // Patch links where possible
      SANKEY_DATA.all.links.forEach(function(link) {
        if (link.to === 'attend' && link.from === 'email_open' && s.attended) link.value = s.attended;
        if (link.to === 'watch_30' && link.from === 'attend' && s.watched_most) link.value = s.watched_most;
        if (link.to === 'watch_full' && link.from === 'watch_30' && s.watched_full) link.value = s.watched_full;
        if (link.to === 'book' && link.from === 'watch_full' && s.booked) link.value = s.booked;
      });
      // Patch VIP view
      var vnm = {};
      SANKEY_DATA.vip.nodes.forEach(function(n){ vnm[n.id] = n; });
      if (vnm.vip_total && s.vip) vnm.vip_total.value = s.vip;
      if (vnm.attend && s.attended) vnm.attend.value = s.attended;
      if (vnm.book && s.booked) vnm.book.value = s.booked;
    }
  } catch(e) { /* keep mock sankey */ }

  var raw = SANKEY_DATA[activeSankeyView];
  var hideAds = document.getElementById('sankeyHideAdsCheck').checked && activeSankeyView === 'all';
  var compact = document.getElementById('sankeyCompactCheck').checked;

  // Build node map by id
  var nodeMap = {};
  raw.nodes.forEach(function(n) { nodeMap[n.id] = n; });

  // Filter nodes
  var nodes = raw.nodes.filter(function(n) {
    if (hideAds && n.id === 'ads') return false;
    // Compact mode: hide drop-off nodes
    if (compact && (n.id === 'bounce' || n.id === 'abandon_checkout' || n.id === 'cancel' || n.id === 'reschedule')) return false;
    return true;
  });

  // Filter links
  var nodeIds = {};
  nodes.forEach(function(n) { nodeIds[n.id] = true; });
  var links = raw.links.filter(function(l) {
    return nodeIds[l.from] && nodeIds[l.to];
  });

  // Drop-off node ids for styling
  var dropoffIds = { bounce: 1, abandon_checkout: 1, cancel: 1, reschedule: 1 };

  var container = document.getElementById('sankeyContainer');
  var W = Math.max(container.offsetWidth, 900);

  // Vertical layout: nodes arranged in rows, 3 tracks (left=dropoff, center=main, right=branch)
  // Group nodes by their col value
  var colGroups = {};
  var maxCol = 0;
  nodes.forEach(function(n) {
    var c = hideAds && n.col > 0 ? n.col - 1 : n.col;
    if (!colGroups[c]) colGroups[c] = [];
    colGroups[c].push(n);
    if (c > maxCol) maxCol = c;
  });

  // Layout params
  var nodeW = 140;
  var nodeH = 52;
  var smallW = 110;
  var smallH = 42;
  var rowGap = compact ? 56 : 64;
  var padX = 30;
  var padY = 20;
  var centerX = W / 2;

  // Position each node: center track for main path, left for dropoffs, right for branches
  var positions = {}; // id -> {x, y, w, h}
  var currentY = padY;
  var firstVal = nodes[0].value;

  // Process columns top to bottom
  for (var c = 0; c <= maxCol; c++) {
    var group = colGroups[c];
    if (!group) continue;

    // Separate main, dropoff, and branch nodes
    var main = [];
    var left = [];
    var right = [];
    group.forEach(function(n) {
      if (dropoffIds[n.id]) { left.push(n); }
      else if (n.row > 0 && !dropoffIds[n.id] && group.length > 1) { right.push(n); }
      else { main.push(n); }
    });

    // If all nodes are "main" but there are multiple, distribute them
    if (main.length > 1 && left.length === 0 && right.length === 0) {
      // Keep first as main, rest as right
      for (var mi = 1; mi < main.length; mi++) right.push(main[mi]);
      main = [main[0]];
    }

    var rowH = Math.max(
      main.length * (nodeH + 8),
      left.length * (smallH + 8),
      right.length * (smallH + 8)
    );

    // Place main nodes centered
    main.forEach(function(n, i) {
      var w = nodeW;
      var h = nodeH;
      positions[n.id] = {
        x: centerX - w / 2,
        y: currentY + i * (h + 8),
        w: w, h: h
      };
    });

    // Place dropoff nodes to the left
    left.forEach(function(n, i) {
      var w = smallW;
      var h = smallH;
      positions[n.id] = {
        x: centerX - nodeW / 2 - w - 60,
        y: currentY + i * (h + 8),
        w: w, h: h
      };
    });

    // Place branch nodes to the right
    right.forEach(function(n, i) {
      var w = smallW;
      var h = smallH;
      positions[n.id] = {
        x: centerX + nodeW / 2 + 60,
        y: currentY + i * (h + 8),
        w: w, h: h
      };
    });

    currentY += rowH + rowGap;
  }

  var H = currentY + padY;

  // Build SVG
  var svg = '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg"><defs>';

  // Gradients for links (vertical: y1=0, y2=1)
  links.forEach(function(link, i) {
    var fromNode = nodeMap[link.from];
    var toNode = nodeMap[link.to];
    svg += '<linearGradient id="skg' + i + '" x1="0" x2="0" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="' + fromNode.color + '" stop-opacity="0.55"/>' +
      '<stop offset="100%" stop-color="' + toNode.color + '" stop-opacity="0.55"/>' +
      '</linearGradient>';
  });

  // Glow filters
  nodes.forEach(function(node, idx) {
    svg += '<filter id="skglow' + idx + '" x="-25%" y="-25%" width="150%" height="150%">' +
      '<feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="' + node.color + '" flood-opacity="0.3"/></filter>';
  });
  svg += '</defs>';

  // Draw flow ribbons
  var maxVal = firstVal;
  var maxRibbon = 28;

  links.forEach(function(link, i) {
    var fp = positions[link.from];
    var tp = positions[link.to];
    if (!fp || !tp) return;

    var ribbonW = Math.max(3, (link.value / maxVal) * maxRibbon);
    var isDropoff = dropoffIds[link.to];

    // Source: bottom center of from node
    var x1 = fp.x + fp.w / 2;
    var y1 = fp.y + fp.h;
    // Target: top center of to node
    var x2 = tp.x + tp.w / 2;
    var y2 = tp.y;

    var dy = (y2 - y1);
    var cy1 = y1 + dy * 0.35;
    var cy2 = y1 + dy * 0.65;

    svg += '<path class="sankey-link' + (isDropoff ? ' is-dropoff' : '') + '" d="' +
      'M' + (x1 - ribbonW / 2) + ',' + y1 +
      ' C' + (x1 - ribbonW / 2) + ',' + cy1 + ' ' + (x2 - ribbonW / 2) + ',' + cy2 + ' ' + (x2 - ribbonW / 2) + ',' + y2 +
      ' L' + (x2 + ribbonW / 2) + ',' + y2 +
      ' C' + (x2 + ribbonW / 2) + ',' + cy2 + ' ' + (x1 + ribbonW / 2) + ',' + cy1 + ' ' + (x1 + ribbonW / 2) + ',' + y1 +
      ' Z" fill="url(#skg' + i + ')" />';
  });

  // Draw node cards
  nodes.forEach(function(node, idx) {
    var p = positions[node.id];
    if (!p) return;
    var isSmall = dropoffIds[node.id] || p.w < nodeW;
    var pct = (node.value / firstVal * 100);
    var pctStr = pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);

    svg += '<g class="sankey-node-card' + (dropoffIds[node.id] ? ' is-dropoff' : '') + '">';
    // Glow bg
    svg += '<rect class="node-bg" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + node.color + '" filter="url(#skglow' + idx + ')" opacity="0.15"/>';
    // Border
    svg += '<rect class="node-border" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="none" stroke="' + node.color + '" stroke-opacity="0.45" stroke-width="1.5"/>';
    // Value
    var valY = isSmall ? p.y + p.h * 0.45 : p.y + p.h * 0.4;
    svg += '<text class="node-value" x="' + (p.x + p.w / 2) + '" y="' + valY + '" text-anchor="middle">' + node.value.toLocaleString() + '</text>';
    // Label
    var lblY = isSmall ? p.y + p.h * 0.78 : p.y + p.h * 0.68;
    svg += '<text class="node-label" x="' + (p.x + p.w / 2) + '" y="' + lblY + '" text-anchor="middle">' + node.label + '</text>';
    // Pct
    if (node.id !== nodes[0].id) {
      var pctY = isSmall ? p.y + p.h * 0.95 : p.y + p.h * 0.9;
      svg += '<text class="node-pct" x="' + (p.x + p.w / 2) + '" y="' + pctY + '" text-anchor="middle">' + pctStr + '%</text>';
    }
    svg += '</g>';
  });

  svg += '</svg>';
  container.innerHTML = svg;

  // Wire toggles
  var toggle = document.getElementById('sankeyToggle');
  toggle.querySelectorAll('.completion-toggle__btn').forEach(function(btn) {
    btn.onclick = function() {
      toggle.querySelectorAll('.completion-toggle__btn').forEach(function(b) { b.classList.remove('completion-toggle__btn--active'); });
      this.classList.add('completion-toggle__btn--active');
      activeSankeyView = this.dataset.view;
      document.getElementById('sankeyHideAds').style.display = activeSankeyView === 'vip' ? 'none' : '';
      renderSankey();
    };
  });

  document.getElementById('sankeyHideAdsCheck').onchange = function() { renderSankey(); };
  document.getElementById('sankeyCompactCheck').onchange = function() { renderSankey(); };
}

// ---- Render All ----
// ---- Render: Sales Dynamic (Revenue + Ad Spend) ----
async function renderSalesDynamic() {
  var labels, ticketRev, enrollRev, metaSpend, googleSpend, youtubeSpend;

  // Try fetching real sales dynamic data from BQ
  var sd = null;
  try { sd = await API.query('workshop', 'salesDynamic', { days: currentDays }); } catch(e) {}

  if (sd && sd.length > 0) {
    labels = sd.map(function(r) { var d = new Date(r.dt); return (d.getMonth()+1) + '/' + d.getDate(); });
    ticketRev = sd.map(function(r) { return r.ticket_revenue || 0; });
    enrollRev = sd.map(function(r) { return r.enrollment_revenue || 0; });
    metaSpend = sd.map(function(r) { return r.meta_spend || 0; });
    googleSpend = sd.map(function() { return 0; }); // no BQ source yet
    youtubeSpend = sd.map(function() { return 0; }); // no BQ source yet
  } else {
    // Mock fallback
    labels = ['Apr 3', 'Apr 4', 'Apr 5', 'Apr 6', 'Apr 7', 'Apr 8', 'Apr 9'];
    ticketRev  = [2100, 3400, 4800, 5200, 7600, 9100, 11400];
    enrollRev  = [8500, 12000, 14200, 16800, 19500, 23000, 28500];
    metaSpend  = [1200, 1350, 1500, 1420, 1600, 1750, 1900];
    googleSpend = [400, 450, 520, 480, 550, 600, 680];
    youtubeSpend = [200, 250, 300, 280, 320, 380, 420];
  }

  var revCtx = document.getElementById('salesDynamicRevenueChart');
  var adCtx = document.getElementById('salesDynamicAdSpendChart');
  if (!revCtx || !adCtx) return;

  // Destroy existing chart instances before re-creating
  if (revCtx._chartInstance) revCtx._chartInstance.destroy();
  if (adCtx._chartInstance) adCtx._chartInstance.destroy();

  revCtx._chartInstance = new Chart(revCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Ticket Revenue', data: ticketRev, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#6366f1', tension: 0.3 },
        { label: 'Enrollment Revenue', data: enrollRev, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#22c55e', tension: 0.3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', callbacks: { label: function(ctx) { return ctx.dataset.label + ': $' + ctx.raw.toLocaleString(); } } } },
      scales: {
        x: { grid: { color: COLORS.gridLine }, ticks: { color: COLORS.textMuted, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: COLORS.gridLine }, ticks: { color: COLORS.textMuted, font: { size: 10 }, callback: function(v) { return '$' + (v >= 1000 ? Math.round(v/1000) + 'k' : v); } } },
      },
    },
  });

  adCtx._chartInstance = new Chart(adCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Meta Ads', data: metaSpend, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', fill: true, borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'Google Ads', data: googleSpend, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)', fill: true, borderWidth: 2, pointRadius: 2, tension: 0.3 },
        { label: 'YouTube', data: youtubeSpend, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.12)', fill: true, borderWidth: 2, pointRadius: 2, tension: 0.3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, position: 'bottom', labels: { color: COLORS.textMuted, font: { size: 10 }, boxWidth: 12, padding: 12 } }, tooltip: { mode: 'index', callbacks: { label: function(ctx) { return ctx.dataset.label + ': $' + ctx.raw.toLocaleString(); } } } },
      scales: {
        x: { grid: { color: COLORS.gridLine }, ticks: { color: COLORS.textMuted, font: { size: 10 } } },
        y: { beginAtZero: true, stacked: true, grid: { color: COLORS.gridLine }, ticks: { color: COLORS.textMuted, font: { size: 10 }, callback: function(v) { return '$' + (v >= 1000 ? Math.round(v/1000) + 'k' : v); } } },
      },
    },
  });
}

var currentDays = 30;

async function renderAll(days) {
  currentDays = days;
  var scaled = getScaledData(days);
  var cur = scaled.current;
  var prev = scaled.previous;

  // Fetch shared funnelDaily data from BQ
  var _funnelData = null;
  try { _funnelData = await API.query('workshop', 'funnelDaily', { days: days }); } catch(e) { _funnelData = null; }
  var currentRows = null, previousRows = null;
  if (_funnelData && _funnelData.length > 0) {
    currentRows = _funnelData.filter(function(r) { return r.period === 'current'; }).sort(function(a,b){ return a.dt < b.dt ? -1 : 1; });
    previousRows = _funnelData.filter(function(r) { return r.period === 'previous'; }).sort(function(a,b){ return a.dt < b.dt ? -1 : 1; });
  }

  renderYTD();
  renderKPICards(cur, prev, currentRows, previousRows);
  renderFunnelChart(days, currentRows, previousRows);

  // Slice daily data to match days
  var daily = MOCK_DATA.daily_show_rates.slice(-days);
  var prevDaily = MOCK_DATA.prev_daily_show_rates.slice(-days);
  await renderShowRateTrend(daily, prevDaily);

  await renderCompletionBreakdown(cur, prev);
  await renderHeatmap();
  await renderTicketHeatmap();
  await renderSalesDynamic();
  await renderSankey();
  await renderBookingTable(days);

  // Dispatch custom event
  document.dispatchEvent(new CustomEvent('dateRangeChanged', { detail: { days: days } }));
}

// ---- Wire shell Filters to page ----
// Sync Compare checkbox with shell's Compare state
if (typeof Filters !== 'undefined' && Filters.getCompare) {
  document.getElementById('compareToggle').checked = !!Filters.getCompare();
}

// Listen for shell filter changes (date presets, custom date picker)
if (typeof Filters !== 'undefined' && Filters.onChange) {
  Filters.onChange(function(state) {
    var days = state.days || 30;
    // Sync compare toggle from shell
    if (typeof Filters.getCompare === 'function') {
      document.getElementById('compareToggle').checked = !!Filters.getCompare();
    }
    renderAll(days);
  });
}

// Average group toggle (Off | Days | Weeks | Months)
var _avgMode = 'off';
document.getElementById('avgGroupToggle').querySelectorAll('button').forEach(function(btn) {
  btn.addEventListener('click', function() {
    _avgMode = btn.dataset.avg;
    document.getElementById('avgGroupToggle').querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.avg === _avgMode);
    });
    // Sync hidden checkbox for backward compat
    document.getElementById('averageToggle').checked = (_avgMode !== 'off');
    renderAll(currentDays);
  });
});

// Compare toggle (page-specific backup)
document.getElementById('compareToggle').addEventListener('change', function() {
  renderAll(currentDays);
});

// ---- Init with shell's current days ----
var initDays = (typeof Filters !== 'undefined' && Filters.getDays) ? Filters.getDays() : 30;
renderAll(initDays);

  })();

});
