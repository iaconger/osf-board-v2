/* OSF Strategy Board — data page.
 * Loads the key-protected export, shows an at-a-glance summary, and offers
 * point-and-click downloads. No inline handlers (strict Content-Security-Policy). */
(function () {
  'use strict';
  function qp(n) { try { return new URLSearchParams(location.search).get(n) || ''; } catch (e) { return ''; } }
  function esc(s) { return (s || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var PILLARS = [
    { name: 'Excellence', color: '#64A70B', cls: 'g1' },
    { name: 'One OSF Team', color: '#00A9CE', cls: 'g2' },
    { name: 'Destination OSF', color: '#A5228E', cls: 'g3' },
    { name: 'Unassigned', color: '#9aa295', cls: '' }
  ];
  function pillarClass(name) {
    for (var i = 0; i < PILLARS.length; i++) if (PILLARS[i].name === name) return PILLARS[i].cls;
    return '';
  }

  var keyInput = document.getElementById('key');
  var msgEl = document.getElementById('msg');
  keyInput.value = qp('key');

  function msg(t) { msgEl.textContent = t || ''; }
  function setLinks(k) {
    var ek = encodeURIComponent(k);
    document.getElementById('dlcsv').href = '/export?key=' + ek;
    document.getElementById('dljson').href = '/export.json?key=' + ek;
    document.getElementById('dlg1').href = '/export?key=' + ek + '&pillar=g1';
    document.getElementById('dlg2').href = '/export?key=' + ek + '&pillar=g2';
    document.getElementById('dlg3').href = '/export?key=' + ek + '&pillar=g3';
  }

  function renderSummary(s) {
    s = s || { teams: 0, commitments: 0, byPillar: {} };
    document.getElementById('kTeams').textContent = Number(s.teams || 0).toLocaleString();
    document.getElementById('kCommits').textContent = Number(s.commitments || 0).toLocaleString();
    var by = s.byPillar || {};
    var max = 0;
    PILLARS.forEach(function (p) { max = Math.max(max, Number(by[p.name] || 0)); });
    var html = '';
    PILLARS.forEach(function (p) {
      var n = Number(by[p.name] || 0);
      if (p.name === 'Unassigned' && n === 0) return; // hide empty catch-all
      var pct = max ? Math.round((n / max) * 100) : 0;
      html += '<div class="bar"><div class="bl">' + esc(p.name) + '</div>' +
        '<div class="track"><div class="fill" style="width:' + pct + '%;background:' + p.color + '"></div></div>' +
        '<div class="bn">' + n.toLocaleString() + '</div></div>';
    });
    document.getElementById('barlist').innerHTML = html;
    document.getElementById('bars').style.display = 'block';
  }

  function renderTable(subs) {
    var wrap = document.getElementById('tablewrap');
    if (!subs.length) { wrap.innerHTML = '<div class="empty">No submissions yet.</div>'; return; }
    var recent = subs.slice(-100).reverse();
    var html = '<table><thead><tr><th>When</th><th>Department</th><th>Team</th>' +
      '<th>Goal</th><th>Commitment</th><th>Works with</th></tr></thead><tbody>';
    recent.forEach(function (e) {
      var when = e.submittedLocal || e.submitted || '';
      var dept = e.department || '';
      var team = e.team || '';
      var works = (e.worksWith || []).join(', ');
      var list = e.commitments && e.commitments.length ? e.commitments : [{ pillar: '', commitment: '' }];
      list.forEach(function (c, i) {
        var goal = c.pillar || '';
        html += '<tr><td>' + esc(i === 0 ? when : '') + '</td>' +
          '<td>' + esc(i === 0 ? dept : '') + '</td>' +
          '<td>' + esc(i === 0 ? team : '') + '</td>' +
          '<td>' + (goal ? '<span class="pill ' + pillarClass(goal) + '">' + esc(goal) + '</span>' : '') + '</td>' +
          '<td class="stmt">' + esc(c.commitment || '') + '</td>' +
          '<td>' + esc(i === 0 ? works : '') + '</td></tr>';
      });
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function load() {
    var k = keyInput.value.trim();
    if (!k) { msg('Enter your export key to load the data.'); return; }
    setLinks(k);
    msg('Loading…');
    fetch('/export.json?key=' + encodeURIComponent(k)).then(function (r) {
      if (r.status === 403) { msg('That key was not accepted. Double-check the EXPORT_KEY in your hosting settings.'); return null; }
      if (!r.ok) { msg('Could not load data (error ' + r.status + ').'); return null; }
      return r.json();
    }).then(function (d) {
      if (!d) return;
      document.getElementById('results').style.display = 'block';
      document.getElementById('dl').style.display = 'block';
      document.getElementById('tablecard').style.display = 'block';
      renderSummary(d.summary);
      renderTable(d.submissions || []);
      var teams = (d.summary && d.summary.teams) || d.count || 0;
      msg(Number(teams).toLocaleString() + ' teams captured. Use the buttons above to download everything.');
    }).catch(function () { msg('Could not reach the server. Check your connection and try again.'); });
  }

  document.getElementById('load').addEventListener('click', load);
  document.getElementById('refresh').addEventListener('click', load);
  keyInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') load(); });

  if (keyInput.value) load();
})();
