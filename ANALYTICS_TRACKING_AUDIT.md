# Analytics / Tracking Audit

Audit date: 2026-06-22

## Summary

Google Analytics / Google Tag Manager (`G-QJ3L9CT4Z7`) snippets remain on a subset of public HTML pages. No Plausible, Umami, Microsoft Clarity, Hotjar, Fathom, or `google-analytics.com` library references were found in public page markup. This audit does not remove any analytics code.

## Findings

| File | Line(s) | Provider | Snippet found |
| --- | ---: | --- | --- |
| `about/index.html` | 130-137 | Google Analytics / Google Tag Manager | `preconnect` and `dns-prefetch` to `www.googletagmanager.com`; `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `alpr-trap/index.html` | 91-96 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `analytics/index.html` | 146-153 | Google Analytics / Google Tag Manager | `preconnect` and `dns-prefetch` to `www.googletagmanager.com`; `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `cross-and-capitol/index.html` | 52-57 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `funding_flow/index.html` | 92-97 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `index.html` | 95-102 | Google Analytics / Google Tag Manager | `preconnect` and `dns-prefetch` to `www.googletagmanager.com`; `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `iowa-alpr-reform/index.html` | 1296-1301 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `ipers-wiggins/index.html` | 119-120 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; inline `dataLayer` / `gtag('config','G-QJ3L9CT4Z7')` |
| `save_iowa/index.html` | 72-73 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; inline `dataLayer` / `gtag('config','G-QJ3L9CT4Z7')` |
| `secure-tips/index.html` | 64-71 | Google Analytics / Google Tag Manager | `preconnect` and `dns-prefetch` to `www.googletagmanager.com`; `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `security-policy/index.html` | 97-104 | Google Analytics / Google Tag Manager | `preconnect` and `dns-prefetch` to `www.googletagmanager.com`; `gtag/js?id=G-QJ3L9CT4Z7`; `dataLayer`; `gtag('config', 'G-QJ3L9CT4Z7')` |
| `shutdown-accountability/index.html` | 66-67 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; inline `dataLayer` / `gtag('config','G-QJ3L9CT4Z7')` |
| `shutdown-analysis/index.html` | 68-69 | Google Analytics / Google Tag Manager | `gtag/js?id=G-QJ3L9CT4Z7`; inline `dataLayer` / `gtag('config','G-QJ3L9CT4Z7')` |

## Non-tracking keyword matches reviewed

The audit search also matched ordinary prose using terms like "plausible" or "implications" and privacy-policy language mentioning advertising pixels. Those are not active analytics scripts or pixels.

## Prepared removal plan for a follow-up privacy branch

1. Remove all Google Analytics / gtag loader scripts and inline `dataLayer` / `gtag()` snippets.
2. Remove `preconnect` and `dns-prefetch` hints to `www.googletagmanager.com`.
3. Update privacy and analytics page copy if the site no longer uses analytics.
4. Validate no remaining tracker matches, no broken layouts, and no browser console errors.
