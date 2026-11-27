/* Moved from /pincer-financial/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        document.addEventListener('DOMContentLoaded', () => {
            const sections = document.querySelectorAll('.content-section');
            
            // --- Mobile Menu Setup ---
            const mobileMenuButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.getElementById('mobile-menu');
            const hamburgerIcon = document.getElementById('hamburger-icon');
            const closeIcon = document.getElementById('close-icon');
            const desktopNavLinksContainer = document.getElementById('desktop-nav-links');
            const mobileNavLinksContainer = document.getElementById('mobile-nav-links');

            // Clone desktop links to mobile menu for consistency
            const desktopLinks = desktopNavLinksContainer.querySelectorAll('a');
            mobileNavLinksContainer.innerHTML = ''; // Clear container
            desktopLinks.forEach(link => {
                const mobileLink = link.cloneNode(true);
                mobileLink.className = 'nav-link mobile-nav-link block px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100';
                mobileNavLinksContainer.appendChild(mobileLink);
            });

            // Toggle mobile menu visibility
            mobileMenuButton.addEventListener('click', () => {
                const isHidden = mobileMenu.classList.toggle('hidden');
                mobileMenuButton.setAttribute('aria-expanded', String(!isHidden));
                hamburgerIcon.classList.toggle('hidden');
                closeIcon.classList.toggle('hidden');
            });
            
            // --- Main Navigation Logic ---
            function handleNavigation() {
                const hash = window.location.hash || '#summary';
                sections.forEach(section => {
                    section.classList.toggle('active', '#' + section.id === hash);
                });
                
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.toggle('active-nav', link.getAttribute('href') === hash);
                    link.classList.toggle('inactive-nav', link.getAttribute('href') !== hash);
                });

                if (hash === '#key-players') renderMftChart();
                if (hash === '#timeline') initTimeline();
            }
            
            // Handle clicks on ALL nav links (desktop and mobile)
            document.querySelector('body').addEventListener('click', (e) => {
                if (e.target.matches('.nav-link')) {
                    e.preventDefault();
                    window.location.hash = e.target.getAttribute('href');
                    if (mobileMenu.classList.contains('hidden') === false) {
                       mobileMenuButton.click(); // Close mobile menu if open
                    }
                }
            });
            
            window.addEventListener('hashchange', handleNavigation);
            handleNavigation(); // Initial call

            // --- Section-Specific Logic ---

            // Money Trail Section Logic
            const detailsPane = {
                title: document.getElementById('details-title'),
                content: document.getElementById('details-content')
            };
            const flowNodes = {
                mft: document.getElementById('node-mft'),
                daf: document.getElementById('node-daf'),
                '85f': document.getElementById('node-85f'),
            };
            const paneData = {
                mft: { title: 'Marble Freedom Trust (MFT)', content: 'The source of the funds. A 501(c)(4) trust endowed with a $1.6B contribution. Its primary purpose is to make large grants to other entities in the network. It provides the capital and the political direction.' },
                daf: { title: 'DAF Conduits (Schwab Charitable & DonorsTrust)', content: 'The intermediaries. Major Donor-Advised Fund sponsors that act as passive conduits, accepting funds from MFT and, upon "advice," granting them to other charities, thereby obscuring the original source and providing regulatory cover.' },
                '85f': { title: 'The 85 Fund', content: 'The destination hub. A 501(c)(3) organization that receives the anonymized funds from the DAFs. It then distributes this money to operational groups and pays millions in consulting fees to Leonard Leo\'s for-profit firm.' }
            };
            function updateDetails(key) {
                if (!paneData[key]) return;
                detailsPane.title.textContent = paneData[key].title;
                detailsPane.content.innerHTML = `<p>${paneData[key].content}</p>`;
                Object.values(flowNodes).forEach(node => node.classList.remove('active-node'));
                if (flowNodes[key]) flowNodes[key].classList.add('active-node');
            }
            Object.entries(flowNodes).forEach(([key, node]) => {
                node.addEventListener('click', () => updateDetails(key));
            });
            updateDetails('mft');

            // DAF Mechanism Logic
            let dafStep = 1;
            const dafNextBtn = document.getElementById('daf-next-btn');
            const dafSteps = [document.getElementById('daf-step-1'), document.getElementById('daf-step-2'), document.getElementById('daf-step-3')];
            function updateDafSteps() {
                dafSteps.forEach((step, index) => {
                    const isActive = index < dafStep;
                    step.style.opacity = isActive ? '1' : '0.5';
                    step.classList.toggle('border-blue-700', isActive);
                    step.classList.toggle('border-slate-200', !isActive);
                });
                dafNextBtn.textContent = dafStep > 2 ? "Reset" : "Next Step";
            }
            updateDafSteps();
            dafNextBtn.addEventListener('click', () => {
                dafStep = (dafStep % 3) + 1;
                updateDafSteps();
            });

            // MFT Chart Logic
            let mftChartInstance = null;
            function renderMftChart() {
                if (mftChartInstance) return;
                const ctx = document.getElementById('mftGrantsChart').getContext('2d');
                mftChartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['FY22-23 (Schwab)', 'FY24 (Schwab)', 'FY24 (DonorsTrust)'],
                        datasets: [{
                            label: 'Grants to DAFs ($M)',
                            data: [307.5, 59.1, 59.1],
                            backgroundColor: 'rgba(29, 78, 216, 0.7)',
                            borderColor: 'rgba(29, 78, 216, 1)',
                            borderWidth: 2,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            title: { display: true, text: 'Marble Freedom Trust Grants to DAF Intermediaries', font: { size: 16 }, color: '#334155', padding: { bottom: 20 } },
                            tooltip: { callbacks: { label: context => ` $${context.parsed.y} Million` } }
                        },
                        scales: { y: { beginAtZero: true, title: { display: true, text: 'Grant Amount (in Millions USD)' } } }
                    }
                });
            }

            // Interactive Timeline Logic
            let timelineInitialized = false;
            function initTimeline() {
                if (timelineInitialized) return;
                
                const container = document.getElementById('timeline-container');
                const nodes = {
                    mft: document.getElementById('tn-mft'),
                    schwab: document.getElementById('tn-schwab'),
                    donors: document.getElementById('tn-donors'),
                    '85f': document.getElementById('tn-85f'),
                };
                const flows = {
                    mft_schwab: { el: document.getElementById('flow-mft-schwab'), label: document.getElementById('label-mft-schwab') },
                    mft_donors: { el: document.getElementById('flow-mft-donors'), label: document.getElementById('label-mft-donors') },
                    schwab_85f: { el: document.getElementById('flow-schwab-85f'), label: document.getElementById('label-schwab-85f') },
                    donors_85f: { el: document.getElementById('flow-donors-85f'), label: document.getElementById('label-donors-85f') },
                };
                const btn2223 = document.getElementById('btn-fy22-23');
                const btn24 = document.getElementById('btn-fy24');

                function getCoords(el) {
                    const containerRect = container.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    return {
                        x: elRect.left - containerRect.left + elRect.width / 2,
                        bottom: elRect.bottom - containerRect.top,
                        top: elRect.top - containerRect.top,
                    }
                }

                function drawLine(fromEl, toEl, flowData) {
                    const from = getCoords(fromEl);
                    const to = getCoords(toEl);
                    const x1 = from.x, y1 = from.bottom, x2 = to.x, y2 = to.top;

                    const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
                    const angle = Math.atan2(y2-y1, x2-x1) * 180 / Math.PI;
                    
                    flowData.el.style.width = `${length}px`;
                    flowData.el.style.top = `${y1}px`;
                    flowData.el.style.left = `${x1}px`;
                    flowData.el.style.transform = `rotate(${angle}deg)`;
                    flowData.el.style.transformOrigin = '0 0';
                    flowData.el.style.height = '4px';

                    flowData.label.style.top = `${y1 + (y2-y1)/2 - 15}px`;
                    flowData.label.style.left = `${x1 + (x2-x1)/2 - 30}px`;
                }

                function updateAllFlowLines() {
                    drawLine(nodes.mft, nodes.schwab, flows.mft_schwab);
                    drawLine(nodes.mft, nodes.donors, flows.mft_donors);
                    drawLine(nodes.schwab, nodes['85f'], flows.schwab_85f);
                    drawLine(nodes.donors, nodes['85f'], flows.donors_85f);
                }
                
                function setTimeline(phase) {
                    btn2223.classList.toggle('active', phase === '22-23');
                    btn24.classList.toggle('active', phase === '24');

                    const is2223 = phase === '22-23';
                    const is24 = phase === '24';
                    
                    flows.mft_schwab.el.classList.toggle('visible', is2223 || is24);
                    flows.mft_schwab.label.classList.toggle('visible', is2223 || is24);
                    flows.mft_schwab.label.textContent = is2223 ? '$307.5M' : '$59.1M';
                    
                    flows.schwab_85f.el.classList.toggle('visible', is2223 || is24);
                    flows.schwab_85f.label.classList.toggle('visible', is2223 || is24);
                    flows.schwab_85f.label.textContent = is2223 ? '$282M' : '$59.1M';

                    flows.mft_donors.el.classList.toggle('visible', is24);
                    flows.mft_donors.label.classList.toggle('visible', is24);
                    flows.mft_donors.label.textContent = '$59.1M';

                    flows.donors_85f.el.classList.toggle('visible', is24);
                    flows.donors_85f.label.classList.toggle('visible', is24);
                    flows.donors_85f.label.textContent = '$59.1M';
                }

                btn2223.addEventListener('click', () => setTimeline('22-23'));
                btn24.addEventListener('click', () => setTimeline('24'));
                
                const resizeObserver = new ResizeObserver(updateAllFlowLines);
                resizeObserver.observe(container);

                updateAllFlowLines();
                setTimeline('22-23');
                timelineInitialized = true;
            }
        });
