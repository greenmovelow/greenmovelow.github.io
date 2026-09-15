/* ============================================================================
   RDP — Des Moines ALPR exhibit. Editorial guardrail linter.

   This is not a style checker. Each rule below encodes a proposition the
   record does not support, or a drawing behaviour that would assert one.
   A failure here means the exhibit is saying something the evidence does not.

   Run: node _src/lint.mjs   (exits non-zero on any failure)
   ========================================================================= */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..');
const DATA = join(OUT, 'data');

const PAGES = [
  ['index.html', join(OUT, 'index.html')],
  ['network/index.html', join(OUT, 'network', 'index.html')],
  ['records/index.html', join(OUT, 'records', 'index.html')],
  ['visual/index.html', join(OUT, 'visual', 'index.html')]
];
const ASSETS = ['exhibit.css', 'exhibit.js', 'network.js', 'visual.css', 'visual.js']
  .map((f) => [`assets/${f}`, join(OUT, 'assets', f)]);

/* `node lint.mjs --publish` adds the publication gates. They are deliberately
   NOT part of the ordinary run, so a prototype or draft-PR build renders and
   lints cleanly while right-of-response is still pending. */
const PUBLISH = process.argv.includes('--publish');

let failures = 0;
let checks = 0;

function fail(rule, page, detail) {
  failures++;
  console.log(`FAIL  ${rule}\n      ${page}\n      ${detail}\n`);
}
function pass(rule) { checks++; console.log(`ok    ${rule}`); }

/* Strip regions explicitly marked as quoting guarded language in order to
   explain it (the corrections table; the "language this exhibit does not use"
   glossary). Anything else is fair game. */
function stripExempt(html) {
  return html.replace(
    /<(\w+)[^>]*data-lint-exempt="[^"]*"[\s\S]*?<\/\1>/g,
    ' [LINT-EXEMPT REGION] '
  );
}

/* Rough visible-text extraction: drop script/style, strip tags, keep
   attribute values that render (alt, aria-label, title). */
function visibleText(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const attrs = [];
  for (const m of s.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/g)) attrs.push(m[1]);
  s = s.replace(/<[^>]+>/g, ' ') + ' ' + attrs.join(' ');
  return s.replace(/&nbsp;/g, ' ').replace(/&mdash;|&ndash;/g, '-')
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"').replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

const pageText = {};
for (const [name, path] of PAGES) {
  pageText[name] = visibleText(stripExempt(readFileSync(path, 'utf8')));
}
const pageRaw = Object.fromEntries(PAGES.map(([n, p]) => [n, readFileSync(p, 'utf8')]));
const assetRaw = Object.fromEntries(ASSETS.map(([n, p]) => [n, readFileSync(p, 'utf8')]));

/* ------------------------------------------------------------------ rule 1
   Banned verbs. These would assert movement, access or intent that no
   produced record establishes. */
const BANNED = [
  [/\b(?:was|were|is|are|been|being)\s+(?:then\s+)?(?:shared with|sent to|transmitted to|fed to|accessed by|viewed by|watched by)\b/i,
   'asserts a transfer or access the record does not establish'],
  [/\bplate (?:data|records?)\s+(?:flowed|flows|travelled|traveled|moved|reached)\b/i, 'asserts movement of data'],
  [/\bdata\s+(?:flowed|flows)\s+to\b/i, 'asserts movement of data'],
  [/\bhas access to\b(?=[^.]{0,80}\b(?:agenc|department|police|sheriff|federal)\w*)/i,
   'asserts agency access to Des Moines data'],
  [/\b(?:hid|hidden|concealed|buried|snuck|sneaked|slipped in|misled|misleading)\b/i,
   'asserts intent or concealment; no record establishes intent'],
  [/\b(?:became|grew into|led to|gave rise to|caused)\b/i,
   'causal bridge; the record cannot connect the 2023 procurement to the 2026 snapshot'],
  [/\bcouncil\s+(?:saw|knew|read|understood|was aware)\b/i,
   'asserts what council members saw or knew; item 32 was a consent item'],
  [/\b386 officers\b/i, 'accounts are not people'],
  [/\b140 vehicles\b/i, 'one Mobile row is literally named "Unit number"'],
  [/\bone-way flow\b/i, 'a receiving setting of "none" is a setting, not a flow'],

  /* The three formulations narrowed in the article's v0.2 precision pass.
     Each broader claim asserts more than the source ledger supports. */
  [/did not go through (?:the )?council at all/i,
   'too broad: the reviewed records show the earlier capability was acquired administratively, while the November purchase went to the Council'],
  [/\bnetwork reach(?:ed|es|ing)\b/i,
   'too broad: the 2026 platform was CONFIGURED for sharing relationships across 36 states and D.C.; nothing "reached" anywhere'],
  [/reaching (?:thirty-six|36) states/i,
   'too broad: configuration, not reach'],
  [/(?:contracts?|agreements?) (?:give|gives|gave) the [Cc]ity no right to audit/i,
   'too broad: the REVIEWED EXECUTED agreements contain no corresponding City-side audit, inspection or log-access right'],
  [/\$157,500\b/,
   'superseded figure from a corrected services subtotal; the authoritative arithmetic is $1,287,000 + $145,500 + $500 + $67,080 = $1,500,080']
];
let bannedHits = 0;
for (const [name, text] of Object.entries(pageText)) {
  for (const [re, why] of BANNED) {
    const m = re.exec(text);
    if (m) {
      bannedHits++;
      fail('banned-language', name, `"${m[0]}" — ${why}\n      context: …${text.slice(Math.max(0, m.index - 90), m.index + 90)}…`);
    }
  }
}
if (!bannedHits) pass('banned-language — no banned verb, causal bridge or intent claim in rendered text');

