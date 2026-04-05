/* ============================================
   Worklists -- No-Show Recovery, VIP Non-Bookers,
   Follow-Up Pipeline
   ============================================ */

App.registerPage('worklists', async (container) => {

  // ---- State ----
  const state = {
    activeTab: 0,
    data: { noShowRecovery: null, vipNonBookers: null, followUps: null },
    searchTerms: ['', '', ''],
    sortState: [null, null, null],  // { col, dir } per tab
  };

  const TABS = [
    {
      key: 'noShowRecovery',
      label: 'No-Show Recovery',
      query: 'noShowRecovery',
      columns: [
        { key: 'email',      label: 'Email' },
        { key: 'closer',     label: 'Closer' },
        { key: 'call_date',  label: 'Call Date' },
        { key: 'days_since', label: 'Days Since' },
        { key: '_gemini',    label: 'Gemini Rec', sortable: false },
        { key: '_action',    label: 'Action',     sortable: false },
      ],
      actionLabel: 'Call Back',
      actionColor: Theme.COLORS.warning || '#f39c12',
    },
    {
      key: 'vipNonBookers',
      label: 'VIP Non-Bookers',
      query: 'vipNonBookers',
      columns: [
        { key: 'email',            label: 'Email' },
        { key: 'ticket_purchased_at', label: 'Ticket Date' },
        { key: 'days_since_ticket',   label: 'Days Since Ticket' },
        { key: '_gemini',          label: 'Gemini Rec', sortable: false },
        { key: '_action',          label: 'Action',     sortable: false },
      ],
      actionLabel: 'Book Call',
      actionColor: Theme.COLORS.accent || '#6c5ce7',
    },
    {
      key: 'followUps',
      label: 'Follow-Up Pipeline',
      query: 'followUps',
      columns: [
        { key: 'email',       label: 'Email' },
        { key: 'closer',      label: 'Closer' },
        { key: 'call_date',   label: 'Call Date' },
        { key: 'status',      label: 'Status' },
        { key: 'disposition', label: 'Disposition' },
        { key: '_gemini',     label: 'Gemini Rec', sortable: false },
        { key: '_action',     label: 'Action',     sortable: false },
      ],
      actionLabel: 'Follow Up',
      actionColor: Theme.COLORS.success || '#00b894',
    },
  ];

  // ---- Render shell ----
  container.innerHTML = '';

  // Page header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:16px';
  header.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;color:${Theme.COLORS.text};margin:0 0 4px">Worklists</h2>
    <p style="font-size:13px;color:${Theme.COLORS.textMuted};margin:0">Actionable contact lists for closer follow-up. Gemini recommendations coming soon.</p>
  `;
  container.appendChild(header);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:0;border-bottom:2px solid rgba(255,255,255,0.08);margin-bottom:20px;overflow-x:auto';
  tabBar.id = 'wl-tab-bar';
  container.appendChild(tabBar);

  // Tab content wrapper
  const tabContent = document.createElement('div');
  tabContent.id = 'wl-tab-content';
  container.appendChild(tabContent);

  // ---- Helpers ----

  function getBadge(count) {
    if (count == null) return `<span style="display:inline-block;background:rgba(255,255,255,0.08);color:${Theme.COLORS.textMuted};font-size:10px;padding:1px 6px;border-radius:10px;margin-left:6px;font-weight:600">--</span>`;
    return `<span style="display:inline-block;background:rgba(108,92,231,0.2);color:${Theme.COLORS.accent};font-size:10px;padding:1px 6px;border-radius:10px;margin-left:6px;font-weight:600">${count}</span>`;
  }

  function renderTabButtons() {
    tabBar.innerHTML = '';
    TABS.forEach((tab, i) => {
      const rows = state.data[tab.key];
      const count = rows ? rows.length : null;
      const isActive = i === state.activeTab;

      const btn = document.createElement('button');
      btn.style.cssText = `
        background:none;border:none;cursor:pointer;padding:10px 20px;font-size:13px;font-weight:600;
        color:${isActive ? Theme.COLORS.text : Theme.COLORS.textMuted};
        border-bottom:2px solid ${isActive ? (Theme.COLORS.accent || '#6c5ce7') : 'transparent'};
        margin-bottom:-2px;transition:color .15s,border-color .15s;white-space:nowrap;
      `;
      btn.innerHTML = `${tab.label}${getBadge(count)}`;
      btn.addEventListener('click', () => switchTab(i));
      tabBar.appendChild(btn);
    });
  }

  function getFilteredRows(tabIdx) {
    const tab = TABS[tabIdx];
    let rows = state.data[tab.key] || [];
    const term = (state.searchTerms[tabIdx] || '').toLowerCase();
    if (term) {
      rows = rows.filter(r => (r.email || '').toLowerCase().includes(term));
    }
    const sort = state.sortState[tabIdx];
    if (sort && sort.col) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a[sort.col] ?? '';
        const bv = b[sort.col] ?? '';
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return rows;
  }

  function renderTable(tabIdx) {
    const tab = TABS[tabIdx];
    const rows = getFilteredRows(tabIdx);
    const sort = state.sortState[tabIdx] || {};

    const colStyle = `padding:10px 12px;font-size:12px;font-weight:600;color:${Theme.COLORS.textSecondary};text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid rgba(255,255,255,0.08);cursor:default;white-space:nowrap;`;
    const cellStyle = `padding:10px 12px;font-size:13px;color:${Theme.COLORS.text};border-bottom:1px solid rgba(255,255,255,0.05);`;

    const thCells = tab.columns.map(col => {
      const sortable = col.sortable !== false;
      const isActive = sort.col === col.key;
      const dir = isActive ? sort.dir : null;
      const arrow = dir === 'asc' ? ' ↑' : dir === 'desc' ? ' ↓' : '';
      return `<th style="${colStyle}${sortable ? 'cursor:pointer;' : ''}" data-col="${col.key}" data-sortable="${sortable}">${col.label}${arrow}</th>`;
    }).join('');

    let bodyRows = '';
    if (rows.length === 0) {
      bodyRows = `<tr><td colspan="${tab.columns.length}" style="padding:32px;text-align:center;color:${Theme.COLORS.textMuted};font-size:13px">No contacts match this worklist criteria for the selected period.</td></tr>`;
    } else {
      bodyRows = rows.map(row => {
        const cells = tab.columns.map(col => {
          let val = '';
          if (col.key === '_gemini') {
            val = `<span style="color:${Theme.COLORS.textMuted};font-style:italic;font-size:12px">Pending</span>`;
          } else if (col.key === '_action') {
            val = `<button style="background:${tab.actionColor};color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;opacity:.85;white-space:nowrap" onclick="void(0)">${tab.actionLabel}</button>`;
          } else {
            const raw = row[col.key];
            val = raw != null ? String(raw) : '<span style="opacity:.35">--</span>';
          }
          return `<td style="${cellStyle}">${val}</td>`;
        }).join('');
        return `<tr style="transition:background .1s" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">${cells}</tr>`;
      }).join('');
    }

    return `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>${thCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    `;
  }

  async function renderTabContent(tabIdx) {
    const tab = TABS[tabIdx];
    tabContent.innerHTML = '';

    // Search bar
    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:14px';
    searchRow.innerHTML = `
      <input
        id="wl-search"
        type="text"
        value="${state.searchTerms[tabIdx] || ''}"
        placeholder="Filter by email..."
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:7px 12px;font-size:13px;color:${Theme.COLORS.text};width:260px;outline:none"
      />
      <span id="wl-count-label" style="font-size:12px;color:${Theme.COLORS.textMuted}"></span>
    `;
    tabContent.appendChild(searchRow);

    const searchInput = searchRow.querySelector('#wl-search');

    // Table card
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'padding:0;overflow:hidden;overflow-x:auto';
    card.id = 'wl-table-card';
    tabContent.appendChild(card);

    function rebuildTable() {
      const rows = getFilteredRows(tabIdx);
      card.innerHTML = renderTable(tabIdx);
      const countLabel = document.getElementById('wl-count-label');
      if (countLabel) countLabel.textContent = `${rows.length} contact${rows.length !== 1 ? 's' : ''}`;

      // Sort click handlers
      card.querySelectorAll('th[data-sortable="true"]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.getAttribute('data-col');
          const cur = state.sortState[tabIdx];
          if (cur && cur.col === col) {
            state.sortState[tabIdx] = { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
          } else {
            state.sortState[tabIdx] = { col, dir: 'asc' };
          }
          rebuildTable();
        });
      });
    }

    searchInput.addEventListener('input', (e) => {
      state.searchTerms[tabIdx] = e.target.value;
      rebuildTable();
    });

    // If data not yet loaded, fetch it
    if (state.data[tab.key] === null) {
      card.innerHTML = `
        <div style="padding:40px;text-align:center">
          <div style="display:inline-block;width:24px;height:24px;border:2px solid rgba(255,255,255,0.1);border-top-color:${Theme.COLORS.accent};border-radius:50%;animation:spin .7s linear infinite"></div>
          <p style="margin-top:12px;color:${Theme.COLORS.textMuted};font-size:13px">Loading ${tab.label}...</p>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      `;

      try {
        const rows = await API.query('worklists', tab.query, {});
        state.data[tab.key] = rows || [];
      } catch (err) {
        state.data[tab.key] = [];
        card.innerHTML = `<div style="padding:24px;color:${Theme.COLORS.textMuted};font-size:13px">Failed to load ${tab.label}: ${err.message}</div>`;
        return;
      }

      // Update tab badges now that we have data
      renderTabButtons();
      rebuildTable();
    } else {
      rebuildTable();
    }
  }

  function switchTab(idx) {
    state.activeTab = idx;
    renderTabButtons();
    renderTabContent(idx);
  }

  // ---- Initial render ----
  renderTabButtons();
  await renderTabContent(0);
});
