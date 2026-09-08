/* ============================================================================
   RDP — Des Moines ALPR exhibit. Static site build.

   Reads:  ../data/*.json   (adjudicated data)
           content/copy.json (all on-screen exhibit prose)
   Writes: ../index.html, ../network/index.html, ../records/index.html

   Everything a reader can see is rendered here into static HTML. JavaScript
   adds the receipt drawer, the council-summary switch and the configuration
   explorer, but removes nothing: with JS disabled every claim, every caveat
   and every source row is still on the page.

   Run:  node _src/build.mjs
   Lint: node _src/lint.mjs
   ========================================================================= */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..');
const DATA = join(OUT, 'data');

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const copy = read(join(HERE, 'content', 'copy.json'));
const receiptsFile = read(join(DATA, 'evidence_receipts.json'));
const nodes = read(join(DATA, 'network_nodes.json'));
const stateCounts = read(join(DATA, 'state_counts.json'));
const tiles = read(join(DATA, 'state_tiles.json'));
const timeline = read(join(DATA, 'procurement_timeline.json'));
const chains = read(join(DATA, 'chain_registry.json'));
const pageComp = read(join(DATA, 'page_composition.json'));
const parts = read(join(DATA, 'parts_list.json'));
const platform = read(join(DATA, 'platform_summary.json'));

const RECEIPTS = Object.fromEntries(receiptsFile.rows.map((r) => [r.receipt_id, r]));

const LAYER_LABELS = {
  L0: 'Cooperative-contract record',
  L1: 'Council summary (pp. 1–4)',
  L2: 'Clerk’s file (attachment)',
  L3: 'Ordering document',
  L4: 'Separate contract (Chain B)',
  L5: 'City platform export, 17 Aug 2026',
  L6: 'Correspondence, policy, later record'
};
const TAG_LABELS = {
  P: 'primary record',
  OPR: 'official public representation',
  V: 'vendor documentation',
  RI: 'reasonable inference',
  U: 'not determinable from the record',
  NF: 'not found in records produced'
};
const STATUS_LABELS = {
  purchased: 'purchased / documented',
  contracted: 'contract permits',
  configured_out: 'configured to share',
  configured_in: 'configured to receive',
  described: 'described in the record',
  not_established: 'not established',
  unknown: 'not determinable'
};

/* ------------------------------------------------------------------ utils */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (n) => n == null ? '' : '$' + Number(n).toLocaleString('en-US', {
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2
});

function fmtDate(iso) {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (m[3] ? Number(m[3]) + ' ' : '') + months[Number(m[2]) - 1] + ' ' + m[1];
}

function missingReceipt(id) {
  if (!RECEIPTS[id]) throw new Error(`build: unknown receipt id "${id}"`);
  return RECEIPTS[id];
}

/* Chip faces are short so they stay legible at 390px; the accessible name and
   the tooltip carry the full claim, and the drawer carries the whole receipt. */
function shorten(s, max = 46) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:.—–-]$/, '') + '…';
}

/* A receipt chip: the only affordance for "how do you know that?" */
function chip(id, labelOverride) {
  const r = missingReceipt(id);
  const full = labelOverride || r.display_copy || r.claim;
  const face = shorten(labelOverride || r.display_copy || r.claim);
  return `<button type="button" class="receipt-chip" data-receipt="${esc(id)}"` +
    ` title="${esc(full)}" aria-label="How do you know that? ${esc(full)}">` +
    `<span class="rc-label">${esc(face)}</span></button>`;
}

function chipRow(ids) {
  if (!ids || !ids.length) return '';
  return `<div class="chip-row">${ids.map((id) => chip(id)).join('')}</div>`;
}

function layerChip(layer) {
  return `<span class="layer-chip"><span class="glyph" aria-hidden="true">&#9744;</span>${esc(LAYER_LABELS[layer] || layer)}</span>`;
}

function statusPill(status) {
  return `<span class="status-pill" data-status="${esc(status)}">` +
    `<span class="sg" aria-hidden="true"></span>${esc(STATUS_LABELS[status] || status)}</span>`;
}

/* ------------------------------------------------------------- page shell */
const ROUTES = [
  { href: '/infographics/des-moines-alpr/', label: 'Page Nine', key: 'index' },
  { href: '/infographics/des-moines-alpr/network/', label: 'Explore the configuration', key: 'network' },
  { href: '/infographics/des-moines-alpr/records/', label: 'The record', key: 'records' }
];

