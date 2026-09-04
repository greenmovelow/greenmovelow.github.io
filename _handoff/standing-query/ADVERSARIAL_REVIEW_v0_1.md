# Adversarial review — The Standing Query (stations 4–7)

**Pass 3.** Role: hostile interactive-news editor, mobile UX reviewer, accessibility reviewer, evidence-discipline editor.
**Date:** 2026-09-04 · **Build reviewed and repaired in place:** `03_Interactive_Prototype/`
**Controlling spec:** `02_Model_Output/RDP_SAVE_2026-09-04_INTERACTIVE_PROTOTYPE_SPEC_v0_1.md`

---

## 0. Baseline before any change

`check.js` was run exactly as the prototype stood. The prior claim reproduced:

```
==== 69/69 checks passed ====
```

That number is now worth very little, and saying so is the main finding of this pass. The 69 checks tested the interaction contract and nothing else. They passed while the graphic carried an expressly barred date formulation, a real sworn-of-record board name on a composite case card, a misstatement of the template's structure, and a slot grammar that labelled a documented fact as not established. **A green suite is evidence that the thing you tested is fine. It is not evidence that you tested the right things.**

The suite now stands at **170/170 across three engines**, and it tests the editorial contract as well as the interaction one.

---

## 1. Material issues found

Severity: **BLOCKER** would have stopped publication · **HIGH** materially misleading or a hard usability failure · **MEDIUM** real defect, recoverable · **LOW** cosmetic.

### 1a. Evidence and copy

| # | Severity | Issue | Source authority |
|---|---|---|---|
| E1 | **BLOCKER** | The count was scoped “December 2025 – August 12, 2026.” A date range asserts a data cutoff. The report prints a *preparation* date and no cutoff at all. | Architecture: “❌ DO NOT SAY: ‘16,457 through August 12’ as though the cut-off were documented.” |
| E2 | **BLOCKER** | The composite card named **Board of Nursing** and carried two invented dates. Nursing is named in Baack's sworn declaration and in the master text; the card was formally shaped like a real DIAL record. | The record supplies no board-level distribution at all; the template's own field is `Board of "enter board name"`. |
| E3 | **BLOCKER** | “The status expires before the license does” was presented as *the* condition for the revocation warning. The template has **two** selectable paragraphs — before *and* after — and both carry the identical warning. | Template triggers, verbatim. |
| E4 | HIGH | The limitation read “No released record shows this happening to anyone” — dropping the mandated “**so far**” and the enumeration “denied, suspended, **or** revoked”, and leaving “this” with an ambiguous antecedent. | Ledger A22: “Say ‘no record produced so far shows,’ never ‘no revocations occurred.’” |
| E5 | HIGH | Baack was called “Iowa's clearinghouse director.” | Repair memo A03: that formulation “is now DISFAVORED and should not be used… Do not write that he holds a titled clearinghouse directorship.” |
| E6 | HIGH | “One applicant **may** generate more than one entry” asserted as fact a proposition RDP only *asked* USCIS about, and used the unit “entry”, which appears nowhere in the record. | Master text: “RDP asked USCIS **whether**…” |
| E7 | HIGH | The scope panel stacked **Driver's licensing (DOT)** and **Secretary of State** as adjacent rows — a *visual* joining of the DIAL ledger to the SOS thread. | Architecture: “**Do not** let the DOT clause and the SOS sentence sit adjacent… together they read as the ‘statewide architecture’ frame the evidence forbids.” |
| E8 | HIGH | The card read “recorded — content not in the production,” fusing a *contractual recording obligation* with a *production gap*. No source establishes DIAL recorded response content. | User Agreement requires recording; Operational Architecture lists result-code distributions as NOT DOCUMENTED. |
| E9 | MEDIUM | “Built **only** from Iowa's executed agreements, staff templates and transaction reports” — false: the 8,150 comparison comes from a federal court filing. | Revision memo source-hygiene ledger C-01…C-11. |
| E10 | MEDIUM | “One **Iowa** benefit code.” No source calls code 23 an Iowa code; RDP asked USCIS whether it is a standard SAVE category. | Sent USCIS letter, Q2. |
| E11 | MEDIUM | 8,174 sat beside 16,457 without saying the windows differ (Dec–Jun vs Dec–Aug report). | Ledger A11/A12. |
| E12 | MEDIUM | 98 sat adjacent to 16,457 with no guard against addition, and the graphic never said 16,457 is a **floor**. | Architecture: “16,555 (initial + additional) must never be published.” Ledger A16: “a floor… never a ceiling.” |
| E13 | MEDIUM | “Released twice” — DHS *prepared* two pulls; DIAL released once. | Ledger A11. |
| E14 | MEDIUM | The letter's provenance omitted that **one paragraph of the template was withheld** as still under legal review. | Ledger A21. |
| E15 | MEDIUM | The recheck instruction was presented as live procedure. It sits inside a note marked **“DO NOT USE THIS YET UNTIL LEGAL APPROVES WORDING.”** | Template, verbatim. |
| E16 | LOW | “the Department of Homeland Security's **own** SAVE program” — an intensifier absent from the master text. | — |
| E17 | HIGH | The graphic carried **no right-of-response status at all**, while the article carries it. | Revision memo §6. |

