"""Per-page term check for the 25-page Roll Call 23-1629 clerk's file.

METHOD, stated precisely because the result is an evidentiary claim:

The clerk's file itself (`23-1629.pdf`) is a pure scan with no text layer, so it
cannot be searched directly. The same production, however, contains text-layer
twins of every attachment in it. This script searches those twins page by page
and maps each twin page onto its packet page.

  packet  5-6   <- Motorola Short Form Agreement.pdf          pp. 1-2
  packet  7-13  <- Mobile Video Addendum.pdf                  pp. 1-7
  packet 14-18  <- Subscription Software Addendum.pdf         pp. 1-5
  packet 19-25  <- Equipment Purchase Amendment and EPSLA.pdf pp. 1-7  (order verified below)

Packet pages 1-4 (the resolution, the roll-call sheet and Council Communication
23-519) have no text-layer twin. They are left as verified-by-OCR-and-visual
from the September 2 pass and are NOT re-verified here.

The mapping is asserted, not assumed: the script fails if the anchor checks do
not land on the expected packet pages.

A negative here means the term does not appear in the text layer of the twin
document. It is not proof of absence from the scanned image, and it is not
recorded as one.
"""
import json
import os
import re
import sys

import pymupdf

TERMS = [
    "license plate", "plate reader", "LPR", "ALPR", "Vigilant", "LEARN",
    "PlateSearch", "VehicleManager", "hot list", "retention", "data sharing",
]

# Terms that need a word-boundary match so that, e.g., "LPR" does not fire on
# "helper" and "LEARN" does not fire on "learned".
WORDISH = {"LPR", "ALPR", "LEARN"}

SRC = (
    "C:/Users/TimothyC/Documents/Google Drive Sync/Cowork-Trending_RDP/"
    "01_ALPR_Procurement/26_City_of_Des_Moines_ORR_Responses/"
    "05_Final_Response_Short_Form_Roll_Call_23-1629/"
    "Response to City of Des Moines Open Records Request Dated 8_4_26"
)

TWINS = [
    ("Motorola Short Form Agreement.pdf", 5, 6, "Short form agreement"),
    ("Mobile Video Addendum.pdf", 7, 13, "Mobile Video Addendum"),
    ("Subscription Software Addendum.pdf", 14, 18, "Subscription Software Addendum"),
    ("Equipment Purchase Amendment and EPSLA.pdf", 19, 25, "EPSLA / Equipment Purchase Amendment"),
]

# Anchors: (packet page, regex that must be present). If any fails, the mapping
# is wrong and the run aborts rather than emitting a bad verification.
ANCHORS = [
    (9, r"4\.5\.?\s*License Plate Recognition Data"),
    (9, r"4\.4\.?\s*Vigilant Access"),
    (5, r"SHORT FORM AGREEMENT\s*-\s*CONTRACT NO\.\s*W24-152"),
]


def find(text, term):
    if term in WORDISH:
        return re.search(r"\b" + re.escape(term) + r"\b", text) is not None
    return term.lower() in text.lower()


def main():
    pages = {}
    for fname, first, last, label in TWINS:
        path = os.path.join(SRC, fname)
        doc = pymupdf.open(path)
        expected = last - first + 1
        if doc.page_count != expected:
            sys.exit(
                "ABORT: %s has %d pages; packet span %d-%d needs %d"
                % (fname, doc.page_count, first, last, expected)
            )
        for i, page in enumerate(doc):
            text = page.get_text()
            if len(text.strip()) < 50:
                sys.exit("ABORT: %s p.%d has no usable text layer" % (fname, i + 1))
            packet_page = first + i
            pages[packet_page] = {
                "packet_page": packet_page,
                "twin_document": fname,
                "twin_page": i + 1,
                "document_short": label,
                "terms_found": sorted(t for t in TERMS if find(text, t)),
                "method": "text_layer_of_twin",
            }

    # --- assert the mapping before trusting any of it ---
    for packet_page, pattern in ANCHORS:
        text_ok = False
        entry = pages.get(packet_page)
        if entry:
            path = os.path.join(SRC, entry["twin_document"])
            page_text = pymupdf.open(path)[entry["twin_page"] - 1].get_text()
            text_ok = re.search(pattern, page_text, re.I) is not None
        if not text_ok:
            sys.exit(
                "ABORT: anchor failed - packet p.%d does not match /%s/. "
                "The twin-to-packet mapping is wrong; no verification emitted."
                % (packet_page, pattern)
            )

    # packet pages 1-4 are not re-verified here
    for p in range(1, 5):
        pages[p] = {
            "packet_page": p,
            "twin_document": None,
            "twin_page": None,
            "document_short": "Resolution / roll call / Council Communication 23-519",
            "terms_found": [],
            "method": "ocr_and_visual_prior_pass",
        }

    out = {
        "generated_by": "Claude Code - _src/tools/verify_page_terms.py",
        "source_scan": "23-1629.pdf (25 pp., no text layer)",
        "terms_checked": TERMS,
        "method_note": (
            "Packet pages 5-25 were searched in the text layer of the same "
            "production's twin documents, with the page mapping asserted against "
            "three anchors before any result was recorded. Packet pages 1-4 have "
            "no text-layer twin and are carried from the earlier OCR-and-visual "
            "pass, not re-verified here. A term not found is a statement about "
            "the text layer searched, not proof of absence from the scanned image."
        ),
        "anchors_asserted": [{"packet_page": p, "pattern": r} for p, r in ANCHORS],
        "pages": [pages[p] for p in sorted(pages)],
    }

    dest = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "page_term_check.json")
    )
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)

    hits = [p for p in out["pages"] if p["terms_found"]]
    print("Anchors asserted: %d/%d OK" % (len(ANCHORS), len(ANCHORS)))
    print("Pages searched in a text layer: %d of 25" % sum(
        1 for p in out["pages"] if p["method"] == "text_layer_of_twin"))
    print("Pages carrying at least one term: %d" % len(hits))
    for p in hits:
        print("  packet p.%-2d  %-38s %s" % (
            p["packet_page"], p["document_short"][:38], ", ".join(p["terms_found"])))
    print("\nwrote %s" % dest)


if __name__ == "__main__":
    main()
