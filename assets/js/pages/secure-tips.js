/* Moved from /secure-tips/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
    async function shareThisPage() {
      const d = { title: document.title, url: window.location.href };
      if (navigator.share) {
        try { await navigator.share(d); return; } catch(e) { if(e.name==='AbortError') return; }
      }
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(window.location.href); return; } catch(e) {}
      }
      window.prompt('Copy this link:', window.location.href);
    }

    const nav = document.querySelector('.nav-bar');
    window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });

    const toggle = document.getElementById('mobile-toggle');
    const menu   = document.getElementById('mobile-menu');
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    let n = 0, t;
    document.getElementById('main-logo').addEventListener('click', e => {
      e.preventDefault(); n++;
      clearTimeout(t); t = setTimeout(() => { n = 0; }, 1000);
      if (n === 5) window.location.href = 'vault.html';
    });
