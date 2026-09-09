'use strict';

/**
 * OSF Leadership Development Institute (LDI) — Leaders' competency board.
 *
 * A separate app from the staff Strategy board. Each leader privately ranks
 * their top leadership competencies and picks skills to strengthen; submissions
 * flow live over WebSocket into a shared board (colored by each leader's #1
 * competency) and are captured for the executive dashboard and export.
 *
 * Runs as its OWN Render web service with its OWN database and EXPORT_KEY —
 * it never touches the staff board's code or data. Same security posture:
 * strict CSP (no inline scripts), WS origin allow-listing, rate limiting,
 * input validation, and no network metadata stored.
 */

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const ExcelJS = require('exceljs');
const db = require('./db-ldi');

// ---- configuration ----
const PORT = Number(process.env.PORT) || 3000;
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 20000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const EXPORT_KEY = process.env.EXPORT_KEY || '';
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || '';

// ---- the leadership framework (server-side allow-lists) ----
const COMPS = ['Model our Mission & Values', 'Personal Growth', 'Communicate Purposefully',
  'Develop People', 'Dynamic Collaborations', 'System Thinking', 'Drive Transformation'];
const SKILLS = ['Values-Driven Leadership', 'Purposeful Compassion', 'Ethical Stewardship', 'Operational Integrity',
  'Emotional Intelligence: Self-Awareness', 'Emotional Intelligence: Self-Management', 'Feedback', 'Learning Agility',
  'Active Listening', 'Clarity & Transparency', 'Constructive Communication', 'Strategic Alignment', 'Clear Expectations',
  'Compassionate Accountability', 'Coaching for Growth', 'Performance Analytics', 'Continuous Improvement',
  'Emotional Intelligence: Social Awareness', 'Emotional Intelligence: Relationship Management',
  'Cross-Functional Collaboration', 'Diversity & Inclusion', 'Data-Informed Planning', 'Business Acumen',
  'Process Optimization', 'Strategic Foresight', 'Cultivating Innovation', 'Inspires Change', 'Strategic Execution'];
const COMP_SET = new Set(COMPS);
const SKILL_SET = new Set(SKILLS);

const LIMITS = {
  name: 60, division: 80, role: 60, comps: 2, skills: 3, approach: 280,
  captured: 200000, msgBytes: 8 * 1024,
  minIntervalMs: 400, windowMs: 10000, maxPerWindow: 6,
};

// ---- shared state ----
const state = { count: 0 };
const captured = [];
const reactions = Object.create(null); // id -> {heart,clap} (in-memory; resets on redeploy)
let idSeq = 0;

// ---- helpers ----
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, max);
}
function originAllowed(origin, host) {
  if (!origin) return false;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (ALLOWED_ORIGINS.length) return ALLOWED_ORIGINS.includes(parsed.origin);
  return parsed.host === host;
}
function fmtCentral(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return `${new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', year: 'numeric', month: 'short', day: '2-digit',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d)} CT`;
  } catch { return d.toISOString(); }
}
function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
// validate & normalize a submission's competencies -> [{name, rank}] (rank 1..2)
function cleanComps(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(); const out = [];
  for (const c of value) {
    if (out.length >= LIMITS.comps) break;
    if (!c || typeof c !== 'object') continue;
    const name = String(c.name || '');
    if (!COMP_SET.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, rank: out.length + 1 }); // rank by submitted order
  }
  return out;
}
function cleanSkills(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(); const out = [];
  for (const s of value) {
    if (out.length >= LIMITS.skills) break;
    const name = String(s || '');
    if (!SKILL_SET.has(name) || seen.has(name)) continue;
    seen.add(name); out.push(name);
  }
  return out;
}

function ensureId(e) { if (!e.id) e.id = 'L' + Date.now().toString(36) + (idSeq++).toString(36); return e.id; }
// public, in-room-safe view of a leader's card (no last name)
function publicCard(e) {
  const rk = reactions[e.id] || { heart: 0, clap: 0 };
  return { id: e.id, first: e.first || '', division: e.division || '', role: e.role || '',
    comps: e.comps || [], skills: e.skills || [], approach: e.approach || '',
    react: { heart: rk.heart || 0, clap: rk.clap || 0 } };
}
function applyEntry() { state.count += 1; }

