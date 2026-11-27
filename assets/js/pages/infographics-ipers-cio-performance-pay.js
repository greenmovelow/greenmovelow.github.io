/* Moved from /infographics/ipers-cio-performance-pay/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
  (function(){
    'use strict';

    /* ---------- Mobile exhibit nav: close on selection ---------- */
    var mobileExhibitNav = document.querySelector('.mobile-exhibit-nav');
    if (mobileExhibitNav){
      mobileExhibitNav.querySelectorAll('a').forEach(function(link){
        link.addEventListener('click', function(){ mobileExhibitNav.removeAttribute('open'); });
      });
    }

    /* ---------- Share button ---------- */
    var shareBtn = document.getElementById('share-btn');
    var shareLabel = document.getElementById('share-label');
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
  })();
