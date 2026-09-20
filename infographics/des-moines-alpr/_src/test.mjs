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
import { mkdirSync, readFileSync } from 'node:fs';
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

/* PW_CHROMIUM_PATH lets a sandbox with a preinstalled Chromium run the suite
   without downloading a browser; unset, Playwright uses its own download. */
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

/* Walk the page so every `.reveal` block has been observed: review captures
   must show the finished section, not mid-reveal blanks. */
async function settleReveals(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(400, innerHeight * 0.7)) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 90));
    }
    scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(400);
}

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

  for (const [route, file] of [['/', 'overview'], ['/network/', 'network']]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOTS, `${file}-${name}.png`), fullPage: false });
    if (name === 'desktop' || (name === 'mobile' && file === 'overview')) {
      if (file === 'overview') {
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(400, innerHeight * .7)) {
            scrollTo({ top: y, behavior: 'instant' });
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          scrollTo({ top: 0, behavior: 'instant' });
        });
      }
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

/* -------------------------------------- 1b. visual companion semantics */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  assert(await page.locator('#visual-map .visual-state.is-configured').count() === 37,
    'visual map renders 36 states plus D.C. from the export',
    String(await page.locator('#visual-map .visual-state.is-configured').count()));
  assert(await page.locator('#relationship-layer [data-relationship]').count() === 0,
    'visual map default state has no relationship path');
  const visualAssets = await page.evaluate(() => ({
    fixed: getComputedStyle(document.querySelector('.fixed-panel')).backgroundImage,
    street: getComputedStyle(document.querySelector('.street-frame')).backgroundImage,
    loaded: performance.getEntriesByType('resource').map((entry) => entry.name)
  }));
  assert(/fixed-mobile\.webp/.test(visualAssets.fixed) && visualAssets.loaded.some((url) => /fixed-mobile\.webp/.test(url)),
    'fixed/mobile production scene asset loads');
  assert(/street-observation\.webp/.test(visualAssets.street) && visualAssets.loaded.some((url) => /street-observation\.webp/.test(url)),
    'street-observation production scene asset loads');

  await page.locator('#visual-map .visual-state[data-state="CA"]').click();
  assert(await page.locator('#relationship-layer [data-relationship="configured"]').count() === 1,
    'explicit state selection creates one relationship path');
  const selectedPath = page.locator('#relationship-layer [data-relationship="configured"]');
  assert(await selectedPath.getAttribute('marker-end') === null,
    'selected relationship has no arrowhead');
  const anim = await selectedPath.evaluate((el) => getComputedStyle(el).animationName);
  assert(anim === 'none', 'no motion runs along the selected relationship', anim);
  const selectedStatus = await page.locator('#map-status').innerText();
  assert(/Configured relationship only/i.test(selectedStatus) && /not a search, view or transfer/i.test(selectedStatus),
    'selected relationship is qualified as configuration, not activity', selectedStatus);

  await page.locator('.scope-button[data-scope="iowa"]').click();
  assert(await page.locator('#visual-map .visual-state.is-configured.is-in-scope').count() === 1,
    'Iowa scope leaves exactly one represented state in scope');
  await page.locator('.scope-button[data-scope="outside"]').click();
  assert(await page.locator('#visual-map .visual-state.is-configured.is-in-scope').count() === 36,
    'outside-Iowa scope leaves 35 states plus D.C. in scope');
  await page.screenshot({ path: join(SHOTS, 'overview-outside-iowa.png'), fullPage: false });

  assert(errors.length === 0, 'visual companion has no JS errors', errors.join(' | '));
  await ctx.close();
}

