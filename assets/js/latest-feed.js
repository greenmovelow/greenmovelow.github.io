/* Moved from /index.html (inline script 2) so the site CSP can omit 'unsafe-inline'. */
    /* Latest feed — refreshes the rows that scripts/build_latest_investigations.py
       pre-renders into #latest-feed from the same-origin /latest-investigations.json
       (built on a schedule by .github/workflows/latest-investigations.yml from the
       Investigations Desk RSS feed and public section metadata). No CORS involved.
       Either copy can be stale because of CDN and browser caching, so both carry
       the builder's feed revision (UTC generation time): data-feed-revision on
       #latest-feed and "revision" in the JSON. The rows are replaced only when the
       JSON revision is valid and strictly newer than the page's, and its rows
       differ; an older, equal, missing or malformed revision never replaces what
       is shown. On ANY failure — missing file, bad JSON, empty items — the
       pre-rendered rows (or the fallback message) stay untouched. The archive link
       sits outside #latest-feed, so rendering never duplicates or removes it.
       The row markup must match render_feed_html() in the builder; see
       scripts/test_latest_feed_render.js. data-cfasync="false" stops Cloudflare
       Rocket Loader from deferring this script until after the load event. */
    (function () {
      var ENDPOINT = '/latest-investigations.json';
      var LINK_PREFIX = 'https://investigations.restoring-democracy.org/';
      var list = document.getElementById('latest-feed');
      var statusEl = document.getElementById('feed-status');
      if (!list || !('fetch' in window)) return;
      function esc(s){ var p=document.createElement('span'); p.textContent=String(s); return p.innerHTML.replace(/"/g, '&quot;'); }
      function rowKey(link, dt, label, title, category){ return [link, dt, label, title, category].join('\u0001'); }
      // Feed revision "YYYY-MM-DDTHH:MM:SSZ" -> ms, or NaN when missing/malformed.
      function revisionTime(v){ return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v) ? Date.parse(v) : NaN; }
      var shownRevision = revisionTime(list.getAttribute('data-feed-revision'));
      // What the visitor already sees, read from the pre-rendered rows.
      var shown = [].map.call(list.querySelectorAll('a.feed-item'), function (a) {
        var time = a.querySelector('time'), title = a.querySelector('.feed-title'), cat = a.querySelector('.feed-category');
        return rowKey(a.getAttribute('href'), time ? time.getAttribute('datetime') : '', time ? time.textContent : '',
          title ? title.textContent : '', cat ? cat.textContent : '');
      }).join('\u0002');
      fetch(ENDPOINT)
        .then(function (r){ if(!r.ok) throw 0; return r.json(); })
        .then(function (data){
          var revision = data && data.revision;
          var jsonRevision = revisionTime(revision);
          // With rows on screen, only a demonstrably newer feed may replace them.
          // (With no rows, i.e. the no-feed fallback, any valid feed is an improvement.)
          if (shown && !(jsonRevision > shownRevision)) return;
          var items = ((data && data.items) || []).filter(function (it) {
            return it && typeof it.title === 'string' && it.title
              && typeof it.link === 'string' && it.link.indexOf(LINK_PREFIX) === 0;
          }).slice(0, 11).map(function (it) {
            return {
              link: it.link, title: it.title,
              dt: typeof it.date === 'string' ? it.date.slice(0, 10) : '',
              label: typeof it.dateLabel === 'string' ? it.dateLabel : '',
              // Legacy JSON called every post "Investigation". Only display an
              // assigned section label; tags and editorial formats are separate.
              category: it.categorySource === 'section' && typeof it.category === 'string'
                ? it.category.trim().slice(0, 100) : ''
            };
          });
          if (!items.length) throw 0;
          var latest = items.map(function (it) {
            return rowKey(it.link, it.dt, it.label, it.title, it.category ? 'Category: ' + it.category : '');
          }).join('\u0002');
          if (latest === shown) { list.setAttribute('data-feed-revision', revision); return; } // Same rows: no DOM change.
          var rows = items.map(function (it, index){
            return '<a href="'+esc(it.link)+'" target="_blank" rel="noopener noreferrer"'
              + ' class="feed-item feed-row'+(index === 0 ? ' feed-lead' : '')+' py-2.5 rounded group">'
              + '<time class="feed-date text-xs text-brand-sand/80 tabular-nums" datetime="'+esc(it.dt)+'">'+esc(it.label)+'</time>'
              + '<span class="feed-title text-sm text-brand-sand group-hover:text-brand-gold transition font-medium leading-snug">'+esc(it.title)+'</span>'
              + '<span class="feed-category">'+(it.category ? '<span class="sr-only">Category: </span>'+esc(it.category) : '')+'</span>'
              + '</a>';
          }).join('');
          rows = '<div class="feed-columns" aria-hidden="true"><span>Date</span><span>Publication</span><span>Category</span></div>' + rows;
          list.innerHTML = rows;
          if (!isNaN(jsonRevision)) list.setAttribute('data-feed-revision', revision);
          if (statusEl) statusEl.textContent = 'Latest investigations updated.';
        })
        .catch(function (){ /* Keep the pre-rendered rows or fallback message. */ });
    })();