### 1b. Evidence grammar

| # | Severity | Issue |
|---|---|---|
| G1 | **HIGH** | **The unresolved slots were painted with the open measuring rule** — the mark that means *not established*. One of those slots is `transactions`, which is **documented**. The piece was labelling a documented fact as an evidentiary absence for as long as the reader had not tapped it. This is a genuine grammar error, not a nicety: it is the exact category confusion the whole station exists to prevent. |
| G2 | MEDIUM | With every slot showing the same rule, the mark also read as a generic “blanked out” — one step from *redaction*, which means *withheld*, a different claim entirely. |

### 1c. Interaction and accessibility

| # | Severity | Issue | Probe evidence |
|---|---|---|---|
| I1 | **BLOCKER** | **The rail reserved the loop band from the first frame.** At every viewport the loop station's position was already on screen at s0/s2; at 1024–1440 that was a 200–290px band of obviously-reserved emptiness. The reversal was telegraphed, worst exactly where the action-bar exit is weakest. | `loopBandVisibleInViewport: true` at 390, 1024, 1440. |
| I2 | HIGH | **s4 had no beat.** `s3 → s4 → s5` ran in one gesture; the whole false ending rested on the action bar leaving. (Deliverable **A**.) | Live-region log: “License issued.” at +2410ms, next event +4410ms — the stamp and the hold were one event. |
| I3 | HIGH | **Reduced motion had no false ending.** Removing the motion removed the idea; the reduced-motion reader got a strictly weaker piece. (Deliverable **D**.) | — |
| I4 | HIGH | **The scope sheet seized focus** 320ms after the third chip — the one place the piece took control from the reader. (Deliverable **E**.) | — |
| I5 | MEDIUM | **The containment gesture did not communicate.** The rail sat between the shrunken card and the count, so “this case is one of 16,457” was a caption over two unrelated blocks. (Deliverable **C**.) | — |
| I6 | MEDIUM | Back was reachable during the hold and left a stale `data-expiry` behind. | `back during hold → state=s0 expiry=hidden`. |
| I7 | MEDIUM | Cold-paint flash: the later card rows and the receipts were in the markup and hidden by the first `render()`. | — |
| I8 | LOW | At 390/430 the fixed action bar overlapped the limitation block at rest. | `barCovers: 1–2` at s2/s7. |

### 1d. Regressions I introduced during the repair, then caught and fixed

Recorded because they are the most instructive part of the pass.

