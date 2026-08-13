/* OSF Strategy Board — data page.
 * Loads the key-protected export and offers point-and-click downloads.
 * No inline handlers (strict Content-Security-Policy). */
(function () {
  'use strict';
  function qp(n) { try { return new URLSearchParams(location.search).get(n) || ''; } catch (e) { return ''; } }
  function esc(s) { return (s || '').replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var keyInput = document.getElementById('key');
  var msgEl = document.getElementById('msg');
  keyInput.value = qp('key');

  function msg(t) { msgEl.textContent = t || ''; }
  function setLinks(k) {
    document.getElementById('dlcsv').href = '/export?key=' + encodeURIComponent(k);
    document.getElementById('dljson').href = '/export.json?key=' + encodeURIComponent(k);
  }
  function fmtTime(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
  }
  function renderTable(subs) {
    var wrap = document.getElementById('tablewrap');
    if (!subs.length) { wrap.innerHTML = '<div class="empty">No submissions yet.</div>'; return; }
    var recent = subs.slice(-100).reverse();
    var html = '<table><thead><tr><th>When</th><th>Team</th><th>Goal</th><th>Commitment</th><th>Connected to</th></tr></thead><tbody>';
    recent.forEach(function (e) {
      var goal = e.goalName || e.goal || '';
      html += '<tr><td>' + esc(fmtTime(e.ts)) + '</td><td>' + esc(e.team || '') +
        '</td><td>' + (goal ? '<span class="pill">' + esc(goal) + '</span>' : '') + '</td>' +
        '<td class="stmt">' + esc(e.commit || '') + '</td>' +
        '<td>' + esc((e.connections || []).join(', ')) + '</td></tr>';
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
      document.getElementById('count').textContent = Number(d.count || 0).toLocaleString();
      renderTable(d.submissions || []);
      msg(Number(d.count || 0).toLocaleString() + ' submissions captured. Use the buttons above to download everything.');
    }).catch(function () { msg('Could not reach the server. Check your connection and try again.'); });
  }

  document.getElementById('load').addEventListener('click', load);
  document.getElementById('refresh').addEventListener('click', load);
  keyInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') load(); });

  if (keyInput.value) load();
})();
