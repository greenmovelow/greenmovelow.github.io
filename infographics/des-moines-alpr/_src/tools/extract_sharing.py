"""Extract the Aug 17 2026 VehicleManager Data Sharing export to JSON.

Reads the .xlsx with the standard library only (no openpyxl available).
Emits verbatim cell values; performs no normalisation beyond stripping
Excel's shared-string XML markup.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def shared_strings(z):
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out


def col_of(ref):
    return re.match(r"([A-Z]+)", ref).group(1)


def row_of(ref):
    return int(re.search(r"(\d+)", ref).group(1))


def sheet_rows(z, sheet_path, sst):
    root = ET.fromstring(z.read(sheet_path))
    rows = {}
    for row in root.iter(f"{NS}row"):
        r = int(row.get("r"))
        cells = {}
        for c in row.findall(f"{NS}c"):
            ref = c.get("r")
            t = c.get("t")
            v = c.find(f"{NS}v")
            if t == "s" and v is not None:
                val = sst[int(v.text)]
            elif t == "inlineStr":
                is_el = c.find(f"{NS}is")
                val = "".join(x.text or "" for x in is_el.iter(f"{NS}t")) if is_el is not None else ""
            elif v is not None:
                val = v.text
            else:
                val = ""
            cells[col_of(ref)] = val
        rows[r] = cells
    return rows


def main(path, out_path):
    with zipfile.ZipFile(path) as z:
        sst = shared_strings(z)
        names = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
        rows = sheet_rows(z, sorted(names)[0], sst)

    header_row = 8
    data_start = 9
    cols = "ABCDEFGHIJ"
    headers = [rows.get(header_row, {}).get(c, "") for c in cols]
    print("HEADERS:", headers, file=sys.stderr)
    print("FILTER ROW 6:", rows.get(6, {}), file=sys.stderr)

    out = []
    r = data_start
    while r in rows:
        cells = rows[r]
        rec = {"xlsx_row": r}
        for c, h in zip(cols, headers):
            rec[h] = cells.get(c, "")
        if not rec.get(headers[0]):
            break
        out.append(rec)
        r += 1

    print("ROWS:", len(out), file=sys.stderr)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"headers": headers, "filter_row": rows.get(6, {}), "rows": out}, f, indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
