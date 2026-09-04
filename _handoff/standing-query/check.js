/* ============================================================
   The Standing Query — interaction + evidence-discipline checks.
   Drives the built page headlessly. Guards the interaction
   contract AND the editorial rules that must not regress.

     npm i playwright && node check.js
   Engines: chromium always; firefox/webkit if installed.
   ============================================================ */
const pw = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, 'index.html');
const OUT = path.resolve(__dirname, '_shots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function chk(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  :: ' + detail : ''));
}
const shot = (p, f, o) => p.screenshot(Object.assign({ path: OUT + '/' + f }, o || {}));

/* ---------------------------------------------------------------
   EDITORIAL GUARDS. These are not style rules. Each one is a
   formulation the source-lock material expressly permits or bars.
   --------------------------------------------------------------- */
const BANNED = [
  ['16,555', 'initial + additional must never be published as a sum'],
  ['Iowans', 'transactions are not people'],
  ['Board of Nursing', 'a real, sworn-of-record board on a composite card'],
  ['clearinghouse director', 'expressly disfavoured title attribution'],
  ['Secretary of State', 'SOS adjacency to the DIAL ledger is barred'],
  ['– August 12, 2026', 'a date range asserts a data cutoff the report does not print'],
  ['permanent', 'no retention schedule was produced']
];
const REQUIRED = [
  ['initial verification transactions', 'the unit must travel with the number'],
  ['so far', 'absence of a produced record is not proof of non-occurrence'],
  ['denied, suspended, or revoked', 'the limitation must carry the full enumeration'],
  ['floor on transactions', '16,457 is a floor, never a ceiling'],
  ['DO NOT USE THIS YET', 'the recheck note is not in active use'],
  ['enter board name', "DIAL's own placeholder, not an invented board"],
  ['two selectable paragraphs', 'the warning is not conditional on the ordering'],
  ['prepared on 12 August 2026', 'preparation date, not a documented cutoff'],
  ['No produced record shows it happening', 'the limitation travels with the quote']
];

async function reach(page, s) {
  await page.evaluate(t => window.__sq.go(t), s);
  await page.waitForTimeout(1500);
}

