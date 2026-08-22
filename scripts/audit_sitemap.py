#!/usr/bin/env python3
"""Audit the sitemap in both directions against locally served HTML pages."""

from __future__ import annotations

from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://restoring-democracy.org"
SITEMAP_NAMESPACE = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# Non-sitemap HTML is adjudicated explicitly rather than treated as content
# merely because Netlify can serve it.
EXPECTED_EXCLUSIONS = {
    "go/save_backfill_ia/index.html": "UTILITY / REDIRECT",
    "go/when-war-tests-democracy/index.html": "UTILITY / REDIRECT",
    "journalism/cross-and-capitol/index.html": "INTENTIONALLY EXCLUDED / ORPHAN ARTIFACT",
    "resources/reference/records/status/index.html": "INTENTIONALLY NOINDEX",
    "vault.html": "INTENTIONALLY NOINDEX",
}


class PageMetadata(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonicals: list[str] = []
        self.robots: list[str] = []
        self.redirects: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonicals.append(values.get("href", ""))
        elif tag == "meta":
            if values.get("name", "").lower() == "robots":
                self.robots.append(values.get("content", "").lower().replace(" ", ""))
            if values.get("http-equiv", "").lower() == "refresh":
                self.redirects.append(values.get("content", ""))

    @property
    def noindex(self) -> bool:
        return any("noindex" in directive.split(",") for directive in self.robots)


def inspect_page(path: Path) -> PageMetadata:
    metadata = PageMetadata()
    metadata.feed(path.read_text(encoding="utf-8"))
    return metadata


def local_page_for(url: str) -> Path:
    route = urlsplit(url).path.strip("/")
    return ROOT / (Path(route) / "index.html" if route else "index.html")


def main() -> int:
    failures: list[str] = []
    sitemap_root = ET.parse(ROOT / "sitemap.xml")
    entries = sitemap_root.findall("sm:url", SITEMAP_NAMESPACE)
    urls = [entry.findtext("sm:loc", namespaces=SITEMAP_NAMESPACE) for entry in entries]
    sitemap_urls = {url for url in urls if url}

    if len(urls) != len(sitemap_urls):
        failures.append("sitemap contains duplicate URLs")

    for url in urls:
        if not url:
            failures.append("sitemap contains an empty <loc>")
            continue
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.netloc != "restoring-democracy.org":
            failures.append(f"{url}: not on the canonical HTTPS origin")
        if parts.query or parts.fragment:
            failures.append(f"{url}: query strings and fragments are not canonical sitemap URLs")

        page = local_page_for(url)
        if not page.is_file():
            failures.append(f"{url}: no local index.html")
            continue
        metadata = inspect_page(page)
        if metadata.canonicals != [url]:
            failures.append(f"{url}: canonical mismatch ({metadata.canonicals})")
        if metadata.noindex:
            failures.append(f"{url}: sitemap page is noindex")
        if metadata.redirects:
            failures.append(f"{url}: sitemap page is a redirect utility")

    # Reverse direction: report any local page that claims a canonical URL on
    # the production origin, is indexable, is not a redirect, and is omitted.
    classifications: list[tuple[str, str]] = []
    seen_exclusions: set[str] = set()
    for page in sorted(ROOT.rglob("*.html")):
        if "node_modules" in page.parts:
            continue
        relative = page.relative_to(ROOT).as_posix()
        metadata = inspect_page(page)
        local_canonicals = {
            url
            for url in metadata.canonicals
            if urlsplit(url).scheme == "https"
            and urlsplit(url).netloc == "restoring-democracy.org"
        }
        missing = local_canonicals - sitemap_urls

        if missing and not metadata.noindex and not metadata.redirects:
            classifications.append((relative, "INDEX — ADD TO SITEMAP"))
            failures.append(f"{relative}: indexable canonical page missing from sitemap")
        elif relative in EXPECTED_EXCLUSIONS:
            classification = EXPECTED_EXCLUSIONS[relative]
            classifications.append((relative, classification))
            seen_exclusions.add(relative)
            if classification == "REVIEW REQUIRED":
                failures.append(f"{relative}: indexing classification requires review")
            if classification == "INTENTIONALLY NOINDEX" and not metadata.noindex:
                failures.append(f"{relative}: expected an explicit noindex directive")
            if classification == "UTILITY / REDIRECT":
                if not metadata.noindex or not metadata.redirects or metadata.canonicals:
                    failures.append(
                        f"{relative}: redirect must be noindex, retain forwarding, "
                        "and make no canonical claim"
                    )

    missing_exclusions = set(EXPECTED_EXCLUSIONS) - seen_exclusions
    for relative in sorted(missing_exclusions):
        failures.append(f"{relative}: expected exclusion page is missing")

    lastmods = {
        entry.findtext("sm:loc", namespaces=SITEMAP_NAMESPACE): entry.findtext(
            "sm:lastmod", namespaces=SITEMAP_NAMESPACE
        )
        for entry in entries
    }
    ai_url = f"{ORIGIN}/ai-use/"
    if urls.count(ai_url) != 1:
        failures.append("/ai-use/ must occur exactly once")
    minimum_lastmods = {
        f"{ORIGIN}/": date(2026, 8, 21),
        ai_url: date(2026, 8, 21),
    }
    for url, minimum in minimum_lastmods.items():
        value = lastmods.get(url)
        try:
            parsed = (
                date.fromisoformat(value)
                if value and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
                else None
            )
        except ValueError:
            parsed = None
        if parsed is None:
            failures.append(f"{url}: lastmod must be an ISO YYYY-MM-DD date")
        elif parsed < minimum:
            failures.append(f"{url}: lastmod must be at least {minimum.isoformat()}")
    if f"{ORIGIN}/confidential_mou/" not in sitemap_urls:
        failures.append("/confidential_mou/ must remain in the sitemap")

    ai_metadata = inspect_page(ROOT / "ai-use/index.html")
    if ai_metadata.canonicals != [ai_url] or ai_metadata.robots != ["index,follow"]:
        failures.append("/ai-use/ must remain canonical and index,follow")

    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {ORIGIN}/sitemap.xml" not in robots:
        failures.append("robots.txt does not reference the canonical sitemap")

    print(f"Sitemap URLs: {len(urls)} ({len(sitemap_urls)} unique)")
    print("Non-sitemap HTML classifications:")
    for relative, classification in classifications:
        print(f"  {classification}: {relative}")
    print(f"Violations: {len(failures)}")
    for failure in failures:
        print(f"  {failure}")
    print(f"Result: {'FAIL' if failures else 'PASS'}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
