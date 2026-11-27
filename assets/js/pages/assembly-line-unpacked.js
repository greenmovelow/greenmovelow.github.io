/* Moved from /assembly-line-unpacked/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // Chart.js data and configuration

        const keyPhraseData = {

            labels: ['chaplain', 'credential', 'license', 'school district', 'volunteer', 'termination', 'student', 'support', 'services', 'programs', 'compensation'],

            datasets: [{

                label: 'RDP Analysis',

                backgroundColor: '#D4AF37', // brand-gold

                borderColor: '#D4AF37',

                borderWidth: 1,

                data: [29, 4, 4, 1, 5, 1, 1, 1, 1, 0, 0]

            }, {

                label: 'HF884 Bill',

                backgroundColor: '#00B4D8', // accent-blue

                borderColor: '#00B4D8',

                borderWidth: 1,

                data: [0, 0, 0, 0, 0, 1, 0, 9, 5, 1, 15]

            }]

        };

        const structuralElementsData = {

            labels: ['RDP Analysis', 'HF884 Bill'],

            datasets: [{

                label: 'Sections',

                backgroundColor: '#D4AF37',

                borderColor: '#D4AF37',

                borderWidth: 1,

                data: [6, 7]

            }, {

                label: 'Enumerated Items',

                backgroundColor: '#00B4D8',

                borderColor: '#00B4D8',

                borderWidth: 1,

                data: [25, 73]

            }]

        };

        const chartOptions = {

            responsive: true,

            maintainAspectRatio: false,

            scales: {

                x: { grid: { color: '#415A77' }, ticks: { color: '#E0E1DD' } },

                y: { beginAtZero: true, grid: { color: '#415A77' }, ticks: { color: '#E0E1DD' } }

            },

            plugins: { legend: { labels: { color: '#E0E1DD' } } }

        };

        let keyPhraseChartInstance = null;

        let structuralElementsChartInstance = null;

        function destroyChart(chartInstance) {

            if (chartInstance) chartInstance.destroy();

            return null;

        }

        function initializeChart(chartId, data, options) {

            const ctx = document.getElementById(chartId);

            if (ctx) {

                const existingChart = Chart.getChart(chartId);

                if (existingChart) existingChart.destroy();

                return new Chart(ctx, { type: 'bar', data, options });

            }

            return null;

        }

        document.addEventListener('DOMContentLoaded', () => {

            const tabs = document.querySelectorAll('.tab-button');

            const contents = document.querySelectorAll('.tab-content');

            function showTab(tabId) {

                contents.forEach(content => content.classList.remove('active'));

                tabs.forEach(tab => tab.classList.remove('active'));

                document.getElementById(tabId).classList.add('active');

                document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');

                keyPhraseChartInstance = destroyChart(keyPhraseChartInstance);

                structuralElementsChartInstance = destroyChart(structuralElementsChartInstance);

                if (tabId === 'key-phrase') keyPhraseChartInstance = initializeChart('keyPhraseChart', keyPhraseData, chartOptions);

                else if (tabId === 'structural-elements') structuralElementsChartInstance = initializeChart('structuralElementsChart', structuralElementsData, chartOptions);

            }

            tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));

            showTab('key-phrase');

        });
