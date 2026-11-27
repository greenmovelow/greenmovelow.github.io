"""Regression tests for scripts/audit_csp.py's data-action registry checks."""

import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import audit_csp as audit

REPO = Path(__file__).resolve().parent.parent
POLICY = (
    "default-src 'self'; script-src 'self' https://gc.zgo.at; "
    "connect-src 'self' https://restoring-democracy.goatcounter.com/count"
)
PAGE = """<!DOCTYPE html><html><head>
<script src="/assets/js/actions.js" defer></script>
<script type="application/ld+json">{"@type": "WebSite"}</script>
</head><body>{body}<script src="/assets/js/pages/page.js"></script></body></html>
"""


class RegistryAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        (root / "assets" / "js" / "pages").mkdir(parents=True)
        # The real registry, so the fixture tracks it.
        (root / "assets" / "js" / "actions.js").write_text(
            (REPO / "assets" / "js" / "actions.js").read_text(encoding="utf-8"), encoding="utf-8")
        (root / "assets" / "js" / "pages" / "page.js").write_text("window.x = 1;\n", encoding="utf-8")
        (root / "_headers").write_text(f"/*\n  Content-Security-Policy: {POLICY}\n", encoding="utf-8")
        self.root = root
        for name, value in (("ROOT", root), ("ACTIONS_JS", root / "assets" / "js" / "actions.js")):
            patcher = patch.object(audit, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def write_page(self, body):
        (self.root / "index.html").write_text(PAGE.replace("{body}", body), encoding="utf-8")

    def run_audit(self):
        out = io.StringIO()
        with redirect_stdout(out):
            code = audit.main()
        return code, out.getvalue()

    def test_registered_static_actions_pass(self):
        self.write_page('<button data-action="shareThisPage">Share</button>'
                        """<div data-action="toggleCard" data-action-args='["$parent"]' data-action-keys="Enter Space"></div>""")
        code, out = self.run_audit()
        self.assertEqual(code, 0, out)

    def test_unknown_static_action_is_flagged(self):
        self.write_page('<button data-action="alert">x</button><button data-action="constructor">y</button>')
        code, out = self.run_audit()
        self.assertEqual(code, 1)
        self.assertIn("index.html:4: data-action 'alert' is not in the actions.js REGISTRY", out)
        self.assertIn("data-action 'constructor' is not in the actions.js REGISTRY", out)

    def test_unknown_action_in_js_generated_markup_is_flagged(self):
        self.write_page("")
        for markup in ('el.innerHTML = `<div data-action="toggleOpen"></div><div data-action="eval"></div>`;',
                       "html = '<a data-action=\\\"evilThing\\\">';",
                       "html = \"<a data-action='otherThing'>\";"):
            with self.subTest(markup=markup):
                (self.root / "assets" / "js" / "pages" / "page.js").write_text(markup + "\n", encoding="utf-8")
                code, out = self.run_audit()
                self.assertEqual(code, 1, out)
                self.assertIn("assets/js/pages/page.js:1: data-action", out)
                self.assertNotIn("'toggleOpen' is not", out)

    def test_non_literal_action_names_are_flagged(self):
        self.write_page("")
        for code_line in ("el.setAttribute('data-action', name);", "el.dataset.action = name;"):
            with self.subTest(code=code_line):
                (self.root / "assets" / "js" / "pages" / "page.js").write_text(code_line + "\n", encoding="utf-8")
                code, out = self.run_audit()
                self.assertEqual(code, 1)
                self.assertIn("data-action set from a non-literal", out)

    def test_registry_entry_must_resolve_its_own_name(self):
        actions = self.root / "assets" / "js" / "actions.js"
        actions.write_text(actions.read_text(encoding="utf-8").replace(
            "copyLink: function () { return window.copyLink; }",
            "copyLink: function () { return window.fetch; }"), encoding="utf-8")
        self.write_page("")
        code, out = self.run_audit()
        self.assertEqual(code, 1)
        self.assertIn("REGISTRY entry 'copyLink' resolves window.fetch", out)

    def test_committed_site_passes(self):
        with patch.object(audit, "ROOT", REPO), patch.object(audit, "ACTIONS_JS", REPO / "assets" / "js" / "actions.js"):
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(audit.main(), 0, out.getvalue())


if __name__ == "__main__":
    unittest.main()
