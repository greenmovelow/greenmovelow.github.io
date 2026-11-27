/* Moved from /shutdown-accountability/index.html (inline script 1) so the site CSP can omit 'unsafe-inline'. */
    const canonicalUrl=document.querySelector('link[rel="canonical"]')?.href||window.location.href;
    async function shareThisPage(trigger){
      const feedback=document.getElementById('share-feedback');
      const d={title:document.title,url:canonicalUrl};
      if(navigator.share){
        try{await navigator.share(d);return}catch(e){if(e.name==='AbortError')return}
      }
      if(navigator.clipboard&&navigator.clipboard.writeText){
        try{
          await navigator.clipboard.writeText(canonicalUrl);
          if(feedback){
            feedback.textContent='Link copied';
            window.clearTimeout(shareThisPage._feedbackTimeout);
            shareThisPage._feedbackTimeout=window.setTimeout(()=>{feedback.textContent='';},1800);
          }
          return;
        }catch(e){}
      }
      window.prompt('Copy this link:',canonicalUrl);
      if(trigger&&typeof trigger.focus==='function')trigger.focus();
    }
    const nav=document.querySelector('.nav-bar');window.addEventListener('scroll',()=>{nav.classList.toggle('scrolled',window.scrollY>20)},{passive:true});
    const toggle=document.getElementById('mobile-toggle'),menu=document.getElementById('mobile-menu');toggle.addEventListener('click',()=>{const o=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',o)});menu.querySelectorAll('a').forEach(l=>{l.addEventListener('click',()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false')})});
