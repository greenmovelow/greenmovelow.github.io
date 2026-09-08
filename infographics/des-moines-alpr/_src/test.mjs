/* ============================================================================
   RDP — Des Moines ALPR exhibit. Browser test pass.

   Exercises the exhibit at three viewports and asserts the behaviours the
   editorial guardrails depend on: no default connectors, one connector on
   selection, receipt drawers, keyboard reachability, the council-summary
   switch, reduced motion, and the no-JS render.

   Run:  node _src/test.mjs           (server must be on :8787)
   Shots: _src/screens/*.png
   ========================================================================= */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'screens');
mkdirSync(SHOTS, { recursive: true });

const BASE = 'http://127.0.0.1:8787/infographics/des-moines-alpr';
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};

let pass = 0, fail = 0;
const ok = (n, d = '') => { pass++; console.log(`ok    ${n}${d ? ' — ' + d : ''}`); };
const no = (n, d = '') => { fail++; console.log(`FAIL  ${n}${d ? ' — ' + d : ''}`); };
const assert = (cond, n, d) => cond ? ok(n, d) : no(n, d);

const browser = await chromium.launch();

/* Scroll a target clear of the sticky masthead before clicking it. */
async function scrollClear(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(120);
}

/* ------------------------------------------------- 1. screenshots, 3 sizes */
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  for (const [route, file] of [['/', 'index'], ['/network/', 'network'], ['/records/', 'records']]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, `${file}-${name}.png`), fullPage: false });
    if (name === 'desktop' || (name === 'mobile' && file === 'index')) {
      await page.screenshot({ path: join(SHOTS, `${file}-${name}-full.png`), fullPage: true });
    }
    /* horizontal overflow check */
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `no horizontal overflow · ${file} @ ${name}`, `${overflow}px`);
  }
  assert(errors.length === 0, `no JS errors @ ${name}`, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------- 2. network explorer behaviour */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/network/', { waitUntil: 'networkidle' });

  assert(await page.locator('#tilemap .node-g').count() === 155,
    'explorer renders 155 open rings', String(await page.locator('#tilemap .node-g').count()));
  assert(await page.locator('#tilemap circle.node-dm').count() === 1,
    'exactly one filled node (Des Moines)');
  assert(await page.locator('#connectors line').count() === 0,
    'DEFAULT STATE: zero connectors drawn');

  /* select one agency */
  const first = page.locator('#tilemap .node-g').first();
  await scrollClear(page, first);
  await first.click();
  await page.waitForTimeout(150);
  assert(await page.locator('#connectors line.connector').count() === 1,
    'selection draws exactly one connector');
  assert(await page.locator('#connectors [marker-end]').count() === 0,
    'connector has no arrowhead');
  assert(await page.locator('#connectors .connector-toggle').count() === 1,
    'connector carries the toggle glyph');
  const toggleTitle = await page.locator('#connectors .connector-toggle title')
    .evaluate((el) => el.textContent);
  assert(/configured to share/i.test(toggleTitle) && !/sent|transmitted/i.test(toggleTitle),
    'connector is labelled "configured to share", not "data sent"');

  assert(await page.locator('#receipt-drawer[data-open="true"]').count() === 1,
    'selecting an agency opens its source-row receipt');
  const drawerText = await page.locator('#receipt-drawer .rd-inner').innerText();
  assert(/Detection sharing: Sharing/.test(drawerText), 'receipt shows the verbatim export row');
  assert(/does not establish/i.test(drawerText), 'receipt states what it does not establish');
  await page.screenshot({ path: join(SHOTS, 'network-agency-selected.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert(await page.locator('#receipt-drawer[data-open="true"]').count() === 0,
    'Escape closes the receipt drawer');

  /* deselect clears the connector */
  await first.click();
  await page.waitForTimeout(150);
  assert(await page.locator('#connectors line.connector').count() === 0,
    'deselecting removes the connector');
  await page.keyboard.press('Escape');

  /* filters */
  const before = await page.locator('#network-tbody tr').count();
  await page.locator('.filter-opt[data-value="iowa"]').click();
  await page.waitForTimeout(150);
  const afterIowa = await page.locator('#network-tbody tr').count();
  assert(before === 155 && afterIowa === 14,
    'Iowa filter narrows the table from 155 to 14', `${before} → ${afterIowa}`);
  const readout = await page.locator('#network-readout').innerText();
  assert(/14 of 155/.test(readout), 'readout reflects the filter', readout.split('\n')[0]);
  await page.screenshot({ path: join(SHOTS, 'network-filter-iowa.png') });

  await page.locator('#network-clear').click();
  await page.waitForTimeout(150);
  assert(await page.locator('#network-tbody tr').count() === 155, 'clear restores all 155 rows');

  /* keyboard reachability of a ring */
  await page.locator('#tilemap .node-g').nth(3).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert(await page.locator('#connectors line.connector').count() === 1,
    'a ring is selectable by keyboard');
  await page.keyboard.press('Escape');

  /* state tile filter */
  const tx = page.locator('.tile-cell[data-state="TX"]');
  await scrollClear(page, tx);
  /* rings sit above the tile and take pointer precedence by design; the
     ring-free label band at the top of the tile is the state's own target */
  await tx.click({ position: { x: 14, y: 7 } });
  await page.waitForTimeout(150);
  assert(await page.locator('#network-tbody tr').count() === 27,
    'selecting the Texas tile filters to its 27 rows');
  await ctx.close();
}

/* --------------------------------------------------- 3. narrative page */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  /* receipt chip */
  await page.locator('button[data-receipt="R-MVA-4.5"]').first().click();
  await page.waitForTimeout(200);
  const rd = await page.locator('#receipt-drawer .rd-inner').innerText();
  assert(/by selecting this option within Vigilant VehicleManager/.test(rd),
    'page-9 receipt carries the verbatim clause');
  assert(/page 9 of the 25-page clerk/i.test(rd), 'receipt pinpoints page 9');
  await page.screenshot({ path: join(SHOTS, 'index-receipt-drawer.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  /* council-summary switch */
  const sw = page.locator('#summary-switch');
  await scrollClear(page, sw);
  const label = await sw.innerText();
  assert(/council-facing summary described/i.test(label) && !/knew|saw/i.test(label),
    'switch is labelled by what the summary described');
  await sw.click();
  await page.waitForTimeout(300);
  assert(await page.locator('#scrolly[data-summary-dim="true"]').count() === 1,
    'switch dims material outside the council-facing summary');
  const dimOpacity = await page.locator('#scrolly .not-in-summary').first()
    .evaluate((el) => getComputedStyle(el).opacity);
  assert(Number(dimOpacity) < 0.3, 'out-of-summary material is visibly de-emphasised', dimOpacity);
  const refOpacity = await page.locator('#scrolly .by-reference').first()
    .evaluate((el) => getComputedStyle(el).opacity);
  assert(Number(refOpacity) > Number(dimOpacity),
    'material incorporated by reference stays more visible than material absent entirely',
    `by-reference ${refOpacity} vs absent ${dimOpacity}`);
  await page.screenshot({ path: join(SHOTS, 'index-council-switch-on.png'), fullPage: false });
  await sw.click();
  await page.waitForTimeout(200);

  /* document stack */
  const p9 = page.locator('.doc-page[data-pagenine="true"]');
  await scrollClear(page, p9);
  await p9.click();
  await page.waitForTimeout(150);
  const ro = await page.locator('#doc-stack-readout').innerText();
  assert(/Page 9/.test(ro) && /4\.4|4\.5|License Plate/i.test(ro),
    'selecting page 9 reports its contents', ro.replace(/\n/g, ' ').slice(0, 90));

  /* arrow-key traversal of the stack */
  await page.locator('.doc-page[data-page="1"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const focusedPage = await page.evaluate(() => document.activeElement.getAttribute('data-page'));
  assert(focusedPage === '2', 'arrow keys move through the document stack', `focus on page ${focusedPage}`);

  /* the hard cut is present and says so */
  const hc = await page.locator('.hard-cut').innerText();
  assert(/2023 RECORD/i.test(hc) && /2026 CONFIGURATION SNAPSHOT/i.test(hc) &&
    /do not establish when/i.test(hc), 'hard cut states the discontinuity explicitly');

  /* the empty lane really is empty */
  const emptyLane = await page.locator('.lane[data-state="empty"]');
  assert(await emptyLane.count() === 1, 'exactly one empty lane in the use layer');
  await scrollClear(page, emptyLane);
  await page.screenshot({ path: join(SHOTS, 'index-empty-drawer.png') });
  await ctx.close();
}

/* ------------------------------------------------------- 4. records page */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/records/', { waitUntil: 'networkidle' });
  assert(await page.locator('.mode-panel:not([hidden])').count() === 1, 'one record view visible at a time');
  await page.locator('.mode-btn[data-mode="parts"]').click();
  await page.waitForTimeout(150);
  const vis = await page.locator('.mode-panel:not([hidden])').getAttribute('data-mode');
  assert(vis === 'parts', 'switching to the parts list works', vis);
  assert(await page.locator('#mode-parts tbody tr').count() >= 20,
    'parts list is populated', String(await page.locator('#mode-parts tbody tr').count()));
  await page.screenshot({ path: join(SHOTS, 'records-parts.png') });

  await page.locator('.mode-btn[data-mode="tree"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, 'records-chains.png') });

  /* The two chains must stay distinguishable with no colour at all. Hue is
     allowed to encode chain, but it may never be the only thing that does. */
  const chainStyles = await page.evaluate(() => {
    const pick = (sel) => {
      const rail = document.querySelector(sel);
      const glyph = rail.querySelector('.chain-glyph');
      const cs = getComputedStyle(rail);
      const gs = getComputedStyle(glyph);
      return {
        borderStyle: cs.borderLeftStyle,
        borderWidth: cs.borderLeftWidth,
        glyphRadius: gs.borderTopLeftRadius,
        name: rail.querySelector('.chain-name').textContent.trim()
      };
    };
    return { a: pick('.chain-rail[data-chain="A"]'), b: pick('.chain-rail[data-chain="B"]') };
  });
  assert(chainStyles.a.borderStyle !== chainStyles.b.borderStyle,
    'chains differ by rail style, not only hue',
    `A ${chainStyles.a.borderStyle} vs B ${chainStyles.b.borderStyle}`);
  assert(chainStyles.a.glyphRadius !== chainStyles.b.glyphRadius,
    'chains differ by end-cap glyph shape',
    `A radius ${chainStyles.a.glyphRadius} vs B radius ${chainStyles.b.glyphRadius}`);
  assert(/Chain A/i.test(chainStyles.a.name) && /Chain B/i.test(chainStyles.b.name),
    'each chain is named in text', `${chainStyles.a.name} | ${chainStyles.b.name}`);

  /* and prove it: the same view with all colour removed */
  await page.locator('.chain-rail[data-chain="B"]')
    .evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.addStyleTag({ content: 'html{filter:grayscale(1) !important}' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(SHOTS, 'records-chains-greyscale.png') });

  /* back/forward across routes */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('a[href="/infographics/des-moines-alpr/network/"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  assert(page.url().endsWith('/des-moines-alpr/'), 'browser back returns to the narrative page', page.url());
  await ctx.close();
}

/* ------------------------------------------------------- 5. reduced motion */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/network/', { waitUntil: 'networkidle' });
  const rmNode = page.locator('#tilemap .node-g').first();
  await scrollClear(page, rmNode);
  await rmNode.click();
  await page.waitForTimeout(50);
  const anim = await page.locator('#connectors line.connector')
    .evaluate((el) => getComputedStyle(el).animationName);
  const op = await page.locator('#connectors line.connector')
    .evaluate((el) => getComputedStyle(el).opacity);
  assert(anim === 'none' && Number(op) > 0.5,
    'reduced motion: connector appears instantly, fully visible', `animation:${anim} opacity:${op}`);
  const drawerTrans = await page.locator('#receipt-drawer')
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  assert(/^0s/.test(drawerTrans), 'reduced motion: drawer does not animate', drawerTrans);
  await page.screenshot({ path: join(SHOTS, 'network-reduced-motion.png') });
  await ctx.close();
}

/* ------------------------------------------------------------- 6. no JS */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, javaScriptEnabled: false });
  const page = await ctx.newPage();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const idxText = await page.locator('body').innerText();
  assert(/Sources for every claim on this page/.test(idxText), 'no-JS: receipts fallback renders');
  assert(/by selecting this option within Vigilant VehicleManager/.test(idxText),
    'no-JS: the page-9 clause is present in the static HTML');
  assert(/mistakenly left off/.test(idxText), 'no-JS: the change-form quotation is present');
  await page.screenshot({ path: join(SHOTS, 'index-nojs.png'), fullPage: false });

  await page.goto(BASE + '/network/', { waitUntil: 'domcontentloaded' });
  assert(await page.locator('#network-tbody tr').count() === 155,
    'no-JS: all 155 export rows render server-side');
  assert(await page.locator('#tilemap .node-g').count() === 0,
    'no-JS: no rings, and therefore no connectors');
  await page.screenshot({ path: join(SHOTS, 'network-nojs.png') });

  await page.goto(BASE + '/records/', { waitUntil: 'domcontentloaded' });
  const recText = await page.locator('body').innerText();
  assert(/Chronology/.test(recText) && /Parts list/.test(recText),
    'no-JS: record views are in the static HTML');
  await ctx.close();
}

/* ------------------------------------------- 7. keyboard-only walkthrough */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const firstStop = await page.evaluate(() => document.activeElement.className);
  assert(/skip-link/.test(firstStop), 'first tab stop is the skip link', firstStop);

  let reachedChip = false;
  for (let i = 0; i < 40 && !reachedChip; i++) {
    await page.keyboard.press('Tab');
    reachedChip = await page.evaluate(() =>
      !!(document.activeElement && document.activeElement.hasAttribute('data-receipt')));
  }
  assert(reachedChip, 'a receipt chip is reachable by keyboard alone');
  if (reachedChip) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const focusIsClose = await page.evaluate(() => document.activeElement.id === 'rd-close');
    assert(focusIsClose, 'opening a receipt moves focus into the drawer');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const back = await page.evaluate(() =>
      !!(document.activeElement && document.activeElement.hasAttribute('data-receipt')));
    assert(back, 'closing the receipt returns focus to the chip that opened it');
  }

  /* focus visibility */
  const outline = await page.evaluate(() => {
    const b = document.querySelector('.receipt-chip');
    b.focus();
    return getComputedStyle(b).outlineStyle + ' ' + getComputedStyle(b).outlineWidth;
  });
  assert(!/none/.test(outline), 'focus is visible', outline);
  await ctx.close();
}

