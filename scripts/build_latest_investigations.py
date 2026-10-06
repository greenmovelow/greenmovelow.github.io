#!/usr/bin/env python3
"""Build latest-investigations.json from the RDP Investigations Desk RSS feed.

Security posture:
- Fetches the fixed public feed, publication homepage, and post metadata URLs.
- Refuses XML containing DOCTYPE/ENTITY declarations (entity-expansion guard).
- Emits sanitized feed fields and the assigned section ID/name only.
- Strips all HTML from RSS fields; collapses whitespace; truncates lengths.
- Allowlists article-link hosts and normalizes legacy Substack links to the
  canonical investigations subdomain; strips query strings and fragments.
- Keeps last-known section metadata on lookup failure; never guesses from tags.
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
from urllib.request import HTTPRedirectHandler, Request, build_opener

FEED_URL = "https://investigations.restoring-democracy.org/feed"  # hardcoded; do not parameterize
CANONICAL_HOST = "investigations.restoring-democracy.org"
ALLOWED_LINK_HOSTS = {CANONICAL_HOST, "exposed1.substack.com"}
OUTPUT = Path("latest-investigations.json")
MAX_ITEMS = 11
MAX_TITLE_LEN = 200
PUBLICATION_URL = f"https://{CANONICAL_HOST}"
POST_API_PREFIX = f"{PUBLICATION_URL}/api/v1/posts/"
MAX_CATEGORY_LEN = 100
MAX_BYTES = 2_000_000
TIMEOUT_SECONDS = 15
METADATA_TIMEOUT_SECONDS = 8

# Supporting/source posts remain available at the Investigations Desk, but they
# are not standalone publications and must not displace reporting in this feed.
SUPPORTING_TITLE_PREFIXES = ("evidence locker:",)
SUPPORTING_PATH_PREFIXES = ("/p/evidence-locker-",)

TAG_RE = re.compile(r"<[^>]*>")
POST_PATH_RE = re.compile(r"/p/([a-z0-9][a-z0-9-]{0,249})/?\Z")
PRELOADS_RE = re.compile(r'window\._preloads\s*=\s*JSON\.parse\(("(?:\\.|[^"\\])*")\)')


def strip_text(value: str | None, limit: int) -> str:
    """Remove markup, decode entities, collapse whitespace, truncate."""
    if not isinstance(value, str) or not value:
        return ""
    value = TAG_RE.sub("", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    return value[:limit]


class PublicationRedirectHandler(HTTPRedirectHandler):
    """Keep redirects on the same allowlisted public publication hosts."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parts = urlsplit(newurl)
        if parts.scheme != "https" or parts.hostname not in ALLOWED_LINK_HOSTS:
            raise ValueError("Refusing redirect outside the publication")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_text(url: str, timeout: int = TIMEOUT_SECONDS) -> str:
    request = Request(
        url,
        headers={"User-Agent": "rdp-latest-feed-builder/2.0 (+https://restoring-democracy.org)"},
    )
    with build_opener(PublicationRedirectHandler()).open(request, timeout=timeout) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Response exceeds the feed builder's size limit")
    return raw.decode("utf-8", "replace")


def valid_section_id(value) -> bool:
    return type(value) is int and value > 0


def cached_metadata(item: dict) -> dict:
    """Reuse only metadata produced by a successful section lookup, not legacy labels."""
    section_id = item.get("sectionId")
    category = strip_text(item.get("category"), MAX_CATEGORY_LEN)
    if valid_section_id(section_id) and item.get("categorySource") == "section" and category:
        return {"sectionId": section_id, "category": category, "categorySource": "section"}
    return {"sectionId": None, "category": "", "categorySource": ""}


def fetch_sections() -> dict[int, str]:
    """Resolve public section IDs without executing Substack's JavaScript."""
    raw = fetch_text(PUBLICATION_URL, METADATA_TIMEOUT_SECONDS)
    match = PRELOADS_RE.search(raw)
    if not match:
        raise ValueError("Publication section data not found")
    preloads = json.loads(json.loads(match.group(1)))
    sections = preloads["pub"]["sections"]
    if not isinstance(sections, list):
        raise ValueError("Unexpected publication section data")
    names = {}
    for section in sections:
        if not isinstance(section, dict):
            continue
        section_id = section.get("id")
        name = strip_text(section.get("name"), MAX_CATEGORY_LEN)
        if valid_section_id(section_id) and name:
            names[section_id] = name
    return names


