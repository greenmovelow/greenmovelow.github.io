# Des Moines ALPR exhibit — "Des Moines’ Plate-Reader Expansion"

Prepublication draft. **Not published, not deployed, not merged.**
Branch: `claude/dsm-alpr-page-nine`.

Aligned to article draft **v0.4** (2026-09-11; first aligned to v0.2, 2026-09-07). The article's narrative order
controls where it conflicts with the September 2 concept deck: the exhibit now
opens on the 2021 change form, not on the council purchase.

## Routes

| Route | File | What it is |
|---|---|---|
| `/infographics/des-moines-alpr/` | `index.html` | Narrative investigation, chapters 01–11 |
| `/infographics/des-moines-alpr/network/` | `network/index.html` | Reader-controlled explorer for the Aug 2026 sharing export |
| `/infographics/des-moines-alpr/records/` | `records/index.html` | Forensic record explorer + methodology, definitions, corrections, sources |

A fourth `/methodology/` route was considered and **not** built: the material
(evidence grammar, definitions, corrections, sources, accessible tables) lives
at the bottom of the records page, which is already the canonical accessible
fallback. Splitting it would have separated the definitions from the tables
they describe.

## Build

```
node _src/build.mjs           # renders the three index.html files from data/ + content/
node _src/lint.mjs            # editorial guardrails; exits non-zero on any failure
node _src/lint.mjs --publish  # ALSO runs the publication gates (expected to fail while ROR is open)
node _src/test.mjs            # browser pass at 390 / 768 / 1440 (needs a server on :8787)
                              # set PW_CHROMIUM_PATH=/path/to/chrome to use a preinstalled browser

python _src/tools/verify_page_terms.py   # per-page term check of the 25-page clerk's file
python _src/tools/make_facsimiles.py     # facsimile crops + provenance sidecars
```

Serve locally with any static server from the repo root, e.g.
`npx http-server -p 8787 -c-1`, then open
`http://127.0.0.1:8787/infographics/des-moines-alpr/`.

`_src/node_modules/` (Playwright, test-only) and `_src/screens/` are both
gitignored. `npm test` regenerates every screenshot, so they are kept out of the
site repo's history rather than committed as 6 MB of binaries.

## How the pieces fit

```
data/                    adjudicated data — the only source of facts
  network_nodes.json       155 export rows, verbatim + mechanically derived fields
  state_counts.json        per-jurisdiction counts, recomputed
  state_tiles.json         tile cartogram positions (EDITORIAL — not geocoding)
  procurement_timeline.json dated procurement events, by chain
  chain_registry.json      Chain A / Chain B / upstream / platform
  page_composition.json    the 25 pages of the clerk's roll-call file
  parts_list.json          canonical accessible table: every part, status, receipt
  platform_summary.json    aggregates from the three Aug 2026 exports
  evidence_receipts.json   77 authored receipts
  page_term_check.json     per-page term check of the clerk's file, with method

_src/content/copy.json   ALL on-screen exhibit prose
_src/build.mjs           renders static HTML from the two above
_src/lint.mjs            editorial guardrails
_src/test.mjs            browser assertions
_src/tools/              extraction from the source .xlsx, with assertions

assets/facsimiles/       page crops of produced records + provenance sidecars
assets/exhibit.css       exhibit stylesheet (all three routes)
assets/exhibit.js        receipt drawer, council switch, document stack, modes
assets/network.js        the configuration explorer
```

**Nothing narrative is authored inside `build.mjs`.** Headline, dek, byline,
chapter copy, sidebars, caveats and the ledger all live in `copy.json`. Replace
strings there and re-run the build; the templates do not need to change.

## Regenerating the export data

`data/network_nodes.json` and `data/state_counts.json` are generated, not
hand-edited:

```
python _src/tools/extract_sharing.py "<path to VehicleManager_DataSharing_Report_08-17-2026-10-40-20-575.xlsx>" _src/tools/sharing_raw.json
python _src/tools/make_network_data.py
```

