/* Moved from /leviathan-grid/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        let currentStage = 0;
        const promptBtn = document.getElementById('stage-prompt');
        const statusDisplay = document.getElementById('system-status');
        const mapSvg = document.getElementById('main-map');

        // Animation Functions
        promptBtn.addEventListener('click', nextStage);

        function nextStage() {
            currentStage++;
            
            if (currentStage === 1) {
                // STAGE 1: LOCAL TRAP
                statusDisplay.innerText = "SYSTEM: LOCAL ACTIVATION";
                statusDisplay.className = "text-xs font-mono text-cyan-500 bg-cyan-900/20 px-2 py-1 rounded border border-cyan-900";
                
                document.getElementById('label-dm').style.opacity = 1;
                document.getElementById('popup-1').classList.remove('-translate-x-full');
                
                promptBtn.innerHTML = '<span class="text-sm font-bold text-white uppercase tracking-widest">BRIDGE CONNECTION</span>';
                document.getElementById('step-2-dot').classList.add('bg-cyan-500');
            }
            
            else if (currentStage === 2) {
                // STAGE 2: THE BRIDGE (LAUNDERING)
                statusDisplay.innerText = "SYSTEM: JURISDICTION BYPASS";
                statusDisplay.className = "text-xs font-mono text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-900 animate-pulse";

                // Animate Line DM -> Sarpy
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", "420");
                line.setAttribute("y1", "180");
                line.setAttribute("x2", "400");
                line.setAttribute("y2", "190");
                line.setAttribute("stroke", "#ef4444");
                line.setAttribute("stroke-width", "2");
                line.classList.add("connection-line");
                mapSvg.appendChild(line);

                // Highlight Sarpy
                setTimeout(() => {
                    document.getElementById('node-sarpy').classList.add('node-alert');
                    document.getElementById('label-sarpy').style.opacity = 1;
                    document.getElementById('popup-2').classList.remove('translate-x-full');
                    document.getElementById('laundering-panel').classList.remove('opacity-50');
                    document.getElementById('bypass-alert').classList.remove('hidden');
                }, 1000);

                promptBtn.innerHTML = '<span class="text-sm font-bold text-red-500 uppercase tracking-widest">ACTIVATE NATIONAL GRID</span>';
                document.getElementById('step-3-dot').classList.add('bg-cyan-500');
            }

            else if (currentStage === 3) {
                // STAGE 3: THE SCALE (205 MILLION)
                statusDisplay.innerText = "SYSTEM: FULL SCALE SURVEILLANCE";
                statusDisplay.className = "text-xs font-mono text-red-600 bg-red-900/20 px-2 py-1 rounded border border-red-900 blink";

                // Animate to NLETS
                const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line2.setAttribute("x1", "400");
                line2.setAttribute("y1", "190");
                line2.setAttribute("x2", "680");
                line2.setAttribute("y2", "200");
                line2.setAttribute("stroke", "#ef4444");
                line2.setAttribute("stroke-width", "4");
                line2.setAttribute("stroke-opacity", "0.5");
                line2.classList.add("connection-line");
                mapSvg.appendChild(line2);

                document.getElementById('node-nlets').style.opacity = 1;
                document.getElementById('node-nlets').classList.add('node-alert');
                document.getElementById('label-nlets').style.opacity = 1;

                // Explode Counter
                animateValue("query-counter", 25000000, 205000000, 3000);
                document.getElementById('year-display').innerText = "2025";
                document.getElementById('query-bar').style.width = "100%";
                document.getElementById('query-bar').classList.remove('bg-cyan-500');
                document.getElementById('query-bar').classList.add('bg-red-600');

                promptBtn.innerHTML = '<span class="text-sm font-bold text-slate-400 uppercase tracking-widest">SEQUENCE COMPLETE</span>';
                promptBtn.classList.add('pointer-events-none', 'opacity-50');
                document.getElementById('step-4-dot').classList.add('bg-cyan-500');
            }
        }

        // Counter Animation Helper
        function animateValue(id, start, end, duration) {
            let obj = document.getElementById(id);
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const current = Math.floor(progress * (end - start) + start);
                obj.innerHTML = current.toLocaleString();
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        }
