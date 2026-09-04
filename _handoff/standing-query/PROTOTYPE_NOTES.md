# Prototype build note — The Standing Query, stations 4–7

> **SUPERSEDED IN PART — 2026-09-04, pass 3.** `ADVERSARIAL_REVIEW_v0_1.md` is the
> current authority. All five open items in §4 below (the collapsed s4 beat, the weak
> desktop false ending, the containment gesture, the reduced-motion equivalent, and the
> focus-seizing scope sheet) have since been decided and fixed, along with three
> editorial blockers this note did not catch. Read §4 as the diagnosis it was, not as
> the present state of the build.

**Build date:** 2026-09-04 · **Status:** interaction proof · **Spec:** `02_Model_Output/RDP_SAVE_2026-09-04_INTERACTIVE_PROTOTYPE_SPEC_v0_1.md` (controlling)

**Verdict on the question the build was meant to answer — *does the interaction
work?* — YES, with two qualifications**, both about the *false ending* and both
set out under "Did not work as envisioned" below.

Checks: 69/69 pass across four passes (full sequence, reduced motion,
keyboard-only, JS-disabled). No page errors in any pass. `node --check` clean.

---

## 1. What works

**The 16,457 audit gate — the strongest part of the build.** Locking the primary
button behind `n of 3` changes the reader's relationship to the number. You
cannot walk past it. By the time the gate opens, the three slots read *not
established / a different unit / documented*, the scope sheet has opened on its
own, and the prompt has changed to "The number has not changed. What it means
has." The mechanic and the epistemics are the same gesture, which is what the
concept promised.

**The line→loop reveal.** This carries the whole piece and it lands. The draw-on
takes 900ms, the loop station dot fades in behind it, and "The file stays open."
appears only once the loop is drawn. Nothing about it needed rescuing.

**The two-second hold.** It reads as a held breath rather than as lag. The expiry
date resolving out of the paper during the hold (opacity + letter-spacing over
800ms, starting at 1200ms) gives the pause something to be *about*, which was the
risk. Skippable by tap or key; absent entirely under reduced motion.

**Measured absence.** The component library survives contact with real layout.
The open rule reads as a measurement that came back empty rather than as missing
data; the null slot reads as "the report has no column"; the sworn slip reads as
testimony rather than as fact. A reader can tell the three apart without the
legend — which was the test.

**The always-visible limit block.** Station 7's "No released record shows this
happening to anyone" is open on the page at 17px semibold against the letter
trigger's 14px, in a bordered block. This deviates from the spec, which had it as
a second receipt. **Keep the deviation.** A collapsed limit is a footnote, and a
footnote under a revocation-warning quote is how a piece implies something it has
not established.

**The no-JS fallback is a genuine document,** not a stub. All five panels, all
five sheets and both receipt bodies render inline; the JS-only controls remove
themselves. Nothing evidentiary is lost — only the sequencing.

**Reduced motion, keyboard, focus.** Sheets trap focus and return it to the
opener; `Escape` closes; the auto-opened scope sheet hands focus to the primary
button rather than dropping it on `<body>`. Verified headlessly, not assumed.

---

## 2. Knowingly rough — do not read as design intent

- **Type and colour are placeholders.** System UI stack and a generic serif.
  Spacing is on no grid. The paper is a flat `#f4f1ea` with a box-shadow, not a
  surface.
- **The card thumbnail at station 5.** The card scales to 0.34 and `app.js`
  reclaims the leftover layout box with a measured negative margin. It works, but
  it is a transform pretending to be a layout change: the shrink and the
  space-reclaim are not perfectly synchronised, and on a slow first paint you can
  catch a jump.
- **The rail reserves loop space from the start** (viewBox is 118 tall, the loop
  occupies the bottom half), so stations 0–5 carry visible dead space beneath the
  line. Reserving it is correct — the alternative is content jumping when the loop
  draws — but final art should fill or crop that band.
- **Vertical rhythm shifts between states** as card rows appear. The stage has no
  fixed height. A designed height is a final-art decision, not a code one.
- **Rail label positions are hand-placed** (`dy` per station) to dodge the loop
  path. Any change to the rail geometry will need them re-checked; there is no
  collision logic.
- **Back navigation is approximate.** The auto-advancing states `s3`–`s5` are not
  pushed to history, so Back from `s6` returns to `s2` — correct in effect, but by
  a remapping rule rather than a real history model. There is no URL state and no
  browser-history integration at all.
- **`check.js` asserts the interaction contract, not the copy.** No text is
  verified against source in the harness.

---

## 3. Must NOT receive final art yet

- **Station 7 in its entirety.** The right-of-response window has not closed.
  Everything here is *authorized/contemplated* grammar, and one illustrative
  flourish — a stamp, a red line, a struck-through licence — converts a documented
  procedure into a depicted event. Final art on station 7 waits for the response
  window.
- **The `--accent` token.** Defined, reserved for `STATE_MARK`, unused on purpose.
  Nothing in stations 4–7 is court-caused, so nothing here may wear it. The first
  thing that borrows it because it "needs a highlight" silently claims causation.
  This is also why the ISSUED stamp is ink-grey rather than rust.
- **The composite card's surface.** It must keep reading as a *template*, not as a
  document. Any convincing paper texture, letterhead, seal or signature block
  moves it toward looking like a real record of a real person. No seals. No case
  number. No name.
