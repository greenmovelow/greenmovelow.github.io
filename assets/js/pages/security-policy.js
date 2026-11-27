/* Moved from /security-policy/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
    const nav = document.querySelector('.nav-bar');
    window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 20); }, { passive: true });
    const toggle = document.getElementById('mobile-toggle');
    const menu = document.getElementById('mobile-menu');
    toggle.addEventListener('click', () => { const open = menu.classList.toggle('open'); toggle.setAttribute('aria-expanded', open); });
    menu.querySelectorAll('a').forEach(link => { link.addEventListener('click', () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }); });
    const ro = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach(el => ro.observe(el));
    const btt = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => { btt.classList.toggle('show', window.scrollY > 600); }, { passive: true });
    btt.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const shareButton = document.getElementById('share-policy');
    const shareStatus = document.getElementById('share-status');
    if (shareButton && shareStatus) {
      shareButton.addEventListener('click', async () => {
        const shareData = { title: document.title, text: "Security & Vulnerability Disclosure Policy — Restoring Democracy's Promise", url: window.location.href };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
            shareStatus.textContent = 'Shared successfully.';
            return;
          }
          await navigator.clipboard.writeText(window.location.href);
          shareStatus.textContent = 'Link copied to clipboard.';
        } catch (error) {
          shareStatus.textContent = 'Unable to share right now. You can copy the URL from your browser bar.';
        }
      });
    }
    let clickCount = 0, timer;
    document.getElementById('main-logo').addEventListener('click', function(e) {
      e.preventDefault(); clickCount++; clearTimeout(timer);
      timer = setTimeout(() => { clickCount = 0; }, 1000);
      if (clickCount === 5) window.location.href = '/vault.html';
    });
