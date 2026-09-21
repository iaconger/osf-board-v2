/* OSF LDI big-screen room mode. Read-only, live over WebSocket. No inline scripts (CSP).
   Incremental rendering: each leader is one persistent dot that pops in as they submit,
   then drifts. Count/ranking are authoritative from the server; the view self-heals via
   a periodic sync request so a shared screen stays accurate for the whole session. */
(function(){
  'use strict';
  var COMPS=[
    {name:'Model our Mission & Values',color:'#4E8209'},
    {name:'Personal Growth',color:'#64A70B'},
    {name:'Communicate Purposefully',color:'#007F9B'},
    {name:'Develop People',color:'#00A9CE'},
    {name:'Dynamic Collaborations',color:'#A5228E'},
    {name:'System Thinking',color:'#E57200'},
    {name:'Drive Transformation',color:'#5B4B8A'}
  ];
  var GOALS=[
    {key:'g1',name:'Excellence',color:'#4E8209'},
    {key:'g2',name:'One OSF Team',color:'#00A9CE'},
    {key:'g3',name:'Destination OSF',color:'#A5228E'}
  ];
  function compColor(n){for(var i=0;i<COMPS.length;i++)if(COMPS[i].name===n)return COMPS[i].color;return '#9aa';}
  var el=function(id){return document.getElementById(id);};
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}

  // OSF Region / Area → Entity taxonomy (same list as the sign-in + dashboard).
  var REGIONS=[
    {r:'Central',e:['OSF OnCall','Central Region - Peoria']},
    {r:'Eastern',e:['SHMC - Urbana/Danville','LCMMC - Evergreen Park','SFH - Escanaba','SJJWAMC & SJMC - Pontiac & Bloomington']},
    {r:'MG, HomeCare, Rehab',e:['Home Care & Rehab','OSF MG']},
    {r:'N/A',e:['Ministry Services - HR, Foundation']},
    {r:'Professional Services',e:['Ministry Services - Clinical Excellence Team','Ministry Services - Finance','Ministry Services - Innovation Strategy','Ministry Services - Mission Services','Ministry Services - Pointcore']},
    {r:'Western',e:['I-80 - SEMC Ottawa / SPMC Mendota / SCMC Princeton','SAHC - Alton','SAMC - Rockford','SKMC - Dixon','WCIM - SMMC/HFMC Galesburg / SLMC Kewanee']}
  ];
  function entitiesFor(r){for(var i=0;i<REGIONS.length;i++)if(REGIONS[i].r===r)return REGIONS[i].e;return [];}

  // Active scope for this screen (one region/entity per session). Read from the URL first
  // (?region=...&entity=...) so a scoped link/QR self-applies, then editable via the picker.
  var FILT={region:'',entity:''};
  (function(){
    try{
      var q=new URLSearchParams(location.search);
      var r=q.get('region')||'';var en=q.get('entity')||'';
      for(var i=0;i<REGIONS.length;i++){if(REGIONS[i].r===r){FILT.region=r;if(REGIONS[i].e.indexOf(en)>=0)FILT.entity=en;break;}}
    }catch(e){/* no URLSearchParams => leave unscoped */}
  })();
  function filterActive(){return !!(FILT.region||FILT.entity);}
  function matchFilter(card){
    if(!card)return false;
    if(FILT.region&&String(card.region||'')!==FILT.region)return false;
    if(FILT.entity&&String(card.entity||'')!==FILT.entity)return false;
    return true;
  }

  // ---- state ----
  var cards={};            // id -> card (deduped)
  var nodes={};            // id -> dot element
  var order=[];            // ids in arrival order
  var ticker=[];           // recent {color,label} newest first
  var shownCount=0;        // number currently displayed in the counter
  var targetCount=0;       // authoritative count from server
  var milestoneAt=0;       // highest milestone already celebrated
  var seeding=false;       // true during the first snapshot, to suppress retroactive milestones
  var filteredCount=0;     // authoritative count for the active scope (when a region/entity is set)
  var MAX_DOTS=500;        // safety cap for the animated layer
  var MILESTONES=[10,25,50,100,150,200,250,300,400,500];

  // stable pseudo-random position from the card id (so dots don't jump on resync)
  function hash(str){var h=2166136261>>>0;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function pos(id){
    var s=hash(String(id));function r(){s=(Math.imul(s,1103515245)+12345)&0x7fffffff;return s/0x7fffffff;}
    return {x:7+r()*86,y:12+r()*80,sz:Math.round(15+r()*15),dur:(5+r()*5).toFixed(2),delay:(-r()*6).toFixed(2)};
  }

  function makeDot(card){
    var name=(card.comps&&card.comps[0])?card.comps[0].name:COMPS[0].name;
    var col=compColor(name);var p=pos(card.id);
    var d=document.createElement('div');d.className='bd';d.setAttribute('data-id',card.id);
    d.style.left=p.x+'%';d.style.top=p.y+'%';
    d.style.setProperty('--c',col);d.style.setProperty('--sz',p.sz+'px');
    d.style.setProperty('--dur',p.dur+'s');d.style.setProperty('--delay',p.delay+'s');
    d.innerHTML='<span class="ring"></span><span class="core"></span>';
    d._x=p.x;d._y=p.y;d._color=col;d._name=name;
    return d;
  }
  function showCallout(card,d){
    var name=d._name;var who=card.first?esc(card.first):'A leader';
    var sub=[card.role,card.division].filter(Boolean).map(esc).join(' · ');
    var c=document.createElement('div');c.className='callout';
    c.style.left=d._x+'%';c.style.top=d._y+'%';
    c.innerHTML='<span class="cdot" style="background:'+d._color+'"></span><span><b>'+who+'</b>'+(sub?' · '+sub:'')+'</span>';
    el('canvas').appendChild(c);
    setTimeout(function(){ if(c.parentNode)c.parentNode.removeChild(c); },4100);
  }
  // add a dot if we don't already have it. animate=true => spawn pop + callout + ticker
  function ensureDot(card,animate){
    if(!card||!card.id||nodes[card.id]) return false;
    cards[card.id]=card;order.push(card.id);
    if(order.length>MAX_DOTS){ // keep the layer bounded; oldest dot retires (count is authoritative anyway)
      var oldId=order.shift();var oldEl=nodes[oldId];if(oldEl&&oldEl.parentNode)oldEl.parentNode.removeChild(oldEl);delete nodes[oldId];
    }
    var d=makeDot(card);nodes[card.id]=d;
    el('canvas').appendChild(d);
    if(animate){
      d.classList.add('spawn');
      setTimeout(function(){d.classList.remove('spawn');},1200);
      showCallout(card,d);
      pushTicker(card);
    }
    return true;
  }

  function pushTicker(card){
    var name=(card.comps&&card.comps[0])?card.comps[0].name:'';
    var who=card.first?card.first:(card.role||'A leader');
    var sub=[card.role,card.division].filter(function(x){return x&&x!==card.first;}).join(' · ');
    var label=(sub?who+' · '+sub:who)+'  →  '+name;
    ticker.unshift({color:compColor(name),label:label});
    if(ticker.length>10)ticker.pop();
    renderTicker();
  }
  function renderTicker(){
    el('ticker').innerHTML=ticker.slice(0,7).map(function(t,i){
      return '<span class="item'+(i===0?' newest':'')+'"><span class="dot" style="background:'+t.color+'"></span>'+esc(t.label)+'</span>';
    }).join('');
  }

  function renderRanking(){
    var score={};COMPS.forEach(function(c){score[c.name]=0;});
    order.forEach(function(id){ (cards[id].comps||[]).forEach(function(c){ if(score[c.name]!==undefined) score[c.name]+=(c.rank===1?2:1); }); });
    var arr=COMPS.map(function(c){return {name:c.name,color:c.color,v:score[c.name]};}).sort(function(a,b){return b.v-a.v;});
    var max=arr[0].v||1;
    var host=el('ranking');
    // build once, then just update widths/values so the bars animate smoothly
    if(!host._built){
      host.innerHTML=COMPS.map(function(){return '<div class="rk"><div class="rl"><span class="dot"></span><span class="nm"></span><span class="v"></span></div><div class="track"><div class="fill"></div></div></div>';}).join('');
      host._built=true;host._rows=host.querySelectorAll('.rk');
    }
    arr.forEach(function(a,i){
      var row=host._rows[i];if(!row)return;
      row.querySelector('.dot').style.background=a.color;
      row.querySelector('.nm').textContent=a.name;
      row.querySelector('.v').textContent=a.v;
      var fill=row.querySelector('.fill');
      fill.style.background=a.color;fill.style.width=Math.round(a.v/max*100)+'%';
    });
  }

  // ---- counter tween ----
  function tickCounter(){
    if(shownCount===targetCount){el('count').textContent=targetCount.toLocaleString();return;}
    var diff=targetCount-shownCount;
    var step=Math.max(1,Math.ceil(Math.abs(diff)/12));
    shownCount+=(diff>0?step:-step);
    if((diff>0&&shownCount>targetCount)||(diff<0&&shownCount<targetCount)) shownCount=targetCount;
    el('count').textContent=Math.max(0,shownCount).toLocaleString();
    if(shownCount!==targetCount) requestAnimationFrame(tickCounter);
  }
  function setCount(n){
    if(typeof n!=='number'||!isFinite(n))return;
    if(n>targetCount) checkMilestone(n);
    var was=targetCount;targetCount=n;
    if(seeding){ shownCount=n; el('count').textContent=n.toLocaleString(); return; } // land on the real number instantly on load (no restart-from-0)
    if(was!==n) requestAnimationFrame(tickCounter);
  }
  function checkMilestone(n){
    var hit=0;for(var i=0;i<MILESTONES.length;i++){if(n>=MILESTONES[i]&&MILESTONES[i]>milestoneAt)hit=MILESTONES[i];}
    if(hit){milestoneAt=hit; if(!seeding) flashMilestone(hit);}
  }
  function flashMilestone(n){
    el('msbig').textContent=n+' leaders';el('mssub').textContent='and counting';
    var m=el('milestone');m.classList.remove('show');void m.offsetWidth;m.classList.add('show');
  }

  function refreshEmpty(){ el('empty').style.display=order.length?'none':'flex'; }

  // wipe the board (used when the active region/entity scope changes)
  function resetBoard(){
    var cv=el('canvas'); if(cv){ var ds=cv.querySelectorAll('.bd'); for(var i=0;i<ds.length;i++)cv.removeChild(ds[i]); }
    cards={};nodes={};order=[];filteredCount=0;milestoneAt=0;
    var host=el('ranking'); if(host){host._built=false;host.innerHTML='';}
    renderRanking();refreshEmpty();
  }

  // reconcile a feed (init or periodic sync). animate only genuinely-new ids after first load.
  // serverFiltered=true means the server already scoped feed+count to the active region/entity.
  var firstLoad=true;
  function reconcile(feed,count,serverFiltered){
    var list=(feed||[]).filter(matchFilter);
    if(firstLoad) seeding=true;
    list.forEach(function(card){ ensureDot(card,!firstLoad); });
    if(filterActive()){
      filteredCount=(serverFiltered&&typeof count==='number')?count:list.length;
      setCount(filteredCount);
    } else {
      setCount(typeof count==='number'?count:order.length);
    }
    seeding=false;
    renderRanking();refreshEmpty();
    firstLoad=false;
  }

  // ---- WebSocket ----
  var ws=null,syncTimer=null;
  function setLive(on){
    var l=el('live');if(!l)return;
    l.classList.toggle('off',!on);
    el('livetext').textContent=on?'Live':'Reconnecting…';
  }
  function connect(){
    try{ var proto=location.protocol==='https:'?'wss:':'ws:'; ws=new WebSocket(proto+'//'+location.host); }catch(e){ setLive(false); setTimeout(connect,2500); return; }
    ws.onopen=function(){ setLive(true); if(filterActive()) requestSync(); };
    ws.onmessage=function(ev){ var d; try{d=JSON.parse(ev.data);}catch(e){return;}
      if(d.type==='init'){ reconcile(d.feed, typeof d.count==='number'?d.count:undefined, d.filtered===true); }
      else if(d.type==='add'){
        if(!d.item)return;
        if(filterActive()){
          if(matchFilter(d.item)){
            var isNew=ensureDot(d.item,true);
            if(isNew){ filteredCount+=1; renderRanking(); refreshEmpty(); setCount(filteredCount); }
          }
          // submissions outside this screen's region/entity are ignored here
        } else {
          var isNew2=ensureDot(d.item,true);
          if(isNew2){ renderRanking(); refreshEmpty(); }
          setCount(typeof d.count==='number'?d.count:targetCount+1);
        }
      }
      // reactions are ignored on the screen view
    };
    ws.onclose=function(){ setLive(false); setTimeout(connect,2500); };
    ws.onerror=function(){ setLive(false); try{ws.close();}catch(e){} };
  }
  // ask the server for a fresh snapshot (scoped to the active region/entity, if any)
  function requestSync(){
    if(ws&&ws.readyState===1){ try{ws.send(JSON.stringify({type:'sync',region:FILT.region,entity:FILT.entity}));}catch(e){} }
  }
  // periodic self-heal: in case a frame was missed, and to keep a scoped count authoritative
  function startSync(){
    if(syncTimer)clearInterval(syncTimer);
    syncTimer=setInterval(requestSync,20000);
  }

  // ---- dot detail popover (hover to preview, click to pin) ----
  var pinnedId=null;
  function popHTML(card){
    var who=card.first?esc(card.first):'A leader';
    var role=[card.role,card.division].filter(Boolean).map(esc).join(' · ');
    var comps=(card.comps||[]).map(function(c){var col=compColor(c.name);return '<div class="pc"><span class="r" style="background:'+col+'">'+c.rank+'</span>'+esc(c.name)+'</div>';}).join('');
    var sk=(card.skills&&card.skills.length)?('<div class="lb">Strengthening</div><div class="sk">'+card.skills.map(esc).join(' · ')+'</div>'):'';
    var gg=card.goals||{};
    var gl=GOALS.filter(function(g){return gg[g.key];}).map(function(g){
      return '<div class="gl"><b style="color:'+g.color+'">'+esc(g.name)+':</b> '+esc(gg[g.key])+'</div>';
    }).join('');
    var goalsBlock=gl?('<div class="lb">Advancing the goals</div>'+gl):'';
    var nt=card.approach?('<div class="nt">'+esc(card.approach)+'</div>'):'';
    return '<div class="who">'+who+'</div>'+(role?'<div class="role">'+role+'</div>':'')+'<div class="lb">Focusing on</div>'+comps+sk+goalsBlock+nt;
  }
  function positionPop(d){
    var r=d.getBoundingClientRect();var pop=el('dotpop');
    pop.style.left=Math.min(Math.max(r.left+r.width/2,165),window.innerWidth-165)+'px';
    if(r.top<210){pop.classList.add('below');pop.style.top=r.bottom+'px';}
    else{pop.classList.remove('below');pop.style.top=r.top+'px';}
  }
  function showPop(d){var card=cards[d.getAttribute('data-id')];if(!card)return;var pop=el('dotpop');pop.innerHTML=popHTML(card);positionPop(d);pop.classList.add('show');}
  function hidePop(){el('dotpop').classList.remove('show');}
  function clearActive(){var a=el('canvas').querySelector('.bd.active');if(a)a.classList.remove('active');}
  (function(){
    var cv=el('canvas');if(!cv)return;
    cv.addEventListener('mousemove',function(e){if(pinnedId)return;var d=e.target.closest('.bd');if(d)showPop(d);else hidePop();});
    cv.addEventListener('mouseleave',function(){if(!pinnedId)hidePop();});
    // click a dot toggles its pinned popover; click anywhere else dismisses it
    document.addEventListener('click',function(e){
      var d=e.target.closest?e.target.closest('#canvas .bd'):null;
      if(d){var id=d.getAttribute('data-id');clearActive();if(pinnedId===id){pinnedId=null;hidePop();}else{pinnedId=id;d.classList.add('active');showPop(d);}}
      else{if(pinnedId){pinnedId=null;clearActive();}hidePop();}
    });
    // any scroll dismisses the popover (it would otherwise detach from the dot)
    window.addEventListener('scroll',function(){if(pinnedId){pinnedId=null;clearActive();}hidePop();},true);
  })();

  // ---- join QR (carries the active region/entity so scanners are pre-tagged for this session) ----
  function buildQR(){
    var q='';
    if(FILT.region){ q='?region='+encodeURIComponent(FILT.region); if(FILT.entity) q+='&entity='+encodeURIComponent(FILT.entity); }
    var url=location.origin+'/'+q;
    var disp=location.origin.replace(/^https?:\/\//,'').replace(/\/$/,''); // show the clean domain; the QR carries the scope
    var u=el('joinurl');if(u)u.textContent=disp;
    try{
      if(typeof qrcode==='function'){
        var qr=qrcode(0,'M');qr.addData(url);qr.make();
        el('qr').innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true});
      }
    }catch(e){/* QR is a nicety; ignore if it fails */}
  }

  // ---- scope chrome + picker ----
  function scopeLabel(){ if(FILT.entity)return FILT.entity; if(FILT.region)return FILT.region+(FILT.region==='N/A'?'':' Region'); return ''; }
  function updateChrome(){
    var eb=el('eyebrow'); if(eb) eb.textContent='FY27 Q1 · '+(filterActive()?scopeLabel():'Leadership Development Institute');
    var rl=document.querySelector('.ranklabel'); if(rl) rl.textContent=filterActive()?scopeLabel():'The room';
    var empty=el('empty'); if(empty){ var big=empty.querySelector('.big'); if(big) big.textContent=filterActive()?('Waiting for the first leader in '+scopeLabel()+'…'):'Waiting for the first leader…'; }
    buildQR();
  }
  function fillEntities(){
    var es=el('scopeEnt'); if(!es)return;
    var ents=FILT.region?entitiesFor(FILT.region):[];
    es.innerHTML='<option value="">All entities</option>'+ents.map(function(en){return '<option value="'+esc(en)+'">'+esc(en)+'</option>';}).join('');
    es.setAttribute('data-empty', ents.length?'0':'1'); // hidden until a region is chosen
  }
  function onScopeChange(){
    try{
      var q=new URLSearchParams();
      if(FILT.region)q.set('region',FILT.region);
      if(FILT.entity)q.set('entity',FILT.entity);
      var qs=q.toString();
      history.replaceState(null,'',location.pathname+(qs?('?'+qs):''));
    }catch(e){/* older browser: URL stays as-is */}
    resetBoard(); firstLoad=true; updateChrome();
    requestSync(); setTimeout(requestSync,2200); // beat the server sync throttle on rapid switches
  }
  function populateScope(){
    var rs=el('scopeSel'), es=el('scopeEnt'); if(!rs||!es)return;
    rs.innerHTML='<option value="">All regions</option>'+REGIONS.map(function(x){return '<option value="'+esc(x.r)+'">'+esc(x.r)+'</option>';}).join('');
    rs.value=FILT.region||'';
    fillEntities(); es.value=FILT.entity||'';
    rs.addEventListener('change',function(){ FILT.region=rs.value; FILT.entity=''; fillEntities(); es.value=''; onScopeChange(); });
    es.addEventListener('change',function(){ FILT.entity=es.value; onScopeChange(); });
  }

  populateScope();
  updateChrome();
  renderRanking();refreshEmpty();
  connect();startSync();
})();
