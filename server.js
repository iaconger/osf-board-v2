'use strict';

/**
 * OSF FY27 Strategy Commitment — real-time shared board.
 *
 * A team walks through the strategy together on one device, fills out their
 * Strategy Commitment Card, and adds it to the board. Every submission flows
 * live over WebSocket into the shared "heart" (this device's board and any
 * big-screen viewer) and is captured for export.
 *
 * No personal data is requested: teams enter a team name (an org unit, not a
 * person), the teams they work with, and short free-text answers. No names,
 * emails, IP addresses, or network metadata are stored.
 *
 * Security posture (see README "Security"):
 *   - Strict security headers via Helmet, including a Content-Security-Policy
 *     that forbids inline scripts (all client logic is in /app.js, /screen.js).
 *   - WebSocket origin allow-listing and a bounded message size.
 *   - Per-connection rate limiting and input validation on every submission.
 *   - All user-supplied text is escaped at render time on the client.
 */

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const { WebSocketServer } = require('ws');
const db = require('./db');

// ---- configuration (override via environment) ----
const PORT = Number(process.env.PORT) || 3000;
const SEED_COUNT = process.env.SEED_COUNT !== undefined ? Number(process.env.SEED_COUNT) : 0;
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 20000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const EXPORT_KEY = process.env.EXPORT_KEY || '';                 // required to download captured data
const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || '';

const GOALS = ['g1', 'g2', 'g3']; // Excellence / One OSF Team / Destination OSF

const LIMITS = {
  team: 70, work: 140, reach: 240, commit: 200,
  commitments: 12,
  connItem: 40, connsMax: 12,
  feed: 400,
  captured: 200000,
  msgBytes: 8 * 1024,
  minIntervalMs: 400,
  windowMs: 10000,
  maxPerWindow: 6,
};

const BLOCKED = ['damn', 'hell', 'crap', 'shit', 'fuck', 'bitch', 'ass', 'bastard'];

// The board captures real submissions only. To show example commitments for a
// demo instead, set SEED_FEED_ON=1.
const SEED_FEED = !process.env.SEED_FEED_ON ? [] : [
  { team: '4 South · Peoria · Nursing', commit: 'Round on every patient within 15 minutes of a call light.', goal: 'g1' },
  { team: 'Inpatient Pharmacy · Pharmacy', commit: 'Cut discharge medication wait times in half.', goal: 'g1' },
  { team: 'Service Desk · OSF Digital / IT', commit: 'Resolve clinician tickets faster so they stay at the bedside.', goal: 'g2' },
  { team: 'Central Supply · Supply Chain', commit: 'Never let a unit run short on a critical supply.', goal: 'g2' },
  { team: 'Patient Financial Services · Revenue Cycle', commit: 'Make every bill clear enough that no patient calls confused.', goal: 'g3' },
  { team: 'EVS · Rockford · Environmental Services', commit: 'Turn rooms over quickly so patients are seen sooner.', goal: 'g1' },
  { team: 'OSF Foundation · Foundation', commit: 'Fund two new community health programs this year.', goal: 'g3' },
  { team: 'Care Coordination · Care Management', commit: 'Make sure no patient leaves without a follow-up plan.', goal: 'g2' },
];

// ---- shared state ----
const state = { count: SEED_COUNT, feed: [] };
const captured = []; // every accepted submission

// ---- helpers ----
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/[<>]/g, '').trim().slice(0, max);
  const padded = ` ${trimmed.toLowerCase()} `;
  if (BLOCKED.some((w) => padded.includes(` ${w} `))) return null;
  return trimmed;
}

function cleanConnections(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    if (out.length >= LIMITS.connsMax) break;
    const c = cleanText(raw, LIMITS.connItem);
    if (c) out.push(c);
  }
  return out;
}

function originAllowed(origin, host) {
  if (!origin) return false;
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (ALLOWED_ORIGINS.length) return ALLOWED_ORIGINS.includes(parsed.origin);
  return parsed.host === host;
}

