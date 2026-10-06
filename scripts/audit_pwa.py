#!/usr/bin/env python3
"""Protect the existing installable app with Python's standard library only."""

from html.parser import HTMLParser
import json
from pathlib import Path
import struct
from urllib.parse import unquote, urlsplit
import zlib


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
ANDROID_ICONS = {
    f"/android-icon-{size}x{size}.png": f"{size}x{size}"
    for size in (36, 48, 72, 96, 144, 192, 512)
}


def png_dimensions(path):
    """Validate chunks and the compressed scanline structure, without decoding pixels."""
    def fail(message):
        raise ValueError(f"{path.name}: {message}")

    content = path.read_bytes()
    if content[:8] != b"\x89PNG\r\n\x1a\n":
        fail("invalid PNG signature")
    offset = 8
    dimensions = None
    palette_seen = False
    idat_seen = False
    idat_closed = False
    image_data = bytearray()
    while True:
        if offset == len(content):
            fail("missing IEND")
        if len(content) - offset < 12:
            fail("truncated chunk header or CRC")
        length, kind = struct.unpack(">I4s", content[offset:offset + 8])
        if length > 0x7fffffff:
            fail("invalid chunk length")
        end = offset + 12 + length
        if end > len(content):
            fail("truncated chunk data or CRC")
        if not all(65 <= char <= 90 or 97 <= char <= 122 for char in kind) or kind[2] & 32:
            fail("invalid chunk type")
        data = content[offset + 8:end - 4]
        crc = struct.unpack(">I", content[end - 4:end])[0]
        if zlib.crc32(kind + data) != crc:
            fail(f"CRC mismatch in {kind.decode('ascii')}")
        if dimensions is None and kind != b"IHDR":
            fail("IHDR must be the first chunk")
        if idat_seen and kind != b"IDAT":
            idat_closed = True
        if kind == b"IHDR":
            if dimensions is not None or length != 13:
                fail("require exactly one 13-byte IHDR")
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", data)
            depths = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8), 4: (8, 16), 6: (8, 16)}
            if (not 0 < width <= 0x7fffffff or not 0 < height <= 0x7fffffff
                    or depth not in depths.get(color, ()) or compression != 0
                    or filtering != 0 or interlace not in (0, 1)):
                fail("invalid IHDR fields")
            dimensions = (width, height)
        elif kind == b"PLTE":
            if (palette_seen or idat_seen or color in (0, 4) or not 0 < length <= 768
                    or length % 3 or (color == 3 and length // 3 > 2 ** depth)):
                fail("invalid PLTE length or position")
            palette_seen = True
        elif kind == b"IDAT":
            if idat_closed:
                fail("IDAT chunks must be consecutive")
            if color == 3 and not palette_seen:
                fail("indexed PNG requires PLTE before IDAT")
            idat_seen = True
            image_data.extend(data)
        elif kind == b"IEND":
            if length != 0:
                fail("IEND must be empty")
            if not idat_seen:
                fail("missing IDAT")
            if end != len(content):
                fail("trailing data after IEND")
            break
        elif not kind[0] & 32:
            fail(f"unknown critical chunk {kind.decode('ascii')}")
        offset = end

    # Count scanline bytes (including Adam7 passes) and validate filter tags.
    # This checks complete image data without reconstructing any pixels.
    bits_per_pixel = depth * {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    passes = [(0, 0, 1, 1)] if interlace == 0 else [
        (0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4),
        (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2),
    ]
    rows = []
    for x, y, dx, dy in passes:
        pass_width = max(0, (width - x + dx - 1) // dx)
        pass_height = max(0, (height - y + dy - 1) // dy)
        if pass_width and pass_height:
            rows.append((pass_height, 1 + (pass_width * bits_per_pixel + 7) // 8))
    expected_length = sum(count * length for count, length in rows)
    try:
        stream = zlib.decompressobj()
        raw = stream.decompress(image_data, expected_length + 1)
    except zlib.error:
        fail("invalid IDAT zlib data")
    if not stream.eof or stream.unused_data or stream.unconsumed_tail:
        fail("incomplete or trailing IDAT zlib data")
    if len(raw) != expected_length:
        fail("incorrect decompressed scanline length")
    offset = 0
    for count, length in rows:
        for _ in range(count):
            if raw[offset] > 4:
                fail("invalid scanline filter")
            offset += length
    return dimensions


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
    protected_icons = set()
    for icon in icons:
        if not isinstance(icon, dict):
            raise ValueError("each manifest icon must be an object")
        src = icon.get("src")
        path = local_file(src)
        if icon.get("type") != "image/png":
            raise ValueError(f"expected a PNG app icon: {icon.get('src')!r}")
        width, height = png_dimensions(path)
        size = f"{width}x{height}"
        if size not in str(icon.get("sizes", "")).split():
            raise ValueError(f"icon sizes do not match PNG dimensions: {path.name}")
        if src in ANDROID_ICONS:
            if icon.get("sizes") != ANDROID_ICONS[src]:
                raise ValueError(f"protected icon must retain sizes {ANDROID_ICONS[src]}: {src}")
            protected_icons.add(src)
        purpose = icon.get("purpose", "any")
        if not isinstance(purpose, str):
            raise ValueError("icon purpose must be a string")
        if "any" in purpose.split():
            ordinary_sizes.add(size)
    missing = ANDROID_ICONS.keys() - protected_icons
    if missing:
        raise ValueError(f"manifest must retain protected Android icons: {', '.join(sorted(missing))}")
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
