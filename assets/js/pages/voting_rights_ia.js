/* Moved from /voting_rights_ia/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
(function() {
  // ── Scroll reveal ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ── Reading progress bar ──
  const progressBar = document.getElementById('progressBar');
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.width = (window.scrollY / h * 100) + '%';
  });

  // ── Count-up animation ──
  const countEls = document.querySelectorAll('.count-up');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.done) {
        entry.target.dataset.done = '1';
        const target = parseInt(entry.target.dataset.target);
        let current = 0;
        const step = Math.max(1, Math.floor(target / 40));
        const interval = setInterval(() => {
          current += step;
          if (current >= target) { current = target; clearInterval(interval); }
          entry.target.textContent = current;
        }, 30);
      }
    });
  }, { threshold: 0.5 });
  countEls.forEach(el => countObserver.observe(el));

  // ── Bar chart animation ──
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.done) {
        entry.target.dataset.done = '1';
        entry.target.querySelectorAll('.bar-fill').forEach(bar => {
          setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, 200);
        });
      }
    });
  }, { threshold: 0.3 });
  const errorBars = document.getElementById('errorBars');
  if (errorBars) barObserver.observe(errorBars);

  // ── Accordion questions ──
  const questions = [
    { q: "What notice is guaranteed before cancellation?", a: "The bills do not clearly define the form, timing, or delivery method of cancellation notices to flagged voters." },
    { q: "What is the current accuracy rate of the verification system?", a: "Iowa's only statewide test showed an 87.3% false-positive rate. No current accuracy benchmarks have been established in the legislation." },
    { q: "Will the verification system be audited, and by whom?", a: "Neither bill specifies independent audit requirements, performance benchmarks, or oversight mechanisms for the SAVE integration." },
    { q: "What documentation will satisfy county auditors?", a: "The acceptable forms of citizenship proof for resolving 'unconfirmed' status are not fully defined in the bill text." },
    { q: "How quickly can DHS or SSA correct underlying records?", a: "Federal agencies control the data — local officials cannot update SAVE records. Correction timelines are not addressed." },
    { q: "How often will recurring checks run?", a: "The frequency of ongoing verification queries against federal databases is undefined — weekly, monthly, quarterly, or continuous." },
    { q: "What audit thresholds will be applied?", a: "No error-rate thresholds that would trigger review or suspension of the system are specified." },
    { q: "What error safeguards will be published?", a: "There is no requirement for transparency about false-positive rates, system failures, or correction processes." },
    { q: "How will cure notifications be delivered and tracked?", a: "Whether notifications will be sent by mail, email, or other means — and how delivery will be confirmed — is not defined." },
    { q: "Will transparency reports be published?", a: "No requirement exists for reporting how many voters are flagged, removed, or reinstated — or for making that data public." }
  ];

  const list = document.getElementById('questionsList');
  questions.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'q-item';
    div.innerHTML = `
      <div class="q-header" data-action="toggleOpen" data-action-args='["$parent"]'>
        <span class="q-num">${i + 1}</span>
        <span class="q-text">${item.q}</span>
        <svg class="q-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </div>
      <div class="q-body"><p>${item.a}</p></div>
    `;
    list.appendChild(div);
  });

  // Actions for data-action buttons (/assets/js/actions.js).
  window.scrollToTimeline = function() {
    document.getElementById('timeline-section').scrollIntoView({behavior:'smooth'});
  };
  window.scrollToTop = function() { window.scrollTo({top:0,behavior:'smooth'}); };
  window.toggleOpen = function(el) { el.classList.toggle('open'); };

  // ── Share ──
  window.shareExhibit = async function() {
    const data = {
      title: 'From State of the Union to State Statute — Iowa SAVE Exhibit',
      text: 'Interactive exhibit: How Iowa is wiring federal SAVE verification into state election law. 88% of flagged voters were U.S. citizens.',
      url: window.location.href
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch(e) {}
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied!'));
    }
  };
})();
