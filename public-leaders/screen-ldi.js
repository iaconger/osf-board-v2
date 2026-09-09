/* OSF LDI big-screen room mode. Read-only, live over WebSocket. No inline scripts (CSP). */
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
  function compColor(n){for(var i=0;i<COMPS.length;i++)if(COMPS[i].name===n)return COMPS[i].color;return '#9aa';}
  var el=function(id){return document.getElementById(id);};
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  var board=[];       // public cards
  var ticker=[];      // recent {name,label} newest first

  function pos(i){var seed=(i+1)*2654435761>>>0;function r(){seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;}return {x:6+r()*88,y:8+r()*84,s:14+r()*16};}
  function renderBoard(isNewLast){
    var cv=el('canvas');cv.innerHTML='';
    el('empty').style.display=board.length?'none':'flex';
    board.forEach(function(card,i){
      var name=(card.comps&&card.comps[0])?card.comps[0].name:COMPS[0].name;
      var p=pos(i);var d=document.createElement('div');
      d.className='bd'+(isNewLast&&i===board.length-1?' new':'');
      d.style.width=p.s+'px';d.style.height=p.s+'px';d.style.background=compColor(name);
      d.style.left=p.x+'%';d.style.top=p.y+'%';
      cv.appendChild(d);
    });
    el('count').textContent=board.length.toLocaleString();
  }
  function renderRanking(){
    var score={};COMPS.forEach(function(c){score[c.name]=0;});
    board.forEach(function(card){ (card.comps||[]).forEach(function(c){ if(score[c.name]!==undefined) score[c.name]+=(c.rank===1?2:1); }); });
    var arr=COMPS.map(function(c){return {name:c.name,color:c.color,v:score[c.name]};}).sort(function(a,b){return b.v-a.v;});
    var max=arr[0].v||1;
    el('ranking').innerHTML=arr.map(function(a){
      var w=Math.round(a.v/max*100);
      return '<div class="rk"><div class="rl"><span class="dot" style="background:'+a.color+'"></span>'+a.name+'<span class="v">'+a.v+'</span></div>'+
        '<div class="track"><div class="fill" style="width:'+w+'%;background:'+a.color+'"></div></div></div>';
    }).join('');
  }
  function renderTicker(){
    el('ticker').innerHTML=ticker.slice(0,8).map(function(t,i){
      return '<span class="item'+(i===0?' newest':'')+'"><span class="dot" style="background:'+t.color+'"></span>'+esc(t.label)+'</span>';
    }).join('');
  }
  function pushTicker(card){
    var name=(card.comps&&card.comps[0])?card.comps[0].name:'';
    var who=[card.role,card.division].filter(Boolean).join(' · ')||(card.first||'A leader');
    ticker.unshift({color:compColor(name),label:who+'  →  '+name});
    if(ticker.length>12)ticker.pop();
  }

  var ws=null;
  function connect(){
    try{ var proto=location.protocol==='https:'?'wss:':'ws:'; ws=new WebSocket(proto+'//'+location.host); }catch(e){ return; }
    ws.onmessage=function(ev){ var d; try{d=JSON.parse(ev.data);}catch(e){return;}
      if(d.type==='init'){ board=(d.feed||[]).slice().reverse(); ticker=[]; board.slice(-12).reverse().forEach(pushTicker); renderBoard(false);renderRanking();renderTicker(); }
      else if(d.type==='add'){ if(d.item){ board.push(d.item); pushTicker(d.item); renderBoard(true); renderRanking(); renderTicker(); } }
      // reactions ignored on the screen view
    };
    ws.onclose=function(){ setTimeout(connect,2500); };
    ws.onerror=function(){ try{ws.close();}catch(e){} };
  }
  renderBoard(false);renderRanking();
  connect();
})();