/* ------------------- 1c. figure 2 / figure 3 corrections (article graphics) */
{
  const TOTALS = JSON.parse(readFileSync(join(HERE, '..', 'data', 'state_counts.json'), 'utf8')).totals;
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  /* ---- figure 2: what the platform could search in 2023 ---- */
  const fig2 = page.locator('section.three-sources');
  const fig2Text = (await fig2.innerText()).replace(/\s+/g, ' ');

  assert(fig2Text.includes('WHAT THE PLATFORM COULD SEARCH IN 2023'),
    'figure 2 is scoped to what the platform could search in 2023');
  assert(fig2Text.includes('DIFFERENT SOURCES. A LARGER SEARCHABLE PICTURE.'),
    'figure 2 carries its subtitle');

  /* Capability, not activity: the record establishes what was purchased or
     contracted for, not that cameras were operating, that in-car readers were
     enabled, or that partner data was in fact available in 2023. */
  const cityText = (await page.locator('.source-stream--city').innerText()).replace(/\s+/g, ' ');
  const agencyText = (await page.locator('.source-stream--agency').innerText()).replace(/\s+/g, ' ');
  assert(cityText.includes('Des Moines ALPR capability') && cityText.includes('Fixed and in-car reader systems'),
    'source 1 is labelled as capability, not as detections', cityText);
  assert(agencyText.includes('Partner-agency LPR data') && agencyText.includes('VehicleManager permitted reciprocal sharing'),
    'source 2 is labelled as permitted sharing, not as data actually shared', agencyText);
  assert(!/Des Moines detections|Detections shared by partner agencies/.test(fig2Text),
    'figure 2 no longer implies 2023 detection or sharing activity');
  const srSummary = await fig2.locator('.sr-only').innerText();
  assert(/purchased or contracted capabilit/i.test(srSummary)
    && /do not establish that fixed cameras were operating/i.test(srSummary)
    && /what the platform could search, not what it did search/i.test(srSummary),
    'the screen-reader summary draws the same capability-not-activity distinction');

  const commercial = page.locator('.source-stream--commercial');
  const commercialText = (await commercial.innerText()).replace(/\s+/g, ' ');
  assert(commercialText.includes('Included in the 2023 package'),
    'the commercial source is dated to the 2023 package');
  assert(commercialText.includes('Not established for the 2026 renewal'),
    'the commercial source carries its 2026 qualification');

  /* The distinction must survive greyscale: dashed geometry AND a text label,
     never colour alone. */
  const borders = await page.evaluate(() => {
    const style = (sel) => getComputedStyle(document.querySelector(sel)).borderTopStyle;
    return {
      commercial: style('.source-stream--commercial'),
      city: style('.source-stream--city'),
      agency: style('.source-stream--agency')
    };
  });
  assert(borders.commercial === 'dashed' && borders.city === 'solid' && borders.agency === 'solid',
    'the commercial source is drawn dashed while both law-enforcement sources stay solid',
    JSON.stringify(borders));
  assert(/DASHED/.test(commercialText) && /SOLID/.test((await page.locator('.source-stream--city').innerText())),
    'the dashed/solid distinction is also stated in text, not carried by colour alone');

  assert(fig2Text.includes('A plate detection could be searched later even if it did not trigger an alert when it was collected.'),
    'figure 2 carries the later-search callout');
  assert(!/FaceSearch/i.test(await fig2.innerHTML()),
    'the face-matching detail is not shown in the explanatory source figure');
  assert(fig2Text.includes('DMPD says ALPR supports missing or endangered persons, stolen vehicles or plates, and investigative work.')
    && fig2Text.includes('Policy says an ALPR alert alone is not sufficient probable cause for a stop.'),
    'figure 2 keeps the policy and permitted-use language visible');

  const fig2Html = await fig2.innerHTML();
  assert(!/<marker\b|marker-end|marker-start|marker-mid|animateMotion|offset-path|stroke-dashoffset/i.test(fig2Html),
    'figure 2 introduces no arrowhead, draw-on or motion-along-path cue');

  /* ---- figure 3: a wider network ---- */
  const hero = page.locator('.visual-hero');
  const heroText = (await hero.innerText()).replace(/\s+/g, ' ');
  assert(heroText.includes('A Wider Network') && heroText.includes('ONE CITY. A BROADER SYSTEM.'),
    'the map carries the A Wider Network figure treatment');
  assert((await page.locator('h1#visual-hero-h').innerText()).trim() === 'WHERE DES MOINES PLATE DATA CAN GO',
    'the document-level exhibit H1 is unchanged');

  const metrics = await page.locator('.hero-metric').evaluateAll((els) =>
    els.map((el) => ({
      value: el.querySelector('strong').textContent.trim(),
      label: el.querySelector('span').textContent.trim(),
      visible: el.getBoundingClientRect().width > 0
    })));
  assert(metrics.length === 4, 'the map carries four governed metrics', String(metrics.length));
  const expected = [
    [String(TOTALS.agencies), 'configured detection-sharing relationships'],
    [String(TOTALS.states_excl_dc), 'states + D.C.'],
    [String(TOTALS.non_iowa), 'outside Iowa'],
    [String(TOTALS.federal_typed), 'rows typed federal']
  ];
  for (const [i, [value, label]] of expected.entries()) {
    assert(metrics[i] && metrics[i].value === value && metrics[i].label === label && metrics[i].visible,
      `metric ${i + 1} renders the governed total`, JSON.stringify(metrics[i]));
  }

  const CAVEAT = 'Configured relationships reflect settings in an August 2026 sharing export. Configuration does not establish that an agency searched, viewed, downloaded, or received a particular Des Moines record.';
  assert(heroText.includes(CAVEAT), 'the full configuration-not-activity caveat is visible beside the map');
  assert(await page.locator('.hero-source').isVisible(), 'the caveat is visible without opening anything');

  assert(await page.locator('#relationship-layer [data-relationship]').count() === 0,
    'figure 3 has no connector at initial load');
  await page.locator('#visual-map .visual-state[data-state="TX"]').click();
  const paths = page.locator('#relationship-layer [data-relationship="configured"]');
  assert(await paths.count() === 1, 'selection still creates exactly one configuration path');
  assert(await paths.first().getAttribute('marker-end') === null
    && await paths.first().getAttribute('marker-start') === null,
    'the selected configuration path stays undirected');
  await settleReveals(page);
  await page.locator('.visual-hero').screenshot({ path: join(SHOTS, 'figure3-desktop.png') });
  await fig2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await fig2.screenshot({ path: join(SHOTS, 'figure2-desktop.png') });
  await ctx.close();
}

