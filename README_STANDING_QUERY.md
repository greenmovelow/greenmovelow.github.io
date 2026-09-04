# The Standing Query

**Interactive exhibit — Iowa · DIAL · SAVE · professional licensing**

Canonical URL: `https://restoring-democracy.org/infographics/standing-query/`

One deliberately composite Iowa professional-license case is followed through
the SAVE verification process. The apparent endpoint is issuance. After the
reader has experienced issuance as a completed state, the exhibit reveals that
DIAL's released procedures contemplate continued attention to
immigration-document expiration after the credential has already been issued.

This is the production integration of the editorial handoff prototype. The
prototype had already survived an adversarial editorial / UX / accessibility
pass (its review, `ADVERSARIAL_REVIEW_v0_1.md`, is the controlling authority
for the interaction and evidence contract) and the production build preserves
it. The handoff folder was internal review material; it was run against its
own check script one last time (160/160 on Chromium) and then removed from
the branch before this final pass, so nothing in production depends on it.
This exhibit covers the **professional-licensing rail only**.

---

## Files

| Path | What it is |
| --- | --- |
| `infographics/standing-query/index.html` | The page: RDP chrome (nav, hero, about section, footer, share, analytics) around the exhibit. All exhibit content is in the markup, in reading order; nothing evidentiary is injected by script. |
| `infographics/standing-query/styles.css` | The exhibit's design tokens, the measured-absence component library, and the state machine's *appearance*, driven off `data-*` attributes on `#sq`. Scoped under `.sq-band` / `.sheet`. |
| `infographics/standing-query/app.js` | The state machine, the 16,457 audit gate, the timers, focus management, the accessible mirror of the progress rail, the `ARTICLE_URL` constant and the analytics helper. Classic script; no modules, no build. |
| `scripts/test_standing_query.js` | Headless interaction + evidence-discipline suite (Playwright). Serves the repository root over local HTTP and drives the production page. |
| `README_STANDING_QUERY.md` | This file. |
| `sitemap.xml` | One `<url>` entry added. |
| `_headers` | `X-Robots-Tag: noindex` for `/_handoff/*`. Kept as a defence-in-depth convention for future handoff material; the folder itself is gone from this branch. |
| `scripts/audit_analytics.py` | `_handoff/` in the excluded prefixes, for the same reason. |
| `.gitignore` | Screenshot output folders (`_shots/`) ignored. |
| `ANALYTICS_TRACKING_AUDIT.md` | Note on the new page and the custom events. |

No existing page, stylesheet or asset was modified. The exhibit links the
site's compiled stylesheet (`/assets/css/styles.css`) for the chrome and the
local font faces, and its own `styles.css` for the experience.

## Run locally

The page must be served over HTTP (absolute `/assets/...` paths):

```bash
python3 -m http.server 8000
# http://localhost:8000/infographics/standing-query/
```

Tests (Chromium is required; Firefox and WebKit are used if installed):

```bash
npm i playwright                      # not a repository dependency; local only
node scripts/test_standing_query.js   # writes screenshots to _shots/standing-query/
python3 scripts/verify_asset_refs.py
python3 scripts/audit_sitemap.py
python3 scripts/audit_analytics.py
```


## Deploy

Netlify deploys the default branch; merging publishes the page at the canonical
URL. There is no build step for this exhibit. `npm run build:css` is not needed:
every Tailwind class the chrome uses is already in the compiled stylesheet.

---

## Editorial switches (patch these; nothing else)

**Article link.** `infographics/standing-query/app.js`, top of the file:

```js
var ARTICLE_URL = 'https://investigations.restoring-democracy.org/p/inside-iowas-save-clearinghouse-what';
```

It is set to the published investigation,
`https://investigations.restoring-democracy.org/p/inside-iowas-save-clearinghouse-what`
(supplied by the editor on Sept. 4, 2026). With it set, "Read the full
investigation →" is the primary exit in the end panel and in the About
section. If it is ever emptied, both links hide themselves and the end panel
offers Subscribe and Start over.

