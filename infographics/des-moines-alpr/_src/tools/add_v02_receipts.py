"""Add and update evidence receipts for the article-v0.2 alignment.

Run once from _src/tools/. Idempotent: re-running replaces the same rows.
"""
import io
import json
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
P = "../../data/evidence_receipts.json"
d = json.load(io.open(P, encoding="utf-8"))
by_id = {r["receipt_id"]: i for i, r in enumerate(d["rows"])}

NEW = [
    {
        "receipt_id": "R-SW-PNP-BOX3",
        "claim": "Asked to describe how the additions fit within the scope of the original solicitation, the change form's answer is one sentence.",
        "display_copy": "“The LPR is a key component of the WatchGuard Mobile Video System.”",
        "record_layer": "L0", "chain": "upstream", "source_tag": "P",
        "source_document": "Sourcewell Price and Product Change Request Form, contract 010720, effective 14 September 2021",
        "source_date": "2021-09-14",
        "page_or_row": "p. 2, fields 2 and 3",
        "source_excerpt": "2. Justification for Changes — Provide justification and documentation explaining the requested changes … : “Watchguard's VaaS offering is not complete without the key component - the License Plate Reader (LPR).”\n\n3. Product additions only — Describe how the product additions fit within the scope of the original RFP: “The LPR is a key component of the WatchGuard Mobile Video System.”",
        "evidence_status": "contracted",
        "caveat": "The prompt is the form's own printed text; the answer is the vendor's. Quote both, so the reader can see what was asked as well as what was said.",
        "what_it_does_not_establish": "It does not establish that the answer was inadequate, or that anyone assessed it. Whether the cooperative made a scope determination is not found in the records produced.",
        "related_receipts": ["R-SW-PNP-2021-09-14", "R-SW-SCOPE-RULE", "R-SW-RFP-010720"],
    },
    {
        "receipt_id": "R-SW-SCOPE-RULE",
        "claim": "The cooperative's own rule, printed on the form, is that additions must be within the scope of the original solicitation.",
        "display_copy": "“New products and related services may be added to the contract if they are within the scope of the original RFP.”",
        "record_layer": "L0", "chain": "upstream", "source_tag": "P",
        "source_document": "Sourcewell Price and Product Change Request Form, contract 010720 (printed instructions block)",
        "source_date": "2021-09-14",
        "page_or_row": "p. 1, Instructions",
        "source_excerpt": "A request for product or service changes, additions, or deletions to the Contract will be considered at any time throughout the Contract term. All modifications must be within the scope of the original RFP and be in the best interests of Sourcewell and Sourcewell Participating Entities. … Additions: New products and related services may be added to the contract if they are within the scope of the original RFP.",
        "evidence_status": "contracted",
        "caveat": "This is the form's standing instruction text, not a determination about this particular request.",
        "what_it_does_not_establish": "It does not establish that any scope determination was made for this change. RDP has asked the cooperative to produce whatever determination it made; no answer had been received when this exhibit was built.",
        "related_receipts": ["R-SW-PNP-BOX3", "R-SW-RFP-010720"],
    },
    {
        "receipt_id": "R-SW-PNP-SIG",
        "claim": "The change form was signed for the supplier on 10 September 2021 and accepted by the cooperative's chief procurement officer, taking effect 14 September 2021.",
        "display_copy": "Signed 10 Sept 2021 · accepted by the cooperative 14 Sept 2021",
        "record_layer": "L0", "chain": "upstream", "source_tag": "P",
        "source_document": "Sourcewell Price and Product Change Request Form, contract 010720",
        "source_date": "2021-09-14",
        "page_or_row": "p. 2, Approvals",
        "source_excerpt": "Supplier Offer: By: Giles Tipsword, MSSSI Vice President — Date 9-10-2021. Sourcewell Acceptance: “Sourcewell accepts Supplier's offer in this Price and Product Change Request. By Sourcewell's signature below, this document becomes an amendment to the above referenced Contract…” — Jeremy Schwartz, Sourcewell Chief Procurement Officer, DocuSigned 9/14/2021 10:38 AM CDT.",
        "evidence_status": "contracted",
        "caveat": "Both signers are named because both are acting in an official capacity on a public procurement record. The acceptance date is a DocuSign stamp visible in the page image.",
        "what_it_does_not_establish": "It does not establish what review, if any, preceded the acceptance.",
        "related_receipts": ["R-SW-PNP-BOX3"],
    },
    {
        "receipt_id": "R-ITEM-32",
        "claim": "Item 32 as it appears in the council agenda for 20 November 2023.",
        "display_copy": "Agenda item 32 — “$1,500,080”",
        "record_layer": "L1", "chain": "A", "source_tag": "P",
        "source_document": "Des Moines City Council agenda, meeting of 20 November 2023",
        "source_date": "2023-11-20",
        "page_or_row": "agenda p. 6, item 32 (RC 23-1629)",
        "source_excerpt": "Purchase from Motorola Solutions, Inc. (Greg Brown, CEO) of M500 In-Car Video Systems and Video Manager and five (5) year subscription for service and maintenance per Sourcewell Master Agreement for use by the Police Department, $1,500,080. (Council Communication No. 23-519)",
        "evidence_status": "described",
        "caveat": "Item 32 sat inside the consent agenda block, items 3 through 38, and was not removed for separate consideration.",
        "what_it_does_not_establish": "It does not establish what any council member read, knew, understood or intended.",
        "related_receipts": ["R-CONSENT-23-1597", "R-RC-23-1629-OP1"],
    },
    {
        "receipt_id": "R-POSTING-COPY-32",
        "claim": "The posting copy of Item 32 generated by the Clerk's system five days before the vote is two pages: the resolution and nothing else.",
        "display_copy": "Item 32 posting copy · generated 15 Nov 2023 · 2 pages",
        "record_layer": "L1", "chain": "A", "source_tag": "P",
        "source_document": "Item 32 posting copy from the City Clerk's system",
        "source_date": "2023-11-15",
        "page_or_row": "2 pages; PDF creation timestamp 2023-11-15 18:02:05 UTC",
        "source_excerpt": "The file the Clerk's system generated for Item 32 contains the two-page resolution and no attachment.",
        "evidence_status": "described",
        "caveat": "This says what the Clerk's system generated for the item. It does not establish what was in council members' packets, or what any member received, read, knew or understood.",
        "what_it_does_not_establish": "Which documents, if any, accompanied Item 32 in the packets distributed to council members. RDP has asked the City; no answer had been received when this exhibit was built.",
        "related_receipts": ["R-FILE-COMPOSITION", "R-ITEM-32"],
    },
    {
        "receipt_id": "R-PAGE-TERM-CHECK",
        "claim": "Across the twenty-one pages of the clerk's file that can be searched in a text layer, plate-reader language appears on page 9 alone.",
        "display_copy": "21 of 25 pages searched · plate-reader terms on page 9 only",
        "record_layer": "L2", "chain": "A", "source_tag": "P",
        "source_document": "Roll Call 23-1629 clerk's file, searched through the text-layer twins of its attachments in the same production",
        "source_date": "2026-09-07",
        "page_or_row": "packet pp. 5–25 searched; pp. 1–4 carried from the earlier OCR-and-visual pass",
        "source_excerpt": "Terms searched: license plate, plate reader, LPR, ALPR, Vigilant, LEARN, PlateSearch, VehicleManager, hot list, retention, data sharing.\n\nResult: packet p. 9 — LPR, Vigilant, VehicleManager, license plate, retention. Packet p. 8 — retention only, in a clause about video recordings. No other searched page carries any of the terms.\n\nThe page mapping was asserted against three anchors before any result was recorded.",
        "evidence_status": "not_established",
        "caveat": "The 25-page file is a scan with no text layer, so it cannot be searched directly. The search was run on the text-layer twins of the same attachments, produced in the same tranche, with the twin-to-packet page mapping asserted before use. Packet pages 1–4 have no twin and were not re-searched here.",
        "what_it_does_not_establish": "A term not found is a statement about the text layer searched. It is not proof of absence from the scanned image, and it establishes nothing about what any council member read.",
        "related_receipts": ["R-MVA-4.5", "R-FILE-COMPOSITION", "R-RC-ABSENT-TERMS"],
    },
    {
        "receipt_id": "R-QUOTE-ARITHMETIC",
        "claim": "The quote's four components sum exactly to the amount the Council approved.",
        "display_copy": "$1,287,000 + $145,500 + $500 + $67,080 = $1,500,080",
        "record_layer": "L3", "chain": "A", "source_tag": "P",
        "source_document": "Motorola QUOTE-2241626, recomputed from the line items",
        "source_date": "2023-10-23",
        "page_or_row": "quote pp. 3–4, all line items",
        "source_excerpt": "130 in-car systems with five years of cloud video service: $1,287,000.\nInstallation, removal, deployment and training: $145,500 (professional services $48,000 + in-car installation $52,000 + wireless-trigger installation $26,000 + video-system de-install $19,500).\nBasic Remote Support for WG LPR License: $500.\nM500 Basic ALPR VaaS, 130 x $516: $67,080.\nTotal: $1,500,080.",
        "evidence_status": "purchased",
        "caveat": "Recomputed to the cent. It ties exactly to the resolution amount and to the purchase order's five-year schedule ($470,480 + four years at $257,400).",
        "what_it_does_not_establish": "It does not establish what pricing material, if any, was distributed with the agenda.",
        "related_receipts": ["R-QUOTE-L10", "R-QUOTE-L9", "R-QUOTE-TOTAL", "R-PO-24209"],
    },
    {
        "receipt_id": "R-QUOTE-INCOMPLETE",
        "claim": "The quote as produced is not the complete ordering document: two different pages carry the same page number.",
        "display_copy": "Two produced pages of the same quote are both footered “Page 4”",
        "record_layer": "L3", "chain": "A", "source_tag": "P",
        "source_document": "Motorola QUOTE-2241626 as produced, and the separately produced product-description page",
        "source_date": "2023-10-23",
        "page_or_row": "quote p. 4 (footer “Page 4”); product-description page (footer “Page 4”)",
        "source_excerpt": "The product-description page produced separately by the City is footered “Page 4.” A different page of the produced quote is also footered “Page 4.”",
        "evidence_status": "not_established",
        "caveat": "This establishes that the ordering document in the public record is incomplete. It does not establish what the missing material contains.",
        "what_it_does_not_establish": "It does not establish that anything was withheld. RDP has asked the City for the complete quote; no answer had been received when this exhibit was built.",
        "related_receipts": ["R-QUOTE-INFO", "R-QUOTE-ARITHMETIC"],
    },
    {
        "receipt_id": "R-CODE-2-726",
        "claim": "City code expressly authorises procurement through cooperative contracting consortiums without competitive bidding.",
        "display_copy": "Municipal Code §2-726(b20) — cooperative purchasing exemption",
        "record_layer": "L1", "chain": "A", "source_tag": "P",
        "source_document": "Resolution / Roll Call 23-1629, third recital",
        "source_date": "2023-11-20",
        "page_or_row": "p. 1, recitals",
        "source_excerpt": "WHEREAS, Municipal Code section 2-726 (b20) provides for the procurement of goods and/or services from contracts that have been competitively established through cooperative group contracting consortiums for state government departments, institutions, agencies and political subdivisions, such as Sourcewell, without conforming to the competitive bidding requirements of the Procurement Ordinance; and",
        "ocr": True,
        "evidence_status": "contracted",
        "caveat": "This is exculpatory and belongs in the body of the account, not in a footnote. Iowa cities buy through cooperative contracts routinely.",
        "what_it_does_not_establish": "The reviewed records do not establish that any of these purchases violated Iowa law or city code. Nor do they establish what signature authority applied to the administratively executed instruments; RDP has asked the City.",
        "related_receipts": ["R-RC-23-1629-BID", "R-EPA-20230929"],
    },
    {
        "receipt_id": "R-GO-25-QUERY-REASON",
        "claim": "Department policy requires an employee querying plate-reader data to record the reason for the query.",
        "display_copy": "“they shall enter all information required detailing the reason for the query”",
        "record_layer": "L6", "chain": "other", "source_tag": "P",
        "source_document": "Des Moines Police Department General Order Chapter 25",
        "source_date": "2024-03-08",
        "page_or_row": "§VII.D.1.a",
        "source_excerpt": "When an employee queries the ALPR data, they shall enter all information required detailing the reason for the query.",
        "evidence_status": "contracted",
        "caveat": "The policy also limits use to enumerated investigative purposes — arrest warrants, missing and endangered persons, AMBER Alerts, stolen vehicles. Both belong in the account.",
        "what_it_does_not_establish": "It does not establish that any reason was recorded, or that any query occurred. The City has said it does not keep copies of search logs.",
        "related_receipts": ["R-GO-25-AUDIT", "R-LOGS-20251210"],
    },
    {
        "receipt_id": "R-CITY-FAVOURABLE",
        "claim": "The City's negotiators obtained three terms in its favour, visible in the executed documents.",
        "display_copy": "Click-through terms “deemed void upon presentation”; written notice and City approval of third-party term changes; a 30-day termination right on changes in Iowa law",
        "record_layer": "L2", "chain": "A", "source_tag": "P",
        "source_document": "Short Form Agreement W24-152 §3; Mobile Video Addendum §4.2 as negotiated; EPSLA §4.3",
        "source_date": "2023-11-20",
        "page_or_row": "clerk's file, W24-152 §3; MVA §4.2; EPSLA §4.3",
        "source_excerpt": "W24-152 §3: terms a city employee is asked to click through while using the software are “deemed void upon presentation.”\nMVA §4.2 as negotiated: if a third party changes its terms, “Customer shall be given written notice and must approve any changes.”\nEPSLA §4.3: the City may terminate on 30 days' notice “in the event the Equipment become substantially unusable by law enforcement due to changes in law in the state of Iowa.”",
        "evidence_status": "contracted",
        "caveat": "Exculpatory, and reported alongside the vendor-favourable terms rather than beneath them.",
        "what_it_does_not_establish": "Whether the click-through provision reaches a definition hosted at a vendor URL is not answered by any produced document.",
        "related_receipts": ["R-DPA-CHAIN", "R-EPSLA-4.3"],
    },
    {
        "receipt_id": "R-26-235-CORRECTION",
        "claim": "The City withdrew, as misstated, the 2026 council communication's sentence connecting the software to city traffic cameras.",
        "display_copy": "“The city traffic cameras are not connected to any ALPR system”",
        "record_layer": "L6", "chain": "other", "source_tag": "OPR",
        "source_document": "City of Des Moines final records response, item 4",
        "source_date": "2026-08-19",
        "page_or_row": "item 4",
        "source_excerpt": "Above verbiage used Council Communication 26-235 was misstated. The city traffic cameras are not connected to any ALPR system and do not work in any connection with ALPR technology utilized by the PD. The correct wording should have been ‘conjunction’ rather than ‘connection’ as in general investigative practices of utilizing multiple information sources.",
        "evidence_status": "described",
        "caveat": "Never say traffic cameras are integrated with the plate-reader system. The City's own platform inventory supports the correction: two fixed plate-reader sites, no traffic cameras.",
        "what_it_does_not_establish": "What the surviving word “conjunction” describes — traffic-camera footage used alongside plate data, through what system and under what policy — is not documented anywhere in the record. No corrected council communication has been located.",
        "related_receipts": ["R-CC-26-235", "R-SYSTEMS-FIXED"],
    },
    {
        "receipt_id": "R-FLOCK-MOU",
        "claim": "The one Flock document in the City's productions carries a blank Flock signature block.",
        "display_copy": "Flock MOU signed for the City 3 Feb 2026; the Flock Group, Inc. block is blank",
        "record_layer": "L6", "chain": "other", "source_tag": "P",
        "source_document": "Flock data-sharing memorandum of understanding produced by the City",
        "source_date": "2026-02-03",
        "page_or_row": "p. 5, signature block",
        "source_excerpt": "Signed for the City by the Chief of Police, dated 2-3-26. The FLOCK GROUP, INC. block — By, Name, Title and Date — is blank. The memorandum states that it becomes effective “on the last date specified below.”",
        "evidence_status": "not_established",
        "caveat": "Read from the page image, not by OCR. Included only to keep this exhibit distinct from RDP's separate Flock reporting.",
        "what_it_does_not_establish": "It does not establish that the memorandum is or is not in force, or that any relationship with Flock exists. No Flock cameras, accounts, searches or payments appear anywhere in the records reviewed.",
        "related_receipts": ["R-FLOCK-SEPARATION"],
    },
]

