# The Standing Query — interaction prototype

Stations 4–7 of 8. Built from `02_Model_Output/RDP_SAVE_2026-09-04_INTERACTIVE_PROTOTYPE_SPEC_v0_1.md`,
which is controlling. This is an **interaction proof**, not final art.

It answers one question: **does the interaction work?**

---

## Run it

Double-click `index.html`. That is the whole install.

No build step, no server, no package manager, no framework, no CDN, no network
call of any kind. `app.js` is a classic script rather than an ES module for
exactly this reason — modules are blocked under `file://`, and the piece has to
survive being emailed as a folder.

Canonical viewport is **390 × 844** (iPhone-class). It reflows usably to ~700px
and to a two-column stage at ~1024px, but the mobile case is the designed one.

---

## The four files

| File | What it holds |
|---|---|
| `index.html` | All content, in reading order, as a semantic document. Every fact, quote and caveat is in the markup — nothing is injected by script. |
| `styles.css` | Design tokens, the measured-absence component library, and the state machine's *appearance*, driven entirely off `data-*` attributes on `#sq`. |
| `app.js` | The state machine, the audit gate, the timers, focus management, and the accessible mirror of the progress rail. |
| `check.js` | Headless walk of the whole sequence plus the editorial guards (see **Checks**). Not part of the deliverable page. |

`PROTOTYPE_NOTES.md` is the pass-2 build note. **`ADVERSARIAL_REVIEW_v0_1.md` is the
current authority** — it supersedes the notes wherever they disagree, and carries the
verdict and the blocking conditions.

---

## How it is wired

**One state attribute drives everything.** `app.js` sets `data-state` on `#sq`
and CSS does the rest. There is no per-element show/hide logic scattered through
the script, which is what makes the sequence auditable.

States, in order:

| State | Station | What happens |
|---|---|---|
| `s0` | 3 | The composite card, before anything. |
| `s1` | 4 | The SAVE response comes back. Additional-verification evidence available. |
| `s2` | 5 | **The 16,457 audit gate.** The card shrinks; the number takes the screen. |
| `s3` | 6 | Transition into issuance. The action bar leaves. |
| `s4` | 6 | **The false ending.** ISSUED stamp lands, then 1100ms of stillness under “Application complete.” |
| `s5` | 6 | **The hold** (1900ms). The expiry row appears and resolves out of the paper. |
| `s6` | 6 | **The line becomes a loop.** "The file stays open." |
| `s7` | 7 | The status expires before the license does. |
| `s8` | 7 | End of prototype. |

`s3`–`s5` are *auto-advancing*: they run on timers, not on taps, and they are the
only states where the action bar is off-screen. That absence **is** the false
ending — the reader is meant to believe the piece has finished.

**The 16,457 audit gate.** The primary button is disabled and reads `n of 3`
until the reader has opened all three of *people* / *cases* / *transactions*.
Each one resolves its slot to the unit word — `not established`, `a different
unit`, `documented`. When the third lands, the scope sheet opens unprompted and
the prompt changes to *"The number has not changed. What it means has."* This is
the mechanic the whole station exists for: the reader cannot walk past the number
without being told what it does and does not count.

**The line→loop reveal.** Two SVG paths sharing geometry, not one morphing path.
`#railProgress` is the straight run; `#railLoop` is the return, drawn on with
`stroke-dashoffset`. See PROTOTYPE_NOTES for why this deviates from the spec.

---

## Evidence grammar

The visual language is the point, so it is enforced in CSS rather than left to
whoever writes the copy:

| Component | Means | Looks like |
|---|---|---|
| `.m-fact-bar` | **Documented** — a number that appears in a released record | solid ink on paper |
| `.m-open-rule` | **Not established** — the records cannot answer this | an open measuring rule, `\|——\|` |
| `.m-null-slot` | **Not reported** — the report has no column for it | an empty dashed box |
| `.m-sworn-slip` | **Sworn, not corroborated by records** | paper slip, ruled off, labelled |
| `.m-partial-edge` | **Partial / open-ended data** | a torn right edge |
| `.legend-chip` | the outline grammar, stated in words at station 7 | dashed pill |

