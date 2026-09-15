/* Des Moines ALPR visual companion — progressive enhancement only.
   A relationship path is created whole after explicit selection. Nothing
   travels along it, it has no arrowhead, and the accessible status always
   names it as configuration rather than activity. */
(function () {
  'use strict';

  var page = document.body;
  var map = document.getElementById('visual-map');
  if (!page || !map) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var configured = Array.prototype.slice.call(map.querySelectorAll('.visual-state.is-configured'));
  var layer = document.getElementById('relationship-layer');
  var readout = document.getElementById('map-readout');
  var status = document.getElementById('map-status');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.scope-button'));
  var activeScope = 'all';
  var selected = null;
  var origin = map.querySelector('.des-moines-anchor').getAttribute('transform').match(/-?[\d.]+/g).map(Number);

  function clearRelationship() {
    selected = null;
    configured.forEach(function (state) {
      state.classList.remove('is-selected');
      state.setAttribute('aria-pressed', 'false');
    });
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    readout.querySelector('.map-readout-label').textContent = 'SELECT A STATE';
    readout.querySelector('.map-readout-value').textContent = 'See its export count';
  }

  function relationshipCurve(target) {
    var tx = Number(target.getAttribute('data-cx'));
    var ty = Number(target.getAttribute('data-cy'));
    var ox = origin[0];
    var oy = origin[1];
    var mx = (ox + tx) / 2;
    var lift = Math.min(90, Math.abs(tx - ox) * .22 + 28);
    return 'M ' + ox + ' ' + oy + ' Q ' + mx + ' ' + (Math.min(oy, ty) - lift) + ' ' + tx + ' ' + ty;
  }

  function selectState(state) {
    if (!state.classList.contains('is-in-scope')) return;
    clearRelationship();
    selected = state;
    state.classList.add('is-selected');
    state.setAttribute('aria-pressed', 'true');

    var code = state.getAttribute('data-state');
    var name = state.getAttribute('data-name');
    var count = Number(state.getAttribute('data-count'));
    if (code !== 'IA') {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'visual-relationship');
      path.setAttribute('data-relationship', 'configured');
      path.setAttribute('d', relationshipCurve(state));
      layer.appendChild(path);
    }

    readout.querySelector('.map-readout-label').textContent = name.toUpperCase();
    readout.querySelector('.map-readout-value').textContent = count + ' configured relationship' + (count === 1 ? '' : 's');
    status.textContent = name + ': ' + count + ' configured relationship' + (count === 1 ? '' : 's') + '. Configured relationship only — not a search, view or transfer.';
  }

  function setScope(scope) {
    activeScope = scope;
    clearRelationship();
    buttons.forEach(function (button) {
      var on = button.getAttribute('data-scope') === scope;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', String(on));
    });
    var visible = 0;
    configured.forEach(function (state) {
      var code = state.getAttribute('data-state');
      var inScope = scope === 'all' || (scope === 'iowa' ? code === 'IA' : code !== 'IA');
      state.classList.toggle('is-in-scope', inScope);
      state.setAttribute('tabindex', inScope ? '0' : '-1');
      if (inScope) visible++;
    });
    status.textContent = scope === 'all'
      ? 'Showing all 36 states and the District of Columbia represented in the export.'
      : scope === 'iowa'
        ? 'Showing Iowa: 14 configured relationships.'
        : 'Showing the 141 configured relationships outside Iowa.';
    return visible;
  }

  configured.forEach(function (state) {
    state.addEventListener('click', function () { selectState(state); });
    state.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectState(state);
      }
    });
  });
  buttons.forEach(function (button) {
    button.addEventListener('click', function () { setScope(button.getAttribute('data-scope')); });
  });

  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (node) { node.classList.add('is-visible'); });
    page.classList.add('visual-map-ready');
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    reveals.forEach(function (node) { observer.observe(node); });
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { page.classList.add('visual-map-ready'); });
    });
  }

  setScope(activeScope);
}());
