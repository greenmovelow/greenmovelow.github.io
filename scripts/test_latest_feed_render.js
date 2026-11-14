// Regression tests for the homepage latest-feed refresh script.
//
// The rows in #latest-feed are pre-rendered into index.html by
// scripts/build_latest_investigations.py and refreshed in the browser by the
// inline script in index.html. If the two renderers ever disagreed, a refresh
// would visibly re-lay out the list (a layout shift). These tests run the real
// inline script against a DOM built from the committed index.html and check:
//   1. JS rendering of the committed JSON equals the pre-rendered rows.
//   2. An unchanged feed leaves the pre-rendered DOM untouched.
//   3. Only a JSON with a strictly newer feed revision replaces the rows:
//      older (stale cache), equal, missing or malformed revisions never do,
//      even when the rows differ.
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
const committed = feedJson.revision;
assert.match(committed, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'committed JSON needs a feed revision');
assert.ok(html.includes(`data-feed-revision="${committed}"`), 'index.html revision must match the JSON');
const shift = (rev, seconds) => new Date(Date.parse(rev) + seconds * 1000).toISOString().replace('.000Z', 'Z');
const NEWER = shift(committed, 3 * 3600);
const OLDER = shift(committed, -3 * 3600);

// A feed with one extra story on top: rows that differ from the page.
function withNewStory(revision) {
  const f = structuredClone(feedJson);
  f.items.unshift({
    title: 'A brand-new investigation', link: 'https://investigations.restoring-democracy.org/p/brand-new',
    date: '2026-11-14', dateLabel: 'Nov 14', category: 'Surveillance', categorySource: 'section',
  });
  if (revision === undefined) delete f.revision; else f.revision = revision;
  return f;
}

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
    list, before, document, revision: list.getAttribute('data-feed-revision'),
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
    assert.equal(r.revision, committed);
  },

  async 'fresh HTML receiving older cached JSON keeps the newer rows'() {
    const r = await run({ json: withNewStory(OLDER) });
    assert.ok(r.untouched, 'stale JSON replaced newer HTML');
    assert.equal(r.status, '');
    assert.equal(r.revision, committed);
  },

  async 'equal revision never replaces the rows, even if they differ'() {
    const r = await run({ json: withNewStory(committed) });
    assert.ok(r.untouched);
    assert.equal(r.revision, committed);
  },

  async 'older HTML receiving a newer feed updates and announces it'() {
    const r = await run({ json: withNewStory(NEWER) });
    assert.ok(!r.untouched);
    const rows = r.list.querySelectorAll('a.feed-item');
    assert.equal(rows.length, 11);
    assert.equal(rows[0].querySelector('.feed-title').textContent, 'A brand-new investigation');
    assert.ok(rows[0].classList.contains('feed-lead'));
    assert.equal(r.status, 'Latest investigations updated.');
    assert.equal(r.revision, NEWER);
  },

  async 'newer revision with identical rows changes no DOM nodes'() {
    const r = await run({ json: { ...feedJson, revision: NEWER } });
    assert.ok(r.untouched);
    assert.equal(r.status, '');
    assert.equal(r.revision, NEWER);
  },

  async 'fewer items in a newer feed still render'() {
    const r = await run({ json: { revision: NEWER, items: feedJson.items.slice(0, 3) } });
    assert.equal(r.list.querySelectorAll('a.feed-item').length, 3);
  },

  async 'a corrected headline with a newer revision is picked up'() {
    const edited = structuredClone(feedJson);
    edited.items[2].title += ' (corrected)';
    edited.revision = NEWER;
    const r = await run({ json: edited });
    assert.ok(!r.untouched);
    assert.match(r.list.querySelectorAll('.feed-title')[2].textContent, /\(corrected\)$/);
  },

  async 'missing or malformed JSON revisions cannot replace the rows'() {
    for (const bad of [undefined, null, '', 'latest', '2026-11-14', '2026-11-14T03:00:00+00:00',
      '9999-99-99T99:99:99Z', 1794624000000, { t: NEWER }]) {
      const r = await run({ json: withNewStory(bad) });
      assert.ok(r.untouched, `JSON revision ${JSON.stringify(bad)} replaced the rows`);
      assert.equal(r.revision, committed);
    }
  },

  async 'missing or malformed page revision is never overwritten'() {
    for (const [label, mutate] of [
      ['missing', l => l.removeAttribute('data-feed-revision')],
      ['malformed', l => l.setAttribute('data-feed-revision', 'garbage')],
    ]) {
      const r = await run({ json: withNewStory(NEWER), mutate });
      assert.ok(r.untouched, `${label} page revision: rows replaced`);
    }
  },

  async 'no-feed fallback is replaced by a valid feed'() {
    const r = await run({
      json: withNewStory(OLDER),
      mutate: l => { l.innerHTML = '<p class="py-2.5 text-sm text-brand-sand">fallback</p>'; },
    });
    assert.equal(r.list.querySelectorAll('a.feed-item').length, 11);
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
    const evil = { revision: NEWER, items: [{ title: '<img src=x onerror=alert(1)>', link: 'https://investigations.restoring-democracy.org/p/x"y', categorySource: 'section', category: '<b>c</b>' }] };
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
