/* Moved from /pincer-dataviz/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        document.addEventListener('DOMContentLoaded', function () {
            // --- START: Data Definitions ---
            const modalData = {
                'node-leo': { title: 'Leonard Leo: The Architect', content: '<p>A key conservative legal strategist. Chairs the Marble Freedom Trust and is a central figure in The 85 Fund and the Federalist Society. Orchestrates funding and judicial strategy for the conservative movement.</p>' },
                'node-vought': { title: 'Russell Vought: The Bureaucrat', content: '<p>Former OMB Director and a lead author of Project 2025. A self-described "Christian Nation-ist" who advocates for dismantling the administrative state and using government power to enforce ideological goals.</p>' },
                'node-vanderplaats': { title: 'Bob Vander Plaats: The Mobilizer', content: '<p>President & CEO of The Family Leader, an influential Christian Nationalist group in Iowa. Expert at grassroots mobilization and translating theological goals into state-level policy and political pressure.</p>' },
                'node-heritage': { title: 'Project 2025 (The Heritage Foundation)', content: '<p>A 920-page blueprint for a radical overhaul of the federal government. Its "Mandate for Leadership" details plans for purging the civil service (Schedule F) and politicizing the Department of Justice.</p>' },
                'node-tfl': { title: 'The Family Leader', content: '<p>A Christian Nationalist organization that seeks to embed "biblical values" into government. Instrumental in passing legislation like SF 418 in Iowa and mobilizing a conservative religious voting bloc.</p><p class="mt-4 border-t border-gray-600 pt-4"><b>Financial Link:</b> Recipient of $200,000 from Ziklag, a Christian Nationalist high-dollar donor network exposed by ProPublica.</p>' },
                'node-seid': { title: 'Barre Seid: The Megadonor', content: '<p>Donated his $1.6 billion electronics company, Tripp Lite, to the Marble Freedom Trust in 2021. This transaction is likely the largest single political donation in U.S. history, creating a massive financial engine for the conservative movement.</p>'},
                'node-mft': { title: 'Marble Freedom Trust', content: '<p>Chaired by Leonard Leo, this 501(c)(4) trust received the $1.6B contribution from Barre Seid. It acts as a central financial hub, granting over $447M to Schwab Charitable and over $41M to DonorsTrust to "crush liberal dominance."</p>'},
                'node-schwab': { title: 'Schwab Charitable (DAFgiving360™)', content: '<p>A massive Donor-Advised Fund (DAF) sponsor that acts as a financial conduit. It has received over $447M from MFT and, in turn, granted over $282M to The 85 Fund, legally obscuring the money trail from the original political source.</p>'},
                'node-donors': { title: 'DonorsTrust', content: '<p>A major DAF often called the "dark money ATM of the right." It received at least $41.1M from MFT, channeling funds to a vast network of conservative groups and further obscuring financial pathways.</p>'},
                'node-85fund': { title: 'The 85 Fund', content: '<p>A 501(c)(3) operational hub that received over $282M from the MFT account at Schwab Charitable. It funds conservative causes and has paid over $21M in a single year to CRC Advisors, a for-profit firm chaired by Leonard Leo.</p>'},
                'node-concord': { title: 'The Concord Fund', content: '<p>The 501(c)(4) lobbying arm of the network, formerly the Judicial Crisis Network. It has received over $90M directly from MFT to run campaigns supporting conservative judicial nominees. It also pays millions to Leo\'s CRC Advisors.</p>'},
                'timeline-1': { title: 'Q2 2021: The Seid Donation', content: '<p>Industrialist Barre Seid donates his entire $1.6 billion company to the Marble Freedom Trust in a transaction structured to avoid an estimated $400 million in taxes.</p><p class="mt-2 text-sm text-gray-400"><b>Key Actors:</b> Barre Seid, Leonard Leo</p>' },
                'timeline-2': { title: 'Q1 2022: Project 2025 Launched', content: '<p>The Heritage Foundation formally launches the "Project 2025" coalition, a detailed plan to overhaul the federal government under a conservative president.</p><p class="mt-2 text-sm text-gray-400"><b>Key Actors:</b> The Heritage Foundation, Russell Vought</p>' },
                'timeline-3': { title: 'Q4 2022: MFT Initial Dispersal', content: '<p>The Marble Freedom Trust makes its first major grants, including $153.8M to Schwab Charitable, establishing the financial superhighway.</p><p class="mt-2 text-sm text-gray-400"><b>Key Actors:</b> MFT, Schwab Charitable</p>' },
                'timeline-4': { title: 'Q2 2023: HEP Voter Challenges Begin', content: '<p>The Honest Elections Project (HEP), an alias of The 85 Fund, begins funding and promoting mass voter registration challenges in key states.</p><p class="mt-2 text-sm text-gray-400"><b>Key Actors:</b> The 85 Fund</p>' },
                'timeline-5': { title: 'Q4 2023: D.C. AG Investigation', content: '<p>The Attorney General for Washington, D.C., launches an investigation into Leonard Leo\'s nonprofit network, examining whether he is illegally enriching himself through his for-profit consulting firm, CRC Advisors.</p><p class="mt-2 text-sm text-gray-400"><b>Key Actors:</b> Leonard Leo, CRC Advisors</p>' },
                'timeline-6': { title: 'Q1 2025: The "Pincer" Converges', content: '<p>The parallel tracks of bureaucratic deconstruction (Project 2025) and cultural mobilization (The Family Leader) are now fully mature and aimed at the same goal: reshaping American democracy.</p><p class="mt-2 text-sm text-gray-400"><b>Key Actors:</b> All</p>' }
            };
            const tabContentData = {
                'steeplechase': { title: 'Mobilizing the Shadow Campaign', content: 'Christian Nationalist networks leverage religious institutions for get-out-the-vote (GOTV) operations. Groups like Faith Wins conduct voter registration drives in churches, while figures like Lance Wallnau host revival-style events that are, in essence, highly targeted voter mobilization efforts. This "shadow campaign" utilizes the tax-exempt status of religious institutions to bypass traditional campaign finance scrutiny, creating a powerful and opaque political machine.'},
                'watchtower': { title: 'Weaponizing Culture for Turnout', content: 'The alliance masterfully weaponizes divisive cultural issues to energize its base. Legislation targeting transgender rights, like Iowa\'s SF 418, serves not only as a policy goal but as a potent messaging tool amplified through faith-based and right-wing media. This strategy frames political contests as existential battles for the nation\'s soul, driving turnout among voters who might otherwise be disengaged.'},
                'checkmate': { title: 'Purging the Opposition', content: '<p class="mb-6">This involves strategies to fund and deploy tools for mass voter challenges. Software like EagleAI is used to flag registrations, which are then passed to activists for challenges, aiming to disenfranchise voters based on flimsy or inaccurate data. Court findings have described the data used as "utterly lacking reliability," yet the tactic persists as a method of voter suppression, funded by the same dark money network.</p><div class="chart-container"><canvas id="tacticsChart"></canvas></div>'}
            };
            const timelineEvents = [
                { id: 'timeline-1', date: 'Q2 2021', title: 'The Seid Donation', align: 'left' },
                { id: 'timeline-2', date: 'Q1 2022', title: 'Project 2025 Launched', align: 'right' },
                { id: 'timeline-3', date: 'Q4 2022', title: 'MFT Initial Dispersal', align: 'left' },
                { id: 'timeline-4', date: 'Q2 2023', title: 'Voter Challenges Begin', align: 'right' },
                { id: 'timeline-5', date: 'Q4 2023', title: 'D.C. AG Investigation', align: 'left' },
                { id: 'timeline-6', date: 'Q1 2025', title: 'The Pincer Converges', align: 'right' },
            ];
            const sevenMountainsData = [
                { name: 'Government', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' },
                { name: 'Media', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><path d="M17 2v4"></path><path d="M7 2v4"></path><path d="M2 12h20"></path></svg>' },
                { name: 'Arts & Entertainment', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 8 4 4-4 4"></path><path d="m8 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path></svg>' },
                { name: 'Business', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>' },
                { name: 'Education', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3.33 1.67 6.67 1.67 10 0v-5"></path></svg>' },
                { name: 'Family', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20v-6m0 0V4m0 10h4m-4 0H6"/><path d="M14 4h3v4h-3zM6 4h3v4H6zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>' },
                { name: 'Religion', icon: '<svg class="mountain-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 13a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>' }
            ];
             const violenceStats = [
                { label: 'Christian Nationalist Adherents', value: 38, description: 'Agree that "true American patriots may have to resort to violence in order to save our country."' },
                { label: 'Christian Nationalist Sympathizers', value: 33, description: 'Also agree with the statement.' }
            ];
            // --- END: Data Definitions ---

            function safeInit(name, func) {
                try { func(); } catch (e) { console.error(`❌ ERROR initializing ${name}:`, e); }
            }
            
            function initModals() {
                const modal = document.getElementById('modal');
                const modalBody = document.getElementById('modal-body');
                const closeModalBtn = document.getElementById('closeModal');
                window.showModal = (id) => {
                    const data = modalData[id];
                    if (data) {
                        modalBody.innerHTML = `<h3 class="text-3xl mb-4 accent-red">${data.title}</h3><div class="text-gray-300 leading-relaxed">${data.content}</div>`;
                        modal.classList.add('visible');
                    }
                };
                function hideModal() { modal.classList.remove('visible'); }
                document.querySelectorAll('.flowchart-node, .timeline-item').forEach(el => {
                    el.addEventListener('click', () => window.showModal(el.id));
                });
                closeModalBtn.addEventListener('click', hideModal);
                modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
            }

            function buildTimeline() {
                const container = document.getElementById('timeline-container');
                if (!container) return;
                container.innerHTML = ''; // Clear previous content
                timelineEvents.forEach(event => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = `timeline-item ${event.align}`;
                    itemDiv.id = event.id;
                    itemDiv.innerHTML = `<div class="timeline-content"><h4 class="text-2xl font-bold">${event.date}</h4><p class="text-lg text-gray-300">${event.title}</p></div>`;
                    container.appendChild(itemDiv);
                });
            }
            
            function build7MMInfographic() {
                const container = document.getElementById('seven-mountains-infographic');
                if (!container) return;
                container.innerHTML = ''; // Clear previous content
                sevenMountainsData.forEach(mountain => {
                    const item = document.createElement('div');
                    item.className = 'mountain-item';
                    item.innerHTML = `${mountain.icon}<span class="font-body text-lg">${mountain.name}</span>`;
                    container.appendChild(item);
                });
            }
            
            function initInteractiveStats() {
                const container = document.getElementById('interactive-stats');
                if (!container) return;
                container.innerHTML = ''; // Clear previous content
                violenceStats.forEach(stat => {
                    const group = document.createElement('div');
                    group.className = 'stat-bar-group';
                    group.innerHTML = `
                        <div class="stat-bar-label">${stat.label}</div>
                        <div class="stat-bar-background">
                            <div class="stat-bar-foreground" style="width: 0%;" data-value="${stat.value}">
                                <span class="stat-bar-percentage">${stat.value}%</span>
                            </div>
                        </div>
                    `;
                    container.appendChild(group);
                });
            }
            
            function initSectionObserver() {
                const sections = document.querySelectorAll('.content-section');
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            if(entry.target.id === 'ideology') {
                                const bars = document.querySelectorAll('#interactive-stats .stat-bar-foreground');
                                bars.forEach(bar => {
                                    bar.style.width = `${bar.dataset.value}%`;
                                });
                            }
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.1 });

                sections.forEach(section => {
                    observer.observe(section);
                });
            }

            function initTacticsChart() {
                 const tabsContainer = document.getElementById('tabs-container');
                 const tabContentContainer = document.getElementById('tab-content');
                 if (!tabsContainer || !tabContentContainer) return;
                 const setActiveTab = (tabName) => {
                      tabsContainer.querySelectorAll('.tab-button').forEach(button => {
                          button.classList.toggle('text-white', button.dataset.tab === tabName);
                          button.classList.toggle('border-accent-red', button.dataset.tab === tabName);
                          button.classList.toggle('text-gray-400', button.dataset.tab !== tabName);
                          button.classList.toggle('border-transparent', button.dataset.tab !== tabName);
                      });
                      
                      const content = tabContentData[tabName];
                      tabContentContainer.innerHTML = `<div id="${tabName}" class="tab-pane"><h4 class="text-3xl mb-4">${content.title}</h4>${content.content}</div>`;

                      if (tabName === 'checkmate') {
                          const tacticsCtx = document.getElementById('tacticsChart').getContext('2d');
                          new Chart(tacticsCtx, { type: 'bar', data: { labels: ['Voter Registrations Challenged (GA)', 'Registrations Removed'], datasets: [{ label: 'Number of Voters', data: [63000, 630], backgroundColor: ['#4A5568', '#E53E3E'], borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: 'Effectiveness of Mass Voter Challenges', font: { size: 16 } } } } });
                      }
                 };
                 tabsContainer.addEventListener('click', (e) => {
                      const button = e.target.closest('.tab-button');
                      if (button) setActiveTab(button.dataset.tab);
                 });
                 setActiveTab('steeplechase');
            }

            function initSmoothScrolling() {
                document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                    anchor.addEventListener('click', function (e) {
                        e.preventDefault();
                        const targetElement = document.querySelector(this.getAttribute('href'));
                        if (targetElement) {
                            targetElement.scrollIntoView({ behavior: 'smooth' });
                        }
                    });
                });
            }

            safeInit("Timeline Builder", buildTimeline);
            safeInit("7MM Infographic Builder", build7MMInfographic);
            safeInit("Interactive Stats", initInteractiveStats);
            safeInit("Tactics Chart", initTacticsChart);
            safeInit("Modals", initModals);
            safeInit("Smooth Scrolling", initSmoothScrolling);
            safeInit("Section Observer", initSectionObserver);
        });