function head({ title, description, canonical, sections, key }) {
  const depth = key === 'index' ? '' : '../';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<!-- PROVISIONAL: unpublished prototype. Indexing is disabled until the exhibit is cleared for publication. -->
<meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Restoring Democracy's Promise">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="en_US">
<meta name="theme-color" content="#2d5c4f">
<link rel="icon" type="image/png" href="/assets/rdp_logo_gold_on_green_bg.png">
<link rel="stylesheet" href="${depth}assets/exhibit.css">
</head>
<body>
<script>document.documentElement.classList.add('js');</script>
<a class="skip-link" href="#main">Skip to content</a>
<p class="draft-banner"><b>PROTOTYPE</b> &nbsp;&middot;&nbsp; Phase 1 working build. Not published. Copy, headline and byline are provisional; no right-of-reply responses have been added.</p>
<header class="masthead">
  <div class="masthead-inner">
    <a class="brand" href="/" aria-label="Restoring Democracy's Promise — home">
      <img src="/assets/Square_logo_transparent.png" alt="" width="28" height="28">
      <span class="name"><b>Restoring Democracy&rsquo;s Promise</b></span>
    </a>
    <button id="share-btn" class="btn-share" type="button" aria-label="Share this page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg><span id="share-label">Share</span>
    </button>
  </div>
  <nav class="exhibit-nav routes" aria-label="Exhibit pages">
    <div class="exhibit-nav-inner">
      ${ROUTES.map((r) => `<a href="${r.href}"${r.key === key ? ' aria-current="page"' : ''}>${esc(r.label)}</a>`).join('\n      ')}
    </div>
  </nav>
  ${sections && sections.length ? `<nav class="exhibit-nav sections" aria-label="Sections on this page">
    <div class="exhibit-nav-inner">
      ${sections.map((s) => `<a href="#${s.id}">${esc(s.label)}</a>`).join('\n      ')}
    </div>
  </nav>` : ''}
</header>
<main id="main">`;
}

function noJsReceipts(ids) {
  /* Per-agency export receipts (R-SHARE-ROW-nnn) are omitted here on purpose:
     the network page already prints all ten columns of every one of the 155
     rows in a semantic table, which is their no-JS equivalent. */
  const uniq = [...new Set(ids)].filter((id) => RECEIPTS[id]);
  return `<section class="module no-js-receipts" id="receipts-fallback" aria-labelledby="rf-h">
  <div class="wrap-wide">
    <p class="kicker">Receipts</p>
    <h2 id="rf-h">Sources for every claim on this page</h2>
    <p class="lede">Each entry below is the same receipt the “?” buttons open. It is printed here so that the exhibit works without JavaScript and so that it prints.</p>
    <dl>
      ${uniq.map((id) => {
        const r = missingReceipt(id);
        return `<dt id="receipt-${esc(id)}"><strong>${esc(r.claim)}</strong></dt>
      <dd>
        ${layerChip(r.record_layer)} <span class="layer-chip">${esc(TAG_LABELS[r.source_tag] || r.source_tag)}</span>
        <p><em>Source:</em> ${esc([r.source_document, fmtDate(r.source_date), r.page_or_row].filter(Boolean).join(' · '))}</p>
        ${r.source_excerpt ? `<blockquote class="rd-excerpt">${esc(r.source_excerpt)}${r.ocr ? '\n\n[Read from a scan by OCR; exact characters may vary.]' : ''}</blockquote>` : ''}
        ${r.caveat ? `<p><em>Caveat:</em> ${esc(r.caveat)}</p>` : ''}
        ${r.what_it_does_not_establish ? `<p><em>What this does not establish:</em> ${esc(r.what_it_does_not_establish)}</p>` : ''}
        <p class="note">Receipt ${esc(r.receipt_id)}</p>
      </dd>`;
      }).join('\n      ')}
    </dl>
  </div>
</section>`;
}

function foot({ receiptIds, extraScripts, inlineData }) {
  return `</main>

<div class="rd-scrim" id="receipt-scrim" data-open="false"></div>
<aside class="receipt-drawer" id="receipt-drawer" data-open="false" aria-hidden="true"
       role="dialog" aria-modal="false" aria-label="Evidence receipt">
  <div class="rd-inner"></div>
</aside>

${noJsReceipts(receiptIds)}

<footer class="site">
  <div class="f-inner">
    <div>
      <div class="f-brand">Restoring Democracy&rsquo;s Promise</div>
      <div class="f-tag">Engineering Precision Journalism</div>
    </div>
    <div class="f-meta">
      Prototype build &mdash; not published. &nbsp;&bull;&nbsp;
      &copy; 2023&ndash;2026 Restoring Democracy&rsquo;s Promise. &nbsp;&bull;&nbsp;
      <a href="/privacy-policy/">Privacy</a>
    </div>
  </div>
</footer>

<script>
window.RDP_RECEIPTS = ${JSON.stringify(RECEIPTS)};
window.RDP_LAYER_LABELS = ${JSON.stringify(LAYER_LABELS)};
window.RDP_TAG_LABELS = ${JSON.stringify(TAG_LABELS)};
window.RDP_STATUS_LABELS = ${JSON.stringify(STATUS_LABELS)};
${inlineData || ''}
</script>
${extraScripts || ''}
</body>
</html>`;
}

/* ==========================================================================
   PAGE 1 — Page Nine (narrative)
   ========================================================================= */

function chapterShell(ch, graphicHtml, opts = {}) {
  const cls = ['chapter', opts.extraClass].filter(Boolean).join(' ');
  return `<section class="${cls}" id="${esc(ch.id)}" aria-labelledby="${esc(ch.id)}-h">
  <div class="chapter-grid">
    <div class="chapter-text">
      <p class="chapter-num">${esc(ch.number)} &mdash; <span class="kicker" style="display:inline;margin:0">${esc(ch.kicker)}</span></p>
      <h2 id="${esc(ch.id)}-h">${esc(ch.heading)}</h2>
      ${ch.body ? `<div class="chapter-body"><p>${esc(ch.body)}</p></div>` : ''}
      ${ch.consequence ? `<p class="chapter-consequence">${esc(ch.consequence)}</p>` : ''}
      ${chipRow(ch.receipts)}
    </div>
    <div class="chapter-figure">${graphicHtml}</div>
  </div>
</section>`;
}

const GRAPHICS = {
  resolution() {
    return `<div class="figure">
      <div class="in-summary" style="border:1px solid var(--hairline-3);border-radius:3px;padding:1rem;background:var(--paper-l1)">
        ${layerChip('L1')}
        <p style="font-family:var(--serif);font-size:1.02rem;line-height:1.55;margin:.7rem 0 0">
          &ldquo;The purchase of M500 In-Car Video System and Video Manager from Motorola Solutions, Inc. in the amount of
          <strong class="tnum">$1,500,080.00</strong> and per the terms and pricing of the Sourcewell Master Agreement Contract
          #010720-WCH for use by the Police Department, is hereby approved.&rdquo;
        </p>
      </div>
      <div class="by-reference" style="border:1px dashed var(--hairline-3);border-radius:3px;padding:.85rem;margin-top:.7rem;background:var(--paper-l2)">
        <p style="font-family:var(--serif);font-size:.96rem;margin:0">
          &ldquo;The Mayor is authorized and directed to execute the <strong>Short Form Agreement and Addendum on file with the City Clerk</strong>&hellip;&rdquo;
        </p>
        <p class="note" style="margin-top:.5rem">Incorporation by reference. The operative clause uses the singular &ldquo;Addendum.&rdquo; Four addenda were executed.</p>
      </div>
      <p class="figure-caption">Agenda item 32, adopted inside a consent agenda covering items 3 through 38 on a single roll call, 7&ndash;0. Consent items are described in the agenda as routine items enacted by one roll call vote without separate discussion. Nothing in the record establishes what any individual member read, knew, understood or intended.</p>
    </div>`;
  },

  summary() {
    const absent = ['ALPR', 'LPR', 'license plate', 'Vigilant', 'LEARN', 'PlateSearch',
      'VehicleManager', 'hot list', 'retention', 'data sharing'];
    return `<div class="figure">
      <div class="in-summary" style="border:1px solid var(--hairline-3);border-radius:3px;padding:1rem;background:var(--paper-l1)">
        ${layerChip('L1')}
        <p style="font-family:var(--serif);font-size:1rem;line-height:1.55;margin:.7rem 0 0">
          &ldquo;&hellip;for the purpose of purchasing <strong>upgraded in-car video systems with installation, implementation, and video evidence management software</strong> from Motorola Solutions Inc.&hellip;&rdquo;
        </p>
        <p class="note" style="margin-top:.6rem">Council Communication No. 23-519, agenda heading, submitted by the Chief of Police.</p>
      </div>
      <h3 style="font-size:.95rem;margin:1.1rem 0 .5rem">Terms not occurring on pages 1&ndash;4</h3>
      <ul style="list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.35rem">
        ${absent.map((t) => `<li class="not-in-summary" style="font-family:var(--mono);font-size:.72rem;color:var(--muted);border:1px solid var(--hairline-2);border-radius:3px;padding:.3rem .45rem"><span style="color:var(--orange-ink)">0</span> &nbsp;${esc(t)}</li>`).join('')}
      </ul>
      <p class="figure-caption">Full-page OCR of pages 1&ndash;4, with pages 1 and 3 additionally inspected visually. This is a statement about the resolution and the council communication. The attachments in the same file do contain these terms &mdash; that is the next chapter.</p>
    </div>`;
  },

  stack() {
    const pages = pageComp.pages.map((p) => {
      return `<button type="button" class="doc-page"
        data-page="${p.page}"
        data-layer="${esc(p.record_layer)}"
        data-label="${esc(p.label)}"
        data-termcheck="${esc(p.term_check)}"
        ${p.is_page_nine ? 'data-pagenine="true"' : ''}
        ${p.post_vote_date ? 'data-postvote="true"' : ''}
        aria-pressed="false"
        aria-label="Page ${p.page}: ${esc(p.label)}"
      ><span class="pn">${p.page}</span></button>`;
    }).join('\n        ');

    return `<div class="figure">
      <div id="doc-stack" class="doc-stack" role="group" aria-label="The 25 pages of the clerk's roll-call file. Use arrow keys to move between pages.">
        ${pages}
      </div>
      <div class="stack-legend">
        <span>Pages 1&ndash;4 &mdash; council-facing summary</span>
        <span>Pages 5&ndash;25 &mdash; attachments in the clerk&rsquo;s file</span>
        <span>Dashed border &mdash; bears a post-vote date</span>
        <span>Highlighted &mdash; page 9</span>
      </div>
      <p id="doc-stack-readout" class="note" role="status" aria-live="polite">Select a page to see what it contains.</p>
      <div class="callout">
        <h3>Not in the file</h3>
        <ul style="margin:0;padding-left:1.1rem;font-size:.9rem">
          ${pageComp.not_in_the_file.map((x) => `<li class="not-in-summary">${esc(x.label)} ${chip(x.receipt_id, 'source')}</li>`).join('\n          ')}
        </ul>
      </div>
      <p class="figure-caption">${esc(pageComp.caveat)}</p>
    </div>`;
  },

  pageNine() {
    return `<div class="figure by-reference">
      <div class="page-nine-card">
        <p class="pn-tag">Page 9 of 25 &nbsp;&middot;&nbsp; Mobile Video Addendum &sect;4.5</p>
        ${layerChip('L2')}
        <p class="clause" style="margin-top:.8rem">
          &ldquo;License plate recognition (&lsquo;LPR&rsquo;) data collected by Customer is considered Customer Data
          (as defined in the Master Agreement) and is therefore subject to the Customer&rsquo;s own retention policy.
          <mark>Customer, at its option, may share its LPR data with other similarly situated Law Enforcement Agencies
          (&lsquo;LEAs&rsquo;) which contract with Motorola to access Vigilant VehicleManager by selecting this option
          within Vigilant VehicleManager.</mark>&rdquo;
        </p>
        <p style="display:flex;align-items:center;gap:.55rem;margin-top:1rem;font-family:var(--mono);font-size:.72rem;color:var(--orange-ink)">
          <span class="toggle-glyph" aria-hidden="true"></span>
          by selecting this option
        </p>
        <p class="note" style="margin-top:.9rem">Sharing with another qualifying agency requires nothing but a setting. The agreement requires no memorandum of understanding, no notice, no review and no approval. A separate sentence in the same clause restricts <em>logins</em> &mdash; not sharing.</p>
      </div>
      <p class="figure-caption">${esc(pageComp.caveat)}</p>
    </div>`;
  },

  quote() {
    const lines = [
      ['9', 'DDN3420A', 'BASIC REMOTE SUPPORT FOR WG LPR', '1', '$500.00', '$500.00', 'R-QUOTE-L9'],
      ['10', 'DDN3421A', 'M500 BASIC ALPR VAAS', '130', '$516.00', '$67,080.00', 'R-QUOTE-L10']
    ];
    return `<div class="figure not-in-summary">
      ${layerChip('L3')}
      <p class="note" style="margin-top:.6rem">QUOTE-2241626, &ldquo;Updated M500 VaaS&rdquo;, 23 October 2023. Produced to RDP in 2026. Not in the 25-page clerk&rsquo;s file.</p>
      <div class="table-scroll" style="margin-top:.8rem">
        <table class="data">
          <caption>Plate-reader lines in the ordering document</caption>
          <thead><tr><th scope="col">Line</th><th scope="col">SKU</th><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit</th><th scope="col">Total</th><th scope="col">Receipt</th></tr></thead>
          <tbody>
            ${lines.map((l) => `<tr><td class="num">${l[0]}</td><td class="raw">${l[1]}</td><td>${l[2]}</td><td class="num">${l[3]}</td><td class="num">${l[4]}</td><td class="num">${l[5]}</td><td>${chip(l[6], 'source')}</td></tr>`).join('\n            ')}
            <tr><td></td><td></td><td><strong>Plate-reader licensing and support</strong></td><td class="num">&mdash;</td><td class="num">&mdash;</td><td class="num"><strong>$67,580.00</strong></td><td></td></tr>
            <tr><td></td><td></td><td>Grand total, quoted</td><td class="num">&mdash;</td><td class="num">&mdash;</td><td class="num">$1,500,080.00</td><td>${chip('R-QUOTE-TOTAL', 'source')}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="callout">
        <h3>The required companion</h3>
        <p>$67,580 is 4.5% of the purchase &mdash; and it is the licence-and-support layer, not the extent of the deployment. The delivery pack list records a component the vendor calls an <strong>&ldquo;M500 ALPR DVR&rdquo;</strong> on every one of the 130 systems. ${chip('R-PACKLIST-DVR', 'pack list')}</p>
      </div>
      <p class="figure-caption">The vendor&rsquo;s own price file defines the purchased SKU as &ldquo;CarDetector Mobile, Vigilant PlateSearch (agency data only).&rdquo; The council-approved purchase did not include commercial national vehicle-location data. That came from somewhere else.</p>
    </div>`;
  },

  twoChains() {
    const eventsFor = (c) => timeline.rows.filter((e) => e.chain === c);
    const rail = (key) => {
      const c = chains.chains[key];
      const evs = eventsFor(key);
      return `<div class="chain-rail" data-chain="${esc(key)}">
        <div class="chain-head">
          <span class="chain-name"><span class="chain-glyph" aria-hidden="true"></span> ${esc(c.label_long)}</span>
        </div>
        <p class="chain-sub">${esc(c.one_line)}</p>
        <p class="chain-sub" style="margin-top:.4rem"><strong>Vendor:</strong> ${esc(c.vendor_of_record)} &nbsp;&middot;&nbsp; <strong>Vehicle:</strong> ${esc(c.cooperative_vehicle)}${c.city_short_form ? ` &nbsp;&middot;&nbsp; <strong>City agreement:</strong> ${esc(c.city_short_form)}` : ''}</p>
        <p class="chain-flag">${esc(c.council_action_label)}</p>
        <ul class="chain-events">
          ${evs.map((e) => `<li><span class="ev-date">${esc(fmtDate(e.date))}</span><span><span class="ev-title">${esc(e.title)}</span><br><span class="ev-sum">${esc(e.summary)}</span> ${chip(e.receipt_id, 'source')}</span></li>`).join('\n          ')}
        </ul>
      </div>`;
    };

    return `<div class="figure">
      <div class="chains">
        <div class="in-summary">${rail('A')}</div>
        <div class="not-in-summary">${rail('B')}</div>
      </div>
      <div class="chains-meet not-in-summary">
        <div class="rails" aria-hidden="true">
          <span class="rail-a"></span><span class="block"></span><span class="rail-b"></span>
        </div>
        <p style="font-size:.9rem;margin:0"><strong>${esc(chains.meeting_point.label)}.</strong> ${esc(chains.meeting_point.copy)}</p>
      </div>
      <p class="figure-caption">Chain A is drawn with a square end-cap and a solid rule; Chain B with a round end-cap and a doubled rule. The two are distinguishable without colour, and each is always named in text. Chain A is not the origin of Chain B: Chain B was executed first.</p>
    </div>`;
  },

  changeForm() {
    return `<div class="figure not-in-summary">
      ${layerChip('L0')}
      <div style="border:1px solid var(--hairline-3);border-left:4px solid var(--chain-a-faint);border-radius:3px;padding:1rem;margin-top:.7rem;background:var(--paper-l0)">
        <p class="note" style="margin:0 0 .6rem;border:0;padding:0">Price and Product Change Request, Sourcewell contract 010720, effective 14 September 2021 &mdash; justification field</p>
        <p class="clause" style="margin:0">&ldquo;WatchGuard Video <mark>mistakenly left off</mark> a key component of our VaaS offering &ndash; The License Plate Reader (LPR). It is now included in the VaaS price list.&rdquo;</p>
      </div>
      <h3 style="font-size:.95rem;margin:1.1rem 0 .5rem">Five change forms, 2021</h3>
      <ul style="margin:0;padding-left:1.1rem;font-size:.88rem;color:var(--ink-soft)">
        <li>Expiring 19 April 2021</li>
        <li>Effective 3 September 2021 &mdash; repricing; creates the VaaS price list</li>
        <li><strong>Effective 14 September 2021 &mdash; plate reader added</strong></li>
        <li>Effective 29 October 2021 &mdash; combined in-car video and plate-reader unit</li>
        <li>Effective 14 December 2021 &mdash; reversion</li>
      </ul>
      <p class="figure-caption">The change-request mechanism is expressly authorised by the contract: an executed form becomes an amendment incorporated by reference. The cooperative&rsquo;s own rule is that modifications must be within the scope of the original solicitation. Whether any scope determination was made is not found in the records produced. The 3 September form carries a signature dated &ldquo;8/31/22&rdquo; &mdash; an anomaly on the face of the document, noted and not built on.</p>
    </div>`;
  },

  tileMap() {
    const s = platform.sharing;
    const top = stateCounts.rows.slice().sort((a, b) => b.count - a.count).slice(0, 8);
    return `<div class="figure">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.7rem">
        ${[
          [s.agencies_label, 'R-EXPORT-155'],
          [s.jurisdictions_label, 'R-EXPORT-STATES'],
          [`${s.non_iowa} outside Iowa, ${s.iowa} in Iowa`, 'R-EXPORT-IOWA'],
          [`${s.receiving} also configured to receive`, 'R-EXPORT-RECEIVING'],
          [`${s.federal_typed} rows typed “Federal”`, 'R-EXPORT-FEDERAL'],
          [`${s.undated_rows} of ${s.agencies} rows carry no usable date`, 'R-EXPORT-UNDATED']
        ].map(([label, rid]) => `<div style="border:1px solid var(--plane3-border);border-radius:3px;padding:.7rem">
          <p style="font-size:.86rem;margin:0 0 .4rem">${esc(label)}</p>${chip(rid, 'source')}</div>`).join('\n        ')}
      </div>
      <h3 style="font-size:.95rem;margin:1.3rem 0 .5rem">Largest counts by state</h3>
      <div class="table-scroll">
        <table class="data">
          <caption>From the export&rsquo;s own State column. No agency has been geocoded.</caption>
          <thead><tr><th scope="col">State</th><th scope="col">Configured relationships</th><th scope="col">Also receiving</th></tr></thead>
          <tbody>
            ${top.map((r) => `<tr><td>${esc(r.state_raw)}</td><td class="num">${r.count}</td><td class="num">${r.by_receiving['Receiving'] || 0}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
      </div>
      <p style="margin-top:1rem"><a href="/infographics/des-moines-alpr/network/"><strong>Explore all 155 &rarr;</strong></a> &mdash; filter by state, agency type, Iowa or non-Iowa, and receiving status, and open the source row for any one of them.</p>
      <p class="figure-caption">${esc(copy.standing.config_not_use_long)}</p>
    </div>`;
  },

  emptyDrawer() {
    return `<div class="figure">
      <div class="lanes">
        ${copy.empty_drawer.lanes.map((l) => `<div class="lane" data-state="${esc(l.state)}">
          <h4>${esc(l.label)}</h4>
          <p>${esc(l.body)}</p>
          ${chipRow(l.receipts)}
        </div>`).join('\n        ')}
      </div>
      <p class="figure-caption">The fourth lane is drawn empty because the record is empty, not because the graphic is decorative. That is a statement about the records produced to RDP. It is not a statement that no log exists anywhere, including on the vendor&rsquo;s platform.</p>
    </div>`;
  },

  ledger() {
    const col = (kind, items, heading) => `<div class="ledger-col" data-kind="${kind}">
      <h3>${esc(heading)}</h3>
      <ul>${items.map((i) => `<li>${esc(i.text)} ${i.receipts.map((r) => chip(r, 'source')).join(' ')}</li>`).join('\n      ')}</ul>
    </div>`;
    return `<div class="ledger-grid">
      ${col('known', copy.ledger.known, 'What the records establish')}
      ${col('unknown', copy.ledger.unknown, 'What the records do not establish')}
    </div>`;
  }
};

function buildIndex() {
  const ch = Object.fromEntries(copy.chapters.map((c) => [c.id, c]));
  const sections = copy.chapters.map((c) => ({ id: c.id, label: c.number }))
    .concat([{ id: 'sidebars', label: 'Sidebars' }, { id: 'about-this-exhibit', label: 'About' }]);

  const usedReceipts = [];
  const collect = (html) => {
    for (const m of html.matchAll(/data-receipt="([^"]+)"/g)) usedReceipts.push(m[1]);
    return html;
  };

  const switchBar = `<div class="switch-bar">
    <button type="button" id="summary-switch" class="switch-btn" aria-pressed="false"
      data-scope="scrolly"
      data-label-on="Showing only what the council-facing summary described"
      data-label-off="${esc(copy.council_switch.label)}">
      <span class="toggle-glyph" aria-hidden="true"></span>
      <span class="switch-label">${esc(copy.council_switch.label)}</span>
    </button>
    <p class="switch-explain">${esc(copy.council_switch.explainer)}</p>
    <p id="summary-switch-status" class="visually-hidden" role="status" aria-live="polite"></p>
  </div>`;

  const body = collect(`
<section class="module hero" aria-labelledby="hero-h">
  <div class="wrap">
    <p class="kicker">${esc(copy.exhibit.kicker)} <span class="dot">&bull;</span> ${esc(copy.exhibit.kicker_topic)}</p>
    <h1 id="hero-h">${esc(copy.exhibit.headline)}</h1>
    <p class="standfirst">${esc(copy.exhibit.dek)}</p>
    <p class="byline">${esc(copy.exhibit.byline)} &nbsp;&bull;&nbsp; ${esc(copy.exhibit.date_display)}</p>
    <div class="callout">
      <h3>How to read this exhibit</h3>
      <p>${esc(copy.standing.grammar_note)} Any number or quotation with a <strong>?</strong> button opens its receipt: the document, the date, the page or row, the verbatim text, the caveat that travels with it, and one line on what it does <em>not</em> establish.</p>
      <p style="margin-top:.6rem">${esc(copy.standing.no_intent)}</p>
    </div>
  </div>
</section>

<div id="scrolly" class="scrolly">
  ${chapterShell(ch['ch01-purchase'], GRAPHICS.resolution())}
  ${chapterShell(ch['ch02-summary'], GRAPHICS.summary())}
  ${chapterShell(ch['ch03-stack'], GRAPHICS.stack())}
  ${chapterShell(ch['ch04-page-nine'], GRAPHICS.pageNine())}
  ${chapterShell(ch['ch05-quote'], GRAPHICS.quote())}
  ${chapterShell(ch['ch06-other-contract'], GRAPHICS.twoChains() + switchBar)}
  ${chapterShell(ch['ch07-mistakenly'], GRAPHICS.changeForm())}
</div>

<section class="hard-cut" id="${esc(ch['ch08-hard-cut'].id)}" aria-labelledby="hc-h">
  <div class="wrap">
    <p class="hc-above">${esc(copy.hard_cut.above)}</p>
    <div class="hc-rule" aria-hidden="true"></div>
    <p class="hc-below">${esc(copy.hard_cut.below)}</p>
    <h2 id="hc-h" class="visually-hidden">${esc(ch['ch08-hard-cut'].heading)}</h2>
    <p class="hc-line">${esc(copy.hard_cut.line)}</p>
    ${chipRow(copy.hard_cut.receipts)}
  </div>
</section>

<div class="plane3">
  ${chapterShell(ch['ch09-configuration'], GRAPHICS.tileMap())}
  ${chapterShell(ch['ch10-cannot-show'], GRAPHICS.emptyDrawer())}
</div>

<section class="module" id="${esc(ch['ch11-ledger'].id)}" aria-labelledby="ledger-h">
  <div class="wrap-wide">
    <p class="chapter-num">${esc(ch['ch11-ledger'].number)} &mdash; <span class="kicker" style="display:inline;margin:0">${esc(ch['ch11-ledger'].kicker)}</span></p>
    <h2 id="ledger-h">${esc(ch['ch11-ledger'].heading)}</h2>
    ${GRAPHICS.ledger()}
    <div class="callout" style="margin-top:1.6rem">
      <h3>${esc(copy.exhibit.responses_block.heading)}</h3>
      <p>${esc(copy.exhibit.responses_block.body)}</p>
    </div>
    <p style="margin-top:1.4rem"><a href="/infographics/des-moines-alpr/records/"><strong>Every instrument, date, price and receipt &rarr;</strong></a> &nbsp;&middot;&nbsp; <a href="/infographics/des-moines-alpr/network/"><strong>Explore the configuration &rarr;</strong></a></p>
  </div>
</section>

<section class="module" id="sidebars" aria-labelledby="sb-h">
  <div class="wrap-wide">
    <p class="kicker">Sidebars</p>
    <h2 id="sb-h">Three things that sit beside the story</h2>
    <div style="display:grid;gap:1rem;margin-top:1.2rem">
      ${copy.sidebars.map((s) => `<div class="callout" style="margin:0">
        <h3>${esc(s.heading)}</h3>
        <p>${esc(s.body)}</p>
        ${chipRow(s.receipts)}
      </div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="module" id="about-this-exhibit" aria-labelledby="ab-h">
  <div class="wrap-wide">
    <p class="kicker">About this exhibit</p>
    <h2 id="ab-h">Language, drawing and the limits we imposed on ourselves</h2>
    <div style="display:grid;gap:1rem;margin-top:1rem">
      <div class="callout" style="margin:0"><h3>On the 2026 export</h3><p>Relationships from the August 2026 export are described only as <em>configured</em>, <em>listed</em>, <em>selected</em>, <em>shown in the export</em> or <em>in Sharing status</em>. This exhibit does not say that data was sent, transmitted, accessed or viewed, because no record produced establishes that.</p></div>
      <div class="callout" style="margin:0"><h3>On the drawing</h3><p>Counterparties are open rings, not filled location dots. No connector is drawn by default. When you select an agency, one connector appears at once &mdash; no arrowhead, no direction, no motion along the line, no glow &mdash; labelled &ldquo;configured to share.&rdquo; Nothing appears in a time-ordered sequence, because the export contains no chronology.</p></div>
      <div class="callout" style="margin:0"><h3>On the council</h3><p>${esc(copy.council_switch.explainer)}</p></div>
      <div class="callout" style="margin:0"><h3>Before publication</h3><ul style="margin:.4rem 0 0;padding-left:1.1rem;font-size:.92rem">${copy.publication_gates.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>
    </div>
    <p style="margin-top:1.4rem"><a href="/infographics/des-moines-alpr/records/#methodology">Method, definitions, corrections and sources &rarr;</a></p>
  </div>
</section>
`);

  return head({
    title: `${copy.exhibit.headline} — Des Moines ALPR | Restoring Democracy's Promise`,
    description: copy.exhibit.meta_description,
    canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/',
    sections, key: 'index'
  }) + body + foot({
    receiptIds: usedReceipts,
    extraScripts: '<script src="assets/exhibit.js" defer></script>'
  });
}

/* ==========================================================================
   PAGE 2 — Explore the configuration
   ========================================================================= */

function buildNetwork() {
  const usedReceipts = [];
  const collect = (html) => {
    for (const m of html.matchAll(/data-receipt="([^"]+)"/g)) {
      if (!m[1].startsWith('R-SHARE-ROW-')) usedReceipts.push(m[1]);
    }
    return html;
  };

  const types = Object.keys(nodes.totals.by_type);
  const filterGroup = (title, group, opts, note) => `<div class="filter-group">
    <h4>${esc(title)}</h4>
    <div class="filter-opts">
      ${opts.map((o) => `<button type="button" class="filter-opt" data-group="${esc(group)}" data-value="${esc(o.value)}" aria-pressed="false">${esc(o.label)}</button>`).join('\n      ')}
    </div>
    ${note ? `<span class="filter-editorial">${esc(note)}</span>` : ''}
  </div>`;

  const legend = `<div class="legend">
    <h4>Evidence key</h4>
    <ul>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="none" stroke="#9aa6b0" stroke-width="1.4"/></svg></span> Open ring &mdash; configured to share (outbound)</li>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="none" stroke="#9aa6b0" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="none" stroke="#9aa6b0" stroke-width="1.2"/></svg></span> Ring with inner ring &mdash; also configured to receive</li>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="none" stroke="#9aa6b0" stroke-width="1.4" stroke-dasharray="2 2"/></svg></span> Dashed ring &mdash; receiving shown as approval required</li>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="none" stroke="#9aa6b0" stroke-width="1.4" stroke-dasharray="1 3"/></svg></span> Dotted ring &mdash; receiving shown as declined</li>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="none" stroke="#6d7a85" stroke-width="1.4"/><line x1="4" y1="12" x2="12" y2="4" stroke="#6d7a85" stroke-width="1.2"/></svg></span> Struck ring &mdash; name carries an &ldquo;Inactive&rdquo; prefix; meaning not defined</li>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="4.5" fill="#d8b24a"/></svg></span> Filled node &mdash; Des Moines, the reference point</li>
      <li><span class="lg" aria-hidden="true"><svg class="lg-svg" viewBox="0 0 16 16" width="16" height="16"><line x1="1" y1="8" x2="15" y2="8" stroke="#d8b24a" stroke-width="1.2" stroke-dasharray="4 3"/></svg></span> Dashed connector &mdash; configured to share. Not data sent.</li>
      <li class="lg-note">${esc(copy.standing.legend_line)} No connector is drawn until you select an agency, and no connector has a direction, an arrowhead or any motion.</li>
    </ul>
  </div>`;

  const body = collect(`
<section class="module plane3" style="padding-bottom:1.5rem" aria-labelledby="net-h">
  <div class="wrap-full">
    <p class="kicker">Des Moines ALPR &nbsp;&bull;&nbsp; Page 2 of the exhibit</p>
    <h2 id="net-h" style="font-size:clamp(1.9rem,5vw,2.8rem)">${esc(copy.network_page.title)}</h2>
    <p class="chapter-body" style="max-width:62ch;margin-top:.8rem">${esc(copy.network_page.dek)}</p>
    <p class="note">${esc(copy.network_page.standing_note)}</p>
    ${chipRow(['R-EXPORT-FILTER', 'R-EXPORT-155', 'R-EXPORT-UNDATED', 'R-MVA-4.5'])}
  </div>
</section>

<section class="module plane3" id="explorer" style="padding-top:0" aria-labelledby="ex-h">
  <div id="network-explorer">
  <div class="wrap-full">
    <h3 id="ex-h" class="visually-hidden">Interactive configuration explorer</h3>
    <div id="network-filters" class="filters">
      ${filterGroup('Agency type (export’s own typing)', 'type', types.map((t) => ({ value: t, label: `${t} (${nodes.totals.by_type[t]})` })), 'These are the export’s own values. Iowa Department of Public Safety is typed “Other,” not “State.”')}
      ${filterGroup('Iowa or elsewhere', 'scope', [{ value: 'iowa', label: `Iowa (${nodes.totals.iowa})` }, { value: 'non-iowa', label: `Outside Iowa (${nodes.totals.non_iowa})` }])}
      ${filterGroup('Receiving status', 'receiving', [
        { value: 'configured_in', label: `Receiving (${nodes.totals.receiving})` },
        { value: 'no_receiving', label: `No receiving relationship (${nodes.totals.no_receiving})` },
        { value: 'approval_required', label: `Approval required (${nodes.totals.approval_required})` },
        { value: 'declined', label: `Declined (${nodes.totals.declined})` }
      ], 'Inbound only. Every row in this export is outbound “Sharing.”')}
      ${filterGroup('Groupings', 'group', [
        { value: 'federal', label: `Typed Federal (${nodes.totals.federal_typed})` },
        { value: 'fusion', label: 'Fusion / intelligence named (4)' },
        { value: 'inactive', label: `“Inactive” prefix (${nodes.totals.inactive_prefixed})` },
        { value: 'dated', label: `Carries a date (${nodes.totals.dated_rows})` }
      ], 'EDITORIAL GROUPING: “Fusion / intelligence named” is RDP’s grouping of four agencies whose names contain a fusion-centre or criminal-intelligence term. It is not a category in the export.')}
      <p id="network-readout" class="filter-status" role="status" aria-live="polite">
        <strong>155</strong> of 155 configured outbound sharing relationships shown. No agency selected. No connectors drawn.
      </p>
      <div style="grid-column:1/-1">
        <button type="button" id="network-clear" class="filter-opt">Clear all filters and selection</button>
      </div>
    </div>

    <!-- Small screens get a legible jurisdiction list, not a shrunken grid.
         The grid stays available behind a disclosure, inside a horizontal
         scroller that keeps its labels at readable size. -->
    <div id="state-list" class="state-list">
      <h4>Jurisdictions in the export</h4>
      <p class="filter-editorial">Select a jurisdiction to filter the grid and the table below. Counts are the export’s own.</p>
      <ul>
        ${stateCounts.rows.slice().sort((a, b) => b.count - a.count || a.state_raw.localeCompare(b.state_raw)).map((r) => `<li>
          <button type="button" class="state-btn" data-state="${esc(r.state_code)}" aria-pressed="false">
            <span class="sb-name">${esc(r.state_raw)}</span>
            <span class="sb-count tnum">${r.count}</span>
          </button>
        </li>`).join('')}
      </ul>
    </div>

    <details class="tilemap-details" id="tilemap-details">
      <summary>State grid <span class="tm-hint">— scrolls sideways on a narrow screen</span></summary>
      <div class="tilemap-wrap">
        <div class="tilemap-scroll">
          <svg id="tilemap" class="tilemap" role="group"
               aria-labelledby="tm-title tm-desc"
               aria-describedby="network-readout">
            <title id="tm-title">Configured sharing relationships, placed by the export’s State column</title>
            <desc id="tm-desc">A grid of state tiles. Each listed agency is drawn as an open ring inside its state’s tile; Des Moines is a filled node in the Iowa tile. No connectors are drawn until an agency is selected. Placement is an editorial cartogram, not a map projection: no agency has been geocoded. Every ring is also a row in the table below this graphic, which carries the same information in text.</desc>
          </svg>
        </div>
        <noscript>
          <p class="note">The interactive grid needs JavaScript. All 155 rows are in the table below, verbatim from the export, and the jurisdiction list above is complete.</p>
        </noscript>
      </div>
    </details>
    <p id="network-live" class="visually-hidden" role="status" aria-live="polite"></p>
    ${legend}
  </div>
  </div>
</section>

<section class="module plane3" id="rows" style="padding-top:1rem" aria-labelledby="rows-h">
  <div class="wrap-full">
    <h3 id="rows-h">All 155 rows</h3>
    <p class="note" id="network-table-count">155 of 155 rows shown</p>
    <div class="table-scroll" style="margin-top:.8rem;max-height:70vh;overflow-y:auto">
      <table class="data">
        <caption>${esc(copy.network_page.table_caption)} Column names and cell values are verbatim from the export. Filter “${esc(nodes.source_filter_row)}”.</caption>
        <thead><tr>
          <th scope="col">Agency (verbatim)</th><th scope="col">State</th><th scope="col">Agency type</th>
          <th scope="col">Detection sharing</th><th scope="col">Detection receiving</th>
          <th scope="col">Date of last update</th><th scope="col">Has system</th><th scope="col">Retention</th>
          <th scope="col">Sheet row</th><th scope="col">Receipt</th>
        </tr></thead>
        <tbody id="network-tbody">
          ${nodes.rows.map((n) => `<tr>
            <td class="raw">${esc(n.agency_raw)}</td><td>${esc(n.state_raw)}</td><td>${esc(n.agency_type_raw)}</td>
            <td>${esc(n.detection_sharing)}</td><td>${esc(n.detection_receiving)}</td>
            <td class="raw">${esc(n.date_of_last_update)}</td><td>${esc(n.has_system)}</td><td>${esc(n.retention)}</td>
            <td class="num">${n.xlsx_row}</td>
            <td><button type="button" class="receipt-chip" data-receipt="${esc(n.receipt_id)}"><span class="rc-label">Source row</span></button></td>
          </tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>
    <div class="callout" style="background:var(--plane3-panel);border-color:var(--plane3-border);border-left-color:var(--plane3-accent);color:var(--plane3-text)">
      <h3 style="color:var(--plane3-text)">What this table is, and is not</h3>
      <p style="color:var(--plane3-muted)">${esc(nodes.universal_caveat)} ${esc(nodes.direction_note)} The export is filtered, so 155 is a floor on configured relationships, not the total the platform holds. “Has system,” “Retention,” the “(F)” name prefix on ${nodes.totals.f_prefixed} rows and the “Inactive” prefix on ${nodes.totals.inactive_prefixed} rows are not defined in any located documentation, and this exhibit does not guess at them.</p>
    </div>
  </div>
</section>
`);

  const inlineData = `window.RDP_NETWORK = ${JSON.stringify({ totals: nodes.totals, rows: nodes.rows })};
window.RDP_TILES = ${JSON.stringify(tiles.tiles)};`;

  return head({
    title: `Explore the configuration — Des Moines ALPR | Restoring Democracy's Promise`,
    description: copy.network_page.dek,
    canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/network/',
    sections: [{ id: 'explorer', label: 'Explorer' }, { id: 'rows', label: 'All 155 rows' }],
    key: 'network'
  }) + body + foot({
    receiptIds: usedReceipts,
    inlineData,
    extraScripts: '<script src="../assets/exhibit.js" defer></script>\n<script src="../assets/network.js" defer></script>'
  });
}