// ---- exec filters (used by dashboard + downloads) ----
function yearsBucket(y) {
  if (y === null || y === undefined || Number.isNaN(y)) return '';
  if (y <= 2) return '0-2'; if (y <= 5) return '3-5'; if (y <= 10) return '6-10'; return '11+';
}
function passesFilter(e, f) {
  if (f.division && String(e.division || '').toLowerCase() !== f.division.toLowerCase()) return false;
  if (f.role && String(e.role || '') !== f.role) return false;
  if (f.years && yearsBucket(e.years) !== f.years) return false;
  return true;
}
function readFilter(q) {
  return { division: (q.division || '').trim(), role: (q.role || '').trim(), years: (q.years || '').trim() };
}
function filterTag(f) {
  const bits = [];
  if (f.division) bits.push(f.division.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (f.role) bits.push(f.role.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  if (f.years) bits.push(f.years);
  return bits.length ? `-${bits.join('-')}` : '';
}

// ---- HTTP ----
const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

app.get('/status', (_req, res) => {
  res.json({
    ok: true, app: 'ldi-leaders',
    storage: db.mode, durable: db.mode === 'postgres',
    leadersStored: captured.length,
    exportKeyConfigured: Boolean(EXPORT_KEY),
    allowedOriginsConfigured: ALLOWED_ORIGINS.length > 0,
    uptimeSeconds: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
  });
});

function subView(e) {
  return {
    submitted: e.ts || '', submittedLocal: fmtCentral(e.ts),
    first: e.first || '', last: e.last || '',
    division: e.division || '', role: e.role || '',
    years: (e.years === null || e.years === undefined) ? null : e.years,
    comps: (e.comps || []).map((c) => ({ name: c.name, rank: c.rank })),
    skills: e.skills || [],
    approach: e.approach || '',
  };
}

app.get('/export.json', (req, res) => {
  if (!EXPORT_KEY || req.query.key !== EXPORT_KEY) return res.status(403).json({ error: 'Forbidden' });
  const f = readFilter(req.query);
  const subs = captured.filter((e) => passesFilter(e, f)).map(subView);
  res.json({ generatedAt: new Date().toISOString(), app: 'ldi-leaders', filter: f, count: subs.length, submissions: subs });
});

app.get('/export', (req, res) => {
  if (!EXPORT_KEY || req.query.key !== EXPORT_KEY) return res.status(403).type('text/plain').send('Forbidden');
  const f = readFilter(req.query);
  const rows = [[
    'Submitted (Central Time)', 'First Name', 'Last Name', 'Division', 'Leadership Role',
    'Years of Leadership Experience', 'Competency #1', 'Competency #2', 'Skills to Strengthen',
    'How I\'ll Work On It',
  ].map(csvCell).join(',')];
  for (const e of captured) {
    if (!passesFilter(e, f)) continue;
    const c1 = (e.comps && e.comps[0]) ? e.comps[0].name : '';
    const c2 = (e.comps && e.comps[1]) ? e.comps[1].name : '';
    rows.push([
      fmtCentral(e.ts), e.first || '', e.last || '', e.division || '', e.role || '',
      (e.years === null || e.years === undefined) ? '' : e.years, c1, c2, (e.skills || []).join('; '),
      e.approach || '',
    ].map(csvCell).join(','));
  }
  const csv = `﻿${rows.join('\r\n')}\r\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="osf-ldi-leaders${filterTag(f)}-${stamp}.csv"`);
  res.type('text/csv; charset=utf-8').send(csv);
});

// ---- Excel workbook ----
const XL = {
  brand: 'FF4E8209', ink: 'FF1C2418', muted: 'FF5C665A', line: 'FFE3E7DD', band: 'FFF6F8F1', white: 'FFFFFFFF',
};
function thinBorder() { const s = { style: 'thin', color: { argb: XL.line } }; return { top: s, left: s, bottom: s, right: s }; }
function buildWorkbook(f) {
  const list = captured.filter((e) => passesFilter(e, f));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OSF LDI Leaders'; wb.created = new Date();

  // Sheet 1: Leaders (one row per leader)
  const ws = wb.addWorksheet('Leaders', { views: [{ state: 'frozen', ySplit: 5 }] });
  const widths = [22, 16, 16, 22, 20, 12, 26, 26, 40, 50];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.mergeCells('A1:J1');
  const t = ws.getCell('A1'); t.value = 'OSF HealthCare  ·  Leadership Development Institute';
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: XL.white } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; ws.getRow(1).height = 30;
  ws.mergeCells('A2:J2');
  const sub = ws.getCell('A2');
  const scope = [f.division && ('Division: ' + f.division), f.role && ('Role: ' + f.role), f.years && ('Experience: ' + f.years + ' yrs')].filter(Boolean).join('   ·   ') || 'All leaders';
  sub.value = `${scope}   ·   Generated ${fmtCentral(new Date().toISOString())}`;
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: XL.muted } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }; ws.getRow(2).height = 18;
  ws.mergeCells('A3:J3');
  ws.getCell('A3').value = `${list.length} leaders`;
  ws.getCell('A3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: XL.ink } };
  ws.getCell('A3').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(4).height = 6;
  const heads = ['Submitted (Central Time)', 'First Name', 'Last Name', 'Division', 'Leadership Role',
    'Years', 'Competency #1', 'Competency #2', 'Skills to Strengthen', 'How I\'ll Work On It'];
  const hr = ws.getRow(5);
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1); c.value = h;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }; c.border = thinBorder();
  });
  hr.height = 28;
  let r = 6; let band = false;
  list.forEach((e) => {
    const row = ws.getRow(r);
    const vals = [fmtCentral(e.ts), e.first || '', e.last || '', e.division || '', e.role || '',
      (e.years === null || e.years === undefined) ? '' : e.years,
      (e.comps[0] || {}).name || '', (e.comps[1] || {}).name || '', (e.skills || []).join(', '),
      e.approach || ''];
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1); c.value = v; c.border = thinBorder();
      c.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
      c.font = { name: 'Calibri', size: 11, color: { argb: XL.ink } };
      if (band) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.band } };
    });
    row.height = 26; r += 1; band = !band;
  });
  if (!list.length) { ws.mergeCells('A6:J6'); ws.getCell('A6').value = 'No leaders captured yet.'; ws.getCell('A6').font = { italic: true, color: { argb: XL.muted } }; }
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 10 } };

  // Sheet 2: Competency summary (rank-weighted)
  const cs = wb.addWorksheet('Competency Summary');
  cs.getColumn(1).width = 32; cs.getColumn(2).width = 16; cs.getColumn(3).width = 14; cs.getColumn(4).width = 14;
  ['Competency', 'Weighted Score', 'Chose #1', 'Chose #2'].forEach((h, i) => {
    const c = cs.getRow(1).getCell(i + 1); c.value = h;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } }; c.border = thinBorder();
  });
  const score = {}, n1 = {}, n2 = {}; COMPS.forEach((n) => { score[n] = 0; n1[n] = 0; n2[n] = 0; });
  list.forEach((e) => { (e.comps || []).forEach((c) => { if (c.rank === 1) { score[c.name] += 2; n1[c.name] += 1; } else { score[c.name] += 1; n2[c.name] += 1; } }); });
  const ranked = COMPS.slice().sort((a, b) => score[b] - score[a]);
  let rr = 2;
  ranked.forEach((n) => {
    const row = cs.getRow(rr);
    [n, score[n], n1[n], n2[n]].forEach((v, i) => { const c = row.getCell(i + 1); c.value = v; c.border = thinBorder(); c.font = { name: 'Calibri', size: 11, color: { argb: XL.ink } }; });
    rr += 1;
  });

  // Sheet 3: Skill summary
  const sk = wb.addWorksheet('Skill Summary');
  sk.getColumn(1).width = 42; sk.getColumn(2).width = 14;
  ['Skill', 'Times Chosen'].forEach((h, i) => {
    const c = sk.getRow(1).getCell(i + 1); c.value = h;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: XL.white } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } }; c.border = thinBorder();
  });
  const sc = {}; SKILLS.forEach((s) => { sc[s] = 0; });
  list.forEach((e) => { (e.skills || []).forEach((s) => { if (sc[s] !== undefined) sc[s] += 1; }); });
  const skRanked = SKILLS.slice().filter((s) => sc[s] > 0).sort((a, b) => sc[b] - sc[a]);
  let sr = 2;
  skRanked.forEach((s) => { const row = sk.getRow(sr); [s, sc[s]].forEach((v, i) => { const c = row.getCell(i + 1); c.value = v; c.border = thinBorder(); c.font = { name: 'Calibri', size: 11, color: { argb: XL.ink } }; }); sr += 1; });

  return wb;
}

