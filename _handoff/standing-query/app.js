/* ============================================================
   The Standing Query — interaction prototype
   Classic script on purpose: ES modules are blocked under file://,
   and this must run by double-clicking index.html.
   ============================================================ */
(function () {
  'use strict';

  var sq        = document.getElementById('sq');
  var stage     = document.getElementById('stage');
  var card      = document.getElementById('card');
  var receipts  = document.getElementById('receipts');
  var btnPrimary= document.getElementById('btnPrimary');
  var btnBack   = document.getElementById('btnBack');
  var btnRestart= document.getElementById('btnRestart');
  var btnComp   = document.getElementById('btnComposite');
  var live      = document.getElementById('live');
  var scrim     = document.getElementById('scrim');
  var railProg  = document.getElementById('railProgress');
  var railLoop  = document.getElementById('railLoop');
  var railStns  = document.getElementById('railStations');
  var railList  = document.getElementById('railList');
  var railLabel = document.getElementById('railLabel');
  var chipPrompt  = document.getElementById('chipPrompt');

  if (!sq) { return; }

  /* ---------- reduced motion ---------- */
  var rmQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(rmQuery && rmQuery.matches); }

  /* ---------- stations ---------- */
  var STATIONS = [
    { id: 1, x: 20,  y: 34, label: '' },
    { id: 2, x: 74,  y: 34, label: '' },
    { id: 3, x: 128, y: 34, label: '' },
    { id: 4, x: 182, y: 34, label: 'Response', dy: 16 },
    { id: 5, x: 237, y: 34, label: '16,457',   dy: -11 },
    { id: 6, x: 292, y: 34, label: 'Issued',   dy: 16 },
    { id: 7, x: 168, y: 86, label: 'Status expires', loop: true }
  ];
  var STATION_NAMES = {
    1: 'Application', 2: 'Submission', 3: 'Clearinghouse',
    4: 'Response', 5: 'One of 16,457', 6: 'License issued',
    7: 'Status expires — contemplated recheck'
  };

  var LINE_X0 = 20, LINE_X1 = 292;
  var CARD_S2_SCALE = 0.34;   /* must match the scale() in styles.css */

  /* ---------- state ---------- */
  var ORDER = ['s0','s1','s2','s3','s4','s5','s6','s7','s8'];
  var state = 's0';
  var history = [];
  var flags = { people: false, cases: false, transactions: false, scopeSeen: false };
  var timers = [];
  var loopLen = 0, progLen = 0;

  var STATE_STATION = { s0:3, s1:4, s2:5, s3:6, s4:6, s5:6, s6:6, s7:7, s8:7 };

  var PRIMARY_LABEL = {
    s0: 'Begin',
    s1: 'Continue',
    s2: 'Continue',
    s3: '',
    s4: 'Close',          /* reduced-motion only: the LABEL is the false ending */
    s5: '',
    s6: 'See what happens next',
    s7: 'Continue',
    s8: 'Start over'
  };

  var ANNOUNCE = {
    s0: 'A composite professional-license application. Not an individual’s record.',
    s1: 'Response. A response has come back. Evidence available: additional verification.',
    s2: 'This case is one of 16,457 initial verifications. Three questions to resolve.',
    s3: '',
    s4: 'License issued. Application complete.',
    s5: '',
    s6: 'The file stays open. The case returns to the system.',
    s7: 'When the status expires. Documented procedure, not an observed event.',
    s8: 'End of prototype.'
  };

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) { clearTimeout(timers[i]); }
    timers = [];
  }
  function after(ms, fn) { var t = setTimeout(fn, ms); timers.push(t); return t; }

  function say(msg) { if (msg) { live.textContent = msg; } }

  /* ---------- rail construction ---------- */
  function buildRail() {
    var SVGNS = 'http://www.w3.org/2000/svg';
    while (railStns.firstChild) { railStns.removeChild(railStns.firstChild); }
    for (var i = 0; i < STATIONS.length; i++) {
      var s = STATIONS[i];
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', s.x);
      c.setAttribute('cy', s.y);
      c.setAttribute('r', s.loop ? 7 : 4.5);
      c.setAttribute('class', 'rail__station' + (s.loop ? ' is-loop' : ''));
      c.setAttribute('data-station', s.id);
      railStns.appendChild(c);

      if (s.label) {
        var t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('x', s.x);
        t.setAttribute('y', s.loop ? s.y + 21 : s.y + (s.dy || 18));
        t.setAttribute('class', 'rail__label' + (s.loop ? ' rail__label--loop' : ''));
        t.setAttribute('data-label', s.id);
        t.setAttribute('text-anchor', s.x < 60 ? 'start' : (s.x > 250 ? 'end' : 'middle'));
        t.textContent = s.label;
        railStns.appendChild(t);
      }
    }

    try {
      progLen = railProg.getTotalLength();
      loopLen = railLoop.getTotalLength();
    } catch (e) {
      progLen = LINE_X1 - LINE_X0;
      loopLen = 200;
    }
    railProg.style.strokeDasharray = progLen;
    railProg.style.strokeDashoffset = progLen;
    railLoop.style.strokeDasharray = loopLen;
    railLoop.style.strokeDashoffset = loopLen;
  }

  function railProgressTo(stationId) {
    var target = STATIONS[0];
    for (var i = 0; i < STATIONS.length; i++) {
      if (STATIONS[i].id === stationId && !STATIONS[i].loop) { target = STATIONS[i]; }
    }
    if (stationId >= 6) { target = STATIONS[5]; }
    var frac = (target.x - LINE_X0) / (LINE_X1 - LINE_X0);
    railProg.style.strokeDashoffset = String(progLen * (1 - frac));
  }

  function paintStations(currentId) {
    var nodes = railStns.querySelectorAll('.rail__station');
    for (var i = 0; i < nodes.length; i++) {
      var id = parseInt(nodes[i].getAttribute('data-station'), 10);
      nodes[i].classList.remove('is-done', 'is-current');
      if (id === 7) { continue; }
      if (id < currentId) { nodes[i].classList.add('is-done'); }
      else if (id === currentId) { nodes[i].classList.add('is-current'); }
    }
    var labels = railStns.querySelectorAll('.rail__label');
    for (var j = 0; j < labels.length; j++) {
      var lid = parseInt(labels[j].getAttribute('data-label'), 10);
      labels[j].classList.toggle('is-current', lid === currentId);
    }
    buildRailList(currentId);
  }

  function buildRailList(currentId) {
    var html = '';
    for (var i = 0; i < STATIONS.length; i++) {
      var id = STATIONS[i].id;
      var status;
      if (id === 7) {
        status = (currentId === 7) ? 'current — documented procedure, not an observed event'
                                   : (sq.getAttribute('data-loop') === 'drawn' ? 'the path returns here' : 'not yet reached');
      } else if (id < currentId) { status = 'complete'; }
      else if (id === currentId) { status = 'current'; }
      else { status = 'not yet reached'; }
      html += '<li>' + STATION_NAMES[id] + ' — ' + status + '</li>';
    }
    railList.innerHTML = html;

    var summary = (sq.getAttribute('data-loop') === 'drawn')
      ? 'Progress: six of six licensing steps complete, and the path returns to a status-expiration check.'
      : 'Progress: step ' + currentId + ' of six licensing steps.';
    railLabel.textContent = summary;
  }

  /* ---------- sheets ---------- */
  var openSheetEl = null, sheetOpener = null;

  function focusables(root) {
    return root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  }

  function openSheet(el, opener) {
    if (openSheetEl) { closeSheet(); }
    openSheetEl = el;
    sheetOpener = opener || null;
    if (el.classList.contains('receipt__body')) { el.setAttribute('data-open', 'true'); }
    else { el.hidden = false; }
    scrim.hidden = false;
    if (opener) { opener.setAttribute('aria-expanded', 'true'); }
    var f = focusables(el);
    if (f.length) { f[0].focus(); }
    document.addEventListener('keydown', trapKey, true);
  }

  function closeSheet() {
    if (!openSheetEl) { return; }
    if (openSheetEl.classList.contains('receipt__body')) { openSheetEl.removeAttribute('data-open'); }
    else { openSheetEl.hidden = true; }
    scrim.hidden = true;
    if (sheetOpener) { sheetOpener.setAttribute('aria-expanded', 'false'); sheetOpener.focus(); }
    else if (btnPrimary && !btnPrimary.disabled) { btnPrimary.focus(); }
    openSheetEl = null; sheetOpener = null;
    document.removeEventListener('keydown', trapKey, true);
  }

  function trapKey(e) {
    if (!openSheetEl) { return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
    if (e.key !== 'Tab') { return; }
    var f = focusables(openSheetEl);
    if (!f.length) { return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- the 16,457 station ---------- */
  var SLOT_TEXT = {
    people: 'not established',
    cases: 'a different unit',
    transactions: 'documented'
  };
  var OPEN_RULE =
    '<span class="m-open-rule" role="img" aria-label="Not established">' +
    '<span class="m-open-rule__tick"></span><span class="m-open-rule__line"></span>' +
    '<span class="m-open-rule__tick"></span></span>';
  /* Each slot resolves into ITS OWN grammar, not a shared one. */
  var SLOT_MARK = {
    people:       OPEN_RULE + ' <span class="slot__word">not established</span>',
    cases:        '<span class="slot__word">a different unit</span>' +
                  '<span class="m-caption">sworn testimony, different unit</span>',
    transactions: '<span class="m-fact-bar m-fact-bar--sm">documented</span>'
  };
  var SLOT_UNKNOWN =
    '<span class="m-unknown" role="img" aria-label="Not yet resolved"></span>';
  var SLOT_SHEET = { people: 'sheetPeople', cases: 'sheetCases', transactions: 'sheetTransactions' };

  function resolveChip(name, opener) {
    if (!flags[name]) {
      flags[name] = true;
      var slot = document.querySelector('.slot[data-slot="' + name + '"]');
      if (slot) {
        slot.setAttribute('data-resolved', 'true');
        slot.querySelector('[data-slot-value]').innerHTML = SLOT_MARK[name];
      }
      if (opener) { opener.setAttribute('data-resolved', 'true'); }
      say(name.charAt(0).toUpperCase() + name.slice(1) + ': ' + SLOT_TEXT[name] + '.');
    }
    openSheet(document.getElementById(SLOT_SHEET[name]), opener);
    updateChipGate();
  }

  function chipCount() {
    return (flags.people ? 1 : 0) + (flags.cases ? 1 : 0) + (flags.transactions ? 1 : 0);
  }

  function updateChipGate() {
    if (state !== 's2') { return; }
    var n = chipCount();
    if (n === 3) {
      btnPrimary.disabled = false;
      btnPrimary.textContent = 'Continue';
      chipPrompt.textContent = 'The number has not changed. What it means has.';
      if (!flags.scopeSeen) {
        flags.scopeSeen = true;
        sq.setAttribute('data-gate', 'open');
        say('The three units are resolved. What this count covers is now shown below.');
      }
    } else {
      btnPrimary.disabled = true;
      btnPrimary.textContent = n + ' of 3';
      chipPrompt.textContent = 'What does this number count? Resolve all three.';
    }
  }

  /* A transform does not change layout. At s2 the card is drawn at
     CARD_S2_SCALE, so pull the leftover box height back with a negative
     margin, measured rather than hard-coded. */
  function fitCard() {
    if (state === 's2') {
      card.style.marginBottom = '';
      var h = card.offsetHeight;
      card.style.marginBottom = (-Math.round(h * (1 - CARD_S2_SCALE))) + 'px';
    } else {
      card.style.marginBottom = '';
    }
  }

  /* ---------- render ---------- */
  function render() {
    sq.setAttribute('data-state', state);
    sq.setAttribute('data-rm', reducedMotion() ? 'true' : 'false');

    if (state === 's2') { updateChipGate(); }
    else {
      /* while the action bar is off-screen the button must not be tabbable */
      var barGone = (state === 's3' || state === 's5' ||
                     (state === 's4' && !reducedMotion()));
      btnPrimary.disabled = barGone;
      btnPrimary.textContent = PRIMARY_LABEL[state] || '';
    }

    fitCard();

    var stn = STATE_STATION[state];
    railProgressTo(stn);
    paintStations(stn);

    btnBack.disabled = (history.length === 0) ||
                       state === 's3' || state === 's5' ||
                       (state === 's4' && !reducedMotion());
    say(ANNOUNCE[state]);
  }

  function go(next) {
    clearTimers();
    if (openSheetEl) { closeSheet(); }
    if (next !== state) { history.push(state); }
    state = next;
    render();
    onEnter(next);
  }

  function onEnter(s) {
    var rm = reducedMotion();

    if (s === 's3') {
      after(rm ? 0 : 400, function () { go2('s4'); });
    }

    if (s === 's4') {
      /* The completed beat: stamp landed, bar gone, nothing moving.
         Reduced motion stops here and the BUTTON carries the false ending. */
      sq.setAttribute('data-expiry', 'hidden');
      if (rm) { return; }
      after(1100, function () { go2('s5'); });
    }

    if (s === 's5') {
      sq.setAttribute('data-expiry', 'hidden');
      after(700,  function () { sq.setAttribute('data-expiry', 'resolving'); });
      after(1900, function () { go2('s6'); });
    }

    if (s === 's6') {
      sq.setAttribute('data-expiry', 'resolved');
      sq.setAttribute('data-loop', 'drawing');
      railLoop.style.strokeDashoffset = '0';
      if (rm) {
        sq.setAttribute('data-loop', 'drawn');
        buildRailList(STATE_STATION.s6);
      } else {
        after(900, function () {
          sq.setAttribute('data-loop', 'drawn');
          buildRailList(STATE_STATION.s6);
        });
      }
    }

    if (s === 's7') { sq.setAttribute('data-expiry', 'resolved'); }
  }

  /* internal advance that does not push history for auto transitions */
  function go2(next) {
    clearTimers();
    state = next;
    render();
    onEnter(next);
  }

  /* WCAG 2.2.1: every un-actionable pause in the false ending is skippable. */
  function skipHold() {
    if (state === 's4' && !reducedMotion()) { clearTimers(); go2('s5'); return true; }
    if (state === 's5') { clearTimers(); sq.setAttribute('data-expiry', 'resolved'); go2('s6'); return true; }
    return false;
  }

  function reset() {
    clearTimers();
    if (openSheetEl) { closeSheet(); }
    state = 's0';
    history = [];
    flags = { people: false, cases: false, transactions: false, scopeSeen: false };
    sq.removeAttribute('data-loop');
    sq.removeAttribute('data-expiry');
    sq.removeAttribute('data-gate');
    railLoop.style.strokeDashoffset = loopLen;
    var slots = document.querySelectorAll('.slot');
    for (var i = 0; i < slots.length; i++) {
      slots[i].removeAttribute('data-resolved');
      slots[i].querySelector('[data-slot-value]').innerHTML = SLOT_UNKNOWN;
    }
    var chips = document.querySelectorAll('.chip');
    for (var j = 0; j < chips.length; j++) {
      chips[j].removeAttribute('data-resolved');
      chips[j].setAttribute('aria-expanded', 'false');
    }
    render();
  }

  /* ---------- events ---------- */
  btnPrimary.addEventListener('click', function () {
    if (state === 's8') { reset(); return; }
    var i = ORDER.indexOf(state);
    if (state === 's2' && chipCount() < 3) { return; }
    if (state === 's4' && reducedMotion()) { go('s6'); return; }
    if (i < ORDER.length - 1) { go(ORDER[i + 1]); }
  });

  btnBack.addEventListener('click', function () {
    if (!history.length) { return; }
    clearTimers();
    if (openSheetEl) { closeSheet(); }
    var prev = history.pop();
    if (prev === 's3' || prev === 's4' || prev === 's5') { prev = 's2'; }
    state = prev;
    if (ORDER.indexOf(prev) < ORDER.indexOf('s6')) {
      sq.removeAttribute('data-loop');
      sq.removeAttribute('data-expiry');
      railLoop.style.strokeDashoffset = loopLen;
    }
    render();
  });

  btnRestart.addEventListener('click', reset);
  btnComp.addEventListener('click', function () {
    openSheet(document.getElementById('sheetComposite'), btnComp);
  });

  var chipEls = document.querySelectorAll('.chip');
  for (var c = 0; c < chipEls.length; c++) {
    (function (el) {
      el.addEventListener('click', function () { resolveChip(el.getAttribute('data-chip'), el); });
    })(chipEls[c]);
  }

  var triggers = document.querySelectorAll('.receipt__trigger');
  for (var t = 0; t < triggers.length; t++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        openSheet(document.getElementById(btn.getAttribute('aria-controls')), btn);
      });
    })(triggers[t]);
  }

  var closers = document.querySelectorAll('.sheet__close, .receipt__close');
  for (var k = 0; k < closers.length; k++) { closers[k].addEventListener('click', closeSheet); }
  scrim.addEventListener('click', closeSheet);

  /* tap anywhere skips the hold, except on real controls */
  document.addEventListener('pointerdown', function (e) {
    if (state !== 's4' && state !== 's5') { return; }
    if (e.target.closest && e.target.closest('.js-no-skip')) { return; }
    skipHold();
  }, true);

  document.addEventListener('keydown', function (e) {
    if ((state === 's4' || state === 's5') && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
      if (!openSheetEl) { e.preventDefault(); skipHold(); }
    }
  });

  if (rmQuery && rmQuery.addEventListener) {
    rmQuery.addEventListener('change', function () { render(); });
  }

  /* ---------- boot ---------- */
  document.documentElement.setAttribute('data-enhanced', 'true');
  var allSheets = document.querySelectorAll('.sheet');
  for (var q = 0; q < allSheets.length; q++) { allSheets[q].hidden = true; }
  scrim.hidden = true;
  buildRail();
  render();

  /* test hook */
  window.__sq = {
    get state() { return state; },
    get flags() { return flags; },
    go: go, reset: reset, skipHold: skipHold,
    gateOpen: function () { return sq.getAttribute('data-gate') === 'open'; },
    loopDrawn: function () { return sq.getAttribute('data-loop') === 'drawn'; }
  };
})();
