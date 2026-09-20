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
  ['records/index.html', join(OUT, 'records', 'index.html')]
];
const PUBLIC_PAGES = PAGES.filter(([name]) => name !== 'records/index.html');
const UNLISTED_PAGES = PAGES.filter(([name]) => name === 'records/index.html');
const GOAT_ATTRIBUTE = 'data-goatcounter="https://restoring-democracy.goatcounter.com/count"';
const GOAT_SCRIPT = 'https://gc.zgo.at/count.js';
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
const redirectRaw = readFileSync(join(OUT, 'visual', 'index.html'), 'utf8');
const copyRaw = readFileSync(join(HERE, 'content', 'copy.json'), 'utf8');

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

/* -------------------------------------------------------------- UI copy
   Source access is presented as a documentary note, never as a challenge or
   an unexplained question-mark control. */
let sourceNoteHits = 0;
const defensiveSourcePrompt = new RegExp('How do you ' + 'know that\\??', 'i');
for (const [name, raw] of [...Object.entries(pageRaw), ...Object.entries(assetRaw)]) {
  if (defensiveSourcePrompt.test(raw)) {
    sourceNoteHits++; fail('source-note-language', name, 'defensive source-trigger wording remains');
  }
  if (/\.receipt-chip::before\s*\{[^}]*content\s*:\s*["']\?["']/i.test(raw)) {
    sourceNoteHits++; fail('source-note-language', name, 'bare question-mark source trigger remains');
  }
}
if (!sourceNoteHits) pass('source-note-language — triggers and drawer use the documentary source-note system');

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
  const idx = visibleText(copyRaw);
  for (const needle of ['$1,287,000', '$145,500', '$67,080', '$1,500,080', '4.51']) {
    if (!idx.includes(needle)) {
      arithHits++; fail('arithmetic', 'copy.json', `the corrected arithmetic is incomplete: "${needle}" is missing`);
    }
  }
  if (/4\.5\s*%/.test(idx) && !idx.includes('4.51')) {
    arithHits++; fail('arithmetic', 'copy.json', 'the superseded "4.5%" appears without the corrected 4.51 percent');
  }
}
if (!arithHits) pass('arithmetic — $1,287,000 + $145,500 + $500 + $67,080 = $1,500,080, and 4.51 percent is stated');

/* ----------------------------------------------------------------- rule 3c
   The public source figure on the overview is historical. The commercially
   acquired vehicle-location dataset was part of the 2023 package; no reviewed
   record establishes it for the 2026 renewal. This rule keeps that figure from
   drifting back into an unqualified present-tense capability claim, and keeps
   the FaceSearch detail out of it. No receipt or copy.json entry currently
   sources that detail anywhere in the exhibit, so it is not to be restored
   here on this figure's own authority.

   Scoped deliberately to that one section: the records page and the evidence
   tables may discuss the dataset in their own, separately caveated terms. */
let commercialHits = 0;
{
  const section = /<section class="visual-section three-sources"[\s\S]*?<\/section>/.exec(pageRaw['index.html']);
  if (!section) {
    commercialHits++;
    fail('commercial-source-qualification', 'index.html', 'the public source figure is missing from the overview');
  } else {
    const text = visibleText(section[0]);
    if (!/WHAT THE PLATFORM COULD SEARCH IN 2023/.test(text)) {
      commercialHits++;
      fail('commercial-source-qualification', 'index.html',
        'the source figure no longer scopes itself to what the platform COULD search in 2023');
    }
    if (/commercial/i.test(text)) {
      for (const needle of ['Included in the 2023 package', 'Not established for the 2026 renewal']) {
        if (!text.includes(needle)) {
          commercialHits++;
          fail('commercial-source-qualification', 'index.html',
            `the commercial source is shown without its qualification "${needle}"`);
        }
      }
      for (const sentence of text.split(/(?<=[.!?;])\s+/)) {
        if (!/commercial/i.test(sentence)) continue;
        if (!/2023/.test(sentence) && !/not established|do(?:es)? not establish/i.test(sentence)) {
          commercialHits++;
          fail('commercial-source-qualification', 'index.html',
            `the commercial source is described as a current capability: "${sentence.trim().slice(0, 140)}"`);
        }
      }
    }
    if (/FaceSearch/i.test(text)) {
      commercialHits++;
      fail('commercial-source-qualification', 'index.html',
        'the FaceSearch detail is not part of this explanatory figure; do not restore it here without a separately sourced evidence entry');
    }
  }
}
if (!commercialHits) pass('commercial-source-qualification — the overview source figure is scoped to 2023 and never presents the commercial dataset as an established 2026 capability');

