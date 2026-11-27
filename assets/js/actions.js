/* Declarative page actions — replaces inline on* handlers so the site's
   Content-Security-Policy can omit 'unsafe-inline' from script-src.

   <button data-action="shareThisPage">                → shareThisPage()
   <button data-action="toggleTier" data-action-args='["federal"]'>
                                                        → toggleTier('federal')
   Argument tokens: "$this" → the element itself,
                    "$parent" → the element's parentElement.
   data-action-keys="Enter Space" also runs the action on those keys
   (with preventDefault), for elements that act as buttons.

   Only the names in REGISTRY can run; any other data-action does nothing.
   Each entry returns the page's own function for that action. It is
   resolved when the action fires, not when this file loads, because the
   page scripts that define these functions run later, and several pages
   define their own version of the same name (showTab, showModal,
   shareExhibit, shareThisPage). No eval.

   Adding an action: add its name here. scripts/audit_csp.py fails CI when
   static or JS-generated markup uses a name that is not in REGISTRY. */
(function () {
  'use strict';

  var REGISTRY = Object.freeze({
    copyCite: function () { return window.copyCite; },
    copyLink: function () { return window.copyLink; },
    highlightAndShowComponent: function () { return window.highlightAndShowComponent; },
    reveal: function () { return window.reveal; },
    scrollToTimeline: function () { return window.scrollToTimeline; },
    scrollToTop: function () { return window.scrollToTop; },
    shareExhibit: function () { return window.shareExhibit; },
    shareThisPage: function () { return window.shareThisPage; },
    showModal: function () { return window.showModal; },
    showTab: function () { return window.showTab; },
    switchLayer: function () { return window.switchLayer; },
    toggleCard: function () { return window.toggleCard; },
    toggleNode: function () { return window.toggleNode; },
    toggleOpen: function () { return window.toggleOpen; },
    toggleTier: function () { return window.toggleTier; }
  });

  function resolve(name) {
    if (!Object.prototype.hasOwnProperty.call(REGISTRY, name)) return null;
    var fn = REGISTRY[name]();
    return typeof fn === 'function' ? fn : null;
  }

  function run(el, fn) {
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
    var fn = el && resolve(el.getAttribute('data-action'));
    if (fn) run(el, fn);
  });

  document.addEventListener('keydown', function (event) {
    var el = actionTarget(event, '[data-action-keys]');
    if (!el) return;
    var key = event.key === ' ' ? 'Space' : event.key;
    if (el.getAttribute('data-action-keys').split(/\s+/).indexOf(key) === -1) return;
    var fn = resolve(el.getAttribute('data-action'));
    if (!fn) return;
    event.preventDefault();
    run(el, fn);
  });
})();
