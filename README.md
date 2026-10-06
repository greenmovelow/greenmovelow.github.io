# Restoring Democracy’s Promise

This repository contains the source code for [restoring-democracy.org](https://restoring-democracy.org/), the official web presence for **Restoring Democracy’s Promise**, an independent investigative journalism and civic accountability project.

Restoring Democracy’s Promise publishes evidence-driven reporting, interactive exhibits, public-records analysis, and systems-level investigations focused on democracy, surveillance, public finance, immigration, education, and the hidden machinery of political power.

## Project Mission

Restoring Democracy’s Promise exists to restore democratic accountability through rigorous, source-forward investigations.

We trace money, map influence, document institutional failure, and explain how power operates across government, private industry, courts, data systems, and political networks. The site serves as the public front door for our reporting, exhibits, source dossiers, and reader engagement.

## Website Structure

The site is a static newsroom and exhibit platform built around clean, durable public routes.

Key components include:

1. **Main Landing Page**
   - Introduces the project, its mission, and current investigative priorities.
   - Directs readers to featured investigations, public exhibits, Substack reporting, and contact channels.

2. **Interactive Investigation Pages**
   - Standalone public exhibits built around specific reporting threads.
   - These pages may include timelines, diagrams, document links, source notes, and explanatory graphics.

3. **Source-Forward Dossiers**
   - Public-facing pages that organize evidence, records, filings, and supporting material behind major investigations.
   - These are designed to make complex systems easier for readers, journalists, policymakers, and watchdogs to inspect.

4. **Reader and Press Contact Infrastructure**
   - Dedicated contact paths for press inquiries, corrections, secure tips, and public feedback.

5. **Substack Integration**
   - Long-form reporting is published through Restoring Democracy’s Promise on Substack, while this site provides durable exhibit pages, landing pages, navigation, and supporting public infrastructure.

## Technology Stack

This is a modern static website built for speed, readability, security, and long-term maintainability.

- **Framework:** None. The site uses clean HTML, CSS, and vanilla JavaScript.
- **Styling:** Custom CSS with responsive layouts and page-specific styling where needed.
- **Interactivity:** Vanilla JavaScript for exhibit behavior, timelines, cards, and lightweight data presentation.
- **Deployment:** Hosted through Netlify and connected to this GitHub repository for continuous deployment.
- **Edge / DNS / Security:** Uses Cloudflare for DNS, caching, TLS, and related edge configuration.
- **Routing:** Public pages use clean directory routes where possible, with redirects maintained for older legacy paths.

## Editorial Standards

### Latest publications feed

`.github/workflows/latest-investigations.yml` refreshes the 11 latest standalone
posts every three hours. The RSS feed supplies titles, links, and dates; it does
not currently include the assigned Substack section. The importer resolves each
published post's `section_id` through the public `/api/v1/posts/<slug>` response
and matches it to the publication homepage's public section-name data. The
homepage displays that section as a Category column on desktop and below the
title on phones. Subcategories keep their own names, such as
"Voting Rights & Election Systems".

The importer refreshes assignments even when RSS content is unchanged. It
never substitutes a post tag or the generic "Investigation" label for a section.
Unassigned or unresolvable sections stay blank. Lookup failures preserve the
last verified label for the same article while allowing RSS updates to continue;
if the post lookup succeeds with a different section ID, the old label is not
reused. The JSON itself holds the small last-good section cache, so no separate
cache file or credentials are needed. No post bodies, tags, or subscriber data
are persisted.

Substack's public post endpoint and homepage preload format are unsupported
interfaces and can change. Warnings in the Actions log identify failures; the
next scheduled run retries. A feed fetch or XML parse failure keeps the entire
last-good JSON file. Offline regression tests run on PRs and before scheduled
imports:

```sh
python -m unittest discover -s scripts -p 'test_latest_investigations.py'
python scripts/build_latest_investigations.py
```

### Markdown companions

The homepage, About, Corrections, Analytics, Team, and AI Use pages have generated
Markdown companions at `/index.md`, `/about/index.md`, `/corrections/index.md`,
`/analytics/index.md`, `/team/index.md`, and `/ai-use/index.md`. They are derived from the public HTML source, carry
canonical links back to the HTML pages, and are advertised through
`rel="alternate"` links. The homepage companion links to the live archive in
place of the JavaScript-powered latest-feed fallback.

After editing one of these HTML files, run `npm run build:markdown` and commit
the updated `.md` file. `npm run test:markdown` checks for drift; the PR workflow
runs that check automatically. This pilot does not cover Substack articles.

Restoring Democracy’s Promise emphasizes:

- primary documents whenever possible;
- clear separation between evidence, analysis, and opinion;
- transparent sourcing;
- careful correction of errors;
- public-interest framing;
- accessible explanations of complex systems;
- protection of sensitive sources and vulnerable communities.

This repository contains website infrastructure. Published reporting, source notes, and exhibits may include editorial content subject to additional copyright protections.

## Contact

For press inquiries, tips, corrections, or feedback, use the contact information provided at:

[https://restoring-democracy.org/](https://restoring-democracy.org/)

For sensitive matters, use the secure contact options listed on the site.

## License

Unless otherwise noted, the website code in this repository is licensed under the MIT License. See the `LICENSE` file for details.

Editorial content, reporting, graphics, logos, brand materials, and published investigative work are © Restoring Democracy’s Promise and may not be reused without permission unless separately licensed or quoted under applicable fair-use principles.

## Copyright

© 2023–2026 Restoring Democracy’s Promise. All rights reserved.