function applyEntry(e) {
  state.count += 1;
  state.feed.push({ team: e.team, commit: e.commit, goal: e.goal || '' });
  if (state.feed.length > LIMITS.feed) state.feed.shift();
}

function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralize spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

// readable strategic-pillar names, used everywhere data leaves the server
const GOAL_NAME = { g1: 'Excellence', g2: 'One OSF Team', g3: 'Destination OSF' };

// ISO -> "Aug 28, 2026, 9:15 AM CT" so a shared report reads naturally
function fmtCentral(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return `${new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d)} CT`;
  } catch { return d.toISOString(); }
}

// teams are stored as "Department · Team"; split for tidy columns
function splitTeam(t) {
  const s = String(t || '');
  const i = s.indexOf(' · ');
  return i >= 0 ? { dept: s.slice(0, i), team: s.slice(i + 3) } : { dept: '', team: s };
}

function commitmentList(e) {
  return Array.isArray(e.commitments) && e.commitments.length
    ? e.commitments
    : [{ text: e.commit || '', goal: e.goal || '' }];
}

// at-a-glance counts: teams, commitments, and how they split across pillars
function summarize() {
  const p = { g1: 0, g2: 0, g3: 0, none: 0 };
  let commitments = 0;
  for (const e of captured) {
    for (const c of commitmentList(e)) {
      commitments += 1;
      if (p[c.goal] !== undefined) p[c.goal] += 1; else p.none += 1;
    }
  }
  return {
    teams: captured.length,
    commitments,
    byPillar: {
      Excellence: p.g1,
      'One OSF Team': p.g2,
      'Destination OSF': p.g3,
      Unassigned: p.none,
    },
  };
}

// most recent real commitments first, padded with examples so the board is lively
function feedForInit() {
  const real = state.feed.slice(-40).reverse().map((e) => ({ team: e.team, commit: e.commit, goal: e.goal || '' }));
  const combined = real.concat(SEED_FEED);
  return combined.slice(0, 40);
}

// ---- HTTP app ----
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
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));

app.get('/export', (req, res) => {
  if (!EXPORT_KEY || req.query.key !== EXPORT_KEY) return res.status(403).type('text/plain').send('Forbidden');
  const rows = [[
    'Submitted (Central Time)', 'Department', 'Team', 'Strategic Goal',
    'What We Do', 'Teams We Work With', 'How Our Work Reaches Patients',
    'Commitment #', 'Commitment',
  ].map(csvCell).join(',')];
  for (const e of captured) {
    const { dept, team } = splitTeam(e.team);
    const list = commitmentList(e);
    // one tidy row per commitment, so nothing is lost and every row stands alone
    list.forEach((c, i) => {
      rows.push([
        fmtCentral(e.ts), dept, team, GOAL_NAME[c.goal] || '',
        e.work || '', (e.connections || []).join('; '), e.reach || '',
        String(i + 1), c.text || '',
      ].map(csvCell).join(','));
    });
  }
  // BOM + CRLF so Excel opens it with correct encoding and clean line breaks
  const csv = `﻿${rows.join('\r\n')}\r\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="osf-strategy-commitments-${stamp}.csv"`);
  res.type('text/csv; charset=utf-8').send(csv);
});
app.get('/export.json', (req, res) => {
  if (!EXPORT_KEY || req.query.key !== EXPORT_KEY) return res.status(403).json({ error: 'Forbidden' });
  res.json({
    generatedAt: new Date().toISOString(),
    count: captured.length,
    summary: summarize(),
    submissions: captured.map((e) => {
      const { dept, team } = splitTeam(e.team);
      return {
        submitted: e.ts || '',
        submittedLocal: fmtCentral(e.ts),
        department: dept,
        team,
        whatWeDo: e.work || '',
        worksWith: e.connections || [],
        reachesPatient: e.reach || '',
        commitments: commitmentList(e).map((c) => ({
          pillar: GOAL_NAME[c.goal] || '',
          pillarCode: c.goal || '',
          commitment: c.text || '',
        })),
      };
    }),
  });
});

app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use(express.static(`${__dirname}/public`, { maxAge: 0, etag: true, index: ['index.html'], dotfiles: 'ignore' }));