app.get('/export.xlsx', async (req, res) => {
  if (!EXPORT_KEY || req.query.key !== EXPORT_KEY) return res.status(403).type('text/plain').send('Forbidden');
  const f = readFilter(req.query);
  try {
    const wb = buildWorkbook(f);
    const buf = await wb.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="osf-ldi-leaders${filterTag(f)}-${stamp}.xlsx"`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(buf));
  } catch (err) {
    console.error('ldi xlsx failed:', err.message); // eslint-disable-line no-console
    res.status(500).type('text/plain').send('Could not build the Excel file.');
  }
});

app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use(express.static(`${__dirname}/public-leaders`, { maxAge: 0, etag: true, index: ['index.html'], dotfiles: 'ignore' }));

const server = http.createServer(app);

// ---- WebSocket ----
const wss = new WebSocketServer({
  server, maxPayload: LIMITS.msgBytes,
  verifyClient: (info, done) => {
    if (wss.clients.size >= MAX_CLIENTS) return done(false, 503, 'Capacity reached');
    return done(originAllowed(info.origin, info.req.headers.host), 403, 'Forbidden');
  },
});
function broadcastExcept(sender, payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) { if (client !== sender && client.readyState === 1) client.send(message); }
}
function broadcastAll(payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) { if (client.readyState === 1) client.send(message); }
}
function reactionLimited(ws) {
  const now = Date.now();
  if (now - (ws.reactWindowStart || 0) > 10000) { ws.reactWindowStart = now; ws.reactCount = 0; }
  if ((ws.reactCount || 0) >= 40) return true;
  ws.reactCount = (ws.reactCount || 0) + 1; return false;
}
function handleReact(ws, data) {
  if (reactionLimited(ws)) return;
  const id = String(data.id || '');
  const kind = data.kind === 'clap' ? 'clap' : (data.kind === 'heart' ? 'heart' : null);
  if (!kind || !reactions[id]) return;
  reactions[id][kind] = (reactions[id][kind] || 0) + 1;
  broadcastAll({ type: 'reactions', id, heart: reactions[id].heart, clap: reactions[id].clap });
}
function rateLimited(ws) {
  const now = Date.now();
  if (now - ws.lastMessageAt < LIMITS.minIntervalMs) return true;
  if (now - ws.windowStartedAt > LIMITS.windowMs) { ws.windowStartedAt = now; ws.windowCount = 0; }
  if (ws.windowCount >= LIMITS.maxPerWindow) return true;
  ws.windowCount += 1; ws.lastMessageAt = now; return false;
}
function feedForInit() { return captured.slice(-200).reverse().map(publicCard); }

wss.on('connection', (ws) => {
  ws.isAlive = true; ws.lastMessageAt = 0; ws.windowStartedAt = Date.now(); ws.windowCount = 0;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});
  ws.send(JSON.stringify({ type: 'init', count: state.count, feed: feedForInit() }));

  ws.on('message', (raw) => {
    if (raw.length > LIMITS.msgBytes) return;
    let data; try { data = JSON.parse(raw); } catch { return; }
    if (data && data.type === 'react') { handleReact(ws, data); return; } // own limiter
    if (rateLimited(ws)) return;
    if (!data || data.type !== 'submit') return;

    const comps = cleanComps(data.comps);
    if (!comps.length) return; // at least one competency required
    const skills = cleanSkills(data.skills);
    const entry = {
      ts: new Date().toISOString(),
      first: cleanText(data.first, LIMITS.name),
      last: cleanText(data.last, LIMITS.name),
      division: cleanText(data.division, LIMITS.division),
      role: cleanText(data.role, LIMITS.role),
      years: (function () { const n = Number(data.years); return Number.isFinite(n) && n >= 0 && n <= 80 ? n : null; })(),
      comps, skills,
      approach: cleanText(data.approach, LIMITS.approach),
    };
    ensureId(entry); reactions[entry.id] = { heart: 0, clap: 0 };
    applyEntry();
    captured.push(entry);
    if (captured.length > LIMITS.captured) captured.shift();
    db.insert(entry);

    const item = publicCard(entry);
    ws.send(JSON.stringify({ type: 'accepted', item, count: state.count }));
    broadcastExcept(ws, { type: 'add', item, count: state.count });
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) { if (ws.isAlive === false) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch { /* noop */ } }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

if (SELF_URL && process.env.KEEPALIVE !== 'off' && typeof fetch === 'function') {
  const url = `${SELF_URL.replace(/\/$/, '')}/healthz`;
  setInterval(() => { fetch(url).catch(() => {}); }, 10 * 60 * 1000);
}

(async () => {
  try {
    await db.init();
    const rows = await db.loadAll();
    for (const e of rows) { ensureId(e); reactions[e.id] = { heart: 0, clap: 0 }; captured.push(e); applyEntry(); }
    if (captured.length > LIMITS.captured) captured.splice(0, captured.length - LIMITS.captured);
    console.log(`LDI: loaded ${rows.length} leaders from ${db.mode} storage.`); // eslint-disable-line no-console
  } catch (err) {
    console.error('LDI storage init failed; starting empty:', err.message); // eslint-disable-line no-console
  }
  server.listen(PORT, () => { console.log(`OSF LDI Leaders listening on ${PORT} (${db.mode})`); }); // eslint-disable-line no-console
})();
