/* OSF FY27 Strategy Commitment — big-screen board (wall view).
 * Live viewer only: driven by the server over WebSocket. No inline handlers. */
(function () {
  'use strict';
  var svgns = 'http://www.w3.org/2000/svg';
  var GOAL_COLORS = { g1: '#64A70B', g2: '#00A9CE', g3: '#A5228E' };
  var HEART_COLOR = '#4E8209'; // every team on the heart shows in one OSF green
  var count = 0, built = false, feed = [];

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dotColor(goal) { return HEART_COLOR; }

  function setCount(n, animate) {
    var el = document.getElementById('count'); if (!el) return;
    var start = Number((el.textContent || '0').replace(/[^0-9]/g, '')) || 0;
    if (!animate || start === n) { el.textContent = Number(n).toLocaleString(); if (animate) flash(el); return; }
    var dur = Math.min(1000, 260 + Math.abs(n - start) * 7), t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts; var p = Math.min(1, (ts - t0) / dur); var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (n - start) * e).toLocaleString();
      if (p < 1) requestAnimationFrame(step); else { el.textContent = Number(n).toLocaleString(); flash(el); }
    }
    requestAnimationFrame(step);
  }
  function flash(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  function makeDot(info, pop) {
    var g = document.getElementById('dots'); if (!g) return;
    while (g.childElementCount >= 260) g.removeChild(g.firstChild);
    var c = document.createElementNS(svgns, 'circle');
    c.setAttribute('cx', (12 + Math.random() * 176).toFixed(1));
    c.setAttribute('cy', (16 + Math.random() * 140).toFixed(1));
    c.setAttribute('fill', dotColor(info && info.goal));
    c.setAttribute('opacity', (0.55 + Math.random() * 0.4).toFixed(2));
    var r = (info && info.commit) ? (3 + Math.random()) : (1.8 + Math.random() * 1.6);
    if (pop) {
      c.setAttribute('r', '0');
      var an = document.createElementNS(svgns, 'animate');
      an.setAttribute('attributeName', 'r'); an.setAttribute('values', '0;' + (r + 2.5).toFixed(1) + ';' + r.toFixed(1));
      an.setAttribute('keyTimes', '0;0.6;1'); an.setAttribute('dur', '0.8s'); an.setAttribute('fill', 'freeze');
      c.appendChild(an);
    } else { c.setAttribute('r', r.toFixed(1)); }
    g.appendChild(c);
  }

  function renderFeed() {
    var box = document.getElementById('feed'); if (!box) return;
    box.innerHTML = feed.slice(0, 30).map(function (it) {
      var dot = '<span class="fi-dot" style="background:' + HEART_COLOR + '"></span>';
      return '<div class="feed-item"><div class="fi-team">' + dot + esc(it.team) +
        (it.fresh ? '<span class="when">· just now</span>' : '') + '</div>' +
        '<div class="fi-commit">' + esc(it.commit || '') + '</div></div>';
    }).join('');
  }

  function buildDots() {
    if (built) return; built = true;
    var pad = Math.min(240, Math.max(feed.length, count));
    for (var i = 0; i < pad; i++) { makeDot(i < feed.length ? feed[i] : null, false); }
  }

  function connect() {
    var proto = (location.protocol === 'https:' ? 'wss://' : 'ws://');
    var ws;
    try { ws = new WebSocket(proto + location.host); } catch (e) { return; }
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type === 'init') {
        count = m.count || 0; feed = (m.feed || []).slice();
        setCount(count); renderFeed();
        var g = document.getElementById('dots'); if (g) { g.innerHTML = ''; built = false; }
        buildDots();
      } else if (m.type === 'add') {
        count = (typeof m.count === 'number') ? m.count : count + 1; setCount(count, true);
        var it = m.item || {}; it.fresh = true;
        feed.unshift(it); if (feed.length > 60) feed.pop();
        renderFeed();
        makeDot(it, true);
      }
    };
    ws.onclose = function () { setTimeout(connect, 2000); };
    ws.onerror = function () { try { ws.close(); } catch (e) { /* noop */ } };
  }

  connect();
})();
