/* Moved from /journalism/index.html (inline script 2) so the site CSP can omit 'unsafe-inline'. */
    /* Latest investigations — progressive enhancement over the
       static list above. Reads the same-origin /latest-investigations.json that
       .github/workflows/latest-investigations.yml builds on a schedule from the
       Desk's RSS feed (see scripts/build_latest_investigations.py). No CORS, no
       third-party request. On ANY failure the static list stays untouched. */
    (function () {
      var ENDPOINT = '/latest-investigations.json';
      var LINK_PREFIX = 'https://investigations.restoring-democracy.org/';
      var list = document.getElementById('journalism-feed');
      if (!list || !('fetch' in window)) return;
      function esc(s){ var p=document.createElement('span'); p.textContent=String(s); return p.innerHTML; }
      fetch(ENDPOINT)
        .then(function (r){ if(!r.ok) throw 0; return r.json(); })
        .then(function (data){
          var items = ((data && data.items) || []).filter(function (it) {
            return it && typeof it.title === 'string' && it.title
              && typeof it.link === 'string' && it.link.indexOf(LINK_PREFIX) === 0;
          }).slice(0, 6);
          if (!items.length) throw 0;
          list.innerHTML = items.map(function (it){
            var dt = typeof it.date === 'string' ? it.date.slice(0, 10) : '';
            var label = typeof it.dateLabel === 'string' ? it.dateLabel : '';
            var category = typeof it.category === 'string' && it.category ? it.category : 'Investigation';
            return '<li><a href="' + esc(it.link) + '" target="_blank" rel="noopener noreferrer"'
              + ' class="desk-row section-card inv-card p-4 flex flex-col sm:flex-row sm:items-baseline gap-x-4 gap-y-1">'
              + '<time class="text-xs text-slate-600 tabular-nums flex-shrink-0 w-16" datetime="' + esc(dt) + '">' + esc(label) + '</time>'
              + '<span class="badge bg-brand-green/10 text-brand-green flex-shrink-0">' + esc(category) + '</span>'
              + '<span class="desk-title text-sm font-semibold text-brand-green-dark min-w-0">' + esc(it.title) + '</span>'
              + '<span class="desk-cta text-brand-green text-xs font-semibold sm:ml-auto flex-shrink-0">Read investigation &rarr;</span>'
              + '</a></li>';
          }).join('');
        })
        .catch(function (){ /* static fallback stays */ });
    })();