/* ==========================================================================
   PAGE 3 — The record (+ methodology)
   ========================================================================= */

function buildRecords() {
  const usedReceipts = [];
  const collect = (html) => {
    for (const m of html.matchAll(/data-receipt="([^"]+)"/g)) usedReceipts.push(m[1]);
    return html;
  };

  /* --- mode: timeline --- */
  const tlRows = timeline.rows.slice().sort((a, b) => a.date.localeCompare(b.date));
  const timelineHtml = `<ol class="timeline">
    ${tlRows.map((e) => `<li>
      <span class="tl-date">${esc(fmtDate(e.date))}${e.date_precision !== 'day' ? `<br><span style="font-size:.66rem">(${esc(e.date_precision)})</span>` : ''}</span>
      <div class="tl-body" data-chain="${esc(e.chain)}">
        <div class="tl-title">${esc(e.title)}${e.sidebar ? ' <span class="chain-flag">sidebar</span>' : ''}</div>
        <div class="tl-sum">${esc(e.summary)}</div>
        <div class="tl-meta">
          <span class="layer-chip">${esc(chains.chains[e.chain] ? chains.chains[e.chain].label : 'Other record')}</span>
          ${layerChip(e.record_layer)}
          ${statusPill(e.status_code)}
          ${e.amount_usd != null ? `<span class="layer-chip">${esc(money(e.amount_usd))}</span>` : ''}
          ${e.council_action === 'none_found' ? '<span class="layer-chip">no council action found</span>' : ''}
          ${e.council_action === 'documented' ? '<span class="layer-chip">council action documented</span>' : ''}
          ${chip(e.receipt_id, 'source')}
        </div>
      </div>
    </li>`).join('\n    ')}
  </ol>
  <div class="snapshot-break">
    <strong>${esc(timeline.snapshot_plane.date === '2026-08-17' ? '2026 configuration snapshot' : 'snapshot')}</strong>
    <div class="sb-rule" aria-hidden="true"></div>
    <p><strong style="letter-spacing:0;text-transform:none;font-family:var(--sans);font-size:.95rem;color:var(--plane3-text)">${esc(timeline.snapshot_plane.title)}</strong></p>
    <p>${esc(timeline.snapshot_plane.summary)} ${esc(timeline.snapshot_plane.discontinuity_copy)}</p>
    ${chipRow(timeline.snapshot_plane.receipt_ids)}
  </div>`;

  /* --- mode: contract tree --- */
  const treeHtml = `<div class="chains">
    ${['upstream', 'A', 'B'].map((k) => {
      const c = chains.chains[k];
      const evs = timeline.rows.filter((e) => e.chain === k);
      return `<div class="chain-rail" data-chain="${esc(k)}">
        <div class="chain-head"><span class="chain-name"><span class="chain-glyph" aria-hidden="true"></span> ${esc(c.label_long)}</span></div>
        <p class="chain-sub">${esc(c.one_line)}</p>
        <dl style="margin:.8rem 0 0;font-size:.88rem;display:grid;grid-template-columns:auto 1fr;gap:.25rem .8rem">
          <dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Vendor</dt><dd style="margin:0">${esc(c.vendor_of_record)}</dd>
          <dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Vehicle</dt><dd style="margin:0">${esc(c.cooperative_vehicle)}</dd>
          ${c.city_short_form ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">City agreement</dt><dd style="margin:0">${esc(c.city_short_form)}</dd>` : ''}
          ${c.city_signature_authority ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Signed for the City by</dt><dd style="margin:0">${esc(c.city_signature_authority)}</dd>` : ''}
          ${c.addenda ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Addenda</dt><dd style="margin:0">${c.addenda.map(esc).join('<br>')}</dd>` : ''}
          ${c.ordering_documents ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Ordering documents</dt><dd style="margin:0">${c.ordering_documents.map(esc).join('<br>')}</dd>` : ''}
          ${c.city_pos ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">City POs</dt><dd style="margin:0">${c.city_pos.map(esc).join('<br>')}</dd>` : ''}
          ${c.amount_label ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Money</dt><dd style="margin:0">${esc(c.amount_label)}</dd>` : ''}
          ${c.data_scope ? `<dt style="font-family:var(--mono);font-size:.68rem;color:var(--muted);text-transform:uppercase">Data scope</dt><dd style="margin:0">${esc(c.data_scope)}</dd>` : ''}
        </dl>
        ${c.vendor_note ? `<p class="note">${esc(c.vendor_note)}</p>` : ''}
        <p class="chain-flag">${esc(c.council_action_label)}</p>
        <ul class="chain-events">
          ${evs.map((e) => `<li><span class="ev-date">${esc(fmtDate(e.date))}</span><span><span class="ev-title">${esc(e.title)}</span> ${chip(e.receipt_id, 'source')}</span></li>`).join('\n          ')}
        </ul>
      </div>`;
    }).join('\n    ')}
    <div class="chains-meet">
      <div class="rails" aria-hidden="true"><span class="rail-a"></span><span class="block"></span><span class="rail-b"></span></div>
      <p style="font-size:.9rem;margin:0"><strong>${esc(chains.meeting_point.label)}.</strong> ${esc(chains.meeting_point.copy)}</p>
    </div>
  </div>`;

  /* --- mode: document stack --- */
  const stackHtml = `<p class="lede">${esc(pageComp.document)}</p>
  <p class="note">${esc(pageComp.caveat)} ${chip(pageComp.receipt_id, 'source')}</p>
  <div class="table-scroll" style="margin-top:1rem">
    <table class="data">
      <caption>Every page of the 25-page file, with the record layer it belongs to.</caption>
      <thead><tr><th scope="col">Page</th><th scope="col">Document</th><th scope="col">What is on it</th><th scope="col">Record layer</th><th scope="col">In the council-facing summary?</th><th scope="col">Receipt</th></tr></thead>
      <tbody>
        ${pageComp.pages.map((p) => `<tr${p.is_page_nine ? ' style="background:#fff6ec"' : ''}>
          <td class="num">${p.page}</td>
          <td>${esc(p.document_short)}</td>
          <td>${esc(p.label)}${p.post_vote_date ? ' <span class="layer-chip">post-vote date</span>' : ''}${p.term_check === 'not_individually_checked' ? ' <span class="layer-chip">page not individually term-checked</span>' : ''}</td>
          <td>${layerChip(p.record_layer)}</td>
          <td>${p.described_in_summary ? 'Yes' : 'No — attachment'}</td>
          <td>${chip(p.receipt_id, 'source')}</td>
        </tr>`).join('\n        ')}
      </tbody>
    </table>
  </div>
  <div class="callout"><h3>Not in the file</h3><ul style="margin:0;padding-left:1.1rem;font-size:.92rem">
    ${pageComp.not_in_the_file.map((x) => `<li>${esc(x.label)} ${chip(x.receipt_id, 'source')}</li>`).join('\n    ')}
  </ul></div>`;

  /* --- mode: parts list --- */
  const partsHtml = `<div class="table-scroll">
    <table class="data">
      <caption>${esc(parts.note)}</caption>
      <thead><tr>
        <th scope="col">Part</th><th scope="col">SKU</th><th scope="col">Chain</th><th scope="col">Status</th>
        <th scope="col">Qty</th><th scope="col">Price</th><th scope="col">Document</th><th scope="col">Date</th>
        <th scope="col">In the council-facing summary?</th>
        <th scope="col">What it establishes</th><th scope="col">What it does not establish</th>
        <th scope="col">Caveat</th><th scope="col">Receipt</th>
      </tr></thead>
      <tbody>
        ${parts.rows.map((r) => `<tr>
          <td><strong>${esc(r.label)}</strong></td>
          <td class="raw">${esc(r.sku_raw || '—')}</td>
          <td>${esc(chains.chains[r.chain] ? chains.chains[r.chain].label : 'Other')}</td>
          <td>${statusPill(r.status_code)}</td>
          <td class="num">${r.qty == null ? '—' : r.qty}</td>
          <td class="num">${r.line_total_usd == null ? '—' : esc(money(r.line_total_usd))}</td>
          <td>${esc(r.document)}</td>
          <td class="num">${esc(fmtDate(r.date))}</td>
          <td>${r.described_in_council_summary ? 'Yes' : 'No'}</td>
          <td>${esc(r.establishes)}</td>
          <td>${esc(r.does_not_establish || '—')}</td>
          <td>${esc(r.caveat || '—')}</td>
          <td>${chip(r.receipt_id, 'source')}</td>
        </tr>`).join('\n        ')}
      </tbody>
    </table>
  </div>`;

  const modes = [
    ['timeline', 'Chronology', timelineHtml],
    ['tree', 'Contract chains', treeHtml],
    ['stack', 'Document stack', stackHtml],
    ['parts', 'Parts list', partsHtml]
  ];

  const body = collect(`