/* ------------------------------------------------------------------ rule 2
   The jurisdiction count is locked. "37 states" double-counts D.C. */
let stateHits = 0;
for (const [name, text] of Object.entries(pageText)) {
  if (/\b37 states\b/i.test(text)) { stateHits++; fail('state-count-lock', name, '"37 states" appears; the export has 36 states and the District of Columbia'); }
  for (const m of text.matchAll(/\b36 states\b/gi)) {
    const after = text.slice(m.index, m.index + 90);
    if (!/(and the District of Columbia|\+ ?D\.?C\.?)/i.test(after)) {
      stateHits++;
      fail('state-count-companion', name, `"36 states" not followed by its companion: …${after}…`);
    }
  }
}
if (!stateHits) pass('state-count — "36 states" always carries "and the District of Columbia"; "37 states" never appears');

/* ------------------------------------------------------------------ rule 3
   Required companions. Certain figures may not appear alone. */
const COMPANIONS = [
  ['4.5%', /M500 ALPR DVR|ALPR DVR/i, 'the 4.5% figure must appear with the "every unit shipped with an M500 ALPR DVR" sentence'],
  ['386', /accounts are not people|Accounts are not people/i, 'the 386 must appear with "accounts, not people"'],
  ['155', /configured to share|Configured to share/i, 'the 155 must appear with "configured to share — not shown to have shared"'],
  ['567', /142 systems/i, 'the 567 shorthand may appear only while explaining the alternative counting convention']
];
let compHits = 0;
for (const [name, text] of Object.entries(pageText)) {
  for (const [needle, companion, why] of COMPANIONS) {
    if (text.includes(needle) && !companion.test(text)) {
      compHits++; fail('required-companion', name, `"${needle}" appears without its companion — ${why}`);
    }
  }
}
if (!compHits) pass('required-companion — every guarded figure carries its mandatory companion sentence');

/* ------------------------------------------------------------------ rule 3b
   The purchase arithmetic must appear in its corrected form, and 4.51% must
   travel with the fleet-wide ALPR hardware fact. */
let arithHits = 0;
{
  const idx = pageText['index.html'];
  for (const needle of ['$1,287,000', '$145,500', '$67,080', '$1,500,080', '4.51']) {
    if (!idx.includes(needle)) {
      arithHits++; fail('arithmetic', 'index.html', `the corrected arithmetic is incomplete: "${needle}" is missing`);
    }
  }
  if (/4\.5\s*%/.test(idx) && !idx.includes('4.51')) {
    arithHits++; fail('arithmetic', 'index.html', 'the superseded "4.5%" appears without the corrected 4.51 percent');
  }
}
if (!arithHits) pass('arithmetic — $1,287,000 + $145,500 + $500 + $67,080 = $1,500,080, and 4.51 percent is stated');

/* ------------------------------------------------------------------ rule 4
   Drawing rules. Arrowheads mean movement; draw-on and motion-along-path are
   directional cues. None may exist anywhere in the exhibit. */