/* ----------------------------------------------------------------- rule 3d
   Unit-count framing, and the reconciliation with the article.

   140 and 149 are counts of ROWS in the August 2026 export, not counts of
   vehicles or of operating systems. One top-level Mobile row is a non-unit
   header labelled "Unit number", which is why the article reports 139 and this
   exhibit reports 140. Wherever the exhibit shows those row counts it must also
   carry the reconciliation, and the fourth measure (126) must name its invoice
   rather than floating free. */
const UNIT_COUNT_BANS = [
  [/\b140 vehicles\b/i, '140 counts export rows, not vehicles; one Mobile row is the "Unit number" header'],
  [/\b140 systems\b/i, '140 counts top-level Mobile ROWS, not operating systems'],
  [/\b149 systems\b/i, '149 counts top-level ROWS in the export, not operating systems']
];
const RECONCILIATION_MARKERS = [
  '139 mobile-system entries after excluding a repeated header row',
  '140 Mobile rows and 149 total top-level rows',
  'drawn from a separate subscription invoice'
];
let unitHits = 0;
for (const [name, text] of Object.entries(pageText)) {
  for (const [re, why] of UNIT_COUNT_BANS) {
    const m = re.exec(text);
    if (m) { unitHits++; fail('unit-count-framing', name, `"${m[0]}" — ${why}`); }
  }
  /* Scoped to pages that actually publish the row counts, so the network
     explorer's unrelated table values never trip it. */
  if (!/\b140 Mobile\b|\b149 top-level\b/.test(text)) continue;
  for (const marker of RECONCILIATION_MARKERS) {
    if (!text.includes(marker)) {
      unitHits++;
      fail('unit-count-framing', name,
        `this page publishes the export row counts without the article reconciliation: "${marker}" is missing`);
    }
  }
  /* Page-level, not per-occurrence: the four-measure ladder reaches the page
     from evidence_receipts.json, which is governed data and not editable to
     satisfy a linter. The requirement is that the page states, somewhere a
     reader will meet it, which invoice the 126 comes from. */
  if (/\b126 subscribed\b/i.test(text) && !/126[^.]{0,120}invoice|invoice[^.]{0,120}126/i.test(text)) {
    unitHits++;
    fail('unit-count-framing', name,
      '"126 subscribed" appears but the page never names the subscription invoice it comes from');
  }
}
if (!unitHits) pass('unit-count-framing — 140/149 are described as rows, the article reconciliation is published beside them, and 126 names its invoice');

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
if (/data-relationship=/.test(pageRaw['index.html'])) {
  visualPathHits++; fail('visual-relationship-semantics', 'index.html', 'a relationship path exists before reader selection');
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
  if (name === 'index.html') {
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

/* -------------------------------------------------------------- public IA
   The public reader journey has only the overview and network. The retained
   records page remains buildable for editorial use but must not be linked. */
let iaHits = 0;
for (const name of ['index.html', 'network/index.html']) {
  const src = pageRaw[name];
  for (const [re, detail] of [
    [/href="[^"]*\/records\//i, 'links to the detached records page'],
    [/Expanded Plate-Reader Use/i, 'uses the removed long-form navigation label'],
    [/>\s*The Record\s*</i, 'uses the removed records navigation label'],
    [/View the full evidence record/i, 'uses the removed evidence-record CTA'],
    [/Explore the Configuration/i, 'uses the retired configuration label']
  ]) {
    if (re.test(src)) { iaHits++; fail('public-information-architecture', name, detail); }
  }
}
if (!/WHERE DES MOINES PLATE DATA CAN GO/.test(pageRaw['index.html'])) {
  iaHits++; fail('public-information-architecture', 'index.html', 'the canonical root is not the visual overview');
}
if (!/href="\/infographics\/des-moines-alpr\/network\/"[^>]*>Explore the network/i.test(pageRaw['index.html'])) {
  iaHits++; fail('public-information-architecture', 'index.html', 'the overview lacks its Explore the network link');
}
if (!/href="\/infographics\/des-moines-alpr\/"[^>]*>Overview/i.test(pageRaw['network/index.html'])) {
  iaHits++; fail('public-information-architecture', 'network/index.html', 'the network lacks a clear Overview link');
}
if (!/location\.replace\('\/infographics\/des-moines-alpr\/'/.test(redirectRaw)) {
  iaHits++; fail('public-information-architecture', 'visual/index.html', 'the legacy visual route does not redirect to the canonical overview');
}
if (!iaHits) pass('public-information-architecture — overview and network are the only linked exhibit routes; legacy visual redirects');

/* ---------------------------------------------------------- metadata / SEO
   Keep the two reader-facing routes distinct while sharing the approved card. */
let metaHits = 0;
const socialImage = 'https://restoring-democracy.org/infographics/des-moines-alpr/assets/og/dsm_alpr_og.png';
const socialAlt = 'Editorial illustration of a roadside camera overlooking a city, with a network motif representing configured data-sharing relationships.';
const metaExpected = {
  'index.html': {
    title: "Where Des Moines Plate Data Can Go | Restoring Democracy's Promise",
    description: 'An interactive visual investigation of Des Moines’ plate-reader system—mobile and fixed collection, searchable vehicle-location data, and 155 configured sharing relationships across 36 states and the District of Columbia.',
    canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/'
  },
  'network/index.html': {
    title: "Explore the Des Moines Plate-Reader Network | Restoring Democracy's Promise",
    description: 'Explore 155 configured detection-sharing relationships—not actual searches or transfers—in Des Moines’ August 2026 VehicleManager export, spanning 36 states and the District of Columbia.',
    canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/network/'
  }
};
for (const [name, expected] of Object.entries(metaExpected)) {
  const src = pageRaw[name];
  const checks = [
    [`<title>${expected.title}</title>`, 'title'],
    [`<meta name="description" content="${expected.description}">`, 'meta description'],
    [`<link rel="canonical" href="${expected.canonical}">`, 'canonical URL'],
    [`<meta property="og:url" content="${expected.canonical}">`, 'Open Graph URL'],
    [`<meta property="og:title" content="${expected.title}">`, 'Open Graph title'],
    [`<meta property="og:description" content="${expected.description}">`, 'Open Graph description'],
    [`<meta property="og:image" content="${socialImage}">`, 'approved Open Graph image'],
    ['<meta property="og:image:type" content="image/png">', 'Open Graph image type'],
    ['<meta property="og:image:width" content="1200">', 'Open Graph image width'],
    ['<meta property="og:image:height" content="630">', 'Open Graph image height'],
    [`<meta property="og:image:alt" content="${socialAlt}">`, 'Open Graph image alt'],
    ['<meta property="og:type" content="website">', 'Open Graph type'],
    ['<meta name="twitter:card" content="summary_large_image">', 'Twitter large card'],
    [`<meta name="twitter:url" content="${expected.canonical}">`, 'Twitter URL'],
    [`<meta name="twitter:title" content="${expected.title}">`, 'Twitter title'],
    [`<meta name="twitter:description" content="${expected.description}">`, 'Twitter description'],
    [`<meta name="twitter:image" content="${socialImage}">`, 'Twitter image'],
    [`<meta name="twitter:image:alt" content="${socialAlt}">`, 'Twitter image alt']
  ];
  for (const [needle, label] of checks) {
    if (!src.includes(needle)) { metaHits++; fail('metadata-seo', name, `${label} is missing or stale`); }
  }
  if ((src.match(/<link rel="canonical"/g) || []).length !== 1) {
    metaHits++; fail('metadata-seo', name, 'expected exactly one canonical link');
  }
  if (!/<script type="application\/ld\+json">[\s\S]*?"@type": "WebApplication"[\s\S]*?<\/script>/.test(src)) {
    metaHits++; fail('metadata-seo', name, 'WebApplication JSON-LD is missing');
  }
  if (/\/visual\/|des-moines-alpr-og-1200x630\.jpg/.test(src.slice(0, src.indexOf('</head>')))) {
    metaHits++; fail('metadata-seo', name, 'head metadata references a deprecated route or stale social crop');
  }
}
try {
  const image = readFileSync(join(OUT, 'assets', 'og', 'dsm_alpr_og.png'));
  if (image.toString('ascii', 1, 4) !== 'PNG' || image.readUInt32BE(16) !== 1200 || image.readUInt32BE(20) !== 630) {
    metaHits++; fail('metadata-seo', 'assets/og/dsm_alpr_og.png', 'approved image is not a 1200×630 PNG');
  }
} catch {
  metaHits++; fail('metadata-seo', 'assets/og/dsm_alpr_og.png', 'approved image is missing');
}
if (!metaHits) pass('metadata-seo — route-specific titles/descriptions, production canonicals, approved 1200×630 PNG, social cards and JSON-LD');

/* ----------------------------------------------------------------- rule 11
   Publication posture. The overview and network explorer are public. The
   retained records artifact stays UNLISTED: noindex, absent from public
   navigation and absent from the sitemap. Unlisted is not private — anyone
   with the URL can still reach it, so nothing may be published there that
   could not stand being read. */
let publicationHits = 0;
for (const [name] of PUBLIC_PAGES) {
  const src = pageRaw[name];
  if (!/name="robots" content="index,follow"/.test(src)) {
    publicationHits++; fail('publication-posture', name, 'index,follow is missing');
  }
  if (/PROVISIONAL: unpublished prototype|class="draft-banner"/.test(src)) {
    publicationHits++; fail('publication-posture', name, 'prepublication marker remains on a public route');
  }
}
for (const [name] of UNLISTED_PAGES) {
  const src = pageRaw[name];
  if (!/name="robots" content="noindex,nofollow"/.test(src)) {
    publicationHits++; fail('publication-posture', name, 'the unlisted records route must remain noindex,nofollow');
  }
}
for (const [name] of PUBLIC_PAGES) {
  if (/href="\/infographics\/des-moines-alpr\/records\//.test(pageRaw[name])) {
    publicationHits++; fail('publication-posture', name, 'public navigation links to the unlisted records route');
  }
}
try {
  const sitemap = readFileSync(join(OUT, '..', '..', 'sitemap.xml'), 'utf8');
  const publicUrls = [
    'https://restoring-democracy.org/infographics/des-moines-alpr/',
    'https://restoring-democracy.org/infographics/des-moines-alpr/network/'
  ];
  for (const url of publicUrls) {
    if (sitemap.split(`<loc>${url}</loc>`).length !== 2) {
      publicationHits++; fail('publication-posture', 'sitemap.xml', `${url} must appear exactly once`);
    }
  }
  if (/https:\/\/restoring-democracy\.org\/infographics\/des-moines-alpr\/records\//.test(sitemap)) {
    publicationHits++; fail('publication-posture', 'sitemap.xml', 'the unlisted records route must stay out of the sitemap');
  }
} catch {
  publicationHits++; fail('publication-posture', 'sitemap.xml', 'the sitemap could not be read');
}
{
  const link = JSON.parse(readFileSync(join(HERE, 'content', 'copy.json'), 'utf8')).exhibit.article_link;
  if (link.enabled && !link.url) {
    publicationHits++; fail('publication-posture', 'copy.json', 'the article link is enabled with no URL');
  }
}
if (!publicationHits) pass('publication-posture — public routes indexable and listed; unlisted records route unlinked, noindex and omitted from the sitemap');

/* -------------------------------------------------------------- analytics
   All three substantive exhibit routes use the standard aggregate page-view
   counter. Records is a deliberate path-specific exception to the site's
   usual noindex exclusion; its publication posture must remain unchanged. */
let analyticsHits = 0;
for (const [name] of PAGES) {
  const src = pageRaw[name];
  const goatAttributes = src.split(GOAT_ATTRIBUTE).length - 1;
  const goatScripts = src.split(GOAT_SCRIPT).length - 1;
  if (goatAttributes !== 1 || goatScripts !== 1) {
    analyticsHits++;
    fail('analytics', name,
      `expected exactly one GoatCounter snippet; found ${goatAttributes} endpoint attribute(s) and ${goatScripts} script URL(s)`);
  }
  if (/G-QJ3L9CT4Z7|googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|\bdataLayer\b/i.test(src)) {
    analyticsHits++; fail('analytics', name, 'contains a GA4/GTM analytics reference');
  }
}
if (!/name="robots" content="noindex,nofollow"/.test(pageRaw['records/index.html'])) {
  analyticsHits++; fail('analytics', 'records/index.html', 'the analytics exception must remain noindex,nofollow');
}
if (!analyticsHits) pass('analytics — one GoatCounter page-view snippet on each exhibit route; no GA4/GTM; records remains noindex');

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
  /* The reader-facing block states that Sourcewell responded. Publishing that
     sentence without the response itself would name a responder and withhold
     what they said, so the gate holds until the approved text is set. */
  if (/Sourcewell responded/i.test(ror.body || '') && !(ror.sourcewell_statement || '').trim()) {
    gateHits++; fail('PUBLISH-GATE', 'copy.json',
      'right_of_response.body states that Sourcewell responded, but right_of_response.sourcewell_statement is empty; paste the exact response or the approved summary');
  }
  if (!copyJson.exhibit.article_link.enabled || !copyJson.exhibit.article_link.url) {
    gateHits++; fail('PUBLISH-GATE', 'copy.json', 'the article link is not set');
  }
  if (/PROVISIONAL/i.test(JSON.stringify(copyJson))) {
    gateHits++; fail('PUBLISH-GATE', 'copy.json', 'PROVISIONAL copy remains');
  }
  for (const [name] of PUBLIC_PAGES) {
    const src = pageRaw[name];
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
