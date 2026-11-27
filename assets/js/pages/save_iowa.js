/* Moved from /save_iowa/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
    function toggleNode(name) {
      const panel = document.getElementById('detail-' + name);
      const card = document.querySelector(`[data-node="${name}"]`);
      const isOpen = panel.classList.contains('open');
      document.querySelectorAll('.expand-panel').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.node-card').forEach(c => c.classList.remove('active'));
      if (!isOpen) { panel.classList.add('open'); card.classList.add('active'); }
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Mobile nav active state
    const secIds = ['pipeline','choreography','trick','data-taken','series'];
    const mobLinks = document.querySelectorAll('.mob-link');
    const secObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const id = e.target.id;
          mobLinks.forEach(a => {
            const match = a.getAttribute('data-section') === id;
            a.classList.toggle('text-parchment', match);
            a.classList.toggle('text-text-dim', !match);
          });
        }
      });
    }, { threshold: 0.3 });
    secIds.forEach(id => { const el = document.getElementById(id); if (el) secObs.observe(el); });

    function shareExhibit() {
      const d = { title: "SAVE: The Database They Won't Name", text: "Iowa treated driver’s licenses as a “public benefit” to route licensed Iowans through a federal immigration database. Twenty-year contract. No public vote.", url: location.href };
      if (navigator.share) navigator.share(d).catch(()=>{});
      else navigator.clipboard.writeText(location.href).then(() => alert('Link copied!'));
    }