| # | Severity | Regression | How it was caught |
|---|---|---|---|
| R1 | **BLOCKER** | Capping the rail with `margin-inline:auto` on a **grid item** shrank it to max-content. The clip box has no in-flow content (the SVG is absolutely positioned), so **the entire rail collapsed to zero width on every viewport ≥1024**. | Screenshot: the rail was simply missing at desktop s4. My own telegraph check had *passed* — a zero-width rail trivially telegraphs nothing. **A false pass.** The suite now asserts the rail is rendered before asserting anything about it. |
| R2 | HIGH | A `str.replace` collision left an **unscoped `.card__stamp{opacity:1}`** — the ISSUED stamp was visible from s0, spoiling the sequence outright. | Added assertions that the stamp is *absent* at s0 and s1. The old suite only checked it was present at s4. |
| R3 | HIGH | The same collision left an **unscoped `.panel__reveal{opacity:1}`** — “The file stays open.” no longer waited for the loop to draw. | Added an assertion that the reveal is hidden until `data-loop="drawn"`. |
| R4 | MEDIUM | Without JS the expiry value stayed at 15% opacity, stuck mid-reveal. | Full-page no-JS screenshot. |

The common thread in R1–R3: **every one passed the existing suite, because the suite only ever asserted that things appear, never that they are absent when they should be.** Presence-only assertions are how a state machine rots.

---

## 2. What was changed, and why

**Copy.** Every item in §1a is fixed in `index.html`. The composite card now uses DIAL's literal placeholder `Board of "enter board name"` with a caption saying so, and carries **no dates and no case number** — the banner explains that this is because the production contains nothing that would supply them. Station 7 states the two-branch structure and quotes the “DO NOT USE THIS YET” marking. The limitation carries “so far” and the full enumeration, and a copy of it now travels **inside the quote sheet**, so the revocation sentence can never be read without it. The SOS row is deleted outright. A right-of-response block was added at s8.

**The unit travels with the number.** `16,457` is now followed permanently by **“initial verification transactions”** in near-white at the number's own weight — not tucked into a caption. A reader who reads nothing else cannot take the figure away as a count of people. The scope panel states that 16,457 is a **floor**, and that additional verifications are “never added.”

**Slot grammar (G1).** An unresolved slot now shows a new mark — `.m-unknown`, a dotted trace meaning *you have not resolved this yet* — which is a fact about the reader, not about the records. On resolution each slot takes **its own** grammar: `people` → the open rule (*not established*), `cases` → a different-unit mark with a sworn-testimony caption, `transactions` → a solid fact bar (*documented*). Three different claims now look like three different claims.

**A — ISSUED gets its own beat.** `s3` → **`s4`: 1100ms of stillness — stamp landed, bar gone, back gone, “Application complete.” under an end rule, expiry row not yet present** → `s5`: the expiry resolving out of the paper → `s6`. The card at s4 is now a clean completed record; the expiry row appearing at s5 is the first hint anything remains.

The dwell is measured, not assumed. The suite installs a `MutationObserver` on `data-state` and asserts the intervals directly, because a sleep-and-poll assertion around a screenshot lies in both directions. Two consecutive runs: **s3 = 401ms, s4 = 1101ms, s5 = 1901ms** — 3.4 seconds of false ending, every millisecond of it skippable.

**B — desktop false ending.** Two changes. The rail's loop band is **clipped out of existence** until the loop draws (`.rail-clip`, 17% → 36.9% aspect), so the reversal is no longer telegraphed and the reveal now *grows the rail a new section* — a stronger gesture than the one it replaced. Separately, at ≥1024px the composition itself closes during s3–s5: the two-column stage resolves to a single centred column and the header chrome dims. The bar's exit is only ~8% of a desktop viewport; the layout settling is the signal that scales.

**C — containment.** At s2 the stage stops being a box (`display:contents`) so the card, the count and the rail can be ordered directly: thumbnail, then the sentence that refers to it (measured gap: **8px**), then the rail demoted below both. The gesture is now a legible reduction — one small case, one large count — without pretending to render 16,457 individuated items. Asserted in the suite.

