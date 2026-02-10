#!/usr/bin/env python3
"""Verify local assets referenced by src/href in top-level HTML files exist."""

import re
from pathlib import Path

pattern = re.compile(r"(?:src|href)=['\"]([^'\"]+)['\"]")
missing: list[tuple[str, str]] = []

for html_file in Path('.').glob('*.html'):
    text = html_file.read_text(errors='ignore')
    for ref in pattern.findall(text):
        if 'assets/' not in ref:
            continue
        if ref.startswith(('http://', 'https://', 'data:', 'javascript:')):
            continue

        path_ref = ref.split('?', 1)[0].split('#', 1)[0]
        candidate = Path(f'.{path_ref}') if path_ref.startswith('/') else html_file.parent / path_ref
        if not candidate.exists():
            missing.append((html_file.as_posix(), ref))

if missing:
    print(f"Missing asset references: {len(missing)}")
    for html_file, ref in missing:
        print(f" - {html_file}: {ref}")
    raise SystemExit(1)

print('All local asset src/href references resolve.')