/* ------- 1d. figure corrections: reduced motion, no-JS and mobile layout --- */
{
  const rm = await browser.newContext({ viewport: VIEWPORTS.desktop, reducedMotion: 'reduce' });
  const rmPage = await rm.newPage();
  await rmPage.goto(BASE + '/', { waitUntil: 'networkidle' });
  const rmStyles = await rmPage.evaluate(() => {
    const read = (sel) => {
      const cs = getComputedStyle(document.querySelector(sel));
      return { opacity: cs.opacity, transition: cs.transitionDuration, transform: cs.transform };
    };
    return { metrics: read('.hero-metrics'), sources: read('.source-stage') };
  });
  assert(rmStyles.metrics.opacity === '1' && /^0s/.test(rmStyles.metrics.transition) && rmStyles.metrics.transform === 'none'
    && rmStyles.sources.opacity === '1' && /^0s/.test(rmStyles.sources.transition),
    'reduced motion: the revised metric row and source figure render immediately',
    JSON.stringify(rmStyles));
  await rm.close();

  const nojs = await browser.newContext({ viewport: VIEWPORTS.desktop, javaScriptEnabled: false });
  const nojsPage = await nojs.newPage();
  await nojsPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const nojsText = (await nojsPage.locator('.visual-hero').innerText()).replace(/\s+/g, ' ');
  assert(/155\s*configured detection-sharing relationships/.test(nojsText)
    && /36\s*states \+ D\.C\./.test(nojsText)
    && /141\s*outside Iowa/.test(nojsText)
    && /5\s*rows typed federal/.test(nojsText),
    'no-JS: all four governed metrics are server-rendered');
  assert(/Configuration does not establish that an agency searched, viewed, downloaded, or received a particular Des Moines record\./.test(nojsText),
    'no-JS: the full caveat is server-rendered');
  assert(await nojsPage.locator('.visual-access-table table tbody tr').count() === 37,
    'no-JS: the map still reads as a 37-jurisdiction list');
  assert(await nojsPage.locator('#relationship-layer [data-relationship]').count() === 0,
    'no-JS: no connector is drawn');
  await nojs.close();

  const mob = await browser.newContext({ viewport: VIEWPORTS.mobile, hasTouch: true, isMobile: true });
  const mobPage = await mob.newPage();
  await mobPage.goto(BASE + '/', { waitUntil: 'networkidle' });
  const overflow = await mobPage.evaluate(() => ({
    doc: document.documentElement.scrollWidth <= window.innerWidth + 1,
    metrics: [...document.querySelectorAll('.hero-metric')]
      .every((el) => el.scrollWidth <= el.clientWidth + 1),
    streams: [...document.querySelectorAll('.source-stream')]
      .every((el) => el.scrollWidth <= el.clientWidth + 1)
  }));
  assert(overflow.doc, 'mobile: the revised overview has no horizontal page overflow');
  assert(overflow.metrics && overflow.streams,
    'mobile: no metric or source card clips its own text', JSON.stringify(overflow));
  const mobMetric = await mobPage.locator('.hero-metric').first().evaluate((el) => ({
    font: parseFloat(getComputedStyle(el.querySelector('span')).fontSize),
    w: el.getBoundingClientRect().width
  }));
  assert(mobMetric.font >= 14 && mobMetric.w >= 120,
    'mobile: metric labels keep an accessible type size and column width', JSON.stringify(mobMetric));
  await settleReveals(mobPage);
  const fig2m = mobPage.locator('section.three-sources');
  await fig2m.scrollIntoViewIfNeeded();
  await mobPage.waitForTimeout(400);
  await fig2m.screenshot({ path: join(SHOTS, 'figure2-mobile.png') });
  await mobPage.locator('.visual-hero').screenshot({ path: join(SHOTS, 'figure3-mobile.png') });
  await mob.close();
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

/* ----------------------------------------- 3. canonical overview and IA */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  assert((await page.locator('h1').innerText()).trim() === 'WHERE DES MOINES PLATE DATA CAN GO',
    'canonical root renders the visual overview');

  const publicNav = await page.locator('.exhibit-nav.routes').innerText();
  assert(/Overview/i.test(publicNav) && /Explore the network/i.test(publicNav),
    'public exhibit navigation contains overview and network');
  assert(!/Expanded Plate-Reader Use|The Record|Explore the Configuration/i.test(publicNav),
    'removed route labels are absent from public navigation');

  const heroLinks = page.locator('.visual-cta-group a');
  assert(await heroLinks.count() === 3, 'hero CTA group has the intended three actions');
  assert(/^Read the full story/i.test((await heroLinks.nth(0).innerText()).trim()),
    'Read the full story is first and primary');
  assert(/visual-cta--primary/.test(await heroLinks.nth(0).getAttribute('class')),
    'Read the full story carries the primary treatment');
  const primaryColors = await heroLinks.nth(0).evaluate((el) => {
    const style = getComputedStyle(el); return { color: style.color, background: style.backgroundColor };
  });
  assert(primaryColors.color !== primaryColors.background,
    'primary CTA text remains visible against its fill', JSON.stringify(primaryColors));
  assert(/^Explore the network/i.test((await heroLinks.nth(1).innerText()).trim()),
    'Explore the network is second');
  assert(/^Subscribe — 7 days free/i.test((await heroLinks.nth(2).innerText()).trim()),
    'Subscribe is present as the tertiary CTA');
  assert(await heroLinks.nth(0).getAttribute('href') === 'https://investigations.restoring-democracy.org/p/des-moines-expanded-plate-reader',
    'story CTA preserves its existing destination');
  assert(await heroLinks.nth(2).getAttribute('href') === 'https://investigations.restoring-democracy.org/fall_signal_drop/',
    'subscription CTA reuses the long-form destination');

  const bodyText = await page.locator('body').innerText();
  assert(!/Expanded Plate-Reader Use|View the full evidence record|Explore the Configuration/i.test(bodyText),
    'retired public labels are absent from the overview');
  assert(await page.locator('a[href*="/records/"]').count() === 0,
    'overview has no link to the detached records page');

  const pageNine = page.locator('.page-nine');
  const pageNineText = await pageNine.innerText();
  assert(/by selecting this option within Vigilant VehicleManager/.test(pageNineText),
    'Page 9 explanatory evidence remains');
  assert(await pageNine.locator('img').evaluate((img) => img.complete && img.naturalWidth > 100),
    'Page 9 facsimile remains and loads');
  assert(/23-1629\.pdf, page 9/.test(await pageNine.locator('figcaption').innerText()),
    'Page 9 source caption remains');
  assert(await pageNine.locator('a').count() === 0,
    'Page 9 evidence-record CTA is removed without removing evidence');

  const endLinks = await page.locator('.visual-end-links').innerText();
  assert(/READ THE FULL STORY/.test(endLinks) && /EXPLORE THE NETWORK/.test(endLinks) &&
    /SUBSCRIBE — 7 DAYS FREE/.test(endLinks), 'bottom CTA group uses the revised hierarchy');
  await ctx.close();
}

