#!/usr/bin/env python3
"""Build latest-investigations.json from the RDP Investigations Desk RSS feed.

Security posture:
- Fetches ONLY the hardcoded feed URL (no parameters, no user input).
- Refuses XML containing DOCTYPE/ENTITY declarations (entity-expansion guard).
- Emits sanitized plain-text JSON only: title, link, date, dateLabel, category.
- Strips all HTML from RSS fields; collapses whitespace; truncates lengths.
- Allowlists article-link hosts and normalizes legacy Substack links to the
  canonical investigations subdomain; strips query strings and fragments.
- Writes the output file only when item content actually changed, so the
  scheduled workflow produces no noise commits.

Run from the repository root:  python scripts/build_latest_investigations.py
Exit codes: 0 = success (changed or unchanged), 1 = fetch/parse failure
            (existing JSON is left untouched on failure).
"""

import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

FEED_URL = "https://investigations.restoring-democracy.org/feed"  # hardcoded; do not parameterize
CANONICAL_HOST = "investigations.restoring-democracy.org"
ALLOWED_LINK_HOSTS = {CANONICAL_HOST, "exposed1.substack.com"}
OUTPUT = Path("latest-investigations.json")
MAX_ITEMS = 11
MAX_TITLE_LEN = 200
MAX_CATEGORY_LEN = 40
MAX_BYTES = 2_000_000
TIMEOUT_SECONDS = 15

TAG_RE = re.compile(r"<[^>]*>")


def strip_text(value: str | None, limit: int) -> str:
    """Remove markup, decode entities, collapse whitespace, truncate."""
    if not value:
        return ""
    value = TAG_RE.sub("", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    return value[:limit]


def normalize_link(raw: str) -> str | None:
    """Allowlist host, force https + canonical host, drop query/fragment."""
    parts = urlsplit(raw.strip())
    if parts.scheme != "https" or parts.hostname not in ALLOWED_LINK_HOSTS:
        return None
    if not parts.path.startswith("/p/"):
        return None
    return urlunsplit(("https", CANONICAL_HOST, parts.path, "", ""))


def main() -> int:
    request = Request(
        FEED_URL,
        headers={"User-Agent": "rdp-latest-feed-builder/1.0 (+https://restoring-democracy.org)"},
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read(MAX_BYTES).decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001 - fail closed, keep last-good file
        print(f"Feed fetch failed: {exc}", file=sys.stderr)
        return 1

    head = raw[:4096].upper()
    if "<!DOCTYPE" in head or "<!ENTITY" in head:
        print("Refusing XML with DOCTYPE/ENTITY declarations", file=sys.stderr)
        return 1

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        print(f"Feed parse failed: {exc}", file=sys.stderr)
        return 1

    items = []
    for item in root.iter("item"):
        title = strip_text(item.findtext("title"), MAX_TITLE_LEN)
        link = normalize_link(item.findtext("link") or "")
        if not title or not link:
            continue
        date_iso = ""
        date_label = ""
        pub = (item.findtext("pubDate") or "").strip()
        if pub:
            try:
                parsed = parsedate_to_datetime(pub).astimezone(timezone.utc)
                date_iso = parsed.date().isoformat()
                date_label = f"{parsed:%b} {parsed.day}"
            except (TypeError, ValueError):
                pass
        category = strip_text(item.findtext("category"), MAX_CATEGORY_LEN) or "Investigation"
        items.append(
            {
                "title": title,
                "link": link,
                "date": date_iso,
                "dateLabel": date_label,
                "category": category,
            }
        )
        if len(items) >= MAX_ITEMS:
            break

    if not items:
        print("No valid items parsed; keeping existing file", file=sys.stderr)
        return 1

    if OUTPUT.exists():
        try:
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if existing.get("items") == items:
                print("Feed unchanged; nothing to write.")
                return 0
        except (json.JSONDecodeError, OSError):
            pass  # corrupt or missing -> rewrite below

    payload = {"source": FEED_URL, "items": items}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(items)} items.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