(async () => {
  const engines = [];
  for (const n of ['chromium', 'firefox', 'webkit']) {
    try { const b = await pw[n].launch(); engines.push([n, b]); } catch (e) { console.log('SKIP engine ' + n + ' (not installed)'); }
  }
  if (!engines.length) { console.error('no engines'); process.exit(2); }
  const [, browser] = engines[0];

  /* ======================= 1. FULL SEQUENCE ======================= */
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(FILE);
  await page.waitForTimeout(300);

  chk('boot: data-enhanced set', await page.getAttribute('html', 'data-enhanced') === 'true');
  chk('boot: all sheets hidden by JS', await page.$$eval('.sheet', els => els.every(e => e.hidden)));
  const vp = await page.$$eval('.panel', els => els.filter(e => getComputedStyle(e).display !== 'none').map(e => e.dataset.panel));
  chk('boot: exactly one panel visible (s0)', vp.length === 1 && vp[0] === 's0', JSON.stringify(vp));
  chk('boot: progressive rows + receipts hidden', await page.evaluate(() => {
    const h = s => getComputedStyle(document.querySelector(s)).display === 'none';
    return h('.card__row--response') && h('.card__row--issued') && h('.card__row--expiry') && h('.receipts');
  }));

  /* --- COMPOSITE SAFETY: nothing on the card may read as a real record --- */
  chk('composite: board field is DIAL\'s literal placeholder',
      (await page.textContent('.card__placeholder')).indexOf('enter board name') > -1);
  const cardText = await page.textContent('#card');
  chk('composite: no date on the card', !/\b(19|20)\d{2}\b/.test(cardText) && !/\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(cardText), cardText.replace(/\s+/g, ' ').slice(0, 90));
  chk('composite: no case number on the card', !/\bNo\.?\s*\d|#\s*\d/.test(cardText));
  chk('composite: card is marked composite', cardText.indexOf('not an individual record') > -1);
  /* the ISSUED stamp must not exist before the license is issued */
  chk('s0: ISSUED stamp NOT visible', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('cardStamp')).opacity) < 0.05));
  await shot(page, '01-s0.png');

  /* --- s1 --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(220);
  chk('s0 -> s1', await page.getAttribute('#sq', 'data-state') === 's1');
  chk('s1: ISSUED stamp still not visible', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('cardStamp')).opacity) < 0.05));
  chk('s1: response row shown', await page.evaluate(() => getComputedStyle(document.querySelector('.card__row--response')).display !== 'none'));
  await page.click('#receiptAdditional .receipt__trigger'); await page.waitForTimeout(220);
  chk('s1: additional-verification receipt opens', await page.evaluate(() => document.getElementById('bodyAdditional').getAttribute('data-open') === 'true'));
  chk('s1: 98 is guarded against addition', (await page.textContent('#bodyAdditional')).indexOf('never added') > -1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(180);
  await shot(page, '02-s1.png');

  /* --- s2: the audit gate --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(260);
  chk('s1 -> s2', await page.getAttribute('#sq', 'data-state') === 's2');
  chk('s2: receipts visible', await page.evaluate(() => getComputedStyle(document.getElementById('receipts')).display !== 'none'));
  chk('s2: unit line adjacent to the number',
      (await page.textContent('.receipts__unit')).trim() === 'initial verification transactions');
  chk('s2: primary gated', await page.isDisabled('#btnPrimary'));
  chk('s2: gate label 0 of 3', (await page.textContent('#btnPrimary')).trim() === '0 of 3');

  /* GRAMMAR: an unresolved slot is unknown-to-the-reader, NOT an evidentiary
     absence. Painting "transactions" with the open rule mislabelled a
     documented fact as not established. */
  chk('s2: unresolved slots use the UNKNOWN mark, not the open rule',
      await page.$$eval('.slot', els => els.every(e =>
        e.querySelector('.m-unknown') && !e.querySelector('.m-open-rule'))));
  chk('s2: rail loop band is clipped (no telegraph)', await page.evaluate(() => {
    const w = document.getElementById('railWrap').getBoundingClientRect();
    const dot = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
    return dot.top > w.bottom - 2;      /* loop station lies outside the visible band */
  }));
  /* C: the thumbnail and the sentence that refers to it must read as one group */
  chk('s2: the case thumbnail sits directly above the count', await page.evaluate(() => {
    const card = document.getElementById('card').getBoundingClientRect();
    const kick = document.querySelector('.receipts__kicker').getBoundingClientRect();
    const rail = document.getElementById('railWrap').getBoundingClientRect();
    return kick.top >= card.top && (kick.top - card.bottom) < 60 && rail.top > kick.top;
  }), await page.evaluate(() => {
    const c = document.getElementById('card').getBoundingClientRect();
    const k = document.querySelector('.receipts__kicker').getBoundingClientRect();
    return 'gap=' + Math.round(k.top - c.bottom);
  }));

  const railS2 = await page.evaluate(() => document.getElementById('railWrap').getBoundingClientRect().height);
  await shot(page, '03-s2-gate.png');

  for (const [i, c] of ['people', 'cases', 'transactions'].entries()) {
    await page.click('.chip[data-chip="' + c + '"]'); await page.waitForTimeout(200);
    chk('s2: chip ' + c + ' opens its sheet', await page.evaluate(id => !document.getElementById(id).hidden,
      'sheet' + c.charAt(0).toUpperCase() + c.slice(1)));
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
        return !s.querySelector('.m-open-rule') && !s.querySelector('.m-fact-bar') &&
               s.textContent.indexOf('a different unit') > -1;
      }));

  /* E: scope arrives inline, without seizing focus */
  chk('s2: gate opens', await page.evaluate(() => window.__sq.gateOpen()));
  chk('s2: scope delivered INLINE', await page.evaluate(() =>
    getComputedStyle(document.getElementById('scopeInline')).display !== 'none'));
  chk('s2: scope does NOT open a dialog', await page.$$eval('.sheet', els => els.every(e => e.hidden)));
  chk('s2: scope does NOT steal focus', await page.evaluate(() =>
    !document.getElementById('scopeInline').contains(document.activeElement)));
  chk('s2: scrim stays down', await page.evaluate(() => document.getElementById('scrim').hidden));
  chk('s2: primary ungated', !(await page.isDisabled('#btnPrimary')));
  await shot(page, '05-s2-resolved.png', { fullPage: true });

  /* --- s3: the false ending begins ---
     Record the transition timeline rather than sleeping and polling: the
     dwell at s4 is the deliverable, and a screenshot between two waits is
     enough to make a sleep-based assertion lie in either direction. */
  await page.evaluate(() => {
    window.__tl = [];
    const sq = document.getElementById('sq');
    window.__tlObs = new MutationObserver(() => {
      const s = sq.getAttribute('data-state');
      if (!window.__tl.length || window.__tl[window.__tl.length - 1].s !== s) {
        window.__tl.push({ s: s, t: performance.now() });
      }
    });
    window.__tlObs.observe(sq, { attributes: true, attributeFilter: ['data-state'] });
  });
  await page.click('#btnPrimary'); await page.waitForTimeout(140);
  chk('s3: action bar has left', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.sq-action')).pointerEvents === 'none'));
  chk('s3: primary not tabbable', await page.isDisabled('#btnPrimary'));
  chk('s3: back not tabbable', await page.isDisabled('#btnBack'));

  /* --- A: s4 is a real beat, not a frame --- */
  await page.waitForTimeout(520);
  chk('s3 -> s4', await page.getAttribute('#sq', 'data-state') === 's4', await page.getAttribute('#sq', 'data-state'));
  chk('s4: ISSUED stamp visible', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('cardStamp')).opacity) > 0.5));
  chk('s4: the completed beat is shown', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.panel[data-panel="s4"]')).display !== 'none'));
  chk('s4: expiry row NOT yet present (clean completed card)', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.card__row--expiry')).display === 'none'));
  await page.waitForTimeout(3900);
  const tl = await page.evaluate(() => window.__tl);
  const dwell = (a, b) => {
    const i = tl.findIndex(x => x.s === a), j = tl.findIndex(x => x.s === b);
    return (i > -1 && j > i) ? Math.round(tl[j].t - tl[i].t) : -1;
  };
  chk('A: s4 holds its own beat (>=800ms of stillness before s5)',
      dwell('s4', 's5') >= 800, 's4 dwell=' + dwell('s4', 's5') + 'ms  timeline=' +
      tl.map(x => x.s).join('>'));
  chk('A: s4 and s5 are distinct beats, not one animation',
      dwell('s3', 's4') >= 250 && dwell('s4', 's5') >= 800 && dwell('s5', 's6') >= 1200,
      's3=' + dwell('s3', 's4') + ' s4=' + dwell('s4', 's5') + ' s5=' + dwell('s5', 's6'));
  chk('s4 -> s5 -> s6 reached', tl.some(x => x.s === 's6'), tl.map(x => x.s).join('>'));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__sq.go('s4')); await page.waitForTimeout(300);
  await shot(page, '06-s4-issued.png');
  await page.evaluate(() => window.__sq.go('s5')); await page.waitForTimeout(1000);
  await shot(page, '07-s5-hold.png');
  chk('s5: the expiry resolved during the hold',
      ['resolving', 'resolved'].indexOf(await page.getAttribute('#sq', 'data-expiry')) > -1,
      String(await page.getAttribute('#sq', 'data-expiry')));

  /* --- s6: the reversal --- */
  await page.evaluate(() => window.__sq.go('s6'));
  await page.waitForTimeout(1400);
  chk('s6: loop drawn', await page.evaluate(() => window.__sq.loopDrawn()));
  /* the reveal copy must be earned by the draw, not present from the start */
  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(200);
  chk('reveal copy is hidden until the loop draws', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('loopCopy')).opacity) < 0.05));
  await page.evaluate(() => window.__sq.go('s6')); await page.waitForTimeout(1400);
  chk('s6: reveal copy visible', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.getElementById('loopCopy')).opacity) > 0.5));
  chk('s6: action bar returned', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.sq-action')).pointerEvents !== 'none'));
  const railS6 = await page.evaluate(() => document.getElementById('railWrap').getBoundingClientRect().height);
  chk('s6: the rail GROWS to admit the loop', railS6 > railS2 * 1.5, 's2=' + Math.round(railS2) + ' s6=' + Math.round(railS6));
  chk('s6: loop station now inside the visible band', await page.evaluate(() => {
    const w = document.getElementById('railWrap').getBoundingClientRect();
    const d = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
    return d.bottom <= w.bottom + 2 && parseFloat(getComputedStyle(document.querySelector('.rail__station.is-loop')).opacity) > 0.5;
  }));
  chk('s6: rail summary mentions the return', (await page.textContent('#railLabel')).indexOf('returns') > -1);
  await shot(page, '08-s6-loop.png');

  /* --- s7: the sensitive station --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(320);
  chk('s6 -> s7', await page.getAttribute('#sq', 'data-state') === 's7');
  chk('s7: limit block always visible', await page.evaluate(() => {
    const el = document.getElementById('limitBlock');
    return getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 40;
  }));
  chk('s7: limit lead outweighs the letter trigger', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.limit-block__lead')).fontSize) >
    parseFloat(getComputedStyle(document.querySelector('#receiptLetter .receipt__trigger')).fontSize)));
  chk('s7: the two-branch template is stated', (await page.textContent('.panel[data-panel="s7"]')).indexOf('two selectable paragraphs') > -1);
  chk('s7: the recheck note is marked not-yet-approved', (await page.textContent('.panel[data-panel="s7"]')).indexOf('DO NOT USE THIS YET') > -1);
  chk('s7: legend chip present', await page.isVisible('.legend-chip'));
  await shot(page, '09-s7.png', { fullPage: true });

  await page.click('#receiptLetter .receipt__trigger'); await page.waitForTimeout(260);
  const letter = await page.textContent('#bodyLetter');
  chk('s7: the quote is verbatim',
      letter.indexOf('If your current immigration status is not maintained, your license status may be affected, including revocation of your license.') > -1);
  chk('s7: the limitation travels INSIDE the quote sheet',
      letter.indexOf('No produced record shows it happening') > -1);
  chk('s7: the withheld paragraph is disclosed', letter.indexOf('withheld') > -1);
  await shot(page, '10-s7-letter.png');
  await page.click('#bodyLetter .receipt__close'); await page.waitForTimeout(200);

  await page.click('#btnPrimary'); await page.waitForTimeout(260);
  chk('s7 -> s8', await page.getAttribute('#sq', 'data-state') === 's8');
  chk('s8: right-of-response status carried', (await page.textContent('.panel[data-panel="s8"]')).indexOf('silence before the deadline is not a refusal') > -1);
  await shot(page, '11-s8.png', { fullPage: true });

  /* --- reset --- */
  await page.click('#btnPrimary'); await page.waitForTimeout(320);
  chk('s8 -> reset to s0', await page.getAttribute('#sq', 'data-state') === 's0');
  chk('reset: gate cleared', !(await page.evaluate(() => window.__sq.gateOpen())));
  chk('reset: loop cleared', !(await page.evaluate(() => window.__sq.loopDrawn())));
  chk('reset: slots back to UNKNOWN', await page.$$eval('.slot', els => els.every(e => !!e.querySelector('.m-unknown'))));
  chk('no page errors in the full sequence', errors.length === 0, errors.join(' | '));

  /* ======================= 2. ABUSE ======================= */
  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(150);
  for (let i = 0; i < 12; i++) { await page.click('#btnPrimary', { force: true }).catch(() => {}); await page.waitForTimeout(25); }
  await page.waitForTimeout(400);
  chk('abuse: rapid tapping cannot skip the gate', await page.getAttribute('#sq', 'data-state') === 's2',
      await page.getAttribute('#sq', 'data-state'));

  await page.evaluate(() => window.__sq.reset()); await page.waitForTimeout(150);
  await page.evaluate(() => window.__sq.go('s5')); await page.waitForTimeout(250);
  chk('abuse: back is inert during the hold', await page.isDisabled('#btnBack'));
  await page.evaluate(() => window.__sq.go('s6')); await page.waitForTimeout(1200);
  await page.click('#btnBack'); await page.waitForTimeout(300);
  chk('abuse: back from s6 clears the loop', !(await page.evaluate(() => window.__sq.loopDrawn())));
  chk('abuse: back from s6 clears the expiry attribute',
      (await page.getAttribute('#sq', 'data-expiry')) === null, String(await page.getAttribute('#sq', 'data-expiry')));

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
  chk('abuse: restart during auto-advance lands clean', await page.getAttribute('#sq', 'data-state') === 's0',
      await page.getAttribute('#sq', 'data-state'));

  /* skip the beat and the hold */
  await page.evaluate(() => window.__sq.go('s4')); await page.waitForTimeout(200);
  await page.mouse.click(195, 480); await page.waitForTimeout(200);
  chk('skip: tap skips the completed beat', await page.getAttribute('#sq', 'data-state') === 's5',
      await page.getAttribute('#sq', 'data-state'));
  await page.mouse.click(195, 480); await page.waitForTimeout(250);
  chk('skip: tap skips the hold', await page.getAttribute('#sq', 'data-state') === 's6',
      await page.getAttribute('#sq', 'data-state'));

  /* ======================= 3. EDITORIAL GUARDS ======================= */
  /* textContent, not innerText: banned phrases must be absent even from
     panels that happen to be display:none right now, and required ones
     must be present in the document rather than merely on screen. */
  const allText = await page.evaluate(() => document.documentElement.textContent.replace(/\s+/g, ' '));
  for (const [phrase, why] of BANNED) {
    chk('editorial: NEVER "' + phrase + '"', allText.indexOf(phrase) === -1, why);
  }
  for (const [phrase, why] of REQUIRED) {
    chk('editorial: carries "' + phrase + '"', allText.indexOf(phrase) > -1, why);
  }
  chk('editorial: no SOS boundary row survives in the DOM',
      await page.evaluate(() => !/Secretary of State/.test(document.documentElement.innerHTML)));
  await ctx.close();

  /* ======================= 4. COLD PAINT ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  await page.route('**/app.js', r => r.abort());     /* CSS + head script only */
  await page.goto(FILE); await page.waitForTimeout(300);
  chk('cold paint: head script sets the flag before body renders',
      await page.getAttribute('html', 'data-enhanced') === 'true');
  chk('cold paint: no flash of the later rows before app.js runs', await page.evaluate(() => {
    const h = s => getComputedStyle(document.querySelector(s)).display === 'none';
    return h('.card__row--issued') && h('.card__row--expiry') && h('.receipts');
  }));
  await shot(page, '12-cold-paint.png');
  await ctx.close();

  /* ======================= 5. REDUCED MOTION ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  const rmErr = []; page.on('pageerror', e => rmErr.push(String(e)));
  await page.goto(FILE); await page.waitForTimeout(300);
  chk('rm: data-rm true', await page.getAttribute('#sq', 'data-rm') === 'true');
  await page.click('#btnPrimary'); await page.waitForTimeout(140);
  await page.click('#btnPrimary'); await page.waitForTimeout(180);
  for (const c of ['people', 'cases', 'transactions']) {
    await page.click('.chip[data-chip="' + c + '"]'); await page.waitForTimeout(110);
    await page.keyboard.press('Escape'); await page.waitForTimeout(110);
  }
  chk('rm: scope inline, no dialog', await page.evaluate(() =>
    getComputedStyle(document.getElementById('scopeInline')).display !== 'none' &&
    [...document.querySelectorAll('.sheet')].every(s => s.hidden)));
  await page.click('#btnPrimary'); await page.waitForTimeout(450);
  chk('rm: stops at s4', await page.getAttribute('#sq', 'data-state') === 's4', await page.getAttribute('#sq', 'data-state'));
  /* D: the false ending must survive without motion — the CONTROL asserts it */
  chk('rm: the button asserts the ending ("Close")',
      (await page.textContent('#btnPrimary')).trim() === 'Close', await page.textContent('#btnPrimary'));
  chk('rm: the completed beat is shown as a terminal panel', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.panel[data-panel="s4"]')).display !== 'none' &&
    document.querySelector('.panel__end').textContent.indexOf('complete') > -1));
  chk('rm: action bar reachable (no dead end)', await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.sq-action'));
    return cs.pointerEvents !== 'none' && parseFloat(cs.opacity) > 0.5;
  }));
  await shot(page, '13-rm-s4-false-end.png');
  await page.click('#btnPrimary'); await page.waitForTimeout(450);
  chk('rm: "Close" reveals the loop instead', await page.getAttribute('#sq', 'data-state') === 's6' &&
      await page.evaluate(() => window.__sq.loopDrawn()), await page.getAttribute('#sq', 'data-state'));
  chk('rm: expiry legible without animation', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.card__row--expiry dd')).opacity) > 0.9));
  await shot(page, '14-rm-s6.png');
  chk('no page errors in reduced motion', rmErr.length === 0, rmErr.join(' | '));
  await ctx.close();

  /* ======================= 6. KEYBOARD ONLY ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  await page.goto(FILE); await page.waitForTimeout(250);
  await page.focus('#btnPrimary'); await page.keyboard.press('Enter'); await page.waitForTimeout(160);
  chk('kb: Enter advances', await page.getAttribute('#sq', 'data-state') === 's1');
  await page.focus('#btnPrimary'); await page.keyboard.press('Enter'); await page.waitForTimeout(160);
  await page.focus('.chip[data-chip="people"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(220);
  chk('kb: focus enters the sheet', await page.evaluate(() =>
    document.getElementById('sheetPeople').contains(document.activeElement)));
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(120);
  chk('kb: focus is trapped inside the sheet', await page.evaluate(() =>
    document.getElementById('sheetPeople').contains(document.activeElement)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  chk('kb: focus returns to the opener', await page.evaluate(() =>
    document.activeElement.getAttribute('data-chip') === 'people'));
  for (const c of ['cases', 'transactions']) {
    await page.focus('.chip[data-chip="' + c + '"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(140);
    await page.keyboard.press('Escape'); await page.waitForTimeout(140);
  }
  chk('kb: gate opens without a mouse', !(await page.isDisabled('#btnPrimary')));
  await page.focus('#btnPrimary'); await page.keyboard.press('Enter');
  await page.waitForTimeout(5200);
  chk('kb: reaches s6 unaided', await page.getAttribute('#sq', 'data-state') === 's6', await page.getAttribute('#sq', 'data-state'));
  for (const st of ['s3', 's4', 's5']) {
    await page.evaluate(t => window.__sq.go(t), st); await page.waitForTimeout(120);
    chk('kb: ' + st + ' exposes no operable control while the bar is gone',
        await page.evaluate(() => {
          const live = [...document.querySelectorAll('.sq-action button, .sq-back')]
            .filter(b => !b.disabled && getComputedStyle(b).visibility !== 'hidden');
          return live.length === 0;
        }));
  }
  await ctx.close();

  /* ======================= 7. NO JAVASCRIPT ======================= */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  page = await ctx.newPage();
  await page.goto(FILE); await page.waitForTimeout(250);
  chk('no-JS: every panel readable', await page.$$eval('.panel', els =>
    els.filter(e => getComputedStyle(e).display !== 'none').length) === 6);
  chk('no-JS: every sheet readable inline', await page.$$eval('.sheet', els =>
    els.filter(e => !e.hidden && getComputedStyle(e).display !== 'none').length) === 4);
  chk('no-JS: all four card rows readable', await page.$$eval('.card__row', els =>
    els.filter(e => getComputedStyle(e).display !== 'none').length) === 4);
  chk('no-JS: the scope material is readable', await page.evaluate(() =>
    getComputedStyle(document.getElementById('scopeInline')).display !== 'none'));
  chk('no-JS: the limit block is readable', await page.isVisible('#limitBlock'));
  chk('no-JS: the expiry value is legible (not stuck mid-reveal)', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.card__row--expiry dd')).opacity) > 0.9));
  chk('no-JS: JS-only controls removed', await page.$$eval(
    '.chip, .receipt__trigger, .sq-action, .sheet__close, .receipt__close, .slots',
    els => els.filter(e => e.offsetParent !== null && e.getClientRects().length > 0).length) === 0);
  await shot(page, '15-nojs.png', { fullPage: true });
  await ctx.close();

  /* ======================= 8. VIEWPORT SWEEP ======================= */
  for (const [name, w, h] of [['320x568', 320, 568], ['375x667', 375, 667], ['390x844', 390, 844],
                              ['430x932', 430, 932], ['768x1024', 768, 1024],
                              ['1024x768', 1024, 768], ['1440x900', 1440, 900]]) {
    ctx = await browser.newContext({ viewport: { width: w, height: h } });
    page = await ctx.newPage();
    await page.goto(FILE); await page.waitForTimeout(250);
    let ovf = false, collide = 0, covered = 0, telegraph = false;
    let railW = Infinity, railH = Infinity;
    for (const st of ['s0', 's2', 's6', 's7']) {
      await reach(page, st);
      const m = await page.evaluate(state => {
        const de = document.documentElement;
        const labels = [...document.querySelectorAll('.rail__label')]
          .filter(t => getComputedStyle(t).opacity !== '0').map(t => t.getBoundingClientRect());
        let col = 0;
        for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) col++;
        }
        const bar = document.querySelector('.sq-action').getBoundingClientRect();
        let cov = 0;
        document.querySelectorAll('.limit-block').forEach(el => {
          const r = el.getBoundingClientRect();
          /* only a problem if it cannot be scrolled clear */
          if (r.height && r.bottom > bar.top && de.scrollHeight <= de.clientHeight) cov++;
        });
        const wrap = document.getElementById('railWrap').getBoundingClientRect();
        const dot = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
        const line = document.getElementById('railProgress').getBoundingClientRect();
        return { ovf: de.scrollWidth > de.clientWidth + 1, col: col, cov: cov,
                 railW: Math.round(wrap.width), railH: Math.round(line.width),
                 tele: (state === 's0' || state === 's2') && dot.top < wrap.bottom - 2 };
      }, st);
      ovf = ovf || m.ovf; collide += m.col; covered += m.cov; telegraph = telegraph || m.tele;
      railW = Math.min(railW, m.railW); railH = Math.min(railH, m.railH);
    }
    chk('viewport ' + name + ': no horizontal overflow', !ovf);
    chk('viewport ' + name + ': no rail label collision', collide === 0, String(collide));
    chk('viewport ' + name + ': limitation never trapped under the bar', covered === 0, String(covered));
    chk('viewport ' + name + ': loop band not telegraphed pre-reveal', !telegraph);
    chk('viewport ' + name + ': the rail is actually rendered', railW > 200 && railH > 100,
        'wrap=' + railW + ' line=' + railH);
    if (name === '1440x900') { await reach(page, 's4'); await shot(page, '16-desktop-false-end.png'); }
    await ctx.close();
  }

  /* ======================= 9. CROSS-ENGINE ======================= */
  for (const [name, b] of engines) {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await c2.newPage();
    const errs = []; p2.on('pageerror', e => errs.push(String(e)));
    let net = 0;
    p2.on('request', r => { if (!r.url().startsWith('file://')) net++; });
    await p2.goto(FILE); await p2.waitForTimeout(400);
    await p2.click('#btnPrimary'); await p2.waitForTimeout(200);
    await p2.click('#btnPrimary'); await p2.waitForTimeout(200);
    for (const c of ['people', 'cases', 'transactions']) {
      await p2.click('.chip[data-chip="' + c + '"]'); await p2.waitForTimeout(120);
      await p2.keyboard.press('Escape'); await p2.waitForTimeout(120);
    }
    await p2.click('#btnPrimary');
    await p2.waitForTimeout(6000);
    chk('engine ' + name + ': reaches s6 with the loop drawn',
        await p2.getAttribute('#sq', 'data-state') === 's6' && await p2.evaluate(() => window.__sq.loopDrawn()),
        await p2.getAttribute('#sq', 'data-state'));
    chk('engine ' + name + ': rail expanded for the loop', await p2.evaluate(() => {
      const w = document.getElementById('railWrap').getBoundingClientRect();
      const d = document.querySelector('.rail__station.is-loop').getBoundingClientRect();
      return d.bottom <= w.bottom + 2;
    }));
    chk('engine ' + name + ': no network request of any kind', net === 0, String(net));
    chk('engine ' + name + ': no browser storage used', await p2.evaluate(() => {
      try { return localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ''; }
      catch (e) { return true; }
    }));
    chk('engine ' + name + ': no page errors', errs.length === 0, errs.slice(0, 1).join(''));
    if (name !== 'chromium') await shot(p2, '17-' + name + '-s6.png');
    await c2.close();
  }
  for (const [, b] of engines) await b.close();

  const failed = results.filter(r => !r.pass);
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' checks passed ====');
  console.log('engines: ' + engines.map(e => e[0]).join(', '));
  if (failed.length) { failed.forEach(f => console.log('  FAILED: ' + f.name + ' :: ' + f.detail)); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
