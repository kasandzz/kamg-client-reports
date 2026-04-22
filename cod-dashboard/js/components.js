/* ============================================
   Components -- KPI cards, sparklines, drill-down, tables
   ============================================ */

const Components = (() => {
  let _drillDownOpen = false;

  /**
   * Render a strip of KPI cards into a container.
   * @param {string|HTMLElement} container - selector or element
   * @param {Array} kpis - array of KPI objects:
   *   { label, value, format ('money'|'pct'|'num'), delta, invertCost, sparkData, drillDown }
   */
  function renderKPIStrip(container, kpis) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    el.innerHTML = '';
    el.classList.add('kpi-grid');

    kpis.forEach((kpi, i) => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.style.animationDelay = `${i * 60}ms`;

      // Status-colored left border + top glow
      const deltaNum = kpi.delta != null ? (typeof kpi.delta === 'string' ? Theme.parseDelta(kpi.delta) : kpi.delta) : 0;
      const isPositive = kpi.invertCost ? deltaNum < 0 : deltaNum > 0;
      const isNegative = kpi.invertCost ? deltaNum > 0 : deltaNum < 0;
      const statusColor = isPositive ? Theme.COLORS.success : isNegative ? Theme.COLORS.danger : (Theme.COLORS.neutral || '#64748b');
      card.style.borderLeft = `3px solid ${statusColor}`;
      card.style.position = 'relative';
      card.style.overflow = 'hidden';

      if (kpi.drillDown) {
        card.classList.add('clickable');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.addEventListener('click', () => openDrillDown(kpi.label, kpi.drillDown));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDrillDown(kpi.label, kpi.drillDown);
          }
        });
      }

      // Formatted value
      const formattedValue = Theme.formatValue(kpi.value, kpi.format);

      // Delta + previous period comparison
      let deltaHTML = '';
      let prevHTML = '';
      if (kpi.delta != null) {
        const cls = Theme.deltaClass(deltaNum, kpi.invertCost);
        const arrow = deltaNum > 0 ? '&#9650;' : deltaNum < 0 ? '&#9660;' : '';
        const sign = deltaNum >= 0 ? '+' : '';
        const deltaStr = sign + deltaNum.toFixed(1) + '%';
        deltaHTML = `<span class="kpi-delta ${cls}">${arrow} ${deltaStr}</span>`;
      }
      if (kpi.prevValue != null) {
        const prevFormatted = Theme.formatValue(kpi.prevValue, kpi.format);
        const cls = kpi.delta != null ? Theme.deltaClass(deltaNum, kpi.invertCost) : 'neutral';
        prevHTML = `<div class="kpi-prev"><span class="kpi-prev-label">prev</span> <span class="kpi-prev-value ${cls}">${prevFormatted}</span></div>`;
      }

      // Traffic light dot
      const dotGlow = statusColor === Theme.COLORS.success ? '0 0 6px rgba(34,197,94,0.5)' : statusColor === Theme.COLORS.danger ? '0 0 6px rgba(239,68,68,0.5)' : 'none';
      const dotHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${statusColor};box-shadow:${dotGlow};flex-shrink:0"></span>`;

      // Sparkline canvas id
      const sparkId = `spark-${i}-${Date.now()}`;

      // Source + calc metadata (visible when "Show calculations" is toggled)
      let calcHTML = '';
      if (kpi.source || kpi.calc) {
        calcHTML = `<div class="kpi-calc-meta">`;
        if (kpi.source) calcHTML += `<div class="kpi-calc-row"><span class="kpi-calc-label">Source</span> ${_esc(kpi.source)}</div>`;
        if (kpi.calc) calcHTML += `<div class="kpi-calc-row"><span class="kpi-calc-label">Calc</span> ${_esc(kpi.calc)}</div>`;
        calcHTML += `</div>`;
      }

      card.innerHTML = `
        <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${statusColor}80,transparent)"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div class="kpi-label" style="margin-bottom:0">${_esc(kpi.label)}</div>
          ${dotHTML}
        </div>
        <div class="kpi-value-row">
          <span class="kpi-value">${formattedValue}</span>
          ${deltaHTML}
        </div>
        ${prevHTML}
        ${kpi.sparkData ? `<div class="kpi-spark-container"><canvas id="${sparkId}" width="80" height="24"></canvas></div>` : ''}
        ${calcHTML}
      `;

      el.appendChild(card);

      // Render sparkline after DOM insert
      if (kpi.sparkData && kpi.sparkData.length > 0) {
        requestAnimationFrame(() => renderSparkline(sparkId, kpi.sparkData));
      }
    });
  }

  /**
   * Render a mini sparkline chart (no axes, no labels).
   */
  function renderSparkline(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = 80;
    const h = 24;
    canvas.width = w * 2;  // retina
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(2, 2);

    if (!data || data.length < 2) return;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    // Determine color based on trend
    const trend = data[data.length - 1] - data[0];
    const color = trend >= 0 ? '#22c55e' : '#ef4444';

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    data.forEach((val, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = padding + (1 - (val - min) / range) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color.replace(')', ',0.15)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, 'transparent');

    ctx.lineTo(padding + w - padding * 2, h);
    ctx.lineTo(padding, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Open drill-down panel with title and a fetch function.
   * @param {string} title
   * @param {Function} fetchFn - async function that returns { rows, columns } or HTML string
   */
  async function openDrillDown(title, fetchFn) {
    const panel = document.getElementById('drill-down-panel');
    const titleEl = document.getElementById('drill-down-title');
    const content = document.getElementById('drill-down-content');

    if (!panel) return;

    titleEl.textContent = title;
    content.innerHTML = '<div class="page-placeholder"><div class="spinner"></div></div>';
    panel.hidden = false;

    // Trigger open transition
    requestAnimationFrame(() => {
      panel.classList.add('open');
    });
    _drillDownOpen = true;

    try {
      const result = await fetchFn();
      if (typeof result === 'string') {
        content.innerHTML = result;
      } else if (result && result.rows) {
        content.innerHTML = renderTable(result.rows, result);
      } else {
        content.innerHTML = '<div class="empty-state"><span class="empty-state-icon">&#128203;</span><p>No data available</p></div>';
      }
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><span class="empty-state-icon">&#9888;&#65039;</span><p>Error loading data</p></div>`;
      console.warn('[Components] drill-down error:', err);
    }
  }

  function closeDrillDown() {
    const panel = document.getElementById('drill-down-panel');
    if (!panel) return;
    panel.classList.remove('open');
    _drillDownOpen = false;
    setTimeout(() => { panel.hidden = true; }, 300);
  }

  function isDrillDownOpen() {
    return _drillDownOpen;
  }

  /**
   * Render an HTML table from rows.
   * Auto-detects money/pct columns by header name.
   * @param {Array<Object>} rows
   * @param {Object} options - { columns, limit }
   *   columns: [{ key, label, format }] -- if omitted, auto from first row
   *   limit: max rows to render
   * @returns {string} HTML string
   */
  function renderTable(rows, options = {}) {
    if (!rows || rows.length === 0) {
      return '<div class="empty-state"><span class="empty-state-icon">&#128203;</span><p>No data</p></div>';
    }

    let columns = options.columns;
    if (!columns) {
      // Auto-detect from first row
      columns = Object.keys(rows[0]).map(key => ({
        key,
        label: _titleCase(key),
        format: _guessFormat(key),
      }));
    }

    const limit = options.limit || 100;
    const displayRows = rows.slice(0, limit);

    let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr>';
    columns.forEach(col => {
      const isNum = col.format === 'money' || col.format === 'pct' || col.format === 'num';
      html += `<th${isNum ? ' class="num"' : ''}>${_esc(col.label)}</th>`;
    });
    html += '</tr></thead><tbody>';

    displayRows.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        const val = row[col.key];
        const isNum = col.format === 'money' || col.format === 'pct' || col.format === 'num';
        const formatted = col.format ? Theme.formatValue(val, col.format) : _esc(String(val ?? ''));
        html += `<td${isNum ? ' class="num"' : ''}>${formatted}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';

    if (rows.length > limit) {
      html += `<p class="text-muted" style="font-size:12px;margin-top:8px">Showing ${limit} of ${rows.length} rows</p>`;
    }

    return html;
  }

  // ---- Helpers ----
  function _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _titleCase(str) {
    return str
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  function _guessFormat(key) {
    const k = key.toLowerCase();
    if (k.includes('revenue') || k.includes('cost') || k.includes('spend') || k.includes('ltv') || k.includes('aov') || k.includes('cpa') || k.includes('cac') || k.includes('price') || k.includes('amount') || k.includes('roas')) return 'money';
    if (k.includes('rate') || k.includes('pct') || k.includes('percent') || k.includes('conversion') || k.includes('ratio')) return 'pct';
    if (k.includes('count') || k.includes('total') || k.includes('num') || k.includes('calls') || k.includes('leads') || k.includes('tickets')) return 'num';
    return null;
  }

  // ---- Init drill-down close button ----
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('drill-down-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDrillDown);
  });

  /**
   * Stamp a card element with a "last synced" tooltip.
   * Shows on hover in top-right corner.
   * @param {HTMLElement} card - the .card element
   * @param {string} page - API page name
   * @param {string|string[]} queries - query name(s) used by this card
   */
  function stampSyncTime(card, page, queries) {
    if (!card) return;
    const qList = Array.isArray(queries) ? queries : [queries];

    // Create the dot indicator
    const dot = document.createElement('div');
    dot.className = 'sync-stamp';
    dot.setAttribute('aria-label', 'Data freshness');
    card.style.position = 'relative';
    card.appendChild(dot);

    // Update on hover using actual BQ table last-modified time
    card.addEventListener('mouseenter', async () => {
      const ts = await API.getPageFreshness(page);
      if (ts) {
        const d = new Date(ts);
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const day = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const ageMs = Date.now() - ts;
        const ageH = ageMs / (1000 * 60 * 60);
        dot.classList.remove('sync-stamp--fresh', 'sync-stamp--warn', 'sync-stamp--stale');
        if (ageH < 1) dot.classList.add('sync-stamp--fresh');
        else if (ageH < 6) dot.classList.add('sync-stamp--warn');
        else dot.classList.add('sync-stamp--stale');
        dot.setAttribute('data-tooltip', `Data as of ${day} ${time}`);
      } else {
        dot.setAttribute('data-tooltip', 'Freshness unknown');
      }
    });
  }

  // ---- Compare period helpers ----

  /**
   * Split a doubled-period result set into current vs previous halves.
   * Pass the rows returned from a query with days*2, and the original days count.
   * @param {Array} rows
   * @param {number} days - original period length (not doubled)
   * @param {string} [dateField='dt'] - field name holding the ISO date string
   * @returns {{ current: Array, previous: Array }}
   */
  function splitPeriods(rows, days, dateField) {
    dateField = dateField || 'dt';
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    return {
      current:  rows.filter(r => (r[dateField] || '') >= cutoffStr),
      previous: rows.filter(r => (r[dateField] || '') < cutoffStr),
    };
  }

  /**
   * Push a dashed "previous period" overlay line onto an existing Chart.js config.
   * Call before Chart creation -- mutates chartConfig.data.datasets in place.
   * @param {Object} chartConfig - Chart.js config object
   * @param {Array}  prevData    - y-values for the previous period (same length as current labels)
   * @param {string} label       - base dataset label (will have " (prev)" appended)
   * @param {string} color       - CSS colour string for the dashed line
   * @param {string} [yAxisID]   - optional yAxisID to match the target axis
   */
  function addCompareDataset(chartConfig, prevData, label, color, yAxisID) {
    if (!prevData || prevData.length === 0) return;
    var ds = {
      label:       label + ' (prev)',
      data:        prevData,
      type:        'line',
      borderColor: color,
      borderDash:  [5, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      tension:     0.3,
      fill:        false,
      order:       0,
    };
    if (yAxisID) ds.yAxisID = yAxisID;
    chartConfig.data.datasets.push(ds);
  }

  // ---- Staleness Banner ----

  /**
   * Compute a relative time string from an ISO date/timestamp.
   * @param {string|Date} isoString
   * @returns {string} e.g. "3 days ago", "2 hours ago"
   */
  function _relativeTime(isoString) {
    const then = new Date(isoString);
    const now = new Date();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return diffMin + ' minute' + (diffMin === 1 ? '' : 's') + ' ago';
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return diffH + ' hour' + (diffH === 1 ? '' : 's') + ' ago';
    const diffD = Math.floor(diffH / 24);
    return diffD + ' day' + (diffD === 1 ? '' : 's') + ' ago';
  }

  /**
   * Render a staleness banner for a data source.
   * Sticky amber banner indicating data freshness issues.
   * Dismissible per session (sessionStorage).
   *
   * @param {string} source - Data source name (e.g. "Meta Ads")
   * @param {string|Date} lastSync - ISO string or Date of last sync
   * @returns {HTMLElement|null} Banner div, or null if dismissed this session
   */
  function renderStaleBanner(source, lastSync) {
    const storageKey = 'stale-dismissed-' + source.replace(/\s+/g, '-').toLowerCase();

    // If dismissed this session, return null
    if (sessionStorage.getItem(storageKey)) return null;

    const banner = document.createElement('div');
    banner.className = 'stale-banner';
    banner.style.cssText = [
      'position:sticky',
      'top:0',
      'z-index:100',
      'background:rgba(245,158,11,0.12)',
      'color:#f1f5f9',
      'border-left:3px solid #f59e0b',
      'padding:10px 16px',
      'margin-bottom:12px',
      'border-radius:6px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:12px',
      'font-size:13px',
    ].join(';');

    const relTime = _relativeTime(lastSync);

    const msgSpan = document.createElement('span');
    msgSpan.innerHTML = '<span style="color:#f59e0b;font-weight:600">' + _esc(source) + '</span> data paused &mdash; last sync ' + _esc(relTime);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00D7';
    closeBtn.setAttribute('aria-label', 'Dismiss staleness banner');
    closeBtn.style.cssText = [
      'background:none',
      'border:none',
      'color:#f59e0b',
      'font-size:18px',
      'cursor:pointer',
      'padding:0 4px',
      'line-height:1',
      'flex-shrink:0',
    ].join(';');
    closeBtn.addEventListener('click', function () {
      banner.style.display = 'none';
      sessionStorage.setItem(storageKey, '1');
    });

    banner.appendChild(msgSpan);
    banner.appendChild(closeBtn);

    return banner;
  }

  // ---- Sankey CSS (lazy-injected once) ----

  function _injectSankeyCSS() {
    if (document.getElementById('sankey-component-css')) return;
    var style = document.createElement('style');
    style.id = 'sankey-component-css';
    style.textContent = [
      '.sankey-node-card { cursor: default; }',
      '.sankey-node-card .node-bg { rx: 10; ry: 10; }',
      '.sankey-node-card .node-border { rx: 10; ry: 10; }',
      '.sankey-node-card .node-value { font-family: var(--font-mono); font-size: 14px; font-weight: 700; fill: #fff; }',
      '.sankey-node-card .node-label { font-family: var(--font-body); font-size: 9px; font-weight: 500; fill: rgba(255,255,255,0.7); }',
      '.sankey-node-card .node-pct { font-family: var(--font-mono); font-size: 8px; font-weight: 600; fill: rgba(255,255,255,0.45); }',
      '.sankey-node-card.is-dropoff .node-value { font-size: 12px; }',
      '.sankey-node-card.is-dropoff .node-label { font-size: 8px; }',
      '.sankey-link { opacity: 0.25; transition: opacity 0.2s; }',
      '.sankey-link:hover { opacity: 0.5; }',
      '.sankey-link.is-dropoff { opacity: 0.15; }',
      '.sankey-link.is-dropoff:hover { opacity: 0.35; }',
      '.sankey-leak-label { font-family: var(--font-mono); font-size: 8px; font-weight: 600; fill: #ef4444; fill-opacity: 0.7; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ---- Sankey Renderer ----

  /**
   * Render a Sankey flow diagram into a container.
   * Reusable across $27 Funnel, MA/VSL Funnel, or any column-based flow.
   *
   * @param {Object} config
   * @param {HTMLElement|string} config.container - Target element or CSS selector
   * @param {Array} config.nodes - Array of { id, label, value, color, col, row }
   * @param {Array} config.links - Array of { from, to, value }
   * @param {Object} [config.options] - Optional overrides
   * @param {boolean} [config.options.compact] - Compact mode: hide dropoff nodes
   * @param {string[]} [config.options.dropoffIds] - Node IDs considered drop-offs (styled red, smaller)
   * @param {string[]} [config.options.hideNodeIds] - Node IDs to hide entirely (e.g. 'ads' when toggled off)
   * @param {Object} [config.options.leakAnnotations] - Map of node ID -> { dollars, label } for dollar-leak text
   * @param {number} [config.options.minWidth] - Minimum SVG width (default 900)
   * @param {number} [config.options.nodeW] - Main node width (default 140)
   * @param {number} [config.options.nodeH] - Main node height (default 52)
   * @param {number} [config.options.smallW] - Small (dropoff/branch) node width (default 110)
   * @param {number} [config.options.smallH] - Small (dropoff/branch) node height (default 42)
   * @param {number} [config.options.rowGap] - Gap between column rows (default 64, 56 in compact)
   */
  function renderSankey(config) {
    _injectSankeyCSS();

    var el = typeof config.container === 'string'
      ? document.querySelector(config.container)
      : config.container;
    if (!el) return;

    var opts = config.options || {};
    var compact = !!opts.compact;
    var dropoffSet = {};
    (opts.dropoffIds || []).forEach(function(id) { dropoffSet[id] = true; });
    var hideSet = {};
    (opts.hideNodeIds || []).forEach(function(id) { hideSet[id] = true; });
    var leakAnnotations = opts.leakAnnotations || {};
    var minWidth = opts.minWidth || 900;

    var nodeW = opts.nodeW || 140;
    var nodeH = opts.nodeH || 52;
    var smallW = opts.smallW || 110;
    var smallH = opts.smallH || 42;
    var rowGap = compact ? (opts.rowGap ? opts.rowGap - 8 : 56) : (opts.rowGap || 64);
    var padX = 30;
    var padY = 20;

    // Build node map
    var nodeMap = {};
    config.nodes.forEach(function(n) { nodeMap[n.id] = n; });

    // Filter nodes: remove hidden and (if compact) dropoff nodes
    var nodes = config.nodes.filter(function(n) {
      if (hideSet[n.id]) return false;
      if (compact && dropoffSet[n.id]) return false;
      return true;
    });

    // Filter links to only include visible node pairs
    var visibleIds = {};
    nodes.forEach(function(n) { visibleIds[n.id] = true; });
    var links = config.links.filter(function(l) {
      return visibleIds[l.from] && visibleIds[l.to];
    });

    // Determine if any hidden node shifts column indices
    var hasHidden = Object.keys(hideSet).length > 0;

    var W = Math.max(el.offsetWidth, minWidth);
    var centerX = W / 2;

    // Group nodes by column
    var colGroups = {};
    var maxCol = 0;
    nodes.forEach(function(n) {
      // Shift columns left if a lower column is entirely hidden
      var c = n.col;
      if (hasHidden) {
        // Count how many distinct cols below this one are entirely hidden
        var shift = 0;
        for (var ci = 0; ci < c; ci++) {
          var anyVisible = config.nodes.some(function(nn) { return nn.col === ci && !hideSet[nn.id] && !(compact && dropoffSet[nn.id]); });
          if (!anyVisible) shift++;
        }
        c = c - shift;
      }
      if (!colGroups[c]) colGroups[c] = [];
      colGroups[c].push(n);
      if (c > maxCol) maxCol = c;
    });

    // Position nodes
    var positions = {};
    var currentY = padY;
    var firstVal = nodes.length > 0 ? nodes[0].value : 1;

    for (var c = 0; c <= maxCol; c++) {
      var group = colGroups[c];
      if (!group) continue;

      var main = [];
      var left = [];
      var right = [];
      group.forEach(function(n) {
        if (dropoffSet[n.id]) { left.push(n); }
        else if (n.row > 0 && !dropoffSet[n.id] && group.length > 1) { right.push(n); }
        else { main.push(n); }
      });

      if (main.length > 1 && left.length === 0 && right.length === 0) {
        for (var mi = 1; mi < main.length; mi++) right.push(main[mi]);
        main = [main[0]];
      }

      var rowH = Math.max(
        main.length * (nodeH + 8),
        left.length * (smallH + 8),
        right.length * (smallH + 8)
      );

      main.forEach(function(n, i) {
        positions[n.id] = { x: centerX - nodeW / 2, y: currentY + i * (nodeH + 8), w: nodeW, h: nodeH };
      });

      left.forEach(function(n, i) {
        positions[n.id] = { x: centerX - nodeW / 2 - smallW - 60, y: currentY + i * (smallH + 8), w: smallW, h: smallH };
      });

      right.forEach(function(n, i) {
        positions[n.id] = { x: centerX + nodeW / 2 + 60, y: currentY + i * (smallH + 8), w: smallW, h: smallH };
      });

      currentY += rowH + rowGap;
    }

    var H = currentY + padY;

    // Build SVG
    var svg = '<svg width="' + W + '" height="' + H + '" xmlns="http://www.w3.org/2000/svg"><defs>';

    // Gradients for links
    links.forEach(function(link, i) {
      var fromNode = nodeMap[link.from];
      var toNode = nodeMap[link.to];
      if (!fromNode || !toNode) return;
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
      var isDropoff = dropoffSet[link.to];

      var x1 = fp.x + fp.w / 2;
      var y1 = fp.y + fp.h;
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
      var isSmall = dropoffSet[node.id] || p.w < nodeW;
      var pct = (node.value / firstVal * 100);
      var pctStr = pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);

      svg += '<g class="sankey-node-card' + (dropoffSet[node.id] ? ' is-dropoff' : '') + '">';
      svg += '<rect class="node-bg" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + node.color + '" filter="url(#skglow' + idx + ')" opacity="0.15"/>';
      svg += '<rect class="node-border" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="none" stroke="' + node.color + '" stroke-opacity="0.45" stroke-width="1.5"/>';

      var valY = isSmall ? p.y + p.h * 0.45 : p.y + p.h * 0.4;
      svg += '<text class="node-value" x="' + (p.x + p.w / 2) + '" y="' + valY + '" text-anchor="middle">' + node.value.toLocaleString() + '</text>';

      var lblY = isSmall ? p.y + p.h * 0.78 : p.y + p.h * 0.68;
      svg += '<text class="node-label" x="' + (p.x + p.w / 2) + '" y="' + lblY + '" text-anchor="middle">' + node.label + '</text>';

      if (node.id !== nodes[0].id) {
        var pctY = isSmall ? p.y + p.h * 0.95 : p.y + p.h * 0.9;
        svg += '<text class="node-pct" x="' + (p.x + p.w / 2) + '" y="' + pctY + '" text-anchor="middle">' + pctStr + '%</text>';
      }

      svg += '</g>';

      // Leak annotation (dollar-value label below dropoff nodes)
      if (leakAnnotations[node.id]) {
        var ann = leakAnnotations[node.id];
        var dollarStr = typeof ann.dollars === 'number'
          ? '$' + (ann.dollars >= 1000 ? Math.round(ann.dollars / 1000) + 'K' : ann.dollars.toLocaleString())
          : ann.dollars;
        var leakY = p.y + p.h + 13;
        svg += '<text class="sankey-leak-label" x="' + (p.x + p.w / 2) + '" y="' + leakY + '" text-anchor="middle">' +
          dollarStr + ' lost to ' + (ann.label || node.label) + '</text>';
      }
    });

    svg += '</svg>';
    el.innerHTML = svg;
  }

  return {
    renderKPIStrip,
    renderSparkline,
    openDrillDown,
    closeDrillDown,
    isDrillDownOpen,
    renderTable,
    stampSyncTime,
    splitPeriods,
    addCompareDataset,
    renderStaleBanner,
    renderSankey,
  };
})();
