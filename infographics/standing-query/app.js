/* ============================================================
   The Standing Query — production script
   Restoring Democracy's Promise · infographics/standing-query/

   Adapted from the adversarially repaired prototype. One top-level
   data-state on #sq drives the visual state; CSS does the rest.
   Classic script on purpose: no modules, no bundler, no dependency.
   ============================================================ */
(function () {
  'use strict';

  /* ========================================================================
     EDITORIAL CONFIGURATION
     ARTICLE_URL — the full investigation on the Investigations Desk.
     Leave EMPTY until the final Substack URL is supplied by the editor; the
     "Read the full investigation" links stay hidden while it is empty.
     Do not invent a URL.
     ====================================================================== */
  var ARTICLE_URL = '';

  /* ---------- analytics (site-standard GoatCounter only) ----------
     Custom events ride on the aggregate counter already loaded at the end
     of the page. This never touches the state machine: it is called AFTER
     a transition, fires at most once per page load per event, and fails
     silently if the counter is absent or blocked. */
  var tracked = {};
  function track(name) {
    if (tracked[name]) { return; }
    tracked[name] = true;
    try {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: name, title: name, event: true });
      }
    } catch (e) { /* analytics must fail harmlessly */ }
  }

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
  var railFollow= document.getElementById('railFollowup');
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
    { id: 5, x: 237, y: 34, label: '16,457 transactions', dy: -11 },
    { id: 6, x: 292, y: 34, label: 'Issued',   dy: 16 },
    { id: 7, x: 168, y: 86, label: 'Status expires', loop: true }
  ];
  var STATION_NAMES = {
    1: 'Application', 2: 'Submission', 3: 'Clearinghouse',
    4: 'Response', 5: '16,457 initial verification transactions', 6: 'License issued'
  };
  /* The post-issuance follow-up is NOT a seventh step. It is announced only
     after the loop has been revealed, outside the six-step list. */
  var FOLLOWUP_TEXT = 'Post-issuance follow-up: the path returns to a status-expiration check — a contemplated recheck, documented procedure, not an observed event.';

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
    s2: 'The reports record 16,457 initial verification transactions. Three questions to resolve.',
    s3: '',
    s4: 'License issued. Application complete.',
    s5: '',
    s6: 'The file stays open. The case returns to the system.',
    s7: 'When the status expires. Documented procedure, not an observed event.',
    s8: 'End of the sequence. Source and response context.'
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
    /* Set the initial dash state WITHOUT animating it. Both paths carry a
       stroke-dashoffset transition; applied at boot, the first paint showed
       them fully drawn and retracting over 900ms — a cold-load flash of the
       loop's first arc inside the clip band, i.e. a telegraph. */
    railProg.style.transition = 'none';
    railLoop.style.transition = 'none';
    railProg.style.strokeDasharray = progLen;
    railProg.style.strokeDashoffset = progLen;
    railLoop.style.strokeDasharray = loopLen;
    railLoop.style.strokeDashoffset = loopLen;
    void railLoop.getBoundingClientRect();   /* commit before restoring the transition */
    railProg.style.transition = '';
    railLoop.style.transition = '';
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
    var drawn = sq.getAttribute('data-loop') === 'drawn';
    var html = '';
    for (var i = 0; i < STATIONS.length; i++) {
      var id = STATIONS[i].id;
      if (STATIONS[i].loop) { continue; }          /* never a seventh step */
      var status;
      if (currentId === 7 || id < currentId) { status = 'complete'; }
      else if (id === currentId) { status = 'current'; }
      else { status = 'not yet reached'; }
      html += '<li>' + STATION_NAMES[id] + ' — ' + status + '</li>';
    }
    railList.innerHTML = html;

    /* Before the reveal the follow-up does not exist for the reader. */
    if (drawn) {
      railFollow.textContent = FOLLOWUP_TEXT + (currentId === 7 ? ' Currently here.' : '');
    } else {
      railFollow.textContent = '';
    }

    var summary = drawn
      ? 'Progress: six of six licensing steps complete, and the path returns to a status-expiration check.'
      : 'Progress: step ' + Math.min(currentId, 6) + ' of six licensing steps.';
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
    /* Focus returns to the opener WITHOUT an animated scroll. A focus()
       that scrolls smoothly moves the sticky action bar for ~300ms, and a
       tap that follows the Close tap immediately lands on the bar's
       padding instead of the button. If the opener is entirely off-screen,
       bring it in instantly so the next tap has a settled layout. */
    var target = sheetOpener || ((btnPrimary && !btnPrimary.disabled) ? btnPrimary : null);
    if (sheetOpener) { sheetOpener.setAttribute('aria-expanded', 'false'); }
    if (target) { focusStill(target); }
    openSheetEl = null; sheetOpener = null;
    document.removeEventListener('keydown', trapKey, true);
  }

  function focusStill(el) {
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.bottom < 0 || r.top > vh) {
      try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); }
      catch (e2) { el.scrollIntoView(); }
    }
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
        track('standing_query_audit_complete');
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
      track('standing_query_loop_reveal');
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

    if (s === 's8') { track('standing_query_complete'); }
  }

  /* ---------- keeping the active content in view ----------
     Called only after USER-driven transitions (primary, back, restart),
     never from the auto-advancing s3→s6 run: scrolling during the false
     ending and the loop reveal would damage both. Honors reduced motion
     by jumping instead of gliding. */
  var NAV_OFFSET = 72;   /* matches html{scroll-padding-top} */
  var SETTLE_ANCHOR = {
    s0: function () { return sq; },
    s1: function () { return card; },
    s2: function () { return card; },
    /* s3 is entered by the reader's own tap at the gate. The card must be on
       screen BEFORE the stamp lands at s4: after the gate the reader has
       usually scrolled down through the scope text, and the page shrinks
       when the receipts leave. Nothing scrolls after this point until s7. */
    s3: function () { return card; },
    s7: function () { return document.querySelector('.panel[data-panel="s7"]'); },
    s8: function () { return document.querySelector('.panel[data-panel="s8"]'); }
  };
  function settle(s) {
    var pick = SETTLE_ANCHOR[s];
    if (!pick) { return; }
    var el = pick();
    if (!el) { return; }
    var top = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - NAV_OFFSET;
    if (top < 0) { top = 0; }
    var delta = top - (window.pageYOffset || document.documentElement.scrollTop);
    if (Math.abs(delta) < 24) { return; }
    try {
      window.scrollTo({ top: top, behavior: reducedMotion() ? 'instant' : 'smooth' });
    } catch (e) { window.scrollTo(0, top); }
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
    var wasStarted = state !== 's0' || history.length > 0;
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
    if (wasStarted) { settle('s0'); }
  }

  /* ---------- events ---------- */
  btnPrimary.addEventListener('click', function () {
    if (state === 's8') { reset(); return; }
    if (state === 's0') { track('standing_query_start'); }
    var i = ORDER.indexOf(state);
    if (state === 's2' && chipCount() < 3) { return; }
    if (state === 's4' && reducedMotion()) { go('s6'); return; }   /* the reveal: no scroll */
    if (i < ORDER.length - 1) { go(ORDER[i + 1]); settle(state); }
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
    settle(state);
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

  /* ---------- article CTA ----------
     Links carrying data-article-cta are hidden in the markup and only
     shown once ARTICLE_URL has been supplied. */
  var ctas = document.querySelectorAll('[data-article-cta]');
  for (var a = 0; a < ctas.length; a++) {
    (function (link) {
      if (ARTICLE_URL) {
        link.href = ARTICLE_URL;
        link.hidden = false;
        link.addEventListener('click', function () { track('standing_query_article_click'); });
      } else {
        link.hidden = true;
        link.removeAttribute('href');
      }
    })(ctas[a]);
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
    loopDrawn: function () { return sq.getAttribute('data-loop') === 'drawn'; },
    articleUrl: function () { return ARTICLE_URL; },
    navOffset: NAV_OFFSET,
    tracked: function () { return Object.keys(tracked); }
  };
})();
