/* Moved from /dream_machine/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // Tab functionality
        document.addEventListener('DOMContentLoaded', () => {
            const tabs = document.querySelectorAll('.tab-button');
            const contents = document.querySelectorAll('.tab-content');

            function showTab(tabId) {
                contents.forEach(content => content.classList.remove('active'));
                tabs.forEach(tab => tab.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
                
                // Scroll to top of content area
                window.scrollTo({ top: 400, behavior: 'smooth' });
            }

            tabs.forEach(tab => {
                tab.addEventListener('click', () => showTab(tab.dataset.tab));
            });

            // Draw architecture lines
            drawArchitectureLines();
            window.addEventListener('resize', drawArchitectureLines);
        });

        // Architecture diagram SVG lines
        function drawArchitectureLines() {
            const svg = document.getElementById('architecture-svg');
            if (!svg) return;

            const lines = [
                // State inputs to PCER
                { x1: '20%', y1: '25%', x2: '42%', y2: '40%', color: '#3b82f6' },
                { x1: '20%', y1: '55%', x2: '42%', y2: '50%', color: '#3b82f6' },
                // PCER to federal systems
                { x1: '58%', y1: '40%', x2: '80%', y2: '20%', color: '#D4AF37' },
                { x1: '58%', y1: '50%', x2: '80%', y2: '50%', color: '#ef4444' },
                { x1: '80%', y1: '50%', x2: '80%', y2: '80%', color: '#ef4444' },
            ];

            let svgContent = '';
            lines.forEach(line => {
                svgContent += `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" 
                               stroke="${line.color}" stroke-width="2" class="data-stream" opacity="0.7"/>`;
            });

            svg.innerHTML = svgContent;
        }

        // Share functionality
        function shareExhibit() {
            if (navigator.share) {
                navigator.share({
                    title: 'The Dream Machine - RDP Investigation',
                    text: 'Interactive forensics on how DOGE built a national voter surveillance system before Congress voted.',
                    url: window.location.href
                }).catch(console.error);
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(window.location.href).then(() => {
                    alert('Link copied to clipboard!');
                }).catch(console.error);
            }
        }