def enrich_item(item: dict, sections: dict[int, str], previous: dict) -> None:
    """Use the assigned section, even when tags or navigation groups differ.

    An explicit null section means unassigned. An unknown section stays blank;
    a failed lookup retains last-known metadata for this exact article instead.
    No body, tag, subscriber, or recipient data is saved in the output.
    """
    fallback = cached_metadata(previous)
    slug = POST_PATH_RE.fullmatch(urlsplit(item["link"]).path).group(1)
    try:
        post = json.loads(fetch_text(POST_API_PREFIX + slug, METADATA_TIMEOUT_SECONDS))
        if not isinstance(post, dict) or post.get("slug") != slug or "section_id" not in post:
            raise ValueError("Unexpected post metadata")
        section_id = post["section_id"]
        if section_id is not None and not valid_section_id(section_id):
            raise ValueError("Invalid post section ID")
        category = sections.get(section_id, "")
        if section_id is not None and not category:
            # A section-name lookup may fail independently of the post lookup.
            # Reuse a name only if its verified ID still matches the assignment.
            if fallback["sectionId"] == section_id:
                category = fallback["category"]
            else:
                print(f"Unresolved section {section_id} for {slug}; leaving category blank", file=sys.stderr)
        item.update({
            "sectionId": section_id,
            "category": category,
            "categorySource": "section" if category else "",
        })
    except Exception as exc:  # noqa: BLE001 - metadata failure must not stop RSS updates
        print(f"Section lookup failed for {slug}: {exc}; retaining last-known label", file=sys.stderr)
        item.update(fallback)


def normalize_link(raw: str) -> str | None:
    """Allowlist host, force https + canonical host, drop query/fragment."""
    try:
        parts = urlsplit(raw.strip())
    except ValueError:
        return None
    if parts.scheme != "https" or parts.hostname not in ALLOWED_LINK_HOSTS:
        return None
    if not POST_PATH_RE.fullmatch(parts.path):
        return None
    return urlunsplit(("https", CANONICAL_HOST, parts.path, "", ""))


def is_supporting_material(title: str, link: str) -> bool:
    """Identify companion/source pages that do not belong in publication feeds."""
    normalized_title = title.casefold().lstrip()
    path = urlsplit(link).path.casefold()
    return normalized_title.startswith(SUPPORTING_TITLE_PREFIXES) or path.startswith(
        SUPPORTING_PATH_PREFIXES
    )


def main() -> int:
    try:
        raw = fetch_text(FEED_URL)
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
        if is_supporting_material(title, link):
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
        items.append(
            {
                "title": title,
                "link": link,
                "date": date_iso,
                "dateLabel": date_label,
            }
        )
        if len(items) >= MAX_ITEMS:
            break

    if not items:
        print("No valid items parsed; keeping existing file", file=sys.stderr)
        return 1

    existing = {}
    if OUTPUT.exists():
        try:
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass  # corrupt or missing -> rewrite below
    if not isinstance(existing, dict):
        existing = {}
    previous_items = existing.get("items", [])
    if not isinstance(previous_items, list):
        previous_items = []
    previous = {
        item["link"]: item for item in previous_items
        if isinstance(item, dict) and isinstance(item.get("link"), str)
    }
    # Last-good labels also form a small section-name cache for new posts that
    # share a section. Refresh all current items so edits to assignments appear
    # even when the RSS titles and dates are unchanged.
    sections = {}
    for old in previous.values():
        metadata = cached_metadata(old)
        if metadata["category"]:
            sections[metadata["sectionId"]] = metadata["category"]
    try:
        sections = fetch_sections()
    except Exception as exc:  # noqa: BLE001 - use last-known names if publication lookup fails
        print(f"Publication section lookup failed: {exc}; using cached names", file=sys.stderr)
    for item in items:
        enrich_item(item, sections, previous.get(item["link"], {}))

    if existing.get("items") == items:
        print("Feed unchanged; nothing to write.")
        return 0

    payload = {"source": FEED_URL, "items": items}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(items)} items.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
