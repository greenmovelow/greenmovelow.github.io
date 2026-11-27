/* Moved from /assembly-line/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // --- Modal Data and Functions ---
        const modalData = {
            1: { title: 'Step 1: Model Legislation', content: 'National think tanks and legal groups like the Heritage Foundation and Alliance Defending Freedom draft "model" bills. These texts come complete with legal justifications and talking points, forming the ideological core of the legislation.' },
            2: { title: 'Step 2: Legislative Sponsor', content: 'The model bills are distributed to allied state lawmakers. This process outsources the work of governance to a private, unaccountable network, ensuring ideological consistency across states.' },
            3: { title: 'Step 3: Faith Mobilization', content: 'Groups like Faith Wins and state-level partners like The Family Leader orchestrate "grassroots" campaigns. They provide scripts, testimony templates, and rally supporters to create the illusion of widespread, organic demand for the legislation.' },
            4: { title: 'Step 4: Policy Enactment', content: 'Under pressure from the manufactured outrage and lobbying from network operatives, the legislation is fast-tracked. Opposition is often neutralized through targeted pressure campaigns or primary challenges.' }
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
                button.classList.toggle('active', button.getAttribute('data-action-args') === JSON.stringify([tabName]));
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === tabName);
            });
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
                    backgroundColor: ['rgba(74, 85, 104, 0.7)', 'rgba(229, 62, 62, 0.7)'],
                    borderColor: ['#4A5568', '#E53E3E'],
                    borderWidth: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false, // Key fix for responsiveness
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#A0A0A0', font: { family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" } },
                        grid: { color: '#333' }
                    },
                    y: {
                       ticks: { color: '#E0E0E0', font: { size: 14, family: "'Lora', Georgia, Cambria, 'Times New Roman', serif" } },
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
