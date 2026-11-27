/* Moved from /ipers-wiggins/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
  /* Nav scroll */
  const nav = document.querySelector('.nav-bar');
  window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });

  /* Mobile menu */
  const toggle = document.getElementById('mobile-toggle'), menu = document.getElementById('mobile-menu');
  toggle.addEventListener('click', () => { const o = menu.classList.toggle('open'); toggle.setAttribute('aria-expanded', o); });
  menu.querySelectorAll('a').forEach(l => { l.addEventListener('click', () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); }); });

  /* Scroll fade */
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

  /* Copy link */
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const lbl = document.getElementById('copy-label');
      lbl.textContent = 'Copied!';
      setTimeout(() => { lbl.textContent = 'Copy Link'; }, 2000);
    } catch(e) { window.prompt('Copy this link:', window.location.href); }
  }

  /* Share */
  async function shareThisPage() {
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url: window.location.href }); return; }
      catch(e) { if (e.name === 'AbortError') return; }
    }
    copyLink();
  }
