/* Moved from /iowa-alpr-reform/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
  // ── Two-layer tab switching ─────────────────────────
  function switchLayer(which) {
    const tabVisible    = document.getElementById('tab-visible');
    const tabHidden     = document.getElementById('tab-hidden');
    const panelVisible  = document.getElementById('panel-visible');
    const panelHidden   = document.getElementById('panel-hidden');

    if (which === 'visible') {
      tabVisible.className = 'layers-tab active-visible';
      tabHidden.className  = 'layers-tab';
      tabVisible.setAttribute('aria-selected', 'true');
      tabHidden.setAttribute('aria-selected',  'false');
      panelVisible.classList.add('active');
      panelVisible.removeAttribute('hidden');
      panelHidden.classList.remove('active');
      panelHidden.setAttribute('hidden', '');
    } else {
      tabHidden.className  = 'layers-tab active-hidden';
      tabVisible.className = 'layers-tab';
      tabHidden.setAttribute('aria-selected',  'true');
      tabVisible.setAttribute('aria-selected', 'false');
      panelHidden.classList.add('active');
      panelHidden.removeAttribute('hidden');
      panelVisible.classList.remove('active');
      panelVisible.setAttribute('hidden', '');
    }
  }

  // ── Evidence card expand/collapse ───────────────────
  function toggleCard(card) {
    const wasExpanded = card.classList.contains('expanded');
    document.querySelectorAll('.evidence-card').forEach(c => {
      c.classList.remove('expanded');
      const hdr = c.querySelector('.evidence-card-header');
      if (hdr) hdr.setAttribute('aria-expanded', 'false');
    });
    if (!wasExpanded) {
      card.classList.add('expanded');
      const hdr = card.querySelector('.evidence-card-header');
      if (hdr) hdr.setAttribute('aria-expanded', 'true');
    }
  }

  // ── Share button (Web Share API + clipboard fallback) ─
  document.getElementById('share-btn').addEventListener('click', async () => {
    const shareData = {
      title: document.title,
      text: "Iowa's ALPR \"Reform\" Bill Would Regulate Plate Readers — and Hide the Logs",
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        const btn = document.getElementById('share-btn');
        const original = btn.innerHTML;
        btn.innerHTML = '<span style="color: var(--gold-lt); letter-spacing: 0.14em;">✓ Link Copied</span>';
        setTimeout(() => { btn.innerHTML = original; }, 1800);
        return;
      }
    } catch (err) { /* fall through */ }
    window.prompt('Copy this link:', window.location.href);
  });
