# Division 26 Takeoff Workbench

A browser-only tool for electrical bid takeoff. Load a project manual, the
electrical sheets and every addendum; answer the questions the documents
leave open; get a Division 26 takeoff split by who quotes each item, the RFIs
that must go to the engineer, and reminders backed off the bid date.

Lives at `/takeoff/`. No build step, no server, no framework. Everything
runs in the browser and is stored in IndexedDB on the machine that loaded it.

## What it produces

| Output | Where | Notes |
|---|---|---|
| Takeoff line items | Takeoff view, workbook `Takeoff` tab and one tab per channel | Item, tags, quantity (or TBD with the reason), unit, quote channel, spec section, confidence, qualifications, RFI references, source evidence |
| Quote channels | Distributor / Mechanical / Integrator / Package / Install / Ambiguous | Electrical distributor; mechanical or process equipment supplier; systems integrator; other packages (cranes, gates, fire alarm); contractor-carried installation material; items that need an RFI before they can be assigned |
| Responsibility matrix | Takeoff view, workbook tab | Furnished / installed / power wired / control wired / programmed / started by, plus every explicit furnish-or-install clause found in the text |
| RFIs | RFIs view, workbook `RFI Log`, markdown log | Ranked Critical before pricing, Price with qualification, Coordination, Bid compliance. Each has the question as it should be sent and the pricing basis the bid carries if unanswered. Sent and answered dates are tracked |
| Document conflicts | Takeoff view, workbook `Conflicts` | Drawing-versus-specification disagreements preserved with both values, a pricing basis and the RFI that resolves them |
| Compliance checklist | RFIs view, workbook `Compliance` | Addendum acknowledgment, AIS, BABA, prevailing wage, substitution deadlines, classified areas |
| Schedule | Schedule view, `.ics` export, workbook `Schedule` | Send RFIs, question deadline, send RFQs, follow up, quotes due, final addendum check, bid due. Calendar events carry alarms one day and two hours ahead |
| Quote requests | Exports view | One markdown request per channel with basis, qualifications and required disclosures |
| Source map | Source map view, workbook `Source References` | Document hashes (SHA-256 of the file bytes), sections located, equipment tags, ratings, manufacturers, integrator clauses |

## How the analysis works

`engine.js` is a deterministic rules engine and is the only thing that decides
what appears in the takeoff unless you merge a Claude result.

1. **Sections.** CSI section numbers in Divisions 00, 01, 22, 23, 26, 27, 28, 33, 40, 41, 43, 44 and 46 are located, counted by page, and mapped to a catalog that says which channel normally quotes that section.
2. **Equipment families.** Around forty families (VFDs, MCCs, panelboards, ATS, generators, control panels, instruments, pumps, HVAC, cranes, raceway, grounding, and so on) are detected by keyword patterns. Each family carries a default channel, a quote note for the supplier and the scope Division 26 keeps when someone else furnishes the item.
3. **Tags.** Equipment tags such as `P-1`, `HP-1`, `DIS-CU-1`, `SCP-1`, `LIT-1` are collected and assigned to families by prefix. Distinct tags give quantities; sheet references (`E-3`) are recognised and excluded.
4. **Values and conflicts.** Voltages, fault ratings (grouped by equipment class and voltage), enclosure types, horsepower, kVA, kW, FLA presence, reactor and filter language, harmonics, SCCR, AIS/BABA/Buy American/Davis-Bacon/SRF language, addenda, bid date and time, question deadline, substitution deadlines, systems-integrator clauses, and explicit furnish/install clauses. Two different fault ratings for the same class of equipment, or NEMA 3R and Type 4X both appearing, become preserved conflicts with an RFI.
5. **Questions.** Fixed intake questions (bid date, time zone, role, project type, funding, lead days) plus questions raised only when the documents warrant them (VFD arrangement, motor lead length, integrator scope, HVAC disconnects, metering, generator channel). Detected values are pre-filled with their evidence.
6. **Takeoff, RFIs, responsibility, schedule.** Built from detections and answers. Answers change channel assignments: for example, "no integrator named" moves control panels to Ambiguous with a critical RFI; "MCC-mounted VFDs" tells the distributor to quote drives inside the lineup.

The engine has a Node test: `npm run test:takeoff` (or `node scripts/test_takeoff_engine.mjs`).

## Claude review (optional)

The Claude review view sends the relevant pages, your answers and the rules
result to the Anthropic Messages API with a fixed JSON schema and shows the
reply next to the rules result. You tick which lines and RFIs to merge.

- Uses your own API key, stored in this browser's localStorage. The key is sent only to `api.anthropic.com`. Treat a browser-held key as exposed to anyone with access to the machine and rotate it.
- Pages are ranked by relevance and capped by a character limit you set; the estimate shown is list price and approximate.
- Default model is `claude-opus-5`; `claude-sonnet-5` is available for faster, cheaper runs.
- Responses stream so long outputs do not time out. A refusal or a hit on the output limit is reported in the run log.

## Reminders

A static page cannot send email or push notifications when the tab is closed.
Two mechanisms are provided:

- **Calendar export.** The `.ics` file has one event per milestone with `VALARM` reminders. Event UIDs are stable per project and milestone, so re-importing after a bid-date change updates events in place in most calendar clients.
- **Browser notifications.** With permission granted and the page open, milestones within 24 hours (or up to two days overdue) raise a notification once per milestone per day.

## Files

- `index.html` page shell (marked `noindex`)
- `app.css` styles (uses the site's self-hosted Inter and JetBrains Mono)
- `app.js` UI controller: IndexedDB storage, PDF text extraction, views, exports, reminders
- `engine.js` rules engine (pure ES module, also used by the Node test)
- `claude.js` optional Claude review: schema, prompt, streaming client, adapter
- `vendor/pdf.min.mjs`, `vendor/pdf.worker.min.mjs` pdf.js 4.10.38 (Apache-2.0)
- `vendor/xlsx.full.min.js` SheetJS Community Edition 0.18.5 (Apache-2.0)

## Limits

- Scanned PDFs without a text layer yield nothing; run OCR first.
- Quantities are only as good as the schedules in the loaded text. Without drawings the takeoff is a scope list and says so.
- The rules engine reads text, not geometry. It will not measure conduit runs or count receptacles from a floor plan.
- Detection patterns are tuned for water/wastewater, municipal and commercial work in North American CSI-format documents.
