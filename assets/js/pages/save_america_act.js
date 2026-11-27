/* Moved from /save_america_act/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // Tab functionality
        document.addEventListener('DOMContentLoaded', () => {
            const tabs = document.querySelectorAll('.tab-button');
            const contents = document.querySelectorAll('.tab-content');

            function showTab(tabId) {
                contents.forEach(content => content.classList.remove('active'));
                tabs.forEach(tab => tab.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
                window.scrollTo({ top: 400, behavior: 'smooth' });
                // Re-trigger reveal animations for newly visible tab
                setTimeout(() => {
                    document.querySelectorAll(`#${tabId} .reveal`).forEach(el => {
                        observer.observe(el);
                    });
                }, 100);
            }

            tabs.forEach(tab => {
                tab.addEventListener('click', () => showTab(tab.dataset.tab));
            });

            // Intersection Observer for reveal animations
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, { threshold: 0.08 });

            document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
        });

        // Share functionality
        function shareExhibit() {
            if (navigator.share) {
                navigator.share({
                    title: 'The Identity Backbone — SAVE America Act | RDP',
                    text: 'The SAVE America Act doesn\'t create a new system. It codifies the one already running. An interactive explainer on the bill\'s data architecture.',
                    url: window.location.href
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    const btn = document.querySelector('[title="Share"]');
                    const icon = btn.querySelector('i');
                    icon.classList.remove('fa-share-alt');
                    icon.classList.add('fa-check');
                    setTimeout(() => {
                        icon.classList.remove('fa-check');
                        icon.classList.add('fa-share-alt');
                    }, 2000);
                });
            }
        }
