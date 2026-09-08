"""Generate network_nodes.json + state_counts.json from the adjudicated export JSON.

Input : sharing_raw.json (verbatim cell values extracted from
        VehicleManager_DataSharing_Report_08-17-2026-10-40-20-575.xlsx)
Output: ../../data/network_nodes.json, ../../data/state_counts.json

FACT fields are copied verbatim from the export. EDITORIAL fields (slug,
display_name, category) are derived mechanically and marked as such in the
data dictionary. No dates are inferred. No geocoding is performed.
"""
import collections
import json
import os
import re
import sys

USPS = {
    "Alabama": "AL", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "District of Columbia": "DC", "Florida": "FL",
    "Georgia": "GA", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN",
    "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Michigan": "MI", "Mississippi": "MS", "Missouri": "MO", "Nebraska": "NE",
    "Nevada": "NV", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
    "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "South Carolina": "SC", "South Dakota": "SD", "Texas": "TX", "Utah": "UT",
    "Virginia": "VA", "West Virginia": "WV", "Wisconsin": "WI",
    "Wyoming": "WY",
}

# Editorial grouping. Membership is listed explicitly and labelled editorial in the UI.
FUSION_INTEL = {
    "Indiana Intelligence Fusion Center (IN)",
    "Mid States Organized Crime Information Center (MOCIC)",
    "Texas Financial Crimes Intelligence (TX)",
    "(F) Fairfax County Police - Criminal Intelligence Division",
}

RECEIVING_STATUS = {
    "Receiving": "configured_in",
    "Approval Required": "approval_required",
    "Declined": "declined",
    "No receiving relationship": "no_receiving",
}


def slugify(name, seen):
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    s = s[:52]
    base, n = s, 2
    while s in seen:
        s = base + "-" + str(n)
        n += 1
    seen.add(s)
    return s