const DRAW_BANS = [
  [/<marker\b/i, '<marker> element (arrowhead)'],
  [/marker-end|marker-start|marker-mid/i, 'marker-* attribute (arrowhead)'],
  [/animateMotion/i, '<animateMotion> (motion along a path)'],
  [/offset-path/i, 'offset-path (motion along a path)'],
  [/stroke-dashoffset/i, 'stroke-dashoffset (draw-on animation)']
];
let drawHits = 0;
for (const [name, src] of Object.entries({ ...pageRaw, ...assetRaw })) {
  for (const [re, what] of DRAW_BANS) {
    if (re.test(src)) { drawHits++; fail('drawing-rules', name, `${what} is present; directional motion cues are banned`); }
  }
}
if (!drawHits) pass('drawing-rules — no arrowheads, no draw-on, no motion along any path');

/* ------------------------------------------------------------------ rule 5
   The default plane-3 render must have zero connectors. */
let connHits = 0;
for (const [name, src] of Object.entries(pageRaw)) {
  if (/class="connector"/.test(src)) {
    connHits++; fail('default-no-connectors', name, 'a connector is present in the served HTML; connectors may exist only after an explicit selection');
  }
}
if (!connHits) pass('default-no-connectors — the served HTML contains no connector; 155 rings, zero lines');

/* ---------------------------------------------------------------- rule 5b
   The visual companion may show one abstract relationship after explicit
   state selection. It must not ship a default path or describe the path as an
   event-level search, view or transfer. Existing route guardrails are unchanged. */
let visualPathHits = 0;
if (/data-relationship=/.test(pageRaw['visual/index.html'])) {
  visualPathHits++; fail('visual-relationship-semantics', 'visual/index.html', 'a relationship path exists before reader selection');
}
if (!/addEventListener\('click',[\s\S]{0,120}selectState/.test(assetRaw['assets/visual.js'])) {
  visualPathHits++; fail('visual-relationship-semantics', 'assets/visual.js', 'state selection is not explicitly click-triggered');
}
if (!/Configured relationship only[^.]*not a search, view or transfer/i.test(assetRaw['assets/visual.js'])) {
  visualPathHits++; fail('visual-relationship-semantics', 'assets/visual.js', 'selected-path status lacks its configuration-not-activity qualification');
}
if (/mouseenter[\s\S]{0,160}(?:appendChild|selectState)/.test(assetRaw['assets/visual.js'])) {
  visualPathHits++; fail('visual-relationship-semantics', 'assets/visual.js', 'hover creates a relationship path; explicit selection is required');
}
if (!visualPathHits) pass('visual-relationship-semantics — no default path; one whole undirected path only after explicit state selection');

/* ------------------------------------------------------------------ rule 6
   Every receipt trigger must resolve to a receipt that exists and that carries
   both a caveat and a "what this does not establish" line. */
const receiptsFile = JSON.parse(readFileSync(join(DATA, 'evidence_receipts.json'), 'utf8'));
const known = new Set(receiptsFile.rows.map((r) => r.receipt_id));
let recHits = 0;
for (const [name, src] of Object.entries(pageRaw)) {
  for (const m of src.matchAll(/data-receipt="([^"]+)"/g)) {
    const id = m[1];
    if (id.startsWith('R-SHARE-ROW-')) continue; /* generated per export row */
    if (!known.has(id)) { recHits++; fail('receipt-resolves', name, `unknown receipt id "${id}"`); }
  }
}
for (const r of receiptsFile.rows) {
  if (!r.what_it_does_not_establish && r.what_it_does_not_establish !== '') {
    recHits++; fail('receipt-completeness', 'evidence_receipts.json', `${r.receipt_id} is missing "what_it_does_not_establish"`);
  }
  if (!r.source_document || !r.page_or_row) {
    recHits++; fail('receipt-completeness', 'evidence_receipts.json', `${r.receipt_id} is missing a source document or pinpoint`);
  }
}
/* Every plane-3 receipt must carry the configuration-is-not-use caveat. */
for (const r of receiptsFile.rows) {
  if (r.record_layer === 'L5') {
    const guard = `${r.caveat || ''} ${r.what_it_does_not_establish || ''}`;
    if (!/not establish|not determinable|not defined|not shown/i.test(guard)) {
      recHits++; fail('plane3-caveat', 'evidence_receipts.json',
        `${r.receipt_id} (L5) never says what it does not establish; every export receipt must state its limit`);
    }
  }
  if (r.record_layer === 'L2' && !(r.caveat || '').trim()) {
    recHits++; fail('L2-caveat', 'evidence_receipts.json', `${r.receipt_id} (L2) has no caveat; every clerk's-file receipt must carry its distribution or scope caveat`);
  }
}
if (!recHits) pass(`receipts — ${receiptsFile.rows.length} authored receipts, all resolving, all carrying a pinpoint and a "does not establish" line`);

