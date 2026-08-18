(function(){
  var s=document.getElementById('splash');if(!s)return;
  var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  var t=s.querySelector('.wel-target'),tx=s.querySelectorAll('.wel-kick,.wel-title,.wel-logo'),done=false;
  var _lg=s.querySelector('.wel-logo');
  function setLogo(){var h=document.querySelector('header img');if(h&&_lg&&!_lg.getAttribute('src'))_lg.src=h.src;}
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',setLogo);}else{setLogo();}
  function rm(){if(s.parentNode)s.parentNode.removeChild(s);}
  function begin(){if(done)return;done=true;
    if(reduce||!s.animate){rm();return;}
    try{
      t.animate([{transform:'scale(1)',opacity:1},{transform:'scale(13)',opacity:0}],{duration:1100,easing:'cubic-bezier(.6,0,.28,1)',fill:'forwards'});
      tx.forEach(function(e){e.animate([{opacity:1},{opacity:0,transform:'translateY(-8px)'}],{duration:340,easing:'ease',fill:'forwards'});});
      s.animate([{opacity:1},{opacity:0}],{duration:820,delay:400,easing:'ease',fill:'forwards'});
    }catch(e){}
    setTimeout(rm,1250);
  }
  s.addEventListener('click',begin);
  setTimeout(begin,reduce?900:2700);
})();
