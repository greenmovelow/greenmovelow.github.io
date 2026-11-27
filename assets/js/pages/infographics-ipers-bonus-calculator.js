/* Moved from /infographics/ipers-bonus-calculator/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
  (function(){
    'use strict';

    var E = window.IPERSIncentiveEngine;

    /* ========================================================================
       EDITORIAL CONFIGURATION
       Change these two constants to point the exhibit at the story and, if the
       plan document is published as an asset, at the plan itself.
       ====================================================================== */

    /* Full URL of the accompanying article. */
    var ARTICLE_URL = 'https://investigations.restoring-democracy.org/p/the-formula-behind-the-25000-what';

    /* Path to the FY2025 plan PDF or an image crop of it. Leave as null when no
       such asset is published; the "View the Plan" button then does not render.
       Example: '/assets/docs/ipers/ipers-incentive-plan-fy2025.pdf' */
    var PLAN_DOCUMENT_URL = null;

    /* ========================================================================
       STATE
       ====================================================================== */

    var DEFAULTS = {
      rating: 'meets',
      salary: E.PLAN.cio.salary,
      maxPct: 50,          // percent of base salary
      publicPos: 0,        // slider position, 0..21 (21 = above the 0.20% goal)
      privatePos: 0,
      wInd: 20,
      wPub: 40,
      wPriv: 40
    };

    /* Slider positions are whole basis points, 0 through the plan's 20 bp goal.
       Every position therefore lands on a printed rung of the payout schedule. */
    var MAX_POS = E.PLAN.marketGoalBasisPoints;   // 20
    var state = Object.assign({}, DEFAULTS);

    /* ========================================================================
       FORMATTERS
       ====================================================================== */

    var usd = new Intl.NumberFormat('en-US', {
      style:'currency', currency:'USD', maximumFractionDigits:0
    });
    function money(v){ return usd.format(Math.round(v)); }

    /* Payout factors are exact multiples of 5% on the published ladder, but
       floating-point weighting leaves values like 0.15000000000000002. Round to
       two decimal places of a percent and drop trailing zeros. */
    function pct(v){
      return (Math.round(v * 10000) / 100) + '%';
    }
    function bpLabel(bp){
      var rounded = Math.round(bp * 100) / 100;
      return (rounded === 1 ? '1 basis point' : rounded + ' basis points');
    }
    function excessLabel(pos){
      return (pos / 100).toFixed(2) + '%';
    }

    /* Total excess, printed the way the plan's worked example prints it. */
    function totalExcessLabel(bp){
      var pctValue = bp / 100;
      var s = pctValue.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      return (s === '' || s === '0' ? '0' : s) + '%';
    }

    /* ========================================================================
       ELEMENTS
       ====================================================================== */

    var el = {};
    ['result','result-figure','result-sub','calc-value','payable-value',
     'gauge-fill','gauge-over','gauge-capline','gauge-caplabel','gauge-axis-max',
     'ineligible-notice','weights-notice','what-changed',
     'benchmark','benchmark-heading','benchmark-text',
     'lever','rating-name','rating-bp',
     'public-slider','public-display','public-factor','public-caption','public-ticks',
     'private-slider','private-display','private-factor','private-caption','private-ticks',
     'math-list','math-note',
     'salary-input','salary-slider','maxpct-input','maxpct-display','maxpct-dollars',
     'w-ind','w-pub','w-priv','weights-total','weights-warning','positions-table',
     'thresh-figure','thresh-label','thresh-label-val','thresh-mark','thresh-salary',
     'thresh-reached','thresh-caption','thresh-track',
     'live-region','freeze-pane','fp-label','fp-value','fp-status',
     'fp-fill','fp-over','fp-cap','ladder-grid','weights-rows',
     'copy-btn','copy-status','reset-btn','reset-btn-2','story-link','math-drawer'
    ].forEach(function(id){ el[id] = document.getElementById(id); });

    var levelOptions = Array.prototype.slice.call(el.lever.querySelectorAll('[role="radio"]'));

    /* ========================================================================
       URL PARAMETERS
       ====================================================================== */

    function clamp(v, lo, hi){ return Math.min(Math.max(v, lo), hi); }

    function readUrl(){
      var p = new URLSearchParams(window.location.search);
      if (!p.toString()) { return; }

      var rating = (p.get('rating') || '').toLowerCase();
      if (rating === 'meets' || rating === 'exceeds' || rating === 'fails'){ state.rating = rating; }

      var salary = parseFloat(p.get('salary'));
      if (isFinite(salary)){ state.salary = Math.round(clamp(salary, 75000, 500000)); }

      var maxPct = parseFloat(p.get('max'));
      if (isFinite(maxPct)){ state.maxPct = Math.round(clamp(maxPct, 10, 50)); }

      state.publicPos = readExcessParam(p.get('public'), state.publicPos);
      state.privatePos = readExcessParam(p.get('private'), state.privatePos);

      /* Weights keep their parsed precision. The live inputs accept decimals,
         and scenarioUrl() serialises them verbatim, so rounding here would
         turn a copied 33.3 / 33.3 / 33.4 link into an invalid 99% total. */
      [['wi','wInd'],['wpub','wPub'],['wpriv','wPriv']].forEach(function(pair){
        var v = parseFloat(p.get(pair[0]));
        if (isFinite(v)){ state[pair[1]] = clamp(v, 0, 100); }
      });
    }

    /* Excess parameters are percentage points: 0, 0.04, 0.2. A value above the
       plan's 0.20% goal lands on the "0.20%+" detent. */
    function readExcessParam(raw, fallback){
      if (raw === null || raw === ''){ return fallback; }
      var v = parseFloat(raw);
      if (!isFinite(v) || v < 0){ return fallback; }
      var bp = Math.round(v * 100);
      return clamp(bp, 0, MAX_POS);
    }

    function scenarioUrl(){
      var p = new URLSearchParams();
      p.set('salary', String(state.salary));
      p.set('rating', state.rating);
      p.set('public', (state.publicPos / 100).toFixed(2));
      p.set('private', (state.privatePos / 100).toFixed(2));
      p.set('max', String(state.maxPct));
      p.set('wi', String(state.wInd));
      p.set('wpub', String(state.wPub));
      p.set('wpriv', String(state.wPriv));
      return window.location.origin + window.location.pathname + '?' + p.toString();
    }

    /* ========================================================================
       NUMBER ROLL
       ====================================================================== */

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var rollHandles = {};

    function rollTo(node, key, from, to, format){
      if (rollHandles[key]){ cancelAnimationFrame(rollHandles[key]); }
      if (reduceMotion.matches || from === to){ node.textContent = format(to); return; }
      var start = null, duration = 420;
      function frame(ts){
        if (start === null){ start = ts; }
        var t = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        node.textContent = format(from + (to - from) * eased);
        if (t < 1){ rollHandles[key] = requestAnimationFrame(frame); }
      }
      rollHandles[key] = requestAnimationFrame(frame);
    }

    /* ========================================================================
       TICKS
       ====================================================================== */

    function buildTicks(container){
      var labelled = { 0:'0.00', 1:'0.01', 2:'0.02', 3:'0.03', 4:'0.04', 5:'0.05',
                       10:'0.10', 15:'0.15', 20:'0.20' };
      var narrowOnly = { 0:true, 5:true, 10:true, 15:true, 20:true };
      var html = '';
      for (var i = 0; i <= MAX_POS; i++){
        var left = (i / MAX_POS) * 100;
        var label = labelled[i];
        var classes = 'tick' + (label ? ' major' : '') + (label && !narrowOnly[i] ? ' hide-narrow' : '');
        html += '<span class="' + classes + '" style="left:' + left.toFixed(3) + '%">' +
                '<i></i>' + (label ? '<b>' + label + '</b>' : '') + '</span>';
      }
      container.innerHTML = html;
    }

    /* ========================================================================
       RENDER
       ====================================================================== */

    var previous = { award: null, threshold: null };

    function currentInput(){
      return {
        rating: state.rating,
        salary: state.salary,
        maxIncentivePct: state.maxPct / 100,
        publicExcessBp: state.publicPos,
        privateExcessBp: state.privatePos,
        weightIndividual: state.wInd / 100,
        weightPublic: state.wPub / 100,
        weightPrivate: state.wPriv / 100,
        cap: E.PLAN.perPersonCap
      };
    }

    function render(){
      var input = currentInput();
      var r = E.calculate(input);

      renderControls(r);
      renderResult(r);
      renderMath(r, input);
      renderThreshold(input);
      announce(r);
    }

    /* ---------- Controls ---------- */
    function renderControls(r){
      // Personnel lever
      var index = { fails:0, meets:1, exceeds:2 }[state.rating];
      el.lever.setAttribute('data-pos', String(index));
      levelOptions.forEach(function(btn, i){
        var on = i === index;
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
      var names = { fails:'Fails to Meet Expectations', meets:'Meets Expectations', exceeds:'Exceeds Expectations' };
      el['rating-name'].textContent = names[state.rating];
      el['rating-bp'].textContent = r.individualBp === null ? 'Not eligible' : r.individualBp + ' basis points';

      // Market dials
      renderDial('public', state.publicPos, r.weightedPublicBp, state.wPub);
      renderDial('private', state.privatePos, r.weightedPrivateBp, state.wPriv);

      // Advanced
      setFieldValue(el['salary-input'], String(state.salary));
      el['salary-slider'].value = String(state.salary);
      setFill(el['salary-slider']);
      el['maxpct-input'].value = String(state.maxPct);
      el['maxpct-input'].setAttribute('aria-valuetext', state.maxPct + ' percent of base salary');
      setFill(el['maxpct-input']);
      el['maxpct-display'].textContent = state.maxPct + '%';
      el['maxpct-dollars'].textContent = money(r.maximumIncentive);
      setFieldValue(el['w-ind'], String(state.wInd));
      setFieldValue(el['w-pub'], String(state.wPub));
      setFieldValue(el['w-priv'], String(state.wPriv));

      /* Validity comes from the engine so the warning can never disagree with
         the calculation; the printed total is rounded only to keep
         floating-point noise out of the label. */
      var total = Math.round((state.wInd + state.wPub + state.wPriv) * 1e6) / 1e6;
      el['weights-total'].textContent = 'Total: ' + total + '%';
      el['weights-warning'].hidden = r.weightsValid;
      el['weights-total'].style.color = r.weightsValid ? 'var(--muted)' : 'var(--alert)';
    }

    /* Writing to a focused number field mid-entry rewrites what the reader is
       typing. Partial input is left alone and committed on blur instead. */
    function setFieldValue(node, value){
      if (document.activeElement === node){ return; }
      node.value = value;
    }

    /* The payout schedule is read against the TOTAL excess, not against each
       component, so a component's readout reports what it contributes to that
       total rather than a payout factor of its own. */
    function renderDial(which, pos, weightedBp, weightPct){
      var slider = el[which + '-slider'];
      var display = el[which + '-display'];
      var factorTag = el[which + '-factor'];
      var caption = el[which + '-caption'];

      slider.value = String(pos);
      setFill(slider);
      display.textContent = excessLabel(pos);

      if (pos === 0){
        factorTag.textContent = 'No positive excess return assumed';
        caption.innerHTML = '<strong>0.00% = exactly matches the applicable benchmark</strong>';
        slider.setAttribute('aria-valuetext',
          '0.00 percent — exactly matches the applicable benchmark; no positive excess return assumed');
      } else {
        factorTag.textContent = 'Adds ' + bpShort(weightedBp) + ' to the total excess';
        caption.innerHTML = '<strong>' + excessLabel(pos) + '</strong> above the applicable benchmark &mdash; weighted at ' +
                            weightPct + '%, this adds ' + bpShort(weightedBp) + ' to the total excess.';
        slider.setAttribute('aria-valuetext',
          excessLabel(pos) + ' above the applicable benchmark, weighted at ' + weightPct +
          ' percent, adding ' + bpShort(weightedBp) + ' to the total excess');
      }
    }

    /* Paints the filled portion of a range track in WebKit. */
    function setFill(slider){
      var min = parseFloat(slider.min), max = parseFloat(slider.max);
      var frac = (parseFloat(slider.value) - min) / (max - min);
      slider.style.setProperty('--fill', (frac * 100).toFixed(2) + '%');
    }

    /* ---------- Result ---------- */
    function renderResult(r){
      var valid = r.weightsValid;
      el['weights-notice'].hidden = valid;
      el['ineligible-notice'].hidden = !(valid && !r.eligible);

      if (!valid){
        el.result.setAttribute('data-capped', 'false');
        el['result-figure'].textContent = 'Unavailable';
        el['result-sub'].innerHTML = 'Set the component weights to total 100%.';
        setGauge(0, 0, E.PLAN.perPersonCap * 1.4);
        el['what-changed'].textContent = 'The component weights do not total 100%, so no result is calculated.';
        setFreezePane('invalid', 'Result unavailable', 'Weights must total 100%', '');
        setFreezeGauge(0, 0, E.PLAN.perPersonCap * 1.4);
        renderBenchmark();
        renderLadder(null);
        previous.award = null;
        return;
      }

      var payable = r.payableAward;
      var capped = r.capBinds;
      el.result.setAttribute('data-capped', capped ? 'true' : 'false');

      var from = previous.award === null ? payable : previous.award;
      rollTo(el['result-figure'], 'award', from, payable, money);
      previous.award = payable;

      if (!r.eligible){
        el['result-sub'].innerHTML = 'Not eligible for incentive compensation';
      } else if (capped){
        el['result-sub'].innerHTML = 'The calculated amount crosses the <span class="em">$25,000</span> payment ceiling';
        el['calc-value'].textContent = money(r.calculatedAward);
        el['payable-value'].textContent = money(payable);
      } else {
        var share = Math.round((payable / r.cap) * 100);
        el['result-sub'].innerHTML = '<span class="em">' + share + '%</span> of the ' + money(r.cap) + ' ceiling';
      }

      // Gauge: fixed headroom above the ceiling unless the calculation runs past it.
      var axisMax = Math.max(r.cap * 1.4, r.calculatedAward * 1.08);
      setGauge(payable, r.calculatedAward, axisMax);
      setFreezeGauge(payable, r.calculatedAward, axisMax);

      el['what-changed'].textContent = buildSentence(r);
      renderBenchmark();

      renderLadder(r);

      if (!r.eligible){
        setFreezePane('ineligible', 'Hypothetical award', money(0), 'Not eligible');
      } else if (capped){
        /* Both numbers stay on screen: the point of the exhibit is that the
           calculation crossed the ceiling, not merely that the cap exists. */
        setFreezePane('capped', 'Calculated', money(r.calculatedAward),
                      'Payable<b>' + money(payable) + '</b>Cap applies');
      } else {
        setFreezePane('uncapped', 'Hypothetical award', money(payable),
                      Math.round((payable / r.cap) * 100) + '% of ' + money(r.cap) + ' cap');
      }
    }

    /* ---------- Frozen result pane ----------
       A mirror of the full result card, driven by the same calculated object.
       No second calculation, and no second live region. */
    function setFreezePane(stateName, label, value, status){
      el['freeze-pane'].setAttribute('data-state', stateName);
      el['fp-label'].textContent = label;
      el['fp-value'].textContent = value;
      el['fp-status'].innerHTML = status;
    }

    /* The compact gauge uses the same scale as the main one, so the two read
       consistently as the reader scrolls between them. */
    function setFreezeGauge(payable, calculated, axisMax){
      var capPct = (E.PLAN.perPersonCap / axisMax) * 100;
      el['fp-fill'].style.width = ((payable / axisMax) * 100).toFixed(2) + '%';
      el['fp-over'].style.left = capPct.toFixed(2) + '%';
      el['fp-over'].style.width =
        Math.max(0, ((calculated - E.PLAN.perPersonCap) / axisMax) * 100).toFixed(2) + '%';
      el['fp-cap'].style.left = capPct.toFixed(2) + '%';
    }

    /* ---------- Payout schedule: highlight the rung actually applied ---------- */
    function renderLadder(r){
      var applied = (r && r.weightsValid && r.eligible && r.appliedRung)
        ? r.appliedRung.basisPoints : null;
      el['ladder-grid'].innerHTML = E.PAYOUT_SCHEDULE.map(function(rung){
        var on = rung.basisPoints === applied ? ' class="applied"' : '';
        return '<div' + on + '><b>' + rung.excessPct.toFixed(2) + '%</b><span>' +
               Math.round(rung.factor * 100) + '%</span></div>';
      }).join('');
    }

    function setGauge(payable, calculated, axisMax){
      var capPct = (E.PLAN.perPersonCap / axisMax) * 100;
      var payPct = (payable / axisMax) * 100;
      var overPct = Math.max(0, ((calculated - E.PLAN.perPersonCap) / axisMax) * 100);

      el['gauge-fill'].style.width = payPct.toFixed(2) + '%';
      el['gauge-over'].style.left = capPct.toFixed(2) + '%';
      el['gauge-over'].style.width = overPct.toFixed(2) + '%';
      el['gauge-capline'].style.left = capPct.toFixed(2) + '%';
      el['gauge-caplabel'].style.left = capPct.toFixed(2) + '%';
      el['gauge-axis-max'].textContent = money(axisMax);

      el['gauge-caplabel'].textContent = money(E.PLAN.perPersonCap) + ' ceiling';
      document.getElementById('gauge-track').setAttribute('aria-label',
        'Gauge: hypothetical calculated award ' + money(calculated) +
        ', payable ' + money(payable) + ', against a ' + money(E.PLAN.perPersonCap) + ' payment ceiling.');
    }

    /* ---------- Benchmark callout ---------- */
    function renderBenchmark(){
      var bothZero = state.publicPos === 0 && state.privatePos === 0;
      el.benchmark.setAttribute('data-state', bothZero ? 'matched' : 'excess');

      if (bothZero){
        el['benchmark-heading'].textContent = 'No investment outperformance assumed';
        el['benchmark-text'].textContent = 'Both investment components are set to exactly match their applicable benchmarks.';
      } else {
        el['benchmark-heading'].textContent = 'Market excess return assumed';
        el['benchmark-text'].textContent =
          'Public market: ' + excessLabel(state.publicPos) + ' above its applicable benchmark. ' +
          'Private market: ' + excessLabel(state.privatePos) + ' above its applicable benchmark.';
      }
    }

    /* ---------- "What changed?" ---------- */
    function isCioPreset(){
      return state.salary === DEFAULTS.salary && state.maxPct === DEFAULTS.maxPct &&
             state.wInd === DEFAULTS.wInd && state.wPub === DEFAULTS.wPub && state.wPriv === DEFAULTS.wPriv;
    }

    function buildSentence(r){
      if (!r.eligible){
        return 'Under the published plan, an employee who fails to meet expectations is not eligible for incentive compensation, so the formula produces no award regardless of market performance.';
      }

      var bothZero = state.publicPos === 0 && state.privatePos === 0;
      var who = isCioPreset() ? 'the CIO’s 2025 salary of ' + money(state.salary)
                              : 'a ' + money(state.salary) + ' salary at a ' + state.maxPct + '% maximum incentive';

      if (bothZero){
        if (state.rating === 'meets'){
          if (r.capBinds){
            return 'With both market components exactly matching their benchmarks, a “Meets Expectations” rating alone produces a calculated award above the ' + money(r.cap) + ' ceiling at ' + who + '.';
          }
          return 'With both market components exactly matching their benchmarks, a “Meets Expectations” rating alone produces about ' +
                 Math.round((r.payableAward / r.cap) * 100) + '% of the ' + money(r.cap) + ' ceiling at ' + who + '.';
        }
        if (r.capBinds){
          return 'With both market components exactly matching their benchmarks, an “Exceeds Expectations” rating alone produces a calculated award above the ' + money(r.cap) + ' ceiling at ' + who + '.';
        }
        return 'With both market components exactly matching their benchmarks, an “Exceeds Expectations” rating alone produces about ' +
               Math.round((r.payableAward / r.cap) * 100) + '% of the ' + money(r.cap) + ' ceiling at ' + who + '.';
      }

      var parts = [];
      if (state.publicPos > 0){ parts.push('public-market excess'); }
      if (state.privatePos > 0){ parts.push('private-market excess'); }
      var subject = parts.length === 2 ? 'Positive public- and private-market excess add' : 'Positive ' + parts[0] + ' adds';

      var head = subject + ' to the personnel component under the plan’s weighted formula, for a total excess of ' +
                 totalExcessLabel(r.blendedBp) + '.';

      /* The schedule is a set of printed rungs. Between them the award does not
         move, and saying so is the honest reading of the plans' own example. */
      var rung = r.appliedRung
        ? ' That reads the ' + r.appliedRung.excessPct.toFixed(2) + '% rung of the published schedule, a ' +
          pct(r.appliedRung.factor) + ' payout factor.'
        : ' That falls below the schedule’s first printed rung of 0.01%, so no payout factor applies.';

      var tail = r.capBinds
        ? ' The calculated award crosses the ' + money(r.cap) + ' payment ceiling; ' + money(r.payableAward) + ' is payable under the FY2025 cap.'
        : ' The calculated award reaches ' + Math.round((r.payableAward / r.cap) * 100) + '% of the ' + money(r.cap) + ' ceiling.';

      return head + rung + tail;
    }

    /* ---------- Show the math ---------- */
    function renderMath(r, input){
      var rows = [];

      if (!r.weightsValid){
        el['math-list'].innerHTML = '<li><span class="k">Component weights</span><span class="v">' +
          r.weightsTotal * 100 + '% — must total 100%</span></li>';
        el['math-note'].textContent = 'Set the three component weights to total 100% to see the calculation.';
        return;
      }

      if (!r.eligible){
        rows.push(['Personnel rating', 'Fails to Meet Expectations', '']);
        rows.push(['Eligibility', 'Not eligible', '']);
        rows.push(['Final', money(0), 'total']);
        el['math-list'].innerHTML = rows.map(rowHtml).join('');
        el['math-note'].textContent = 'A rating below “Meets Expectations” disqualifies an employee from incentive compensation outright, so no further calculation is performed.';
        return;
      }

      rows.push(['Individual rating', r.individualBp + ' bp', '']);
      rows.push(['Weighted contribution', r.individualBp + ' bp × ' + state.wInd + '% = ' + bpShort(r.weightedIndividualBp), 'step']);
      rows.push(['Public-market excess', excessLabel(state.publicPos), '']);
      rows.push(['Weighted contribution', bpShort(r.publicBp) + ' × ' + state.wPub + '% = ' + bpShort(r.weightedPublicBp), 'step']);
      rows.push(['Private-market excess', excessLabel(state.privatePos), '']);
      rows.push(['Weighted contribution', bpShort(r.privateBp) + ' × ' + state.wPriv + '% = ' + bpShort(r.weightedPrivateBp), 'step']);
      rows.push(['Total excess', bpShort(r.blendedBp) + ' = ' + totalExcessLabel(r.blendedBp), 'step']);

      if (r.appliedRung){
        rows.push(['Payout schedule rung applied',
                   r.appliedRung.excessPct.toFixed(2) + '% → ' + pct(r.appliedRung.factor), 'step']);
      } else {
        rows.push(['Payout schedule rung applied', 'below the 0.01% rung → 0%', 'step']);
      }

      rows.push(['Maximum incentive', state.maxPct + '% of ' + money(state.salary) + ' = ' + money(r.maximumIncentive), '']);
      rows.push(['Calculated hypothetical award',
                 pct(r.payoutFactor) + ' × ' + money(r.maximumIncentive) + ' = ' + money(r.calculatedAward), '']);
      rows.push(['Payment ceiling', money(r.cap), '']);
      rows.push([r.capBinds ? 'Final payable' : 'Final', money(r.payableAward), 'total']);

      el['math-list'].innerHTML = rows.map(rowHtml).join('');

      var notes = [];
      if (r.capBinds){
        notes.push('The calculated result of ' + money(r.calculatedAward) + ' crosses the ' + money(r.cap) +
                   ' per-person ceiling, so ' + money(r.payableAward) + ' is payable under the FY2025 cap.');
      }
      if (r.betweenRungs){
        notes.push('A total excess of ' + totalExcessLabel(r.blendedBp) +
                   ' falls between printed rungs, so the calculator uses the lower published rung (' +
                   r.appliedRung.excessPct.toFixed(2) + '%). That follows IPERS’s own worked example, in which a 0.054% total excess pays the 0.05% rung’s 25% — an example that recurs unchanged in the FY2023/4, FY2024 and FY2025 plans. None of them separately states a general rounding rule.');
      }
      if (r.atPlateau){
        notes.push('At or above 0.20% the schedule pays 100%: anything above the plan’s 20-basis-point goal pays what 20 basis points pays.');
      }
      notes.push('Public- and private-market performance are calculated separately, then weighted into the single total excess the schedule is read against.');
      el['math-note'].textContent = notes.join(' ');
    }

    function bpShort(bp){
      var v = Math.round(bp * 1000) / 1000;
      return v + ' bp';
    }

    function rowHtml(row){
      var cls = row[2] ? ' class="' + row[2] + '"' : '';
      return '<li' + cls + '><span class="k">' + row[0] + '</span><span class="v tnum">' + row[1] + '</span></li>';
    }

    /* ---------- Threshold explorer ---------- */
    var THRESH_MIN = 75000, THRESH_MAX = 500000;

    function renderThreshold(input){
      var threshold = E.calculateCapThresholdSalary({
        rating: 'exceeds',
        weightIndividual: input.weightIndividual,
        maxIncentivePct: input.maxIncentivePct,
        cap: input.cap
      });

      var salaryPos = ((state.salary - THRESH_MIN) / (THRESH_MAX - THRESH_MIN)) * 100;
      el['thresh-salary'].style.left = clamp(salaryPos, 0, 100).toFixed(2) + '%';

      if (!input.weightIndividual || threshold === null || !isFinite(threshold)){
        el['thresh-figure'].textContent = 'Not applicable';
        el['thresh-label'].style.display = 'none';
        el['thresh-mark'].style.display = 'none';
        el['thresh-reached'].style.left = '100%';
        el['thresh-caption'].textContent = 'With the current settings the individual-performance component contributes no payout factor, so an “Exceeds Expectations” rating alone never reaches the ceiling at any salary.';
        previous.threshold = null;
        return;
      }

      el['thresh-label'].style.display = '';
      el['thresh-mark'].style.display = '';

      var from = previous.threshold === null ? threshold : previous.threshold;
      rollTo(el['thresh-figure'], 'threshold', from, threshold, money);
      previous.threshold = threshold;
      el['thresh-label-val'].textContent = money(threshold);

      var markPos = ((threshold - THRESH_MIN) / (THRESH_MAX - THRESH_MIN)) * 100;
      var withinAxis = markPos >= 0 && markPos <= 100;
      var clamped = clamp(markPos, 0, 100);
      el['thresh-mark'].style.left = clamped.toFixed(2) + '%';
      el['thresh-label'].style.left = clamp(markPos, 8, 92).toFixed(2) + '%';
      el['thresh-reached'].style.left = clamped.toFixed(2) + '%';

      var caption = 'At a ' + state.maxPct + '% maximum incentive, an “Exceeds Expectations” personnel rating reaches a ' +
                    money(input.cap) + ' ceiling at ' + money(threshold) +
                    ' or above, even with zero positive market excess.';
      if (!withinAxis){
        caption += ' That threshold falls outside the scale shown.';
      }
      el['thresh-caption'].textContent = caption;
      el['thresh-track'].setAttribute('aria-label',
        'Salary scale from ' + money(THRESH_MIN) + ' to ' + money(THRESH_MAX) + '. Cap threshold at ' +
        money(threshold) + '. Current salary ' + money(state.salary) + '.');
    }

    /* ---------- Live region ---------- */
    var announceTimer = null;
    function announce(r){
      if (announceTimer){ clearTimeout(announceTimer); }
      announceTimer = setTimeout(function(){
        var msg;
        if (!r.weightsValid){
          msg = 'Result unavailable. The component weights must total 100 percent.';
        } else if (!r.eligible){
          msg = 'Not eligible for incentive compensation. Hypothetical calculated award: zero dollars.';
        } else if (r.capBinds){
          msg = 'Hypothetical calculated award ' + money(r.calculatedAward) + ', above the ' +
                money(r.cap) + ' payment ceiling. Payable under the FY2025 cap: ' + money(r.payableAward) + '.';
        } else {
          msg = 'Hypothetical calculated award ' + money(r.payableAward) + ', ' +
                Math.round((r.payableAward / r.cap) * 100) + ' percent of the ' + money(r.cap) + ' ceiling.';
        }
        el['live-region'].textContent = msg;
      }, 350);
    }

    /* ========================================================================
       EVENTS
       ====================================================================== */

    /* ---------- Personnel lever: click + roving-tabindex keyboard ---------- */
    levelOptions.forEach(function(btn, i){
      btn.addEventListener('click', function(){
        state.rating = btn.getAttribute('data-rating');
        render();
      });
      btn.addEventListener('keydown', function(evt){
        var next = null;
        if (evt.key === 'ArrowRight' || evt.key === 'ArrowDown'){ next = (i + 1) % levelOptions.length; }
        else if (evt.key === 'ArrowLeft' || evt.key === 'ArrowUp'){ next = (i - 1 + levelOptions.length) % levelOptions.length; }
        else if (evt.key === 'Home'){ next = 0; }
        else if (evt.key === 'End'){ next = levelOptions.length - 1; }
        else if (evt.key === ' ' || evt.key === 'Enter'){
          evt.preventDefault();
          state.rating = btn.getAttribute('data-rating');
          render();
          return;
        }
        if (next !== null){
          evt.preventDefault();
          state.rating = levelOptions[next].getAttribute('data-rating');
          render();
          levelOptions[next].focus();
        }
      });
    });

    /* ---------- Market dials ---------- */
    el['public-slider'].addEventListener('input', function(){
      state.publicPos = parseInt(this.value, 10); render();
    });
    el['private-slider'].addEventListener('input', function(){
      state.privatePos = parseInt(this.value, 10); render();
    });

    /* ---------- Advanced ---------- */
    el['salary-slider'].addEventListener('input', function(){
      state.salary = parseInt(this.value, 10); render();
    });
    /* While typing, only an in-range value is committed: clamping a partial
       entry such as "2" to $75,000 would rewrite the field mid-keystroke and
       make ordinary entry of "250000" impossible. Out-of-range or unfinished
       input is clamped once, on blur. */
    el['salary-input'].addEventListener('input', function(){
      var v = parseInt(this.value, 10);
      if (isFinite(v) && v >= 75000 && v <= 500000){
        state.salary = v;
        render();
      }
    });
    function commitSalary(){
      var v = parseInt(el['salary-input'].value, 10);
      if (isFinite(v)){ state.salary = Math.round(clamp(v, 75000, 500000)); }
      render();
      el['salary-input'].value = String(state.salary);
    }
    el['salary-input'].addEventListener('change', commitSalary);
    el['salary-input'].addEventListener('blur', commitSalary);
    el['maxpct-input'].addEventListener('input', function(){
      state.maxPct = parseInt(this.value, 10); render();
    });

    /* Same rule as the salary field: an empty box is someone mid-edit, not a
       weight of zero, so state is left alone until the value parses. */
    [['w-ind','wInd'],['w-pub','wPub'],['w-priv','wPriv']].forEach(function(pair){
      el[pair[0]].addEventListener('input', function(){
        var v = parseFloat(this.value);
        if (isFinite(v)){ state[pair[1]] = clamp(v, 0, 100); render(); }
      });
      function commitWeight(){
        var v = parseFloat(el[pair[0]].value);
        state[pair[1]] = isFinite(v) ? clamp(v, 0, 100) : 0;
        render();
        el[pair[0]].value = String(state[pair[1]]);
      }
      el[pair[0]].addEventListener('change', commitWeight);
      el[pair[0]].addEventListener('blur', commitWeight);
    });

    /* ---------- Reset ---------- */
    function reset(){
      state = Object.assign({}, DEFAULTS);
      render();
      el['copy-status'].textContent = 'Reset to the 2025 CIO example.';
    }
    el['reset-btn'].addEventListener('click', reset);
    el['reset-btn-2'].addEventListener('click', reset);

    /* ---------- Copy scenario ---------- */
    el['copy-btn'].addEventListener('click', function(){
      var url = scenarioUrl();
      function done(){
        el['copy-status'].textContent = 'Link copied. It reproduces exactly these inputs.';
      }
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(done).catch(function(){
          window.prompt('Copy this scenario link:', url);
        });
      } else {
        window.prompt('Copy this scenario link:', url);
      }
      if (window.history && window.history.replaceState){
        window.history.replaceState(null, '', url);
      }
    });

    /* The frozen pane needs no scroll observer: `position: sticky` inside the
       workbench handles pinning and release on its own. */

    /* ========================================================================
       INIT
       ====================================================================== */

    buildTicks(el['public-ticks']);
    buildTicks(el['private-ticks']);

    // Published maximum-incentive percentages by position.
    el['positions-table'].innerHTML = E.PUBLISHED_MAXIMUMS_BY_POSITION.map(function(p){
      return '<li><span>' + p.title + '</span><span>' +
             Math.round(p.maxIncentivePct * 100) + '%</span></li>';
    }).join('');

    // Published component weights, row by row. Repeated titles with different
    // splits are exactly why no generic title preset is offered.
    el['weights-rows'].innerHTML = E.PUBLISHED_WEIGHT_ROWS.map(function(row){
      var w = Math.round(row.individual * 100) + ' / ' + Math.round(row.public * 100) +
              ' / ' + Math.round(row.private * 100);
      return '<li><span>' + row.title + (row.preset ? ' <em>(preset)</em>' : '') +
             '</span><span>' + w + '</span></li>';
    }).join('');

    // Editorial links.
    el['story-link'].href = ARTICLE_URL;
    if (PLAN_DOCUMENT_URL){
      var planBtn = document.createElement('a');
      planBtn.className = 'btn btn-ghost';
      planBtn.href = PLAN_DOCUMENT_URL;
      planBtn.target = '_blank';
      planBtn.rel = 'noopener noreferrer';
      planBtn.textContent = 'View the Plan';
      el['story-link'].parentNode.appendChild(planBtn);
    }

    readUrl();
    render();

    // Open "Show the math" by default on wider screens, where there is room.
    if (window.matchMedia('(min-width:900px)').matches){
      el['math-drawer'].open = true;
    }
  })();