- **The `.m-open-rule`.** Do not stylise it into something that could be mistaken
  for a redaction bar. Redaction means *withheld*; the open rule means *the
  records cannot answer this*. Those are different claims and the piece depends on
  readers not confusing them.
- **Stations 1–3 and 8** are not built. Do not art-direct 4–7 into a house style
  the unbuilt stations then have to match.

---

## 4. Did not work as envisioned

**(a) Station 6 is a pass-through, not a beat.** The spec treats `s4` (ISSUED
lands) and `s5` (the hold) as separate moments. In practice `s3 → s4 → s5` runs in
one gesture: the stamp appears and the hold begins essentially together, so the
false ending is carried almost entirely by the *action bar leaving*. The bar exit
is doing more work than intended, and there is no independent beat where the
reader can sit with "issued" as a completed outcome before the pause starts. This
is a timing decision the next pass should make deliberately rather than inherit.

**(b) The false ending is weaker on desktop.** At ≥1024px the loop is already
visible in the rail's reserved band on a tall viewport, and the action bar's exit
is less conspicuous because the bar is a smaller share of the screen. The false
ending is a *mobile* effect. Either accept that and treat desktop as a different
piece, or find a desktop-specific ending signal — do not assume the mobile one
scales.

**(c) The card-shrink at station 5 lost its meaning.** The intent was the card
shrinking *into* the number. What it does is shrink and sit above it. The
continuity gesture — the case becoming one datum in a count — is stated by the
copy ("This case is one of") and not by the motion. Two SVG paths solved the
line→loop risk cleanly; nothing equivalent was found for this one.

**(d) Reduced motion needed a structural exception, not a shorter duration.**
Because `s4` waits for a tap under reduced motion, the false-end rule that hides
the action bar dead-ends the sequence. It is fixed with an override, but the
lesson is that the false ending *is* motion — the reduced-motion reader gets a
different, weaker experience by construction. The next pass should decide what
the false ending is for that reader instead of accepting a degraded copy of it.

**(e) The scope sheet auto-opens, which is an interruption.** It fires 320ms after
the third chip and takes focus. It is currently justified — it delivers the
boundaries of the count at the moment the count is understood — but it is the one
place the piece takes control away from the reader, and it should be tested rather
than assumed.

---

## 5. Deviations from the spec, recorded

| # | Spec said | Build does | Why |
|---|---|---|---|
| 1 | One path morphing line→loop | Two paths sharing geometry, `stroke-dashoffset` draw-on | `d`-attribute interpolation is the build's biggest risk and is not reliably animatable in CSS. Same reading, no risk. |
| 2 | `COMPOSITE / NO. 000-000` | No case number at all | Superseded by the build instruction: *no invented case number*. |
| 3 | S7 primary reads "What the records don't show" | Reads "Continue" | That label now belongs to the always-visible limit block; duplicating it made two different things look like the same control. |
| 4 | `RECEIPT_LIMIT` as a second collapsible receipt | Always-visible block, larger type than the letter trigger | Spec elsewhere requires it at the letter's prominence and "never as a footnote". A collapsed limit is a footnote. |
| 5 | — | ISSUED stamp is ink-grey, not warm | A warm stamp reads as `--accent`, which is reserved for `STATE_MARK`. |

---

## 6. What the next review pass should test

**Interaction**

1. **Does the false ending actually fool anyone?** The single highest-value test.
   Watch a reader who has not seen the concept. Do they put the phone down at the
   hold? If nobody is fooled, the loop is a transition rather than a reversal and
   the piece loses its spine.
2. **Does the audit gate annoy before it convinces?** Three forced taps is a real
   cost. Watch for abandonment at `s2` specifically. If readers bail, the gate
   needs to be earned faster — not removed.
3. **Timing of `s4`/`s5`.** Give "issued" its own beat and re-test the hold. See 4(a).
4. **The auto-opening scope sheet.** Interruption or payoff? See 4(e).
5. **Desktop.** Does the ≥1024px layout need a different ending signal? See 4(b).
6. **Back and restart under real use**, including Back mid-hold and restart at `s7`.

**Comprehension — the part that matters for publication**

7. **Can a reader who finishes the piece state, unprompted, that no revocation is
   documented?** If not, station 7 is implying something the records do not
   support, and the limit block needs more weight — or the letter needs less.
8. **Can a reader distinguish the open rule from a redaction bar?** See §3.
9. **Does anyone come away thinking they saw a real person's case?** Test with the
   composite sheet unopened. If yes, the labelling is not enough.
10. **Does "16,457" get repeated back as people?** That is the failure the whole
    station is built to prevent; it is also the most likely one.

**Technical**

11. Real iOS Safari and Android Chrome at 390×844 — `svh` units, safe-area
    insets, and the fixed action bar over the keyboard-less viewport. All checks
    here ran in headless Chromium only.
12. Screen reader end-to-end (VoiceOver, NVDA): the rail's `<ol>` mirror, the
    live region cadence during auto-advance, and whether the announcements
    collide with the timed transitions.
13. Slow first paint: the card rows and receipts are visible in the markup and
    hidden by the first `render()`. Confirm the flash of the full document is not
    objectionable on a cold load — it is the price of the no-JS fallback, and it
    is the right price, but it should be measured.
