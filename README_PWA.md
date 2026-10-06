# Installable web app

Restoring Democracy's Promise is already installable in Chrome and in use on
Android. Preserve the installed app's identity, icons, colors, and launch
experience when changing this configuration.

## Existing implementation

The root `manifest.json`, linked from the homepage head, supplies the app name,
`RDP` short name, `/` start URL, `standalone` display mode, and seven Android PNG
icons: `/android-icon-{size}x{size}.png` for 36, 48, 72, 96, 144, 192, and 512.
The manifest background and theme colors are both `#24473e`. Together with
production HTTPS, these explain the reported Chrome installability; a service
worker is not required for that behavior in current Chrome.

Explicit `id: "/"` preserves the identity previously inferred from the root
start URL. Explicit `scope: "/"` preserves the root scope previously inferred
from that URL. The description adds metadata without changing navigation,
rendering, or the manifest's existing icon array.

There is **no service worker, registration, offline reporting cache, custom
install prompt, or dedicated launch/splash asset** in the repository. The
reported Android splash experience is consistent with Chrome generating it from
the manifest icon, background color, and theme color. Device rendering was not
retested during this change. Reporting and navigation remain network-dependent.
No service worker was added: cached investigative copy could become stale after
a correction.

## Preserved assets and metadata

- Homepage favicons: `/favicon.ico` and `/favicon-{size}x{size}.png` for 16, 32,
  and 96, plus the 192px Android icon declaration.
- Homepage Apple touch icons: `/apple-icon-{size}x{size}.png` for 57, 60, 72, 76,
  114, 120, 144, 152, and 180. Additional retained root assets are
  `apple-icon.png`, `apple-icon-precomposed.png`, `apple-touch-icon.png`, and
  `apple-touch-icon-precomposed.png`.
- `browserconfig.xml` references the 70, 150, and 310px Microsoft tile icons
  and uses `#24473E`. The existing wide-tile reference also uses the 310px
  square asset. `ms-icon-144x144.png` is referenced by homepage tile metadata.
- Branding WebP files: `assets/Square_logo_transparent.webp`, its `_80` variant,
  `assets/og/Banner_RDP_Clear.webp`,
  `assets/og/Banner_RDP_Gen3_Gold_Aperture_1536.webp`, and the
  `Banner_RDP_Gen3_Gold_Aperture_Clear` variants at 320, 640, and 1536px.
  These appear in page branding, rather than the manifest or a dedicated launch
  configuration. Other WebP assets are analytics branding, editorial imagery,
  a team profile, and the Des Moines ALPR scenes; none configure app launch.

The 192px and 512px icons were visually inspected. A pixel check places the
visible aperture within about 37% of the image width from the center, inside
the standard 40% maskable safe radius. Their opaque background matches
`#24473e`. They still retain the default `any` purpose to preserve the existing
installed icon choice. A future maskable declaration should follow an adaptive
mask/device review; dedicated artwork is not required by this safe-area check.
No assets were altered or renamed.

`_headers` has no custom manifest/icon MIME types or cache rules. Its existing
15-minute feed JSON cache with stale revalidation remains unchanged. The private
records-status route explicitly disallows manifests and workers through its
content security policy. No `netlify.toml` or PWA-specific build step is present;
Netlify serves the existing static files. This change does not alter deployment
settings, headers, or redirects.

## Head coverage audit

The audit examined all 49 tracked HTML files, including every manifest
reference. Forty link to `/manifest.json`; 37 also use `#24473e`. This includes
the homepage, About, Corrections, Analytics, Team, AI Use, the journalism landing
page, and most investigation/exhibit pages. The independently maintained static
heads are intentionally left unchanged in this PR.

| File | Manifest | Theme color |
| --- | --- | --- |
| `infographics/ipers-bonus-calculator/index.html` | `/manifest.json` | `#0d1417` |
| `infographics/standing-query/index.html` | `/manifest.json` | `#12151a` |
| `iowa-alpr-reform/index.html` | `/manifest.json` | `#0b1512` |
| `infographics/des-moines-alpr/index.html` | Absent | `#2d5c4f` |
| `infographics/des-moines-alpr/network/index.html` | Absent | `#2d5c4f` |
| `infographics/des-moines-alpr/records/index.html` | Absent | `#2d5c4f` |
| `infographics/des-moines-alpr/visual/index.html` | Absent | Absent |
| `go/save_backfill_ia/index.html` | Absent | Absent |
| `go/when-war-tests-democracy/index.html` | Absent | Absent |
| `journalism/cross-and-capitol/index.html` | Absent | Absent |
| `resources/reference/records/status/index.html` | Absent | Absent |

The smallest follow-up for public page coverage is to add the manifest link to
the Des Moines ALPR shared head in `_src/build.mjs`, then regenerate its pages,
retaining their existing theme color. The records page is internal/noindex; the
visual route and two `go` routes are redirects. The orphan journalism artifact
and restricted records-status utility do not need install metadata. Avoid
normalizing exhibit theme colors without reviewing their visual presentation.

## Regression check

Run `npm run test:pwa` or `python3 scripts/audit_pwa.py` from the repository root.
The validator uses only Python's standard library. It checks valid manifest JSON,
stable root identity/scope/start URL, app names, standalone display, unchanged
colors, a nonempty description and icon array, all local icon files, PNG
dimensions, ordinary 192px/512px icons, and the homepage's manifest, theme,
favicon, and Apple-touch declarations.

`.github/workflows/pwa-check.yml` runs the same check on relevant pull requests
and pushes to `main`, without npm installation. Existing Markdown, sitemap,
feed-importer, asset-reference, and calculator checks remain independent.

This validates the static configuration, not device installation or deployed
headers. A deploy-preview audit and Android reinstall/update check remain useful
release checks when preview access and a device are available. Do not introduce
offline page caching or change the working icons to improve an audit score.
