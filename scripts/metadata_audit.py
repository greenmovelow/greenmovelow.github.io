#!/usr/bin/env python3
from pathlib import Path
import re
import sys

html_files = sorted(Path('.').glob('**/*.html'))
errors = []
req_meta = [
    ('property', 'og:title'),
    ('property', 'og:description'),
    ('property', 'og:image'),
    ('property', 'og:url'),
    ('name', 'twitter:title'),
    ('name', 'twitter:description'),
    ('name', 'twitter:image'),
    ('name', 'twitter:url'),
]

def get_meta(text, attr_name, attr_val):
    pat = re.compile(rf'<meta[^>]*\b{attr_name}=["\']{re.escape(attr_val)}["\'][^>]*\bcontent=["\']([^"\']*)["\']|<meta[^>]*\bcontent=["\']([^"\']*)["\'][^>]*\b{attr_name}=["\']{re.escape(attr_val)}["\']', re.I)
    m = pat.search(text)
    if not m:
        return None
    return m.group(1) or m.group(2) or ''

for f in html_files:
    text = f.read_text(errors='ignore')

    # required OG/Twitter fields
    for attr_name, attr_val in req_meta:
        if get_meta(text, attr_name, attr_val) is None:
            errors.append(f"{f}: missing {attr_name}={attr_val}")

    canonical = re.search(r'<link[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', text, re.I)
    canonical_url = canonical.group(1).strip() if canonical else None
    og_url = get_meta(text, 'property', 'og:url')
    tw_url = get_meta(text, 'name', 'twitter:url')

    if canonical_url and og_url and canonical_url != og_url:
        errors.append(f"{f}: canonical != og:url ({canonical_url} != {og_url})")
    if canonical_url and tw_url and canonical_url != tw_url:
        errors.append(f"{f}: canonical != twitter:url ({canonical_url} != {tw_url})")

    if '/assets/OG/' in text:
        errors.append(f"{f}: contains uppercase /assets/OG/ path")

    title = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
    desc = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']', text, re.I)
    t = (title.group(1).strip() if title else '').lower()
    d = (desc.group(1).strip() if desc else '').lower()
    if t == 'untitled':
        errors.append(f"{f}: title is Untitled")
    if d == 'untitled':
        errors.append(f"{f}: description is Untitled")

if errors:
    print(f"Metadata audit failed ({len(errors)} issues):")
    for e in errors:
        print(f" - {e}")
    sys.exit(1)

print(f"Metadata audit passed for {len(html_files)} HTML files.")