`--accent` (`#c2703d`) is **defined but deliberately unused.** It is reserved for
`STATE_MARK` — a change caused by the court. No `STATE_MARK` exists in stations
4–7, so nothing in this prototype may wear it. Do not repurpose the token; the
first thing that does will silently claim causation the records do not support.

For the same reason the ISSUED stamp is ink-grey, not rust: a warm stamp reads as
an accent, and the accent means something else.

## What the prototype must never claim

Station 7 is the sensitive one. Three guards are load-bearing:

1. The copy says the recheck is **contemplated** by staff instructions. It never
   depicts one running.
2. The legend chip states the outline grammar in words *before* the reader meets
   the letter.
3. **`.limit-block` is always visible and never collapsible.** "No released
   record shows this happening to anyone" sits open on the page, at larger type
   than the trigger for the revocation-warning letter above it. It is not a
   footnote and must not become one.

The case is labelled **Composite** in the header, on the card, and in a sheet one
tap away. There is no case number, no name, and no PII of any kind. Board and
dates are illustrative and say so in the banner.

---

## Accessibility

- **No JS at all**: the page degrades to a complete, readable document. Every
  sheet and receipt body renders inline; JS-only controls are removed by CSS.
  Nothing is lost but the sequencing.
- **Keyboard**: full sequence operable. Sheets trap focus, `Escape` closes, focus
  returns to the control that opened them.
- **Reduced motion**: the timed pauses are skipped — `s4` waits for a tap and goes
  straight to `s6`. The false ending survives structurally rather than as motion:
  the button reads **"Close"** beneath a terminal *"Application complete."* panel,
  so the *control* asserts the ending. The bar stays reachable at `s4`; without
  that override the sequence dead-ends.
- **WCAG 2.2.1**: the two-second hold is skippable by tap anywhere (except real
  controls) or by `Enter` / `Space` / `Escape`, and is absent under reduced motion.
- **The rail** is decorative SVG with an authoritative `<ol>` mirror in
  `#railList`, rewritten on every state change, plus a summary in the SVG `<title>`.
- Live region announces each station and each resolved slot.
- Targets are ≥44px; the chips are 48px.

## Browser storage

None. No `localStorage`, no `sessionStorage`, no cookies, no IndexedDB. State
lives in a closure and dies with the tab.

---

## Checks

`check.js` drives the built page headlessly through every path — full sequence,
reduced motion, keyboard-only, JS-disabled, cold paint, abuse, seven viewports
and every installed engine — and asserts **170 conditions**.

It guards two contracts. The **interaction** one: the audit gate, the completed
beat, the hold, the loop draw and the rail's expansion, the always-visible limit
block, focus trapping and return, the no-JS document. And the **editorial** one:
seven banned formulations fail the build (`16,555`, `Iowans`, `Board of
Nursing`, `clearinghouse director`, `Secretary of State`, the `– August 12,
2026` range form, `permanent`), nine required ones must be present, the
revocation quote is asserted verbatim, and the composite card is asserted to
contain no date, no board name and no case number.

```
npm i playwright        # chromium is required; firefox and webkit are used if present
node check.js
```

It writes screenshots to `_shots/`. **Playwright's WebKit is not iOS Safari** —
it shares the engine core but not the iOS shell, its viewport behaviour or its
accessibility stack. Passing here does not license the claim "tested on iPhone".

One rule when extending it: assert that things are **absent when they should
be**, not only present when they should be. Three regressions during the
adversarial pass — a stamp visible from the first frame, a reveal that no longer
waited for its animation, and a rail that collapsed to zero width on every
desktop viewport — all passed a presence-only suite.
