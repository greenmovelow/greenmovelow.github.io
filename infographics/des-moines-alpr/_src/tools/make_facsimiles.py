"""Render facsimile crops of produced public records for the receipt drawer.

Rules this script obeys:
  - Only records already produced to RDP are rendered. Nothing is reconstructed,
    redrawn, enhanced or composited.
  - Every crop gets a sidecar JSON recording the source file, its SHA-256, the
    page, the crop box in PDF points, and the render DPI, so any crop can be
    re-derived from the original and checked.
  - Crops are region crops of a rendered page. No pixel in them is altered.
  - Non-official handwritten signatures are excluded by crop box, not by
    retouching. Where a signature block is included, it is because the signer is
    acting in an official capacity and the article names them.

Output: ../../assets/facsimiles/<receipt_id>.png  + .json
"""
import hashlib
import json
import os
import sys

import pymupdf

CORPUS = (
    "C:/Users/TimothyC/Documents/Google Drive Sync/Cowork-Trending_RDP/01_ALPR_Procurement"
)
T05 = os.path.join(
    CORPUS,
    "26_City_of_Des_Moines_ORR_Responses/05_Final_Response_Short_Form_Roll_Call_23-1629/"
    "Response to City of Des Moines Open Records Request Dated 8_4_26",
)
SW = os.path.join(CORPUS, "19_Sourcewell_Production")

DPI = 200

# receipt_id -> (source pdf, 1-based page, crop box in PDF points or None, caption)
CROPS = {
    "R-SW-PNP-2021-09-14": (
        os.path.join(SW, "WatchGuard PnP 010720 Eff. 9-14-21.pdf"), 1,
        (32, 606, 578, 706),
        "Field 1, “Changed Product List,” on the Sourcewell Price and Product "
        "Change Request Form effective 14 September 2021.",
    ),
    "R-SW-PNP-BOX3": (
        os.path.join(SW, "WatchGuard PnP 010720 Eff. 9-14-21.pdf"), 2,
        (32, 50, 578, 226),
        "Fields 2 and 3 of the same form. Field 3’s printed prompt asks the "
        "vendor to describe how the additions fit within the scope of the "
        "original solicitation.",
    ),
    "R-SW-SCOPE-RULE": (
        os.path.join(SW, "WatchGuard PnP 010720 Eff. 9-14-21.pdf"), 1,
        (32, 205, 578, 312),
        "The form’s own printed instructions, stating the cooperative’s rule "
        "that additions must be within the scope of the original RFP.",
    ),
    "R-SW-PNP-SIG": (
        os.path.join(SW, "WatchGuard PnP 010720 Eff. 9-14-21.pdf"), 2,
        (32, 430, 578, 706),
        "The approvals block: the supplier’s offer and the cooperative’s "
        "acceptance. Both signers are acting in an official capacity.",
    ),
    "R-RC-23-1629-OP1": (
        os.path.join(T05, "23-1629.pdf"), 1,
        (72, 538, 566, 722),
        "The resolution’s two operative clauses, Roll Call 23-1629, "
        "20 November 2023.",
    ),
    "R-RC-23-1629-BID": (
        os.path.join(T05, "23-1629.pdf"), 1,
        (72, 250, 566, 320),
        "The competitive-bid recital in the resolution.",
    ),
    "R-MVA-4.5": (
        os.path.join(T05, "23-1629.pdf"), 9,
        (72, 110, 552, 440),
        "Page 9 of the 25-page clerk’s roll-call file: sections 4.4 and 4.5 of "
        "the Mobile Video Addendum.",
    ),
    "R-QUOTE-L10": (
        os.path.join(T05, "Updated DMPD Quote 11-7-23.pdf"), 4,
        (30, 308, 596, 392),
        "The two plate-reader lines in Motorola quote 2241626.",
    ),
    "R-QUOTE-TOTAL": (
        os.path.join(T05, "Updated DMPD Quote 11-7-23.pdf"), 4,
        (30, 566, 596, 604),
        "The quote’s grand total, which ties exactly to the amount the Council "
        "approved.",
    ),
    "R-QUOTE-INFO": (
        os.path.join(T05, "Info about purchase.pdf"), 1,
        None,
        "The product-description page of the same quote, produced separately by "
        "the City. It is footered “Page 4,” as is a different page of the "
        "produced quote.",
    ),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    out_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "assets", "facsimiles")
    )
    os.makedirs(out_dir, exist_ok=True)

    made, missing = [], []
    for receipt_id, (src, page_no, box, caption) in CROPS.items():
        if not os.path.exists(src):
            missing.append((receipt_id, src))
            continue
        doc = pymupdf.open(src)
        if page_no > doc.page_count:
            missing.append((receipt_id, "%s (page %d of %d)" % (src, page_no, doc.page_count)))
            continue
        page = doc[page_no - 1]
        clip = pymupdf.Rect(*box) if box else None
        pix = page.get_pixmap(dpi=DPI, clip=clip)
        png = os.path.join(out_dir, receipt_id + ".png")
        pix.save(png)

        sidecar = {
            "receipt_id": receipt_id,
            "source_document": os.path.basename(src),
            "source_path_relative_to_corpus": os.path.relpath(src, CORPUS).replace("\\", "/"),
            "source_sha256": sha256(src),
            "page": page_no,
            "page_size_pt": [round(page.rect.width, 1), round(page.rect.height, 1)],
            "crop_box_pt": list(box) if box else "full page",
            "render_dpi": DPI,
            "pixels": [pix.width, pix.height],
            "caption": caption,
            "alteration": "none - region crop of a straight render; no pixel modified",
        }
        with open(os.path.join(out_dir, receipt_id + ".json"), "w", encoding="utf-8") as f:
            json.dump(sidecar, f, indent=1, ensure_ascii=False)
        made.append((receipt_id, pix.width, pix.height, os.path.getsize(png)))

    for rid, w, h, size in made:
        print("  %-24s %4dx%-4d  %6.1f KB" % (rid, w, h, size / 1024))
    if missing:
        print("\nNOT FOUND (receipt keeps its placeholder):")
        for rid, src in missing:
            print("  %-24s %s" % (rid, src))
    print("\n%d crop(s) written to %s" % (len(made), out_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
