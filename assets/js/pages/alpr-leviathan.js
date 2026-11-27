/* Moved from /alpr-leviathan/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        document.addEventListener('DOMContentLoaded', () => {
            // All original JS from Leviathan page for interactivity
            const navLinks = document.querySelectorAll('#main-nav a');
            const sections = document.querySelectorAll('.content-section');
            const pipelineSteps = document.querySelectorAll('.pipeline-step');
            const pipelineDetails = document.querySelectorAll('.pipeline-details');
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');

            const navigateTo = (hash) => {
                const targetId = hash.substring(1);
                sections.forEach(s => s.classList.toggle('active', s.id === targetId));
                navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === hash));
            };

            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const hash = e.currentTarget.getAttribute('href');
                    navigateTo(hash);
                    window.history.pushState(null, null, hash);
                });
            });

            if (window.location.hash) { navigateTo(window.location.hash); } else { navigateTo('#overview'); }

            pipelineSteps.forEach(step => {
                step.addEventListener('click', () => {
                    const stepNum = step.id.split('-')[1];
                    pipelineSteps.forEach(s => s.classList.remove('active'));
                    step.classList.add('active');
                    pipelineDetails.forEach(detail => {
                        detail.classList.toggle('hidden', detail.id.split('-')[1] !== stepNum);
                    });
                });
            });

            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const tabId = button.dataset.tab;
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    tabContents.forEach(content => {
                        content.classList.toggle('hidden', content.id !== tabId);
                    });
                });
            });

            const createScaleChart = () => {
                const ctx = document.getElementById('scaleChart')?.getContext('2d');
                if (!ctx) return;
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ["Flock Safety (Scans/Month)", "Motorola/Vigilant (Total Records)"],
                        datasets: [{
                            label: 'Billions of Records',
                            data: [20, 5],
                            backgroundColor: ['rgba(0, 43, 75, 0.7)', 'rgba(184, 134, 11, 0.7)'],
                            borderColor: ['#002B4B', '#B8860B'],
                            borderWidth: 2,
                            borderRadius: 4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        scales: {
                            x: {
                                beginAtZero: true,
                                title: { display: true, text: 'Billions', color: '#333' },
                                grid: { color: '#BBBBBB' },
                                ticks: { color: '#333', font: { family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" } }
                            },
                            y: {
                                grid: { display: false },
                                ticks: { color: '#333', font: { size: 14, family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" } }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                bodyFont: { family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" },
                                callbacks: { label: (c) => ` ${c.parsed.x} Billion` }
                            }
                        }
                    }
                });
            };
            createScaleChart();

            const shareButton = document.getElementById('share-button');
            if (shareButton) {
                shareButton.addEventListener('click', async () => {
                    const shareData = {
                        title: 'The Surveillance Leviathan: An RDP Investigation',
                        text: 'A deep dive into the Palantir-ALPR pipeline. An exclusive investigation by Restoring Democracy\'s Promise.',
                        url: window.location.href
                    };
                    try {
                        if (navigator.share) {
                            await navigator.share(shareData);
                        } else {
                            navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied to clipboard!'));
                        }
                    } catch (err) {
                        console.error("Share failed:", err);
                        navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied to clipboard!'));
                    }
                });
            }
        });
