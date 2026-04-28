#!/usr/bin/env python3
from pathlib import Path
import sys

css_path = Path('assets/css/rdp-tailwind.css')
if not css_path.exists():
    print('Missing assets/css/rdp-tailwind.css')
    sys.exit(1)

css = css_path.read_text(errors='ignore')
required = [
    '.flex{',
    '.grid{',
    '.min-h-screen{',
    '.mx-auto{',
    '.px-4{',
    '.py-8{',
    '.text-center{',
    '.rounded-lg{',
]
missing = [selector for selector in required if selector not in css]
if missing:
    print('CSS smoke-check failed. Missing selectors:')
    for selector in missing:
        print(f' - {selector}')
    sys.exit(1)

if len(css) < 7000:
    print(f'CSS smoke-check failed. File too small ({len(css)} bytes), expected full utility output.')
    sys.exit(1)

print(f'CSS smoke-check passed ({len(css)} bytes).')
