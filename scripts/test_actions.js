// Runtime tests for /assets/js/actions.js (the data-action dispatcher).
// Run: npm run test:actions
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const code = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'actions.js'), 'utf8');

function setup(body) {
  const { window, document } = parseHTML(`<!DOCTYPE html><html><body>${body}</body></html>`);
  const calls = [];
  vm.runInNewContext(code, { window, document, Object, Array, JSON });
  return { window, document, calls };
}
function click(document, el) {
  el.dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
}
function key(document, el, k) {
  const ev = new document.defaultView.Event('keydown', { bubbles: true, cancelable: true });
  ev.key = k;
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}

const tests = {
  'registered action runs with $this, $parent and literal arguments'() {
    const { window, document } = setup(`<div id="card"><span id="h" data-action="copyCite" data-action-args='["c-1", "$this", "$parent", 2]'><b id="inner">x</b></span></div>`);
    const seen = [];
    window.copyCite = (...a) => seen.push(a);
    click(document, document.getElementById('inner')); // click on a child still finds the action element
    assert.equal(seen.length, 1);
    assert.equal(seen[0][0], 'c-1');
    assert.equal(seen[0][1], document.getElementById('h'));
    assert.equal(seen[0][2], document.getElementById('card'));
    assert.equal(seen[0][3], 2);
  },

  'callbacks are resolved when the action fires, not when actions.js loads'() {
    const { window, document } = setup(`<button id="b" data-action="shareThisPage">s</button>`);
    click(document, document.getElementById('b')); // page script not loaded yet: nothing happens
    let n = 0;
    window.shareThisPage = () => { n++; };          // page script defines it later
    click(document, document.getElementById('b'));
    assert.equal(n, 1);
  },

  'Enter and Space run keyboard actions with preventDefault; other keys do not'() {
    const { window, document } = setup(`<div id="c"><div id="h" data-action="toggleCard" data-action-args='["$parent"]' data-action-keys="Enter Space" tabindex="0"></div></div>`);
    const seen = [];
    window.toggleCard = el => seen.push(el.id);
    assert.equal(key(document, document.getElementById('h'), 'Enter'), true);
    assert.equal(key(document, document.getElementById('h'), ' '), true);
    assert.equal(key(document, document.getElementById('h'), 'a'), false);
    assert.deepEqual(seen, ['c', 'c']);
  },

  'unknown action names do nothing, even if a global of that name exists'() {
    const names = ['alert', 'eval', 'fetch', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'notARealAction'];
    const { window, document } = setup(names.map(n => `<button data-action="${n}" data-action-keys="Enter Space">${n}</button>`).join(''));
    let called = 0;
    for (const n of ['alert', 'eval', 'fetch', 'notARealAction']) window[n] = () => { called++; };
    for (const el of document.querySelectorAll('button')) {
      click(document, el);
      assert.equal(key(document, el, 'Enter'), false, `${el.textContent}: keydown was cancelled`);
    }
    assert.equal(called, 0);
  },

  'registered name without a page function does nothing'() {
    const { document } = setup(`<button id="b" data-action="showModal" data-action-keys="Enter">m</button>`);
    click(document, document.getElementById('b'));
    assert.equal(key(document, document.getElementById('b'), 'Enter'), false);
  },

  'malformed or non-array arguments do not run the action'() {
    const { window, document } = setup(`<button id="a" data-action="toggleTier" data-action-args='{"x":1}'></button><button id="b" data-action="toggleTier" data-action-args='not json'></button>`);
    let n = 0; window.toggleTier = () => { n++; };
    click(document, document.getElementById('a'));
    click(document, document.getElementById('b'));
    assert.equal(n, 0);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (err) { failed++; console.error(`not ok - ${name}\n${err.stack}`); }
}
if (failed) { console.error(`${failed} failed`); process.exit(1); }
