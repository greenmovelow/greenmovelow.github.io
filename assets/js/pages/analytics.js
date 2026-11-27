/* Moved from /analytics/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
    async function shareThisPage() {
      const shareData = { title: document.title, url: window.location.href };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(window.location.href);
          return;
        } catch (error) {}
      }

      window.prompt('Copy this link:', window.location.href);
    }

    const nav = document.querySelector('.nav-bar');
    window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });
    const toggle = document.getElementById('mobile-toggle');
    const menu = document.getElementById('mobile-menu');
    function setMobileMenuOpen(open) {
      menu.classList.toggle('open', open);
      menu.inert = !open;
      menu.setAttribute('aria-hidden', String(!open));
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.addEventListener('click', () => setMobileMenuOpen(!menu.classList.contains('open')));
    menu.querySelectorAll('a, button').forEach(item => item.addEventListener('click', () => setMobileMenuOpen(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        setMobileMenuOpen(false);
        toggle.focus();
      }
    });
