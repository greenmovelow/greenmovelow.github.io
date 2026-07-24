#!/usr/bin/env python3
"""Audit analytics placement across the static site using only the standard library."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# These routes are deliberately analytics-free. Everything else ending in .html
# is an eligible public content page. Add newly created sensitive/non-content
# routes here before publishing them.
EXCLUDED_PREFIXES: dict[str, str] = {
    "secure-tips/": "source-contact and source-intake pages",
    "resources/reference/records/status/": "restricted-status pages with script-src 'none'",
    "go/": "redirect-only and forwarding pages",
}
EXCLUDED_FILES: dict[str, str] = {
    "vault.html": "operational security / canary page",
    "journalism/cross-and-capitol/index.html": "empty non-content placeholder",
}

GOAT_ATTRIBUTE = 'data-goatcounter="https://restoring-democracy.goatcounter.com/count"'
GOAT_SCRIPT = "https://gc.zgo.at/count.js"
LEGACY_PATTERNS: dict[str, re.Pattern[str]] = {
    "GA4 measurement ID": re.compile(r"G-QJ3L9CT4Z7", re.I),
    "Google Tag Manager analytics loader": re.compile(r"googletagmanager\.com/gtag", re.I),
    "Google Analytics collection reference": re.compile(r"google-analytics\.com", re.I),
    "dataLayer initialization": re.compile(r"window\s*\.\s*dataLayer\s*=", re.I),
    "gtag function declaration": re.compile(r"function\s+gtag\s*\(", re.I),
    "gtag initialization/configuration": re.compile(r"gtag\s*\(\s*['\"](?:js|config)['\"]", re.I),
}
# On excluded routes, flag common replacement trackers as well as GA and GoatCounter.
OTHER_ANALYTICS = re.compile(
    r"(?:plausible\.io/js|cloud\.umami\.is/script|static\.cloudflareinsights\.com/beacon|"
    r"clarity\.ms/tag|cdn\.usefathom\.com/script)", re.I
)


def exclusion_reason(path: str) -> str | None:
    if path in EXCLUDED_FILES:
        return EXCLUDED_FILES[path]
    for prefix, reason in EXCLUDED_PREFIXES.items():
        if path.startswith(prefix):
            return reason
    return None


def main() -> int:
    eligible: list[str] = []
    excluded: list[str] = []
    goat_pages: list[str] = []
    violations: list[str] = []

    for file_path in sorted(ROOT.rglob("*.html")):
        relative = file_path.relative_to(ROOT).as_posix()
        markup = file_path.read_text(encoding="utf-8")
        reason = exclusion_reason(relative)
        goat_count = markup.count(GOAT_ATTRIBUTE)
        goat_script_count = markup.count(GOAT_SCRIPT)

        for label, pattern in LEGACY_PATTERNS.items():
            if pattern.search(markup):
                violations.append(f"{relative}: active {label} remains")

        if reason is not None:
            excluded.append(relative)
            if goat_count or goat_script_count:
                violations.append(f"{relative}: excluded page contains GoatCounter ({reason})")
            if OTHER_ANALYTICS.search(markup):
                violations.append(f"{relative}: excluded page contains replacement analytics ({reason})")
        else:
            eligible.append(relative)
            if goat_count == 0:
                violations.append(f"{relative}: eligible page lacks GoatCounter")
            elif goat_count > 1:
                violations.append(f"{relative}: eligible page contains {goat_count} GoatCounter snippets")
            if goat_script_count != goat_count:
                violations.append(
                    f"{relative}: GoatCounter attribute/script count mismatch "
                    f"({goat_count} attribute, {goat_script_count} script URL)"
                )
            if goat_count == 1:
                # The canonical snippet must be the final element before </body>.
                tail = markup[markup.index(GOAT_ATTRIBUTE):]
                if not re.search(r"</script>\s*</body>", tail, re.I):
                    violations.append(f"{relative}: GoatCounter is not immediately before </body>")

        if goat_count:
            goat_pages.append(relative)

    print(f"Eligible pages checked ({len(eligible)}):")
    for path in eligible:
        print(f"  {path}")
    print(f"Excluded pages checked ({len(excluded)}):")
    for path in excluded:
        print(f"  {path} — {exclusion_reason(path)}")
    print(f"Pages containing GoatCounter ({len(goat_pages)}):")
    for path in goat_pages:
        print(f"  {path}")
    print(f"Violations ({len(violations)}):")
    for violation in violations:
        print(f"  {violation}")

    result = "FAIL" if violations else "PASS"
    print(f"Result: {result}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
