/* OSF Strategy Board — Leadership Dashboard.
 * Loads the key-protected export, computes at-a-glance insights, renders simple
 * inline SVG/CSS charts (no external libraries — strict Content-Security-Policy),
 * and offers point-and-click downloads. No inline handlers. */
(function () {
  'use strict';
  function qp(n) { try { return new URLSearchParams(location.search).get(n) || ''; } catch (e) { return ''; } }
  function esc(s) { return (s || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function num(n) { return Number(n || 0).toLocaleString(); }
  function el(id) { return document.getElementById(id); }

  var PILLARS = [
    { name: 'Excellence', code: 'g1', color: '#64A70B', soft: '#eef6e0', ink: '#3f6d08' },
    { name: 'One OSF Team', code: 'g2', color: '#00A9CE', soft: '#e2f4f8', ink: '#036178' },
    { name: 'Destination OSF', code: 'g3', color: '#A5228E', soft: '#f7e6f3', ink: '#8a1c78' }
  ];
  function pillarBy(name) { for (var i = 0; i < PILLARS.length; i++) if (PILLARS[i].name === name) return PILLARS[i]; return null; }
  function pillarClass(name) { var p = pillarBy(name); return p ? p.code : 'none'; }

  var keyInput = el('key');
  var msgEl = el('msg');
  keyInput.value = qp('key');
  function msg(t) { msgEl.textContent = t || ''; }

  function setLinks(k) {
    var ek = encodeURIComponent(k);
    el('dlxlsx').href = '/export.xlsx?key=' + ek;
    el('dlcsv').href = '/export?key=' + ek;
    el('dljson').href = '/export.json?key=' + ek;
    el('dlg1').href = '/export.xlsx?key=' + ek + '&pillar=g1';
    el('dlg2').href = '/export.xlsx?key=' + ek + '&pillar=g2';
    el('dlg3').href = '/export.xlsx?key=' + ek + '&pillar=g3';
  }

  /* ---------- insight helpers ---------- */
  function teamsPerPillar(subs) {
    var counts = { g1: 0, g2: 0, g3: 0 };
    subs.forEach(function (s) {
      var seen = {};
      (s.commitments || []).forEach(function (c) {
        if (c.pillarCode && !seen[c.pillarCode]) { seen[c.pillarCode] = 1; if (counts[c.pillarCode] !== undefined) counts[c.pillarCode] += 1; }
      });
    });
    return counts;
  }

  function renderKpis(summary, subs) {
    var teams = Number(summary.teams || subs.length || 0);
    var commits = Number(summary.commitments || 0);
    var depts = {};
    subs.forEach(function (s) { if (s.department) depts[s.department] = 1; });
    var deptCount = Object.keys(depts).length;
    var tiles = [
      { n: num(teams), l: 'teams have connected their work to the strategy', c: '' },
      { n: num(commits), l: 'commitments made across all pillars', c: 'k2' },
      { n: num(deptCount), l: 'departments represented', c: 'k3' }
    ];
    el('kpis').innerHTML = tiles.map(function (t) {
      return '<div class="kpi ' + t.c + '"><div class="n">' + t.n + '</div><div class="l">' + t.l + '</div></div>';
    }).join('');
  }

  function renderPillarBars(byPillar, subs) {
    var tp = teamsPerPillar(subs);
    var total = 0;
    PILLARS.forEach(function (p) { total += Number(byPillar[p.name] || 0); });
    var max = 0;
    PILLARS.forEach(function (p) { max = Math.max(max, Number(byPillar[p.name] || 0)); });
    var html = PILLARS.map(function (p) {
      var n = Number(byPillar[p.name] || 0);
      var pct = total ? Math.round((n / total) * 100) : 0;
      var w = max ? Math.round((n / max) * 100) : 0;
      return '<div class="hbar">' +
        '<div class="bl">' + esc(p.name) + '<small>' + num(tp[p.code] || 0) + ' teams committed</small></div>' +
        '<div class="track"><div class="fill" style="width:' + w + '%;background:' + p.color + '"></div></div>' +
        '<div class="bn">' + num(n) + '<small>' + pct + '%</small></div>' +
        '</div>';
    }).join('');
    el('pillarBars').innerHTML = html || '<div class="empty">No commitments yet.</div>';
  }

  function renderDonut(byPillar) {
    var total = 0;
    PILLARS.forEach(function (p) { total += Number(byPillar[p.name] || 0); });
    var size = 156, sw = 28, r = (size - sw) / 2, cx = size / 2, C = 2 * Math.PI * r;
    var circles = '';
    if (total > 0) {
      var acc = 0;
      PILLARS.forEach(function (p) {
        var v = Number(byPillar[p.name] || 0);
        if (v <= 0) return;
        var len = (v / total) * C;
        circles += '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + p.color +
          '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
          '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"></circle>';
        acc += len;
      });
    } else {
      circles = '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="#e6eadf" stroke-width="' + sw + '"></circle>';
    }
    var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Pillar mix">' +
      circles +
      '<text x="' + cx + '" y="' + (cx - 4) + '" text-anchor="middle" font-size="30" font-weight="800" fill="#1c2418">' + num(total) + '</text>' +
      '<text x="' + cx + '" y="' + (cx + 16) + '" text-anchor="middle" font-size="11" fill="#5c665a">commitments</text>' +
      '</svg>';
    el('donut').innerHTML = svg;
    var leg = PILLARS.map(function (p) {
      var v = Number(byPillar[p.name] || 0);
      var pct = total ? Math.round((v / total) * 100) : 0;
      return '<div class="li"><span class="sw" style="background:' + p.color + '"></span>' +
        '<span class="lt">' + esc(p.name) + '</span><span class="lv">' + pct + '%</span></div>';
    }).join('');
    el('donutLegend').innerHTML = leg;
  }

  function renderConnections(subs) {
    var freq = {};
    subs.forEach(function (s) {
      (s.worksWith || []).forEach(function (w) {
        var key = String(w || '').trim();
        if (!key) return;
        freq[key] = (freq[key] || 0) + 1;
      });
    });
    var arr = Object.keys(freq).map(function (k) { return { name: k, n: freq[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    if (!arr.length) { el('connections').innerHTML = '<div class="empty">No collaborators named yet.</div>'; return; }
    var max = arr[0].n;
    el('connections').innerHTML = arr.map(function (a) {
      var w = max ? Math.round((a.n / max) * 100) : 0;
      return '<div class="rank"><div class="rl">' + esc(a.name) + '</div>' +
        '<div class="rt"><div class="rtrack"><div class="rfill" style="width:' + w + '%"></div></div>' +
        '<div class="rn">' + num(a.n) + '</div></div></div>';
    }).join('');
  }

  function renderDepartments(subs) {
    var freq = {};
    subs.forEach(function (s) { var d = String(s.department || '').trim(); if (d) freq[d] = (freq[d] || 0) + 1; });
    var arr = Object.keys(freq).map(function (k) { return { name: k, n: freq[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    if (!arr.length) { el('departments').innerHTML = '<div class="empty">No departments yet.</div>'; return; }
    var max = arr[0].n;
    el('departments').innerHTML = arr.map(function (a) {
      var w = max ? Math.round((a.n / max) * 100) : 0;
      return '<div class="rank"><div class="rl">' + esc(a.name) + '</div>' +
        '<div class="rt"><div class="rtrack"><div class="rfill" style="width:' + w + '%;background:#4E8209"></div></div>' +
        '<div class="rn">' + num(a.n) + '</div></div></div>';
    }).join('');
  }

  /* ---------- participation over time ---------- */
  function subDate(s) {
    var d = s.submitted ? new Date(s.submitted) : (s.submittedLocal ? new Date(String(s.submittedLocal).replace(' CT', '')) : null);
    return (d && !isNaN(d.getTime())) ? d : null;
  }
  function ctFmt(d, opts) { try { return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: 'America/Chicago' }, opts)).format(d); } catch (e) { return ''; } }
  function dayKeyOf(d) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); } catch (e) { return ''; } }
  function hour24Of(d) { try { return parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', hour12: false }).format(d), 10); } catch (e) { return 0; } }
  function hourLabel(h) { var ap = h < 12 ? 'AM' : 'PM'; var hh = h % 12; if (hh === 0) hh = 12; return hh + ' ' + ap; }

  function renderTimeline(subs) {
    var host = el('timeline');
    var dated = subs.map(subDate).filter(Boolean);
    if (!dated.length) { host.innerHTML = '<div class="empty">No submissions yet.</div>'; el('timeNote').textContent = 'Teams connecting their work to the strategy, over time.'; return; }
    var dayKeys = {};
    dated.forEach(function (d) { dayKeys[dayKeyOf(d)] = 1; });
    var uniqueDays = Object.keys(dayKeys).filter(Boolean).sort();
    var buckets = []; // {label, sub, count}
    var note = '';

    if (uniqueDays.length <= 1) {
      // single day → bucket by hour
      var hours = dated.map(hour24Of);
      var minH = Math.min.apply(null, hours), maxH = Math.max.apply(null, hours);
      var counts = {};
      hours.forEach(function (h) { counts[h] = (counts[h] || 0) + 1; });
      for (var h = minH; h <= maxH; h += 1) buckets.push({ label: hourLabel(h), sub: '', count: counts[h] || 0 });
      var dayLabel = ctFmt(dated[0], { month: 'long', day: 'numeric' });
      note = 'Teams connecting by hour on ' + dayLabel + '.';
    } else {
      // multiple days → bucket by day (fill gaps when the span is reasonable)
      var counts2 = {};
      dated.forEach(function (d) { var k = dayKeyOf(d); counts2[k] = (counts2[k] || 0) + 1; });
      var first = uniqueDays[0], last = uniqueDays[uniqueDays.length - 1];
      function keyToUTC(k) { var p = k.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
      var spanDays = Math.round((keyToUTC(last) - keyToUTC(first)) / 86400000) + 1;
      var keys;
      if (spanDays <= 31) {
        keys = []; for (var t = keyToUTC(first); t <= keyToUTC(last); t += 86400000) {
          var dd = new Date(t);
          keys.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dd));
        }
      } else { keys = uniqueDays; }
      keys.forEach(function (k) {
        var u = keyToUTC(k);
        buckets.push({
          label: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(u)),
          sub: '', count: counts2[k] || 0
        });
      });
      note = 'Teams connecting each day.';
    }

    var max = buckets.reduce(function (m, b) { return Math.max(m, b.count); }, 0) || 1;
    var showEvery = buckets.length > 14 ? Math.ceil(buckets.length / 14) : 1;
    var html = buckets.map(function (b, i) {
      var hpx = Math.max(3, Math.round((b.count / max) * 132));
      var showLabel = (i % showEvery === 0) || (i === buckets.length - 1);
      return '<div class="tcol" title="' + esc(b.label) + ': ' + b.count + '">' +
        '<div class="tv">' + (b.count ? num(b.count) : '') + '</div>' +
        '<div class="tbar" style="height:' + hpx + 'px' + (b.count ? '' : ';opacity:.35') + '"></div>' +
        '<div class="tx">' + (showLabel ? esc(b.label) : '') + '</div></div>';
    }).join('');
    host.innerHTML = '<div class="timeline">' + html + '</div>';
    el('timeNote').textContent = note;
  }

  /* ---------- submissions browser (search / sort / page through all) ---------- */
  var BR = { subs: [], page: 0, pageSize: 8, sort: 'newest', query: '', pillar: '' };

  function browserView() {
    var list = BR.subs.map(function (e, i) { return { e: e, i: i }; });
    // pillar filter — keep teams with a matching commitment, showing only those commitments
    if (BR.pillar) {
      list = list.map(function (o) {
        var cs = (o.e.commitments || []).filter(function (c) { return c.pillarCode === BR.pillar; });
        return { e: o.e, i: o.i, only: cs };
      }).filter(function (o) { return o.only.length; });
    }
    // text search across team, department, works-with, and commitment text
    if (BR.query) {
      var q = BR.query.toLowerCase();
      list = list.filter(function (o) {
        var hay = [o.e.team, o.e.department, (o.e.worksWith || []).join(' ')]
          .concat((o.e.commitments || []).map(function (c) { return c.commitment; })).join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    // sort
    list.sort(function (a, b) {
      if (BR.sort === 'oldest') return a.i - b.i;
      if (BR.sort === 'team') return String(a.e.team || '').localeCompare(String(b.e.team || ''));
      if (BR.sort === 'dept') return String(a.e.department || '').localeCompare(String(b.e.department || '')) ||
        String(a.e.team || '').localeCompare(String(b.e.team || ''));
      return b.i - a.i; // newest
    });
    return list;
  }

  function renderBrowser() {
    var wrap = el('tablewrap');
    var view = browserView();
    var total = view.length;
    var pages = Math.max(1, Math.ceil(total / BR.pageSize));
    if (BR.page >= pages) BR.page = pages - 1;
    if (BR.page < 0) BR.page = 0;
    var start = BR.page * BR.pageSize;
    var slice = view.slice(start, start + BR.pageSize);

    if (!total) {
      wrap.innerHTML = '<div class="empty">' + (BR.query || BR.pillar ? 'No submissions match your search.' : 'No commitments yet.') + '</div>';
      el('pager').style.display = 'none';
      return;
    }
    var html = '<table><thead><tr>' +
      '<th>Team</th><th>Goal</th><th>Commitment</th><th>When &amp; who they work with</th>' +
      '</tr></thead><tbody>';
    slice.forEach(function (o) {
      var e = o.e;
      var list = o.only || ((e.commitments && e.commitments.length) ? e.commitments : [{ pillar: '', commitment: '' }]);
      var rows = list.length;
      var when = e.submittedLocal || e.submitted || '';
      var works = (e.worksWith || []).join(', ');
      var teamCell = '<div>' + esc(e.team || '') + '</div>' +
        (e.department ? '<div class="meta">' + esc(e.department) + '</div>' : '');
      var metaCell = '<div class="meta">' + esc(when) + '</div>' +
        (works ? '<div class="meta" style="margin-top:4px">Works with: ' + esc(works) + '</div>' : '');
      list.forEach(function (c, i) {
        var goal = c.pillar || '';
        html += '<tr' + (i === 0 ? ' class="teamsep"' : '') + '>';
        if (i === 0) html += '<td class="team-cell" rowspan="' + rows + '">' + teamCell + '</td>';
        html += '<td>' + (goal ? '<span class="pill ' + pillarClass(goal) + '">' + esc(goal) + '</span>' : '') + '</td>';
        html += '<td class="stmt">' + esc(c.commitment || '') + '</td>';
        if (i === 0) html += '<td rowspan="' + rows + '">' + metaCell + '</td>';
        html += '</tr>';
      });
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    var from = start + 1, to = Math.min(start + BR.pageSize, total);
    el('pinfo').textContent = 'Showing ' + from + '–' + to + ' of ' + num(total) + ' teams' +
      (pages > 1 ? '   ·   page ' + (BR.page + 1) + ' of ' + pages : '');
    el('prevPage').disabled = BR.page <= 0;
    el('nextPage').disabled = BR.page >= pages - 1;
    el('pager').style.display = 'flex';
  }

  function wireBrowser() {
    el('tblSearch').addEventListener('input', function (e) { BR.query = e.target.value.trim(); BR.page = 0; renderBrowser(); });
    el('tblPillar').addEventListener('change', function (e) { BR.pillar = e.target.value; BR.page = 0; renderBrowser(); });
    el('tblSort').addEventListener('change', function (e) { BR.sort = e.target.value; BR.page = 0; renderBrowser(); });
    el('prevPage').addEventListener('click', function () { if (BR.page > 0) { BR.page -= 1; renderBrowser(); scrollToTable(); } });
    el('nextPage').addEventListener('click', function () { BR.page += 1; renderBrowser(); scrollToTable(); });
  }
  function scrollToTable() { try { el('tablewrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* noop */ } }

  function load() {
    var k = keyInput.value.trim();
    if (!k) { msg('Enter your export key to load the dashboard.'); return; }
    setLinks(k);
    msg('Loading…');
    fetch('/export.json?key=' + encodeURIComponent(k)).then(function (r) {
      if (r.status === 403) { msg('That key was not accepted. Double-check the EXPORT_KEY in your hosting settings.'); return null; }
      if (!r.ok) { msg('Could not load data (error ' + r.status + ').'); return null; }
      return r.json();
    }).then(function (d) {
      if (!d) return;
      var summary = d.summary || { teams: 0, commitments: 0, byPillar: {} };
      var subs = d.submissions || [];
      var by = summary.byPillar || {};
      el('dash').style.display = 'block';
      el('refresh').style.display = 'inline-flex';
      renderKpis(summary, subs);
      renderTimeline(subs);
      renderPillarBars(by, subs);
      renderDonut(by);
      renderConnections(subs);
      renderDepartments(subs);
      BR.subs = subs; BR.page = 0;
      renderBrowser();
      var gen = d.generatedAt ? new Date(d.generatedAt) : new Date();
      el('asof').textContent = 'As of ' + gen.toLocaleString();
      msg(num(summary.teams || subs.length) + ' teams captured.');
    }).catch(function () { msg('Could not reach the server. Check your connection and try again.'); });
  }

  el('load').addEventListener('click', load);
  el('refresh').addEventListener('click', load);
  keyInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') load(); });
  wireBrowser();

  if (keyInput.value) load();
})();
