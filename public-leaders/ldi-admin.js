/* OSF LDI Leaders' dashboard. Key-gated, live from /export.json. No inline scripts (CSP). */

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
  var GOALS=[{key:'g1',name:'Excellence',color:'#4E8209'},{key:'g2',name:'One OSF Team',color:'#00A9CE'},{key:'g3',name:'Destination OSF',color:'#A5228E'}];
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
  function fillRegionSel(sel){if(!sel)return;sel.innerHTML='<option value="">All regions</option>';REGIONS.forEach(function(x){var o=document.createElement('option');o.value=x.r;o.textContent=x.r;sel.appendChild(o);});}
  function fillEntitySel(sel,region){if(!sel)return;var list=region?entitiesFor(region):allEntities();sel.innerHTML='<option value="">All entities</option>';list.forEach(function(en){var o=document.createElement('option');o.value=en;o.textContent=en;sel.appendChild(o);});}

  // ---- data (loaded from server) ----
  var LEADERS=[];
  var KEY='';

  // ---- filter state ----
  var F={div:'',region:'',entity:'',role:'',years:''};
  function inYears(y){var b=F.years;if(!b)return true;if(b==='0-2')return y<=2;if(b==='3-5')return y>=3&&y<=5;if(b==='6-10')return y>=6&&y<=10;return y>=11;}
  function filtered(){return LEADERS.filter(function(l){return (!F.div||l.division===F.div)&&(!F.region||l.region===F.region)&&(!F.entity||l.entity===F.entity)&&(!F.role||l.role===F.role)&&inYears(l.years);});}

  // populate filter selects
  function populateDivisions(){var seen={},ds=[];LEADERS.forEach(function(l){var d=(l.division||'').trim();if(d&&!seen[d]){seen[d]=1;ds.push(d);}});ds.sort();var sel=el('fDiv');sel.innerHTML='<option value="">All divisions</option>';ds.forEach(function(d){var o=document.createElement('option');o.value=d;o.textContent=d;sel.appendChild(o);});}
  ROLES.forEach(function(rr){var o=document.createElement('option');o.value=rr;o.textContent=rr;el('fRole').appendChild(o);});
  fillRegionSel(el('fRegion'));fillEntitySel(el('fEntity'),'');

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
        '<div class="track"><div class="fill" style="width:'+w+'%;background:#007F9B"></div></div><div class="bn">'+a.v+'</div></div>';
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
    var head='<tr><th class="role">Role</th>'+COMPS.map(function(c){return '<th><span class="ct">'+c.name+'</span></th>';}).join('')+'</tr>';
    var rows=ROLES.filter(function(ro){return rolePresent[ro];}).map(function(ro){
      return '<tr><td class="rl">'+ro+'</td>'+COMPS.map(function(c){
        var v=counts[ro][c.name];var alpha=v?(0.15+0.85*(v/max)):0;
        var bg=v?hexA('#007F9B',alpha):'#f4f6f0';
        return '<td style="background:'+bg+';color:'+(alpha>0.55?'#fff':'#1c2418')+'">'+(v||'')+'</td>';
      }).join('')+'</tr>';
    }).join('');
    el('heat').innerHTML='<table class="hm">'+head+rows+'</table>';
    el('heatlegend').textContent='Each cell counts leaders at that level who chose the competency as a top-2 focus.';
  }
  function hexA(hex,a){var n=parseInt(hex.slice(1),16);var r=(n>>16)&255,g=(n>>8)&255,b=n&255;return 'rgba('+r+','+g+','+b+','+a.toFixed(2)+')';}

  function renderGoalCommit(data){
    var host=el('goalCommit');if(!host)return;
    host.innerHTML=GOALS.map(function(g){
      var items=data.filter(function(l){return l.goals&&l.goals[g.key];});
      var body=items.length?items.slice().reverse().map(function(l){
        var who=((l.first||'')+' '+(l.last||'')).trim();
        var whoLine=(who||l.role)?('<span class="gwho">'+esc(who||'A leader')+(l.role?(' · '+esc(l.role)):'')+'</span>'):'';
        return '<div class="gact">'+esc(l.goals[g.key])+whoLine+'</div>';
      }).join(''):'<div class="gempty">No actions yet.</div>';
      return '<div class="goalcol"><div class="gch" style="background:'+g.color+'"><span>'+esc(g.name)+'</span><span class="gn">'+items.length+'</span></div><div class="glist">'+body+'</div></div>';
    }).join('');
  }

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
      var hay=[l.first,l.last,l.division,l.region,l.entity,l.role,l.approach].concat(l.comps).concat(l.skills).concat(GOALS.map(function(g){return (l.goals&&l.goals[g.key])||'';})).join(' ').toLowerCase();return hay.indexOf(q)>=0;});}
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
    var h='<table class="subs"><thead><tr><th>Leader</th><th>Role &amp; experience</th><th>Strategic goal commitments</th><th>Competencies (ranked)</th><th>Skills to strengthen</th><th>How they\'ll work on it</th><th>Manage</th></tr></thead><tbody>';
    slice.forEach(function(l){
      var who=(l.first||l.last)?((l.first+' '+l.last).trim()):'<span class="meta">(anonymous)</span>';
      var comps=l.comps.map(function(cn,idx){var col=compColor(cn);return '<span class="cchip"><span class="r" style="background:'+col+'">'+(idx+1)+'</span><span class="dot" style="background:'+col+'"></span>'+cn+'</span>';}).join('');
      var sks=l.skills.map(function(s){return '<span class="sktag">'+s+'</span>';}).join('');
      var gg=l.goals||{};
      var goalsCell=GOALS.filter(function(g){return gg[g.key];}).map(function(g){
        return '<div class="gcommit"><b style="color:'+g.color+'">'+esc(g.name)+':</b> '+esc(gg[g.key])+'</div>';
      }).join('')||'<span class="meta">None</span>';
      var ap=l.approach?('<span class="approach">'+esc(l.approach)+'</span>'):'<span class="meta">None</span>';
      var nm=((l.first||'')+' '+(l.last||'')).trim()||'this response';
      var del=(l.rid===null||l.rid===undefined)?'<span class="meta">—</span>':
        '<button type="button" class="delrow" data-rid="'+esc(String(l.rid))+'" data-name="'+esc(nm)+'" style="border:1px solid #e0b4b0;background:#fdeceb;color:#b3261e;border-radius:8px;padding:6px 12px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">Delete</button>';
      h+='<tr><td><div class="who">'+who+'</div><div class="meta">'+esc(l.division)+(l.entity?(' · '+esc(l.entity)):'')+'</div></td>'+
         '<td>'+l.role+'<div class="meta">'+l.years+' yr'+(l.years===1?'':'s')+'</div></td>'+
         '<td>'+goalsCell+'</td><td>'+comps+'</td><td>'+sks+'</td><td>'+ap+'</td><td>'+del+'</td></tr>';
    });
    h+='</tbody></table>';el('tablewrap').innerHTML=h;
    el('pinfo').textContent='Showing '+(start+1)+' to '+Math.min(start+BR.size,total)+' of '+total+' leaders'+(pages>1?'   ·   page '+(BR.page+1)+' of '+pages:'');
    el('prev').disabled=BR.page<=0;el('next').disabled=BR.page>=pages-1;el('pager').style.display='flex';
  }

  function renderAll(){
    var data=filtered();
    renderKpis(data);renderCompBars(data);renderSkillBars(data);renderHeat(data);renderDivBars(data);renderGoalCommit(data);
    BR.page=0;renderBrowser();
    setDownloads();
    el('asof').textContent='As of '+new Date().toLocaleString();
  }

  el('fDiv').addEventListener('change',function(e){F.div=e.target.value;renderAll();});
  el('fRole').addEventListener('change',function(e){F.role=e.target.value;renderAll();});
  el('fYears').addEventListener('change',function(e){F.years=e.target.value;renderAll();});
  if(el('fRegion'))el('fRegion').addEventListener('change',function(e){F.region=e.target.value;fillEntitySel(el('fEntity'),F.region);F.entity='';renderAll();});
  if(el('fEntity'))el('fEntity').addEventListener('change',function(e){F.entity=e.target.value;renderAll();});
  el('reset').addEventListener('click',function(){F={div:'',region:'',entity:'',role:'',years:''};el('fDiv').value='';el('fRole').value='';el('fYears').value='';if(el('fRegion'))el('fRegion').value='';fillEntitySel(el('fEntity'),'');renderAll();});
  el('tSearch').addEventListener('input',function(e){BR.q=e.target.value.trim();BR.page=0;renderBrowser();});
  el('tSort').addEventListener('change',function(e){BR.sort=e.target.value;BR.page=0;renderBrowser();});
  el('prev').addEventListener('click',function(){if(BR.page>0){BR.page--;renderBrowser();}});
  el('next').addEventListener('click',function(){BR.page++;renderBrowser();});

  // ---- delete / clear-all (always requires the admin key) ----
  function mmsg(t,kind){var m=el('mmsg'),x=el('mmsgtext');if(!m||!x)return;if(!t){m.style.display='none';x.textContent='';return;}m.style.display='flex';x.textContent=t;x.style.color=(kind==='err'?'#b3261e':(kind==='ok'?'#3f6d08':''));}
  function adminKeyVal(){var a=el('adminKey');return a?a.value.trim():'';}
  function post(path,body){return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
  function doDelete(rid,name,btn){
    var k=adminKeyVal(); if(!k){mmsg('Enter your admin key above to enable deleting.','err');var a=el('adminKey');if(a)a.focus();return;}
    if(!window.confirm('Delete '+(name||'this response')+'? This cannot be undone.'))return;
    if(btn){btn.disabled=true;btn.textContent='Deleting…';}
    post('/admin/delete',{key:k,rid:rid}).then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {s:r.status,j:j};});}).then(function(o){
      if(o.s===200&&o.j.ok){ LEADERS=LEADERS.filter(function(l){return String(l.rid)!==String(rid);}); renderAll(); mmsg('Deleted. '+ (o.j.count!=null?(o.j.count+' remaining.'):''),'ok'); }
      else if(o.s===403){ mmsg('That admin key was not accepted. Check your EXPORT_KEY and try again.','err'); if(btn){btn.disabled=false;btn.textContent='Delete';} }
      else { mmsg('Could not delete (error '+o.s+').','err'); if(btn){btn.disabled=false;btn.textContent='Delete';} }
    }).catch(function(){mmsg('Could not reach the server.','err');if(btn){btn.disabled=false;btn.textContent='Delete';}});
  }
  function doReset(){
    var k=adminKeyVal(); if(!k){mmsg('Enter your admin key above to enable deleting.','err');var a=el('adminKey');if(a)a.focus();return;}
    if(!window.confirm('Clear ALL responses? This permanently deletes every response and cannot be undone.'))return;
    if(!window.confirm('Are you sure? This is your last chance to cancel.'))return;
    var b=el('clearAll'); if(b){b.disabled=true;b.textContent='Clearing…';}
    post('/admin/reset',{key:k}).then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {s:r.status,j:j};});}).then(function(o){
      if(b){b.disabled=false;b.textContent='Clear all responses';}
      if(o.s===200&&o.j.ok){ LEADERS=[]; renderAll(); mmsg('All responses cleared.','ok'); }
      else if(o.s===403){ mmsg('That admin key was not accepted. Check your EXPORT_KEY and try again.','err'); }
      else { mmsg('Could not clear (error '+o.s+').','err'); }
    }).catch(function(){if(b){b.disabled=false;b.textContent='Clear all responses';}mmsg('Could not reach the server.','err');});
  }
  el('tablewrap').addEventListener('click',function(e){var b=e.target.closest?e.target.closest('.delrow'):null;if(b)doDelete(b.getAttribute('data-rid'),b.getAttribute('data-name'),b);});
  if(el('clearAll'))el('clearAll').addEventListener('click',doReset);

  function setDownloads(){
    var p='key='+encodeURIComponent(KEY);
    if(F.div)p+='&division='+encodeURIComponent(F.div);
    if(F.region)p+='&region='+encodeURIComponent(F.region);
    if(F.entity)p+='&entity='+encodeURIComponent(F.entity);
    if(F.role)p+='&role='+encodeURIComponent(F.role);
    if(F.years)p+='&years='+encodeURIComponent(F.years);
    var x=el('dlxlsx'),c=el('dlcsv'),j=el('dljson');
    if(x)x.href='/export.xlsx?'+p; if(c)c.href='/export?'+p; if(j)j.href='/export.json?'+p;
  }
  function normalize(subs){
    return (subs||[]).map(function(s){
      var comps=(s.comps||[]).slice().sort(function(a,b){return (a.rank||9)-(b.rank||9);}).map(function(c){return c.name;});
      return { rid:(s.rid===undefined?null:s.rid), first:s.first||'', last:s.last||'', division:s.division||'', region:s.region||'', entity:s.entity||'', role:s.role||'',
        years:(s.years===null||s.years===undefined)?0:Number(s.years),
        comps:comps, skills:s.skills||[], goals:(s.goals&&typeof s.goals==='object')?s.goals:{}, approach:s.approach||'', ts:(new Date(s.submitted).getTime()||0) };
    });
  }
  function qp(n){try{return new URLSearchParams(location.search).get(n)||'';}catch(e){return '';}}
  function msg(t){var m=el('msg');if(m)m.textContent=t||'';}
  function load(){
    var k=el('key').value.trim(); KEY=k; msg('Loading…');
    fetch('/export.json'+(k?('?key='+encodeURIComponent(k)):'')).then(function(r){
      if(r.status===403){msg('Enter your export key to load the dashboard.');return null;}
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
  el('key').value=qp('key'); load(); // auto-load (open); if the server is re-secured, the key gate shows on 403
})();

