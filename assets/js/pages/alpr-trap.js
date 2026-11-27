/* Moved from /alpr-trap/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
    // ===== Tier Toggle =====
    function toggleTier(tierName) {
      const panel = document.getElementById('detail-' + tierName);
      const card = document.querySelector(`[data-tier="${tierName}"]`);
      const isOpen = panel.classList.contains('open');

      // Close all panels
      document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('active'));

      // If it wasn't open, open it
      if (!isOpen) {
        panel.classList.add('open');
        card.classList.add('active');
      }
    }

    // ===== Scroll Reveal =====
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // ===== Share =====
    function shareExhibit() {
      const shareData = {
        title: 'The ALPR Trap — RDP Investigation',
        text: '20 billion plate reads per month. 49 states. No warrant. Interactive exhibit mapping the 4-tier architecture.',
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(console.error);
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          const btn = document.querySelector('[data-action="shareExhibit"]');
          if (btn) {
            btn.innerHTML = '<svg class="w-5 h-5 text-grid-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
            setTimeout(() => {
              btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>';
            }, 2000);
          }
        });
      }
    }
