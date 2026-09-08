# Placeholders and open items

Everything on this list is a deliberate gap. Nothing here was guessed at.
Search `_src/content/copy.json` for `PROVISIONAL` to find the copy slots.

## A. Provisional copy — expected to be replaced from the Opus article draft

| Slot | Path in `copy.json` | Current value |
|---|---|---|
| Exhibit title | `exhibit.headline` | "Page Nine" — a working title, not a publication title |
| Dek | `exhibit.dek` | Written for this prototype; replace with the article's dek |
| Byline | `exhibit.byline` | "Restoring Democracy's Promise" — no author, no date |
| Display date | `exhibit.date_display` | "Draft — not published" |
| Meta description | `exhibit.meta_description` | Written for this prototype |
| Article link | `exhibit.article_link` | `enabled: false`, empty URL. Set `enabled: true` and fill `url` when the article publishes |

All chapter body and consequence text in `copy.chapters[]` is written from the
adjudicated record and is publication-safe as written, but it is exhibit copy,
not article copy. It can be tightened against the article's voice without
touching any template.

## B. Reserved blocks that are empty on purpose

| Block | Where it renders | State |
|---|---|---|
| Responses / right of reply | Chapter 11, narrative page | Renders with a visible placeholder saying nothing has been added. Nothing has been sought or received in this build. |
| Updates and corrections | `copy.exhibit.updates_block` | `enabled: false`, empty list |

## C. Not shipped in Phase 1

| Item | Why | What the exhibit does instead |
|---|---|---|
| Facsimile page images | No crops of the produced records were prepared, and inventing them was not an option | Every receipt shows a "Page image" section that says plainly that no image is shipped and that crops are a Phase 2 item. The verbatim excerpt is always present. |
| Social cards / OG images | Out of Phase 1 scope; the headline is provisional | `og:image` is omitted rather than pointing at a placeholder |
| A separate `/methodology/` route | It would separate the definitions from the tables they describe | Methodology, definitions, corrections and sources sit at the bottom of the records page |

## D. Facts the record does not supply, and which the exhibit therefore does not assert

These are not build gaps — they are the record's own limits, and each is stated
on the page and in the relevant receipt.

- **When any of the 155 sharing relationships was configured.** 151 of 155 rows
  carry no usable date; the four that do carry a *last update* stamp, not a start
  date. No other produced record dates any relationship.
- **Whether any plate record has ever been transferred, queried or viewed** under
  any of these settings. No transfer, query, hit or audit record exists in
  anything produced.
- **Whether the addenda were physically before council members** on 20 November
  2023, as opposed to in the clerk's file at execution the same day.
- **How 130 / 126 / 120 / 140 reconcile.** Four unit counts, four sources, no
  reconciling document. All four are published with their sources.
- **What "Customer Data" meant in November 2023.** The definitional chain runs
  out of the produced record into a vendor-hosted addendum that may change from
  time to time. The only customer-agreement edition in the record is dated
  September 2024 and post-dates the order.
- **What the "(F)" prefix (51 rows) or the "Inactive" prefix (5 rows) means.**
  Not defined in any located documentation.
- **What "Has system", "Retention" and the "InActive" alert-monitoring value
  mean** in the export. Vendor definitions were not located.
- **What fund account code `JAG00020` on the fixed-camera purchase order refers
  to.** No document maps it. Published as an open question only.
- **The complete universe of sharing relationships.** The export is filtered to
  "Sharing status : Sharing", so 155 is a floor, not a total.

## E. Carried forward but not re-verified

- The "~$729,000 Sourcewell reporting gap" from earlier RDP working notes was
  **not re-verified** in the controlling adjudication and is **not used anywhere
  in this exhibit**. It must not be added without re-opening the Sourcewell
  sales workbooks.

## F. Publication gates (also rendered on the narrative page)

1. **Right of reply** — City, DMPD, Motorola Solutions, Sourcewell, H-GAC.
2. **Prior-reporting sweep** — no claim in this exhibit has been checked against
   previously published reporting.
3. **Article integration** — headline, dek, byline, article link.
4. **Facsimile images** — none shipped.

Until all four are resolved, every page carries `noindex,nofollow` and a
prototype banner.
