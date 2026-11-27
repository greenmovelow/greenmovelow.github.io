/* Declarative page actions — replaces inline on* handlers so the site's
   Content-Security-Policy can omit 'unsafe-inline' from script-src.

   <button data-action="shareThisPage">                → shareThisPage()
   <button data-action="toggleTier" data-action-args='["federal"]'>
                                                        → toggleTier('federal')
   Argument tokens: "$this" → the element itself,
                    "$parent" → the element's parentElement.
   data-action-keys="Enter Space" also runs the action on those keys
   (with preventDefault), for elements that act as buttons.

   The named function must be a global defined by the page's own script.
   No eval: the name is looked up on window and called directly. */
(function () {
  'use strict';

  function run(el) {
    var name = el.getAttribute('data-action');
    var fn = window[name];
    if (typeof fn !== 'function') {
      if (window.console) console.error('data-action: no global function "' + name + '"');
      return;
    }
    var args = [];
    var raw = el.getAttribute('data-action-args');
    if (raw) {
      try { args = JSON.parse(raw); } catch (e) { return; }
      if (!Array.isArray(args)) return;
      args = args.map(function (a) {
        return a === '$this' ? el : a === '$parent' ? el.parentElement : a;
      });
    }
    return fn.apply(window, args);
  }

  function actionTarget(event, selector) {
    var t = event.target;
    if (t && t.nodeType !== 1) t = t.parentElement;
    return t && t.closest ? t.closest(selector) : null;
  }

  document.addEventListener('click', function (event) {
    var el = actionTarget(event, '[data-action]');
    if (el) run(el);
  });

  document.addEventListener('keydown', function (event) {
    var el = actionTarget(event, '[data-action-keys]');
    if (!el) return;
    var key = event.key === ' ' ? 'Space' : event.key;
    if (el.getAttribute('data-action-keys').split(/\s+/).indexOf(key) === -1) return;
    event.preventDefault();
    run(el);
  });
})();
