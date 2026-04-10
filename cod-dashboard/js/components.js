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

  return {
    renderKPIStrip,
    renderSparkline,
    openDrillDown,
    closeDrillDown,
    isDrillDownOpen,
    renderTable,
    stampSyncTime,
  };
})();
