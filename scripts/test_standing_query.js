#!/usr/bin/env node
/* ============================================================================
   The Standing Query — production interaction + evidence-discipline checks.

   Run:  node scripts/test_standing_query.js
         (needs `playwright`; chromium always, firefox/webkit if installed)

   Serves the repository root over local HTTP (absolute /assets paths must
   resolve) and drives infographics/standing-query/ headlessly through every
   path: full sequence, abuse, keyboard-only, reduced motion, JavaScript
   disabled, cold paint, seven viewports, every installed engine.

   Two contracts are guarded. The INTERACTION contract (the audit gate, the
   completed beat, the hold, the loop draw, the always-visible limitation,
   focus trapping and return, the no-JS document) and the EDITORIAL contract
   (banned and required formulations, composite safety, the Sept. 4 USCIS
   fact lock). Every state is asserted for ABSENCE as well as presence.

   Playwright's WebKit is not iOS Safari. Passing here does not license the
   claim "tested on iPhone".
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

let pw;
try { pw = require('playwright'); }
catch (e) { console.error('playwright is not installed: npm i playwright (chromium)'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const PAGE_DIR = path.join(ROOT, 'infographics', 'standing-query');
const OUT = path.resolve(__dirname, '..', '_shots', 'standing-query');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function chk(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  :: ' + detail : ''));
}
const shot = (p, f, o) => p.screenshot(Object.assign({ path: OUT + '/' + f }, o || {}));

/* ---------------------------------------------------------------
   STATIC SERVER — the site is static; serve it the way Netlify does.
   --------------------------------------------------------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.json': 'application/json', '.xml': 'application/xml' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---------------------------------------------------------------
   EDITORIAL GUARDS. Not style rules: each is a formulation the
   source-lock material and the Sept. 4 USCIS response permit or bar.
   --------------------------------------------------------------- */
const BANNED_TEXT = [
  ['16,555', 'initial + additional must never be published as a sum'],
  ['Iowans', 'transactions are not people'],
  ['Board of Nursing', 'a real, sworn-of-record board on a composite card'],
  ['clearinghouse director', 'expressly disfavoured title attribution'],
  ['Secretary of State', 'SOS adjacency to the DIAL ledger is barred'],
  ['– August 12, 2026', 'a date range asserting a cutoff the report does not print'],
  ['permanent', 'no retention schedule was produced'],
  ['through August 12', 'obsolete cutoff wording: USCIS confirmed data runs through Aug. 11'],
  ['through Aug. 12', 'obsolete cutoff wording: USCIS confirmed data runs through Aug. 11'],
  ['does not print a data cutoff', 'obsolete: the cutoff is now confirmed by USCIS'],
  ['That question is unanswered', 'obsolete: USCIS answered the one-person / one-transaction question'],
  ['USCIS unanswered', 'obsolete'],
  ['USCIS did not respond', 'obsolete: USCIS responded Sept. 4, 2026'],
  ['USCIS has not responded', 'obsolete: USCIS responded Sept. 4, 2026'],
  ['no response because none had been received', 'obsolete prototype ROR text'],
  ['declined to comment', 'reserved for an affirmative decline'],
  ['refused to respond', 'silence is not a refusal'],
  ['16,457 people', 'the number must never read as people'],
  ['16,457 Iowans', 'the number must never read as people'],
  ['End of prototype', 'prototype copy'],
  ['is one of 16,457', 'one composite case is not one-to-one with one transaction'],
  ['this case is one of', 'unit-unsafe framing'],
  ['This case is one of', 'unit-unsafe framing'],
  ['One of 16,457', 'unit-unsafe framing in the accessible mirror'],
  ['Seven of the eleven', 'replaced by the editor-supplied sentence'],
  ['step 7 of', 'the follow-up is not a seventh step'],
  ['7 of 7', 'the follow-up is not a seventh step'],
  ['PROTOTYPE', 'prototype banner must not ship'],
  ['ARTICLE_URL', 'the placeholder constant must never render as text']
];
const REQUIRED_TEXT = [
  ['initial verification transactions', 'the unit must travel with the number'],
  ['so far', 'absence of a produced record is not proof of non-occurrence'],
  ['denied, suspended, or revoked', 'the limitation must carry the full enumeration'],
  ['floor on transactions', '16,457 is a floor, never a ceiling'],
  ['DO NOT USE THIS YET', 'the recheck note is not in active use'],
  ['enter board name', "DIAL's own placeholder, not an invented board"],
  ['two selectable paragraphs', 'the warning is not conditional on the ordering'],
  ['never added', '98 is guarded against addition'],
  ['The reports record 16,457 initial verification transactions', 'unit-safe framing of the count'],
  ['Seven monthly reports—December through June—were independently pulled twice, on July 13 and Aug. 12, 2026. Every month matches.', 'editor-supplied sentence, verbatim'],
  ['Evidence limit', 'the page-level limitation callout'],
  ['through Aug. 11', 'USCIS: a mid-month report carries data through the day before it is run'],
  ['prepared Aug. 12, 2026', 'preparation date, stated as such'],
  ['one transaction', 'USCIS: an initial verification is one transaction'],
  ['another transaction for the same person', 'USCIS: an agency can resubmit for the same person'],
  ['do not identify unique applicants', 'nothing maps transactions to unique applicants'],
  ['standard SAVE benefit category', 'USCIS: Professional License is a standard category'],
  ['remains in effect', 'USCIS: the Dec. 23, 2025 MOA remains in effect'],
  ['continues to retain SAVE access', 'USCIS: DIAL retains SAVE access'],
  ['manual review', 'USCIS: third-step verification is manual review'],
  ['did not answer whether testing', 'USCIS did not answer the non-production question; no inference'],
  ['USCIS responded', 'right of response: USCIS has responded'],
  ['pending', 'right of response: DIAL still pending'],
  ['Not an individual', 'composite marking in the header']
];
/* hard bans checked against RAW SOURCE too (comments and attributes included) */
const BANNED_SOURCE = ['16,555', 'Board of Nursing', 'clearinghouse director', 'Secretary of State', 'proto-banner'];

const VERBATIM_QUOTE = 'If your current immigration status is not maintained, your license status may be affected, including revocation of your license.';
const LIMIT_LEAD = 'No record produced so far shows any Iowa professional license denied, suspended, or revoked because of a SAVE result.';

