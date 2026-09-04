# Analytics / Tracking Audit

Migration date: 2026-07-24

## Migration result

The sitewide migration from Google Analytics 4 to GoatCounter is complete in repository HTML. Active GA4 code, including measurement ID `G-QJ3L9CT4Z7`, Google Tag Manager analytics loaders and resource hints, `dataLayer` initialization, and `gtag()` initialization/configuration, was removed.

The audit classifies all 41 repository HTML files: 35 eligible public pages contain exactly one GoatCounter snippet, and 6 pages are deliberately excluded. No eligible page has a duplicate snippet. GoatCounter uses the browser-tested official `https://gc.zgo.at/count.js` script and `https://restoring-democracy.goatcounter.com/count` endpoint.

## Eligible public pages (35)

- `index.html`
- `about/index.html`
- `alpr-leviathan/index.html`
- `alpr-trap/index.html`
- `analytics/index.html`
- `assembly-line/index.html`
- `assembly-line-unpacked/index.html`
- `confidential_mou/index.html`
- `corrections/index.html`
- `credentialing-gap/index.html`
- `credentialing-gap-dossier/index.html`
- `cross-and-capitol/index.html`
- `dream_machine/index.html`
- `funding_flow/index.html`
- `god-machine-flowchart/index.html`
- `infographics/bird-raga-money-trail/index.html`
- `infographics/ipers-cio-performance-pay/index.html`
- `infographics/save-four-state-settlement/index.html`
- `iowa-alpr-reform/index.html`
- `iowa-doge-pension-privatize/index.html`
- `ipers-wiggins/index.html`
- `journalism/index.html`
- `leviathan-grid/index.html`
- `pincer-dataviz/index.html`
- `pincer-financial/index.html`
- `pincer-infographic/index.html`
- `privacy-policy/index.html`
- `save_america_act/index.html`
- `save_iowa/index.html`
- `security-policy/index.html`
- `shutdown-accountability/index.html`
- `shutdown-analysis/index.html`
- `team/index.html`
- `the-god-machine/index.html`
- `voting_rights_ia/index.html`

## Deliberately excluded pages (6)

- `secure-tips/index.html` — source-contact and source-intake page; no analytics.
- `resources/reference/records/status/index.html` — restricted-status page whose strict CSP intentionally sets `script-src 'none'`; no analytics and no CSP change.
- `go/save_backfill_ia/index.html` — redirect-only forwarding page; no analytics.
- `go/when-war-tests-democracy/index.html` — redirect-only forwarding page; no analytics.
- `vault.html` — operational-security/canary page; no analytics.
- `journalism/cross-and-capitol/index.html` — empty, one-byte non-content placeholder; no analytics.

## Additions since the migration

- `infographics/ipers-bonus-calculator/index.html` — eligible public page; carries one GoatCounter snippet.
- `infographics/standing-query/index.html` — eligible public page; carries one GoatCounter snippet. The exhibit's script also reports five custom interaction events through the same counter (`standing_query_start`, `standing_query_audit_complete`, `standing_query_loop_reveal`, `standing_query_complete`, `standing_query_article_click`) via `window.goatcounter.count({event: true})`. The calls are wrapped in `try/catch`, fire at most once per page load, and are a no-op when the counter is absent or blocked. No new vendor.
- `_handoff/**` — editorial handoff prototypes committed as source material. Excluded from the audit (`EXCLUDED_PREFIXES` in `scripts/audit_analytics.py`) and served with `X-Robots-Tag: noindex` via `_headers`. They are not published routes and carry no analytics.

## Exclusion principles

Analytics are excluded from:

- `secure-tips/**` and any authentication, administration, upload, submission, source-intake, confidential-source, or similarly sensitive operational route;
- `resources/reference/records/status/**` and any page whose CSP intentionally uses `script-src 'none'`;
- `go/**`, immediate redirects, forwarding-only pages, and other non-content routes;
- `vault.html`, canaries, tripwires, honeypots, decoys, and security-test pages;
- 404/error pages;
- pages marked `noindex`, `nofollow`, `noarchive`, or otherwise intentionally hidden;
- temporary test fixtures and empty placeholders.

A security-related word in a public article slug is not itself an exclusion. Ordinary public, substantive, indexable pages—including `security-policy/index.html` and `confidential_mou/index.html`—receive GoatCounter.

## Automated verification

`scripts/audit_analytics.py` recursively checks every repository HTML file against the readable route configuration near the top of the script. It confirms:

- active GA4 implementation code is absent;
- all 35 eligible pages contain exactly one GoatCounter snippet immediately before `</body>`;
- no eligible page contains a duplicate GoatCounter snippet;
- all 6 excluded pages contain no GoatCounter;
- `secure-tips/**` and `resources/reference/records/status/**` contain no analytics;
- `go/**` redirect pages and `vault.html` contain no analytics.

## CSP deployment note

Cloudflare CSP support was changed and browser-tested separately; Cloudflare configuration and repository `_headers` rules are outside this migration PR. Google domains should remain temporarily allowed in the Cloudflare CSP until the merged deployment is browser-verified. After verification confirms GoatCounter succeeds and no Google Analytics requests occur, the operator can remove the Google domains manually.
