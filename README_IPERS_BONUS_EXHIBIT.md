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
| `infographics/ipers-bonus-calculator/engine.js` | The calculation engine. Pure functions, no DOM, no dependencies. Loaded by the page in the browser and by the test runner in Node. |
| `scripts/test_ipers_incentive_engine.js` | Verification tests for the engine. |
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

Run the formula tests:

```bash
node scripts/test_ipers_incentive_engine.js
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
*The Formula Behind the $25,000: What Iowa's Next Governor Inherits*
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
| Payout ladder | +5 percentage points per basis point, 100% at 0.20% | Plan payout schedule |
| Per-person ceiling, FY2025 | $25,000 | Plan; assigned by the chief executive through the budget process |

### Steps

1. `getIndividualBasisPoints(rating)` — 15 bp, 20 bp, or `null` (not eligible).
2. Each market component is clamped to the plan's 20-basis-point goal, because
   the plan states anything above 20 basis points pays what 20 basis points pays.
3. `calculateWeightedIndividualComponent` / `...Public...` / `...Private...` —
   each component's basis points multiplied by its weight.
4. `calculateBlendedResult` — the three weighted contributions summed into a
   blended total, in basis points.
5. `getMarketPayoutFactor(blendedBp)` — the published ladder applied to the
   blended total: five percentage points of payout factor per basis point,
   capped at 100%.
6. `calculateMaximumIncentive(salary, maxPct)` — the maximum award.
7. `calculateRawAward(maximumIncentive, payoutFactor)` — the arithmetic result.
8. `applyEligibility(rating, award)` — zero if the rating is below "meets".
9. `applyDollarCap(award, cap)` — constrained by the $25,000 ceiling.

### Worked example — the 2025 CIO preset

**"Meets Expectations", both market components exactly matching their benchmarks**

```
individual rating          15 bp
weighted contribution      15 bp x 20%          =   3 bp
public-market excess       0.00%  ->  0 bp x 40% =   0 bp
private-market excess      0.00%  ->  0 bp x 40% =   0 bp
blended total                                       3 bp   (0.03%)
published payout factor                            15%
maximum incentive          50% of $300,802      = $150,401
calculated award           15% x $150,401       =  $22,560   ($22,560.15)
payment ceiling                                    $25,000
final payable                                      $22,560
```

**"Exceeds Expectations", same assumption**

```
individual rating          20 bp
weighted contribution      20 bp x 20%          =   4 bp
blended total                                       4 bp   (0.04%)
published payout factor                            20%
calculated award           20% x $150,401       =  $30,080   ($30,080.20)
payment ceiling                                    $25,000
FINAL PAYABLE                                      $25,000
```

### Rounding

Arithmetic is carried at full precision; dollars are rounded to the nearest
dollar for display only. The ceiling comparison uses the unrounded value.
$22,560.15 is 90.24% of $25,000, displayed as "90% of the $25,000 ceiling" —
the same rounding the article uses.

---

## Source assumptions and interpretation

Two points where the plan required a reading rather than a transcription. Both
are disclosed to the reader in the exhibit's methodology drawer.

**1. Weight-then-ladder, or ladder-then-weight.** The article describes the
weighted components being summed into a blended total and the ladder applied to
that blend. An equally natural reading applies the ladder to each component
first and then weights the resulting payout factors. Because the ladder is
linear at five percentage points per basis point, and because each component is
clamped at the plan's 20-basis-point goal before weighting, **the two readings
produce identical results everywhere in this exhibit's input range.** The
ambiguity is therefore resolved rather than papered over. See the
`MARKET COMPONENTS` block in the test file, which pins this behaviour.

**2. Per-component clamping.** "Anything above 20 basis points pays what 20
basis points pays" is applied per market component before weighting. This is
what makes the two readings above converge. The market sliders expose a final
`0.20%+` detent so a reader can see the plateau directly.

### What is deliberately not modeled

**Negative market excess.** The published plan's payout schedule begins at zero
excess and climbs. It does not establish how excess return below the benchmark
enters the table. The exhibit therefore constrains the public- and
private-market controls to source-supported values beginning at 0.00%, and
`getMarketPayoutFactor` throws on a negative input rather than extrapolating the
positive ladder downward or silently flooring the result at zero.

**Non-CIO role presets.** The FY2025 plan sets different maximum-incentive
percentages by position — 50% for the Head of Strategy, 30% for senior
investment officers, 20% for the other listed investment-officer and Executive
Officer 2 classifications. The plan's public- and private-market weightings for
those classifications are not established in the material available, so the
exhibit offers **only** the Chief Investment Officer as a preset. The other
maximums are listed in the advanced drawer, marked "not modeled", so no single
universal preset is implied for any other title.

---

## Unresolved source questions

These are open against the source material, not defects in the implementation.

1. **Rounding convention.** The plan does not state whether awards are rounded,
   truncated, or paid to the cent. The exhibit rounds to the nearest dollar for
   display and notes the precise figures ($22,560.15, $30,080.20).
2. **Blended totals between published rungs.** The ladder is published at whole
   basis points. Weighting produces fractional blended totals (0.02% public
   excess at a 40% weight contributes 0.8 bp). The exhibit treats the ladder as
   continuous at five percentage points per basis point, which is how the plan
   describes the line climbing. Whether IPERS rounds to a published rung in
   practice is not established by the produced records.
3. **Negative excess.** As above — not specified, not modeled.
4. **Non-CIO component weights.** Not established for the other
   classifications; see above.
5. **Whether the ceiling is applied before or after any proration** for partial
   years or mid-year hires. The produced plans do not address it, and the
   exhibit does not model partial years.
6. **Individual ratings and award worksheets** were withheld under the
   personnel-records exemption at Iowa Code § 22.7(11), which is why this is a
   hypothetical exhibit rather than a reconstruction.

---

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
| `public` | percentage points, e.g. `0`, `0.04`, `0.2` | Any value above `0.2` lands on the `0.20%+` detent |
| `private` | percentage points | Same as `public` |
| `max` | 10–50 | Maximum incentive as a percent of base salary |
| `wi` | 0–100 | Individual-performance weight, percent |
| `wpub` | 0–100 | Public-market weight, percent |
| `wpriv` | 0–100 | Private-market weight, percent |

Omitted parameters fall back to the 2025 CIO preset. If the three weights do not
total 100, the exhibit shows an inline warning and withholds the result rather
than displaying a figure the formula does not support.

The **Copy this scenario** button in the advanced drawer writes the canonical
URL for the current inputs to the clipboard and updates the address bar via
`history.replaceState`. If the Clipboard API is unavailable it falls back to a
prompt containing the link.

---

## Where to edit the editorial content

**Title, deck, and the methodological line** — top of `<main>` in
`index.html`, in the `<section class="hero">` block. The `<title>`, the
`og:`/`twitter:` meta tags, and the JSON-LD block near the top of `<head>`
carry the same wording and should be changed together.

**Source links** — two constants at the top of the page script in
`index.html`, under `EDITORIAL CONFIGURATION`:

```js
var ARTICLE_URL = 'https://investigations.restoring-democracy.org/';
var PLAN_DOCUMENT_URL = null;
```

- `ARTICLE_URL` drives the "Read the Investigation" button. **Set this to the
  article's permalink once the story is published** — it currently points at the
  publication's front page.
- `PLAN_DOCUMENT_URL` is optional. Leave it `null` and no "View the Plan" button
  renders. Set it to a path such as
  `/assets/docs/ipers/ipers-incentive-plan-fy2025.pdf` (or an image crop of the
  plan) and the button appears next to "Read the Investigation". The exhibit
  never depends on that asset.

**Methodology and receipts** — the `How this is calculated` drawer near the
bottom of `index.html`. Plain markup; the payout-ladder grid is hand-written
there so it reads as published rather than as generated output.

**Plan constants** — `PLAN` at the top of `engine.js`. Changing a value there
changes the calculator, the "show the math" panel, the threshold explorer, and
the tests together. If the FY2026 plan changes the ceiling or the ladder, that
object is the single place to edit.

---

## Verification

`node scripts/test_ipers_incentive_engine.js` — 55 assertions, all passing.

| Case | Inputs | Expected raw | Expected payable | Result |
| --- | --- | --- | --- | --- |
| A | CIO, Meets, zero excess | ≈ $22,560 | ≈ $22,560 | $22,560.15 / $22,560.15 |
| B | CIO, Exceeds, zero excess | ≈ $30,080 | $25,000 | $30,080.20 / $25,000 |
| C | $250,000 salary, Exceeds, zero excess | $25,000 | $25,000 | $25,000 / $25,000 |
| D | Fails to Meet | Not eligible | $0 | Not eligible / $0 |

The suite also pins every published rung of the payout ladder, the above-goal
plateau, per-component clamping, the refusal to model negative excess, weight
validation, and the cap-threshold function.

The threshold explorer computes its figure from the live inputs rather than
hard-coding $250,000: at a 50% maximum incentive, an "Exceeds Expectations"
rating contributes a 20% payout factor, 20% × 50% = 10% of base salary, and
$25,000 ÷ 0.10 = $250,000. The label reads "at $250,000 or above" because the
award equals the ceiling exactly at that salary.

---

## Accessibility

- Full keyboard operation. The personnel selector is an ARIA radiogroup with
  roving tabindex and arrow/Home/End support; the market dials are native range
  inputs; every drawer is a native `<details>`.
- `aria-valuetext` on each slider announces the excess return and the payout
  factor in words rather than a bare slider position.
- A polite, debounced live region announces the calculated award, whether the
  ceiling binds, and the payable amount after each change.
- No meaning is carried by colour alone: the gauge's over-ceiling segment is
  hatched as well as coloured and is named in the legend; the ineligible and
  invalid-weight states are text notices.
- Minimum 44px tap targets throughout, verified at 360px.
- `prefers-reduced-motion` disables the number roll, the gauge transitions, and
  the lever animation.
- Semantic headings, a skip link, and visible focus rings on every control.

## Performance

No framework, no CDN, no build step. The page loads its own inline stylesheet,
one 9KB script, and the site's local WOFF2 fonts. The only third-party request
is the site-standard GoatCounter aggregate counter, which the exhibit does not
depend on for any functionality.

## Editorial labels used

"Hypothetical calculated award", "payment ceiling", "applicable benchmark",
"market excess return", "exactly matches benchmark", "published FY2025 formula".

Deliberately avoided: "actual bonus", "0% return", "guaranteed bonus",
"automatic bonus", and any characterisation of an outcome as deserved,
undeserved, easy, or improper. Zero excess is always described as the component
exactly matching its applicable benchmark — never as a zero investment return.