<section class="module" aria-labelledby="rec-h">
  <div class="wrap-full">
    <p class="kicker">Des Moines ALPR &nbsp;&bull;&nbsp; Page 3 of the exhibit</p>
    <h2 id="rec-h" style="font-size:clamp(1.9rem,5vw,2.8rem)">${esc(copy.records_page.title)}</h2>
    <p class="chapter-body" style="max-width:62ch;margin-top:.8rem">${esc(copy.records_page.dek)}</p>
    <p class="note">This page is the canonical accessible fallback for the exhibit. Every visual claim on the narrative page appears here as a table row, and all four views below render without JavaScript.</p>
  </div>
</section>

<section class="module" id="views" style="padding-top:0" aria-labelledby="views-h">
  <div class="wrap-full">
    <h3 id="views-h" class="visually-hidden">Four views of the same record</h3>
    <p id="record-mode-status" class="visually-hidden" role="status" aria-live="polite">Showing the chronology view.</p>
    <div id="record-modes" class="modes" role="group" aria-label="Choose a view">
      ${modes.map(([k, label], i) => `<button type="button" class="mode-btn" data-mode="${k}" aria-pressed="${i === 0}">${esc(label)}</button>`).join('\n      ')}
    </div>
    ${modes.map(([k, label, html], i) => `<section class="mode-panel" data-mode="${k}" id="mode-${k}" ${i === 0 ? '' : 'hidden'} aria-labelledby="mode-${k}-h">
      <h3 id="mode-${k}-h" class="visually-hidden">${esc(label)}</h3>
      ${html}
    </section>`).join('\n    ')}
    <noscript><p class="note">With JavaScript disabled, only the first view is shown by the button bar; use the links below to reach the others directly: <a href="#mode-timeline">Chronology</a>, <a href="#mode-tree">Contract chains</a>, <a href="#mode-stack">Document stack</a>, <a href="#mode-parts">Parts list</a>. All four are present in the page source.</p></noscript>
  </div>
