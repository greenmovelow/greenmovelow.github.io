/* Moved from /funding_flow/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // ===== Concentric Circle Interactivity =====
        document.querySelectorAll('.contract-circle').forEach(circle => {
            circle.addEventListener('click', function() {
                const contract = this.dataset.contract;

                // Remove active from all circles
                document.querySelectorAll('.contract-circle').forEach(c => c.classList.remove('active'));
                this.classList.add('active');

                // Hide all detail panels
                document.querySelectorAll('#detail-panel > div').forEach(d => d.classList.add('hidden'));

                // Show selected detail
                const panel = document.getElementById('detail-' + contract);
                if (panel) panel.classList.remove('hidden');
            });
        });

        // Reset on clicking outside a contract circle
        document.getElementById('concentric-svg').addEventListener('click', function(e) {
            if (!e.target.classList.contains('contract-circle')) {
                document.querySelectorAll('.contract-circle').forEach(c => c.classList.remove('active'));
                document.querySelectorAll('#detail-panel > div').forEach(d => d.classList.add('hidden'));
                document.getElementById('detail-default').classList.remove('hidden');
            }
        });

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
                title: 'Who Funds the Identity Backbone? — RDP Investigation',
                text: 'The $30M Palantir dashboard sits on top of a $279M IBM engine. Total contract mass: $4.89B+. Interactive exhibit.',
                url: window.location.href
            };
            if (navigator.share) {
                navigator.share(shareData).catch(console.error);
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    const btn = document.querySelector('[data-action="shareExhibit"]');
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-check text-lg text-money-green"></i>';
                        setTimeout(() => { btn.innerHTML = '<i class="fas fa-share-alt text-lg"></i>'; }, 2000);
                    }
                });
            }
        }
