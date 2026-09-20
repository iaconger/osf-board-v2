/* OSF LDI Leaders' app. Participant experience.
 * Guided flow → live shared board over WebSocket. No inline scripts (CSP). */
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
  var SKILLS=[
    ['Values-Driven Leadership','Our unique approach to leadership where the Values of OSF HealthCare are consistently demonstrated through our decisions, actions and strategies.'],
    ['Purposeful Compassion','Intentionally leveraging our Compassion Framework to consistently demonstrate care for others while maintaining a focus on outcomes.'],
    ['Ethical Stewardship','Taking responsibility for resources, people and decisions in a way that prioritizes equity, sustainability and long-term well-being.'],
    ['Operational Integrity','Ensuring all processes, decisions and action across the Ministry are carried out with a standard of excellence and in alignment with our Values.'],
    ['Emotional Intelligence: Self-Awareness','Recognizing and understanding your own emotions, beliefs, biases, and behaviors, and how they impact others.'],
    ['Emotional Intelligence: Self-Management','Regulating your thoughts, emotions, behaviors, and impulses, especially in challenging situations.'],
    ['Feedback','Proactively gathering input from diverse groups, listening openly, and applying concepts to improve your leadership practice and overall outcomes.'],
    ['Learning Agility','Quickly learning from experiences, adapting to new situations, and applying insights to solve unfamiliar problems.'],
    ['Active Listening','Wholly focusing on, working to understand, and responding thoughtfully to what others are saying.'],
    ['Clarity & Transparency','Communicating information, expectations, and decisions openly and in a way that reduces confusion and builds trust.'],
    ['Constructive Communication','Navigating differences in a way that maintains respect, builds alignment, and moves toward solutions.'],
    ['Strategic Alignment','Accurately connecting goals, actions, and decisions to the broader vision and strategy of OSF HealthCare.'],
    ['Clear Expectations','Defining roles, responsibilities, and performance standards in a way that is specific and understandable.'],
    ['Compassionate Accountability','Applying our Compassion Framework when holding others responsible for their commitments and performance.'],
    ['Coaching for Growth','Artfully guiding, challenging, and supporting others in developing their skills and potential through feedback, questioning, and encouragement.'],
    ['Performance Analytics','Consistently leveraging appropriate data and metrics to assess progress, identify trends, and inform decisions that support individual and team development.'],
    ['Continuous Improvement','Identifying ways to enhance processes, performance, and outcomes through reflection, feedback, and innovation.'],
    ['Emotional Intelligence: Social Awareness','Understanding and empathizing with the emotions, needs, and dynamics of others through sensitivity to interpersonal and organizational contexts.'],
    ['Emotional Intelligence: Relationship Management','Building, maintaining, and strengthening positive connections with others by fostering alignment, resolving conflict constructively and inspiring shared success.'],
    ['Cross-Functional Collaboration','Convening individuals and/or teams from different departments, backgrounds, or areas of expertise to work toward shared goals.'],
    ['Diversity & Inclusion','Actively creates an environment where diverse perspectives are valued, respected, and leveraged for collaborative solutions.'],
    ['Data-Informed Planning','Leveraging relevant data and insights, alongside experience and judgment, to guide choices and strategies.'],
    ['Business Acumen',"Understanding the Ministry's financial, operational, and strategic drivers and how they are interconnected."],
    ['Process Optimization','Analyzing workflows, identifying inefficiencies, and implementing improvements that enhance quality, speed, and effectiveness across functions.'],
    ['Strategic Foresight','Anticipating future trends, challenges, and opportunities and preparing proactive strategies to address them.'],
    ['Cultivating Innovation','Creating an environment where new ideas are encouraged, tested, and transformed into solutions that drive progress.'],
    ['Inspires Change','Communicating a compelling vision, motivating others to embrace new ways of working, and guiding them through transitions with confidence and clarity.'],
    ['Strategic Execution','Turning vision and strategy into actionable plans that deliver results through disciplined implementation.']
  ];
  var GOALS=[
    {key:'g1',name:'Excellence',color:'#4E8209'},
    {key:'g2',name:'One OSF Team',color:'#00A9CE'},
    {key:'g3',name:'Destination OSF',color:'#A5228E'}
  ];
  var GOAL_MAX=200;
  // OSF Region / Entity standard list
  var REGIONS=[
    {r:'Central', e:['OSF OnCall','Central Region - Peoria']},
    {r:'Eastern', e:['SHMC - Urbana/Danville','LCMMC - Evergreen Park','SFH - Escanaba','SJJWAMC & SJMC - Pontiac & Bloomington']},
    {r:'MG, HomeCare, Rehab', e:['Home Care & Rehab','OSF MG']},
    {r:'N/A', e:['Ministry Services - HR, Foundation']},
    {r:'Professional Services', e:['Ministry Services - Clinical Excellence Team','Ministry Services - Finance','Ministry Services - Innovation Strategy','Ministry Services - Mission Services','Ministry Services - Pointcore']},
    {r:'Western', e:['I-80 - SEMC Ottawa / SPMC Mendota / SCMC Princeton','SAHC - Alton','SAMC - Rockford','SKMC - Dixon','WCIM - SMMC/HFMC Galesburg / SLMC Kewanee']}
  ];
  function entitiesFor(r){for(var i=0;i<REGIONS.length;i++)if(REGIONS[i].r===r)return REGIONS[i].e;return [];}
  function allEntities(){var a=[];REGIONS.forEach(function(x){a=a.concat(x.e);});return a;}
  function fillRegion(sel,allLabel){if(!sel)return;sel.innerHTML='<option value="">'+allLabel+'</option>';REGIONS.forEach(function(x){var o=document.createElement('option');o.value=x.r;o.textContent=x.r;sel.appendChild(o);});}
  function fillEntity(sel,region,allLabel){if(!sel)return;var list=region?entitiesFor(region):allEntities();sel.innerHTML='<option value="">'+allLabel+'</option>';list.forEach(function(en){var o=document.createElement('option');o.value=en;o.textContent=en;sel.appendChild(o);});}
  function compByName(n){for(var i=0;i<COMPS.length;i++)if(COMPS[i].name===n)return COMPS[i];return COMPS[0];}
  var el=function(id){return document.getElementById(id);};
  var pickedComp=[], pickedSkill=[];
  var boardData=[];      // array of comps arrays from other leaders (via WS)
  var mine=null;         // this leader's comps once accepted
  var submitted=false;
  var reacted={};        // cardId -> kind this viewer already reacted with (one per card)

  // ---- competency chips ----
  var cg=el('compGrid');
  COMPS.forEach(function(c){
    var b=document.createElement('div');b.className='chip';b.setAttribute('data-name',c.name);
    b.innerHTML='<span class="dot" style="background:'+c.color+'"></span>'+c.name+'<span class="rank"></span>';
    b.addEventListener('click',function(){toggleComp(c.name);});
    cg.appendChild(b);
  });
  function toggleComp(name){
    var i=pickedComp.indexOf(name);
    if(i>=0){pickedComp.splice(i,1);} else {if(pickedComp.length>=2)return; pickedComp.push(name);}
    [].forEach.call(cg.children,function(ch){
      var n=ch.getAttribute('data-name');var idx=pickedComp.indexOf(n);
      ch.classList.toggle('sel',idx>=0);
      var rk=ch.querySelector('.rank');rk.textContent=idx>=0?(idx+1):''; rk.style.background=idx>=0?compByName(n).color:'';
    });
    el('compCount').textContent=pickedComp.length+' of 2 selected';
    el('compNext').disabled=pickedComp.length===0;
  }

  // ---- skills ----
  var sl=el('skillList');
  SKILLS.forEach(function(s){
    var d=document.createElement('div');d.className='skill';d.setAttribute('data-name',s[0]);
    d.innerHTML='<div class="sh"><span class="ck">✓</span>'+s[0]+'</div><div class="sd">'+s[1]+'</div>';
    d.addEventListener('click',function(){toggleSkill(s[0],d);});
    sl.appendChild(d);
  });
  function toggleSkill(name,d){
    var i=pickedSkill.indexOf(name);
    if(i>=0){pickedSkill.splice(i,1);} else {if(pickedSkill.length>=3)return; pickedSkill.push(name);}
    d.classList.toggle('sel',pickedSkill.indexOf(name)>=0);
    el('skillCount').textContent=pickedSkill.length+' of 3 selected';
    el('skillNext').disabled=pickedSkill.length===0;
  }

  // ---- strategic goal commitments (one action per goal) ----
  var gf=el('goalFields');
  if(gf){
    GOALS.forEach(function(g){
      var wrap=document.createElement('div');wrap.className='goalfield';
      wrap.innerHTML='<div class="gh"><span class="gdot" style="background:'+g.color+'"></span>'+g.name+'</div>'+
        '<textarea id="goal_'+g.key+'" maxlength="'+GOAL_MAX+'" rows="2" placeholder="One action you will prioritize to advance '+g.name+'…"></textarea>'+
        '<div class="gc" id="gc_'+g.key+'"><b>0</b> / '+GOAL_MAX+'</div>';
      gf.appendChild(wrap);
      var ta=wrap.querySelector('textarea'), cc=wrap.querySelector('.gc');
      ta.addEventListener('input',function(){cc.innerHTML='<b>'+ta.value.length+'</b> / '+GOAL_MAX;});
    });
  }
  function collectGoals(){
    var out={};
    GOALS.forEach(function(g){var ta=el('goal_'+g.key);out[g.key]=ta?ta.value.trim():'';});
    return out;
  }

  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}

  // board filters: region + entity (applies to constellation, ranking, count, explore)
  function boardFiltered(){
    var rgn=el('bRegion')?el('bRegion').value:''; var ent=el('bEntity')?el('bEntity').value:'';
    return boardData.filter(function(c){
      if(rgn && (c.region||'')!==rgn) return false;
      if(ent && (c.entity||'')!==ent) return false;
      return true;
    });
  }

  function renderFocus(){
    var fn=el('fn').value.trim(),ln=el('ln').value.trim();
    var who=(fn||ln)?esc((fn+' '+ln).trim()):'Your leadership focus';
    var role=el('role').value||'Leader';var div=el('div').value.trim();
    var roleLine=[role,div].filter(Boolean).map(esc).join('  ·  ');
    var prio=pickedComp.map(function(n,idx){var c=compByName(n);
      return '<div class="p"><span class="n" style="background:'+c.color+'">'+(idx+1)+'</span><span class="dot" style="background:'+c.color+'"></span>'+esc(n)+'</div>';}).join('');
    var sk=pickedSkill.map(function(n){return '<span class="sktag">'+esc(n)+'</span>';}).join('');
    var ap=(el('approach')?el('approach').value.trim():'');
    var apBlock=ap?('<div class="lbl">How I\'ll work on it</div><div class="approach">'+esc(ap)+'</div>'):'';
    var goals=collectGoals();
    var gitems=GOALS.filter(function(g){return goals[g.key];}).map(function(g){
      return '<div class="gitem" style="border-left-color:'+g.color+'"><div class="gt" style="color:'+g.color+'">'+esc(g.name)+'</div><div class="gv">'+esc(goals[g.key])+'</div></div>';
    }).join('');
    var goalBlock=gitems?('<div class="lbl">My commitments to the strategic goals</div><div class="goals">'+gitems+'</div>'):'';
    el('focusCard').innerHTML=
      '<div class="top"><div class="who">'+who+'</div><div class="role">'+(roleLine||'Leader')+'</div></div>'+
      '<div class="body">'+goalBlock+'<div class="lbl">Competencies I\'m focusing on</div><div class="prio">'+(prio||'<span class="note">None selected</span>')+'</div>'+
      '<div class="lbl">Skills I\'ll strengthen</div><div class="sklist">'+(sk||'<span class="note">None selected</span>')+'</div>'+apBlock+'</div>';
  }

  function renderBoard(){
    var all=boardFiltered();
    var cv=el('canvas');cv.innerHTML='';
    var seed=99;function r(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}
    all.forEach(function(card){
      var comps=card.comps||[];
      var name=comps[0]?comps[0].name:COMPS[0].name;
      var c=compByName(name);var d=document.createElement('div');
      var isMine=(mine&&card.id===mine.id);var size=isMine?26:(11+r()*8);
      d.className='bd'+(isMine?' mine':'');
      d.setAttribute('data-id',card.id);
      d.style.width=size+'px';d.style.height=size+'px';d.style.background=c.color;d.style.color=c.color;
      d.style.left=(8+r()*84)+'%';d.style.top=(10+r()*80)+'%';
      cv.appendChild(d);
    });
    var score={};COMPS.forEach(function(c){score[c.name]=0;});
    all.forEach(function(card){ (card.comps||[]).forEach(function(c){ if(score[c.name]!==undefined) score[c.name]+= (c.rank===1?2:1); }); });
    var arr=COMPS.map(function(c){return {name:c.name,color:c.color,v:score[c.name]};}).sort(function(a,b){return b.v-a.v;});
    var max=arr[0].v||1;
    el('leaderboard').innerHTML=arr.map(function(a){
      var w=Math.round(a.v/max*100);
      return '<div class="rk"><div class="rl"><span class="dot" style="background:'+a.color+'"></span>'+a.name+'</div>'+
        '<div style="font-weight:800;font-size:13px">'+a.v+'</div>'+
        '<div class="track"><div class="fill" style="width:'+w+'%;background:'+a.color+'"></div></div></div>';
    }).join('');
    el('kLeaders').textContent=all.length;
    el('kTop').textContent=arr[0].v?arr[0].name:'…';
  }

  // ---- explore wall ----
  function findCard(id){for(var i=0;i<boardData.length;i++)if(boardData[i].id===id)return boardData[i];return null;}
  function renderExplore(){
    var wall=el('exwall'); if(!wall) return;
    var fc=el('exComp')?el('exComp').value:''; var q=(el('exSearch')?el('exSearch').value:'').trim().toLowerCase();
    var list=boardFiltered().filter(function(card){
      if(fc && !(card.comps||[]).some(function(c){return c.name===fc;})) return false;
      if(q){ var hay=[card.first,card.division,card.region,card.entity,card.role].concat((card.comps||[]).map(function(c){return c.name;})).concat(card.skills||[]).join(' ').toLowerCase(); if(hay.indexOf(q)<0) return false; }
      return true;
    }).slice().reverse();
    if(!list.length){ wall.innerHTML='<div class="exempty">No matches yet.</div>'; return; }
    wall.innerHTML=list.map(function(card){
      var who=card.first?esc(card.first):'A leader';
      var rl=[card.role,card.division].filter(Boolean).map(esc).join(' · ');
      var comps=(card.comps||[]).map(function(c){var col=compByName(c.name).color;return '<span class="ec"><span class="n" style="background:'+col+'">'+c.rank+'</span><span class="dot" style="background:'+col+'"></span>'+esc(c.name)+'</span>';}).join('');
      var sk=(card.skills||[]).length?('<div class="esk">'+(card.skills||[]).map(esc).join('  ·  ')+'</div>'):'';
      var gg=card.goals||{};
      var egoals=GOALS.filter(function(g){return gg[g.key];}).map(function(g){
        return '<div class="eg"><b style="color:'+g.color+'">'+esc(g.name)+':</b> '+esc(gg[g.key])+'</div>';
      }).join('');
      var goalsBlock=egoals?('<div class="egoals">'+egoals+'</div>'):'';
      var ap=card.approach?('<div class="eapproach">'+esc(card.approach)+'</div>'):'';
      var rk=card.react||{heart:0,clap:0};
      var done=reacted[card.id]; var dis=done?' disabled':'';
      return '<div class="excard" data-id="'+esc(card.id)+'">'+
        '<div class="eid"><b>'+who+'</b>'+(rl?' <span>· '+rl+'</span>':'')+'</div>'+
        '<div class="ecomps">'+comps+'</div>'+sk+goalsBlock+ap+
        '<div class="erow'+(done?' reacted':'')+'">'+
          '<button class="react'+(done==='heart'?' chosen':'')+'" data-react="heart" data-id="'+esc(card.id)+'"'+dis+'>❤️ <span class="cnt">'+rk.heart+'</span></button>'+
          '<button class="react'+(done==='clap'?' chosen':'')+'" data-react="clap" data-id="'+esc(card.id)+'"'+dis+'>👏 <span class="cnt">'+rk.clap+'</span></button>'+
        '</div></div>';
    }).join('');
  }
  function updateReactionCounts(id){
    var card=findCard(id); var wall=el('exwall'); if(!card||!wall) return;
    var cardEl=wall.querySelector('.excard[data-id="'+id+'"]'); if(!cardEl) return;
    var hb=cardEl.querySelector('[data-react="heart"] .cnt'); var cb=cardEl.querySelector('[data-react="clap"] .cnt');
    if(hb)hb.textContent=card.react.heart; if(cb)cb.textContent=card.react.clap;
  }
  function refreshBoardViews(){ if(isOn(6)){ renderBoard(); renderExplore(); } }

  // ---- WebSocket ----
  var ws=null, wsReady=false;
  function connect(){
    try{
      var proto=location.protocol==='https:'?'wss:':'ws:';
      ws=new WebSocket(proto+'//'+location.host);
    }catch(e){ return; }
    ws.onopen=function(){ wsReady=true; };
    ws.onmessage=function(ev){
      var d; try{d=JSON.parse(ev.data);}catch(e){return;}
      if(d.type==='init'){ boardData=(d.feed||[]).slice(); refreshBoardViews(); }
      else if(d.type==='add'){ if(d.item) boardData.push(d.item); refreshBoardViews(); }
      else if(d.type==='accepted'){ if(d.item){ mine=d.item; boardData.push(d.item); } submitted=true; refreshBoardViews(); }
      else if(d.type==='reactions'){ var c=findCard(d.id); if(c){ c.react={heart:d.heart,clap:d.clap}; updateReactionCounts(d.id); } }
    };
    ws.onclose=function(){ wsReady=false; setTimeout(connect,2500); };
    ws.onerror=function(){ try{ws.close();}catch(e){} };
  }
  function isOn(s){var el2=document.querySelector('.step[data-s="'+s+'"]');return el2&&el2.classList.contains('on');}
  function sendSubmit(){
    if(submitted) return;
    var payload={ type:'submit',
      first:el('fn').value.trim(), last:el('ln').value.trim(),
      division:el('div').value.trim(), role:el('role').value, years:el('yrs').value,
      region:(el('region')?el('region').value:''), entity:(el('entity')?el('entity').value:''),
      comps:pickedComp.map(function(n){return {name:n};}), skills:pickedSkill.slice(),
      goals:collectGoals(),
      approach:(el('approach')?el('approach').value.trim():'') };
    var attempts=0;
    (function trySend(){
      if(ws&&ws.readyState===1){ ws.send(JSON.stringify(payload)); }
      else if(attempts++<8){ setTimeout(trySend,400); }
      // if it never connects, mine falls back locally on accepted-timeout below
    })();
    // local fallback so the board still shows the person even if the socket is slow
    setTimeout(function(){ if(!submitted){ mine={id:'local-'+Date.now(),first:el('fn').value.trim(),division:el('div').value.trim(),region:(el('region')?el('region').value:''),entity:(el('entity')?el('entity').value:''),role:el('role').value,comps:pickedComp.map(function(n,i){return {name:n,rank:i+1};}),skills:pickedSkill.slice(),goals:collectGoals(),approach:(el('approach')?el('approach').value.trim():''),react:{heart:0,clap:0}}; boardData.push(mine); submitted=true; refreshBoardViews(); } }, 3500);
  }

  // ---- save card as image ----
  var saveBtn=el('saveImg');
  if(saveBtn){
    saveBtn.addEventListener('click',function(){
      var card=el('focusCard'); if(!card||typeof window.html2canvas!=='function'){return;}
      saveBtn.disabled=true; var old=saveBtn.textContent; saveBtn.textContent='Preparing…';
      window.html2canvas(card,{backgroundColor:'#ffffff',scale:2,useCORS:true}).then(function(canvas){
        var url=canvas.toDataURL('image/png');
        var a=document.createElement('a');
        var fn=(el('fn').value.trim()||'my')+'-leadership-focus';
        a.href=url; a.download=fn.replace(/[^a-z0-9\-]+/gi,'-').toLowerCase()+'.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        saveBtn.disabled=false; saveBtn.textContent=old;
      }).catch(function(){ saveBtn.disabled=false; saveBtn.textContent=old; });
    });
  }

  // ---- navigation ----
  function resetAll(){
    pickedComp=[];pickedSkill=[];mine=null;submitted=false;reacted={};
    [].forEach.call(cg.children,function(ch){ch.classList.remove('sel');ch.querySelector('.rank').textContent='';});
    [].forEach.call(sl.children,function(ch){ch.classList.remove('sel');});
    el('compCount').textContent='0 of 2 selected';el('skillCount').textContent='0 of 3 selected';
    el('compNext').disabled=true;el('skillNext').disabled=true;
    GOALS.forEach(function(g){var ta=el('goal_'+g.key);if(ta)ta.value='';var cc=el('gc_'+g.key);if(cc)cc.innerHTML='<b>0</b> / '+GOAL_MAX;});
    el('fn').value='';el('ln').value='';el('div').value='';el('role').value='';el('yrs').value='';
    if(el('region')){el('region').value='';}
    if(el('entity')){fillEntity(el('entity'),'','Select a region first…');el('entity').value='';}
    if(el('approach')){el('approach').value='';}
    if(el('approachCount')){el('approachCount').innerHTML='<b>0</b> / 280';}
  }
  function go(s){
    var n=String(s);
    [].forEach.call(document.querySelectorAll('.step'),function(st){st.classList.toggle('on',st.getAttribute('data-s')===n);});
    if(n==='5')renderFocus();
    if(n==='6'){ sendSubmit(); renderBoard(); renderExplore(); }
    try{window.scrollTo({top:0,behavior:'smooth'});}catch(e){}
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-go]');if(!t)return;
    var s=t.getAttribute('data-go');
    if(s==='0')resetAll();
    go(s);
  });

  // ---- board dot detail popover (hover to preview, tap to pin) ----
  (function(){
    var cv=el('canvas'); var pop=el('dotpop'); if(!cv||!pop) return;
    var pinnedId=null;
    function popHTML(card){
      var who=card.first?esc(card.first):'A leader';
      var role=[card.role,card.division].filter(Boolean).map(esc).join(' · ');
      var comps=(card.comps||[]).map(function(c){var col=compByName(c.name).color;return '<div class="pc"><span class="r" style="background:'+col+'">'+c.rank+'</span>'+esc(c.name)+'</div>';}).join('');
      var sk=(card.skills&&card.skills.length)?('<div class="lb">Strengthening</div><div class="sk">'+card.skills.map(esc).join(' · ')+'</div>'):'';
      var gg=card.goals||{};
      var gl=GOALS.filter(function(g){return gg[g.key];}).map(function(g){
        return '<div class="gl"><b style="color:'+g.color+'">'+esc(g.name)+':</b> '+esc(gg[g.key])+'</div>';
      }).join('');
      var goalsBlock=gl?('<div class="lb">Advancing the goals</div>'+gl):'';
      var nt=card.approach?('<div class="nt">'+esc(card.approach)+'</div>'):'';
      return '<div class="who">'+who+'</div>'+(role?'<div class="prole">'+role+'</div>':'')+'<div class="lb">Focusing on</div>'+comps+sk+goalsBlock+nt;
    }
    function positionPop(d){
      var rr=d.getBoundingClientRect();
      pop.style.left=Math.min(Math.max(rr.left+rr.width/2,150),window.innerWidth-150)+'px';
      if(rr.top<200){pop.classList.add('below');pop.style.top=rr.bottom+'px';}
      else{pop.classList.remove('below');pop.style.top=rr.top+'px';}
    }
    function showPop(d){var card=findCard(d.getAttribute('data-id'));if(!card)return;pop.innerHTML=popHTML(card);positionPop(d);pop.classList.add('show');}
    function hidePop(){pop.classList.remove('show');}
    function clearActive(){var a=cv.querySelector('.bd.active');if(a)a.classList.remove('active');}
    cv.addEventListener('mousemove',function(e){if(pinnedId)return;var d=e.target.closest('.bd');if(d)showPop(d);else hidePop();});
    cv.addEventListener('mouseleave',function(){if(!pinnedId)hidePop();});
    // click a dot toggles its pinned popover; click anywhere else dismisses it
    document.addEventListener('click',function(e){
      var d=e.target.closest?e.target.closest('#canvas .bd'):null;
      if(d){var id=d.getAttribute('data-id');clearActive();if(pinnedId===id){pinnedId=null;hidePop();}else{pinnedId=id;d.classList.add('active');showPop(d);}}
      else{if(pinnedId){pinnedId=null;clearActive();}hidePop();}
    });
    // scrolling the page dismisses the popover (it would otherwise detach from the dot)
    window.addEventListener('scroll',function(){if(pinnedId){pinnedId=null;clearActive();}hidePop();},true);
  }());

  // ---- years-of-experience stepper (large +/- buttons) ----
  (function(){
    var yrs=el('yrs'); if(!yrs) return;
    function step(delta){
      var v=parseFloat(yrs.value); if(isNaN(v))v=0;
      v=Math.round((v+delta)*2)/2; if(v<0)v=0;
      yrs.value=v;
    }
    var up=el('yrsUp'), dn=el('yrsDown');
    if(up)up.addEventListener('click',function(){step(0.5);});
    if(dn)dn.addEventListener('click',function(){step(-0.5);});
  })();

  // ---- personal-note counter ----
  (function(){
    var ta=el('approach'), cc=el('approachCount');
    if(ta&&cc){ ta.addEventListener('input',function(){ cc.innerHTML='<b>'+ta.value.length+'</b> / 280'; }); }
  })();

  // ---- explore filters + reactions wiring ----
  (function(){
    var s=el('exComp');
    if(s){ COMPS.forEach(function(c){ var o=document.createElement('option'); o.value=c.name; o.textContent=c.name; s.appendChild(o); }); s.addEventListener('change',renderExplore); }
    var q=el('exSearch'); if(q) q.addEventListener('input',renderExplore);
    var wall=el('exwall');
    if(wall) wall.addEventListener('click',function(e){
      var b=e.target.closest('.react'); if(!b) return;
      var id=b.getAttribute('data-id'); var kind=b.getAttribute('data-react');
      if(reacted[id]) return;                 // one reaction per card, per viewer
      reacted[id]=kind;
      var card=findCard(id);
      if(card){ card.react=card.react||{heart:0,clap:0}; card.react[kind]=(card.react[kind]||0)+1; updateReactionCounts(id); } // optimistic
      // lock both buttons on this card and mark the chosen one
      var cardEl=wall.querySelector('.excard[data-id="'+id+'"]');
      if(cardEl){ var erow=cardEl.querySelector('.erow'); if(erow) erow.classList.add('reacted');
        [].forEach.call(cardEl.querySelectorAll('.react'),function(btn){ btn.disabled=true; if(btn.getAttribute('data-react')===kind) btn.classList.add('chosen'); }); }
      if(ws&&ws.readyState===1) ws.send(JSON.stringify({type:'react',id:id,kind:kind}));
    });
  })();

  // ---- region / entity: sign-in dropdowns (dependent) + board filters ----
  (function(){
    fillRegion(el('region'),'Select…');
    var rg=el('region'), en=el('entity');
    if(rg&&en){ rg.addEventListener('change',function(){ fillEntity(en, rg.value, 'Select…'); }); }
    fillRegion(el('bRegion'),'All regions'); fillEntity(el('bEntity'),'','All entities');
    var brg=el('bRegion'), ben=el('bEntity');
    if(brg) brg.addEventListener('change',function(){ fillEntity(ben, brg.value, 'All entities'); refreshBoardViews(); });
    if(ben) ben.addEventListener('change',refreshBoardViews);
  })();

  connect();
})();
