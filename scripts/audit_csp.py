#!/usr/bin/env python3
"""Fail if the site's HTML needs script-src 'unsafe-inline' again.

The site-wide Content-Security-Policy in _headers omits 'unsafe-inline' from
script-src, so the browser blocks inline JavaScript. This audit checks:
  1. No executable inline <script> blocks (JSON-LD and other JSON stay inline).
  2. No inline event-handler attributes (onclick=..., including inside
     scripts that build HTML) and no javascript: URLs.
  3. Every page that uses data-action loads /assets/js/actions.js, every
     data-action-args value is a JSON array, and every data-action name — in
     static HTML and in HTML built by site JS — is in the REGISTRY of
     /assets/js/actions.js (unregistered names do nothing at runtime). Each
     registry entry must resolve the page function of the same name, and
     action names must be literals the audit can read.
  4. Local <script src> files exist, and site JS under assets/js neither sets
     nor queries on* attributes (they no longer exist; use data-action).
  5. The /* rule in _headers sends a CSP whose script-src keeps 'self' and
     the GoatCounter script host, and allows neither 'unsafe-inline' nor
     'unsafe-eval'; connect-src keeps the GoatCounter count endpoint.

Run from the repository root: python scripts/audit_csp.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {"node_modules", "_shots", ".git"}
SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script\s*>", re.S | re.I)
HANDLER_RE = re.compile(r"""\son[a-z]+\s*=\s*["']""", re.I)
JS_URL_RE = re.compile(r"""\b(?:href|src|action|formaction)\s*=\s*["']\s*javascript:""", re.I)
JS_HANDLER_ATTR_RE = re.compile(r"""(?:get|set|has|remove)Attribute\(\s*['"]on[a-z]+['"]|\[on[a-z]+[\]=]""", re.I)
ACTIONS_JS = ROOT / "assets" / "js" / "actions.js"
REGISTRY_BLOCK_RE = re.compile(r"var REGISTRY = Object\.freeze\(\{(.*?)\}\);", re.S)
REGISTRY_ENTRY_RE = re.compile(
    r"^\s*([A-Za-z_$][\w$]*)\s*:\s*function\s*\(\)\s*\{\s*return window\.([A-Za-z_$][\w$]*);\s*\},?\s*$"
)
# Matches data-action="name" in HTML and in JS strings (including \"escaped\" quotes).
ACTION_NAME_RE = re.compile(r"""data-action\s*=\s*\\?["']([^"'\\]*)\\?["']""")
DYNAMIC_ACTION_RE = re.compile(r"""setAttribute\(\s*['"]data-action['"]\s*,\s*(?!['"])|\.dataset\.action\s*=(?!=)""")
ARGS_RE = re.compile(r"""data-action-args\s*=\s*'([^']*)'""")
NON_EXECUTABLE_TYPES = {"application/ld+json", "application/json"}
GOATCOUNTER_SCRIPT = "https://gc.zgo.at"
GOATCOUNTER_ENDPOINT = "https://restoring-democracy.goatcounter.com/count"


def html_files():
    for path in sorted(ROOT.rglob("*.html")):
        if not SKIP_DIRS.intersection(path.relative_to(ROOT).parts):
            yield path


def action_registry() -> tuple[set[str], list[str]]:
    """Names registered in assets/js/actions.js, plus problems with the registry itself."""
    text = ACTIONS_JS.read_text(encoding="utf-8")
    block = REGISTRY_BLOCK_RE.search(text)
    if not block:
        return set(), ["assets/js/actions.js: REGISTRY not found"]
    names, problems = set(), []
    for line in block.group(1).splitlines():
        if not line.strip():
            continue
        entry = REGISTRY_ENTRY_RE.match(line)
        if not entry:
            problems.append(f"assets/js/actions.js: unrecognised REGISTRY line: {line.strip()!r}")
        elif entry.group(1) != entry.group(2):
            problems.append(f"assets/js/actions.js: REGISTRY entry {entry.group(1)!r} resolves window.{entry.group(2)}")
        else:
            names.add(entry.group(1))
    return names, problems


def unregistered_actions(rel, text: str, registry: set[str]) -> list[str]:
    problems = []
    for match in ACTION_NAME_RE.finditer(text):
        if match.group(1) not in registry:
            line = text.count("\n", 0, match.start()) + 1
            problems.append(f"{rel}:{line}: data-action {match.group(1)!r} is not in the actions.js REGISTRY")
    for match in DYNAMIC_ACTION_RE.finditer(text):
        line = text.count("\n", 0, match.start()) + 1
        problems.append(f"{rel}:{line}: data-action set from a non-literal; use a literal registered name")
    return problems