def display_name(raw):
    """Editorial: strip the export's (F) / Inactive prefixes and the trailing
    state parenthetical. agency_raw is always shown alongside in the receipt."""
    s = re.sub(r"^\(F\)\s*", "", raw)
    s = re.sub(r"^Inactive\s+", "", s)
    s = re.sub(r"\s*\((?:[A-Z]{2})\)\s*$", "", s)
    return s.strip()


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    src = os.path.join(here, "sharing_raw.json")
    out_dir = os.path.abspath(os.path.join(here, "..", "..", "data"))
    raw = json.load(open(src, encoding="utf-8"))
    rows = raw["rows"]
    assert len(rows) == 155, "expected 155 export rows, got %d" % len(rows)

    header = {
        "package_version": "0.1.0-phase1",
        "generated_by": "Claude Code - Phase 1 prototype build",
        "source_document": "VehicleManager_DataSharing_Report_08-17-2026-10-40-20-575.xlsx",
        "source_date": "2026-08-17",
        "source_filter_row": raw["filter_row"].get("A", ""),
        "record_layer": "L5",
        "source_tag": "P",
        "universal_caveat": (
            "Every row below is a setting in the City's own platform export. "
            "Configuration is not evidence that any plate record was transferred, "
            "queried, viewed or acted on."
        ),
        "direction_note": (
            "Outbound / inbound labels are inferred from the vendor's own user-guide "
            "terminology (Share With / Accept Shares From). The export itself does not "
            "label direction. Reasonable inference, not a stated fact."
        ),
        "status_codes_legend": {
            "configured_out": "S - sharing configured (outbound from Des Moines)",
            "configured_in": "R - receiving relationship configured (inbound)",
            "approval_required": "R (pending) - request sent, not accepted in the export",
            "declined": "R (declined) - counterparty declined in the export",
            "no_receiving": "no receiving relationship recorded in the export",
            "unknown": "U - actual transfer or use not established",
        },
    }

    seen = set()
    nodes = []
    for r in rows:
        agency_raw = r["Agency"]
        state_raw = r["State"]
        recv_raw = r["Detection receiving"]
        nodes.append({
            "node_id": slugify(agency_raw, seen),
            "agency_raw": agency_raw,                         # FACT
            "display_name": display_name(agency_raw),         # EDITORIAL
            "state_raw": state_raw,                           # FACT
            "state_code": USPS[state_raw],                    # EDITORIAL (USPS)
            "agency_type_raw": r["Agency type"],              # FACT
            "hot_list_sharing": r["Hot list sharing"],        # FACT
            "hot_list_received": r["Hot list received"],      # FACT
            "detection_sharing": r["Detection sharing"],      # FACT
            "detection_receiving": recv_raw,                  # FACT
            "date_of_last_update": r["Date of last update"],  # FACT ("-" preserved)
            "has_system": r["Has system"],                    # FACT
            "retention": r["Retention"],                      # FACT
            "xlsx_row": r["xlsx_row"],                        # FACT
            "has_f_prefix": agency_raw.startswith("(F)"),
            "has_inactive_prefix": agency_raw.startswith("Inactive"),
            "status_out": "configured_out",
            "status_in": RECEIVING_STATUS[recv_raw],
            "is_iowa": state_raw == "Iowa",
            "is_federal_typed": r["Agency type"] == "Federal",
            "is_fusion_intel_named": agency_raw in FUSION_INTEL,
            "dated": r["Date of last update"] != "-",
            "receipt_id": "R-SHARE-ROW-%03d" % r["xlsx_row"],
        })

    # ---- recomputed totals, asserted against the adjudicated figures ----
    c_type = collections.Counter(n["agency_type_raw"] for n in nodes)
    c_recv = collections.Counter(n["detection_receiving"] for n in nodes)
    states = collections.Counter(n["state_raw"] for n in nodes)
    totals = {
        "agencies": len(nodes),
        "jurisdictions": len(states),
        "states_excl_dc": len([s for s in states if s != "District of Columbia"]),
        "dc": 1 if "District of Columbia" in states else 0,
        "iowa": sum(1 for n in nodes if n["is_iowa"]),
        "non_iowa": sum(1 for n in nodes if not n["is_iowa"]),
        "receiving": c_recv["Receiving"],
        "approval_required": c_recv["Approval Required"],
        "declined": c_recv["Declined"],
        "no_receiving": c_recv["No receiving relationship"],
        "undated_rows": sum(1 for n in nodes if not n["dated"]),
        "dated_rows": sum(1 for n in nodes if n["dated"]),
        "f_prefixed": sum(1 for n in nodes if n["has_f_prefix"]),
        "inactive_prefixed": sum(1 for n in nodes if n["has_inactive_prefix"]),
        "has_system_yes": sum(1 for n in nodes if n["has_system"] == "Yes"),
        "has_system_no": sum(1 for n in nodes if n["has_system"] == "No"),
        "retention_yes": sum(1 for n in nodes if n["retention"] == "Yes"),
        "retention_no": sum(1 for n in nodes if n["retention"] == "No"),
        "hot_list_active_out": sum(1 for n in nodes if n["hot_list_sharing"] == "Sharing"),
        "hot_list_active_in": sum(1 for n in nodes if n["hot_list_received"] == "Receiving"),
        "federal_typed": sum(1 for n in nodes if n["is_federal_typed"]),
        "by_type": dict(sorted(c_type.items(), key=lambda kv: -kv[1])),
    }

    expect = {
        "agencies": 155, "jurisdictions": 37, "states_excl_dc": 36, "dc": 1,
        "iowa": 14, "non_iowa": 141, "receiving": 120, "approval_required": 12,
        "declined": 8, "no_receiving": 15, "undated_rows": 151, "dated_rows": 4,
        "f_prefixed": 51, "inactive_prefixed": 5, "has_system_yes": 134,
        "has_system_no": 21, "retention_yes": 129, "retention_no": 26,
        "hot_list_active_out": 0, "hot_list_active_in": 0, "federal_typed": 5,
    }
    for k, v in expect.items():
        if totals[k] != v:
            sys.exit("ASSERT FAIL: %s recomputed %s, adjudicated %s" % (k, totals[k], v))

    state_rows = []
    for state, count in sorted(states.items()):
        members = [n for n in nodes if n["state_raw"] == state]
        state_rows.append({
            "state_raw": state,
            "state_code": USPS[state],
            "count": count,
            "by_type": dict(collections.Counter(n["agency_type_raw"] for n in members)),
            "by_receiving": dict(collections.Counter(n["detection_receiving"] for n in members)),
        })

    with open(os.path.join(out_dir, "network_nodes.json"), "w", encoding="utf-8") as f:
        json.dump({**header, "totals": totals, "rows": nodes}, f, indent=1)
    with open(os.path.join(out_dir, "state_counts.json"), "w", encoding="utf-8") as f:
        json.dump({**header, "totals": totals, "rows": state_rows}, f, indent=1)

    print("OK  155 nodes, 37 jurisdictions (36 states + D.C.); all totals match adjudication")


if __name__ == "__main__":
    main()
