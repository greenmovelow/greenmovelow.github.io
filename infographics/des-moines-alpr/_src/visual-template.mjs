/* ============================================================================
   RDP — Des Moines ALPR visual overview.

   This canonical front page reuses the adjudicated export, counts and Page Nine
   facsimile while sending readers to the detailed /network/ explorer.

   Relationship paths are not emitted here. visual.js creates one whole,
   undirected path only after a reader selects a represented state.
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const us = JSON.parse(readFileSync(require.resolve('us-atlas/states-10m.json'), 'utf8'));

const FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY'
};

function buildMap(stateCounts, esc) {
  const counts = new Map(stateCounts.rows.map((row) => [row.state_code, row]));
  const features = feature(us, us.objects.states).features
    .filter((shape) => FIPS[String(shape.id).padStart(2, '0')]);
  const projection = geoAlbersUsa().translate([480, 300]).scale(1200);
  const path = geoPath(projection);
  const dsm = projection([-93.625, 41.5868]);

  const states = features.map((shape, index) => {
    const code = FIPS[String(shape.id).padStart(2, '0')];
    const row = counts.get(code);
    const centroid = path.centroid(shape);
    const represented = Boolean(row);
    const attrs = represented
      ? ` tabindex="0" role="button" aria-pressed="false" data-count="${row.count}" data-name="${esc(row.state_raw)}" data-cx="${centroid[0].toFixed(2)}" data-cy="${centroid[1].toFixed(2)}"`
      : ' aria-hidden="true"';
    return `<path class="visual-state${represented ? ' is-configured is-in-scope' : ''}${code === 'IA' ? ' is-home' : ''}" data-state="${code}"${attrs} style="--state-delay:${index * 12}ms" d="${path(shape)}"><title>${esc(shape.properties?.name || code)}${represented ? ` — ${row.count} configured relationship${row.count === 1 ? '' : 's'}` : ' — not represented in the export'}</title></path>`;
  }).join('\n');

  return `<svg id="visual-map" class="visual-map" viewBox="0 0 960 600" role="img" aria-labelledby="map-title map-desc">
    <title id="map-title">Configured detection-sharing relationships by state</title>
    <desc id="map-desc">A United States map with Iowa anchored in gold and the 36 states and the District of Columbia represented in the August 2026 export illuminated in green. Selecting a represented state may draw one undirected relationship path from Des Moines. The path represents configuration only.</desc>
    <defs>
      <filter id="soft-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="map-vignette"><stop offset="0" stop-color="#173c35" stop-opacity=".3"/><stop offset="1" stop-color="#07100f" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse class="map-atmosphere" cx="510" cy="300" rx="430" ry="250" fill="url(#map-vignette)" aria-hidden="true"/>
    <g class="state-layer">${states}</g>
    <g class="relationship-layer" id="relationship-layer" aria-hidden="true"></g>
    <g class="des-moines-anchor" transform="translate(${dsm[0].toFixed(2)} ${dsm[1].toFixed(2)})" aria-hidden="true">
      <circle class="anchor-halo" r="22"/>
      <circle class="anchor-core" r="5"/>
      <text x="12" y="4">DES MOINES</text>
    </g>
  </svg>`;
}

function mapTable(stateCounts, esc) {
  return `<details class="visual-access-table">
    <summary>Read the map as a list</summary>
    <div class="visual-table-scroll"><table>
      <caption>Configured detection-sharing relationships in the City&rsquo;s August 2026 export, grouped by the export&rsquo;s State column.</caption>
      <thead><tr><th scope="col">Jurisdiction</th><th scope="col">Relationships</th></tr></thead>
      <tbody>${stateCounts.rows.map((row) => `<tr><th scope="row">${esc(row.state_raw)}</th><td>${row.count}</td></tr>`).join('')}</tbody>
    </table></div>
  </details>`;
}

export function buildVisualPage({ head, foot, esc, stateCounts, nodes, platform, copy }) {
  const totals = stateCounts.totals;
  if (totals.agencies !== nodes.totals.agencies || totals.agencies !== platform.sharing.agencies) {
    throw new Error('visual: the governed relationship totals disagree');
  }

  const body = `
<script>document.body.classList.add('visual-page');</script>
<section class="visual-hero" aria-labelledby="visual-hero-h">
  <div class="visual-hero-copy reveal">
    <h1 id="visual-hero-h">WHERE DES MOINES PLATE DATA CAN GO</h1>
    <p class="visual-dek">The map shows the geographic scale of sharing settings in one City export&mdash;not a history of activity.</p>
  </div>
  <div class="visual-hero-stage">
    <div class="hero-stats reveal" aria-label="Key totals">
      <p><strong class="tnum">${totals.agencies}</strong><span>configured relationships</span></p>
      <p><strong class="tnum">${totals.states_excl_dc}</strong><span>states + D.C.</span></p>
      <p class="sr-only">The export lists at least ${totals.agencies} agencies configured to share detection data.</p>
    </div>
    <div class="map-shell reveal">
      ${buildMap(stateCounts, esc)}
      <div class="map-readout" id="map-readout">
        <p class="map-readout-label">SELECT A STATE</p>
        <p class="map-readout-value">See its export count</p>
      </div>
    </div>
  </div>
  <div class="visual-hero-footer reveal">
    <div class="scope-controls" role="group" aria-label="Map scope">
      <button type="button" class="scope-button is-active" data-scope="all" aria-pressed="true">ALL</button>
      <button type="button" class="scope-button" data-scope="iowa" aria-pressed="false">IOWA</button>
      <button type="button" class="scope-button" data-scope="outside" aria-pressed="false">OUTSIDE IOWA</button>
    </div>
    <p class="map-caveat"><span aria-hidden="true">i</span> Map shows configured detection-sharing relationships, not searches, views or transfers.</p>
    <p class="map-context"><span>${totals.non_iowa} outside Iowa</span><span>${totals.federal_typed} rows typed Federal</span><span>${totals.receiving} also configured as receiving</span></p>
    <p class="hero-source">The August 2026 export records sharing settings. It does not show whether any particular agency searched, viewed or received a Des Moines plate record.</p>
    <nav class="visual-cta-group" aria-label="Continue reading">
      <a class="visual-cta visual-cta--primary" href="${esc(copy.exhibit.article_link.url)}">${esc(copy.exhibit.article_link.label)} <span aria-hidden="true">&rarr;</span></a>
      <a class="visual-cta visual-cta--secondary" href="/infographics/des-moines-alpr/network/">Explore the network <span aria-hidden="true">&rarr;</span></a>
      <a class="visual-cta visual-cta--tertiary" href="${esc(copy.exhibit.subscribe_link.url)}" rel="noopener">${esc(copy.exhibit.subscribe_link.label)} <span aria-hidden="true">&rarr;</span></a>
    </nav>
  </div>
  <p id="map-status" class="sr-only" role="status" aria-live="polite">Showing all represented jurisdictions.</p>
  ${mapTable(stateCounts, esc)}
</section>

<section class="visual-section fixed-mobile" aria-labelledby="fixed-mobile-h">
  <h2 id="fixed-mobile-h" class="sr-only">Fixed and mobile plate readers</h2>
  <div class="fixed-panel reveal">
    <div class="physical-copy">
      <p class="physical-lead">A fixed plate reader has an address.</p>
      <p class="physical-label">FIXED</p>
      <p class="physical-note">Known location</p>
    </div>
  </div>
  <div class="mobile-panel reveal">
    <div class="physical-copy">
      <p class="physical-lead">A mobile reader&rsquo;s possible geography moves with the vehicle carrying it.</p>
      <p class="physical-label">MOBILE</p>
      <p class="physical-note"><strong>120</strong> in-car systems reported by the City in December 2025</p>
      <p class="physical-caveat">Records do not disclose the mobile fleet&rsquo;s travel history or scan volume.</p>
    </div>
  </div>
  <p class="sr-only">Visual summary: the fixed device is shown at one marked point. The mobile system is shown on a vehicle without a route, because the reviewed records do not disclose where the fleet traveled.</p>
</section>

<section class="visual-section observation" aria-labelledby="observation-h">
  <div class="section-heading reveal"><h2 id="observation-h">THE OBSERVATION BECOMES SEARCHABLE</h2></div>
  <div class="observation-stage reveal">
    <div class="street-frame" aria-hidden="true"><span class="frame-corner frame-corner--a"></span><span class="frame-corner frame-corner--b"></span></div>
    <p class="stage-label stage-label--street">STREET</p>
    <div class="field field--plate"><span>PLATE</span><strong>&bull;&bull;&bull;&bull;&bull;&bull;</strong></div>
    <div class="field field--time"><span>TIME</span><strong>DATE + TIME</strong></div>
    <div class="field field--location"><span>LOCATION</span><strong>COORDINATES</strong></div>
    <div class="platform-node"><span class="platform-rings" aria-hidden="true"></span><strong>VEHICLEMANAGER<br>/ LEARN</strong></div>
    <div class="possibility possibility--alert"><strong>ALERT</strong></div>
    <div class="possibility possibility--search"><strong>LATER SEARCH</strong></div>
    <div class="possibility possibility--share"><strong>CONFIGURED SHARING</strong></div>
  </div>
  <ul class="use-examples reveal" aria-label="Legitimate police-use examples"><li>Missing person</li><li>Stolen vehicle</li><li>Investigation</li></ul>
  <p class="policy-line reveal">DMPD policy says an ALPR alert alone is not sufficient probable cause for a stop.</p>
  <p class="sr-only">Visual summary: plate, time and location fields sit between a street observation and the VehicleManager or LEARN platform. Alert, later search and configured sharing are shown as separate possibilities, not a deterministic sequence.</p>
</section>

<section class="visual-section page-nine" aria-labelledby="page-nine-h">
  <div class="page-nine-copy reveal">
    <h2 id="page-nine-h">PAGE NINE</h2>
    <blockquote>&ldquo;by selecting this option within Vigilant VehicleManager&rdquo;</blockquote>
    <p>Page 9 of the city-produced contract packet describes sharing as a setting inside VehicleManager.</p>
  </div>
  <figure class="document-stage reveal">
    <div class="document-frame"><img src="assets/facsimiles/R-MVA-4.5.png" width="1334" height="918" loading="lazy" decoding="async" alt="Unaltered region crop from Page 9 of the City-produced contract packet, including sections 4.4 and 4.5 of the Mobile Video Addendum."></div>
    <figcaption>Source: 23-1629.pdf, page 9. Straight 200 dpi region crop; no pixel altered.</figcaption>
  </figure>
</section>

<section class="visual-section three-sources" aria-labelledby="sources-h">
  <div class="section-heading reveal"><h2 id="sources-h">THREE SOURCES. ONE PLATFORM.</h2></div>
  <div class="source-stage reveal">
    <div class="source-stream source-stream--city"><div class="stream-text"><strong>DES MOINES<br>MOBILE / FIXED CAMERAS</strong></div><div class="stream-points" aria-hidden="true"></div></div>
    <div class="source-stream source-stream--agency"><div class="stream-text"><strong>OTHER AGENCY DATA</strong></div><div class="stream-rings" aria-hidden="true"></div></div>
    <div class="source-stream source-stream--commercial"><div class="stream-text"><strong>COMMERCIALLY ACQUIRED NATIONAL<br>VEHICLE-LOCATION DATA</strong></div><div class="stream-contours" aria-hidden="true"></div></div>
    <div class="source-platform"><span aria-hidden="true"></span><strong>VEHICLEMANAGER<br>/ LEARN</strong></div>
  </div>
  <p class="source-caption reveal">Des Moines&rsquo; 2023 subscription included commercially acquired national vehicle-location data.</p>
  <details class="face-note reveal"><summary>One additional quotation detail</summary><p>The quotation also listed FaceSearch and image tools. Records reviewed do not establish which tools city personnel actually used.</p></details>
  <p class="sr-only">Visual summary: three differently styled, unlabeled-direction bands converge spatially at the platform. They represent sources available in the platform, not proof that any particular record was used or transferred.</p>
</section>

<section class="visual-section record-light" aria-labelledby="record-light-h">
  <div class="section-heading reveal"><h2 id="record-light-h">WHAT THE RECORD ILLUMINATES &mdash;<br>AND WHAT IT DOESN&rsquo;T</h2></div>
  <div class="record-split">
    <div class="record-known reveal"><h3>VISIBLE IN THE RECORD</h3><ul><li>Configured sharing</li><li>Policy</li><li>Retention rule</li><li>Procurement</li><li>Reported equipment</li></ul></div>
    <div class="record-unknown reveal"><h3>DARK / UNRESOLVED</h3><ul><li>Actual mobile travel</li><li>Total scan volume</li><li>Complete search history</li><li>Individual record views</li><li>Most relationship start dates</li></ul></div>
  </div>
  <nav class="visual-end-links reveal" aria-label="Continue reading">
    <a href="${esc(copy.exhibit.article_link.url)}">READ THE FULL STORY <span aria-hidden="true">&rarr;</span></a>
    <a href="/infographics/des-moines-alpr/network/">EXPLORE THE NETWORK <span aria-hidden="true">&rarr;</span></a>
    <a href="${esc(copy.exhibit.subscribe_link.url)}" rel="noopener">SUBSCRIBE &mdash; 7 DAYS FREE <span aria-hidden="true">&rarr;</span></a>
  </nav>
</section>`;

  return head({
    title: 'Where Des Moines plate data can go | Restoring Democracy\'s Promise',
    description: 'A visual companion showing mobile plate readers, searchable observations and configured sharing in Des Moines.',
    canonical: 'https://restoring-democracy.org/infographics/des-moines-alpr/',
    sections: [],
    key: 'overview',
    draftNote: 'Not published. Visual overview aligned to the final publication candidate, 15 September 2026.',
    extraStyles: '<link rel="stylesheet" href="assets/visual.css">'
  }) + body + foot({
    receiptIds: [],
    omitReceipts: true,
    extraScripts: '<script src="assets/exhibit.js" defer></script>\n<script src="assets/visual.js" defer></script>'
  });
}
