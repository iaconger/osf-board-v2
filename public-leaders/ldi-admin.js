/* OSF LDI Leaders' dashboard — key-gated, live from /export.json. No inline scripts (CSP). */

(function(){
  'use strict';
  var el=function(id){return document.getElementById(id);};
  var COMPS=[
    {name:'Model our Mission & Values',color:'#4E8209'},
    {name:'Personal Growth',color:'#64A70B'},
    {name:'Communicate Purposefully',color:'#007F9B'},
    {name:'Develop People',color:'#00A9CE'},
    {name:'Dynamic Collaborations',color:'#A5228E'},
    {name:'System Thinking',color:'#E57200'},
    {name:'Drive Transformation',color:'#5B4B8A'}
  ];
  function compColor(n){for(var i=0;i<COMPS.length;i++)if(COMPS[i].name===n)return COMPS[i].color;return '#888';}
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  var SKILLS=['Values-Driven Leadership','Purposeful Compassion','Ethical Stewardship','Operational Integrity','Emotional Intelligence: Self-Awareness','Emotional Intelligence: Self-Management','Feedback','Learning Agility','Active Listening','Clarity & Transparency','Constructive Communication','Strategic Alignment','Clear Expectations','Compassionate Accountability','Coaching for Growth','Performance Analytics','Continuous Improvement','Emotional Intelligence: Social Awareness','Emotional Intelligence: Relationship Management','Cross-Functional Collaboration','Diversity & Inclusion','Data-Informed Planning','Business Acumen','Process Optimization','Strategic Foresight','Cultivating Innovation','Inspires Change','Strategic Execution'];
  var DIVS=['Ambulatory','Acute Care','OSF Digital','Medical Group','Nursing','Foundation','Shared Services','Behavioral Health'];
  var ROLES=['Lead Physician / APP / APN','Supervisor','Manager','Director','Vice President','SVP and above'];

  // ---- data (loaded from server) ----
  var LEADERS=[];
  var KEY='';

  // ---- filter state ----
  var F={div:'',role:'',years:''};
  function inYears(y){var b=F.years;if(!b)return true;if(b==='0-2')return y<=2;if(b==='3-5')return y>=3&&y<=5;if(b==='6-10')return y>=6&&y<=10;return y>=11;}
  function filtered(){return LEADERS.filter(function(l){return (!F.div||l.division===F.div)&&(!F.role||l.role===F.role)&&inYears(l.years);});}

  // populate filter selects
  function populateDivisions(){var seen={},ds=[];LEADERS.forEach(function(l){var d=(l.division||'').trim();if(d&&!seen[d]){seen[d]=1;ds.push(d);}});ds.sort();var sel=el('fDiv');sel.innerHTML='<option value="">All divisions</option>';ds.forEach(function(d){var o=document.createElement('option');o.value=d;o.textContent=d;sel.appendChild(o);});}
  ROLES.forEach(function(rr){var o=document.createElement('option');o.value=rr;o.textContent=rr;el('fRole').appendChild(o);});

  function num(n){return Number(n||0).toLocaleString();}

  function renderKpis(data){
    var divs={},roles={},yrs=0;
    data.forEach(function(l){divs[l.division]=1;roles[l.role]=1;yrs+=l.years;});
    var avg=data.length?(yrs/data.length):0;
    var tiles=[
      {n:num(data.length),l:'leaders have shared their focus',c:''},
      {n:num(Object.keys(divs).length),l:'divisions represented',c:'k2'},
      {n:num(Object.keys(roles).length),l:'leadership levels represented',c:'k3'},
      {n:(Math.round(avg*10)/10).toString(),l:'avg years of leadership experience',c:'k4'}
    ];
    el('kpis').innerHTML=tiles.map(function(t){return '<div class="kpi '+t.c+'"><div class="n">'+t.n+'</div><div class="l">'+t.l+'</div></div>';}).join('');
  }

  function renderCompBars(data){
    var score={},n1={},n2={};COMPS.forEach(function(c){score[c.name]=0;n1[c.name]=0;n2[c.name]=0;});
    data.forEach(function(l){if(l.comps[0]){score[l.comps[0]]+=2;n1[l.comps[0]]++;}if(l.comps[1]){score[l.comps[1]]+=1;n2[l.comps[1]]++;}});
    var arr=COMPS.map(function(c){return {name:c.name,color:c.color,v:score[c.name],a:n1[c.name],b:n2[c.name]};}).sort(function(a,b){return b.v-a.v;});
    var max=arr[0]?arr[0].v:1;if(!max)max=1;
    el('compBars').innerHTML=arr.map(function(a){
      var w=Math.round(a.v/max*100);
      return '<div class="hbar"><div class="bl"><span class="dot" style="background:'+a.color+'"></span><span>'+a.name+'<small>'+a.a+' chose #1 · '+a.b+' chose #2</small></span></div>'+
        '<div class="track"><div class="fill" style="width:'+w+'%;background:'+a.color+'"></div></div><div class="bn">'+a.v+'</div></div>';
    }).join('') || '<div class="empty">No leaders match.</div>';
  }

  function renderSkillBars(data){
    var f={};SKILLS.forEach(function(s){f[s]=0;});
    data.forEach(function(l){l.skills.forEach(function(s){f[s]++;});});
    var arr=SKILLS.map(function(s){return {name:s,n:f[s]};}).filter(function(x){return x.n>0;}).sort(function(a,b){return b.n-a.n;}).slice(0,12);
    var max=arr.length?arr[0].n:1;
    el('skillBars').innerHTML=arr.map(function(a){
      var w=Math.round(a.n/max*100);
      return '<div class="skillbar"><div class="sl">'+a.name+'</div><div class="track"><div class="fill" style="width:'+w+'%"></div></div><div class="sn">'+a.n+'</div></div>';
    }).join('') || '<div class="empty">No skills yet.</div>';
  }

  function renderHeat(data){
    // count of leaders in each role choosing each competency (#1 or #2)
    var counts={};ROLES.forEach(function(ro){counts[ro]={};COMPS.forEach(function(c){counts[ro][c.name]=0;});});
    var rolePresent={};
    data.forEach(function(l){rolePresent[l.role]=1;l.comps.forEach(function(cn){if(counts[l.role])counts[l.role][cn]++;});});
    var max=1;ROLES.forEach(function(ro){COMPS.forEach(function(c){max=Math.max(max,counts[ro][c.name]);});});
    var head='<tr><th class="role">Role</th>'+COMPS.map(function(c){return '<th><span style="display:inline-block;writing-mode:horizontal-tb;max-width:64px;line-height:1.1">'+c.name+'</span></th>';}).join('')+'</tr>';
    var rows=ROLES.filter(function(ro){return rolePresent[ro];}).map(function(ro){
      return '<tr><td class="rl">'+ro+'</td>'+COMPS.map(function(c){
        var v=counts[ro][c.name];var alpha=v?(0.15+0.85*(v/max)):0;
        var bg=v?hexA(c.color,alpha):'#f4f6f0';
        return '<td style="background:'+bg+';color:'+(alpha>0.55?'#fff':'#1c2418')+'">'+(v||'')+'</td>';
      }).join('')+'</tr>';
    }).join('');
    el('heat').innerHTML='<table class="hm">'+head+rows+'</table>';
    el('heatlegend').textContent='Each cell counts leaders at that level who chose the competency as a top-2 focus.';
  }
  function hexA(hex,a){var n=parseInt(hex.slice(1),16);var r=(n>>16)&255,g=(n>>8)&255,b=n&255;return 'rgba('+r+','+g+','+b+','+a.toFixed(2)+')';}

  function renderDivBars(data){
    var f={};data.forEach(function(l){f[l.division]=(f[l.division]||0)+1;});
    var arr=Object.keys(f).map(function(k){return {name:k,n:f[k]};}).sort(function(a,b){return b.n-a.n;});
    var max=arr.length?arr[0].n:1;
    el('divBars').innerHTML=arr.map(function(a){
      var w=Math.round(a.n/max*100);
      return '<div class="skillbar"><div class="sl">'+a.name+'</div><div class="track"><div class="fill" style="width:'+w+'%;background:#4E8209"></div></div><div class="sn">'+a.n+'</div></div>';
    }).join('') || '<div class="empty">No divisions yet.</div>';
  }

  // ---- submissions browser ----
  var BR={page:0,size:8,q:'',sort:'recent'};
  function browserData(){
    var list=filtered().slice();
    if(BR.q){var q=BR.q.toLowerCase();list=list.filter(function(l){
      var hay=[l.first,l.last,l.division,l.role,l.approach].concat(l.comps).concat(l.skills).join(' ').toLowerCase();return hay.indexOf(q)>=0;});}
    if(BR.sort==='div')list.sort(function(a,b){return a.division.localeCompare(b.division);});
    else if(BR.sort==='role')list.sort(function(a,b){return ROLES.indexOf(a.role)-ROLES.indexOf(b.role);});
    else list.sort(function(a,b){return b.ts-a.ts;});
    return list;
  }
  function renderBrowser(){
    var list=browserData();var total=list.length;var pages=Math.max(1,Math.ceil(total/BR.size));
    if(BR.page>=pages)BR.page=pages-1;if(BR.page<0)BR.page=0;
    var start=BR.page*BR.size;var slice=list.slice(start,start+BR.size);
    if(!total){el('tablewrap').innerHTML='<div class="empty">No leaders match.</div>';el('pager').style.display='none';return;}
    var h='<table class="subs"><thead><tr><th>Leader</th><th>Role &amp; experience</th><th>Competencies (ranked)</th><th>Skills to strengthen</th><th>How they\'ll work on it</th></tr></thead><tbody>';
    slice.forEach(function(l){
      var who=(l.first||l.last)?((l.first+' '+l.last).trim()):'<span class="meta">(anonymous)</span>';
      var comps=l.comps.map(function(cn,idx){var col=compColor(cn);return '<span class="cchip"><span class="r" style="background:'+col+'">'+(idx+1)+'</span><span class="dot" style="background:'+col+'"></span>'+cn+'</span>';}).join('');
      var sks=l.skills.map(function(s){return '<span class="sktag">'+s+'</span>';}).join('');
      var ap=l.approach?('<span class="approach">'+esc(l.approach)+'</span>'):'<span class="meta">—</span>';
      h+='<tr><td><div class="who">'+who+'</div><div class="meta">'+l.division+'</div></td>'+
         '<td>'+l.role+'<div class="meta">'+l.years+' yr'+(l.years===1?'':'s')+'</div></td>'+
         '<td>'+comps+'</td><td>'+sks+'</td><td>'+ap+'</td></tr>';
    });
    h+='</tbody></table>';el('tablewrap').innerHTML=h;
    el('pinfo').textContent='Showing '+(start+1)+'–'+Math.min(start+BR.size,total)+' of '+total+' leaders'+(pages>1?'   ·   page '+(BR.page+1)+' of '+pages:'');
    el('prev').disabled=BR.page<=0;el('next').disabled=BR.page>=pages-1;el('pager').style.display='flex';
  }

  function renderAll(){
    var data=filtered();
    renderKpis(data);renderCompBars(data);renderSkillBars(data);renderHeat(data);renderDivBars(data);
    BR.page=0;renderBrowser();
    setDownloads();
    el('asof').textContent='As of '+new Date().toLocaleString();
  }

  el('fDiv').addEventListener('change',function(e){F.div=e.target.value;renderAll();});
  el('fRole').addEventListener('change',function(e){F.role=e.target.value;renderAll();});
  el('fYears').addEventListener('change',function(e){F.years=e.target.value;renderAll();});
  el('reset').addEventListener('click',function(){F={div:'',role:'',years:''};el('fDiv').value='';el('fRole').value='';el('fYears').value='';renderAll();});
  el('tSearch').addEventListener('input',function(e){BR.q=e.target.value.trim();BR.page=0;renderBrowser();});
  el('tSort').addEventListener('change',function(e){BR.sort=e.target.value;BR.page=0;renderBrowser();});
  el('prev').addEventListener('click',function(){if(BR.page>0){BR.page--;renderBrowser();}});
  el('next').addEventListener('click',function(){BR.page++;renderBrowser();});

  function setDownloads(){
    var p='key='+encodeURIComponent(KEY);
    if(F.div)p+='&division='+encodeURIComponent(F.div);
    if(F.role)p+='&role='+encodeURIComponent(F.role);
    if(F.years)p+='&years='+encodeURIComponent(F.years);
    var x=el('dlxlsx'),c=el('dlcsv'),j=el('dljson');
    if(x)x.href='/export.xlsx?'+p; if(c)c.href='/export?'+p; if(j)j.href='/export.json?'+p;
  }
  function normalize(subs){
    return (subs||[]).map(function(s){
      var comps=(s.comps||[]).slice().sort(function(a,b){return (a.rank||9)-(b.rank||9);}).map(function(c){return c.name;});
      return { first:s.first||'', last:s.last||'', division:s.division||'', role:s.role||'',
        years:(s.years===null||s.years===undefined)?0:Number(s.years),
        comps:comps, skills:s.skills||[], approach:s.approach||'', ts:(new Date(s.submitted).getTime()||0) };
    });
  }
  function qp(n){try{return new URLSearchParams(location.search).get(n)||'';}catch(e){return '';}}
  function msg(t){var m=el('msg');if(m)m.textContent=t||'';}
  function load(){
    var k=el('key').value.trim(); if(!k){msg('Enter your export key to load the dashboard.');return;}
    KEY=k; msg('Loading…');
    fetch('/export.json?key='+encodeURIComponent(k)).then(function(r){
      if(r.status===403){msg('That key was not accepted. Check the EXPORT_KEY in your hosting settings.');return null;}
      if(!r.ok){msg('Could not load data (error '+r.status+').');return null;}
      return r.json();
    }).then(function(d){ if(!d)return;
      LEADERS=normalize(d.submissions||[]);
      populateDivisions();
      el('gate').style.display='none';
      el('dash').style.display='block';
      renderAll();
      msg('');
    }).catch(function(){msg('Could not reach the server. Check your connection and try again.');});
  }
  el('load').addEventListener('click',load);
  el('key').addEventListener('keydown',function(e){if(e.key==='Enter')load();});
  var rf=el('refresh'); if(rf)rf.addEventListener('click',load);
  el('key').value=qp('key'); if(el('key').value) load();
})();

