/* Moved from /iowa-doge-pension-privatize/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        document.addEventListener('DOMContentLoaded', () => {

            // --- Mobile Menu Setup from Template ---
            const mobileMenuButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.getElementById('mobile-menu');
            const hamburgerIcon = document.getElementById('hamburger-icon');
            const closeIcon = document.getElementById('close-icon');
            const desktopNavLinksContainer = document.getElementById('desktop-nav-links');
            const mobileNavLinksContainer = document.getElementById('mobile-nav-links');
            const sharePageButton = document.getElementById('share-page-button');

            const desktopLinks = desktopNavLinksContainer.querySelectorAll('a');
            const existingMobileInvestigationLink = mobileNavLinksContainer.querySelector('.investigation-link');
            mobileNavLinksContainer.innerHTML = '';
            if (existingMobileInvestigationLink) {
                mobileNavLinksContainer.appendChild(existingMobileInvestigationLink);
            }
            desktopLinks.forEach(link => {
                if (!link.classList.contains('nav-link')) {
                    return;
                }
                const mobileLink = link.cloneNode(true);
                mobileLink.className = 'nav-link mobile-nav-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-amber-700 hover:bg-amber-50';
                mobileNavLinksContainer.appendChild(mobileLink);
            });

            if (sharePageButton) {
                sharePageButton.addEventListener('click', async () => {
                    const shareData = {
                        title: document.title,
                        text: 'Interactive Investigation: The Iowa Pension Proposal',
                        url: window.location.href
                    };

                    if (navigator.share) {
                        try {
                            await navigator.share(shareData);
                            return;
                        } catch (error) {
                            if (error.name === 'AbortError') {
                                return;
                            }
                        }
                    }

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(window.location.href);
                        sharePageButton.textContent = 'Link copied!';
                        setTimeout(() => {
                            sharePageButton.innerHTML = `
                                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="h-4 w-4">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 8.25a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm12 7.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-12 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-1.95-1.125 8.4-4.5m0 0 8.4 4.5" />
                                </svg>
                                Share this page
                            `;
                        }, 1800);
                    }
                });
            }

            mobileMenuButton.addEventListener('click', () => {
                const isHidden = mobileMenu.classList.toggle('hidden');
                mobileMenuButton.setAttribute('aria-expanded', String(!isHidden));
                hamburgerIcon.classList.toggle('hidden');
                closeIcon.classList.toggle('hidden');
            });
            
            // --- Navigation Logic for Active States & Scrolling ---
            const allNavLinks = document.querySelectorAll('.nav-link');
            const sections = document.querySelectorAll('main section');

            const observerOptions = { root: null, rootMargin: '0px', threshold: 0.4 };

            const sectionObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('id');
                        allNavLinks.forEach(link => {
                            link.classList.toggle('active-nav', link.getAttribute('href') === `#${id}`);
                            link.classList.toggle('inactive-nav', link.getAttribute('href') !== `#${id}`);
                        });
                        if (id === 'blueprint') {
                            animateProgressBars();
                        }
                    }
                });
            }, observerOptions);

            sections.forEach(section => sectionObserver.observe(section));

            document.querySelector('body').addEventListener('click', (e) => {
                if (e.target.matches('.nav-link')) {
                    e.preventDefault();
                    const targetId = e.target.getAttribute('href');
                    const targetSection = document.querySelector(targetId);
                    if (targetSection) {
                         targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                         window.history.pushState(null, null, targetId); // Manually update hash without jump
                    }
                    if (mobileMenu.classList.contains('hidden') === false) {
                       mobileMenuButton.click(); 
                    }
                }
            });

            // --- Chart & Interaction Logic from New Page ---
            const financialData = {
                labels: ['Total 10-Year Fee Market', "Principal's Share"],
                totalMarket: 143,
                shares: [20, 30, 45]
            };
            const compositionData = {
                labels: ['Business Sector Representatives', 'Public Sector / Employee Representatives'],
                data: [80, 0]
            };
            let financialChart, compositionChart;

            const marketShareSlider = document.getElementById('marketShareSlider');
            const principalGainEl = document.getElementById('principalGain');

            function updateFinancials(shareIndex) {
                const sharePercent = financialData.shares[shareIndex];
                const principalGain = (financialData.totalMarket * (sharePercent / 100)).toFixed(1);
                principalGainEl.textContent = `$${principalGain} Million`;
                if (financialChart) {
                    financialChart.data.datasets[0].data = [financialData.totalMarket, principalGain];
                    financialChart.update();
                }
            }

            function createFinancialsChart() {
                const ctx = document.getElementById('financialsChart').getContext('2d');
                financialChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: financialData.labels,
                        datasets: [{
                            label: 'Projected Gain (in Millions)',
                            data: [financialData.totalMarket, (financialData.totalMarket * (financialData.shares[1] / 100))],
                            backgroundColor: ['rgba(100, 116, 139, 0.6)', 'rgba(217, 119, 6, 0.6)'],
                            borderColor: ['rgb(100, 116, 139)', 'rgb(217, 119, 6)'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: (context) => `$${context.raw.toFixed(1)} Million` } }
                        },
                        scales: { x: { beginAtZero: true, title: { display: true, text: 'Amount in Millions ($)' } } }
                    }
                });
            }

            function createCompositionChart() {
                const ctx = document.getElementById('compositionChart').getContext('2d');
                compositionChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: compositionData.labels,
                        datasets: [{
                            label: 'Task Force Composition',
                            data: compositionData.data,
                            backgroundColor: ['rgba(217, 119, 6, 0.6)', 'rgba(203, 213, 225, 0.6)'],
                            borderColor: ['rgb(217, 119, 6)', 'rgb(203, 213, 225)'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw}%` } }
                        }
                    }
                });
            }
            
            marketShareSlider.addEventListener('input', (e) => {
                updateFinancials(parseInt(e.target.value));
            });

            const animateProgressBars = () => {
                const structuralBar = document.getElementById('structuralBar');
                const textualBar = document.getElementById('textualBar');
                if (structuralBar.style.width !== '51.4%') { // Animate only once
                    structuralBar.style.width = '51.4%';
                    textualBar.style.width = '4.0%';
                }
            };

            // Initial setup
            createFinancialsChart();
            createCompositionChart();
            updateFinancials(1); 
        });
