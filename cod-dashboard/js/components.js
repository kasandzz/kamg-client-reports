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

      // Delta
      let deltaHTML = '';
      if (kpi.delta != null) {
        const deltaNum = typeof kpi.delta === 'string' ? Theme.parseDelta(kpi.delta) : kpi.delta;
        const cls = Theme.deltaClass(deltaNum, kpi.invertCost);
        const arrow = deltaNum > 0 ? '&#9650;' : deltaNum < 0 ? '&#9660;' : '';
        const deltaStr = typeof kpi.delta === 'string' ? kpi.delta : Theme.delta(kpi.value, kpi.value / (1 + deltaNum / 100));
        deltaHTML = `<span class="kpi-delta ${cls}">${arrow} ${deltaStr || ''}</span>`;
      }

      // Sparkline canvas id
      const sparkId = `spark-${i}-${Date.now()}`;

      card.innerHTML = `
        <div class="kpi-label">${_esc(kpi.label)}</div>
        <div class="kpi-value-row">
          <span class="kpi-value">${formattedValue}</span>
          ${deltaHTML}
        </div>
        ${kpi.sparkData ? `<div class="kpi-spark-container"><canvas id="${sparkId}" width="80" height="24"></canvas></div>` : ''}
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

  return {
    renderKPIStrip,
    renderSparkline,
    openDrillDown,
    closeDrillDown,
    isDrillDownOpen,
    renderTable,
  };
})();
