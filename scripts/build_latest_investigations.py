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
- Renders the same items into the homepage's #latest-feed block (between the
  latest-feed:start/end markers in index.html) so the list is in the initial
  HTML: no layout shift when it loads, and readable without JavaScript. The
  markup mirrors the homepage refresh script; scripts/test_latest_feed_render.js
  checks that the two stay identical.

Run from the repository root:  python scripts/build_latest_investigations.py
Re-render the homepage block from the committed JSON (no network):
                               python scripts/build_latest_investigations.py --render-only
Exit codes: 0 = success (changed or unchanged), 1 = fetch/parse failure
            or missing homepage markers (existing files are left untouched).
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
HOMEPAGE = Path("index.html")
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

# Homepage block. Rows must match the markup built by the refresh script in
# index.html exactly; scripts/test_latest_feed_render.js enforces this.
FEED_LINK_PREFIX = f"https://{CANONICAL_HOST}/"
FEED_BLOCK_RE = re.compile(
    r"(?P<start>[ \t]*<!-- latest-feed:start\b[^\n]*-->\n)(?P<body>.*?)(?P<end>[ \t]*<!-- latest-feed:end -->)",
    re.DOTALL,
)
FEED_FALLBACK_HTML = (
    '<p class="py-2.5 text-sm text-brand-sand">'
    "Read the latest reporting in the investigations archive below.</p>"
)
FEED_COLUMNS_HTML = (
    '<div class="feed-columns" aria-hidden="true">'
    "<span>Date</span><span>Publication</span><span>Category</span></div>"
)

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


def _attr(value: str) -> str:
    return html.escape(value, quote=True)


def render_feed_html(items) -> str:
    """Render homepage feed rows exactly as the in-page refresh script does."""
    rows = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        title, link = item.get("title"), item.get("link")
        if not isinstance(title, str) or not title or not isinstance(link, str) or not link.startswith(FEED_LINK_PREFIX):
            continue
        date = item.get("date")
        label = item.get("dateLabel")
        category = item.get("category")
        date = date[:10] if isinstance(date, str) else ""
        label = label if isinstance(label, str) else ""
        category = (
            category.strip()[:MAX_CATEGORY_LEN]
            if item.get("categorySource") == "section" and isinstance(category, str)
            else ""
        )
        category_html = f'<span class="sr-only">Category: </span>{html.escape(category)}' if category else ""
        lead = " feed-lead" if not rows else ""
        rows.append(
            f'<a href="{_attr(link)}" target="_blank" rel="noopener noreferrer"'
            f' class="feed-item feed-row{lead} py-2.5 rounded group">'
            f'<time class="feed-date text-xs text-brand-sand/80 tabular-nums" datetime="{_attr(date)}">{html.escape(label)}</time>'
            '<span class="feed-title text-sm text-brand-sand group-hover:text-brand-gold transition font-medium leading-snug">'
            f"{html.escape(title)}</span>"
            f'<span class="feed-category">{category_html}</span>'
            "</a>"
        )
        if len(rows) >= MAX_ITEMS:
            break
    if not rows:
        return FEED_FALLBACK_HTML
    return FEED_COLUMNS_HTML + "".join(rows)


def sync_homepage(items) -> bool:
    """Write rendered rows between the homepage markers. Returns True if changed.

    Raises ValueError when the markers are missing or duplicated, so a template
    change can never silently drop the feed.
    """
    page = HOMEPAGE.read_text(encoding="utf-8")
    matches = list(FEED_BLOCK_RE.finditer(page))
    if len(matches) != 1:
        raise ValueError(f"{HOMEPAGE} must contain exactly one latest-feed:start/end block")
    match = matches[0]
    indent = re.match(r"[ \t]*", match.group("end")).group(0)
    body = indent + render_feed_html(items) + "\n"
    if match.group("body") == body:
        return False
    HOMEPAGE.write_text(page[: match.start("body")] + body + page[match.end("body") :], encoding="utf-8")
    return True


def render_only() -> int:
    """Re-render the homepage block from the committed JSON without network access."""
    try:
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        changed = sync_homepage(data.get("items", []) if isinstance(data, dict) else [])
    except (OSError, ValueError) as exc:
        print(f"Homepage feed render failed: {exc}", file=sys.stderr)
        return 1
    print(f"Updated {HOMEPAGE} feed block." if changed else f"{HOMEPAGE} feed block already current.")
    return 0


def write_homepage(items) -> int:
    try:
        changed = sync_homepage(items)
    except (OSError, ValueError) as exc:
        print(f"Homepage feed render failed: {exc}", file=sys.stderr)
        return 1
    if changed:
        print(f"Updated {HOMEPAGE} feed block.")
    return 0


def main() -> int:
    if "--render-only" in sys.argv[1:]:
        return render_only()
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
        # Still repair a homepage block that drifted from the JSON.
        return write_homepage(items)

    # Render the homepage first: if its markers are missing, fail before the
    # JSON changes so the two committed files never disagree.
    status = write_homepage(items)
    if status:
        return status
    payload = {"source": FEED_URL, "items": items}
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(items)} items.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