const server = http.createServer(app);

// ---- WebSocket relay ----
const wss = new WebSocketServer({
  server,
  maxPayload: LIMITS.msgBytes,
  verifyClient: (info, done) => {
    if (wss.clients.size >= MAX_CLIENTS) return done(false, 503, 'Capacity reached');
    return done(originAllowed(info.origin, info.req.headers.host), 403, 'Forbidden');
  },
});

function broadcastExcept(sender, payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client !== sender && client.readyState === 1) client.send(message);
  }
}

function rateLimited(ws) {
  const now = Date.now();
  if (now - ws.lastMessageAt < LIMITS.minIntervalMs) return true;
  if (now - ws.windowStartedAt > LIMITS.windowMs) { ws.windowStartedAt = now; ws.windowCount = 0; }
  if (ws.windowCount >= LIMITS.maxPerWindow) return true;
  ws.windowCount += 1;
  ws.lastMessageAt = now;
  return false;
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.lastMessageAt = 0;
  ws.windowStartedAt = Date.now();
  ws.windowCount = 0;

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => { /* ignore transport errors */ });

  ws.send(JSON.stringify({ type: 'init', count: state.count, feed: feedForInit() }));

  ws.on('message', (raw) => {
    if (raw.length > LIMITS.msgBytes) return;
    if (rateLimited(ws)) return;

    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (!data || data.type !== 'submit') return;

    const team = cleanText(data.team, LIMITS.team) || 'A Mission Team';
    const work = cleanText(data.work, LIMITS.work);
    const reach = cleanText(data.reach, LIMITS.reach);
    const connections = cleanConnections(data.connections);

    // A team makes one commitment per strategy pillar, and can add more.
    // All of them are captured for export, but the team joins the board as ONE card.
    const rawList = Array.isArray(data.commitments) ? data.commitments.slice(0, LIMITS.commitments) : [];
    const clean = [];
    for (const c of rawList) {
      if (!c || typeof c !== 'object') continue;
      const text = cleanText(c.text, LIMITS.commit);
      const goal = GOALS.includes(c.goal) ? c.goal : '';
      if (text === null) {
        ws.send(JSON.stringify({ type: 'rejected', reason: 'Please reword and try again.' }));
        return;
      }
      if (!text || !goal) continue;
      clean.push({ text, goal });
    }

    if (work === null || reach === null) {
      ws.send(JSON.stringify({ type: 'rejected', reason: 'Please reword and try again.' }));
      return;
    }
    if (!clean.length) return; // at least one valid commitment is required

    const ts = new Date().toISOString();
    // one stored card per team, carrying every commitment for export
    const entry = {
      ts, team, work: work || '', connections, reach: reach || '',
      commitments: clean, commit: clean[0].text, goal: '',
    };
    applyEntry(entry);        // one dot, count += 1
    captured.push(entry);
    if (captured.length > LIMITS.captured) captured.shift();
    db.insert(entry);

    const item = { team, commit: clean[0].text, goal: '' };
    ws.send(JSON.stringify({ type: 'accepted', item, count: state.count }));
    broadcastExcept(ws, { type: 'add', item, count: state.count });
  });
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* noop */ }
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

if (SELF_URL && process.env.KEEPALIVE !== 'off' && typeof fetch === 'function') {
  const url = `${SELF_URL.replace(/\/$/, '')}/healthz`;
  setInterval(() => { fetch(url).catch(() => {}); }, 10 * 60 * 1000);
}

// Initialize storage, rebuild the live board from stored cards, then start serving.
(async () => {
  try {
    await db.init();
    const rows = await db.loadAll();
    for (const e of rows) { captured.push(e); applyEntry(e); }
    if (captured.length > LIMITS.captured) captured.splice(0, captured.length - LIMITS.captured);
    // eslint-disable-next-line no-console
    console.log(`Loaded ${rows.length} stored cards from ${db.mode} storage.`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Storage init failed; starting with an empty board:', err.message);
  }
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`OSF Strategy Commitment board listening on port ${PORT} (${db.mode} storage)`);
  });
})();