**D — a structural, non-motion false ending.** Under `prefers-reduced-motion` the piece stops at s4 and **the control asserts the ending**: the button reads **“Close”**, beneath a terminal “Application complete.” panel. The reader is invited to close a finished thing; tapping it reveals the loop. The false ending is carried by *labelling*, not by motion — which is the point, since motion is what that reader has opted out of.

**E — no involuntary focus transfer.** The scope sheet is gone. Its content arrives **inline** beneath the chips when the gate opens, announced politely, taking no focus and raising no scrim. One dialog fewer, and the reader keeps control.

**Other.** Back is `disabled` through s3–s5 and clears `data-expiry`; the completed beat is skippable by tap or key like the hold (WCAG 2.2.1); progressive disclosure moved from JS to CSS and a one-line head script sets `data-enhanced` before first paint, eliminating the cold-paint flash without touching the no-JS fallback; bottom padding raised so nothing rests under the bar.

---

## 3. What was actually tested

**Engines — real, named.** `chromium 141.0.7390.37`, `firefox 142.0.1`, `webkit 26.0` (Playwright builds; Firefox and WebKit were installed during this pass). All three run the full sequence to s6 with the loop drawn, expand the rail correctly, issue **zero network requests**, touch **no browser storage**, and log no errors.

> **Playwright's WebKit is not iOS Safari.** It shares the engine core but not the iOS shell, its viewport/`svh` behaviour, its scroll and safe-area handling, or its accessibility stack. Nothing here licenses the claim “tested on iPhone.”

**Viewports:** 320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1440×900 — each checked at s0, s2, s6, s7 for horizontal overflow, rail-label collision, the limitation being trapped under the action bar, pre-reveal telegraphing, and that the rail is actually rendered. All clean.

**Modes:** full sequence · reduced motion · keyboard-only (including focus trap and focus return) · JavaScript disabled · cold paint with `app.js` blocked at the network layer.

**Abuse:** 12 rapid taps on the primary control (cannot skip the gate) · back during the hold (inert) · back from s6 (clears loop *and* the expiry attribute) · six open/close cycles on one sheet (no orphaned scrim or sheet) · restart mid auto-advance (lands clean at s0) · tap-skip of both the beat and the hold.

**Editorial guards, executable.** The suite now fails the build on seven banned strings — `16,555`, `Iowans`, `Board of Nursing`, `clearinghouse director`, `Secretary of State`, the `– August 12, 2026` range form, `permanent` — and on the absence of nine required formulations, including `so far`, `denied, suspended, or revoked`, `floor on transactions`, `initial verification transactions`, `two selectable paragraphs`, `enter board name`, `DO NOT USE THIS YET`, and the limitation line inside the quote sheet. The revocation quote is asserted **verbatim, character for character.**

**Composite safety, executable.** The suite asserts the card contains **no year, no month-name date, no case number**, that the board field is DIAL's literal placeholder, and that the composite marking is present.

**Result: 170/170**, reproduced across consecutive runs with identical measured timings. The suite takes roughly 90 seconds because it drives three engines and seven viewports; that is the price of catching a rail that renders in one engine and collapses in another.

---

## 4. The hardest editorial question

*Could a hostile but fair reader accuse the interactive of depicting consequences the records do not establish?*

**Before this pass: yes, and the accusation would have landed.** Not because of the revocation quote — that was always paired — but because of three things in combination: a card that named a real, sworn-of-record licensing board and carried plausible dates; a claim that the warning followed from the status expiring first, which misdescribed a two-branch template; and a limitation that had quietly dropped the qualifier the source-lock material makes mandatory. Together those move the piece from *this is the documented procedure* toward *this is what happened to a nurse*.

