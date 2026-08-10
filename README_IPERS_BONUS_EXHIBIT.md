# IPERS Hypothetical Incentive-Compensation Calculator

**Interactive exhibit — "How IPERS's Bonus Formula Moves"**

A reader-facing calculator that lets you move the inputs in IPERS's published
FY2025 incentive-compensation formula and watch a hypothetical award change.

It is an explanatory journalism exhibit. It models what the published formula
permits on paper. It does **not** reconstruct, estimate, or establish how any
actual award was calculated.

---

## Files created

| Path | What it is |
| --- | --- |
| `infographics/ipers-bonus-calculator/index.html` | The exhibit: markup, styles, and UI script. Self-contained apart from `engine.js` and the site's local fonts. |
| `infographics/ipers-bonus-calculator/engine.js` | The calculation engine and the plan constants. Pure functions, no DOM, no dependencies. Loaded by the page in the browser and by the test runner in Node. |
| `scripts/test_ipers_incentive_engine.js` | Verification tests for the engine, plus static checks on the page's source language. |
| `README_IPERS_BONUS_EXHIBIT.md` | This file. |
| `sitemap.xml` | One `<url>` entry added for the new page. |

No existing page, stylesheet, or asset was modified.

---

## How to run locally

The exhibit is static. Any static server works; it must be served over HTTP
rather than opened as a `file://` URL, because `engine.js` is loaded as a
separate script and the fonts are referenced by absolute path.

```bash
# from the repository root
python3 -m http.server 8000
# then open http://localhost:8000/infographics/ipers-bonus-calculator/
```

Run the tests:

```bash
node scripts/test_ipers_incentive_engine.js
python3 scripts/verify_asset_refs.py
```

The test runner exits non-zero if any case fails.

## How to deploy

The repository is served by GitHub Pages from the default branch. Merging the
branch publishes the page at:

```
https://restoring-democracy.org/infographics/ipers-bonus-calculator/
```

There is no build step. Tailwind's `npm run build:css` is unrelated to this
exhibit — the page ships its own inline stylesheet and does not link
`assets/css/styles.css`.

---

## The formula, as implemented