**Subscribe.** Both subscribe links point at the branded address
`https://investigations.restoring-democracy.org/subscribe/` (not the older
`exposed1.substack.com` address). They carry `data-subscribe-cta` and report
`standing_query_subscribe_click` through the guarded GoatCounter helper.

**Right of response.** `infographics/standing-query/index.html`, the block
between `<!-- RIGHT OF RESPONSE -->` and `<!-- END RIGHT OF RESPONSE -->`
(`#rorBlock`). It has no state-machine or layout dependency. Current text:

> DIAL and USCIS were sent detailed questions on Aug. 31, 2026, with a response
> requested by Sept. 4. USCIS responded on Sept. 4; its answers are reflected in
> this exhibit. DIAL's response was still pending when this version was
> published. This exhibit will be updated if DIAL responds.

Rules the suite enforces: never "declined to comment" without an affirmative
decline; never "refused to respond" for silence. If DIAL responds, integrate only
the factual answer supplied by the editor. Do not paraphrase an agency email
independently.

**The "What USCIS confirmed" block** (`#rorBlock`'s sibling in the end panel)
carries the Sept. 4 confirmations verbatim from the fact lock. Edit only on the
editor's instruction.

---

## What changed from the handoff prototype, and why

### Site integration (chrome only, interaction untouched)

- Current RDP nav, compact exhibit hero, "About this exhibit" section, footer,
  share button, GoatCounter snippet, favicon/manifest links, canonical, Open
  Graph and Twitter metadata, JSON-LD (`WebApplication`, organisation author,
  no invented dates). OG/Twitter image is the approved
  `/assets/og/standing_query_og.png` (1200×630) with the supplied alt text.
- Local RDP faces replace the prototype's placeholder system fonts: Inter (UI),
  Lora (paper/document), JetBrains Mono (small-caps labels, rail labels).
- The `PROTOTYPE` banner is gone; its content already lives in the composite sheet.
- The sheets moved inside the ink band so the no-JS document reads as one piece.

### Deliberate deviations

1. **Action bar is `position: sticky` inside the exhibit, not `fixed`.** On the
   site the exhibit is followed by an about section and the footer; a fixed bar
   would ride over them. The false-ending exit (translate + fade) is unchanged.
   Because the site stylesheet sets `html,body{overflow-x:hidden}` (which makes
   `<body>` a scroll container and unpins sticky elements in Chromium), the page
   sets `html,body{overflow-x:clip}` inside `@supports (overflow: clip)`.
   Engines without `clip` fall back to the prototype's fixed bar and padding.
2. **Boot-time loop flash fixed.** Both rail paths carry a `stroke-dashoffset`
   transition; the prototype applied the initial dash state through that
   transition, so on every cold load the first arc of the loop was visible inside
   the clip band for ~900 ms while retracting. The prototype's own screenshot
   shows it. `buildRail()` now sets the initial state with transitions
   suppressed. The suite samples the path four times during the first second.
3. **Rail label for station 5 reads `16,457 transactions`** (was a bare
   `16,457`), and the `<ol>` mirror reads "16,457 initial verification
   transactions". The number never appears without its unit.
4. **Dates in the exhibit use the site's AP style** (`Aug. 12, 2026`, not
   `12 August 2026`). Two exceptions: "December 2025" and "December through
   June" were already month-only.