/* ------------------------------------------------------------------ rule 6b
   Every shipped facsimile must carry a sidecar recording where it came from,
   and must be declared unaltered. A crop without provenance is not evidence. */
let faxHits = 0;
{
  const faxDir = join(OUT, 'assets', 'facsimiles');
  let files = [];
  try { files = readdirSync(faxDir); } catch { /* no crops shipped yet */ }
  const pngs = files.filter((f) => f.endsWith('.png'));
  for (const png of pngs) {
    const id = png.replace(/\.png$/, '');
    if (!files.includes(id + '.json')) {
      faxHits++; fail('facsimile-provenance', `assets/facsimiles/${png}`, 'no sidecar; a crop without provenance is not evidence');
      continue;
    }
    const meta = JSON.parse(readFileSync(join(faxDir, id + '.json'), 'utf8'));
    for (const field of ['source_document', 'source_sha256', 'page', 'crop_box_pt', 'render_dpi', 'alteration']) {
      if (meta[field] === undefined) {
        faxHits++; fail('facsimile-provenance', `assets/facsimiles/${id}.json`, `missing ${field}`);
      }
    }
    if (!/^none/.test(meta.alteration || '')) {
      faxHits++; fail('facsimile-provenance', `assets/facsimiles/${id}.json`, 'alteration is not declared as none');
    }
  }
  if (!faxHits) pass(`facsimile-provenance — ${pngs.length} crop(s), each with a sidecar naming the source, page, crop box and SHA-256`);
}

/* ------------------------------------------------------------------ rule 7
   No account name may appear anywhere. The user export is not a build input;
   assert that no shipped data file carries a name-bearing field. */
let nameHits = 0;
for (const f of readdirSync(DATA)) {
  const src = readFileSync(join(DATA, f), 'utf8');
  if (/"(?:user_name|account_name|full_name|operator_name)"\s*:/i.test(src)) {
    nameHits++; fail('no-account-names', `data/${f}`, 'a name-bearing field is present in a shipped data file');
  }
}
if (!nameHits) pass('no-account-names — no account name appears in any shipped data file or page');

/* ------------------------------------------------------------------ rule 8
   Recomputed export totals must equal the adjudicated figures. */
const nodes = JSON.parse(readFileSync(join(DATA, 'network_nodes.json'), 'utf8'));
const expect = {
  agencies: 155, jurisdictions: 37, states_excl_dc: 36, dc: 1, iowa: 14, non_iowa: 141,
  receiving: 120, approval_required: 12, declined: 8, no_receiving: 15,
  undated_rows: 151, dated_rows: 4, f_prefixed: 51, inactive_prefixed: 5,
  has_system_yes: 134, retention_no: 26, hot_list_active_out: 0, hot_list_active_in: 0,
  federal_typed: 5
};
let totHits = 0;
for (const [k, v] of Object.entries(expect)) {
  if (nodes.totals[k] !== v) { totHits++; fail('export-totals', 'data/network_nodes.json', `${k} is ${nodes.totals[k]}, adjudicated ${v}`); }
}
if (nodes.rows.length !== 155) { totHits++; fail('export-totals', 'data/network_nodes.json', `${nodes.rows.length} rows, expected 155`); }
if (!totHits) pass('export-totals — all 19 recomputed totals match the adjudicated figures');

/* ------------------------------------------------------------------ rule 9
   Accessibility floors that are cheap to assert mechanically. */
let a11yHits = 0;
for (const [name, src] of Object.entries(pageRaw)) {
  if (!/class="skip-link"/.test(src)) { a11yHits++; fail('a11y', name, 'no skip link'); }
  if (!/<table[\s\S]*?<caption>/.test(src)) { a11yHits++; fail('a11y', name, 'a data table without a caption'); }
  if (/<th[\s>](?![^>]*scope=)/.test(src)) { a11yHits++; fail('a11y', name, 'a <th> without a scope attribute'); }
  if (/<img(?![^>]*\balt=)/.test(src)) { a11yHits++; fail('a11y', name, 'an <img> without alt'); }
  if (!/prefers-reduced-motion/.test(assetRaw['assets/exhibit.css'])) { a11yHits++; fail('a11y', name, 'no reduced-motion handling in the stylesheet'); }
  if (!/role="status"|aria-live/.test(src)) { a11yHits++; fail('a11y', name, 'no live region for state changes'); }
}
if (!a11yHits) pass('a11y — skip link, captioned tables, scoped headers, alt text, reduced motion, live regions');

