/* ============================================
   Landing Pages -- PostHog page analytics
   KPI strip, per-URL bar chart, sortable table
   ============================================ */

App.registerPage('landing-pages', async (container) => {
  const days = Filters.getDays();
  let summaryData, pageData;

  try {
    const [summaryRows, rows] = await Promise.all([
      API.query('landing-pages', 'summary', { days }),
      API.query('landing-pages', 'default', { days }),
    ]);
    summaryData = (Array.isArray(summaryRows) && summaryRows.length > 0) ? summaryRows[0] : {};
    pageData = Array.isArray(rows) ? rows : [];
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:24px"><p class="text-muted">Failed to load Landing Pages: ${err.message}</p></div>`;
    return;
  }

  container.innerHTML = '';

  // ---- Sparse data detection ----
  const isSparse = !summaryData.total_pageviews || summaryData.total_pageviews < 10;

  // ---- Data Gap Notice ----
  if (isSparse) {
    const noticeCard = _lpCard(null);
    noticeCard.style.marginBottom = '16px';
    noticeCard.style.borderColor = Theme.COLORS.warning;
    noticeCard.style.background = Theme.COLORS.warning + '10';
    noticeCard.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:22px;line-height:1">&#9888;</div>
        <div>
          <div style="font-size:14px;font-weight:600;color:${Theme.COLORS.warning};margin-bottom:6px">PostHog tracking is being set up. Limited data available.</div>
          <div style="font-size:12px;color:${Theme.COLORS.textSecondary};margin-bottom:10px">Once posthog.identify() is fully deployed, this page will show:</div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:${Theme.COLORS.textMuted};line-height:1.8">
            <li>Per-URL conversion rates</li>
            <li>Scroll depth analysis</li>
            <li>Form abandonment funnels</li>
            <li>Rage click heatmaps</li>
          </ul>
        </div>
      </div>
    `;
    container.appendChild(noticeCard);
  }

  // ---- KPI Strip ----
  const kpiContainer = document.createElement('div');
  container.appendChild(kpiContainer);

  Components.renderKPIStrip(kpiContainer, [
    { label: 'Total Pageviews',  value: summaryData.total_pageviews  || 0, format: 'num' },
    { label: 'Unique Visitors',  value: summaryData.unique_visitors  || 0, format: 'num' },
    { label: 'Pages Tracked',    value: summaryData.pages_tracked    || 0, format: 'num' },
    { label: 'Rage Clicks',      value: summaryData.rage_clicks      || 0, format: 'num', invertCost: summaryData.rage_clicks > 0 },
    { label: 'Avg Scroll Depth', value: (summaryData.avg_scroll_depth || 0) / 100, format: 'pct' },
  ]);

  if (pageData.length === 0) {
    const emptyCard = _lpCard('Per-URL Pageviews');
    emptyCard.style.marginTop = '16px';
    const msg = document.createElement('div');
    msg.className = 'text-muted';
    msg.style.cssText = 'padding:32px 0;text-align:center;font-size:13px';
    msg.textContent = 'No pageview events found for this period.';
    emptyCard.appendChild(msg);
    container.appendChild(emptyCard);
    return;
  }

  // ---- Chart: Per-URL Pageviews (horizontal bar, full width) ----
  const barCard = _lpCard('Per-URL Pageviews');
  barCard.style.marginTop = '16px';
  const barDiv = document.createElement('div');
  barDiv.id = 'lp-bar-chart';
  barCard.appendChild(barDiv);
  container.appendChild(barCard);

  requestAnimationFrame(() => {
    _renderPageviewsBar(barDiv, pageData);
  });

  // ---- Table: Page Performance ----
  const tableCard = _lpCard('Page Performance');
  tableCard.style.marginTop = '16px';
  tableCard.appendChild(_renderPageTable(pageData));
  container.appendChild(tableCard);
});

// ---- Helpers ----

function _lpCard(title) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '16px 20px';
  if (title) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:13px;font-weight:600;color:' + Theme.COLORS.textSecondary + ';margin-bottom:12px';
    h.textContent = title;
    card.appendChild(h);
  }
  return card;
}

function _truncateUrl(url) {
  if (!url) return '(unknown)';
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    if (parts.length === 0) return u.hostname;
    return '/' + parts[parts.length - 1];
  } catch (_) {
    return url.length > 40 ? url.slice(-40) : url;
  }
}

function _renderPageviewsBar(el, rows) {
  if (typeof Plotly === 'undefined') return;

  const labels = rows.map(r => _truncateUrl(r.page_url));
  const values = rows.map(r => r.pageviews || 0);
  const colors = rows.map((_, i) => Theme.FUNNEL_ARRAY[i % Theme.FUNNEL_ARRAY.length]);

  const trace = {
    type: 'bar',
    orientation: 'h',
    x: values,
    y: labels,
    marker: { color: colors },
    text: values.map(v => Theme.num(v)),
    textposition: 'outside',
    textfont: { color: Theme.COLORS.textSecondary, size: 11 },
    hovertemplate: '%{y}: %{x} pageviews<extra></extra>',
  };

  const rowHeight = 36;
  const minHeight = 200;
  const chartHeight = Math.max(minHeight, rows.length * rowHeight + 60);
  el.style.height = chartHeight + 'px';

  const layout = {
    ...Theme.PLOTLY_LAYOUT,
    margin: { t: 10, r: 80, b: 40, l: 120 },
    showlegend: false,
    xaxis: {
      ...Theme.PLOTLY_LAYOUT.xaxis,
      title: { text: 'Pageviews', font: { color: Theme.COLORS.textMuted, size: 11 } },
    },
    yaxis: {
      ...Theme.PLOTLY_LAYOUT.yaxis,
      automargin: true,
    },
  };

  Plotly.newPlot(el, [trace], layout, Theme.PLOTLY_CONFIG);
}

function _renderPageTable(rows) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'overflow-x:auto';

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const columns = [
    { key: 'page_url',          label: 'URL',              align: 'left'  },
    { key: 'pageviews',         label: 'Pageviews',        align: 'right' },
    { key: 'unique_visitors',   label: 'Unique Visitors',  align: 'right' },
    { key: 'avg_scroll_depth',  label: 'Avg Scroll Depth', align: 'right' },
  ];

  let sortKey = 'pageviews';
  let sortAsc = false;

  columns.forEach(col => {
    const th = document.createElement('th');
    th.style.cssText = [
      'padding:8px 12px',
      'text-align:' + col.align,
      'color:' + Theme.COLORS.textMuted,
      'font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em',
      'border-bottom:1px solid ' + Theme.COLORS.border,
      'cursor:pointer;user-select:none;white-space:nowrap',
    ].join(';');
    th.textContent = col.label;
    th.dataset.key = col.key;

    th.addEventListener('click', () => {
      if (sortKey === col.key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = col.key;
        sortAsc = false;
      }
      // Update header indicators
      thead.querySelectorAll('th').forEach(t => {
        t.textContent = columns.find(c => c.key === t.dataset.key).label;
      });
      th.textContent = col.label + (sortAsc ? ' \u25b2' : ' \u25bc');
      _repopulateBody(sortKey, sortAsc);
    });

    headerRow.appendChild(th);
  });

  // Default sort indicator
  headerRow.querySelectorAll ? null : null;
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  wrapper.appendChild(table);

  function _repopulateBody(key, asc) {
    const sorted = [...rows].sort((a, b) => {
      const va = a[key] ?? (key === 'page_url' ? '' : -Infinity);
      const vb = b[key] ?? (key === 'page_url' ? '' : -Infinity);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });

    tbody.innerHTML = '';
    sorted.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-bottom:1px solid ' + Theme.COLORS.border + ';' +
        (i % 2 === 0 ? '' : 'background:rgba(255,255,255,0.02)');

      const urlTd = document.createElement('td');
      urlTd.style.cssText = 'padding:10px 12px;color:' + Theme.COLORS.textPrimary + ';font-family:monospace;font-size:12px';
      const short = _truncateUrl(row.page_url);
      urlTd.title = row.page_url || '';
      urlTd.textContent = short;

      const pvTd = document.createElement('td');
      pvTd.style.cssText = 'padding:10px 12px;text-align:right;color:' + Theme.COLORS.textPrimary + ';font-weight:600';
      pvTd.textContent = Theme.num(row.pageviews || 0);

      const uvTd = document.createElement('td');
      uvTd.style.cssText = 'padding:10px 12px;text-align:right;color:' + Theme.COLORS.textSecondary;
      uvTd.textContent = Theme.num(row.unique_visitors || 0);

      const scrollTd = document.createElement('td');
      scrollTd.style.cssText = 'padding:10px 12px;text-align:right;color:' + Theme.COLORS.textSecondary;
      const scrollVal = row.avg_scroll_depth != null ? row.avg_scroll_depth : null;
      scrollTd.textContent = scrollVal != null ? Theme.pct(scrollVal / 100) : '--';

      tr.appendChild(urlTd);
      tr.appendChild(pvTd);
      tr.appendChild(uvTd);
      tr.appendChild(scrollTd);
      tbody.appendChild(tr);
    });
  }

  // Initial render + mark default sort header
  const defaultTh = headerRow.querySelector('[data-key="pageviews"]');
  if (defaultTh) defaultTh.textContent = 'Pageviews \u25bc';
  _repopulateBody(sortKey, sortAsc);

  return wrapper;
}
