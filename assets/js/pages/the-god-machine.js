/* Moved from /the-god-machine/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // --- Modal Data and Functions ---
        const modalData = {
            1: { title: '1. The Bill Mill (NACL)', content: 'The National Association of Christian Lawmakers (NACL) drafts and promotes "model legislation" to friendly lawmakers across states. These bills create the legal framework for chaplains in public schools, manufacturing the demand for their services.' },
            2: { title: '2. The Mobilizer (Faith Wins)', content: 'Faith Wins organizes and trains "grassroots" pressure campaigns. They mobilize paid clergy and volunteers to lobby legislators and create the illusion of widespread public demand for the chaplain bills, influencing policy enactment.' },
            3: { title: '3. The Credentialer (Mission Generation/NSCA)', content: 'Mission Generation, operating as the National School Chaplain Association (NSCA), sells the exclusive "certified" chaplain credential. This positions them as the sole provider for the roles created by the NACL-pushed laws, establishing a monopoly.' },
            4: { title: '4. The Money (Anonymous Donors)', content: 'Anonymous donors channel untraceable grants through Donor-Advised Funds (DAFs) to Mission Generation and potentially other network entities. This opaque funding ensures secrecy and continuity for the entire "God Machine" operation, shielding benefactors from public scrutiny.' }
        };

        const modalContainer = document.getElementById('modal-container');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const closeModalBtn = document.getElementById('close-modal');

        function showModal(step) {
            const data = modalData[step];
            if (data) {
                modalTitle.textContent = data.title;
                modalBody.textContent = data.content;
                modalContainer.classList.add('visible');
            }
        }

        function hideModal() {
            modalContainer.classList.remove('visible');
        }

        closeModalBtn.addEventListener('click', hideModal);
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                hideModal();
            }
        });

        // --- Tab Navigation ---
        function showTab(tabName) {
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
                if (button.getAttribute('data-action-args') === JSON.stringify([tabName])) {
                    button.classList.add('active');
                }
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                if (content.id === tabName) {
                    content.classList.add('active');
                }
            });
            // Reset component highlights when switching tabs
            document.querySelectorAll('.component-card').forEach(card => {
                card.classList.remove('active-component');
            });
        }

        // --- Component Card Highlighting for "Network" Tab and Modal ---
        function highlightAndShowComponent(componentId, modalStep) {
            document.querySelectorAll('.component-card').forEach(card => {
                card.classList.remove('active-component');
            });
            const activeCard = document.querySelector(`.component-card[data-component-id="${componentId}"]`);
            if (activeCard) {
                activeCard.classList.add('active-component');
                activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            showModal(modalStep);
        }

        // --- Chart.js ---
        const ctx = document.getElementById('credentialsChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['NSCA Chaplain', 'Licensed Counselor'],
                datasets: [{
                    label: 'Required Training (Hours)',
                    data: [40, 3000],
                    backgroundColor: [
                        'rgba(0, 43, 75, 0.7)',
                        'rgba(184, 134, 11, 0.7)'
                    ],
                    borderColor: [
                        '#002B4B',
                        '#B8860B'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#333333', font: { family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" } },
                        grid: { color: '#BBBBBB' }
                    },
                    y: {
                        ticks: { color: '#333333', font: { size: 14, family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        bodyFont: { family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" },
                        callbacks: {
                            label: (context) => context.raw === 40 ? ' 40-hour online course' : ' 3,000+ supervised clinical hours + Master\'s Degree'
                        }
                    }
                }
            }
        });

        // -- SHARE BUTTON SCRIPT ADDED HERE --
        const shareButton = document.getElementById('share-button');
        if (shareButton) {
            shareButton.addEventListener('click', async () => {
                const shareData = {
                    title: 'The God Machine: An RDP Investigation',
                    text: 'How a Tax-Exempt ‘Ministry’ Built a Business Selling Chaplains to Public Schools. An exclusive investigation by Restoring Democracy\'s Promise.',
                    url: window.location.href
                };
                try {
                    if (navigator.share) {
                        await navigator.share(shareData);
                    } else {
                        // Fallback for desktop browsers that don't support Web Share API
                        navigator.clipboard.writeText(window.location.href).then(() => {
                            alert('Link to investigation copied to clipboard!');
                        });
                    }
                } catch (err) {
                    console.error("Share failed:", err);
                    // Fallback in case of an error during share
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        alert('Link to investigation copied to clipboard!');
                    });
                }
            });
        }
        
        // Initialize active tab on load, and potentially component highlight
        document.addEventListener('DOMContentLoaded', () => {
            const hash = window.location.hash.substring(1);
            if (hash && document.getElementById(hash)) {
                showTab(hash);
            } else {
                showTab('summary');
            }
        });