/* ------------------------------------------ 3b. metadata and share URLs */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => { window.__shareData = data; }
    });
  });

  const expected = [
    {
      route: '/?utm_source=qa#map',
      title: "Where Des Moines Plate Data Can Go | Restoring Democracy's Promise",
      description: 'An interactive visual investigation of Des Moines’ plate-reader system—mobile and fixed collection, searchable vehicle-location data, and 155 configured sharing relationships across 36 states and the District of Columbia.',
      canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/'
    },
    {
      route: '/network/?utm_source=qa#rows',
      title: "Explore the Des Moines Plate-Reader Network | Restoring Democracy's Promise",
      description: 'Explore 155 configured detection-sharing relationships—not actual searches or transfers—in Des Moines’ August 2026 VehicleManager export, spanning 36 states and the District of Columbia.',
      canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/network/'
    }
  ];

  for (const item of expected) {
    await page.goto(BASE + item.route, { waitUntil: 'networkidle' });
    assert(await page.title() === item.title, `metadata: route-specific title · ${item.canonical}`);
    assert(await page.locator('meta[name="description"]').getAttribute('content') === item.description,
      `metadata: route-specific description · ${item.canonical}`);
    assert(await page.locator('meta[name="robots"]').getAttribute('content') === 'index,follow',
      `metadata: public route is indexable · ${item.canonical}`);
    assert(await page.locator('.draft-banner').count() === 0,
      `metadata: no prepublication banner · ${item.canonical}`);
    assert(await page.locator('link[rel="canonical"]').count() === 1 &&
      await page.locator('link[rel="canonical"]').getAttribute('href') === item.canonical,
      `metadata: one production canonical · ${item.canonical}`);
    assert(await page.locator('meta[property="og:image"]').getAttribute('content') ===
      'https://restoring-democracy.org/infographics/des-moines-alpr/assets/og/dsm_alpr_og.png',
      `metadata: approved social image · ${item.canonical}`);
    assert(await page.locator('meta[name="twitter:card"]').getAttribute('content') === 'summary_large_image',
      `metadata: Twitter large card · ${item.canonical}`);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert(schema['@type'] === 'WebApplication' && schema.url === item.canonical,
      `metadata: route-specific WebApplication JSON-LD · ${item.canonical}`);

    await page.locator('#share-btn').click();
    const shared = await page.evaluate(() => window.__shareData);
    assert(shared.url === item.canonical && shared.title === item.title,
      `share button uses canonical URL without preview/query/hash · ${item.canonical}`,
      JSON.stringify(shared));

    const storyHrefs = await page.locator('a').evaluateAll((links) => links
      .filter((link) => /^read the full story\b/i.test(link.textContent.trim()))
      .map((link) => link.href));
    assert(storyHrefs.length > 0 && storyHrefs.every((href) =>
      href === 'https://investigations.restoring-democracy.org/p/des-moines-expanded-plate-reader'),
    `every Read the full story link uses the approved destination · ${item.canonical}`,
    JSON.stringify(storyHrefs));
  }

  const imageOk = await page.evaluate(async () => {
    const image = new Image();
    image.src = '/infographics/des-moines-alpr/assets/og/dsm_alpr_og.png';
    await image.decode();
    return image.naturalWidth === 1200 && image.naturalHeight === 630;
  });
  assert(imageOk, 'approved social image loads at 1200×630');
  await ctx.close();
}

