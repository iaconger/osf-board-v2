(function(){
  "use strict";
  var TOTAL = 8;
  var svgns = 'http://www.w3.org/2000/svg';
  var cur = 0;
  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var dotsBox = document.getElementById('dots');
  var partTag = document.getElementById('parttag');
  var PART_LABELS = ['A team walkthrough','Your commitment card','Your commitment card','Your commitment card','Our commitments','On target','Your Strategy Commitment Card','The shared OSF board'];

  // build progress dots (skip welcome + finished = 7 middle steps feel right; show all 9 lightly)
  for(var i=0;i<TOTAL;i++){ var d=document.createElement('i'); dotsBox.appendChild(d); }
  var dotEls = Array.prototype.slice.call(dotsBox.children);

  function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function show(n){
    n = Math.max(0, Math.min(TOTAL-1, n));
    screens.forEach(function(s){ s.classList.toggle('active', Number(s.getAttribute('data-part'))===n); });
    dotEls.forEach(function(d,idx){ d.classList.toggle('on', idx===n); d.classList.toggle('done', idx<n); });
    partTag.textContent = PART_LABELS[n];
    cur = n;
    var active = document.querySelector('.screen[data-part="'+n+'"]'); if(active && n!==7) staggerReveal(active);
    if(n!==5) stopOTCycle();
    if(n===5) renderOnTarget();
    if(n===6) renderCard();
    if(n===7) renderBoard();
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); }
  }

  // consistent, subtle cascade: each step's content settles in one after another
  function staggerReveal(screen){
    var host = screen.querySelector('.welcome') || screen;
    var kids = Array.prototype.slice.call(host.children);
    kids.forEach(function(el, i){
      el.classList.remove('rvl'); el.style.animationDelay='';
      void el.offsetWidth;
      el.style.animationDelay = (50 + i*66) + 'ms';
      el.classList.add('rvl');
    });
  }

  document.addEventListener('click', function(ev){
    var t = ev.target.closest('[data-go]'); if(!t) return;
    show(Number(t.getAttribute('data-go')));
  });

  // ---- OSF divisions / ministry-services taxonomy for the connection step ----
  var DIVISIONS = ['Nursing','Pharmacy','Laboratory','Imaging & Radiology','Care Management','Behavioral Health',
    'Patient Experience','Supply Chain','Environmental Services','Facilities','Food & Nutrition',
    'OSF Digital / IT','Finance','Revenue Cycle','Human Resources','Medical Group','Emergency Services',
    'Surgical Services','Rehabilitation','Home Care','Quality & Safety','Population Health',
    'Mission Services','Ethics','OSF Foundation','Marketing & Communications'];
  var selected = [];
  var chipsBox = document.getElementById('chips');
  var selCount = document.getElementById('selcount');
  var toReach = document.getElementById('toReach');

  DIVISIONS.forEach(function(name){
    var b = document.createElement('button');
    b.className='chip'; b.type='button'; b.setAttribute('data-name',name);
    b.innerHTML = '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'+esc(name);
    b.addEventListener('click', function(){ toggleChip(name, b); });
    chipsBox.appendChild(b);
  });
  // add-your-own chip
  var addBtn = document.createElement('button');
  addBtn.className='chip chip-add'; addBtn.type='button';
  addBtn.innerHTML='+ Add another team';
  addBtn.addEventListener('click', function(){ addCustom(); });
  chipsBox.appendChild(addBtn);

  function toggleChip(name, el){
    var i = selected.indexOf(name);
    if(i>=0){ selected.splice(i,1); el.classList.remove('on'); }
    else { selected.push(name); el.classList.add('on'); }
    updateSel();
  }
  function createChip(v){
    var b = document.createElement('button');
    b.className='chip on'; b.type='button'; b.setAttribute('data-name',v);
    b.innerHTML = '<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'+esc(v);
    b.addEventListener('click', function(){ toggleChip(v, b); });
    chipsBox.insertBefore(b, addBtn);
    selected.push(v); updateSel();
  }
  // inline add field (window.prompt is blocked in sandboxed/embedded previews)
  function addCustom(){
    var existing = chipsBox.querySelector('.chip-input');
    if(existing){ existing.querySelector('input').focus(); return; }
    var wrap = document.createElement('span');
    wrap.className='chip-input';
    wrap.innerHTML='<input type="text" maxlength="40" placeholder="Team or division…" autocomplete="off" aria-label="Add a team or division"><button type="button" class="ci-add">Add</button>';
    chipsBox.insertBefore(wrap, addBtn);
    var inp = wrap.querySelector('input'), ok = wrap.querySelector('.ci-add'), done=false;
    function finish(create){
      if(done) return; done=true;
      var v = inp.value.replace(/[<>]/g,'').trim().slice(0,40);
      if(create && v && selected.indexOf(v)<0) createChip(v);
      if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    ok.addEventListener('mousedown', function(e){ e.preventDefault(); finish(true); });
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); finish(true); } else if(e.key==='Escape'){ e.preventDefault(); finish(false); } });
    inp.addEventListener('blur', function(){ finish(true); });
    inp.focus();
  }
  function updateSel(){
    toReach.disabled = selected.length===0;
    if(!selected.length){ selCount.textContent='None selected yet. Tap the teams you partner with.'; }
    else { selCount.textContent = selected.length+' team'+(selected.length>1?'s':'')+' selected. Pick as many as fit.'; }
  }

  // ---- field gating ----
  var teamDept=document.getElementById('teamDept');
  var teamName=document.getElementById('teamName'), teamWork=document.getElementById('teamWork');
  var toConn=document.getElementById('toConn');
  // the team's identity on the card and board: "Marketing · UX & SEO"
  function teamIdentity(){ var d=teamDept.value.trim(), n=teamName.value.trim(); return (d && n) ? (d+' · '+n) : (n || d); }
  function gateName(){ toConn.disabled = teamDept.value.trim().length<2 || teamName.value.trim().length<1; }
  teamDept.addEventListener('input', gateName);
  teamName.addEventListener('input', gateName);
  var reach=document.getElementById('reach');
  var toCommit=document.getElementById('toCommit');
  var toFinish=document.getElementById('toFinish');
  var GOAL_COLORS={g1:'#64A70B',g2:'#00A9CE',g3:'#A5228E'};
  var GOAL_NAMES={g1:'Excellence',g2:'One OSF Team',g3:'Destination OSF'};

  // reach step gate
  function gateReach(){ toCommit.disabled = reach.value.trim().length<3; }
  reach.addEventListener('input', gateReach);

  // ---- commitments: one per pillar, plus add more ----
  var commitList=document.getElementById('commitList');
  var addCommitBtn=document.getElementById('addCommit');
  function pillarOptions(sel){
    return '<option value="">Choose a goal…</option>'+
      '<option value="g1"'+(sel==='g1'?' selected':'')+'>Excellence</option>'+
      '<option value="g2"'+(sel==='g2'?' selected':'')+'>One OSF Team</option>'+
      '<option value="g3"'+(sel==='g3'?' selected':'')+'>Destination OSF</option>';
  }
  function collectCommitments(){
    var out=[];
    Array.prototype.slice.call(commitList.querySelectorAll('.commit-item')).forEach(function(it){
      var ta=it.querySelector('.commit-in'); var text=ta?ta.value.trim():'';
      var goal=it.getAttribute('data-goal');
      if(it.classList.contains('commit-extra')){ var s=it.querySelector('select'); goal=s?s.value:''; }
      if(text && goal) out.push({text:text, goal:goal});
    });
    return out;
  }
  function gateFinish(){
    var base=Array.prototype.slice.call(commitList.querySelectorAll('.commit-item:not(.commit-extra) .commit-in'));
    var baseOk = base.length===3 && base.every(function(t){ return t.value.trim().length>=3; });
    var extrasOk = Array.prototype.slice.call(commitList.querySelectorAll('.commit-item.commit-extra')).every(function(it){
      var text=it.querySelector('.commit-in').value.trim(); var goal=it.querySelector('select').value;
      return !text || (text.length>=3 && goal);
    });
    toFinish.disabled = !(baseOk && extrasOk);
  }
  commitList.addEventListener('input', gateFinish);
  commitList.addEventListener('change', gateFinish);
  addCommitBtn.addEventListener('click', function(){
    var div=document.createElement('div');
    div.className='commit-item commit-extra'; div.setAttribute('data-goal','');
    div.innerHTML='<div class="choose"><span class="pilldot xdot"></span><select>'+pillarOptions('')+'</select>'+
      '<button type="button" class="rm">Remove</button></div>'+
      '<textarea class="commit-in" maxlength="200" placeholder="Add another commitment"></textarea>';
    commitList.appendChild(div);
    var sel=div.querySelector('select'), dot=div.querySelector('.xdot');
    sel.addEventListener('change', function(){ dot.style.background = sel.value ? GOAL_COLORS[sel.value] : '#dfe4d7'; });
    div.querySelector('.rm').addEventListener('click', function(){ div.parentNode.removeChild(div); gateFinish(); });
    gateFinish();
  });

  // ---- on target: the target builds outside-in — Excellence, then One OSF Team,
  // then Destination OSF at the center. Each goal's commitments land as its ring arrives.
  function renderBullseye(commits){
    var mount = document.getElementById('bullseye'); if(!mount) return;
    var cx=180, cy=172;
    var reduce=false; try{ reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
    // outer -> center, revealed in this order. `tx` = darker label color for contrast.
    var RINGS=[
      {goal:'g1', r:154, land:130, fill:'#eef6e0', stroke:'#64A70B', tx:'#3f6d08', label:'EXCELLENCE',      ly:-134, delay:0.15},
      {goal:'g2', r:110, land:84,  fill:'#e2f4fa', stroke:'#00A9CE', tx:'#00647d', label:'ONE OSF TEAM',    ly:-88,  delay:1.05},
      {goal:'g3', r:68,  land:0,   fill:'#f6e4f1', stroke:'#A5228E', tx:'#7c1a6a', label:'DESTINATION OSF', ly:-44,  delay:1.95}
    ];
    function ring(g){ for(var i=0;i<RINGS.length;i++){ if(RINGS[i].goal===g) return RINGS[i]; } return null; }
    var svg='<svg viewBox="0 0 360 372" role="img" aria-label="Reaching Destination OSF by first being excellent and one OSF team">';
    // rings + labels, each in a group that scales up from the center when its turn comes
    RINGS.forEach(function(R){
      var reveal = reduce ? '' :
        '<animateTransform attributeName="transform" type="scale" from="0.45" to="1" begin="'+R.delay+'s" dur="0.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.34 1.3 0.5 1"/>'+
        '<animate attributeName="opacity" from="0" to="1" begin="'+R.delay+'s" dur="0.35s" fill="freeze"/>';
      var pw = R.label.length*7.7 + 20;   // white pill sized to the label so it always reads
      svg+='<g transform="translate('+cx+' '+cy+')"><g'+(reduce?'':' opacity="0"')+'>'+
        '<circle data-ring="'+R.goal+'" cx="0" cy="0" r="'+R.r+'" fill="'+R.fill+'" stroke="'+R.stroke+'" stroke-width="2"/>'+
        '<rect x="'+(-pw/2).toFixed(1)+'" y="'+(R.ly-13)+'" width="'+pw.toFixed(1)+'" height="22" rx="11" fill="#ffffff" opacity="0.92"/>'+
        '<text x="0" y="'+(R.ly+4)+'" text-anchor="middle" font-family="Brandon Grotesque, Montserrat, sans-serif" font-size="13" font-weight="700" letter-spacing="0.5" fill="'+R.tx+'">'+R.label+'</text>'+
        reveal+
      '</g></g>';
    });
    var counts={g1:0,g2:0,g3:0};
    commits.forEach(function(c){ if(counts[c.goal]!=null) counts[c.goal]++; });
    var idx={g1:0,g2:0,g3:0};
    var dots='';
    commits.forEach(function(c,ci){
      var R=ring(c.goal); if(!R) return;
      var total=counts[c.goal]||1, k=idx[c.goal]++;
      var spin=(c.goal==='g2'?55:c.goal==='g3'?90:35);
      var ang=(-90 + k*(360/total) + spin)*Math.PI/180;
      var lr = R.goal==='g3' ? (total>1? 20:0) : R.land;
      var lx=cx+lr*Math.cos(ang), ly=cy+lr*Math.sin(ang);
      var col=R.stroke;
      if(reduce){
        dots+='<circle data-goal="'+c.goal+'" data-idx="'+ci+'" cx="'+lx.toFixed(1)+'" cy="'+ly.toFixed(1)+'" r="8" fill="'+col+'" stroke="#fff" stroke-width="2"><title>'+esc(c.text)+'</title></circle>';
      } else {
        var sx=cx+((k%2)?46:-46), sy=372;
        var path='M '+sx+' '+sy+' Q '+cx+' '+(cy+70)+' '+lx.toFixed(1)+' '+ly.toFixed(1);
        var beg=(R.delay + 0.5 + k*0.22).toFixed(2);   // land just after this goal's ring appears
        dots+='<circle data-goal="'+c.goal+'" data-idx="'+ci+'" data-lx="'+lx.toFixed(1)+'" data-ly="'+ly.toFixed(1)+'" cx="0" cy="0" r="8" fill="'+col+'" stroke="#fff" stroke-width="2" opacity="0">'+
          '<title>'+esc(c.text)+'</title>'+
          '<animateMotion dur="0.7s" begin="'+beg+'s" path="'+path+'" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.22 1 0.36 1"/>'+
          '<animate attributeName="opacity" dur="0.16s" begin="'+beg+'s" values="0;1" fill="freeze"/>'+
          '<animate attributeName="r" dur="0.42s" begin="'+(parseFloat(beg)+0.58).toFixed(2)+'s" values="8;13;8" fill="freeze"/>'+
        '</circle>';
      }
    });
    svg+=dots+'</svg>';
    mount.innerHTML=svg;
  }

  // interactive stack of commitment cards beside the target
  var otReduce=false, otCommits=[];
  try{ otReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var GOAL_TX={g1:'#3f6d08',g2:'#00647d',g3:'#7c1a6a'};
  function buildCommitCards(commits){
    var host=document.getElementById('commitCards'); if(!host) return;
    otCommits=commits;
    var html='';
    commits.forEach(function(c,i){
      html+='<div class="otc" data-goal="'+c.goal+'" data-i="'+i+'">'+
        '<div class="otc-goal">'+esc(GOAL_NAMES[c.goal]||'')+'</div>'+
        '<div class="otc-text">'+esc(c.text)+'</div>'+
        '<div class="otc-foot">Our commitment for '+esc(GOAL_NAMES[c.goal]||'this goal')+'</div>'+
      '</div>';
    });
    host.innerHTML=html;
    // nav: prev / dots / next
    var nav=document.getElementById('otNav');
    if(nav){
      var dh='<button type="button" data-nav="-1" aria-label="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg></button><div class="otdots">';
      commits.forEach(function(c,i){ dh+='<i data-i="'+i+'"></i>'; });
      dh+='</div><button type="button" data-nav="1" aria-label="Next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg></button>';
      nav.innerHTML=dh;
      Array.prototype.slice.call(nav.querySelectorAll('.otdots i')).forEach(function(d){
        d.addEventListener('click', function(){ setActiveOT(Number(d.getAttribute('data-i'))); });
      });
      Array.prototype.slice.call(nav.querySelectorAll('button[data-nav]')).forEach(function(b){
        b.addEventListener('click', function(){ setActiveOT(activeOT()+Number(b.getAttribute('data-nav'))); });
      });
    }
    // click a card (front = next, behind = bring forward)
    host.addEventListener('click', function(e){
      if(host._dragged) { host._dragged=false; return; }
      var card=e.target.closest('.otc'); if(!card) return;
      var ci=Number(card.getAttribute('data-i'));
      setActiveOT(ci===activeOT() ? ci+1 : ci);
    });
    // swipe / drag
    var downX=null;
    host.addEventListener('pointerdown', function(e){ downX=e.clientX; host._dragged=false; });
    window.addEventListener('pointerup', function(e){
      if(downX===null) return; var dx=e.clientX-downX; downX=null;
      if(Math.abs(dx)>45){ host._dragged=true; setActiveOT(activeOT()+(dx<0?1:-1)); }
    });
    sizeStack(host);
  }
  // make the stack as tall as its tallest card (+ room for the peeking cards behind)
  function sizeStack(host){
    var maxH=0;
    Array.prototype.slice.call(host.querySelectorAll('.otc')).forEach(function(c){ maxH=Math.max(maxH, c.offsetHeight); });
    if(maxH){ host.style.height = (maxH + 46) + 'px'; }
  }
  function activeOT(){ var h=document.getElementById('commitCards'); return h? Number(h.getAttribute('data-active')||0):0; }
  function highlightRing(goal){
    var bs=document.getElementById('bullseye'); if(!bs) return;
    Array.prototype.slice.call(bs.querySelectorAll('circle[data-ring]')).forEach(function(r){
      var on = r.getAttribute('data-ring')===goal;
      r.setAttribute('stroke-width', on?'5':'2');
      r.style.filter = on ? 'drop-shadow(0 0 7px '+r.getAttribute('stroke')+')' : 'none';
    });
    Array.prototype.slice.call(bs.querySelectorAll('circle[data-goal]')).forEach(function(d){
      var on = d.getAttribute('data-goal')===goal;
      d.setAttribute('stroke-width', on?'3.5':'2');
      d.style.filter = on ? 'drop-shadow(0 0 6px '+d.getAttribute('fill')+')' : 'none';
    });
    // colored words in the closing line
    Array.prototype.slice.call(document.querySelectorAll('.bull-msg [data-goal]')).forEach(function(w){
      w.classList.toggle('lit', w.getAttribute('data-goal')===goal);
    });
  }
  function setActiveOT(i){
    var host=document.getElementById('commitCards'); if(!host) return;
    var cards=Array.prototype.slice.call(host.querySelectorAll('.otc'));
    if(!cards.length) return;
    var n=cards.length; i=((i%n)+n)%n;
    host.setAttribute('data-active', i);
    cards.forEach(function(card,ci){
      var rel=(ci-i+n)%n;                         // 0 = front, then stacked behind
      var depth=Math.min(rel,3);
      card.style.zIndex = String(50-rel);
      card.style.opacity = rel<=2 ? '1' : '0';
      card.style.transform = 'translateY('+(depth*15)+'px) scale('+(1-depth*0.05)+')';
    });
    Array.prototype.slice.call(document.querySelectorAll('#otNav .otdots i')).forEach(function(d,di){ d.classList.toggle('on', di===i); });
    highlightRing(cards[i].getAttribute('data-goal'));
  }
  // jump to the first card of a goal (used by ring hover + word hover)
  function showGoalCard(goal){
    for(var i=0;i<otCommits.length;i++){ if(otCommits[i].goal===goal){ setActiveOT(i); return; } }
  }
  function stopOTCycle(){ /* no auto-cycle: fully interactive */ }
  function wireTargetHover(){
    var bs=document.getElementById('bullseye'); if(!bs) return;
    Array.prototype.slice.call(bs.querySelectorAll('circle[data-ring]')).forEach(function(r){
      r.addEventListener('mouseenter', function(){ showGoalCard(r.getAttribute('data-ring')); });
    });
    Array.prototype.slice.call(bs.querySelectorAll('circle[data-goal]')).forEach(function(d){
      d.addEventListener('mouseenter', function(){ setActiveOT(Number(d.getAttribute('data-idx'))); });
    });
  }
  function wireMsgHover(){
    Array.prototype.slice.call(document.querySelectorAll('.bull-msg [data-goal]')).forEach(function(w){
      w.addEventListener('mouseenter', function(){ showGoalCard(w.getAttribute('data-goal')); });
    });
  }
  function renderOnTarget(){
    var commits = collectCommitments();
    renderBullseye(commits);
    buildCommitCards(commits);
    setActiveOT(0);
    // wire hovers after the target builds in
    setTimeout(function(){ if(cur===5){ wireTargetHover(); wireMsgHover(); } }, otReduce?0:2300);
  }

  // ---- finished card ----
  function renderCard(){
    var name = teamIdentity() || 'Our Team';
    var work = teamWork.value.trim();
    var conns = selected.slice();
    var reachV = reach.value.trim();
    var commitments = collectCommitments();

    var html = '<div class="mtc-top"><div class="mk">OSF Strategy Commitment Card · FY27</div><h3>'+esc(name)+'</h3></div>'+
      '<div class="mtc-body">';
    if(work){ html += field('Our role in Destination OSF', esc(work)); }
    html += '<div class="mtc-field"><div class="lb">Who we\'re connected to</div><div class="conn-list">'+
      (conns.length? conns.map(function(c){return '<span>'+esc(c)+'</span>';}).join('') : '<span>Our wider OSF team</span>')+
      '</div></div>';
    html += field('How our work reaches the people we serve', esc(reachV));
    var citems = commitments.map(function(c){
      var col = GOAL_COLORS[c.goal]||'#4E8209'; var nm = GOAL_NAMES[c.goal]||'Commitment';
      return '<div class="mtc-commit"><span class="pbadge" style="--pc:'+col+'"><span class="pd"></span>'+esc(nm)+'</span><span class="ct">'+esc(c.text)+'</span></div>';
    }).join('');
    html += '<div class="mtc-field"><div class="lb">Our commitments for FY27</div><div class="mtc-commits">'+(citems||'<div class="vl">—</div>')+'</div></div>';
    html += '</div>'+
      '<div class="mtc-foot"><img src="data:image/png;base64,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s+oJj9mqehYsYvodVOVypDXbEblUG5hHnjhaLkRNp0vbKXa9hw8b0cbFn6dhGBvTNaqc6DPsJW0Fk6RoSF8AIReRJNMoF1UrqNSLy4zrJLmw5wPeqz+q5CAhMmGbCGLHMWrHVd1nsfdfQsvCsyXHrj/WbdpU78jKZ+Kr2iqkoXwnrjaPKJTZoQg8s1y/NQSUqrEDm6I4fisM12bfLg/ihdohs3jgi3iCyWiSp8SPvdCOw0SiVFx2XN17ivxvO16v0HaQ2htl6gF9+Xx225ScBcizt4eyn7wJJtgM7VR7/Dr1usxj15t/Hqbx2bHzaab+yuPjxEbTZ9Nkt9Pk3jyLKuN4bsYnwIgLqsqDf0yZsuc3+firpDMP5zjc3mbfKfOwnjqqM4WNn7fh8bN9R2Fu21v5E+x0o/oqYluLLj5bJ8m5QfDaa4N43HZ8MNg5ezEfalz7yu3+xHmub//nfTSysyxzz3GATQD9xPf7ULk9qSFtczVDzK8onSXjQ9ssewwo1XVu7LIPZSrSfS3ftzJ5agZMf1TZS/ow09oYLzVJWns2zjGmETPXxJhLPutgPvprvb5uyu/arzBdu/ZGhB5BQBAQBASB1hDgAm6YYdeHARsic1SHyW6NKKlIEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBAFBQBAQBAQBQUAQEAQEAUFAEBAEBIFVEPh/KmR16myHblMAAAAASUVORK5CYII=" alt="OSF"><span>One OSF Team · in service of every patient and the Mission</span></div>';
    document.getElementById('cardOut').innerHTML = html;

    buildWeb(name, conns);
  }
  function field(lb,val){ return '<div class="mtc-field"><div class="lb">'+lb+'</div><div class="vl">'+(val||'—')+'</div></div>'; }

  // ---- connection chain: our team -> the teams we support -> the patient.
  // Reaches the patient directly for some, or through several hops for others. ----
  function buildWeb(teamName, conns){
    function trunc(s,m){ return s.length>m ? s.slice(0,m-1)+'…' : s; }
    var shown = conns.slice(0,6);
    var extra = conns.length - shown.length;
    var mid = shown.map(function(c){return {label:c, more:false};});
    if(extra>0) mid.push({label:'+'+extra+' more', more:true});

    var W=600, rowH=54;
    var rows = Math.max(1, mid.length);
    var H = Math.max(300, rows*rowH + 92);
    var cy = H/2, teamX=108, midX=316, patX=512;
    var startY = cy - (mid.length-1)*rowH/2;
    var pts = mid.map(function(nd,i){ return {x:midX, y:startY+i*rowH, nd:nd}; });

    var PADX=16, PADY=20;
    var svg = '<svg viewBox="'+(-PADX)+' '+(-PADY)+' '+(W+2*PADX)+' '+(H+2*PADY)+'" style="overflow:visible" role="img" aria-label="How our work reaches our patients, from our team through the teams we work with">';

    // connecting lines: team -> each supported team -> the patient
    var lines='';
    if(pts.length){
      pts.forEach(function(p){
        lines += '<line x1="'+(teamX+22)+'" y1="'+cy+'" x2="'+p.x+'" y2="'+p.y.toFixed(1)+'" stroke="#c8d4b8" stroke-width="1.8"/>';
        lines += '<line x1="'+p.x+'" y1="'+p.y.toFixed(1)+'" x2="'+(patX-22)+'" y2="'+cy+'" stroke="#c8d4b8" stroke-width="1.8"/>';
      });
    } else {
      lines += '<line x1="'+(teamX+22)+'" y1="'+cy+'" x2="'+(patX-22)+'" y2="'+cy+'" stroke="#c8d4b8" stroke-width="1.8" stroke-dasharray="5 4"/>';
    }
    svg += '<g>'+lines+'</g>';

    // the patient (right)
    svg += '<g>'+
      '<circle cx="'+patX+'" cy="'+cy+'" r="40" fill="#fff" stroke="#4E8209" stroke-width="2.8"/>'+
      '<g transform="translate('+patX+' '+cy+') scale(1.4)"><path transform="translate(-12 -12.1)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#A5228E"/></g>'+
      '</g>'+
      '<text x="'+patX+'" y="'+(cy+62)+'" text-anchor="middle" font-family="Brandon Grotesque, Montserrat, sans-serif" font-size="13" font-weight="700" fill="#5c665a" letter-spacing="0.6">OUR PATIENTS</text>';

    // the teams we support / partner with (middle)
    pts.forEach(function(p){
      var label = trunc(p.nd.label, 24);
      var rw = Math.max(96, label.length*7.4+26);
      var fill = p.nd.more ? '#f4f0e6' : '#eef6e0';
      var stroke = p.nd.more ? '#e0d8c4' : '#cbe0a6';
      var tcol = p.nd.more ? '#7a7360' : '#3f6d08';
      svg += '<g>'+
        '<rect x="'+(p.x-rw/2).toFixed(1)+'" y="'+(p.y-16).toFixed(1)+'" width="'+rw.toFixed(1)+'" height="32" rx="16" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.6"/>'+
        '<text x="'+p.x+'" y="'+(p.y+5).toFixed(1)+'" text-anchor="middle" font-family="Brandon Grotesque, Montserrat, sans-serif" font-size="13.5" font-weight="600" fill="'+tcol+'">'+esc(label)+'</text>'+
        '</g>';
    });

    // our team (left) — a team icon, mirroring the patient on the right
    var tlabel = trunc(teamName, 22);
    svg += '<g>'+
      '<circle cx="'+teamX+'" cy="'+cy+'" r="40" fill="#eef6e0" stroke="#4E8209" stroke-width="2.8"/>'+
      '<g transform="translate('+teamX+' '+cy+') scale(1.4)"><g transform="translate(-12 -12)" fill="#4E8209">'+
        '<circle cx="12" cy="8" r="3.3"/>'+
        '<path d="M5 19.5c0-3.9 3.1-6 7-6s7 2.1 7 6z"/>'+
        '<circle cx="4.2" cy="10.6" r="2.3"/>'+
        '<circle cx="19.8" cy="10.6" r="2.3"/>'+
      '</g></g>'+
      '</g>'+
      '<text x="'+teamX+'" y="'+(cy+62)+'" text-anchor="middle" font-family="Brandon Grotesque, Montserrat, sans-serif" font-size="13" font-weight="700" fill="#3f6d08">'+esc(tlabel)+'</text>';


    svg += '</svg>';
    document.getElementById('web').innerHTML = svg;
    var cap = document.getElementById('webcap');
    cap.innerHTML = 'From our team, through the teams we work with, all the way to our patients.';
  }

  // ---- shared board heart — live via WebSocket ----
  var SEED_COMMITS = [
    {team:'4 South · Peoria', dv:'Nursing', commit:'Round on every patient within 15 minutes of a call light.', goal:'g1'},
    {team:'Inpatient Pharmacy', dv:'Pharmacy', commit:'Cut discharge medication wait times in half.', goal:'g1'},
    {team:'Service Desk', dv:'OSF Digital / IT', commit:'Resolve clinician tickets faster so they stay at the bedside.', goal:'g2'},
    {team:'Central Supply', dv:'Supply Chain', commit:'Never let a unit run short on a critical supply.', goal:'g2'},
    {team:'Patient Financial Services', dv:'Revenue Cycle', commit:'Make every bill clear enough that no patient calls confused.', goal:'g3'},
    {team:'Talent Acquisition', dv:'Human Resources', commit:'Fill open caregiver roles 20% faster.', goal:'g2'},
    {team:'EVS · Rockford', dv:'Environmental Services', commit:'Turn rooms over quickly so patients are seen sooner.', goal:'g1'},
    {team:'OSF Foundation', dv:'Foundation', commit:'Fund two new community health programs this year.', goal:'g3'},
    {team:'Food & Nutrition', dv:'Food & Nutrition', commit:'Get every meal to the floor warm and on time.', goal:'g1'},
    {team:'Care Coordination', dv:'Care Management', commit:'Make sure no patient leaves without a follow-up plan.', goal:'g2'},
    {team:'Behavioral Health · Bloomington', dv:'Behavioral Health', commit:'Shorten the wait for a first appointment.', goal:'g1'},
    {team:'Finance · Shared Services', dv:'Finance', commit:'Free up dollars that go straight back into patient care.', goal:'g3'}
  ];
  var HEART_COLOR = '#4E8209'; // every team on the heart shows in one OSF green
  function dotColor(goal){ return HEART_COLOR; }
  var board = { count:0, feed:[], built:false, submitted:false, inited:false, hoverWired:false, ws:null };
  var OFFLINE = (location.protocol === 'file:'); // file:// preview shows sample data; the deployed app is real-only

  function seedFeed(){ return SEED_COMMITS.map(function(s){ return { team:s.team+' · '+s.dv, commit:s.commit, goal:s.goal }; }); }

  function boardConnect(){
    if(location.protocol === 'file:') return;                 // offline preview → seed only
    var proto = (location.protocol === 'https:' ? 'wss://' : 'ws://');
    var ws; try { ws = new WebSocket(proto + location.host); } catch(e){ return; }
    board.ws = ws;
    ws.onmessage = function(ev){
      var m; try { m = JSON.parse(ev.data); } catch(e){ return; }
      if(m.type === 'init'){
        board.count = m.count || 0; board.feed = (m.feed || []).slice(); board.inited = true;
        if(cur === 7){ var g = document.getElementById('teamdots'); if(g){ g.innerHTML=''; board.built=false; } setCount(); renderFeed(); buildDots(); }
      } else if(m.type === 'accepted'){ arrive(m.item, m.count, true); }
      else if(m.type === 'add'){ arrive(m.item, m.count, false); }
    };
    ws.onclose = function(){ board.ws = null; setTimeout(boardConnect, 2500); };
    ws.onerror = function(){ try{ ws.close(); }catch(e){} };
  }

  function submitTeam(){
    if(board.submitted) return; board.submitted = true;
    var cms = collectCommitments();
    var payload = { type:'submit', team:teamIdentity(), work:teamWork.value.trim(),
      connections:selected.slice(0,12), reach:reach.value.trim(), commitments:cms };
    if(board.ws && board.ws.readyState === 1){ board.ws.send(JSON.stringify(payload)); }
    else if(cms.length){ arrive({team:payload.team, commit:cms[0].text, goal:''}, board.count + 1, true); }   // offline echo: one card
  }

  function renderBoard(){
    var name = teamIdentity() || 'Our team';
    document.getElementById('boardName').textContent = '“' + name + '” added to the board';
    if(!board.inited && OFFLINE){ board.count = 1246; board.feed = seedFeed(); board.inited = true; }
    // show the current total right away, then tick +1 when our team lands
    var cel = document.getElementById('teamcount'); if(cel) cel.textContent = board.count.toLocaleString();
    renderFeed(); buildDots(); wireHover();
    if(!board.submitted){
      setTimeout(function(){
        if(board.ws && board.ws.readyState === 1){ submitTeam(); }
        else if(location.protocol === 'file:' || !board.ws){ submitTeam(); }
        else { var n=0, iv=setInterval(function(){ if(board.ws && board.ws.readyState===1){ clearInterval(iv); submitTeam(); } else if(++n>30){ clearInterval(iv); submitTeam(); } }, 120); }
      }, 1000);
    }
  }

  function setCount(){ animateCount(document.getElementById('teamcount'), board.count); }

  function renderFeed(){
    var feed = document.getElementById('feed'); if(!feed) return;
    var list = board.feed.length ? board.feed : (OFFLINE ? seedFeed() : []);
    if(!list.length){
      feed.innerHTML = '<div class="feed-empty">No teams yet. Yours will be the first one on the board.</div>';
      return;
    }
    feed.innerHTML = list.slice(0,40).map(function(it){
      var dot = '<span class="fi-dot" style="background:'+HEART_COLOR+'"></span>';
      return '<div class="feed-item'+(it.mine?' me':'')+'"><div class="fi-team">'+dot+esc(it.team)+
        (it.mine?' <span class="when">· just now</span>':'')+'</div><div class="fi-commit">'+esc(it.commit||'')+'</div></div>';
    }).join('');
    feed.scrollTop = 0;
  }

  function buildDots(){
    var g = document.getElementById('teamdots'); if(!g || board.built) return; board.built = true;
    var known = board.feed.length ? board.feed : (OFFLINE ? seedFeed() : []);
    var pad = Math.min(210, Math.max(known.length, board.count));
    for(var i=0;i<pad;i++){ makeDot(g, (i<known.length)?known[i]:null, false, false); }
  }

  function makeDot(g, info, isMine, pop){
    var c = document.createElementNS(svgns,'circle');
    var x = isMine ? 100 : (12 + Math.random()*176);
    var y = isMine ? 82  : (16 + Math.random()*140);
    c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.style.cursor='pointer';
    if(isMine){
      c.setAttribute('r','6.5'); c.setAttribute('fill', HEART_COLOR);
      c.setAttribute('stroke','#fff'); c.setAttribute('stroke-width','2.2');
      popAnim(c,'0;10;6.5','0.9s');
      if(pop) sonarRing(g, x, y);
    } else {
      c.setAttribute('fill', dotColor(info && info.goal));
      c.setAttribute('opacity',(0.5+Math.random()*0.4).toFixed(2));
      var r = info ? (3.1+Math.random()*0.9) : (1.7+Math.random()*1.6);
      if(pop){ c.setAttribute('r','0'); popAnim(c,'0;'+(r+2).toFixed(1)+';'+r.toFixed(1),'0.7s'); } else c.setAttribute('r', r.toFixed(1));
    }
    if(info){ c.setAttribute('data-team', info.team + (isMine?' · your team':'')); if(info.commit) c.setAttribute('data-commit', info.commit); }
    g.appendChild(c);
  }
  function popAnim(c, values, dur){
    var an = document.createElementNS(svgns,'animate');
    an.setAttribute('attributeName','r'); an.setAttribute('values',values);
    an.setAttribute('keyTimes','0;0.6;1'); an.setAttribute('dur',dur); an.setAttribute('fill','freeze');
    c.appendChild(an);
  }
  // a soft ripple where the team's dot lands in the heart
  function sonarRing(g, x, y){
    var ring = document.createElementNS(svgns,'circle');
    ring.setAttribute('cx', x.toFixed(1)); ring.setAttribute('cy', y.toFixed(1));
    ring.setAttribute('r','5'); ring.setAttribute('fill','none');
    ring.setAttribute('stroke', HEART_COLOR); ring.setAttribute('stroke-width','2');
    var ar = document.createElementNS(svgns,'animate');
    ar.setAttribute('attributeName','r'); ar.setAttribute('values','5;30'); ar.setAttribute('dur','1s'); ar.setAttribute('fill','freeze');
    var ao = document.createElementNS(svgns,'animate');
    ao.setAttribute('attributeName','opacity'); ao.setAttribute('values','0.85;0'); ao.setAttribute('dur','1s'); ao.setAttribute('fill','freeze');
    ring.appendChild(ar); ring.appendChild(ao); g.appendChild(ring);
    setTimeout(function(){ if(ring.parentNode) ring.parentNode.removeChild(ring); }, 1100);
  }

  function arrive(item, count, isMine){
    if(typeof count === 'number') board.count = count; else board.count++;
    var entry = { team:(item&&item.team)||'A Mission Team', commit:(item&&item.commit)||'', goal:(item&&item.goal)||'', mine:!!isMine };
    board.feed.unshift(entry); if(board.feed.length>60) board.feed.pop();
    if(cur === 7){
      setCount(); renderFeed();
      var g = document.getElementById('teamdots');
      if(g && board.built) makeDot(g, {team:entry.team, commit:entry.commit, goal:entry.goal}, isMine, true);
      if(isMine){ var hw = document.querySelector('.screen[data-part="7"] .heartwrap'); if(hw){ hw.classList.remove('land'); void hw.offsetWidth; hw.classList.add('land'); } }
    }
  }

  function wireHover(){
    if(board.hoverWired) return;
    var g = document.getElementById('teamdots'); if(!g) return;
    var wrap = g.closest('.heartwrap'), tip = document.getElementById('dottip'); if(!wrap||!tip) return;
    board.hoverWired = true;
    g.addEventListener('mouseover', function(e){
      var t=e.target; if(t.tagName!=='circle') return;
      var team=t.getAttribute('data-team')||'A Mission Team across OSF', cm=t.getAttribute('data-commit');
      tip.innerHTML='<b>'+esc(team)+'</b>'+(cm?'<span class="c">'+esc(cm)+'</span>':'');
      var wr=wrap.getBoundingClientRect(), dr=t.getBoundingClientRect();
      tip.style.left=Math.min(Math.max(46,dr.left-wr.left+dr.width/2),wr.width-46)+'px';
      tip.style.top=(dr.top-wr.top-6)+'px'; tip.classList.add('show');
    });
    g.addEventListener('mouseout', function(e){ if(e.target.tagName==='circle') tip.classList.remove('show'); });
  }

  function flashCount(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function animateCount(el, target){
    if(!el) return;
    var start = Number((el.textContent||'0').replace(/[^0-9]/g,'')) || 0;
    if(start === target){ return; }
    var dur = Math.min(1000, 260 + Math.abs(target-start)*7), t0=null;
    function step(ts){ if(t0===null) t0=ts; var p=Math.min(1,(ts-t0)/dur); var eased=1-Math.pow(1-p,3);
      el.textContent = Math.round(start + (target-start)*eased).toLocaleString();
      if(p<1) requestAnimationFrame(step); else { el.textContent = target.toLocaleString(); flashCount(el); } }
    requestAnimationFrame(step);
  }

  // ---- print / restart ----
  document.getElementById('printBtn').addEventListener('click', function(){ window.print(); });
  var printBoardBtn = document.getElementById('printBoardBtn');
  if(printBoardBtn) printBoardBtn.addEventListener('click', function(){ window.print(); });
  document.getElementById('restartBtn').addEventListener('click', function(){
    teamDept.value=''; teamName.value=''; teamWork.value=''; reach.value='';
    Array.prototype.slice.call(commitList.querySelectorAll('.commit-item.commit-extra')).forEach(function(it){ it.parentNode.removeChild(it); });
    Array.prototype.slice.call(commitList.querySelectorAll('.commit-in')).forEach(function(t){ t.value=''; });
    selected.length=0;
    Array.prototype.slice.call(chipsBox.querySelectorAll('.chip.on')).forEach(function(c){ c.classList.remove('on'); });
    updateSel(); gateFinish(); gateReach(); toConn.disabled=true;
    board.submitted = false; board.feed.forEach(function(f){ f.mine=false; });
    show(0);
  });

  boardConnect();
  show(0);
})();