5. **A second, page-level copy of the limitation** ("No record produced so far
   shows any Iowa professional license denied, suspended, or revoked because
   of a SAVE result.") sits in the about section under the heading "Evidence
   limit", always visible in every state and deliberately quieter than the
   in-exhibit copy. The station-7 copy is unchanged, and the same complete
   sentence now sits inside the revocation-letter modal. The suite asserts the
   lead appears at least three times and that no copy is collapsible.
6. **Custom analytics events** on the site-standard GoatCounter counter only
   (`standing_query_start`, `_audit_complete`, `_loop_reveal`, `_complete`,
   `_article_click`). Called after transitions, once per page load, in
   `try/catch`; no-op when the counter is absent. No new vendor.

### Browser-review patch (second push to PR #205)

7. **Positioning after the reader's own taps.** Entering s1, s2 and s3 brings
   the card under the site nav; s7 and s8 bring their panel under the nav;
   Restart returns to the top of the interactive. The scroll is smooth, or an
   instant jump under `prefers-reduced-motion`. Nothing scrolls during the
   auto-advancing s3→s6 run: the s3 positioning happens at the gate tap itself,
   so the stamp lands on a card that is on screen. Back landing on those states
   positions the same way. Focus is never moved onto revealed explanatory
   content.
8. **Immediate Close → Continue.** Diagnosed on touch input at 1440×900 with the
   letter sheet open and the page scrolled behind it: closing returned focus to
   the trigger, the browser smooth-scrolled the off-screen trigger into view
   (the site's `scroll-smooth`), the sticky bar moved during the glide, and an
   immediate tap landed on the bar's padding. `closeSheet()` now returns focus
   with `preventScroll` and jumps instantly only when the opener is entirely
   off-screen. The closed receipt and backdrop are `display:none` with
   `pointer-events:none` in the same task. The suite reproduces the case on
   touch at 390×844 and 1440×900, s1 and s7, scrolled and unscrolled, and
   asserts one tap advances.
9. **Accessible progress mirror.** The `<ol>` lists six licensing steps only.
   The status-expiration follow-up is never a seventh item: after the loop is
   revealed it is appended in a separate visually-hidden paragraph as
   "Post-issuance follow-up … a contemplated recheck, documented procedure, not
   an observed event." The summary never says "step 7".
10. **Receipt sheets are dialogs.** "Additional verification" and "The paragraph
    DIAL sends" carry `role="dialog"`, `aria-modal`, a titled heading, the
    shared backdrop, Escape, focus trap and focus return, and the same
    constrained centred width as the other sheets at ≥1024px. Without JS they
    still render inline.
11. **Mobile whitespace.** The full-viewport `min-height` on the exhibit is
    gone: Begin and the later primary actions follow their content. The one
    exception is the false ending: during s3–s5, while the bar is gone, the
    exhibit holds the fold so the section below does not intrude on
    "Application complete."
12. **Unit-safe framing.** "this case is one of / 16,457" is gone from the
    kicker, the live region and the mirror. The count is framed as "The reports
    record 16,457 initial verification transactions." One composite case is not
    presented as one transaction.
13. **Editor-supplied sentence** replaces "Seven of the eleven months…":
    "Seven monthly reports—December through June—were independently pulled
    twice, on July 13 and Aug. 12, 2026. Every month matches."

### Final production polish (third push to PR #205)

14. **Fixed-nav safe landing.** Every user-driven positioning (s1, s2, s3,
    s7, s8, Back, Restart) now lands the exhibit top under the fixed site nav,
    measured from the nav's rendered height plus a 12px gap, so the Back /
    Composite case / Restart row is never occluded and the card sits directly
    beneath it. The previous anchor (the card at a fixed 72px) put the header
    36px above the viewport on phones. Reduced motion still jumps; the
    auto-advancing s3→s6 run still never scrolls.
15. **Action bar.** The sticky bar now has a solid ink ground and a top rule
    rather than a gradient, and the panels reserve 16px above it. The bar is
    in flow at the exhibit's end, so nothing is ever trapped beneath it; the
    suite scrolls to the exhibit end in six states at seven widths and asserts
    no text intersects the bar. While pinned mid-scroll the bar covers what
    any pinned control covers, and everything beneath it scrolls clear. No
    blanket `min-height` was added to ordinary states; s3–s6 keep the
    full-viewport hold for the false ending and the reveal.
16. **Rail labels.** SVG text scaled with the rail (≈9px on phones, ≈15px on
    desktop). The four labels are now HTML spans positioned in the rail's own
    coordinate space (left as a percentage of the width, vertical offset as
    percentage padding, which resolves against width) at a fixed 11.5px
    (11px below 360px, 12px at ≥700px), JetBrains Mono, uppercase, muted ink.
    The clip band grew from 17% to 19% of the width to hold one label row
    under the line; the loop station stays clipped until the reveal. Decorative
    (`aria-hidden`); the `<ol>` mirror is unchanged.
17. **Progressive rail disclosure.** Response appears at s1, 16,457
    transactions at s2, Issued at s4, Status expires only once the loop is
    drawing/drawn. Presence and absence are asserted at every width.
18. **Response copy** (exact): heading "SAVE returns a verification
    response." body "The licensing agency submits the applicant’s information
    to SAVE. SAVE checks it against federal immigration records and returns a
    verification response. Some checks resolve immediately. Others require
    additional verification." Live region: "Response. SAVE returns a
    verification response. Some checks resolve immediately; others require
    additional verification."
19. **Gate button.** The primary reads "Continue" at every count and is
    disabled until 3 of 3. The count lives in a separate `role="status"`
    helper line under the prompt: "0 of 3 resolved" … "3 of 3 resolved".
20. **Exit hierarchy at s8.** The sticky bar is withdrawn; the end panel
    offers, in order, Read the full investigation → (primary, hidden while
    `ARTICLE_URL` is empty), Subscribe to follow the SAVE investigation
    (secondary, outlined), Start over (tertiary text control, 44px tall).
21. **About section.** Read the full investigation → (hidden while empty) and
    Subscribe side by side on desktop, stacked on mobile, 44px+ targets;
    Corrections policy demoted to a quiet text link.
22. **"What USCIS confirmed"** is a five-item list under an adjacent
    "In its Sept. 4, 2026 response to RDP's questions, USCIS confirmed:" line.
    No new claims.
23. **Reveal copy**: "The question stays open." (was "The file stays open.");
    live region "The question stays open. The path returns to a
    status-expiration check."
24. **Composite affordance**: a small ⓘ after "Composite case", a brighter
    dotted rule, and a hover/focus tint. Not a button redesign.
25. **Handoff material removed** from the branch (see top of file).

### Exact copy changed because of the Sept. 4 USCIS response

| Where | Prototype (obsolete) | Production |
| --- | --- | --- |
| Count scope line | "…from December 2025 through the report DHS prepared on 12 August 2026" | "…from December 2025 through Aug. 11, 2026 — the day before DHS prepared the report Iowa released" |
| Scope panel, "August is partial" | "The report covers August 2026 and was prepared 12 August. It does not print a data cutoff." | "The report was prepared Aug. 12, 2026. USCIS confirmed that a month-end report generated mid-month contains data through the day before it is run, so this report covers transactions through Aug. 11." |
| Scope panel, "One benefit code" | (no USCIS statement) | adds "USCIS told RDP that “Professional License” is a standard SAVE benefit category used by many registered user agencies." |
| Scope panel, third step | "These reports carry no third-step column…" | adds "USCIS told RDP that third-step verification refers to manual review and retains the same benefit type as the original case." |
| Additional-verification receipt, null slot | "third-step verifications — these reports carry no third-step column. Not reported in these records." | "third-step verifications — manual review, USCIS says, under the same benefit type as the original case. These reports carry no third-step column. Not reported in these records." |
| People sheet | "RDP asked USCIS whether one person can generate more than one initial verification… That question is unanswered, and no produced record settles it either way." | "USCIS told RDP that an initial verification is one transaction, and that an agency can submit another transaction for the same person. Nothing in the reports maps the transactions to unique applicants." |
| Transactions sheet | (no USCIS statement) | adds "USCIS confirmed that each initial verification is one transaction." and "USCIS did not answer whether testing, training, development or other non-production activity can appear in these benefit-code reports. That question is open." |
| End panel | "End of prototype. This covered stations 4 through 7 of 8." | "End of the sequence. This exhibit follows the professional-licensing rail only." plus a "What USCIS confirmed" block (one transaction; resubmission for the same person; standard benefit category; Dec. 23, 2025 MOA remains in effect; DIAL continues to retain SAVE access). |
| Right of response | "This build carries no response because none had been received when it was made…" | see **Editorial switches** above. |

Nothing else in the evidentiary copy was changed. No claim was added from
outside research. The open non-production question (item 12 of the fact lock)
is stated as open, not answered.

### Not changed on purpose

- The composite card: DIAL's literal `Board of "enter board name"`, no dates,
  no numbers, no name, no photo, no seal, no signature; marked composite.
- The evidence grammar (fact bar / open rule / null slot / sworn slip / partial
  edge / unresolved trace) and the ink-grey ISSUED stamp. `--accent` remains
  defined and unused.
- The state sequence s0…s8, the timed beats (s3 400 ms, s4 1100 ms, s5 1900 ms),
  the reduced-motion structural false ending ("Application complete." +
  "Close"), the inline scope delivery without focus transfer, the always-visible
  station-7 limitation, the two-branch template statement and the
  "DO NOT USE THIS YET" marking.
- `ARTICLE_URL` is now set to the published story; the CTAs show.

---

## Test results (this build)

`node scripts/test_standing_query.js` — **699/699 passed, Chromium only.**

Engines: Chromium 141 (Playwright build). Firefox and WebKit could not be
installed in the build environment (browser downloads are blocked by the
network policy; a fresh install attempt in this pass failed the same way), so
the cross-engine leg ran on Chromium alone. The handoff prototype's own check
script passed 160/160 on Chromium immediately before the folder was removed
(the review's 170 included the Firefox and WebKit engine checks).

**Playwright's WebKit is not iOS Safari.** Nothing here licenses "tested on
iPhone". The Netlify deploy preview could not be opened from the build
environment (outbound requests to the preview host are blocked), so the
"walk the preview in Chrome as a human" step remains for the editor.

Viewports swept at s0, s2, s6, s7: 320×568, 375×667, 390×844, 430×932,
768×1024, 1024×768, 1440×900 — horizontal overflow, rail-label collision,
limitation trapped under the bar, pre-reveal telegraph, rail actually rendered,
sticky bar pinned while the exhibit extends past the viewport, bar not covering
the footer.

Modes: normal sequence · rapid interaction/abuse · keyboard only · reduced
motion · JavaScript disabled · cold first paint (app.js blocked) · touch input
for the close→continue regression.

Presence **and absence** guards, among others: ISSUED absent at boot, s1, s2, s3;
loop absent (attribute, path, station, label, reveal copy) until s6 and again
after back/reset; future rail band not visible before reveal; expiry row absent
at the completed beat; composite card free of dates, numbers, names, images;
limitation visible in every state and never collapsible, and present verbatim
inside the letter modal; gate not bypassable by 12 forced taps or 12 Enter
presses; no `16,555`, no `Board of Nursing`, no `clearinghouse director`, no
`Secretary of State`, no obsolete "through Aug. 12" / "does not print a data
cutoff" wording, no "unanswered", no "USCIS did not respond", no "declined to
comment", no "refused to respond", no "is one of 16,457", no "step 7 of";
`ARTICLE_URL` never rendered as text; only `gc.zgo.at/count.js` leaves the
origin; no storage.

Added in the browser-review patch: positioning on s1/s2/s3/s7/s8/Restart at
390×844 and 1440×900 with a programmatic-scroll counter proving no scroll from
s3 through s6; the stamp on screen when ISSUED lands after the reader scrolled
into the scope; a clean fold at s4–s6 on 390×844; instant positioning under
reduced motion; the close→continue regression on touch (s1 and s7, scrolled and
unscrolled, both sizes) with a synchronous non-hit-testable check; six-step
mirror at s0/s1/s2/s4/s5, follow-up appended at s6, marked current at s7,
withdrawn on reset; dialog semantics, backdrop, width, focus trap, backdrop
click, Escape and focus return for both receipt sheets.

Added in the final polish pass: fixed-nav safe landing (`.sq-header` below
the nav bottom plus a gap) after s1, s2, s7, s8, Back and Restart at 320×568,
390×844, 1024×768 and 1440×900, plus the s3 landing with the stamp on screen
(at 320×568 the header yields by the overflow and stays at least partly
visible); action-bar collision at the exhibit end in six states at seven
widths, and the bar's in-flow position; rail label size (≥11px, box ≥13.5px),
overlap, dot collision, clipping and overflow; progressive label disclosure by
state, including Issued absent at s3 and Status expires absent until the
reveal; gate button always "Continue" with the separate helper count; the
exact Response copy and live wording; s8 exit hierarchy, Subscribe href,
article CTA hidden/revealed, subscribe event; five-point USCIS list; sheets on
360×480, 360×568 and 390×844 (title reachable on open, body scrolls, Close
reachable, Escape and focus return); a click-driven screenshot matrix at eight
widths from 320×568 to 1534×881 with overflow and hidden-control checks.

Repository checks: `verify_asset_refs.py`, `audit_sitemap.py`,
`audit_analytics.py` — all pass.

Screenshots inspected by eye in this pass: the matrix frames at 320×568,
360×640, 375×812, 390×844, 768×1024, 1024×768, 1440×900 and 1534×881 for s0,
s1, s2 unresolved, s2 resolved, s4 ISSUED, s6 loop, s7 and s8, with attention
to the fixed nav, the sticky bar, rail readability, whitespace, the CTA
hierarchy, horizontal overflow and hidden controls.

---

## Human tests — REQUIRED before "ready for final art"

Automated success does not authorise final art. None of the following has been
performed, and no result below is to be assumed.

### 1. One naïve reader who has never seen the concept

Observe without prompting. Record verbatim.

- [ ] Did "Application complete." genuinely feel like an ending? (Did they put
      the phone down, scroll to the about section, or reach for the next thing?)
- [ ] After finishing, can they state — unprompted — that 16,457 counts
      **transactions**, not people?
- [ ] Can they state — unprompted — that **no produced record establishes an
      actual revocation**?
- [ ] Did the three-tap gate educate before it annoyed? Note any abandonment at
      the 16,457 station.
- [ ] Did the open measuring rule read as "the records cannot answer this", or
      as a redaction?
- [ ] Did anyone think they had seen a real person's case?

If readers cannot state that no revocation is documented, station 7 needs
rebalancing before art, not after.

### 2. Real iPhone Safari at approximately 390×844

- [ ] `svh` viewport, safe-area insets, the sticky action bar over the home
      indicator, momentum scrolling under the sheets, the hold timings.
- [ ] Reduced motion on (Settings → Accessibility → Motion): the structural
      false ending and "Close".

### 3. Real Android Chrome

- [ ] Same checklist as iPhone, plus the address-bar collapse and the tap-anywhere
      skip during the hold.

### 4. One actual screen-reader pass (VoiceOver or NVDA)

- [ ] The rail's `<ol>` mirror and the SVG summary.
- [ ] Live-region cadence during the auto-advance (s3 → s6): does "License
      issued. Application complete." land as an ending, and does "The file
      stays open." land as a reversal?
- [ ] Chip resolution announcements: the probe found sub-second gaps where a
      `polite` update lands as focus enters a dialog. Confirm nothing is dropped.
- [ ] Sheet focus trap, `Escape`, and focus return to the opener.

### Editorial, before publication

- [x] `ARTICLE_URL` set (Sept. 4, 2026).
- [ ] Right-of-response block resolved with the editor's exact wording.