for r in NEW:
    if r["receipt_id"] in by_id:
        d["rows"][by_id[r["receipt_id"]]] = r
    else:
        d["rows"].append(r)

# --- targeted updates to existing receipts, from ledger v0.2 -------------
R = {r["receipt_id"]: r for r in d["rows"]}

R["R-SW-PNP-2021-09-14"]["source_excerpt"] = (
    "1. Changed Product List — List the products and/or services that are changing from "
    "the previous contract price list, along with the percentage change for each item or "
    "category:\n\n“WatchGuard Video mistakenly left off a key component of our VaaS "
    "offering - The License Plate Reader (LPR). It is now included in the VaaS price list.”"
)
R["R-SW-PNP-2021-09-14"]["source_date"] = "2021-09-14"
R["R-SW-PNP-2021-09-14"]["page_or_row"] = "p. 1, field 1 “Changed Product List”"

R["R-W23-383"]["source_excerpt"] = (
    "Scope, §1.a: “Contractor will provide automated license plate recognition software "
    "Products.” Term to 6/30/2026, renewable up to five times annually. Signed for the "
    "City of Des Moines by Nickolas Schaul, Director of Finance; for the vendor by Norberto "
    "Colon for Vigilant Solutions, LLC; approved as to form by Glenna K. Frank."
)

R["R-DPA-CHAIN"]["source_excerpt"] = (
    "The Mobile Video Addendum defines “Master Agreement” as Sourcewell 010720-WCH "
    "plus W24-152. Neither of those documents defines “Customer Data.”\n\nThe "
    "Motorola Solutions Customer Agreement does not define it either. It says: "
    "“'Customer Data' has the meaning given to it in the DPA” — the Data "
    "Processing Addendum, “as updated, supplemented, or superseded from time to time,” "
    "which “is located at” a URL on motorolasolutions.com. The same passage adds: "
    "“Where terms or provisions in the Agreement conflict with terms or provisions of the "
    "DPA, the terms or provisions of the DPA will control.”"
)

R["R-AUDIT-20251001"]["caveat"] = (
    "The City treats other audit material as confidential intelligence data under Iowa Code "
    "§692.8, and says spot audits are conducted in response to complaints or allegations "
    "of misuse. The reviewer's name is held back."
)

json.dump(d, io.open(P, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("receipts now: %d" % len(d["rows"]))