/* ------------------------------- 8. mobile: the jurisdiction-list path ---- */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.mobile, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/network/', { waitUntil: 'networkidle' });

  /* At 390px the grid would be illegible, so the legible jurisdiction list
     leads and the grid sits behind a disclosure. */
  assert(await page.locator('#state-list').isVisible(), 'mobile: jurisdiction list is the primary surface');
  assert(await page.locator('#tilemap-details').evaluate((el) => !el.open),
    'mobile: the tile grid is collapsed by default');
  assert(await page.locator('.state-btn').count() === 37,
    'mobile: all 37 jurisdictions are listed', String(await page.locator('.state-btn').count()));
  await scrollClear(page, page.locator('#state-list'));
  await page.screenshot({ path: join(SHOTS, 'network-mobile-statelist.png') });

  /* pick Iowa, then open one agency's source row from the filtered table */
  await page.locator('.state-btn[data-state="IA"]').click();
  await page.waitForTimeout(200);
  assert(await page.locator('#network-tbody tr').count() === 14,
    'mobile: selecting Iowa filters the table to its 14 rows',
    String(await page.locator('#network-tbody tr').count()));
  assert(await page.locator('.state-btn[data-state="IA"][aria-pressed="true"]').count() === 1,
    'mobile: the selected jurisdiction reports its pressed state');

  const rowChip = page.locator('#network-tbody .receipt-chip').first();
  await scrollClear(page, rowChip);
  await rowChip.click();
  await page.waitForTimeout(250);
  const sheet = await page.locator('#receipt-drawer').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
  });
  assert(Math.abs(sheet.bottom - sheet.vh) < 2 && sheet.top > 0,
    'mobile: the receipt opens as a bottom sheet, anchored to the viewport floor',
    `top ${Math.round(sheet.top)}px, bottom ${Math.round(sheet.bottom)}px of ${sheet.vh}px`);
  const sheetText = await page.locator('#receipt-drawer .rd-inner').innerText();
  assert(/Detection sharing: Sharing/.test(sheetText) && /does not establish/i.test(sheetText),
    'mobile: the sheet carries the verbatim row and its limit');
  await page.screenshot({ path: join(SHOTS, 'network-mobile-sheet.png') });
  await page.keyboard.press('Escape');

  /* the grid is still reachable, and legible, behind the disclosure */
  await page.locator('#tilemap-details > summary').click();
  await page.waitForTimeout(250);
  const tmw = await page.locator('#tilemap').evaluate((el) => el.getBoundingClientRect().width);
  assert(tmw >= 720, 'mobile: the opened grid keeps a legible width inside a scroller',
    `${Math.round(tmw)}px in a ${VIEWPORTS.mobile.width}px viewport`);
  await scrollClear(page, page.locator('#tilemap-details'));
  await page.screenshot({ path: join(SHOTS, 'network-mobile-grid-open.png') });

  /* narrative page at 390px */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await scrollClear(page, page.locator('#doc-stack'));
  await page.screenshot({ path: join(SHOTS, 'index-mobile-stack.png') });

  /* touch-target floor on the smallest interactive control */
  const small = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.doc-page, .receipt-chip, .switch-btn, .mode-btn')];
    return els.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); })
      .filter((n) => n > 0).sort((a, b) => a - b)[0];
  });
  assert(small >= 24, 'mobile: smallest interactive control is at least 24px on its short edge',
    `${Math.round(small)}px`);
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} assertion(s) passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
