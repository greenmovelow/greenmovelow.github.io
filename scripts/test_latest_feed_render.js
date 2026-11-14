// Regression tests for the homepage latest-feed refresh script.
//
// The rows in #latest-feed are pre-rendered into index.html by
// scripts/build_latest_investigations.py and refreshed in the browser by the
// inline script in index.html. If the two renderers ever disagreed, a refresh
// would visibly re-lay out the list (a layout shift). These tests run the real
// inline script against a DOM built from the committed index.html and check:
//   1. JS rendering of the committed JSON equals the pre-rendered rows.
//   2. An unchanged feed leaves the pre-rendered DOM untouched.
//   3. A newer feed replaces the rows and announces the update.
//   4. Failed, malformed, or empty JSON keeps the pre-rendered rows.
//   5. Without fetch(), the pre-rendered rows stay.
//
// Run: npm run test:feed
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const feedJson = JSON.parse(fs.readFileSync(path.join(root, 'latest-investigations.json'), 'utf8'));

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const feedScript = scripts.find(([, , body]) => body.includes("'/latest-investigations.json'"));
assert.ok(feedScript, 'feed refresh script not found in index.html');
assert.match(feedScript[1], /data-cfasync="false"/, 'feed script must opt out of Rocket Loader deferral');

function rowsHTML(list) {
  // Element children only: the generator markers are comments.
  return [...list.children].map(el => el.outerHTML).join('');
}

async function run({ json, status = 200, noFetch = false, mutate } = {}) {
  const { window, document } = parseHTML(html);
  const list = document.getElementById('latest-feed');
  if (mutate) mutate(list, document);
  const before = [...list.children];
  const sandbox = { window, document, console };
  if (!noFetch) {
    const fetch = async () => ({
      ok: status >= 200 && status < 300,
      json: async () => (typeof json === 'string' ? JSON.parse(json) : json),
    });
    window.fetch = fetch;
    sandbox.fetch = fetch;
  } else {
    delete window.fetch;
  }
  vm.runInNewContext(feedScript[2], sandbox);
  await new Promise(resolve => setTimeout(resolve, 20));
  return {
    list, before, document,
    untouched: before.length === list.children.length && before.every((el, i) => el === list.children[i]),
    status: document.getElementById('feed-status').textContent,
  };
}

const tests = {
  async 'pre-rendered rows match what the script renders from the same JSON'() {
    const { list: staticList } = await run({ noFetch: true });
    const staticRows = rowsHTML(staticList);
    assert.equal(staticList.querySelectorAll('a.feed-item').length, Math.min(11, feedJson.items.length));
    // Force a client render by starting from the no-feed fallback.
    const { list } = await run({
      json: feedJson,
      mutate: l => { l.innerHTML = '<p class="py-2.5 text-sm text-brand-sand">fallback</p>'; },
    });
    assert.equal(rowsHTML(list), staticRows);
  },

  async 'unchanged feed leaves the DOM untouched and silent'() {
    const r = await run({ json: feedJson });
    assert.ok(r.untouched, 'rows were replaced although the feed was unchanged');
    assert.equal(r.status, '');
  },

  async 'newer feed replaces the rows and announces it'() {
    const newer = structuredClone(feedJson);
    newer.items.unshift({
      title: 'A brand-new investigation', link: 'https://investigations.restoring-democracy.org/p/brand-new',
      date: '2026-11-14', dateLabel: 'Nov 14', category: 'Surveillance', categorySource: 'section',
    });
    const r = await run({ json: newer });
    assert.ok(!r.untouched);
    const rows = r.list.querySelectorAll('a.feed-item');
    assert.equal(rows.length, 11);
    assert.equal(rows[0].querySelector('.feed-title').textContent, 'A brand-new investigation');
    assert.ok(rows[0].classList.contains('feed-lead'));
    assert.equal(r.status, 'Latest investigations updated.');
  },

  async 'fewer items than expected still render'() {
    const few = { items: feedJson.items.slice(0, 3) };
    const r = await run({ json: few });
    assert.equal(r.list.querySelectorAll('a.feed-item').length, 3);
  },

  async 'a corrected headline is picked up'() {
    const edited = structuredClone(feedJson);
    edited.items[2].title += ' (corrected)';
    const r = await run({ json: edited });
    assert.ok(!r.untouched);
    assert.match(r.list.querySelectorAll('.feed-title')[2].textContent, /\(corrected\)$/);
  },

  async 'failures keep the pre-rendered rows'() {
    for (const [label, opts] of [
      ['HTTP 503', { json: feedJson, status: 503 }],
      ['bad JSON', { json: '{not json' }],
      ['empty items', { json: { items: [] } }],
      ['off-site links only', { json: { items: [{ title: 'x', link: 'https://example.com/p/x' }] } }],
      ['no fetch()', { noFetch: true }],
    ]) {
      const r = await run(opts);
      assert.ok(r.untouched, `${label}: rows changed`);
      assert.equal(r.status, '', `${label}: status announced`);
    }
  },

  async 'markup is escaped'() {
    const evil = { items: [{ title: '<img src=x onerror=alert(1)>', link: 'https://investigations.restoring-democracy.org/p/x"y', categorySource: 'section', category: '<b>c</b>' }] };
    const r = await run({ json: evil });
    assert.equal(r.list.querySelectorAll('img, b').length, 0);
    assert.equal(r.list.querySelector('a.feed-item').getAttribute('href'), 'https://investigations.restoring-democracy.org/p/x"y');
  },
};

(async () => {
  let failed = 0;
  for (const [name, fn] of Object.entries(tests)) {
    try { await fn(); console.log(`ok - ${name}`); }
    catch (err) { failed++; console.error(`not ok - ${name}\n${err.stack}`); }
  }
  if (failed) { console.error(`${failed} failed`); process.exit(1); }
})();