def audit_page(path: Path, registry: set[str]) -> list[str]:
    rel = path.relative_to(ROOT)
    text = path.read_text(encoding="utf-8")
    problems = []
    for match in SCRIPT_RE.finditer(text):
        attrs, body = match.group(1), match.group(2)
        script_type = re.search(r"""\btype\s*=\s*["']?([^"'\s>]+)""", attrs, re.I)
        script_type = script_type.group(1).lower() if script_type else ""
        src = re.search(r"""\bsrc\s*=\s*["']([^"']+)""", attrs, re.I)
        if src:
            if body.strip():
                problems.append(f"{rel}: <script src> also has inline code")
            url = src.group(1)
            if url.startswith("/") and not url.startswith("//"):
                if not (ROOT / url.split("?")[0].lstrip("/")).is_file():
                    problems.append(f"{rel}: missing script file {url}")
            continue
        if script_type not in NON_EXECUTABLE_TYPES and body.strip():
            line = text.count("\n", 0, match.start()) + 1
            problems.append(f"{rel}:{line}: executable inline <script> (move it to a .js file)")
    for match in HANDLER_RE.finditer(text):
        line = text.count("\n", 0, match.start()) + 1
        problems.append(f"{rel}:{line}: inline event handler (use data-action or addEventListener)")
    for match in JS_URL_RE.finditer(text):
        line = text.count("\n", 0, match.start()) + 1
        problems.append(f"{rel}:{line}: javascript: URL")
    if "data-action" in text and "/assets/js/actions.js" not in text:
        problems.append(f"{rel}: uses data-action but does not load /assets/js/actions.js")
    for match in ARGS_RE.finditer(text):
        try:
            if not isinstance(json.loads(match.group(1)), list):
                raise ValueError
        except ValueError:
            problems.append(f"{rel}: data-action-args is not a JSON array: {match.group(1)!r}")
    problems.extend(unregistered_actions(rel, text, registry))
    return problems


def site_csp() -> str | None:
    lines = (ROOT / "_headers").read_text(encoding="utf-8").splitlines()
    in_rule = False
    for line in lines:
        if line and not line[0].isspace() and not line.startswith("#"):
            in_rule = line.strip() == "/*"
            continue
        if in_rule and line.strip().lower().startswith("content-security-policy:"):
            return line.split(":", 1)[1].strip()
    return None


def directive(policy: str, name: str) -> list[str]:
    for part in policy.split(";"):
        tokens = part.split()
        if tokens and tokens[0].lower() == name:
            return tokens[1:]
    return []


def audit_headers() -> list[str]:
    policy = site_csp()
    if policy is None:
        return ["_headers: no Content-Security-Policy in a /* rule"]
    problems = []
    script_src = directive(policy, "script-src")
    for banned in ("'unsafe-inline'", "'unsafe-eval'"):
        if banned in script_src:
            problems.append(f"_headers: script-src must not allow {banned}")
    for required in ("'self'", GOATCOUNTER_SCRIPT):
        if required not in script_src:
            problems.append(f"_headers: script-src must allow {required}")
    if GOATCOUNTER_ENDPOINT not in directive(policy, "connect-src"):
        problems.append(f"_headers: connect-src must allow {GOATCOUNTER_ENDPOINT}")
    return problems


def audit_site_js(registry: set[str]) -> list[str]:
    problems = []
    for path in sorted((ROOT / "assets" / "js").rglob("*.js")):
        text = path.read_text(encoding="utf-8")
        if path != ACTIONS_JS:  # its header comment shows example markup
            problems.extend(unregistered_actions(path.relative_to(ROOT), text, registry))
        for match in JS_HANDLER_ATTR_RE.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            problems.append(f"{path.relative_to(ROOT)}:{line}: uses an on* attribute; use data-action")
        for match in HANDLER_RE.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            problems.append(f"{path.relative_to(ROOT)}:{line}: builds HTML with an inline event handler")
    return problems


def main() -> int:
    pages = list(html_files())
    registry, problems = action_registry()
    problems += audit_headers() + audit_site_js(registry)
    for page in pages:
        problems.extend(audit_page(page, registry))
    if problems:
        print("\n".join(problems))
        print(f"Result: FAIL ({len(problems)} problems in {len(pages)} pages)")
        return 1
    print(f"Pages checked: {len(pages)}; registered actions: {len(registry)}")
    print("Result: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