/* ------------------------------------------------------- 4. records page */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/records/', { waitUntil: 'networkidle' });
  assert(await page.locator('meta[name="robots"]').getAttribute('content') === 'noindex,nofollow',
    'internal records route remains noindex,nofollow');
  const recordStoryHrefs = await page.locator('a').evaluateAll((links) => links
    .filter((link) => /^read the full story\b/i.test(link.textContent.trim()))
    .map((link) => link.href));
  assert(recordStoryHrefs.length > 0 && recordStoryHrefs.every((href) =>
    href === 'https://investigations.restoring-democracy.org/p/des-moines-expanded-plate-reader'),
  'internal record footer preserves the approved story destination', JSON.stringify(recordStoryHrefs));
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
  assert(page.url().endsWith('/des-moines-alpr/'), 'browser back returns to the overview', page.url());
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

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const reveal = page.locator('.visual-hero-copy');
  const revealStyle = await reveal.evaluate((el) => ({
    opacity: getComputedStyle(el).opacity,
    transition: getComputedStyle(el).transitionDuration,
    transform: getComputedStyle(el).transform
  }));
  assert(revealStyle.opacity === '1' && /^0s/.test(revealStyle.transition) && revealStyle.transform === 'none',
    'visual reduced motion renders immediately with no transition', JSON.stringify(revealStyle));
  await page.screenshot({ path: join(SHOTS, 'overview-reduced-motion.png') });
  await ctx.close();
}

