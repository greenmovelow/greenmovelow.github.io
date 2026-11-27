/* Moved from /pincer-infographic/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        const wrapLabel = (label, maxLength = 16) => {
            const words = label.split(' ');
            let lines = [];
            let currentLine = '';
            words.forEach(word => {
                if ((currentLine + ' ' + word).trim().length > maxLength) {
                    lines.push(currentLine.trim());
                    currentLine = word;
                } else {
                    currentLine = (currentLine + ' ' + word).trim();
                }
            });
            if (currentLine) {
                lines.push(currentLine.trim());
            }
            return lines;
        };
        
        const tooltipTitleCallback = (tooltipItems) => {
            const item = tooltipItems[0];
            let label = item.chart.data.labels[item.dataIndex];
            if (Array.isArray(label)) {
              return label.join(' ');
            } else {
              return label;
            }
        };

        const defaultPlugins = {
            legend: {
                labels: {
                    color: '#E0E1DD',
                    font: {
                        family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    }
                }
            },
            tooltip: {
                callbacks: {
                    title: tooltipTitleCallback
                },
                titleFont: {
                    family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                },
                bodyFont: {
                     family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }
            }
        };

        const defaultScales = {
             x: {
                ticks: { color: '#778DA9', font: { family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } },
                grid: { color: 'rgba(119, 141, 169, 0.2)' }
            },
            y: {
                ticks: { color: '#778DA9', font: { family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } },
                grid: { color: 'rgba(119, 141, 169, 0.2)' }
            }
        };
        
        const cabinetTiesCtx = document.getElementById('cabinetTiesChart');
        if (cabinetTiesCtx) {
            new Chart(cabinetTiesCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Tied to Project 2025 Groups', 'Not Tied'],
                    datasets: [{
                        label: '% of Cabinet',
                        data: [70, 30],
                        backgroundColor: [
                            '#00B4D8',
                            '#415A77'
                        ],
                        borderColor: '#1B263B',
                        borderWidth: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                         legend: {
                            position: 'bottom',
                            labels: {
                                color: '#E0E1DD',
                                font: {
                                    family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                                    size: 14
                                }
                            }
                        },
                        tooltip: defaultPlugins.tooltip
                    }
                }
            });
        }
        
        const cnAdherenceCtx = document.getElementById('cnAdherenceChart');
        if (cnAdherenceCtx) {
            new Chart(cnAdherenceCtx, {
                type: 'bar',
                data: {
                    labels: ['Republicans', 'All Americans'],
                    datasets: [{
                        label: 'Adherents',
                        data: [20, 10],
                        backgroundColor: '#00B4D8',
                    }, {
                        label: 'Sympathizers',
                        data: [33, 20],
                        backgroundColor: '#48CAE4',
                    }, {
                        label: 'Skeptics/Opponents',
                        data: [47, 70],
                        backgroundColor: '#415A77',
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: defaultPlugins,
                    scales: {
                        x: { stacked: true, ticks: { color: '#778DA9', font: { family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } }, grid: { display: false } },
                        y: { stacked: true, ticks: { color: '#778DA9', callback: value => value + '%', font: { family: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } }, grid: { color: 'rgba(119, 141, 169, 0.2)' } }
                    }
                }
            });
        }

        // Section fade-in observer
        const sections = document.querySelectorAll('.content-section');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        sections.forEach(section => {
            observer.observe(section);
        });
