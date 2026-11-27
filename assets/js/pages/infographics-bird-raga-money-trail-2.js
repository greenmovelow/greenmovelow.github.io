/* Moved from /infographics/bird-raga-money-trail/index.html (inline script 2) so the site CSP can omit 'unsafe-inline'. */
  (function(){
    'use strict';

    /* ---------- Share button ---------- */
    var shareBtn = document.getElementById('share-btn');
    var shareLabel = document.getElementById('share-label');
    var mobileExhibitNav = document.querySelector('.mobile-exhibit-nav');
    if (mobileExhibitNav){
      mobileExhibitNav.querySelectorAll('a').forEach(function(link){
        link.addEventListener('click', function(){ mobileExhibitNav.removeAttribute('open'); });
      });
    }
    if (shareBtn){
      shareBtn.addEventListener('click', function(){
        var data = { title: document.title, url: window.location.href };
        if (navigator.share){
          navigator.share(data).catch(function(){});
        } else if (navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(window.location.href).then(function(){
            if (shareLabel){ var t = shareLabel.textContent; shareLabel.textContent = 'Copied'; setTimeout(function(){ shareLabel.textContent = t; }, 1600); }
          }).catch(function(){ window.prompt('Copy this link:', window.location.href); });
        } else {
          window.prompt('Copy this link:', window.location.href);
        }
      });
    }

    /* Entrance motion is handled entirely in CSS (@keyframes with fill-mode:both,
       gated by prefers-reduced-motion). No JS gating means content can never get
       stuck hidden — important for print, deep-links, and reduced-motion users. */

    /* ---------- Lightweight tooltips (hover + keyboard focus) ---------- */
    var tip = document.getElementById('tip');
    var activeTrigger = null;

    function showTip(el){
      if (!tip) return;
      var txt = el.getAttribute('data-tip');
      if (!txt) return;
      tip.innerHTML = txt;
      tip.classList.add('show');
      activeTrigger = el;
      positionTip(el);
    }
    function hideTip(){
      if (!tip) return;
      tip.classList.remove('show');
      activeTrigger = null;
    }
    function positionTip(el){
      var r = el.getBoundingClientRect();
      // measure tooltip
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = r.left + (r.width/2) - (tw/2);
      var top = r.top - th - 10;
      // clamp horizontally
      var pad = 8;
      if (left < pad) left = pad;
      if (left + tw > window.innerWidth - pad) left = window.innerWidth - pad - tw;
      // flip below if not enough room above
      if (top < pad) top = r.bottom + 10;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }

    var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-tip]'));
    triggers.forEach(function(el){
      el.addEventListener('mouseenter', function(){ showTip(el); });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('focus', function(){ showTip(el); });
      el.addEventListener('blur', hideTip);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && activeTrigger){ hideTip(); activeTrigger.blur && activeTrigger.blur(); }
    });
    window.addEventListener('scroll', function(){ if (activeTrigger) positionTip(activeTrigger); }, { passive:true });
    window.addEventListener('resize', function(){ if (activeTrigger) positionTip(activeTrigger); });
  })();