**After this pass: the accusation is much harder to make, and I can say precisely why.** The card cannot be mistaken for a record because it contains nothing a record would contain — no board, no dates, no number, and DIAL's own placeholder string on its face. The warning is presented as belonging to both branches of a template, which is what the template says. The limitation is always visible, at larger type than the trigger for the quote, carries the full enumeration and the rolling-production qualifier, and a second copy of it sits inside the quote sheet so the sentence cannot travel alone. The recheck is stated as contemplated *and* marked as not yet approved for use — which is stronger evidence for “contemplated” than the earlier draft had.

**What I cannot certify** is the residue that no automated check reaches: whether the *cumulative emotional weight* of a rubber stamp, a hold, a reversal and a revocation quote leaves an impression more adverse than the sentence-level record supports. That is a reader-comprehension question, and it is named as a blocking human test below. My own judgement is that the always-visible limitation now outweighs the letter — but I am the author of that judgement, which is exactly why it needs a reader who is not me.

---

## 5. Remaining risks

**Requires real humans — cannot be established here, and I have not pretended otherwise**

1. **Does the false ending fool anyone?** Headless automation can prove the bar leaves, the beat holds for 1100ms and nothing is announced for three seconds. It cannot prove a reader believes the piece is over. **Untested. Highest residual risk**, because the entire structure is built on it.
2. **Does the gate educate before it annoys?** Three forced taps is a real cost. Abandonment at s2 is measurable only with readers.
3. **Does anyone still take 16,457 as people?** The unit line, the slot grammar and the People sheet are three independent guards. Whether they hold in a skim is a comprehension test.
4. **Can a reader finishing the piece state, unprompted, that no revocation is documented?** The direct test of §4.
5. **Does the open rule read as a redaction?** Distinct marks now; distinctness in a reader's head is untested.

**Requires real devices**

6. **iOS Safari and Android Chrome at 390×844** — `svh`, safe-area insets, the fixed bar, momentum scrolling under the sheets. Playwright WebKit is not a substitute.
7. **Screen readers (VoiceOver, NVDA).** The rail's `<ol>` mirror and the live-region cadence are untested with a real AT. The probe found **four announcement gaps under 1000ms**, all during chip resolution, where a `polite` update lands as focus is entering a dialog. `polite` should queue rather than interrupt; that needs confirming, not assuming.

**Editorial, before publication**

8. **The right-of-response window closes today (4 September 2026).** No response is in the corpus. The s8 block currently states the request and the deadline and says the published version must state the outcome; per governance, silence before the deadline is not a refusal, and “declined to comment” is reserved for an affirmative decline. **This is a swap-in, not a rebuild — but it is blocking.**
9. **The December 10, 2025 correction** must publish at or before this piece.
10. **Station 7 still must not receive final art** until 8 is resolved.

**Known and accepted**

11. Rail label positions are hand-placed per station; changing the rail geometry requires re-checking them. No collision logic.
12. Back navigation remaps rather than modelling real history; no URL state.
13. `display:contents` on the s2 stage is a layout tactic with no semantic cost here (the element is a bare `div`), but it is the one place the layout depends on a newer CSS feature. Verified in all three engines.

---

## 6. Verdict

**READY WITH NAMED HUMAN-TEST CONDITION**

The interaction contract is repaired and now tested at 170 assertions across three engines and seven viewports, and the editorial contract is executable rather than aspirational. Every defect reachable from interaction and design evidence has been fixed in place, including three blockers and four regressions introduced during the repair itself.

It is not READY FOR FINAL DESIGN, and automated results are not why. Three conditions are named and blocking:

- **(a)** A naïve-reader test of the false ending (§5.1) and of the revocation/limitation balance (§5.4). If readers cannot state that no revocation is documented, station 7 needs rebalancing before art, not after.
- **(b)** One real iOS Safari and one real Android Chrome pass, plus one screen-reader pass (§5.6–5.7).
- **(c)** The right-of-response outcome resolved and stated (§5.8).

Condition (a) is the one that could still send this back for another interaction pass. I have improved everything the evidence let me improve; the remaining question is about readers, and it is not mine to answer.
