/* ============================================================================
   RDP — Des Moines ALPR exhibit. Shared behaviour for all three routes.

   Progressive enhancement only. Every fact this file reveals is already in the
   static HTML: receipts render as a definition list at the foot of each page
   when JS is unavailable, and no content is hidden behind hover.

   Deliberate omissions, per the exhibit's evidence grammar:
     - nothing animates along a path
     - no connector is drawn by default
     - no element appears in a time-ordered sequence
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- share */
  var shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    var shareLabel = document.getElementById('share-label');
    shareBtn.addEventListener('click', function () {
      var data = { title: document.title, url: window.location.href };
      if (navigator.share) {
        navigator.share(data).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).then(function () {
          if (!shareLabel) return;
          var t = shareLabel.textContent;
          shareLabel.textContent = 'Copied';
          setTimeout(function () { shareLabel.textContent = t; }, 1600);
        }).catch(function () { window.prompt('Copy this link:', window.location.href); });
      } else {
        window.prompt('Copy this link:', window.location.href);
      }
    });
  }

  /* --------------------------------------------- house nav: mobile menu */
  var mobileToggle = document.getElementById('mobile-toggle');
  var mobileMenu = document.getElementById('mobile-menu');
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(open));
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --------------------------------------------- house nav: scrolled state */
  var navBar = document.querySelector('.nav-bar');
  if (navBar) {
    var onScroll = function () {
      navBar.classList.toggle('scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------- receipt drawer */
  var RECEIPTS = window.RDP_RECEIPTS || {};
  var LAYERS = window.RDP_LAYER_LABELS || {};
  var TAGS = window.RDP_TAG_LABELS || {};
  var STATUS = window.RDP_STATUS_LABELS || {};

  /* facsimile paths are stored relative to the exhibit root */
  var depthPrefix = /\/(network|records)\//.test(window.location.pathname) ? '../' : '';

  var drawer = document.getElementById('receipt-drawer');
  var scrim = document.getElementById('receipt-scrim');
  var lastFocus = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function section(title, html, cls) {
    if (!html) return '';
    return '<div class="rd-section"><h4>' + esc(title) + '</h4>' +
      '<div class="' + (cls || '') + '">' + html + '</div></div>';
  }

  function renderReceipt(r) {
    if (!r) return '<p>Receipt not found.</p>';
    var meta = '';
    if (r.record_layer) {
      meta += '<span class="layer-chip"><span class="glyph" aria-hidden="true">&#9744;</span>' +
        esc(LAYERS[r.record_layer] || r.record_layer) + '</span>';
    }
    if (r.source_tag) {
      meta += '<span class="layer-chip">' + esc(TAGS[r.source_tag] || r.source_tag) + '</span>';
    }
    if (r.evidence_status) {
      meta += '<span class="status-pill" data-status="' + esc(r.evidence_status) + '">' +
        '<span class="sg" aria-hidden="true"></span>' +
        esc(STATUS[r.evidence_status] || r.evidence_status) + '</span>';
    }

    var pinpoint = [r.source_document, r.source_date, r.page_or_row]
      .filter(Boolean).map(esc).join(' &middot; ');

    var related = '';
    if (r.related_receipts && r.related_receipts.length) {
      related = r.related_receipts.map(function (id) {
        var rel = RECEIPTS[id];
        return '<button type="button" class="receipt-chip" data-receipt="' + esc(id) + '">' +
          '<span class="rc-label">' + esc(rel ? (rel.display_copy || rel.claim) : id) + '</span></button>';
      }).join('');
    }

    return '' +
      '<div class="rd-head">' +
        '<div><p class="rd-eyebrow">How do you know that?</p>' +
        '<p class="rd-eyebrow" style="color:var(--muted);letter-spacing:.08em">' + esc(r.receipt_id) + '</p></div>' +
        '<button type="button" class="rd-close" id="rd-close" aria-label="Close receipt">&times;</button>' +
      '</div>' +
      '<p class="rd-claim">' + esc(r.claim) + '</p>' +
      '<div class="rd-meta">' + meta + '</div>' +
      section('Source', '<p>' + pinpoint + '</p>') +
      section('In the record', r.source_excerpt
        ? '<p class="rd-excerpt">' + esc(r.source_excerpt) +
          (r.ocr ? '\n\n[Read from a scan by OCR; exact characters may vary.]' : '') + '</p>'
        : '') +
      section('Page image', r.facsimile
        ? '<figure class="fax"><img src="' + esc(depthPrefix + r.facsimile.src) + '" ' +
          'alt="Facsimile: ' + esc(r.facsimile.caption) + '" loading="lazy" decoding="async" ' +
          'width="' + r.facsimile.pixels[0] + '" height="' + r.facsimile.pixels[1] + '">' +
          '<figcaption>' + esc(r.facsimile.caption) +
          ' Source: ' + esc(r.facsimile.source_document) + ', p. ' + r.facsimile.page +
          '. Region crop of a straight render at ' + r.facsimile.render_dpi +
          ' dpi; no pixel altered.</figcaption></figure>'
        : '<p class="rd-facsimile">No page image is shipped for this receipt. ' +
          'The verbatim text above is taken from the record itself.</p>') +
      section('Caveat that travels with this', r.caveat ? '<p>' + esc(r.caveat) + '</p>' : '', 'rd-caveat') +
      section('What this does not establish',
        r.what_it_does_not_establish ? '<p>' + esc(r.what_it_does_not_establish) + '</p>' : '', 'rd-notestab') +
      section('Related', related ? '<div class="rd-related">' + related + '</div>' : '');
  }

  function openDrawer(id) {
    if (!drawer) return;
    var r = RECEIPTS[id];
    drawer.querySelector('.rd-inner').innerHTML = renderReceipt(r);
    drawer.setAttribute('data-open', 'true');
    drawer.removeAttribute('aria-hidden');
    if (scrim) scrim.setAttribute('data-open', 'true');
    var close = document.getElementById('rd-close');
    if (close) {
      close.addEventListener('click', closeDrawer);
      close.focus();
    }
    drawer.scrollTop = 0;
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.setAttribute('data-open', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    if (scrim) scrim.setAttribute('data-open', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest && e.target.closest('[data-receipt]');
    if (trigger) {
      e.preventDefault();
      if (!drawer.contains(trigger)) lastFocus = trigger;
      openDrawer(trigger.getAttribute('data-receipt'));
      return;
    }
    if (scrim && e.target === scrim) closeDrawer();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && drawer.getAttribute('data-open') === 'true') closeDrawer();
  });

  /* keep focus inside the drawer while it is open */
  document.addEventListener('focusin', function (e) {
    if (!drawer || drawer.getAttribute('data-open') !== 'true') return;
    if (drawer.contains(e.target)) return;
    var first = drawer.querySelector('button, a[href]');
    if (first) first.focus();
  });

  /* -------------------------------------------- council-summary switch */
  var switchBtn = document.getElementById('summary-switch');
  if (switchBtn) {
    var scope = document.getElementById(switchBtn.getAttribute('data-scope')) || document.body;
    var labelOn = switchBtn.getAttribute('data-label-on');
    var labelOff = switchBtn.getAttribute('data-label-off');
    var labelEl = switchBtn.querySelector('.switch-label');
    var live = document.getElementById('summary-switch-status');
    switchBtn.addEventListener('click', function () {
      var on = switchBtn.getAttribute('aria-pressed') === 'true';
      var next = !on;
      switchBtn.setAttribute('aria-pressed', String(next));
      scope.setAttribute('data-summary-dim', String(next));
      if (labelEl) labelEl.textContent = next ? labelOn : labelOff;
      if (live) {
        live.textContent = next
          ? 'Showing only elements named in the council-facing summary, pages 1–4. Other material is dimmed; material incorporated by reference is outlined.'
          : 'Showing the full record.';
      }
    });
  }

  /* ------------------------------------------------------- document stack */
  var stack = document.getElementById('doc-stack');
  if (stack) {
    var readout = document.getElementById('doc-stack-readout');
    var pages = Array.prototype.slice.call(stack.querySelectorAll('.doc-page'));

    function selectPage(btn) {
      pages.forEach(function (p) { p.setAttribute('aria-pressed', String(p === btn)); });
      if (readout) {
        readout.innerHTML = '<strong>Page ' + esc(btn.getAttribute('data-page')) + '</strong> &mdash; ' +
          esc(btn.getAttribute('data-label')) +
          '<br><span class="layer-chip">' + esc(LAYERS[btn.getAttribute('data-layer')] || '') + '</span>' +
          (btn.getAttribute('data-postvote') === 'true'
            ? ' <span class="layer-chip">bears a post-vote date</span>' : '') +
          (btn.getAttribute('data-termcheck') === 'not_individually_checked'
            ? ' <span class="layer-chip">page not individually term-checked</span>' : '');
      }
    }

    stack.addEventListener('click', function (e) {
      var btn = e.target.closest('.doc-page');
      if (btn) selectPage(btn);
    });

    stack.addEventListener('keydown', function (e) {
      var i = pages.indexOf(document.activeElement);
      if (i < 0) return;
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = pages[i + 1];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = pages[i - 1];
      if (e.key === 'Home') next = pages[0];
      if (e.key === 'End') next = pages[pages.length - 1];
      if (next) { e.preventDefault(); next.focus(); selectPage(next); }
    });
  }

  /* --------------------------------------------------- chapter highlight
     Marks the chapter currently in view so the section nav reflects position.
     Purely navigational: it reveals nothing and orders nothing. */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.exhibit-nav.sections a[href^="#"]'));
  if (navLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = byId[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          navLinks.forEach(function (x) { x.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* -------------------------------------------------------- records modes */
  var modeBar = document.getElementById('record-modes');
  if (modeBar) {
    modeBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.mode-btn');
      if (!btn) return;
      var target = btn.getAttribute('data-mode');
      modeBar.querySelectorAll('.mode-btn').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      document.querySelectorAll('.mode-panel').forEach(function (p) {
        if (p.getAttribute('data-mode') === target) p.removeAttribute('hidden');
        else p.setAttribute('hidden', '');
      });
      var modeStatus = document.getElementById('record-mode-status');
      if (modeStatus) modeStatus.textContent = 'Showing the ' + btn.textContent.toLowerCase() + ' view.';
      try {
        history.replaceState(null, '', '#mode-' + target);
      } catch (err) { /* file:// or blocked history — non-fatal */ }
    });
    var hash = window.location.hash.replace('#mode-', '');
    if (hash) {
      var pre = modeBar.querySelector('.mode-btn[data-mode="' + hash + '"]');
      if (pre) pre.click();
    }
  }

  window.RDP_EXHIBIT = {
    esc: esc,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    reduceMotion: reduceMotion,
    setLastFocus: function (el) { lastFocus = el; }
  };
})();
