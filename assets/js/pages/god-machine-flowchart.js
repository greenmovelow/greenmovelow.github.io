/* Moved from /god-machine-flowchart/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
(function () {
    'use strict';

    var prefersReducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------
       Vis Network palette.
       These MUST be literal colours. Vis Network paints into a <canvas>,
       and the Canvas 2D API silently ignores `var(--…)` assignments to
       fillStyle / strokeStyle — the previous colour is retained instead.
       The values below are the same four brand colours declared as CSS
       custom properties in the <style> block above; keep them in sync.
       ------------------------------------------------------------------ */
    var NAVY   = '#0A2239'; /* --primary-navy-blue */
    var GOLD   = '#D4AF37'; /* --accent-burnished-gold */
    var CANVAS = '#FAFAD2'; /* --flowchart-canvas-background */
    var INK    = '#1A1A1A'; /* --text-dark */

    var container = document.getElementById('mynetwork');
    var nodeInfoPanel = document.getElementById('node-info');
    var infoTitle = document.getElementById('info-title');
    var infoDescription = document.getElementById('info-description');
    var scrollPrompt = document.getElementById('scroll-prompt');

    // --- CORRECTED NODE DETAILS ---
    var nodeDetails = {
        'daf': {
            title: 'Anonymous Donor-Advised Funds (DAFs)',
            description: 'The untraceable financial engine. DAFs legally shield the identity of major donors, allowing large, coordinated grants (like a verified $352,000 grant in 2022) to flow to Mission Generation without public accountability.'
        },
        'nacl': {
            title: 'National Association of Christian Lawmakers (NACL)',
            description: 'The legislative "bill mill." This group drafts and distributes model legislation to allied state lawmakers, creating the legal framework that allows public schools to hire or accept chaplains.'
        },
        'faithwins': {
            title: 'Faith Wins',
            description: 'The "grassroots" mobilizer. This group manufactures political pressure by organizing clergy and activists to lobby for the NACL\'s bills, creating the appearance of organic public demand.'
        },
        'missiongen': {
            title: 'Mission Generation / NSCA',
            description: 'The credentialing monopoly. This organization captures the market created by its partners. Financial records show it operates at a massive deficit and has engaged in questionable transactions, including providing loans to its founder with an original principal of $200,000.'
        },
        'publicschools': {
            title: 'Public Schools',
            description: 'The target. The entire machine is oriented to place its certified, ideologically-aligned personnel inside public schools, often replacing licensed, professional counselors.'
        },
        'chaplains': {
            title: 'NSCA Certified Chaplains',
            description: 'The product. These individuals, requiring only a 40-hour online course, are deployed into schools, creating a pipeline that bypasses professional standards for counseling and mental health support.'
        },
        'rockymalloy': {
            title: 'Rocky Malloy',
            description: 'Founder of Mission Generation, Inc. and recipient of loans with an original principal of $200,000 from the nonprofit, a transaction identified as a classic red flag for private inurement by the IRS.'
        }
    };
    // --- END CORRECTION ---

    /* ---------------- Share control ----------------------------------- */
    // Registered before the network so a CDN failure can never disable it.
    var shareButton = document.getElementById('share-button');
    if (shareButton) {
        shareButton.addEventListener('click', function () {
            var shareData = {
                title: 'The God Machine: Interactive Flowchart',
                text: 'Explore the interconnected network behind the push for chaplains in public schools. An RDP investigation.',
                url: window.location.href
            };

            var copyToClipboard = function () {
                // Clipboard access requires a secure context and can be blocked
                // by permissions policy. Degrade quietly instead of throwing.
                if (!navigator.clipboard || !navigator.clipboard.writeText) {
                    window.prompt('Copy this link to share the flowchart:', window.location.href);
                    return;
                }
                navigator.clipboard.writeText(window.location.href).then(function () {
                    window.alert('Link to flowchart copied to clipboard!');
                }).catch(function () {
                    window.prompt('Copy this link to share the flowchart:', window.location.href);
                });
            };

            if (navigator.share) {
                Promise.resolve()
                    .then(function () { return navigator.share(shareData); })
                    .catch(function (err) {
                        // The user dismissing the share sheet is not a failure.
                        if (err && err.name === 'AbortError') { return; }
                        copyToClipboard();
                    });
            } else {
                copyToClipboard();
            }
        });
    }

    /* ---------------- Network ----------------------------------------- */
    if (typeof vis === 'undefined' || !container) {
        if (container) { container.classList.add('gm-network-failed'); }
        if (scrollPrompt) { scrollPrompt.style.display = 'none'; }
        return;
    }

    // --- CORRECTED DATASET ---
    var nodes = new vis.DataSet([
        { id: 'daf', label: 'Anonymous Donors (DAFs)', group: 'funding' },
        { id: 'nacl', label: 'NACL', group: 'ops' },
        { id: 'faithwins', label: 'Faith Wins', group: 'ops' },
        { id: 'missiongen', label: 'Mission Generation / NSCA', group: 'credentialer' },
        { id: 'publicschools', label: 'Public Schools', group: 'target' },
        { id: 'chaplains', label: 'NSCA Certified Chaplains', group: 'credentialer' },
        { id: 'rockymalloy', label: 'Rocky Malloy', group: 'individual' }
    ]);

    var edges = new vis.DataSet([
        { from: 'daf', to: 'missiongen', label: 'Funds', title: 'Verifiable $352k Grant (2022)' },
        { from: 'nacl', to: 'publicschools', label: 'Pushes Legislation' },
        { from: 'faithwins', to: 'nacl', label: 'Lobbies For' },
        { from: 'missiongen', to: 'chaplains', label: 'Certifies' },
        { from: 'chaplains', to: 'publicschools', label: 'Deployed To' },
        { from: 'missiongen', to: 'rockymalloy', label: 'Provides Loan To', title: '$200,000 Principal Loan' },
        { from: 'nacl', to: 'missiongen', label: 'Creates Market For' }
    ]);
    // --- END CORRECTION ---

    var data = { nodes: nodes, edges: edges };

    var nodeColor = {
        background: CANVAS,
        border: NAVY,
        highlight: { background: GOLD, border: NAVY },
        hover: { background: GOLD, border: NAVY }
    };

    var options = {
        nodes: {
            shape: 'box',
            font: {
                face: 'system-ui',
                size: 18,
                color: '#000000' // Fix for label visibility
            },
            borderWidth: 2,
            color: nodeColor,
            widthConstraint: { minimum: 150, maximum: 250 },
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.5)',
                size: 8,
                x: 3,
                y: 3
            }
        },
        /* Every group named in the dataset must be declared here. Vis Network
           assigns an unrecognised group a colour from its own default rainbow
           palette, and that group colour overrides options.nodes.color — which
           is why the map rendered in stock blue/yellow/red/green. The values
           mirror the --group-*-bg custom properties declared above. */
        groups: {
            funding:      { color: { background: GOLD,   border: NAVY, highlight: { background: GOLD, border: NAVY }, hover: { background: GOLD, border: NAVY } }, font: { color: INK } },
            ops:          { color: nodeColor, font: { color: INK } },
            credentialer: { color: nodeColor, font: { color: INK } },
            target:       { color: { background: CANVAS, border: NAVY, highlight: { background: GOLD, border: NAVY }, hover: { background: GOLD, border: NAVY } }, font: { color: INK } },
            individual:   { color: { background: GOLD,   border: NAVY, highlight: { background: GOLD, border: NAVY }, hover: { background: GOLD, border: NAVY } }, font: { color: INK } }
        },
        edges: {
            width: 2,
            color: { color: INK, highlight: NAVY, hover: NAVY },
            font: {
                color: INK,
                face: 'Georgia',
                size: 12,
                strokeWidth: 3,
                strokeColor: CANVAS,
                align: 'top'
            },
            arrows: { to: { enabled: true, scaleFactor: 0.8 } },
            smooth: { type: 'curvedCW', roundness: 0.2 }
        },
        physics: {
            enabled: true,
            stabilization: {
                enabled: true,
                iterations: 1500,
                updateInterval: 100,
                fit: true
            },
            barnesHut: {
                gravitationalConstant: -2000,
                centralGravity: 0.1,
                springLength: 120,
                springConstant: 0.05,
                damping: 0.09,
                avoidOverlap: 0.8
            },
            solver: 'barnesHut'
        },
        interaction: {
            navigationButtons: true,
            keyboard: true,
            zoomView: true,
            dragView: true,
            hover: true
        }
    };

    var network = new vis.Network(container, data, options);

    /* Keep labels readable on narrow viewports. fit() alone will zoom a tall,
       narrow container out far enough that the node labels become unreadable;
       clamp the floor and let the reader pan instead. */
    function minimumReadableScale() {
        return window.innerWidth < 640 ? 0.55 : 0.35;
    }

    function enforceMinimumScale() {
        var floor = minimumReadableScale();
        if (network.getScale() < floor) {
            network.moveTo({ scale: floor });
        }
    }

    function fitGraph() {
        if (prefersReducedMotion) {
            network.fit({ animation: false });
            enforceMinimumScale();
            return;
        }
        network.fit({ animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
        window.setTimeout(enforceMinimumScale, 1100);
    }

    network.on('stabilizationIterationsDone', function () {
        network.setOptions({ physics: false });
        fitGraph();
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(enforceMinimumScale, 200);
    });

    function showNode(nodeId) {
        var details = nodeDetails[nodeId];
        if (!details) { return false; }
        infoTitle.textContent = details.title;
        infoDescription.textContent = details.description;
        nodeInfoPanel.classList.add('active');
        nodeInfoPanel.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'nearest'
        });
        scrollPrompt.style.display = 'none';
        return true;
    }

    function clearNode() {
        nodeInfoPanel.classList.remove('active');
        infoTitle.textContent = '';
        infoDescription.textContent = '';
        scrollPrompt.style.display = '';
    }

    network.on('selectNode', function (params) {
        if (!showNode(params.nodes[0])) { clearNode(); }
    });

    network.on('deselectNode', clearNode);
})();