Every value below comes from the IPERS Investment Team Incentive Compensation
Plan for FY2025, produced to RDP under Iowa Code chapter 22 and reported in
[*The Formula Behind the $25,000: What Iowa's Next Governor
Inherits*](https://investigations.restoring-democracy.org/p/the-formula-behind-the-25000-what)
(Aug. 9, 2026).

### Constants

| Input | Value | Source |
| --- | --- | --- |
| CIO 2025 salary | $300,802 | State payroll record produced by Iowa DAS |
| Maximum incentive (CIO) | 50% of base salary | FY2025 plan |
| Individual-performance weight (CIO) | 20% | FY2025 plan |
| Public-market weight (CIO) | 40% | FY2025 plan |
| Private-market weight (CIO) | 40% | FY2025 plan |
| "Meets Expectations" | 15 basis points | Footnote 1 of the plan |
| "Exceeds Expectations" | 20 basis points | Footnote 1 of the plan |
| Below "meets" | Not eligible | Plan text |
| Market goal | 20 basis points of excess return | Plan text |
| Payout schedule | 20 printed rungs, 0.01% → 5% … 0.20% → 100% | Plan payout schedule |
| Per-person ceiling, FY2025 | $25,000 | Plan; assigned by the chief executive through the budget process |

### Steps

1. `getIndividualBasisPoints(rating)` — 15 bp, 20 bp, or `null` (not eligible).
2. `calculateWeightedIndividualComponent` / `...Public...` / `...Private...` —
   each component's basis points multiplied by its weight.
3. `calculateBlendedResult` — the three weighted contributions summed into a
   single **total excess**, in basis points.
4. `getMarketPayoutFactor(totalExcessBp)` — the published schedule read against
   that total, as discrete rungs (see below).
5. `calculateMaximumIncentive(salary, maxPct)` — the maximum award.
6. `calculateRawAward(maximumIncentive, payoutFactor)` — the arithmetic result.
7. `applyEligibility(rating, award)` — zero if the rating is below "meets".
8. `applyDollarCap(award, cap)` — constrained by the $25,000 ceiling.

---

## The plans' own worked example — and what it settles

The plans contain a worked example. It is the single most useful piece of
evidence in the documents, because it pins down two things the payout table
alone leaves open. The same example, with the same figures, appears in **all
three plans IPERS produced** — FY2023/4, FY2024 and FY2025.

```
Employee                Senior RIO - A          Tenure  > 3 Years
Weights                 Individual 20%  ·  Public 60%  ·  Private 20%
Components              Individual 0.15%  ·  Public 0.00%  ·  Private 0.12%

TOTAL EXCESS            0.054%
AWARD (payout scale)    25%

Annual base salary      $170,000
Max salary multiplier   25%          ->  maximum incentive $42,500
Calculated bonus        25% × $42,500 = $10,625
Budget limit            $25,000
FINAL AWARD             $10,625
```

**What it settles, first:** the components are weighted and summed into one
total excess *before* the payout scale is consulted. 0.15 × 20% + 0.00 × 60% +
0.12 × 20% = 0.054%. The alternative reading — read the scale per component,
then weight the resulting factors — does not reproduce the printed total.

**What it settles, second:** the payout scale is a lookup table of discrete
rungs, not a continuous line. A total excess of 0.054% is reported as a **25%**
award, which is the 0.05% rung. Continuous interpolation (5.4 basis points × 5
percentage points) would give 27%.

This example is the keystone test in the suite. It is asserted against the
values printed in the plans, not against whatever the engine happens to produce.

### Between the printed rungs

**Exhibit implementation:** between printed payout rungs, the calculator uses
the **lower published rung**, consistent with IPERS's worked example in which
0.054% maps to the 0.05% / 25% rung.

That example recurs unchanged across the FY2023/4, FY2024 and FY2025 plans, so
the treatment is consistent in every version IPERS produced rather than resting
on a single document. It still does not amount to a stated rule: none of the
three separately states a general rounding or flooring convention, and because
they repeat the same figures rather than supplying different intermediate
values, the repetition corroborates consistency without independently
establishing a general rule. The lower-rung reading therefore remains a
convention derived from that example rather than one IPERS expressly published.
It is labelled as such in the exhibit's methodology drawer, and the "show the
math" panel says so explicitly whenever a total lands between rungs.

The engine does **not** compute `payoutFactor = basisPoints × 0.05` for
arbitrary fractional totals. Doing so would contradict the plans' own example.

A visible consequence, and an honest one: small amounts of market excess often
do not move the award at all, because the total has to cross a whole printed
rung before the payout factor changes. The exhibit states this rather than
smoothing it away.

### Worked example — the 2025 CIO preset

**"Meets Expectations", both market components exactly matching their benchmarks**

```
individual rating          15 bp
weighted contribution      15 bp x 20%          =   3 bp
public-market excess       0.00%  ->  0 bp x 40% =   0 bp
private-market excess      0.00%  ->  0 bp x 40% =   0 bp
total excess                                        3 bp   (0.03%)
payout schedule rung       0.03%                ->  15%
maximum incentive          50% of $300,802      = $150,401
calculated award           15% x $150,401       =  $22,560   ($22,560.15)
payment ceiling                                    $25,000
final payable                                      $22,560
```

**"Exceeds Expectations", same assumption**

```
individual rating          20 bp
weighted contribution      20 bp x 20%          =   4 bp
total excess                                        4 bp   (0.04%)
payout schedule rung       0.04%                ->  20%
calculated award           20% x $150,401       =  $30,080   ($30,080.20)
payment ceiling                                    $25,000
FINAL PAYABLE                                      $25,000
```

Both totals land exactly on printed rungs, so the correction to the schedule
does not change either figure.

### Rounding

Arithmetic is carried at full precision; dollars are rounded to the nearest
dollar for display only. The ceiling comparison uses the unrounded value.
$22,560.15 is 90.24% of $25,000, displayed as "90% of the $25,000 ceiling" —
the same rounding the article uses.

Weighting produces floating-point artefacts (15 × 0.2 = 3.0000000000000004), so
totals are normalised to six decimal places before any rung lookup. Without that
step a total could fall onto the rung below through arithmetic noise alone.

---

## What the market controls represent

The public- and private-market sliders represent the market-excess component
**after** any applicable multi-year or tenure calculation — the figure that
enters the weighting. The exhibit does not reconstruct the plan's multi-year
tenure layer.

Each slider runs from 0.00% to 0.20%, the plan's stated goal, in whole
basis-point steps. Every position therefore lands on a printed rung of the
schedule. The plan's ">0.20% pays what 0.20% pays" applies to the total-excess
lookup, which the engine implements and the tests pin; with weights that sum to
100% and components at or below the goal, the total cannot exceed 0.20% anyway.

Component readouts report what each component **contributes to the total
excess**, not a payout factor of its own. Components do not have their own
payout factors — the schedule is read once, against the total.

### Negative excess

The plans' worked example contains negative annual excess returns: public-market
years of +0.10%, −0.05% and −0.10%, and private-market years of +0.30%, −0.10%
and +0.20%. Negative annual returns are plainly contemplated by the plan, and
the exhibit does not claim otherwise.

What the produced plan does **not** establish is how a negative *total* excess
would be read against a schedule whose lowest printed rung is 0.01%. The
controls therefore begin at 0.00% — the point at which the applicable investment
component exactly matches its benchmark — and `getMarketPayoutFactor` throws on
a negative total rather than extrapolating the schedule downward or silently
flooring the result at zero.

### Private markets are not private equity

Private equity is one private-market asset class. It sat inside the FY2024
private-market excess calculation and is excluded from the FY2025 one.

| | FY2024 | FY2025 |
| --- | --- | --- |
| Private Equity | 20% (Russell 3000 + 300 bp) | **excluded** |
| Private Credit | 40% (S&P/LSTA Leveraged Loan + 100 bp) | 50% |
| Private Real Assets | 40% (NCREIF ODCE Net) | 50% |

The FY2025 plan states: "The Private Equity portfolio for IPERS are not included
in excess considerations."

The supported statement is that **IPERS removed private equity from the
incentive plan's private-market excess calculation for FY2025** — not that IPERS
removed private equity, or stopped investing in it. The exhibit says so on the
private-market control itself, so a reader never has to open the methodology to
avoid the misreading. It does not speculate about why the change was made;
private-equity performance reported after the FY2025 incentive period does not
establish a reason.

The test suite includes static checks that fail if this language regresses.

### Why only the CIO is a named preset

The FY2025 plan publishes the component weights for each listed row:

| Row | Individual | Public | Private |
| --- | --- | --- | --- |
| Chief Investment Officer | 20% | 40% | 40% |
| Head of Strategy | 20% | 60% | 20% |
| Senior RIO | 20% | 60% | 20% |
| Senior RIO | 20% | 20% | 60% |
| Senior RIO | 20% | 40% | 40% |
| Retirement Investment Officer | 20% | 20% | 60% |
| Retirement Investment Officer | 20% | 60% | 20% |
| Retirement Investment Officer | 20% | 60% | 20% |
| Executive Officer 2 | 50% | 25% | 25% |

Several employees share the same job classification while carrying different
public/private allocations. Because the produced plan does not give a
reader-safe one-to-one mapping from a generic title to every row, the exhibit
uses only the Chief Investment Officer as a named preset. The weights are
**published**, not absent — the rows are listed in the advanced drawer as
documentary information, and any of them can be entered by hand.

Published maximum-incentive percentages by position: 50% (Chief Investment
Officer), 50% (Head of Strategy), 30% (senior investment officers), 20% (other
listed investment-officer and Executive Officer 2 classifications).

---

## The frozen result pane

On a phone the full result card sits above the controls, so a reader who scrolls
down to the personnel lever would otherwise have to scroll back up to see what
changed. That defeats the point of an interactive explainer.

The fix is an **Excel-style freeze pane**. A compact result sits at the top of a
bounded `.workbench` container that holds every control, and is
`position: sticky; top: 0`. It pins itself above whatever the reader is
adjusting and releases naturally once the controls end — a freeze pane while
editing cells, not a permanent site header.

```
<div class="workbench">
    <div class="freeze-pane"> live figure + compact gauge </div>
    1 — Personnel rating
    2 — Public-market excess
    3 — Private-market excess
    Show the math
    Advanced: change the hypothetical employee
</div>          <-- pane releases here; Threshold Explorer and methodology follow
```

Why sticky rather than a fixed overlay: a sticky element stays in normal
document flow, so it cannot sit on top of a control the reader is using. The
earlier implementation was a `position: fixed` bar revealed by an
IntersectionObserver once the headline figure scrolled away; that produced a
visible hand-off between two result displays and risked covering the controls.
Both the observer and the fixed bar are gone — there is no scroll-state
JavaScript left in the exhibit.

One caveat worth recording: `overflow-x: hidden` on `body` would break
`position: sticky` for descendants, so the page uses `overflow-x: clip`
instead. A test asserts this, because reintroducing `hidden` would silently
unpin the pane.

The pane mirrors the full result card from the same calculated object — no
second calculation, no second live region. It carries a compact gauge with the
$25,000 ceiling marked, so the reader watches the amount move against the
ceiling rather than just watching a number change.

States, all verified in the browser at 390×844:

| State | Rendering | Height |
| --- | --- | --- |
| Uncapped | `Hypothetical award · $22,560 · 90% of $25,000 cap`, fill stopping short of the ceiling tick | 73 px |
| Capped | `Calculated $30,080` beside `Payable $25,000 · Cap applies`, gauge visibly crossing the ceiling into hatched overflow | 83 px |
| Ineligible | `Hypothetical award · $0 · Not eligible`, empty gauge | 73 px |
| Invalid weights | `Result unavailable · Weights must total 100%`, gauge dimmed and empty | 65 px |

The capped state keeps **both** numbers on screen. The explanatory point is that
the calculation crossed the ceiling, so showing only $25,000 would hide the
story. The invalid state shows no gauge fill at all rather than a misleading
bar.

The compact gauge is `aria-hidden`: every value it encodes is stated in the text
beside it, so it carries no meaning of its own and adds nothing for a screen
reader to repeat.

## URL scenario parameters

Every input is representable in the query string, so a specific hypothetical can
be linked. Nothing is sent anywhere; the exhibit runs entirely in the browser.

```
/infographics/ipers-bonus-calculator/?salary=300802&rating=exceeds&public=0&private=0
```

| Parameter | Accepts | Notes |
| --- | --- | --- |
| `salary` | 75000–500000 | Clamped to range; rounded to whole dollars |
| `rating` | `fails`, `meets`, `exceeds` | Anything else is ignored |
| `public` | percentage points, e.g. `0`, `0.04`, `0.2` | Clamped to the plan's 0–0.20% goal range |
| `private` | percentage points | Same as `public` |
| `max` | 10–50 | Maximum incentive as a percent of base salary |
| `wi` | 0–100 | Individual-performance weight, percent |
| `wpub` | 0–100 | Public-market weight, percent |
| `wpriv` | 0–100 | Private-market weight, percent |

Omitted parameters fall back to the 2025 CIO preset. If the three weights do not
total 100, the exhibit shows an inline warning and withholds the result rather
than displaying a figure the formula does not support.

The **Copy this scenario** button in the advanced drawer writes the canonical URL
for the current inputs to the clipboard and updates the address bar via
`history.replaceState`. If the Clipboard API is unavailable it falls back to a
prompt containing the link.

---

## Where to edit the editorial content

**Title, deck, and the methodological line** — top of `<main>` in
`index.html`, in the `<section class="hero">` block. The `<title>`, the
`og:`/`twitter:` meta tags, and the JSON-LD block near the top of `<head>` carry
the same wording and should be changed together.

**Source links** — two constants at the top of the page script in `index.html`,
under `EDITORIAL CONFIGURATION`:

```js
var ARTICLE_URL = 'https://investigations.restoring-democracy.org/p/the-formula-behind-the-25000-what';
var PLAN_DOCUMENT_URL = null;
```

- `ARTICLE_URL` drives the "Read the Investigation" button, and is mirrored in
  the static `href` on `#story-link` so the button still works if the script
  fails to load. Change both together.
- `PLAN_DOCUMENT_URL` is optional. Leave it `null` and no "View the Plan" button
  renders. Set it to a path such as
  `/assets/docs/ipers/ipers-incentive-plan-fy2025.pdf` (or an image crop of the
  plan) and the button appears next to "Read the Investigation". The exhibit
  never depends on that asset.

**Methodology and receipts** — the `How this is calculated` drawer near the
bottom of `index.html`. The payout-schedule grid, the published weight rows and
the maximum-incentive table are rendered from `engine.js` data, so they cannot
drift out of step with the calculation.

**Plan constants** — `PLAN`, `PAYOUT_SCHEDULE`, `WORKED_EXAMPLE`,
`PUBLISHED_WEIGHT_ROWS` and `PRIVATE_MARKET_COMPOSITION` at the top of
`engine.js`. Changing a value there changes the calculator, the "show the math"
panel, the methodology drawer, the threshold explorer, and the tests together.

---

## Verification

`node scripts/test_ipers_incentive_engine.js` — **195 assertions, all passing.**

| Case | Inputs | Expected raw | Expected payable | Result |
| --- | --- | --- | --- | --- |
| Keystone | IPERS worked example, 0.054% total excess | 25% → $10,625 | $10,625 | 25% / $10,625 |
| A | CIO, Meets, zero excess | ≈ $22,560 | ≈ $22,560 | $22,560.15 / $22,560.15 |
| B | CIO, Exceeds, zero excess | ≈ $30,080 | $25,000 | $30,080.20 / $25,000 |
| C | $250,000 salary, Exceeds, zero excess | $25,000 | $25,000 | $25,000 / $25,000 |
| D | Fails to Meet | Not eligible | $0 | Not eligible / $0 |

The suite also pins **all twenty** printed rungs individually (0.01% through
0.20%), the above-goal plateau, the sub-rung floor, between-rung behaviour
including the exact worked-example case, floating-point normalisation, cap
crossing, an award exactly equal to the cap, one dollar either side of the cap
threshold, weight validation, every published weight row summing to 100%, the
repeated-classification evidence behind the preset decision, the FY2024/FY2025
private-market composition, and the static source language on the published
page.

Browser verification (headless Chromium) at 360×800, 390×844, 430×932, 768×1024
and 1440×900, plus a 844×390 landscape check: no horizontal overflow, no clipped
text, no tap target under 44px, no console errors from page code, and the freeze
pane correct in all four states.

Freeze-pane behaviour specifically: the pane pins at `top: 0` while the
workbench overlaps the top of the viewport and scrolls away with it afterwards;
it never overlaps the personnel lever or a market slider; a focused control is
never hidden behind it; and the result stays visible and live through rating
changes, both market sliders, and advanced salary edits without any upward
scrolling.

---

## Unresolved source questions

These are open against the source material, not defects in the implementation.

1. **The general between-rung rule.** The worked example fixes one case
   (0.054% → the 0.05% rung), and recurs unchanged in all three produced plans,
   so the treatment is at least consistent across versions. None of them states
   a general rounding rule, and because the three repeat the same figures rather
   than supplying different intermediate values, they corroborate consistency
   without establishing a rule. The lower-rung convention therefore remains an
   exhibit implementation derived from that example, disclosed as such. Evidence
   of a different general rule would change the implementation.
2. **Rounding of the final dollar figure.** The plan does not state whether
   awards are rounded, truncated, or paid to the cent. The exhibit rounds to the
   nearest dollar for display and records the precise figures ($22,560.15,
   $30,080.20).
3. **Negative total excess.** Negative *annual* values appear in the worked
   example, but how a negative *total* would be read against a schedule starting
   at 0.01% is not established. Not modeled.
4. **The multi-year tenure layer.** The exhibit does not reconstruct it; its
   controls represent the post-tenure component.
5. **Proration.** Whether the ceiling is applied before or after any proration
   for partial years or mid-year hires is not addressed by the produced plans.
   Partial years are not modeled.
6. **Row-to-employee mapping.** The weights are published per row, but the
   produced plan does not map a generic job title onto a single row.
7. **Why private equity was excluded** from the FY2025 private-market excess
   calculation, and who authorised it, are not established by the produced
   records.
8. **Individual ratings and award worksheets** were withheld under the
   personnel-records exemption at Iowa Code § 22.7(11), which is why this is a
   hypothetical exhibit rather than a reconstruction.

The plan documents are not committed to this repository, so the constants in
`engine.js` are the transcription point for anyone checking the figures against
the produced records.

---

## Accessibility

- Full keyboard operation. The personnel selector is an ARIA radiogroup with
  roving tabindex and arrow/Home/End support; the market dials are native range
  inputs; every drawer is a native `<details>`.
- `aria-valuetext` on each slider announces the excess return, its weight, and
  what it contributes to the total excess, in words.
- A polite, debounced live region announces the calculated award, whether the
  ceiling binds, and the payable amount. The live bar is **not** a live region —
  its inner spans are `aria-hidden` so the same numbers are not announced twice.
  The bar carries one accessible name, "View the full calculation result", and is
  removed from the tab order and hidden from assistive technology whenever it is
  off screen, so it is never a focus trap and never steals focus when it appears.
- No meaning is carried by colour alone: the gauge's over-ceiling segment is
  hatched as well as coloured and named in the legend; cap status, ineligibility
  and invalid weights are stated in text.
- Minimum 44px tap targets throughout, verified at 360px.
- `prefers-reduced-motion` disables the number roll, the gauge transitions, the
  lever animation, the bar transition, and the tap-to-scroll animation.
- Semantic headings, a skip link, and visible focus rings on every control.

## Performance

No framework, no CDN, no build step. The page loads its own inline stylesheet,
one small script, and the site's local WOFF2 fonts. The only third-party request
is the site-standard GoatCounter aggregate counter, which the exhibit does not
depend on for any functionality.

## Editorial labels used

"Hypothetical calculated award", "payment ceiling", "applicable benchmark",
"market excess return", "exactly matches benchmark", "published FY2025 formula".

Deliberately avoided, and asserted against in the test suite: "actual bonus",
"0% return", "guaranteed bonus", "automatic bonus", and any characterisation of
an outcome as deserved, undeserved, easy, or improper. Zero excess is always
described as the component exactly matching its applicable benchmark — never as
a zero investment return.
