/* ============================================================================
   RDP — Des Moines ALPR exhibit: configuration explorer.

   Renders the 155 rows of the City's August 2026 VehicleManager sharing export
   as a constellation of OPEN RINGS placed by the export's own State column.

   HARD RULES ENFORCED HERE (evidence grammar):
     1. Counterparties are open rings. Only Des Moines is a filled node.
     2. No connector is drawn by default. Ever.
     3. A connector appears only on explicit selection, one agency at a time,
        as a whole (opacity fade), with no arrowhead, no dash-offset animation,
        no direction cue and no travelling mark.
     4. Rings never appear in a time-ordered sequence. They render all at once,
        or grouped by filter — never by date.
     5. No geocoding. Tile positions are an editorial cartogram.
     6. Every state's rings are also present in a semantic table below, which
        is the accessible equivalent and works without this file.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.getElementById('network-explorer');
  if (!root) return;

  var NODES = (window.RDP_NETWORK && window.RDP_NETWORK.rows) || [];
  var TOTALS = (window.RDP_NETWORK && window.RDP_NETWORK.totals) || {};
  var TILES = window.RDP_TILES || [];
  var esc = (window.RDP_EXHIBIT && window.RDP_EXHIBIT.esc) || function (s) { return String(s); };

  var TILE_W = 78, TILE_H = 62, GAP = 6, PAD = 8;
  var svg = document.getElementById('tilemap');
  var readout = document.getElementById('network-readout');
  var liveRegion = document.getElementById('network-live');
  var tableBody = document.getElementById('network-tbody');
  var tableCount = document.getElementById('network-table-count');

  var byState = {};
  NODES.forEach(function (n) {
    (byState[n.state_code] = byState[n.state_code] || []).push(n);
  });

  var selected = null;      // node_id of the one selected agency
  var selectedState = null; // state_code, or null
  var filters = { type: null, scope: null, receiving: null, group: null };

  /* ------------------------------------------------------------- filtering */
  function matches(n) {
    if (filters.type && n.agency_type_raw !== filters.type) return false;
    if (filters.scope === 'iowa' && !n.is_iowa) return false;
    if (filters.scope === 'non-iowa' && n.is_iowa) return false;
    if (filters.receiving && n.status_in !== filters.receiving) return false;
    if (filters.group === 'federal' && !n.is_federal_typed) return false;
    if (filters.group === 'fusion' && !n.is_fusion_intel_named) return false;
    if (filters.group === 'inactive' && !n.has_inactive_prefix) return false;
    if (filters.group === 'dated' && !n.dated) return false;
    if (selectedState && n.state_code !== selectedState) return false;
    return true;
  }

  function visibleNodes() { return NODES.filter(matches); }

  /* -------------------------------------------------------------- geometry */
  function tileXY(t) {
    return {
      x: PAD + (t.col - 1) * (TILE_W + GAP),
      y: PAD + (t.row - 1) * (TILE_H + GAP)
    };
  }

  /* Ring positions inside a tile. Laid out in a plain grid, all at once.
     Order follows the export's own row order — not a chronology. */
  function ringLayout(count, tile) {
    var p = tileXY(tile);
    var homeOffset = tile.is_home ? 14 : 0;   // leave room for the Des Moines node
    var innerW = TILE_W - 12;
    var innerH = TILE_H - 20 - homeOffset;
    var cols = Math.max(1, Math.ceil(Math.sqrt(count * (innerW / innerH))));
    var rows = Math.ceil(count / cols);
    var stepX = innerW / cols;
    var stepY = Math.min(innerH / rows, 9);
    var out = [];
    for (var i = 0; i < count; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      out.push({
        x: p.x + 6 + stepX * (c + 0.5),
        y: p.y + 16 + homeOffset + stepY * (r + 0.5)
      });
    }
    return out;
  }

  var DM = null; // Des Moines reference node position

  /* ------------------------------------------------------------- rendering */
  function svgEl(name, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function build() {
    var w = PAD * 2 + 11 * TILE_W + 10 * GAP;
    var h = PAD * 2 + 8 * TILE_H + 7 * GAP;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    var gTiles = svgEl('g', { class: 'tiles' });
    var gNodes = svgEl('g', { class: 'nodes' });
    var gConn = svgEl('g', { class: 'connectors' });
    gConn.setAttribute('id', 'connectors');

    TILES.forEach(function (t) {
      var p = tileXY(t);
      var members = byState[t.state_code] || [];
      var g = svgEl('g', {
        class: 'tile-cell',
        'data-state': t.state_code,
        'data-count': members.length,
        'data-has': members.length ? 'true' : 'false',
        'data-home': t.is_home ? 'true' : 'false',
        tabindex: '0',
        role: 'button',
        'aria-pressed': 'false'
      });
      g.appendChild(svgEl('title', {})).textContent =
        t.state_name + ' — ' + members.length +
        (members.length === 1 ? ' listed agency' : ' listed agencies') +
        (t.is_home ? ' (Des Moines is the reference node)' : '');
      g.setAttribute('aria-label', t.state_name + ', ' + members.length +
        (members.length === 1 ? ' listed agency' : ' listed agencies') + '. Select to filter.');
      g.appendChild(svgEl('rect', { x: p.x, y: p.y, width: TILE_W, height: TILE_H, rx: 2 }));

      var abbr = svgEl('text', { class: 'abbr', x: p.x + 5, y: p.y + 12 });
      abbr.textContent = t.state_code;
      g.appendChild(abbr);

      if (members.length) {
        var cnt = svgEl('text', { class: 'cnt', x: p.x + TILE_W - 5, y: p.y + 12, 'text-anchor': 'end' });
        cnt.textContent = members.length;
        g.appendChild(cnt);
      }
      gTiles.appendChild(g);

      if (t.is_home) {
        DM = { x: p.x + TILE_W / 2, y: p.y + 24 };
        var dm = svgEl('g', { class: 'dm-node' });
        dm.appendChild(svgEl('circle', { class: 'node-dm', cx: DM.x, cy: DM.y, r: 4.5 }));
        var dl = svgEl('text', {
          class: 'cnt', x: DM.x, y: DM.y - 7, 'text-anchor': 'middle'
        });
        dl.textContent = 'DES MOINES';
        dl.setAttribute('style', 'font-size:6px;letter-spacing:.08em');
        dm.appendChild(dl);
        gNodes.appendChild(dm);
      }

      var positions = ringLayout(members.length, t);
      members.forEach(function (n, i) {
        var pos = positions[i];
        n._x = pos.x; n._y = pos.y;
        var ng = svgEl('g', {
          class: 'node-g',
          'data-node': n.node_id,
          tabindex: '0',
          role: 'button',
          'aria-pressed': 'false',
          'aria-label': n.display_name + ', ' + n.state_raw +
            '. Configured to share. ' + receivingWord(n.status_in) +
            '. Select to show its configured relationship and open the source row.'
        });
        ng.appendChild(svgEl('title', {})).textContent =
          n.agency_raw + ' — configured to share' +
          (n.status_in === 'configured_in' ? '; configured to receive' : '');
        /* invisible hit area: the visible ring has no fill, so without this a
           pointer aimed at the centre of a ring falls through to the tile. */
        ng.appendChild(svgEl('circle', {
          class: 'ring-hit', cx: pos.x, cy: pos.y, r: 6
        }));
        ng.appendChild(svgEl('circle', {
          class: 'ring', cx: pos.x, cy: pos.y, r: 3,
          'data-in': n.status_in,
          'data-inactive': n.has_inactive_prefix ? 'true' : 'false'
        }));
        if (n.status_in === 'configured_in') {
          ng.appendChild(svgEl('circle', { class: 'ring-inner', cx: pos.x, cy: pos.y, r: 1.2 }));
        }
        if (n.has_inactive_prefix) {
          ng.appendChild(svgEl('line', {
            class: 'ring-strike',
            x1: pos.x - 4, y1: pos.y + 4, x2: pos.x + 4, y2: pos.y - 4
          }));
        }
        gNodes.appendChild(ng);
      });
    });

    svg.appendChild(gTiles);
    svg.appendChild(gConn);   /* connectors sit under the nodes, above the tiles */
    svg.appendChild(gNodes);
  }

  function receivingWord(status) {
    if (status === 'configured_in') return 'Configured to receive';
    if (status === 'approval_required') return 'Receiving request shown as approval required';
    if (status === 'declined') return 'Receiving relationship shown as declined';
    return 'No receiving relationship recorded';
  }

  /* ------------------------------------------------------------ connectors
     One connector, drawn whole, no arrowhead, no motion along the line. */
  function drawConnector(n) {
    var g = document.getElementById('connectors');
    while (g.firstChild) g.removeChild(g.firstChild);
    if (!n || !DM) return;

    g.appendChild(svgEl('line', {
      class: 'connector', x1: DM.x, y1: DM.y, x2: n._x, y2: n._y
    }));

    /* the toggle glyph at the counterparty end: a literal quotation of
       "by selecting this option within Vigilant VehicleManager" */
    var tg = svgEl('g', { class: 'connector-toggle' });
    var dx = n._x - DM.x, dy = n._y - DM.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var tx = n._x - (dx / len) * 9;
    var ty = n._y - (dy / len) * 9;
    tg.appendChild(svgEl('rect', { x: tx - 5, y: ty - 3, width: 10, height: 6, rx: 3 }));
    tg.appendChild(svgEl('circle', { cx: tx + 2.4, cy: ty, r: 1.6 }));
    tg.appendChild(svgEl('title', {})).textContent =
      'Configured to share — option selected in VehicleManager (export 17 August 2026). ' +
      'This is a setting, not a transfer.';
    g.appendChild(tg);
  }

  /* --------------------------------------------------------------- receipt */
  function agencyReceipt(n) {
    return {
      receipt_id: n.receipt_id,
      claim: n.display_name + ' (' + n.state_raw + ') appears in the City of Des Moines’ ' +
        'August 2026 VehicleManager export with detection sharing in “Sharing” status.',
      record_layer: 'L5',
      source_tag: 'P',
      evidence_status: 'configured_out',
      source_document: 'VehicleManager Data Sharing Report (filter: Data type : Detection, Sharing status : Sharing)',
      source_date: '2026-08-17',
      page_or_row: 'sheet row ' + n.xlsx_row,
      source_excerpt:
        'Agency: ' + n.agency_raw + '\n' +
        'State: ' + n.state_raw + '\n' +
        'Hot list sharing: ' + n.hot_list_sharing + '\n' +
        'Hot list received: ' + n.hot_list_received + '\n' +
        'Detection sharing: ' + n.detection_sharing + '\n' +
        'Detection receiving: ' + n.detection_receiving + '\n' +
        'Date of last update: ' + n.date_of_last_update + '\n' +
        'Has system: ' + n.has_system + '\n' +
        'Retention: ' + n.retention + '\n' +
        'Agency type: ' + n.agency_type_raw,
      caveat:
        'Configured to share. Not shown to have shared. ' +
        (n.dated
          ? 'This row carries a “Date of last update” of ' + n.date_of_last_update +
            '. That is a last-update stamp, not a start date.'
          : 'This row has no “Date of last update,” as do 151 of the 155 rows. ' +
            'When this relationship was configured is not determinable from the record.') +
        (n.has_f_prefix ? ' The “(F)” prefix on this name is not defined in any located documentation.' : '') +
        (n.has_inactive_prefix ? ' This name carries an “Inactive” prefix in the export; its meaning is not defined.' : '') +
        ' Outbound and inbound labels are inferred from vendor terminology; the file does not label direction.',
      what_it_does_not_establish:
        'It does not establish that any plate record was transferred to, queried by or viewed by this agency, ' +
        'or when the relationship was configured.',
      related_receipts: ['R-EXPORT-155', 'R-EXPORT-UNDATED', 'R-MVA-4.5']
    };
  }

  /* ------------------------------------------------------------- selection */
  function selectAgency(id, trigger) {
    selected = (selected === id) ? null : id;
    var n = NODES.filter(function (x) { return x.node_id === selected; })[0] || null;
    drawConnector(n);
    svg.querySelectorAll('.node-g').forEach(function (g) {
      g.setAttribute('aria-pressed', String(g.getAttribute('data-node') === selected));
    });
    if (n) {
      window.RDP_RECEIPTS[n.receipt_id] = agencyReceipt(n);
      if (trigger && window.RDP_EXHIBIT) window.RDP_EXHIBIT.setLastFocus(trigger);
      window.RDP_EXHIBIT.openDrawer(n.receipt_id);
      announce(n.display_name + ' selected. One connector shown, labelled configured to share. ' +
        'This is a setting, not a transfer.');
    } else {
      announce('Selection cleared. No connectors drawn.');
    }
    updateReadout();
  }

  function selectState(code) {
    selectedState = (selectedState === code) ? null : code;
    selected = null;
    drawConnector(null);
    svg.querySelectorAll('.tile-cell').forEach(function (g) {
      g.setAttribute('aria-pressed', String(g.getAttribute('data-state') === selectedState));
    });
    document.querySelectorAll('.state-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-state') === selectedState));
    });
    apply();
    announce(selectedState
      ? selectedState + ' selected. ' + visibleNodes().length + ' agencies shown.'
      : 'State filter cleared.');
  }

  function announce(msg) { if (liveRegion) liveRegion.textContent = msg; }

  /* ---------------------------------------------------------------- render */
  function apply() {
    var vis = {};
    visibleNodes().forEach(function (n) { vis[n.node_id] = true; });
    svg.querySelectorAll('.node-g').forEach(function (g) {
      g.setAttribute('data-muted', String(!vis[g.getAttribute('data-node')]));
    });
    if (selected && !vis[selected]) { selected = null; drawConnector(null); }
    renderTable();
    updateReadout();
  }

  function updateReadout() {
    if (!readout) return;
    var v = visibleNodes();
    var recv = v.filter(function (n) { return n.status_in === 'configured_in'; }).length;
    var states = {};
    v.forEach(function (n) { states[n.state_raw] = true; });
    var nStates = Object.keys(states).length;
    var dc = states['District of Columbia'] ? 1 : 0;
    var jurisdiction = (nStates - dc) + (nStates - dc === 1 ? ' state' : ' states') +
      (dc ? ' and the District of Columbia' : '');
    var sel = selected
      ? NODES.filter(function (n) { return n.node_id === selected; })[0]
      : null;
    readout.innerHTML =
      '<strong>' + v.length + '</strong> of 155 configured outbound sharing relationships shown' +
      (v.length ? ', across ' + jurisdiction : '') + '. ' +
      '<strong>' + recv + '</strong> of those also show a receiving relationship. ' +
      (sel
        ? '<br>Selected: <strong>' + esc(sel.display_name) + '</strong> (' + esc(sel.state_raw) + ') — ' +
          'configured to share; ' + esc(receivingWord(sel.status_in).toLowerCase()) + '.'
        : '<br>No agency selected. No connectors drawn.');
  }

  function renderTable() {
    if (!tableBody) return;
    var v = visibleNodes();
    var html = v.map(function (n) {
      return '<tr>' +
        '<td class="raw">' + esc(n.agency_raw) + '</td>' +
        '<td>' + esc(n.state_raw) + '</td>' +
        '<td>' + esc(n.agency_type_raw) + '</td>' +
        '<td>' + esc(n.detection_sharing) + '</td>' +
        '<td>' + esc(n.detection_receiving) + '</td>' +
        '<td class="raw">' + esc(n.date_of_last_update) + '</td>' +
        '<td>' + esc(n.has_system) + '</td>' +
        '<td>' + esc(n.retention) + '</td>' +
        '<td class="num">' + n.xlsx_row + '</td>' +
        '<td><button type="button" class="receipt-chip" data-receipt="' + esc(n.receipt_id) + '">' +
          '<span class="rc-label">Source row</span></button></td>' +
        '</tr>';
    }).join('');
    tableBody.innerHTML = html;
    if (tableCount) tableCount.textContent = v.length + ' of 155 rows shown';
    v.forEach(function (n) { window.RDP_RECEIPTS[n.receipt_id] = agencyReceipt(n); });
  }

  /* ---------------------------------------------------------------- events */
  svg.addEventListener('click', function (e) {
    var node = e.target.closest('.node-g');
    if (node) { selectAgency(node.getAttribute('data-node'), node); return; }
    var tile = e.target.closest('.tile-cell');
    if (tile) selectState(tile.getAttribute('data-state'));
  });

  svg.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var node = e.target.closest && e.target.closest('.node-g');
    if (node) { e.preventDefault(); selectAgency(node.getAttribute('data-node'), node); return; }
    var tile = e.target.closest && e.target.closest('.tile-cell');
    if (tile) { e.preventDefault(); selectState(tile.getAttribute('data-state')); }
  });

  var filterBar = document.getElementById('network-filters');
  if (filterBar) {
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-opt');
      if (!btn) return;
      var group = btn.getAttribute('data-group');
      var value = btn.getAttribute('data-value') || null;
      filters[group] = (filters[group] === value) ? null : value;
      filterBar.querySelectorAll('.filter-opt[data-group="' + group + '"]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === filters[group]));
      });
      apply();
      announce(visibleNodes().length + ' of 155 relationships shown.');
    });
  }

  var stateList = document.getElementById('state-list');
  if (stateList) {
    stateList.addEventListener('click', function (e) {
      var btn = e.target.closest('.state-btn');
      if (btn) selectState(btn.getAttribute('data-state'));
    });
  }

  var clearBtn = document.getElementById('network-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      filters = { type: null, scope: null, receiving: null, group: null };
      selectedState = null;
      selected = null;
      drawConnector(null);
      if (filterBar) filterBar.querySelectorAll('.filter-opt').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
      });
      svg.querySelectorAll('.tile-cell,.node-g').forEach(function (g) {
        g.setAttribute('aria-pressed', 'false');
      });
      document.querySelectorAll('.state-btn').forEach(function (b) {
        b.setAttribute('aria-pressed', 'false');
      });
      apply();
      announce('All filters cleared. 155 relationships shown, no connectors drawn.');
    });
  }

  /* On a wide screen the grid is the primary view, so the disclosure opens by
     default. On a narrow screen the legible jurisdiction list leads instead. */
  var details = document.getElementById('tilemap-details');
  if (details && window.matchMedia('(min-width: 900px)').matches) details.open = true;

  build();
  apply();
})();
