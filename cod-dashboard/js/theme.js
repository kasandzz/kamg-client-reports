/* ============================================
   Theme -- Chart.js/Plotly defaults, format helpers
   Anti-pattern #1: hardcoded hex, NOT CSS vars
   Anti-pattern #3: destroy before re-create
   Anti-pattern #4: invert for cost metrics
   ============================================ */

const Theme = (() => {
  // ---- Design system colors (hardcoded for canvas) ----
  // Matched to cod-workshop-performance.html style guide
  const COLORS = {
    bgPage:        '#08080d',
    bgCard:        '#0f1117',
    bgCardHover:   '#161822',
    bgElevated:    '#1a1c28',
    border:        'rgba(255,255,255,0.06)',
    borderHover:   'rgba(255,255,255,0.12)',
    borderAccent:  'rgba(124,58,237,0.3)',
    textPrimary:   '#f1f5f9',
    textSecondary: '#7c8da4',
    textMuted:     '#475569',
    textDisabled:  '#334155',
    success:       '#22c55e',
    danger:        '#ef4444',
    accent:        '#7c3aed',
    accentPrimary: '#7c3aed',
    accentLight:   '#a78bfa',
    accentGhost:   'rgba(124,58,237,0.08)',
    accentGlow:    'rgba(124,58,237,0.15)',
    accentCyan:    '#22d3ee',
    accentGold:    '#facc15',
    warning:       '#f59e0b',
    neutral:       '#64748b',
    gridLine:      'rgba(255,255,255,0.04)',
    tooltipBg:     'rgba(8,8,13,0.85)',
  };

  // 8-color funnel palette
  const FUNNEL = {
    blue:   '#3b82f6',
    cyan:   '#06b6d4',
    teal:   '#14b8a6',
    green:  '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red:    '#ef4444',
    purple: '#a855f7',
  };
  const FUNNEL_ARRAY = Object.values(FUNNEL);

  // 12-stage journey colors
  const STAGE_COLORS = [
    '#4F9CF9', '#6E56CF', '#00C7BE', '#FFB224', '#30A46C', '#E5484D',
    '#FF6369', '#0091FF', '#52A9FF', '#3E9B4F', '#F76B15', '#9B8EF7',
  ];

  // ---- Chart instance tracking (anti-pattern #3) ----
  const _charts = new Map();

  /**
   * Create a Chart.js chart, destroying any previous instance on same canvas.
   */
  function createChart(canvasId, config) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn(`[Theme] canvas #${canvasId} not found`);
      return null;
    }

    // Chart.js responsive mode sizes from the DIRECT PARENT, not the canvas.
    // Wrap canvas in a height-constrained div so charts don't grow infinitely.
    let parent = canvas.parentElement;
    if (!parent.classList.contains('cjs-wrap')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'cjs-wrap';
      wrapper.style.position = 'relative';
      wrapper.style.height = canvas.style.height || '300px';
      wrapper.style.width = '100%';
      parent.insertBefore(wrapper, canvas);
      wrapper.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, config);
    _charts.set(canvasId, chart);
    return chart;
  }

  function destroyChart(canvasId) {
    const existing = _charts.get(canvasId);
    if (existing) {
      existing.destroy();
      _charts.delete(canvasId);
    }
  }

  function destroyAllCharts() {
    for (const [id, chart] of _charts) {
      chart.destroy();
    }
    _charts.clear();
  }

  // ---- Chart.js global defaults ----
  function _initChartDefaults() {
    if (typeof Chart === 'undefined') return;

    Chart.defaults.color = COLORS.textSecondary;
    Chart.defaults.borderColor = COLORS.gridLine;
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;

    Chart.defaults.plugins.legend.labels.color = COLORS.textSecondary;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 16;

    Chart.defaults.plugins.tooltip.backgroundColor = COLORS.tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor = COLORS.textPrimary;
    Chart.defaults.plugins.tooltip.bodyColor = COLORS.textSecondary;
    Chart.defaults.plugins.tooltip.borderColor = COLORS.border;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 4;

    Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
    Chart.defaults.scale.grid.color = COLORS.gridLine;
    Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
    Chart.defaults.scale.ticks.color = COLORS.textMuted;
  }

  // ---- Plotly layout template ----
  const PLOTLY_LAYOUT = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      family: 'Inter, sans-serif',
      size: 12,
      color: COLORS.textSecondary,
    },
    xaxis: {
      gridcolor: COLORS.gridLine,
      linecolor: COLORS.gridLine,
      zerolinecolor: COLORS.gridLine,
      tickfont: { color: COLORS.textMuted, size: 11 },
    },
    yaxis: {
      gridcolor: COLORS.gridLine,
      linecolor: COLORS.gridLine,
      zerolinecolor: COLORS.gridLine,
      tickfont: { color: COLORS.textMuted, size: 11 },
    },
    hoverlabel: {
      bgcolor: COLORS.tooltipBg,
      bordercolor: COLORS.border,
      font: { family: 'Inter, sans-serif', size: 12, color: COLORS.textPrimary },
    },
    margin: { t: 30, r: 20, b: 40, l: 50 },
    showlegend: true,
    legend: {
      font: { color: COLORS.textSecondary, size: 11 },
      bgcolor: 'transparent',
    },
  };

  const PLOTLY_CONFIG = { displayModeBar: false, responsive: true };

  // ---- Format helpers ----

  /**
   * Format money: $1.2M, $45.3K, $123
   */
  function money(n) {
    if (n == null || isNaN(n)) return '$0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
    return sign + '$' + Math.round(abs).toLocaleString();
  }

  /**
   * Format percentage
   */
  function pct(n) {
    if (n == null || isNaN(n)) return '0%';
    return n.toFixed(1) + '%';
  }

  /**
   * Format number with commas
   */
  function num(n) {
    if (n == null || isNaN(n)) return '0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 10_000) return sign + (abs / 1_000).toFixed(1) + 'K';
    return sign + Math.round(abs).toLocaleString();
  }

  /**
   * Calculate delta string: "+12.3%" or "-5.1%"
   */
  function delta(current, prior) {
    if (!prior || prior === 0) return null;
    const change = ((current - prior) / Math.abs(prior)) * 100;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(1) + '%';
  }

  /**
   * Get CSS class for delta direction.
   * Anti-pattern #4: invertForCost flips red/green.
   */
  function deltaClass(change, invertForCost = false) {
    if (change == null || change === 0) return 'neutral';
    const isPositive = change > 0;
    if (invertForCost) {
      return isPositive ? 'negative' : 'positive';
    }
    return isPositive ? 'positive' : 'negative';
  }

  /**
   * Parse a delta string like "+12.3%" to a number.
   */
  function parseDelta(deltaStr) {
    if (!deltaStr) return 0;
    return parseFloat(deltaStr.replace('%', ''));
  }

  /**
   * Format a value by type.
   */
  function formatValue(val, format) {
    switch (format) {
      case 'money': return money(val);
      case 'pct':   return pct(val);
      case 'num':   return num(val);
      default:      return String(val);
    }
  }

  // Init Chart.js defaults when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initChartDefaults);
  } else {
    _initChartDefaults();
  }

  return {
    COLORS,
    FUNNEL,
    FUNNEL_ARRAY,
    STAGE_COLORS,
    PLOTLY_LAYOUT,
    PLOTLY_CONFIG,
    createChart,
    destroyChart,
    destroyAllCharts,
    money,
    pct,
    num,
    delta,
    deltaClass,
    parseDelta,
    formatValue,
  };
})();