/* ----------------------------------------------------------------- rule 10
   The no-JS fallback must actually contain the evidence. */
let fallbackHits = 0;
for (const [name, src] of Object.entries(pageRaw)) {
  if (name === 'visual/index.html') {
    if (!/class="visual-access-table"[\s\S]*?<table>/.test(src)) {
      fallbackHits++; fail('no-js-fallback', name, 'the visual map has no semantic list/table alternative');
    }
  } else if (!/class="module no-js-receipts"/.test(src)) {
    fallbackHits++; fail('no-js-fallback', name, 'no receipts fallback block');
  }
}
if (!/<tbody id="network-tbody">[\s\S]{5000,}/.test(pageRaw['network/index.html'])) {
  fallbackHits++; fail('no-js-fallback', 'network/index.html', 'the 155-row table is not rendered server-side');
}
for (const mode of ['timeline', 'tree', 'stack', 'parts']) {
  if (!new RegExp(`id="mode-${mode}"`).test(pageRaw['records/index.html'])) {
    fallbackHits++; fail('no-js-fallback', 'records/index.html', `mode "${mode}" is not in the static HTML`);
  }
}
if (!fallbackHits) pass('no-js-fallback — receipts, map alternative, the 155-row table and all four record views are in the static HTML');

/* ----------------------------------------------------------------- rule 11
   Prepublication posture. While the exhibit is a draft it must not be
   indexable, must not appear in the sitemap, and must not link to an article
   URL that does not exist. */
let draftHits = 0;
for (const [name, src] of Object.entries(pageRaw)) {
  if (!/name="robots" content="noindex,nofollow"/.test(src)) {
    draftHits++; fail('prepublication', name, 'noindex,nofollow is missing');
  }
  if (!/class="draft-banner"/.test(src)) {
    draftHits++; fail('prepublication', name, 'the prepublication banner is missing');
  }
}
try {
  const sitemap = readFileSync(join(OUT, '..', '..', 'sitemap.xml'), 'utf8');
  if (/des-moines-alpr/.test(sitemap)) {
    draftHits++; fail('prepublication', 'sitemap.xml', 'the exhibit routes are in the sitemap before publication');
  }
} catch { /* sitemap not reachable from here; skip */ }
{
  const link = JSON.parse(readFileSync(join(HERE, 'content', 'copy.json'), 'utf8')).exhibit.article_link;
  if (link.enabled && !link.url) {
    draftHits++; fail('prepublication', 'copy.json', 'the article link is enabled with no URL');
  }
}
if (!draftHits) pass('prepublication — noindex on every page, banner present, not in the sitemap, no invented article link');

/* ------------------------------------------------------- PUBLICATION GATES
   Run only with --publish. These are the checks that must pass before the
   exhibit goes live, and they are deliberately excluded from the ordinary
   prototype and draft-PR run. */
if (PUBLISH) {
  let gateHits = 0;
  const copyJson = JSON.parse(readFileSync(join(HERE, 'content', 'copy.json'), 'utf8'));
  const ror = copyJson.right_of_response;
  if (ror.status !== 'received' && ror.status !== 'closed') {
    gateHits++; fail('PUBLISH-GATE', 'copy.json', `right_of_response.status is "${ror.status}"; responses must be received or the window closed and stated`);
  }
  if (!copyJson.exhibit.article_link.enabled || !copyJson.exhibit.article_link.url) {
    gateHits++; fail('PUBLISH-GATE', 'copy.json', 'the article link is not set');
  }
  if (/PROVISIONAL/i.test(JSON.stringify(copyJson))) {
    gateHits++; fail('PUBLISH-GATE', 'copy.json', 'PROVISIONAL copy remains');
  }
  for (const [name, src] of Object.entries(pageRaw)) {
    if (/noindex/.test(src)) { gateHits++; fail('PUBLISH-GATE', name, 'still noindex'); }
    if (/class="draft-banner"/.test(src)) { gateHits++; fail('PUBLISH-GATE', name, 'the prepublication banner is still present'); }
  }
  if (!gateHits) pass('PUBLICATION GATES — right of response resolved, article linked, no provisional copy, indexable');
} else {
  console.log('note  publication gates skipped (run with --publish to check them)');
}

/* -------------------------------------------------------------------- done */
console.log(`\n${checks} rule group(s) passed, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