</section>

<section class="module" id="platform" aria-labelledby="plat-h">
  <div class="wrap-full">
    <p class="kicker">The August 2026 snapshot</p>
    <h2 id="plat-h">What the three exports contain</h2>
    <div class="snapshot-break" style="margin-top:1rem">
      <strong>Discontinuity</strong>
      <div class="sb-rule" aria-hidden="true"></div>
      <p>${esc(copy.standing.no_dates)} Nothing in this section can be connected in time to anything in the chronology above.</p>
    </div>
    <div style="display:grid;gap:1rem;margin-top:1.2rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="callout" style="margin:0"><h3>Sharing</h3>
        <p>${esc(platform.sharing.agencies_label)}, across ${esc(platform.sharing.jurisdictions_label)}. ${platform.sharing.receiving} also show a receiving relationship; ${platform.sharing.no_receiving} none; ${platform.sharing.approval_required} approval required; ${platform.sharing.declined} declined. ${platform.sharing.undated_rows} of ${platform.sharing.agencies} rows carry no usable date. No active hot-list sharing appears in either direction.</p>
        ${chipRow(platform.sharing.receipt_ids)}
      </div>
      <div class="callout" style="margin:0"><h3>Systems and cameras</h3>
        <p><strong>Counting convention:</strong> ${esc(platform.systems.counting_convention)} On that convention: ${platform.systems.systems_total} system rows (${platform.systems.systems_mobile} Mobile, ${platform.systems.systems_ip} IP, ${platform.systems.systems_fixed} Fixed) with ${platform.systems.cameras_total} nested cameras. ${esc(platform.systems.alternative_convention)}</p>
        <p style="margin-top:.6rem">${esc(platform.systems.anomaly)}</p>
        ${chipRow(platform.systems.receipt_ids)}
      </div>
      <div class="callout" style="margin:0"><h3>Accounts</h3>
        <p>${platform.accounts.total} accounts: ${platform.accounts.operator} Operator, ${platform.accounts.advanced_agency_manager} Advanced Agency Manager. ${esc(platform.accounts.caveat)} ${esc(platform.accounts.names_policy)}</p>
        ${chipRow(platform.accounts.receipt_ids)}
      </div>
      <div class="callout" style="margin:0"><h3>${esc(platform.quantity_sequence.label)}</h3>
        <ul style="margin:.4rem 0 0;padding-left:1.1rem;font-size:.92rem">
          ${platform.quantity_sequence.items.map((i) => `<li><strong class="tnum">${i.n}</strong> ${esc(i.label)} &mdash; <span style="color:var(--muted)">${esc(i.source)}</span></li>`).join('\n          ')}
        </ul>
        <p style="margin-top:.6rem">${esc(platform.quantity_sequence.caveat)}</p>
        ${chipRow(platform.quantity_sequence.receipt_ids)}
      </div>
    </div>
    <p style="margin-top:1.2rem"><a href="/infographics/des-moines-alpr/network/"><strong>Explore all 155 configured relationships &rarr;</strong></a></p>
  </div>