/* ------------------------------------------------------------- 6. no JS */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, javaScriptEnabled: false });
  const page = await ctx.newPage();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  assert(await page.locator('#visual-map .visual-state.is-configured').count() === 37,
    'no-JS: all represented jurisdictions remain in the overview map');
  assert(await page.locator('#relationship-layer [data-relationship]').count() === 0,
    'no-JS: the overview map has no relationship path');
  assert(await page.locator('.visual-access-table tbody tr').count() === 37,
    'no-JS: the overview map has a 37-jurisdiction semantic table');
  await page.screenshot({ path: join(SHOTS, 'overview-nojs.png'), fullPage: false });

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

  const california = page.locator('#visual-map .visual-state[data-state="CA"]');
  await california.focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('#relationship-layer [data-relationship="configured"]').count() === 1,
    'overview map state is selectable by keyboard');
  const outline = await california.evaluate((el) =>
    getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
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

  /* overview CTA hierarchy at 390px */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await scrollClear(page, page.locator('.visual-cta-group'));
  const mobileCtas = page.locator('.visual-cta-group a');
  const ctaRects = await mobileCtas.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect(); return { top: r.top, width: r.width, height: r.height };
  }));
  assert(ctaRects.length === 3 && ctaRects[0].top < ctaRects[1].top && ctaRects[1].top < ctaRects[2].top,
    'mobile: overview CTAs stack in priority order');
  assert(ctaRects.every((r) => r.width > 300 && r.height >= 36),
    'mobile: overview CTAs remain large, full-width targets');
  await page.screenshot({ path: join(SHOTS, 'overview-mobile-ctas.png') });

  /* touch-target floor on the smallest interactive control */
  const small = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.visual-cta, .scope-button')];
    return els.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); })
      .filter((n) => n > 0).sort((a, b) => a - b)[0];
  });
  assert(small >= 24, 'mobile: smallest interactive control is at least 24px on its short edge',
    `${Math.round(small)}px`);
  await ctx.close();
}

/* ------------------------------------------ 9. legacy visual-route redirect */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + '/visual/?from=legacy#map', { waitUntil: 'networkidle' });
  assert(page.url().includes('/des-moines-alpr/?from=legacy#map'),
    'legacy visual route redirects to the canonical overview and preserves query/hash', page.url());
  assert((await page.locator('h1').innerText()).trim() === 'WHERE DES MOINES PLATE DATA CAN GO',
    'legacy visual route lands on the overview');
  await ctx.close();
}

/* ------------------------- 10. mobile menu (shared shell) --------------- */
{
  const ctx = await browser.newContext({ viewport: VIEWPORTS.mobile, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const menu = page.locator('#mobile-menu');
  assert(await menu.evaluate((el) => el.getBoundingClientRect().height) < 5,
    'mobile menu starts closed');
  await page.locator('#mobile-toggle').click();
  await page.waitForTimeout(400);
  assert(await menu.evaluate((el) => el.getBoundingClientRect().height) > 50,
    'mobile menu opens');
  assert(await page.locator('#mobile-toggle').getAttribute('aria-expanded') === 'true',
    'the toggle reports its expanded state');
  await page.screenshot({ path: join(SHOTS, 'index-mobile-nav-open.png') });
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} assertion(s) passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
