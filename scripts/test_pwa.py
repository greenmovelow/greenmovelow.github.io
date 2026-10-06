"""PWA regression fixtures; production assets are only ever read."""

from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
from unittest.mock import patch
import zlib

import audit_pwa


SIGNATURE = b"\x89PNG\r\n\x1a\n"
ICON_SIZES = (36, 48, 72, 96, 144, 192, 512)


def chunk(kind, data=b""):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def header(width=1, height=1, depth=8, color=6, interlace=0):
    return chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, depth, color, 0, 0, interlace))


HEADER = header()
PIXEL_ROW = b"\x00\xff\x00\x00\xff"  # filter 0, one opaque red RGBA pixel
COMPRESSED = zlib.compress(PIXEL_ROW)
IDAT = chunk(b"IDAT", COMPRESSED)
IEND = chunk(b"IEND")
VALID_PNG = SIGNATURE + HEADER + IDAT + IEND


class PNGTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "fixture.png"

    def check_png(self, content):
        self.path.write_bytes(content)
        return audit_pwa.png_dimensions(self.path)

    def test_valid_pngs(self):
        cases = [
            ("minimal", VALID_PNG, (1, 1)),
            ("split IDAT", SIGNATURE + HEADER + chunk(b"IDAT", COMPRESSED[:4])
             + chunk(b"IDAT", COMPRESSED[4:]) + IEND, (1, 1)),
            ("ancillary chunks", SIGNATURE + HEADER + chunk(b"tEXt", b"Title\x00Test")
             + IDAT + chunk(b"tEXt", b"Note\x00Test") + IEND, (1, 1)),
            ("indexed", SIGNATURE + header(depth=1, color=3)
             + chunk(b"PLTE", b"\xff\x00\x00")
             + chunk(b"IDAT", zlib.compress(b"\x00\x00")) + IEND, (1, 1)),
            # For 2x2 Adam7: one pixel in pass 1, one in pass 6, two in pass 7.
            ("Adam7", SIGNATURE + header(2, 2, interlace=1)
             + chunk(b"IDAT", zlib.compress(PIXEL_ROW * 2 + b"\x00" + PIXEL_ROW[1:] * 2))
             + IEND, (2, 2)),
        ]
        for label, content, dimensions in cases:
            with self.subTest(label=label):
                self.assertEqual(self.check_png(content), dimensions)

    def test_truncated_and_malformed_chunks(self):
        cases = [
            ("header only", VALID_PNG[:24], "truncated chunk data or CRC"),
            ("mid IDAT", (SIGNATURE + HEADER + IDAT)[:-6], "truncated chunk data or CRC"),
            ("missing IEND", SIGNATURE + HEADER + IDAT, "missing IEND"),
            ("missing IDAT", SIGNATURE + HEADER + IEND, "missing IDAT"),
            ("truncated header", SIGNATURE + HEADER + IDAT + b"\x00", "truncated chunk header"),
            ("illegal length", SIGNATURE + HEADER + struct.pack(">I4sI", 0x80000000, b"IDAT", 0),
             "invalid chunk length"),
            ("length exceeds file", SIGNATURE + HEADER + struct.pack(">I4sI", 1000, b"IDAT", 0),
             "truncated chunk data or CRC"),
            ("nonempty IEND", SIGNATURE + HEADER + IDAT + chunk(b"IEND", b"x"), "IEND must be empty"),
            ("trailing bytes", VALID_PNG + b"x", "trailing data after IEND"),
            ("duplicate IEND", VALID_PNG + IEND, "trailing data after IEND"),
            ("missing IHDR", SIGNATURE + IDAT + IEND, "IHDR must be the first"),
            ("late IHDR", SIGNATURE + chunk(b"tEXt", b"a\x00b") + HEADER + IDAT + IEND,
             "IHDR must be the first"),
            ("duplicate IHDR", SIGNATURE + HEADER + HEADER + IDAT + IEND, "exactly one 13-byte IHDR"),
            ("short IHDR", SIGNATURE + chunk(b"IHDR", b"\x00" * 12) + IDAT + IEND,
             "exactly one 13-byte IHDR"),
            ("zero width", SIGNATURE + header(width=0) + IDAT + IEND, "invalid IHDR fields"),
            ("invalid depth", SIGNATURE + header(depth=1) + IDAT + IEND, "invalid IHDR fields"),
            ("invalid signature", b"bad PNG!" + HEADER + IDAT + IEND, "invalid PNG signature"),
            ("unknown critical chunk", SIGNATURE + HEADER + chunk(b"ABCD") + IDAT + IEND,
             "unknown critical chunk"),
            ("invalid chunk type", SIGNATURE + HEADER + chunk(b"ID1T") + IEND, "invalid chunk type"),
            ("reserved bit", SIGNATURE + HEADER + chunk(b"IDaT") + IEND, "invalid chunk type"),
            ("separated IDAT", SIGNATURE + HEADER + chunk(b"IDAT", COMPRESSED[:4])
             + chunk(b"tEXt", b"a\x00b") + chunk(b"IDAT", COMPRESSED[4:]) + IEND,
             "IDAT chunks must be consecutive"),
            ("missing palette", SIGNATURE + header(depth=1, color=3) + IDAT + IEND,
             "requires PLTE before IDAT"),
            ("invalid palette length", SIGNATURE + header(color=3) + chunk(b"PLTE", b"RGBA")
             + IDAT + IEND, "invalid PLTE length or position"),
            ("late palette", SIGNATURE + HEADER + IDAT + chunk(b"PLTE", b"RGB") + IEND,
             "invalid PLTE length or position"),
        ]
        for label, content, reason in cases:
            with self.subTest(label=label), self.assertRaisesRegex(ValueError, reason):
                self.check_png(content)

    def test_crc_checked_for_every_chunk(self):
        chunks = [HEADER, chunk(b"tEXt", b"a\x00b"), IDAT, IEND]
        for index, name in enumerate(("IHDR", "tEXt", "IDAT", "IEND")):
            bad = list(chunks)
            bad[index] = bad[index][:-1] + bytes([bad[index][-1] ^ 1])
            with self.subTest(chunk=name), self.assertRaisesRegex(ValueError, f"CRC mismatch in {name}"):
                self.check_png(SIGNATURE + b"".join(bad))

    def test_idat_data_with_valid_chunk_crc(self):
        cases = [
            ("invalid zlib", b"not zlib", "invalid IDAT zlib data"),
            ("truncated zlib", COMPRESSED[:-1], "incomplete or trailing IDAT"),
            ("trailing zlib", COMPRESSED + b"extra", "incomplete or trailing IDAT"),
            ("second stream", COMPRESSED + COMPRESSED, "incomplete or trailing IDAT"),
            ("too few pixels", zlib.compress(b"\x00"), "incorrect decompressed scanline length"),
            ("too many pixels", zlib.compress(PIXEL_ROW + b"x"), "incorrect decompressed scanline length"),
            ("invalid filter", zlib.compress(b"\x05" + PIXEL_ROW[1:]), "invalid scanline filter"),
        ]
        for label, data, reason in cases:
            content = SIGNATURE + HEADER + chunk(b"IDAT", data) + IEND
            with self.subTest(label=label), self.assertRaisesRegex(ValueError, reason):
                self.check_png(content)


class ManifestIconTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        original_root = audit_pwa.ROOT
        # Copy only the real manifest, homepage and icon files into an isolated
        # checkout fixture. All mutations below affect those temporary copies.
        for path in [original_root / "manifest.json", original_root / "index.html",
                     *original_root.glob("*icon*")]:
            if path.is_file():
                shutil.copy2(path, self.root / path.name)
        self.manifest = json.loads((self.root / "manifest.json").read_text())
        self.root_patch = patch.object(audit_pwa, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def audit(self):
        (self.root / "manifest.json").write_text(json.dumps(self.manifest))
        with redirect_stdout(io.StringIO()):
            audit_pwa.audit()

    def test_real_production_icon_set(self):
        self.audit()
        for size in ICON_SIZES:
            with self.subTest(size=size):
                self.assertEqual(audit_pwa.png_dimensions(self.root / f"android-icon-{size}x{size}.png"),
                                 (size, size))

    def test_each_protected_icon_is_required(self):
        original = self.manifest["icons"]
        for size in ICON_SIZES:
            src = f"/android-icon-{size}x{size}.png"
            self.manifest["icons"] = [icon for icon in original if icon["src"] != src]
            with self.subTest(size=size), self.assertRaisesRegex(ValueError, "must retain protected Android icons"):
                self.audit()

    def test_protected_paths_are_exact_even_if_file_exists(self):
        for index, icon in enumerate(self.manifest["icons"]):
            src = icon["src"]
            icon["src"] = src.lstrip("/")
            with self.subTest(icon=index), self.assertRaisesRegex(ValueError, "must retain protected Android icons"):
                self.audit()
            icon["src"] = src

    def test_incorrect_mime_type(self):
        for icon in self.manifest["icons"]:
            icon["type"] = "image/jpeg"
            with self.subTest(src=icon["src"]), self.assertRaisesRegex(ValueError, "expected a PNG app icon"):
                self.audit()
            icon["type"] = "image/png"

    def test_incorrect_declared_dimensions(self):
        self.manifest["icons"][0]["sizes"] = "99x99"
        with self.assertRaisesRegex(ValueError, "sizes do not match PNG dimensions"):
            self.audit()

    def test_protected_sizes_declaration_is_exact(self):
        self.manifest["icons"][0]["sizes"] = "36x36 48x48"
        with self.assertRaisesRegex(ValueError, "protected icon must retain sizes 36x36"):
            self.audit()

    def test_wrong_png_dimensions_even_with_matching_declaration(self):
        icon = self.manifest["icons"][0]
        (self.root / icon["src"].lstrip("/")).write_bytes(VALID_PNG)
        icon["sizes"] = "1x1"
        with self.assertRaisesRegex(ValueError, "protected icon must retain sizes 36x36"):
            self.audit()

    def test_missing_referenced_file(self):
        (self.root / "android-icon-36x36.png").unlink()
        with self.assertRaisesRegex(ValueError, "asset does not resolve to a repository file"):
            self.audit()

    def test_corrupt_referenced_file(self):
        (self.root / "android-icon-36x36.png").write_bytes(VALID_PNG[:24])
        with self.assertRaisesRegex(ValueError, "truncated chunk data or CRC"):
            self.audit()

    def test_additional_valid_icons_are_allowed(self):
        (self.root / "additional.png").write_bytes(VALID_PNG)
        self.manifest["icons"].append({"src": "/additional.png", "sizes": "1x1", "type": "image/png"})
        self.audit()

    def test_ordinary_icon_purpose_requirement_is_preserved(self):
        self.manifest["icons"][-1]["purpose"] = "maskable"
        with self.assertRaisesRegex(ValueError, "retain ordinary 192x192 and 512x512"):
            self.audit()


if __name__ == "__main__":
    unittest.main()