</section>

<section class="module" id="methodology" aria-labelledby="meth-h">
  <div class="wrap-wide">
    <p class="kicker">Method</p>
    <h2 id="meth-h">${esc(copy.records_page.methodology_heading)}</h2>

    <h3 style="margin-top:1.4rem">How this exhibit draws evidence</h3>
    <p>Three kinds of information about every element are kept in separate visual channels, so that nothing is carried by colour alone:</p>
    <div class="table-scroll" style="margin-top:.8rem">
      <table class="data">
        <caption>The evidence grammar this exhibit is built to.</caption>
        <thead><tr><th scope="col">Axis</th><th scope="col">Question it answers</th><th scope="col">How it is drawn</th></tr></thead>
        <tbody>
          <tr><td>Status</td><td>What kind of fact is this?</td><td>Shape fill and line style, plus a word. Never colour.</td></tr>
          <tr><td>Record layer</td><td>Which document does this come from?</td><td>A text-first chip attached to the element and to every receipt.</td></tr>
          <tr><td>Chain and time plane</td><td>Which procurement lineage, or which snapshot?</td><td>Hue &mdash; the only thing hue encodes &mdash; always paired with a distinct glyph and the chain&rsquo;s name in text.</td></tr>
        </tbody>
      </table>
    </div>

    <h3 style="margin-top:1.6rem">Status vocabulary</h3>
    <ul style="list-style:none;padding:0;display:grid;gap:.5rem;margin-top:.7rem">
      ${Object.entries(parts.status_legend).map(([k, v]) => `<li>${statusPill(k)} &mdash; ${esc(v)}</li>`).join('\n      ')}
    </ul>

    <h3 style="margin-top:1.6rem">Record layers</h3>
    <ul style="list-style:none;padding:0;display:grid;gap:.5rem;margin-top:.7rem">
      ${Object.entries(LAYER_LABELS).map(([k, v]) => `<li>${layerChip(k)} &mdash; ${esc(receiptsFile.record_layer_legend[k] || v)}</li>`).join('\n      ')}
    </ul>

    <h3 style="margin-top:1.6rem">What each source tag means</h3>
    <ul style="list-style:none;padding:0;display:grid;gap:.4rem;margin-top:.7rem">
      ${Object.entries(receiptsFile.source_tag_legend).map(([k, v]) => `<li><span class="layer-chip">${esc(TAG_LABELS[k])}</span> ${esc(v)}</li>`).join('\n      ')}
    </ul>

    <h3 style="margin-top:1.6rem" id="corrections">${esc(copy.records_page.corrections_heading)}</h3>
    <p>${esc(copy.records_page.corrections_note)}</p>
    <div class="table-scroll" style="margin-top:.8rem" data-lint-exempt="quotes-corrected-language">
      <table class="data">
        <caption>Figures and framings corrected before this exhibit was built. The left-hand column quotes formulations this exhibit does <em>not</em> use.</caption>
        <thead><tr><th scope="col">Earlier working formulation</th><th scope="col">Carried forward as</th><th scope="col">Why</th></tr></thead>
        <tbody>
          ${copy.corrections.map((c) => `<tr><td>${esc(c.was)}</td><td><strong>${esc(c.now)}</strong></td><td>${esc(c.why)}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>

    <h3 style="margin-top:1.6rem">Language this exhibit does not use</h3>
    <div data-lint-exempt="banned-verb-glossary">
    <p>For the August 2026 export, relationships are described only as <em>configured</em>, <em>listed</em>, <em>selected</em>, <em>shown in the export</em>, <em>in Sharing status</em> or <em>configured to receive</em>. This exhibit does not say that data was sent, transmitted, flowed, accessed, viewed, fed, reached or watched, because no record produced establishes any of those.</p>
    <p>For the council material, this exhibit says <em>described</em>, <em>stated</em>, <em>authorized</em>, <em>contained</em>, <em>on page 9</em> and <em>in the produced file</em>. It does not say <em>hid</em>, <em>buried</em>, <em>concealed</em>, <em>snuck</em>, <em>slipped in</em> or <em>misled</em>, because no record establishes intent.</p>
    <p>Between the 2023 procurement record and the 2026 snapshot, this exhibit draws no causal bridge. Nothing <em>became</em>, <em>grew into</em>, <em>led to</em> or <em>caused</em> anything else across that gap, because 151 of 155 rows carry no date and no other record supplies one.</p>
    </div>

    <h3 style="margin-top:1.6rem">Sources</h3>
    <ul style="padding-left:1.1rem">
      ${copy.sources.map((s) => `<li style="margin-bottom:.5rem">${esc(s.label)} <span style="color:var(--muted);font-family:var(--mono);font-size:.7rem">${s.layers.map((l) => esc(l)).join(' · ')}</span></li>`).join('\n      ')}
    </ul>

    <h3 style="margin-top:1.6rem">Before publication</h3>
    <ul style="padding-left:1.1rem">
      ${copy.publication_gates.map((g) => `<li>${esc(g)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>
`);

  return head({
    title: `The record — Des Moines ALPR | Restoring Democracy's Promise`,
    description: copy.records_page.dek,
    canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/records/',
    sections: [
      { id: 'views', label: 'Views' },
      { id: 'platform', label: '2026 snapshot' },
      { id: 'methodology', label: 'Method' },
      { id: 'corrections', label: 'Corrections' }
    ],
    key: 'records'
  }) + body + foot({
    receiptIds: usedReceipts,
    extraScripts: '<script src="../assets/exhibit.js" defer></script>'
  });
}

/* ------------------------------------------------------------------- main */
mkdirSync(join(OUT, 'network'), { recursive: true });
mkdirSync(join(OUT, 'records'), { recursive: true });

const outputs = [
  [join(OUT, 'index.html'), buildIndex()],
  [join(OUT, 'network', 'index.html'), buildNetwork()],
  [join(OUT, 'records', 'index.html'), buildRecords()]
];

for (const [path, html] of outputs) {
  writeFileSync(path, html, 'utf8');
  console.log(`wrote ${path.replace(OUT, '.')}  ${(html.length / 1024).toFixed(1)} KB`);
}
console.log(`\n${receiptsFile.rows.length} authored receipts + ${nodes.rows.length} generated export-row receipts.`);