`make_network_data.py` asserts nineteen recomputed totals against the
adjudicated figures and exits non-zero on any mismatch. `_src/lint.mjs`
asserts the same totals again against the shipped JSON.

## What the guardrails enforce

`lint.mjs` fails the build on any of:

1. a banned verb, causal bridge or intent claim in rendered text
2. `"37 states"` anywhere; `"36 states"` without its `and the District of Columbia` companion
3. a guarded figure (4.5%, 386, 155, 567) without its mandatory companion sentence
4. any arrowhead, `stroke-dashoffset`, `animateMotion` or `offset-path` in any file
5. a connector present in the served HTML (the default plane-3 state must have zero)
6. a receipt trigger that does not resolve, or a receipt without a pinpoint,
   without a caveat (L2), or that never says what it does not establish (L5)
7. a name-bearing field in any shipped data file
8. an export total that no longer matches the adjudication
9. a missing skip link, uncaptioned table, unscoped `<th>`, `alt`-less image,
   missing reduced-motion handling or missing live region
10. a missing no-JS fallback (receipts, the 155-row table, all four record views)
11. a facsimile crop without a provenance sidecar, or one not declared unaltered
12. the three formulations narrowed in the article's v0.2 precision pass, and the
    superseded `$157,500` services figure
13. incomplete purchase arithmetic, or `4.5%` without the corrected `4.51`
14. a lost prepublication posture: missing `noindex`, missing banner, routes in
    the sitemap, or an article link enabled with no URL

`--publish` adds the publication gates — right of response resolved, article
linked, no PROVISIONAL copy, `noindex` and banner removed. They are **not** part
of the ordinary run, so a draft PR builds and lints cleanly while responses are
still pending.

Two regions are marked `data-lint-exempt` because they quote guarded language in
order to explain it: the corrections table and the "language this exhibit does
not use" glossary, both on the records page. Nothing else is exempt.

## The shared shell

The masthead, navigation and footer follow the current house pattern used by
`/infographics/standing-query/` and `/infographics/save-four-state-settlement/`:
the fixed `.nav-bar`, the Tailwind brand classes, and `/assets/css/styles.css`
loaded before the exhibit's own stylesheet. Everything specific to this
exhibit's evidence grammar — the tile grid, the rings, the receipt drawer, the
chain rails, the empty drawer — stays in `assets/exhibit.css` and is not
expressed in utility classes, so a Tailwind rebuild or class rename cannot
change what the exhibit asserts.

`exhibit.css` carries a small, commented compatibility block restoring the few
defaults Tailwind preflight removes that the exhibit relies on, scoped to
`#main` so nothing leaks into the shared shell.

The right-of-response block reuses the house `limit-block limit-block--ror`
markup and `id="rorBlock"`, with the same editorially-owned comment fences.

## Design decisions worth knowing

- **Colour never carries status.** Status is shape fill and line style plus a
  word; record layer is a text chip; hue encodes only chain and time plane.
- **Chain inks** are `#2f4f6f` (A) and `#a35d22` (B). Both clear 4.5:1 on the
  page background and are separated in greyscale by lightness (relative
  luminance 0.074 vs 0.154). Each also carries a distinct end-cap glyph
  (square vs round), a distinct rail style (solid vs doubled) and the chain's
  name in text, so the distinction survives greyscale and colour blindness.
- **Counterparties are open rings**, never filled dots. A filled dot reads as
  "a thing that exists here"; these are entries in a Share-With list.
- **No connector is drawn by default**, and a connector appears whole, without
  direction or motion, labelled "configured to share."
- **Rings never appear in sequence.** They render all at once or by filter, never
  by date — the export contains no chronology.
- **At 390px the tile grid is replaced**, not shrunk: a legible jurisdiction list
  leads, and the grid sits behind a disclosure inside a horizontal scroller that
  keeps its labels readable. Selecting an agency on mobile happens through the
  filtered table, whose rows open the same bottom-sheet receipt.
