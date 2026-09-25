// Generate lightweight Markdown companions from the published HTML source.
// Run `npm run build:markdown` after editing any page in PAGES.
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const TurndownService = require('turndown');

const root = path.resolve(__dirname, '..');
const site = 'https://restoring-democracy.org';
const pages = ['/', '/about/', '/corrections/', '/analytics/', '/team/', '/ai-use/'];
const check = process.argv.includes('--check');
let stale = false;

for (const pathname of pages) {
  const directory = path.join(root, pathname);
  const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  const { document } = parseHTML(html);
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || new URL(pathname, site).href;
  const title = document.querySelector('title')?.textContent.trim();
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
  if (!title || !description) throw new Error(`Missing page metadata: ${pathname}`);

  // Retain the published editorial body and links, omitting site chrome and
  // scripts that cannot be represented usefully in a text document.
  const body = document.body;
  // A keyboard skip link is useful in HTML but not in a linear document.
  if (pathname === '/ai-use/') body.querySelector('.skip-link')?.remove();
  if (pathname === '/') {
    // The browser replaces this old HTML fallback with a live JSON feed. A
    // static Markdown copy would otherwise advertise months-old stories.
    const liveFeed = body.querySelector('section[aria-label="Latest publications"]');
    if (liveFeed) {
      const replacement = document.createElement('section');
      replacement.innerHTML = '<h2>Latest reporting</h2><p><a href="https://investigations.restoring-democracy.org/archive">Read the current Investigations Desk archive</a>.</p>';
      liveFeed.replaceWith(replacement);
    }
  }
  for (const element of body.querySelectorAll('nav, footer, script, style, svg, button, form, noscript, template')) {
    element.remove();
  }
  for (const element of body.querySelectorAll('[aria-hidden="true"], [hidden]')) element.remove();
  for (const element of body.querySelectorAll('a[href]')) {
    const href = element.getAttribute('href');
    if (href && !/^(mailto:|tel:|javascript:)/i.test(href)) {
      element.setAttribute('href', new URL(href, canonical).href);
    }
  }
  for (const element of body.querySelectorAll('img[src]')) {
    element.setAttribute('src', new URL(element.getAttribute('src'), canonical).href);
  }

  const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
  converter.remove(['iframe', 'input', 'select', 'textarea']);
  const content = converter.turndown(body.innerHTML).replace(/\n{3,}/g, '\n\n').trim();
  const markdown = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `canonical: ${JSON.stringify(canonical)}`,
    '---',
    '',
    content,
    '',
  ].join('\n');
  const destination = path.join(directory, 'index.md');
  if (check) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== markdown) {
      console.error(`Stale Markdown: ${path.relative(root, destination)}`);
      stale = true;
    }
  } else {
    fs.writeFileSync(destination, markdown);
    console.log(`Generated ${path.relative(root, destination)}`);
  }
}
if (stale) process.exitCode = 1;
