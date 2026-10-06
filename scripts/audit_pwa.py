#!/usr/bin/env python3
"""Protect the existing installable app with Python's standard library only."""

from html.parser import HTMLParser
import json
from pathlib import Path
import struct
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
EXPECTED = {
    "name": "Restoring Democracy's Promise",
    "short_name": "RDP",
    "id": "/",
    "scope": "/",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#24473e",
    "background_color": "#24473e",
}


class HomepageHead(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.links = []
        self.themes = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "head":
            self.in_head = True
        if not self.in_head:
            return
        if tag == "link":
            self.links.append(values)
        if tag == "meta" and values.get("name", "").lower() == "theme-color":
            self.themes.append(values.get("content"))

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False


def local_file(src):
    """Resolve same-origin manifest/head URLs without escaping the checkout."""
    if not isinstance(src, str) or not src:
        raise ValueError("asset URL must be a nonempty string")
    url = urlsplit(src)
    if url.scheme or url.netloc or url.query or url.fragment:
        raise ValueError(f"expected a local asset path: {src!r}")
    path = (ROOT / unquote(url.path).lstrip("/")).resolve()
    if not path.is_relative_to(ROOT.resolve()) or not path.is_file():
        raise ValueError(f"asset does not resolve to a repository file: {src!r}")
    return path


def audit():
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("manifest must be a JSON object")
    for key, expected in EXPECTED.items():
        if manifest.get(key) != expected:
            raise ValueError(f"{key} must remain {expected!r}")
    if not isinstance(manifest.get("description"), str) or not manifest["description"].strip():
        raise ValueError("manifest description must be a nonempty string")

    icons = manifest.get("icons")
    if not isinstance(icons, list) or not icons:
        raise ValueError("manifest must retain a nonempty icons array")
    ordinary_sizes = set()
    for icon in icons:
        if not isinstance(icon, dict):
            raise ValueError("each manifest icon must be an object")
        path = local_file(icon.get("src"))
        # The existing app uses PNG icons. Check their actual dimensions too:
        # an existing file with a misleading sizes declaration is insufficient.
        with path.open("rb") as file:
            header = file.read(24)
        if (len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n"
                or header[12:16] != b"IHDR" or icon.get("type") != "image/png"):
            raise ValueError(f"expected a PNG app icon: {icon.get('src')!r}")
        width, height = struct.unpack(">II", header[16:24])
        size = f"{width}x{height}"
        if size not in str(icon.get("sizes", "")).split():
            raise ValueError(f"icon sizes do not match PNG dimensions: {path.name}")
        purpose = icon.get("purpose", "any")
        if not isinstance(purpose, str):
            raise ValueError("icon purpose must be a string")
        if "any" in purpose.split():
            ordinary_sizes.add(size)
    if not {"192x192", "512x512"}.issubset(ordinary_sizes):
        raise ValueError("retain ordinary 192x192 and 512x512 app icons")

    head = HomepageHead()
    head.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    manifests = [link.get("href") for link in head.links
                 if "manifest" in link.get("rel", "").split()]
    if manifests != ["/manifest.json"]:
        raise ValueError("homepage head must link once to /manifest.json")
    if head.themes != [EXPECTED["theme_color"]]:
        raise ValueError("homepage theme-color must remain #24473e")

    expected_icons = [("icon", "/favicon.ico", None)]
    expected_icons += [("icon", f"/favicon-{size}x{size}.png", f"{size}x{size}")
                       for size in (16, 32, 96)]
    expected_icons += [("apple-touch-icon", f"/apple-icon-{size}x{size}.png", f"{size}x{size}")
                       for size in (57, 60, 72, 76, 114, 120, 144, 152, 180)]
    expected_icons.append(("icon", "/android-icon-192x192.png", "192x192"))
    for rel, href, sizes in expected_icons:
        if not any(rel in link.get("rel", "").split() and link.get("href") == href
                   and (sizes is None or link.get("sizes") == sizes)
                   for link in head.links):
            raise ValueError(f"homepage must retain {rel} declaration for {href}")
        local_file(href)
    print(f"PASS: root app identity, manifest, {len(icons)} PNG icons, homepage theme and touch/favicon links")


if __name__ == "__main__":
    try:
        audit()
    except (OSError, ValueError) as error:
        raise SystemExit(f"PWA check failed: {error}")
