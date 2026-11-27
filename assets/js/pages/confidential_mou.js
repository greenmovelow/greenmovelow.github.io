/* Moved from /confidential_mou/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
        // Reveal redaction effect
        function reveal(element) {
            if (!element.classList.contains('revealed')) {
                element.classList.add('revealed');
            }
        }

        // Clock animation
        const clockEl = document.getElementById('clock');
        let days = 45;
        let hours = 0;
        let mins = 0;
        
        // Initial set
        updateClock();

        function updateClock() {
             const fDays = days.toString().padStart(2, '0');
             const fHours = hours.toString().padStart(2, '0');
             const fMins = mins.toString().padStart(2, '0');
             clockEl.innerText = `${fDays}:${fHours}:${fMins}`;
        }

        // Simple countdown simulation for visual effect
        setInterval(() => {
            if (mins > 0) {
                mins--;
            } else {
                mins = 59;
                if (hours > 0) {
                    hours--;
                } else {
                    hours = 23;
                    if(days > 0) days--;
                }
            }
            updateClock();
        }, 1000);

        // Share button functionality
        const shareButton = document.getElementById('share-button');
        if (shareButton) {
            shareButton.addEventListener('click', async () => {
                const shareData = {
                    title: 'The Confidential MOU: Federalizing Voter Rolls',
                    text: 'A secret contract. A 45-day purge clock. And the data keys that turn voter rolls into a federal surveillance grid.',
                    url: window.location.href
                };
                try {
                    if (navigator.share) {
                        await navigator.share(shareData);
                    } else {
                        // Fallback for desktop browsers
                        navigator.clipboard.writeText(window.location.href).then(() => {
                            alert('Link copied to clipboard!');
                        });
                    }
                } catch (err) {
                    console.error("Share failed:", err);
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        alert('Link copied to clipboard!');
                    });
                }
            });
        }