async function reach(page, s) {
  await page.evaluate(t => window.__sq.go(t), s);
  await page.waitForTimeout(1500);
}
/* the loop must be ABSENT: attribute unset, path undrawn, station and label invisible */
const LOOP_ABSENT = () => {
  const sq = document.getElementById('sq');
  const loop = document.getElementById('railLoop');
  const dot = document.querySelector('.rail__station.is-loop');
  const lbl = document.querySelector('.rail__label--loop');
  return sq.getAttribute('data-loop') === null &&
    parseFloat(loop.style.strokeDashoffset) > 100 &&
    parseFloat(getComputedStyle(dot).opacity) < 0.05 &&
    parseFloat(getComputedStyle(lbl).opacity) < 0.05 &&
    parseFloat(getComputedStyle(document.getElementById('loopCopy')).opacity) < 0.05;
};
const STAMP_HIDDEN = () => parseFloat(getComputedStyle(document.getElementById('cardStamp')).opacity) < 0.05;
const LIMIT_VISIBLE = () => {
  /* the always-visible limitation: in the s7 panel when at s7, and in the
     about section at EVERY state. Neither may be collapsible. */
  const about = [...document.querySelectorAll('#about-exhibit p')]
    .find(p => p.textContent.indexOf('No record produced so far') > -1);
  const r = about ? about.getBoundingClientRect() : { height: 0 };
  return !!about && getComputedStyle(about).display !== 'none' && r.height > 10 &&
    !about.closest('[hidden], details, .receipt__body, .sheet');
};

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const ORIGIN = 'http://127.0.0.1:' + port;
  const URL = ORIGIN + '/infographics/standing-query/';
  console.log('serving ' + ROOT + ' at ' + URL);

  /* Only the site-standard aggregate counter may leave the origin. It is
     aborted here (no network in CI) and the page must not care. */
  const EXTERNAL_ALLOWED = /^https:\/\/gc\.zgo\.at\/count\.js$/;
  async function guard(context, bucket) {
    await context.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(ORIGIN)) { route.continue(); return; }
      bucket.push(u);
      route.abort();
    });
  }

  const engines = [];
  for (const n of ['chromium', 'firefox', 'webkit']) {
    try { const b = await pw[n].launch(); engines.push([n, b]); } catch (e) { console.log('SKIP engine ' + n + ' (not installed)'); }
  }
  if (!engines.length) { console.error('no engines'); process.exit(2); }
  const [, browser] = engines[0];

  /* ======================= 0. STATIC SOURCE ======================= */
  const html = fs.readFileSync(path.join(PAGE_DIR, 'index.html'), 'utf8');
  for (const s of BANNED_SOURCE) chk('source: never "' + s + '" anywhere in index.html', html.indexOf(s) === -1);
  chk('source: canonical URL', html.indexOf('<link rel="canonical" href="https://restoring-democracy.org/infographics/standing-query/"') > -1);
  chk('source: og:image is the approved asset', html.indexOf('<meta property="og:image" content="https://restoring-democracy.org/assets/og/standing_query_og.png">') > -1);
  chk('source: twitter:image is the approved asset', html.indexOf('<meta name="twitter:image" content="https://restoring-democracy.org/assets/og/standing_query_og.png">') > -1);
  chk('source: og:image 1200x630', html.indexOf('og:image:width" content="1200"') > -1 && html.indexOf('og:image:height" content="630"') > -1);
  chk('source: og:image:alt + twitter:image:alt present', /og:image:alt" content="Editorial illustration titled/.test(html) && /twitter:image:alt" content="Editorial illustration titled/.test(html));
  chk('source: twitter card summary_large_image', html.indexOf('twitter:card" content="summary_large_image"') > -1);
  chk('source: viewport-fit=cover', html.indexOf('viewport-fit=cover') > -1);
  chk('source: approved OG asset exists on disk', fs.existsSync(path.join(ROOT, 'assets', 'og', 'standing_query_og.png')));
  chk('source: no external stylesheet / font / CDN', !/<link[^>]+rel="stylesheet"[^>]+href="https?:\/\//.test(html) && !/<link[^>]+href="https?:[^"]*"[^>]+rel="stylesheet"/.test(html) && !/fonts\.googleapis|cdn\.|unpkg|jsdelivr|@import/.test(html));
  const extScripts = [...html.matchAll(/<script[^>]+src="(https?:[^"]+)"/g)].map(m => m[1]);
  chk('source: the only remote script is the site counter', extScripts.length === 1 && extScripts[0] === 'https://gc.zgo.at/count.js', extScripts.join(','));
  chk('source: GoatCounter snippet immediately before </body>', /data-goatcounter="https:\/\/restoring-democracy\.goatcounter\.com\/count"[\s\S]*?<\/script>\s*<\/body>/.test(html));
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let ldObj = null; try { ldObj = JSON.parse(ld[1]); } catch (e) {}
  chk('source: JSON-LD parses and names the page', !!ldObj && ldObj.url === 'https://restoring-democracy.org/infographics/standing-query/' && ldObj.image.endsWith('standing_query_og.png'));
  chk('source: JSON-LD invents no datePublished / person author', !!ldObj && !ldObj.datePublished && ldObj.author && ldObj.author['@type'] === 'Organization');
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  chk('sitemap: canonical page listed once', sitemap.split('https://restoring-democracy.org/infographics/standing-query/').length === 2);
  chk('source: ROR block is isolated and marked for patching', html.indexOf('RIGHT OF RESPONSE') > -1 && html.indexOf('id="rorBlock"') > -1);
  const appjs = fs.readFileSync(path.join(PAGE_DIR, 'app.js'), 'utf8');
  chk('source: ARTICLE_URL is a single named constant in app.js', /var ARTICLE_URL = '[^']*';/.test(appjs));
  chk('source: analytics helper is try/catch guarded and site-standard', /window\.goatcounter/.test(appjs) && /catch \(e\)/.test(appjs) && !/gtag|dataLayer|plausible|umami/.test(appjs));
  chk('source: card has no image, svg, canvas, or code (no photo, QR, seal, signature)', (() => {
    const card = html.slice(html.indexOf('<article class="card"'), html.indexOf('</article>'));
    return !/<img|<svg|<canvas|<picture|signature|signed|seal|barcode|QR/i.test(card);
  })());

  /* ======================= 1. FULL SEQUENCE ======================= */
  let ext = [];
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await guard(ctx, ext);
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/gc\.zgo\.at|ERR_FAILED|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  const failed404 = [];
  page.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) failed404.push(r.url()); });
  await page.goto(URL);
  /* sample the loop path during the first second: it must never be drawn */
  const flash = [];
  for (const t of [30, 120, 300, 600]) {
    await page.waitForTimeout(t);
    flash.push(await page.evaluate(() => {
      const l = document.getElementById('railLoop');
      return Math.round(parseFloat(getComputedStyle(l).strokeDashoffset)) + '/' + Math.round(l.getTotalLength());
    }));
  }
  chk('boot: loop path never flashes during first paint (offset == length at every sample)',
      flash.every(f => f.split('/')[0] === f.split('/')[1]), flash.join(' '));

  chk('boot: every same-origin asset resolves (fonts, css, js, icons)', failed404.length === 0, failed404.join(','));
  chk('boot: local RDP fonts actually loaded', await page.evaluate(() =>
    document.fonts.check('16px Inter') && document.fonts.check('16px Lora') && document.fonts.check('12px "JetBrains Mono"')));
  chk('boot: data-enhanced set', await page.getAttribute('html', 'data-enhanced') === 'true');
  chk('boot: all sheets hidden by JS', await page.$$eval('.sheet', els => els.every(e => e.hidden)));
  const vp = await page.$$eval('.panel', els => els.filter(e => getComputedStyle(e).display !== 'none').map(e => e.dataset.panel));
  chk('boot: exactly one panel visible (s0)', vp.length === 1 && vp[0] === 's0', JSON.stringify(vp));
  chk('boot: progressive rows + receipts hidden', await page.evaluate(() => {
    const h = s => getComputedStyle(document.querySelector(s)).display === 'none';
    return h('.card__row--response') && h('.card__row--issued') && h('.card__row--expiry') && h('.receipts');
  }));
  chk('boot: site nav and footer present around the exhibit', await page.evaluate(() =>
    !!document.querySelector('nav.nav-bar') && !!document.querySelector('footer') &&
    document.querySelector('nav.nav-bar').compareDocumentPosition(document.getElementById('sq')) & Node.DOCUMENT_POSITION_FOLLOWING));
  chk('boot: article CTAs hidden while ARTICLE_URL is empty (or shown with the URL once set)', await page.evaluate(() => {
    const u = window.__sq.articleUrl();
    const links = [...document.querySelectorAll('[data-article-cta]')];
    return links.length >= 1 && links.every(l => u ? (!l.hidden && l.getAttribute('href') === u) : (l.hidden && !l.hasAttribute('href')));
  }));
  chk('boot: hidden CTA does not paint (Tailwind utility vs [hidden])', await page.evaluate(() =>
    [...document.querySelectorAll('[data-article-cta][hidden]')].every(l => getComputedStyle(l).display === 'none')));
  chk('boot: ISSUED stamp ABSENT', await page.evaluate(STAMP_HIDDEN));
  chk('boot: loop ABSENT (attribute, path, station, label, reveal copy)', await page.evaluate(LOOP_ABSENT));
  chk('boot: limitation visible on the page from the first frame', await page.evaluate(LIMIT_VISIBLE));

  /* --- COMPOSITE SAFETY: nothing on the card may read as a real record --- */
  chk('composite: board field is DIAL\'s literal placeholder',
      (await page.textContent('.card__placeholder')).indexOf('enter board name') > -1);
  const cardText = (await page.textContent('#card')).replace(/\s+/g, ' ');
  chk('composite: no date on the card', !/\b(19|20)\d{2}\b/.test(cardText) && !/\b\d{1,2}[\/.-]\d{1,2}\b/.test(cardText) && !/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d/.test(cardText), cardText.slice(0, 90));
  chk('composite: no case or license number on the card', !/\bNo\.?\s*\d|#\s*\d|\d{3,}/.test(cardText));
  chk('composite: no name, address, photo, seal or signature field', !/\b(name|address|street|photo|signature|seal|DOB|birth|SSN|A-number|alien)\b/i.test(cardText.replace('enter board name', '')));
  chk('composite: card is marked composite', cardText.indexOf('not an individual record') > -1);
  chk('composite: header carries the composite label', (await page.textContent('#btnComposite')).indexOf('Composite case') > -1);
  chk('composite: ISSUED stamp is ink-grey, not the reserved warm accent', await page.evaluate(() => {
    const c = getComputedStyle(document.getElementById('cardStamp')).color.match(/\d+/g).map(Number);
    /* warm accent #c2703d = (194,112,61): reject anything red-dominant */
    return !(c[0] > c[2] + 60 && c[0] > c[1] + 30);
  }));
  chk('composite: the reserved accent token is never applied', await page.evaluate(() => {
    const all = document.querySelectorAll('.sq-band *, .sheet *');
    for (const el of all) {
      const cs = getComputedStyle(el);
      for (const k of ['color', 'backgroundColor', 'borderTopColor', 'fill', 'stroke']) {
        if (cs[k] === 'rgb(194, 112, 61)') return false;
      }
    }
    return true;
  }));
  await shot(page, '01-s0.png');

  /* --- s1 --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(220);
  chk('s0 -> s1', await page.getAttribute('#sq', 'data-state') === 's1');
  chk('s1: start event tracked (harmlessly, counter absent)', (await page.evaluate(() => window.__sq.tracked())).indexOf('standing_query_start') > -1);
  chk('s1: ISSUED stamp still ABSENT', await page.evaluate(STAMP_HIDDEN));
  chk('s1: loop still ABSENT', await page.evaluate(LOOP_ABSENT));
  chk('s1: response row shown', await page.evaluate(() => getComputedStyle(document.querySelector('.card__row--response')).display !== 'none'));
  await page.click('#receiptAdditional .receipt__trigger'); await page.waitForTimeout(220);
  chk('s1: additional-verification receipt opens', await page.evaluate(() => document.getElementById('bodyAdditional').getAttribute('data-open') === 'true'));
  const addl = await page.textContent('#bodyAdditional');
  chk('s1: 98 is guarded against addition', addl.indexOf('never added') > -1);
  chk('s1: third step described as manual review, not reported', addl.indexOf('manual review') > -1 && addl.indexOf('Not reported') > -1);
  chk('s1: third step uses the NULL SLOT mark, not the open rule', await page.evaluate(() =>
    !!document.querySelector('#bodyAdditional .m-null-slot') && !document.querySelector('#bodyAdditional .m-open-rule')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(180);
  await shot(page, '02-s1.png');

  /* --- s2: the audit gate --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(260);
  chk('s1 -> s2', await page.getAttribute('#sq', 'data-state') === 's2');
  chk('s2: receipts visible', await page.evaluate(() => getComputedStyle(document.getElementById('receipts')).display !== 'none'));
  chk('s2: unit line adjacent to the number',
      (await page.textContent('.receipts__unit')).trim() === 'initial verification transactions');
  chk('s2: unit sits directly under the number (< 24px)', await page.evaluate(() => {
    const n = document.getElementById('bigNumber').getBoundingClientRect();
    const u = document.querySelector('.receipts__unit').getBoundingClientRect();
    return u.top - n.bottom < 24 && u.top >= n.bottom - 4;
  }));
  chk('s2: number is exactly 16,457', (await page.textContent('#bigNumber')).trim() === '16,457');
  chk('s2: scope says through Aug. 11 and never through Aug. 12', await page.evaluate(() => {
    const t = document.querySelector('.receipts__scope').textContent;
    return t.indexOf('through Aug. 11') > -1 && t.indexOf('through Aug. 12') === -1 && t.indexOf('August 12') === -1;
  }));
  chk('s2: rail label carries the unit', await page.evaluate(() =>
    [...document.querySelectorAll('.rail__label')].some(t => t.textContent === '16,457 transactions') &&
    ![...document.querySelectorAll('.rail__label')].some(t => t.textContent.trim() === '16,457')));
  chk('s2: primary gated', await page.isDisabled('#btnPrimary'));
  chk('s2: gate label 0 of 3', (await page.textContent('#btnPrimary')).trim() === '0 of 3');
  chk('s2: gate cannot be bypassed by keyboard on the disabled control', await (async () => {
    await page.evaluate(() => document.getElementById('btnPrimary').focus());
    await page.keyboard.press('Enter'); await page.keyboard.press(' '); await page.waitForTimeout(150);
    return (await page.getAttribute('#sq', 'data-state')) === 's2';
  })());
  chk('s2: scope NOT shown before the gate opens', await page.evaluate(() =>
    getComputedStyle(document.getElementById('scopeInline')).display === 'none'));
  chk('s2: unresolved slots use the UNKNOWN mark, not the open rule',
      await page.$$eval('.slot', els => els.every(e => e.querySelector('.m-unknown') && !e.querySelector('.m-open-rule'))));
  chk('s2: rail loop band is clipped (no telegraph)', await page.evaluate(() => {
    const w = document.getElementById('railWrap').getBoundingClientRect();
    const dot = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
    return dot.top > w.bottom - 2;
  }));
  chk('s2: the case thumbnail sits directly above the count', await page.evaluate(() => {
    const card = document.getElementById('card').getBoundingClientRect();
    const kick = document.querySelector('.receipts__kicker').getBoundingClientRect();
    const rail = document.getElementById('railWrap').getBoundingClientRect();
    return kick.top >= card.top && (kick.top - card.bottom) < 60 && rail.top > kick.top;
  }));
  chk('s2: action bar is last in the re-ordered flex flow (sticky survives display:contents)', await page.evaluate(() => {
    const kids = [...document.getElementById('sq').children].filter(k => getComputedStyle(k).position !== 'absolute');
    const ordered = kids.map(k => [parseInt(getComputedStyle(k).order, 10) || 0, k]).sort((a, b) => a[0] - b[0]);
    return ordered[ordered.length - 1][1].classList.contains('sq-action');
  }));
  const railS2 = await page.evaluate(() => document.getElementById('railWrap').getBoundingClientRect().height);
  await shot(page, '03-s2-gate.png');

  for (const [i, c] of ['people', 'cases', 'transactions'].entries()) {
    await page.click('.chip[data-chip="' + c + '"]'); await page.waitForTimeout(200);
    chk('s2: chip ' + c + ' opens its sheet', await page.evaluate(id => !document.getElementById(id).hidden,
      'sheet' + c.charAt(0).toUpperCase() + c.slice(1)));
    if (i < 2) chk('s2: gate still closed after ' + (i + 1) + ' of 3', await page.isDisabled('#btnPrimary'));
    if (i === 1) await shot(page, '04-s2-sheet-cases.png');
    await page.keyboard.press('Escape'); await page.waitForTimeout(180);
  }
  chk('s2: people resolves to the OPEN RULE (not established)',
      await page.evaluate(() => !!document.querySelector('.slot[data-slot="people"] .m-open-rule')));
  chk('s2: transactions resolves to a FACT BAR (documented)',
      await page.evaluate(() => !!document.querySelector('.slot[data-slot="transactions"] .m-fact-bar')));
  chk('s2: cases resolves to a sworn/different-unit mark, not either of those',
      await page.evaluate(() => {
        const s = document.querySelector('.slot[data-slot="cases"]');
        return !s.querySelector('.m-open-rule') && !s.querySelector('.m-fact-bar') && s.textContent.indexOf('a different unit') > -1;
      }));
  chk('s2: the open rule is a thin rule with end ticks, not a solid bar (no redaction reading)', await page.evaluate(() => {
    const line = document.querySelector('.slot[data-slot="people"] .m-open-rule__line').getBoundingClientRect();
    const tick = document.querySelector('.slot[data-slot="people"] .m-open-rule__tick').getBoundingClientRect();
    return line.height <= 2 && tick.height >= 8 && line.width >= 40;
  }));
  chk('s2: the number did not change on resolution', (await page.textContent('#bigNumber')).trim() === '16,457');
  chk('s2: prompt turns to "The number has not changed. What it means has."',
      (await page.textContent('#chipPrompt')).trim() === 'The number has not changed. What it means has.');
  const peopleTxt = await page.textContent('#sheetPeople');
  chk('s2: People sheet carries the USCIS one-transaction answer, no longer "unanswered"',
      peopleTxt.indexOf('one transaction') > -1 && peopleTxt.indexOf('another transaction for the same person') > -1 && peopleTxt.indexOf('unanswered') === -1);
  const txTxt = await page.textContent('#sheetTransactions');
  chk('s2: Transactions sheet states the unanswered non-production question without inferring',
      txTxt.indexOf('did not answer whether testing') > -1 && txTxt.indexOf('That question is open') > -1 && !/confirmed that (testing|no testing)|(does|do) not (appear|contain)/.test(txTxt));
  chk('s2: gate opens', await page.evaluate(() => window.__sq.gateOpen()));
  chk('s2: audit_complete event tracked', (await page.evaluate(() => window.__sq.tracked())).indexOf('standing_query_audit_complete') > -1);
  chk('s2: scope delivered INLINE', await page.evaluate(() => getComputedStyle(document.getElementById('scopeInline')).display !== 'none'));
  chk('s2: scope does NOT open a dialog', await page.$$eval('.sheet', els => els.every(e => e.hidden)));
  chk('s2: scope does NOT steal focus', await page.evaluate(() => !document.getElementById('scopeInline').contains(document.activeElement)));
  chk('s2: scrim stays down', await page.evaluate(() => document.getElementById('scrim').hidden));
  chk('s2: primary ungated', !(await page.isDisabled('#btnPrimary')));
  const scopeTxt = await page.textContent('#scopeInline');
  chk('s2: scope states floor, standard benefit category, manual review, Aug. 11',
      ['floor on transactions', 'standard SAVE benefit category', 'manual review', 'through Aug. 11'].every(k => scopeTxt.indexOf(k) > -1));
  chk('s2: scope has no DOT/SOS adjacency and no Iowa-code claim', scopeTxt.indexOf('Secretary of State') === -1 && !/One Iowa benefit code/.test(scopeTxt));
  chk('s2: ISSUED and loop still ABSENT after the gate', (await page.evaluate(STAMP_HIDDEN)) && (await page.evaluate(LOOP_ABSENT)));
  await shot(page, '05-s2-resolved.png', { fullPage: true });

  /* --- s3: the false ending begins --- */
  await page.evaluate(() => {
    window.__tl = [];
    const sq = document.getElementById('sq');
    window.__tlObs = new MutationObserver(() => {
      const s = sq.getAttribute('data-state');
      if (!window.__tl.length || window.__tl[window.__tl.length - 1].s !== s) window.__tl.push({ s: s, t: performance.now() });
    });
    window.__tlObs.observe(sq, { attributes: true, attributeFilter: ['data-state'] });
  });
  await page.click('#btnPrimary'); await page.waitForTimeout(140);
  chk('s3: action bar has left', await page.evaluate(() => getComputedStyle(document.querySelector('.sq-action')).pointerEvents === 'none'));
  chk('s3: primary not tabbable', await page.isDisabled('#btnPrimary'));
  chk('s3: back not tabbable', await page.isDisabled('#btnBack'));
  chk('s3: loop still ABSENT', await page.evaluate(LOOP_ABSENT));

  await page.waitForTimeout(520);
  chk('s3 -> s4', await page.getAttribute('#sq', 'data-state') === 's4', await page.getAttribute('#sq', 'data-state'));
  chk('s4: ISSUED stamp visible', await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('cardStamp')).opacity) > 0.5));
  chk('s4: the completed beat is shown', await page.evaluate(() => getComputedStyle(document.querySelector('.panel[data-panel="s4"]')).display !== 'none'));
  chk('s4: "Application complete." reads as terminal', (await page.textContent('.panel__end')).trim() === 'Application complete.');
  chk('s4: expiry row NOT yet present (clean completed card)', await page.evaluate(() => getComputedStyle(document.querySelector('.card__row--expiry')).display === 'none'));
  chk('s4: loop still ABSENT during the false ending', await page.evaluate(LOOP_ABSENT));
  chk('s4: no operable control on screen (bar and back gone)', await page.evaluate(() =>
    [...document.querySelectorAll('.sq-action button, .sq-back')].filter(b => !b.disabled && getComputedStyle(b).visibility !== 'hidden').length === 0));
  await page.waitForTimeout(3900);
  const tl = await page.evaluate(() => window.__tl);
  const dwell = (a, b) => { const i = tl.findIndex(x => x.s === a), j = tl.findIndex(x => x.s === b); return (i > -1 && j > i) ? Math.round(tl[j].t - tl[i].t) : -1; };
  chk('A: s4 holds its own beat (>=800ms of stillness before s5)', dwell('s4', 's5') >= 800, 's4 dwell=' + dwell('s4', 's5') + 'ms  timeline=' + tl.map(x => x.s).join('>'));
  chk('A: s4 and s5 are distinct beats, not one animation',
      dwell('s3', 's4') >= 250 && dwell('s4', 's5') >= 800 && dwell('s5', 's6') >= 1200,
      's3=' + dwell('s3', 's4') + ' s4=' + dwell('s4', 's5') + ' s5=' + dwell('s5', 's6'));
  chk('s4 -> s5 -> s6 reached', tl.some(x => x.s === 's6'), tl.map(x => x.s).join('>'));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__sq.go('s4')); await page.waitForTimeout(300);
  await shot(page, '06-s4-issued.png');
  await page.evaluate(() => window.__sq.go('s5')); await page.waitForTimeout(1000);
  await shot(page, '07-s5-hold.png');
  chk('s5: the expiry resolved during the hold', ['resolving', 'resolved'].indexOf(await page.getAttribute('#sq', 'data-expiry')) > -1, String(await page.getAttribute('#sq', 'data-expiry')));
  chk('s5: the expiry value is bracketed placeholder, not a date', /^\[.*\]$/.test((await page.textContent('#expiryValue')).trim()) && !/\d/.test(await page.textContent('#expiryValue')));

  /* --- s6: the reversal --- */
  await page.evaluate(() => window.__sq.go('s6'));
  await page.waitForTimeout(1400);
  chk('s6: loop drawn', await page.evaluate(() => window.__sq.loopDrawn()));
  chk('s6: loop_reveal event tracked', (await page.evaluate(() => window.__sq.tracked())).indexOf('standing_query_loop_reveal') > -1);
  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(200);
  chk('reveal copy is hidden until the loop draws', await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('loopCopy')).opacity) < 0.05));
  await page.evaluate(() => window.__sq.go('s6')); await page.waitForTimeout(1400);
  chk('s6: reveal copy visible', await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('loopCopy')).opacity) > 0.5));
  chk('s6: action bar returned', await page.evaluate(() => getComputedStyle(document.querySelector('.sq-action')).pointerEvents !== 'none'));
  chk('s6: primary reads "See what happens next"', (await page.textContent('#btnPrimary')).trim() === 'See what happens next');
  const railS6 = await page.evaluate(() => document.getElementById('railWrap').getBoundingClientRect().height);
  chk('s6: the rail GROWS to admit the loop', railS6 > railS2 * 1.5, 's2=' + Math.round(railS2) + ' s6=' + Math.round(railS6));
  chk('s6: loop station now inside the visible band', await page.evaluate(() => {
    const w = document.getElementById('railWrap').getBoundingClientRect();
    const d = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
    return d.bottom <= w.bottom + 2 && parseFloat(getComputedStyle(document.querySelector('.rail__station.is-loop')).opacity) > 0.5;
  }));
  chk('s6: loop station is an OUTLINE (procedure), not filled (event)', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.rail__station.is-loop'));
    return cs.fill === 'none' && cs.strokeDasharray !== 'none';
  }));
  chk('s6: rail summary mentions the return', (await page.textContent('#railLabel')).indexOf('returns') > -1);
  chk('s6: follow-up announced outside the six-step list, as procedure not event', await page.evaluate(() => {
    const f = document.getElementById('railFollowup').textContent;
    return document.querySelectorAll('#railList li').length === 6 && f.indexOf('Post-issuance follow-up') > -1 && f.indexOf('not an observed event') > -1;
  }));
  await shot(page, '08-s6-loop.png');

  /* --- s7: the sensitive station --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(320);
  chk('s6 -> s7', await page.getAttribute('#sq', 'data-state') === 's7');
  chk('s7: limit block always visible', await page.evaluate(() => {
    const el = document.getElementById('limitBlock');
    return getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 40;
  }));
  chk('s7: limit block is not collapsible (no toggle targets it, no details/hidden ancestor)', await page.evaluate(() =>
    !document.querySelector('[aria-controls="limitBlock"]') && !document.getElementById('limitBlock').closest('details, [hidden], .receipt__body, .sheet')));
  chk('s7: limit lead is verbatim', (await page.textContent('.limit-block__lead')).trim() === LIMIT_LEAD);
  chk('s7: limit lead outweighs the letter trigger', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.limit-block__lead')).fontSize) >
    parseFloat(getComputedStyle(document.querySelector('#receiptLetter .receipt__trigger')).fontSize)));
  const s7 = await page.textContent('.panel[data-panel="s7"]');
  chk('s7: the two-branch template is stated', s7.indexOf('two selectable paragraphs') > -1 && s7.indexOf('before the license expires') > -1 && s7.indexOf('after') > -1);
  chk('s7: the recheck is CONTEMPLATED and marked not-yet-approved', s7.indexOf('contemplates') > -1 && s7.indexOf('DO NOT USE THIS YET') > -1);
  chk('s7: no depicted revocation or completed recheck', !/was revoked|has been revoked|license revoked|recheck (ran|was run|found)/i.test(s7));
  chk('s7: legend chip present', await page.isVisible('.legend-chip'));
  chk('s7: card keeps the ink-grey stamp (no accent, no strike-through)', await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('cardStamp'));
    return cs.textDecorationLine !== 'line-through' && cs.color !== 'rgb(194, 112, 61)';
  }));
  await shot(page, '09-s7.png', { fullPage: true });

  await page.click('#receiptLetter .receipt__trigger'); await page.waitForTimeout(260);
  const letter = await page.textContent('#bodyLetter');
  chk('s7: the quote is verbatim', letter.indexOf(VERBATIM_QUOTE) > -1);
  chk('s7: the COMPLETE limitation sits INSIDE the quote modal, verbatim', letter.indexOf(LIMIT_LEAD) > -1);
  chk('s7: that limitation is visible while the modal is open', await page.evaluate(q => {
    const p = [...document.querySelectorAll('#bodyLetter p')].find(x => x.textContent.indexOf(q) > -1);
    return !!p && getComputedStyle(p).display !== 'none' && p.getBoundingClientRect().height > 10 &&
      document.getElementById('bodyLetter').getAttribute('data-open') === 'true';
  }, LIMIT_LEAD));
  chk('s7: the withheld paragraph is disclosed', letter.indexOf('withheld') > -1);
  chk('s7: the always-visible limit block remains visible while the letter is open', await page.evaluate(() => {
    const el = document.getElementById('limitBlock');
    return getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 40;
  }));
  await shot(page, '10-s7-letter.png');
  await page.click('#bodyLetter .receipt__close'); await page.waitForTimeout(200);

  await page.click('#btnPrimary'); await page.waitForTimeout(260);
  chk('s7 -> s8', await page.getAttribute('#sq', 'data-state') === 's8');
  chk('s8: complete event tracked', (await page.evaluate(() => window.__sq.tracked())).indexOf('standing_query_complete') > -1);
  const s8 = await page.textContent('.panel[data-panel="s8"]');
  chk('s8: right-of-response says USCIS responded and DIAL pending', s8.indexOf('USCIS responded') > -1 && s8.indexOf('pending') > -1);
  chk('s8: no "declined" / "refused" / "did not respond" for silence', !/declined to comment|refused to respond|did not respond|no response/i.test(s8));
  chk('s8: USCIS confirmations carried (MOA in effect, access retained)', s8.indexOf('remains in effect') > -1 && s8.indexOf('continues to retain SAVE access') > -1);
  chk('s8: no scope creep into DOT / voter registration / SOS', !/voter registration|Secretary of State|driver/i.test(s8));
  chk('s8: page-level limitation still visible at the end', await page.evaluate(LIMIT_VISIBLE));
  await shot(page, '11-s8.png', { fullPage: true });

  /* --- reset --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(320);
  chk('s8 -> reset to s0', await page.getAttribute('#sq', 'data-state') === 's0');
  chk('reset: gate cleared', !(await page.evaluate(() => window.__sq.gateOpen())));
  chk('reset: loop ABSENT again', await page.evaluate(LOOP_ABSENT));
  chk('reset: ISSUED ABSENT again', await page.evaluate(STAMP_HIDDEN));
  chk('reset: slots back to UNKNOWN', await page.$$eval('.slot', els => els.every(e => !!e.querySelector('.m-unknown'))));
  chk('no page errors in the full sequence', errors.length === 0, errors.join(' | '));
  chk('network: only the site counter ever leaves the origin', ext.every(u => EXTERNAL_ALLOWED.test(u)), [...new Set(ext)].join(','));
  chk('network: no browser storage used', await page.evaluate(() => {
    try { return localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''; } catch (e) { return true; }
  }));

  /* ======================= 2. ABUSE ======================= */
  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(150);
  for (let i = 0; i < 12; i++) { await page.click('#btnPrimary', { force: true }).catch(() => {}); await page.waitForTimeout(25); }
  await page.waitForTimeout(400);
  chk('abuse: rapid tapping cannot skip the gate', await page.getAttribute('#sq', 'data-state') === 's2', await page.getAttribute('#sq', 'data-state'));
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); }
  await page.waitForTimeout(200);
  chk('abuse: Enter spam cannot skip the gate', await page.getAttribute('#sq', 'data-state') === 's2');
  chk('abuse: forced clicks never made ISSUED or the loop appear', await page.evaluate(STAMP_HIDDEN) && await page.evaluate(LOOP_ABSENT));

  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(150);
  await page.evaluate(() => window.__sq.go('s5')); await page.waitForTimeout(250);
  chk('abuse: back is inert during the hold', await page.isDisabled('#btnBack'));
  await page.evaluate(() => window.__sq.go('s6')); await page.waitForTimeout(1200);
  await page.click('#btnBack'); await page.waitForTimeout(300);
  chk('abuse: back from s6 clears the loop', await page.evaluate(LOOP_ABSENT));
  chk('abuse: back from s6 clears the expiry attribute', (await page.getAttribute('#sq', 'data-expiry')) === null, String(await page.getAttribute('#sq', 'data-expiry')));

  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(150);
  await page.evaluate(() => window.__sq.go('s2')); await page.waitForTimeout(200);
  for (let i = 0; i < 6; i++) {
    await page.click('.chip[data-chip="people"]'); await page.waitForTimeout(60);
    await page.keyboard.press('Escape'); await page.waitForTimeout(60);
  }
  chk('abuse: sheet churn leaves no open sheet or scrim', await page.evaluate(() =>
    document.getElementById('scrim').hidden && [...document.querySelectorAll('.sheet')].every(s => s.hidden)));

  await page.evaluate(() => window.__sq.go('s3')); await page.waitForTimeout(150);
  await page.click('#btnRestart'); await page.waitForTimeout(2600);
  chk('abuse: restart during auto-advance lands clean', await page.getAttribute('#sq', 'data-state') === 's0', await page.getAttribute('#sq', 'data-state'));

  /* skip the beat and the hold: tap on the card (not a control) */
  await page.evaluate(() => window.__sq.go('s4')); await page.waitForTimeout(200);
  const cb = await page.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 20]; });
  await page.mouse.click(cb[0], cb[1]); await page.waitForTimeout(200);
  chk('skip: tap skips the completed beat', await page.getAttribute('#sq', 'data-state') === 's5', await page.getAttribute('#sq', 'data-state'));
  await page.mouse.click(cb[0], cb[1]); await page.waitForTimeout(250);
  chk('skip: tap skips the hold', await page.getAttribute('#sq', 'data-state') === 's6', await page.getAttribute('#sq', 'data-state'));
  await page.evaluate(() => window.__sq.go('s4')); await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  chk('skip: Enter skips the completed beat', await page.getAttribute('#sq', 'data-state') === 's5');

  /* ======================= 3. EDITORIAL GUARDS ======================= */
  const allText = await page.evaluate(() => document.documentElement.textContent.replace(/\s+/g, ' '));
  for (const [phrase, why] of BANNED_TEXT) chk('editorial: NEVER "' + phrase + '"', allText.indexOf(phrase) === -1, why);
  for (const [phrase, why] of REQUIRED_TEXT) chk('editorial: carries "' + phrase + '"', allText.indexOf(phrase) > -1, why);
  chk('editorial: 16,457 never adjacent to 98 as a sum', !/16,457\s*\+\s*98|98\s*\+\s*16,457/.test(allText));
  chk('editorial: limitation lead appears at least three times (station 7, letter modal, page)', allText.split(LIMIT_LEAD).length >= 4);
  chk('editorial: revocation quote never appears without the complete limitation in the same container', await page.evaluate(([q, lim]) => {
    const hits = [...document.querySelectorAll('p')].filter(p => p.textContent.indexOf(q) > -1);
    return hits.length >= 1 && hits.every(p => (p.parentElement.textContent.indexOf(lim) > -1));
  }, [VERBATIM_QUOTE, LIMIT_LEAD]));
  chk('editorial: live region frames the count unit-safely at s2', await page.evaluate(() => {
    window.__sq.reset(); window.__sq.go('s2');
    return document.getElementById('live').textContent.indexOf('The reports record 16,457 initial verification transactions') > -1;
  }));
  chk('editorial: composite sheet says no case-level records were released', allText.indexOf('No case-level records have been released') > -1);
  await ctx.close();

  /* ======================= 4. COLD PAINT ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guard(ctx, []);
  page = await ctx.newPage();
  await page.route('**/standing-query/app.js', r => r.abort());
  await page.goto(URL); await page.waitForTimeout(300);
  chk('cold paint: head script sets the flag before body renders', await page.getAttribute('html', 'data-enhanced') === 'true');
  chk('cold paint: no flash of the later rows before app.js runs', await page.evaluate(() => {
    const h = s => getComputedStyle(document.querySelector(s)).display === 'none';
    return h('.card__row--issued') && h('.card__row--expiry') && h('.receipts');
  }));
  chk('cold paint: ISSUED and loop copy ABSENT before app.js', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('cardStamp')).opacity) < 0.05 &&
    parseFloat(getComputedStyle(document.getElementById('loopCopy')).opacity) < 0.05));
  await shot(page, '12-cold-paint.png');
  await ctx.close();

  /* ======================= 5. REDUCED MOTION ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await guard(ctx, []);
  page = await ctx.newPage();
  const rmErr = []; page.on('pageerror', e => rmErr.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(300);
  chk('rm: data-rm true', await page.getAttribute('#sq', 'data-rm') === 'true');
  await page.click('#btnPrimary'); await page.waitForTimeout(140);
  await page.click('#btnPrimary'); await page.waitForTimeout(180);
  for (const c of ['people', 'cases', 'transactions']) {
    await page.click('.chip[data-chip="' + c + '"]'); await page.waitForTimeout(110);
    await page.keyboard.press('Escape'); await page.waitForTimeout(110);
  }
  chk('rm: scope inline, no dialog', await page.evaluate(() =>
    getComputedStyle(document.getElementById('scopeInline')).display !== 'none' && [...document.querySelectorAll('.sheet')].every(s => s.hidden)));
  await page.click('#btnPrimary'); await page.waitForTimeout(450);
  chk('rm: stops at s4', await page.getAttribute('#sq', 'data-state') === 's4', await page.getAttribute('#sq', 'data-state'));
  chk('rm: the button asserts the ending ("Close")', (await page.textContent('#btnPrimary')).trim() === 'Close', await page.textContent('#btnPrimary'));
  chk('rm: the completed beat is shown as a terminal panel', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.panel[data-panel="s4"]')).display !== 'none' && document.querySelector('.panel__end').textContent.indexOf('complete') > -1));
  chk('rm: loop ABSENT at the structural false ending', await page.evaluate(LOOP_ABSENT));
  chk('rm: expiry row ABSENT at the structural false ending', await page.evaluate(() => getComputedStyle(document.querySelector('.card__row--expiry')).display === 'none'));
  chk('rm: action bar reachable (no dead end)', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.sq-action'));
    return cs.pointerEvents !== 'none' && parseFloat(cs.opacity) > 0.5;
  }));
  await shot(page, '13-rm-s4-false-end.png');
  await page.click('#btnPrimary'); await page.waitForTimeout(450);
  chk('rm: "Close" reveals the loop instead', await page.getAttribute('#sq', 'data-state') === 's6' && await page.evaluate(() => window.__sq.loopDrawn()), await page.getAttribute('#sq', 'data-state'));
  chk('rm: expiry legible without animation', await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.card__row--expiry dd')).opacity) > 0.9));
  chk('rm: focus not moved onto the revealed copy', await page.evaluate(() => !document.querySelector('.panel[data-panel="s6"]').contains(document.activeElement)));
  await shot(page, '14-rm-s6.png');
  chk('no page errors in reduced motion', rmErr.length === 0, rmErr.join(' | '));
  await ctx.close();

  /* ======================= 6. KEYBOARD ONLY ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guard(ctx, []);
  page = await ctx.newPage();
  await page.goto(URL); await page.waitForTimeout(250);
  await page.focus('#btnPrimary'); await page.keyboard.press('Enter'); await page.waitForTimeout(160);
  chk('kb: Enter advances', await page.getAttribute('#sq', 'data-state') === 's1');
  await page.focus('#btnPrimary'); await page.keyboard.press('Enter'); await page.waitForTimeout(160);
  await page.focus('.chip[data-chip="people"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(220);
  chk('kb: focus enters the sheet', await page.evaluate(() => document.getElementById('sheetPeople').contains(document.activeElement)));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(120);
  chk('kb: focus is trapped inside the sheet', await page.evaluate(() => document.getElementById('sheetPeople').contains(document.activeElement)));
  chk('kb: site nav is not reachable behind the modal', await page.evaluate(() => !document.querySelector('nav.nav-bar').contains(document.activeElement)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  chk('kb: focus returns to the opener', await page.evaluate(() => document.activeElement.getAttribute('data-chip') === 'people'));
  for (const c of ['cases', 'transactions']) {
    await page.focus('.chip[data-chip="' + c + '"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(140);
    await page.keyboard.press('Escape'); await page.waitForTimeout(140);
  }
  chk('kb: gate opens without a mouse', !(await page.isDisabled('#btnPrimary')));
  chk('kb: scope did not take focus', await page.evaluate(() => !document.getElementById('scopeInline').contains(document.activeElement)));
  await page.focus('#btnPrimary'); await page.keyboard.press('Enter');
  await page.waitForTimeout(5200);
  chk('kb: reaches s6 unaided', await page.getAttribute('#sq', 'data-state') === 's6', await page.getAttribute('#sq', 'data-state'));
  for (const st of ['s3', 's4', 's5']) {
    await page.evaluate(t => window.__sq.go(t), st); await page.waitForTimeout(120);
    chk('kb: ' + st + ' exposes no operable control while the bar is gone', await page.evaluate(() =>
      [...document.querySelectorAll('.sq-action button, .sq-back')].filter(b => !b.disabled && getComputedStyle(b).visibility !== 'hidden').length === 0));
  }
  chk('kb: every control in the exhibit is at least 44px tall', await page.evaluate(() => {
    window.__sq.go('s2');
    return [...document.querySelectorAll('#sq button')]
      .filter(b => b.offsetParent !== null && getComputedStyle(b).visibility !== 'hidden')
      .every(b => b.getBoundingClientRect().height >= 44);
  }));
  await ctx.close();

  /* ======================= 7. NO JAVASCRIPT ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  await guard(ctx, []);
  page = await ctx.newPage();
  await page.goto(URL); await page.waitForTimeout(250);
  chk('no-JS: every panel readable', await page.$$eval('.panel', els => els.filter(e => getComputedStyle(e).display !== 'none').length) === 6);
  chk('no-JS: every sheet readable inline', await page.$$eval('.sheet', els => els.filter(e => !e.hidden && getComputedStyle(e).display !== 'none').length) === 4);
  chk('no-JS: all four card rows readable', await page.$$eval('.card__row', els => els.filter(e => getComputedStyle(e).display !== 'none').length) === 4);
  chk('no-JS: the scope material is readable', await page.evaluate(() => getComputedStyle(document.getElementById('scopeInline')).display !== 'none'));
  chk('no-JS: the limit block is readable', await page.isVisible('#limitBlock'));
  chk('no-JS: the ROR block is readable', await page.isVisible('#rorBlock'));
  chk('no-JS: the expiry value is legible (not stuck mid-reveal)', await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.card__row--expiry dd')).opacity) > 0.9));
  chk('no-JS: JS-only controls removed', await page.$$eval('.chip, .receipt__trigger, .sq-action, .sheet__close, .receipt__close, .slots',
    els => els.filter(e => e.offsetParent !== null && e.getClientRects().length > 0).length) === 0);
  chk('no-JS: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  chk('no-JS: site nav and footer still render', await page.evaluate(() => !!document.querySelector('nav.nav-bar') && !!document.querySelector('footer')));
  await shot(page, '15-nojs.png', { fullPage: true });
  await ctx.close();


  /* ======================= 7b. POSITIONING ======================= */
  const scrollProbe = () => {
    window.__scrolls = 0;
    const st = window.scrollTo.bind(window);
    window.scrollTo = function () { window.__scrolls++; return st.apply(window, arguments); };
    const siv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () { window.__scrolls++; return siv.apply(this, arguments); };
  };
  const anchorOk = (sel) => {
    const el = document.querySelector(sel);
    const top = el.getBoundingClientRect().top;
    const off = window.__sq.navOffset;
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    return (top >= off - 6 && top <= off + 48) || (atEnd && top >= 0 && top < window.innerHeight);
  };
  for (const [name, w, h] of [['390x844', 390, 844], ['1440x900', 1440, 900]]) {
    ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await guard(ctx, []);
    page = await ctx.newPage();
    await page.goto(URL); await page.waitForTimeout(250);
    await page.evaluate(scrollProbe);
    await page.click('#btnPrimary'); await page.waitForTimeout(900);
    chk('position ' + name + ': s1 brings the card into view under the nav', await page.evaluate(anchorOk, '#card'),
        String(await page.evaluate(() => Math.round(document.getElementById('card').getBoundingClientRect().top))));
    await page.click('#btnPrimary'); await page.waitForTimeout(900);
    chk('position ' + name + ': s2 brings the card thumbnail + count into view', await page.evaluate(anchorOk, '#card'));
    for (const c of ['people', 'cases', 'transactions']) {
      await page.click('.chip[data-chip="' + c + '"]'); await page.waitForTimeout(120);
      await page.keyboard.press('Escape'); await page.waitForTimeout(120);
    }
    /* the reader has scrolled down through the scope text before continuing */
    await page.evaluate(() => window.scrollTo({ top: document.getElementById('scopeInline').getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' }));
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => window.__scrolls);
    await page.click('#btnPrimary');                       /* s2 -> s3, the false ending begins */
    const atTap = await page.evaluate(() => window.__scrolls);
    chk('position ' + name + ': the gate tap itself positions the card once (reader had scrolled into the scope)', atTap === before + 1, 'scrolls=' + atTap);
    await page.waitForTimeout(700);                        /* s4: the stamp has landed */
    chk('position ' + name + ': the stamped card is on screen when ISSUED lands', await page.evaluate(() => {
      const r = document.getElementById('cardStamp').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && document.getElementById('sq').getAttribute('data-state') === 's4';
    }), await page.getAttribute('#sq', 'data-state'));
    await page.waitForTimeout(3900);                       /* s4 > s5 > s6 */
    chk('position ' + name + ': NO programmatic scroll from s3 through s6 (false ending untouched)',
        (await page.evaluate(() => window.__scrolls)) === atTap && await page.getAttribute('#sq', 'data-state') === 's6',
        'scrolls=' + await page.evaluate(() => window.__scrolls) + ' state=' + await page.getAttribute('#sq', 'data-state'));
    if (name === '390x844') chk('position 390x844: the fold stays clean through the reveal (no about-section text above the fold at s6)', await page.evaluate(() =>
      document.getElementById('about-heading').getBoundingClientRect().top >= window.innerHeight));
    await page.click('#btnPrimary'); await page.waitForTimeout(900);
    chk('position ' + name + ': s7 brings the station-7 panel into view', await page.evaluate(anchorOk, '.panel[data-panel="s7"]'));
    await page.click('#btnPrimary'); await page.waitForTimeout(900);
    chk('position ' + name + ': s8 brings the end panel into view', await page.evaluate(anchorOk, '.panel[data-panel="s8"]'));
    await page.click('#btnRestart'); await page.waitForTimeout(900);
    chk('position ' + name + ': Restart returns to the top of the interactive', await page.evaluate(anchorOk, '#sq'),
        String(await page.evaluate(() => Math.round(document.getElementById('sq').getBoundingClientRect().top))));
    if (name === '390x844') {
      await page.click('#btnPrimary'); await page.waitForTimeout(700);
      await page.click('#btnPrimary'); await page.waitForTimeout(700);
      for (const c of ['people', 'cases', 'transactions']) { await page.click('.chip[data-chip="' + c + '"]'); await page.waitForTimeout(100); await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
      await page.click('#btnPrimary'); await page.waitForTimeout(700);
      await shot(page, '19-mobile-false-end-clickdriven.png');
    }
    await ctx.close();
  }
  /* reduced motion: the positioning happens as a jump, synchronously */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await guard(ctx, []);
  page = await ctx.newPage();
  await page.goto(URL); await page.waitForTimeout(250);
  const rmPos = await page.evaluate(() => {
    document.getElementById('btnPrimary').click();
    const top = document.getElementById('card').getBoundingClientRect().top;
    return { top: Math.round(top), off: window.__sq.navOffset };
  });
  chk('position rm: s1 positioning is instant (no glide) under reduced motion', rmPos.top >= rmPos.off - 6 && rmPos.top <= rmPos.off + 48, JSON.stringify(rmPos));
  await ctx.close();

  /* ======================= 7c. CLOSE → CONTINUE (regression) =======================
     A receipt's Close returned focus to its trigger; when the reader had
     scrolled the page behind the sheet the browser smooth-scrolled the
     trigger into view, the sticky bar moved during that glide, and an
     immediate tap on Continue landed on the bar's padding. Reproduced on
     touch input at 1440x900 (letter sheet, s7). */
  for (const [name, w, h] of [['390x844', 390, 844], ['1440x900', 1440, 900]]) {
    for (const station of ['s1', 's7']) {
      for (const scrolled of [false, true]) {
        ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 600 });
        await guard(ctx, []);
        page = await ctx.newPage();
        await page.goto(URL); await page.waitForTimeout(250);
        if (station === 's1') { await page.tap('#btnPrimary'); await page.waitForTimeout(900); }   /* let the s1 positioning settle, as a reader does */
        else { await page.evaluate(() => window.__sq.go('s7')); await page.waitForTimeout(1200); }
        const trig = station === 's1' ? '#receiptAdditional .receipt__trigger' : '#receiptLetter .receipt__trigger';
        const body = station === 's1' ? '#bodyAdditional' : '#bodyLetter';
        await page.tap(trig); await page.waitForTimeout(200);
        /* a reader's touch scroll is instantaneous; a programmatic smooth glide would still be moving the bar */
        if (scrolled) { await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.6, behavior: 'instant' })); await page.waitForTimeout(120); }
        /* synchronous contract: in the same task as the Close click, the
           receipt and the backdrop are already non-hit-testable and the
           Continue button is what sits at its own centre. */
        const sync = await page.evaluate(b => {
          document.querySelector(b + ' .receipt__close').click();
          const rb = document.querySelector(b), sc = document.getElementById('scrim');
          const r = document.getElementById('btnPrimary').getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { body: getComputedStyle(rb).display, bodyPE: getComputedStyle(rb).pointerEvents, scrim: getComputedStyle(sc).display,
                   hit: at ? at.id : null, x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, body);
        chk('close→continue ' + name + ' ' + station + (scrolled ? ' (page scrolled behind)' : '') + ': receipt + backdrop non-hit-testable synchronously',
            sync.body === 'none' && sync.scrim === 'none' && sync.hit === 'btnPrimary', JSON.stringify(sync));
        await page.touchscreen.tap(sync.x, sync.y);     /* immediately: one tap */
        await page.waitForTimeout(300);
        const expect = station === 's1' ? 's2' : 's8';
        chk('close→continue ' + name + ' ' + station + (scrolled ? ' (page scrolled behind)' : '') + ': one Continue tap advances',
            await page.getAttribute('#sq', 'data-state') === expect, await page.getAttribute('#sq', 'data-state'));
        await ctx.close();
      }
    }
  }

  /* ======================= 7d. RAIL MIRROR + MODAL SEMANTICS ======================= */
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await guard(ctx, []);
  page = await ctx.newPage();
  await page.goto(URL); await page.waitForTimeout(250);
  const mirror = async () => page.evaluate(() => ({
    n: document.querySelectorAll('#railList li').length,
    li: [...document.querySelectorAll('#railList li')].map(l => l.textContent).join(' | '),
    follow: document.getElementById('railFollowup').textContent,
    label: document.getElementById('railLabel').textContent
  }));
  for (const st of ['s0', 's1', 's2', 's4', 's5']) {
    await page.evaluate(t => window.__sq.go(t), st); await page.waitForTimeout(150);
    const m = await mirror();
    chk('mirror ' + st + ': six licensing steps only, no follow-up exposed before the reveal',
        m.n === 6 && m.follow === '' && !/expire|recheck|returns/i.test(m.li + m.label) && /of six/.test(m.label), m.li + ' // ' + m.label);
  }
  await page.evaluate(() => window.__sq.go('s6')); await page.waitForTimeout(1300);
  let m = await mirror();
  chk('mirror s6: still six steps; follow-up appended as post-issuance procedure, not step 7',
      m.n === 6 && /Post-issuance follow-up/.test(m.follow) && /not an observed event/.test(m.follow) && !/step 7|7 of/.test(m.li + m.label + m.follow), m.follow);
  await page.evaluate(() => window.__sq.go('s7')); await page.waitForTimeout(200);
  m = await mirror();
  chk('mirror s7: six steps complete, follow-up marks the current position', m.n === 6 && /Currently here/.test(m.follow) && /six of six/.test(m.label), m.follow);
  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(200);
  m = await mirror();
  chk('mirror reset: follow-up withdrawn again', m.follow === '' && m.n === 6);

  for (const [station, trig, body] of [['s1', '#receiptAdditional .receipt__trigger', '#bodyAdditional'], ['s7', '#receiptLetter .receipt__trigger', '#bodyLetter']]) {
    await page.evaluate(t => window.__sq.go(t), station); await page.waitForTimeout(station === 's7' ? 1200 : 200);
    chk('modal ' + body + ': dialog semantics in the markup', await page.evaluate(b => {
      const el = document.querySelector(b);
      const lab = el.getAttribute('aria-labelledby');
      return el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true' && !!lab &&
        !!document.getElementById(lab) && document.getElementById(lab).textContent.trim().length > 3;
    }, body));
    await page.click(trig); await page.waitForTimeout(200);
    chk('modal ' + body + ': backdrop shown and focus moved inside', await page.evaluate(b =>
      getComputedStyle(document.getElementById('scrim')).display !== 'none' && document.querySelector(b).contains(document.activeElement), body));
    chk('modal ' + body + ': constrained, centred width on desktop', await page.evaluate(b => {
      const r = document.querySelector(b).getBoundingClientRect();
      return r.width <= 700 && Math.abs(r.left - (window.innerWidth - r.right)) < 4;
    }, body));
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(80);
    chk('modal ' + body + ': focus trapped', await page.evaluate(b => document.querySelector(b).contains(document.activeElement), body));
    chk('modal ' + body + ': backdrop click closes', await (async () => {
      await page.mouse.click(30, 200); await page.waitForTimeout(120);
      return (await page.evaluate(b => document.querySelector(b).getAttribute('data-open') === null && document.getElementById('scrim').hidden, body));
    })());
    await page.click(trig); await page.waitForTimeout(200);
    await page.keyboard.press('Escape'); await page.waitForTimeout(120);
    chk('modal ' + body + ': Escape closes and focus returns to the trigger', await page.evaluate(([b, t]) =>
      document.querySelector(b).getAttribute('data-open') === null && document.activeElement === document.querySelector(t) &&
      document.querySelector(t).getAttribute('aria-expanded') === 'false', [body, trig]));
  }
  await ctx.close();

  /* ======================= 8. VIEWPORT SWEEP ======================= */
  for (const [name, w, h] of [['320x568', 320, 568], ['375x667', 375, 667], ['390x844', 390, 844],
                              ['430x932', 430, 932], ['768x1024', 768, 1024], ['1024x768', 1024, 768], ['1440x900', 1440, 900]]) {
    ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await guard(ctx, []);
    page = await ctx.newPage();
    await page.goto(URL); await page.waitForTimeout(250);
    await shot(page, '18-' + name + '-s0.png');   /* fresh first paint, before any state jump */
    let ovf = false, collide = 0, covered = 0, telegraph = false, barOff = false;
    let railW = Infinity, railH = Infinity;
    for (const st of ['s0', 's2', 's6', 's7']) {
      await reach(page, st);
      const m = await page.evaluate(state => {
        const de = document.documentElement;
        const labels = [...document.querySelectorAll('.rail__label')].filter(t => getComputedStyle(t).opacity !== '0').map(t => t.getBoundingClientRect());
        let col = 0;
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) col++;
        }
        const bar = document.querySelector('.sq-action').getBoundingClientRect();
        let cov = 0;
        document.querySelectorAll('.limit-block').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.height && r.bottom > bar.top && de.scrollHeight <= de.clientHeight) cov++;
        });
        const wrap = document.getElementById('railWrap').getBoundingClientRect();
        const dot = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
        const line = document.getElementById('railProgress').getBoundingClientRect();
        /* the sticky bar must be pinned to the viewport bottom while the exhibit is in view */
        const sqR = document.getElementById('sq').getBoundingClientRect();
        const pinned = (sqR.bottom > window.innerHeight) ? Math.abs(bar.bottom - window.innerHeight) < 2 : true;
        return { ovf: de.scrollWidth > de.clientWidth + 1, col: col, cov: cov,
                 railW: Math.round(wrap.width), railH: Math.round(line.width),
                 tele: (state === 's0' || state === 's2') && dot.top < wrap.bottom - 2,
                 barOff: !pinned && state !== 's3' && state !== 's4' && state !== 's5' };
      }, st);
      ovf = ovf || m.ovf; collide += m.col; covered += m.cov; telegraph = telegraph || m.tele; barOff = barOff || m.barOff;
      railW = Math.min(railW, m.railW); railH = Math.min(railH, m.railH);
    }
    chk('viewport ' + name + ': no horizontal overflow', !ovf);
    chk('viewport ' + name + ': no rail label collision', collide === 0, String(collide));
    chk('viewport ' + name + ': limitation never trapped under the bar', covered === 0, String(covered));
    chk('viewport ' + name + ': loop band not telegraphed pre-reveal', !telegraph);
    chk('viewport ' + name + ': the rail is actually rendered', railW > 200 && railH > 100, 'wrap=' + railW + ' line=' + railH);
    chk('viewport ' + name + ': action bar pinned to the viewport bottom while the exhibit is in view', !barOff);
    /* scroll to the footer: the bar must NOT ride over the site footer */
    await reach(page, 's0');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    chk('viewport ' + name + ': bar does not cover the footer at page end', await page.evaluate(() => {
      const bar = document.querySelector('.sq-action').getBoundingClientRect();
      const foot = document.querySelector('footer').getBoundingClientRect();
      return bar.bottom <= foot.top + 1;
    }));
    if (name === '1440x900') { await reach(page, 's4'); await shot(page, '16-desktop-false-end.png'); }
    if (name === '390x844') { await reach(page, 's4'); await shot(page, '16-mobile-false-end.png'); }
    await ctx.close();
  }

  /* ======================= 9. CROSS-ENGINE ======================= */
  for (const [name, b] of engines) {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    const ext2 = []; await guard(c2, ext2);
    const p2 = await c2.newPage();
    const errs = []; p2.on('pageerror', e => errs.push(String(e)));
    await p2.goto(URL); await p2.waitForTimeout(400);
    await p2.click('#btnPrimary'); await p2.waitForTimeout(200);
    await p2.click('#btnPrimary'); await p2.waitForTimeout(200);
    for (const c of ['people', 'cases', 'transactions']) {
      await p2.click('.chip[data-chip="' + c + '"]'); await p2.waitForTimeout(120);
      await p2.keyboard.press('Escape'); await p2.waitForTimeout(120);
    }
    await p2.click('#btnPrimary');
    await p2.waitForTimeout(6000);
    chk('engine ' + name + ': reaches s6 with the loop drawn',
        await p2.getAttribute('#sq', 'data-state') === 's6' && await p2.evaluate(() => window.__sq.loopDrawn()), await p2.getAttribute('#sq', 'data-state'));
    chk('engine ' + name + ': rail expanded for the loop', await p2.evaluate(() => {
      const w = document.getElementById('railWrap').getBoundingClientRect();
      const d = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
      return d.bottom <= w.bottom + 2;
    }));
    chk('engine ' + name + ': only the site counter leaves the origin', ext2.every(u => EXTERNAL_ALLOWED.test(u)), [...new Set(ext2)].join(','));
    chk('engine ' + name + ': no browser storage used', await p2.evaluate(() => {
      try { return localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''; } catch (e) { return true; }
    }));
    chk('engine ' + name + ': no page errors', errs.length === 0, errs.slice(0, 1).join(''));
    if (name !== 'chromium') await shot(p2, '17-' + name + '-s6.png');
    await c2.close();
  }
  for (const [, b] of engines) await b.close();
  srv.close();

  const failed = results.filter(r => !r.pass);
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' checks passed ====');
  console.log('engines: ' + engines.map(e => e[0]).join(', ') + '   (Playwright WebKit is not iOS Safari)');
  if (failed.length) { failed.forEach(f => console.log('  FAILED: ' + f.name + ' :: ' + f.detail)); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
