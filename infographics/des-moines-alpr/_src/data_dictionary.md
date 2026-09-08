# Data dictionary — fact vs editorial

**The rule in one line:** a field is a **fact** only if it is copied from a
record cell or a record's text, or is an arithmetic recount of such cells.
Everything else — labels, groupings, tile positions, colours, display names,
chapter copy — is **editorial** and is marked so here and in the UI.

Direction of sharing is a **reasonable inference** from vendor terminology, not
a stated fact, and is labelled as such wherever it appears.

---

## `network_nodes.json` — 155 rows

Source: `VehicleManager_DataSharing_Report_08-17-2026-10-40-20-575.xlsx`,
sheet rows 9–163, filter banner `Data type : Detection, Sharing status : Sharing`.

| Field | Fact / editorial | Notes |
|---|---|---|
| `agency_raw` | **fact** | verbatim `Agency` cell, including `(F)` and `Inactive` prefixes |
| `state_raw` | **fact** | verbatim `State` cell |
| `agency_type_raw` | **fact** | verbatim `Agency type` — Police / Sheriff / Other / State / Federal / State Police |
| `hot_list_sharing`, `hot_list_received`, `detection_sharing`, `detection_receiving`, `date_of_last_update`, `has_system`, `retention` | **fact** | verbatim cells; `"-"` preserved as `"-"` |
| `xlsx_row` | **fact** | sheet row number |
| `has_f_prefix`, `has_inactive_prefix`, `dated`, `is_iowa`, `is_federal_typed` | **fact (mechanical)** | derived by string/equality test on a fact field |
| `node_id` | editorial | stable slug |
| `display_name` | editorial | prefixes and trailing state parenthetical stripped; `agency_raw` is always shown alongside in the receipt |
| `state_code` | editorial | USPS code for the verbatim state name |
| `status_out`, `status_in` | fact by 1:1 mapping | `status_in` maps `detection_receiving` onto `configured_in` / `approval_required` / `declined` / `no_receiving` |
| `is_fusion_intel_named` | **editorial grouping** | RDP's grouping of four agencies whose *names* contain a fusion-centre or criminal-intelligence term. Not a category in the export. Membership is listed explicitly in the generator and labelled editorial in the UI. |
| `receipt_id` | editorial | `R-SHARE-ROW-<sheet row>` |

**No geocoordinates exist in this file.** Placement is by `state_code` into
`state_tiles.json`.

## `state_counts.json` — 37 rows

`state_raw`, `state_code` as above. `count`, `by_type`, `by_receiving` are
**facts** (recounts). The `totals` object is a **fact** and is asserted against
the adjudicated figures at generation time and again at lint time.

## `state_tiles.json` — 51 tiles

`state_code`, `state_name` are facts about US jurisdictions. `col`, `row` and
`is_home` are **entirely editorial** — a standard tile cartogram, not a map
projection. Tiles for jurisdictions with no listed agency render empty and are
labelled as such. No agency has been geocoded.

## `procurement_timeline.json`

| Field | Fact / editorial |
|---|---|
| `date` | **fact** |
| `date_precision` | **fact-quality flag** — `day`, `month`, `recital` (known only from a recital in another instrument), `ocr_handwriting` |
| `chain` | fact (from the contract genealogy) |
| `instrument`, `amount_usd` | **fact** |
| `council_action` | fact / not-found — `documented`, `none_found`, `n_a`. `none_found` means no council action appears in the records reviewed; it is not a finding that none exists. |
| `record_layer`, `plane` | editorial mapping |
| `title`, `summary` | editorial, drawn only from the adjudicated wording |
| `status_code` | editorial mapping onto the status vocabulary |

Vendor sales-personnel names are omitted by rule. City officials acting in an
official capacity are named where the instrument names them.

## `chain_registry.json`

`vendor_of_record`, `cooperative_vehicle`, `city_short_form`, `addenda`,
`ordering_documents`, `city_pos`, `amount_total_usd` are **facts**.
`label`, `one_line`, `dock_label`, `glyph`, `ink_token` are editorial.
`council_action` is fact / not-found as above.

## `page_composition.json`

`page`, `document`, section ranges and `post_vote_date` are **facts** about the
25-page file. `label` is editorial. `contains_lpr_terms` is a **fact only where
`term_check` is `verified`**; pages marked `not_individually_checked` carry that
flag in the UI and their `false` value must not be read as a verified absence.

## `parts_list.json`

`sku_raw`, `qty`, `unit_price_usd`, `line_total_usd`, `document`, `date` are
**facts**. `described_in_council_summary` is a **fact** — true only for the
in-car video system, the video evidence management software and the
$1,500,080 total. `label`, `establishes`, `does_not_establish` and `caveat` are
editorial statements written from the adjudication.

## `platform_summary.json`

All counts are **facts**, recomputed from the three 17 August 2026 exports.
`counting_convention` and `alternative_convention` are editorial explanations of
a real ambiguity in the systems file. No account name is present, and the user
export is not an input to any shipped file.

## `evidence_receipts.json`

| Field | Fact / editorial |
|---|---|
| `source_document`, `source_date`, `page_or_row` | **fact** |
| `source_excerpt` | **fact** — exact text; `ocr: true` where read from a scan |
| `claim`, `display_copy` | editorial wording, written to the publication-safe ledger |
| `record_layer`, `evidence_status` | editorial mapping |
| `source_tag` | fact-quality flag — P / OPR / V / RI / U / NF, rendered as words, never as a bare letter |
| `caveat`, `what_it_does_not_establish` | editorial, and mandatory: the linter fails the build if an L2 receipt has no caveat or an L5 receipt never states its limit |

`R-SHARE-ROW-<n>` receipts are generated at runtime from `network_nodes.json`
and reproduce all ten columns of the source row verbatim.
