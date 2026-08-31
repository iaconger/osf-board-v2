'use strict';

/**
 * Storage layer for captured Strategy Commitment Cards.
 *
 * - In production, set DATABASE_URL (Render provisions a managed PostgreSQL
 *   database and injects this automatically via render.yaml). Cards are stored
 *   in a real database that survives restarts, redeploys, and scaling.
 * - With no DATABASE_URL (e.g. local development), it falls back to an
 *   append-only JSON-lines file so the app runs with zero setup.
 */

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'submissions.jsonl');
const mode = DATABASE_URL ? 'postgres' : 'file';

let pool = null;

async function init() {
  if (mode === 'postgres') {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)/.test(DATABASE_URL) || /\bsslmode=disable\b/.test(DATABASE_URL);
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: local ? false : { rejectUnauthorized: false }, // managed hosts (Render) require SSL
      max: 5,
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS submissions (
      id          BIGSERIAL PRIMARY KEY,
      ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
      team        TEXT NOT NULL,
      work        TEXT DEFAULT '',
      connections JSONB DEFAULT '[]'::jsonb,
      reach       TEXT DEFAULT '',
      commitment  TEXT NOT NULL,
      goal        TEXT DEFAULT ''
    )`);
    // Store every commitment on a card (with its pillar) so nothing is lost on
    // reload. Added via ALTER so existing databases pick it up on next deploy.
    await pool.query(`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS commitments JSONB DEFAULT '[]'::jsonb`);
  } else {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  }
}

// Load every stored card (oldest first) so the live board can be rebuilt on startup.
async function loadAll() {
  if (mode === 'postgres') {
    const { rows } = await pool.query(
      'SELECT ts, team, work, connections, reach, commitment, goal, commitments FROM submissions ORDER BY id ASC'
    );
    return rows.map((r) => {
      let commitments = Array.isArray(r.commitments) ? r.commitments : [];
      // older rows predate the commitments column: rebuild from the legacy pair
      if (!commitments.length) commitments = [{ text: r.commitment || '', goal: r.goal || '' }];
      return {
        ts: r.ts ? new Date(r.ts).toISOString() : '',
        team: r.team,
        work: r.work || '',
        connections: Array.isArray(r.connections) ? r.connections : [],
        reach: r.reach || '',
        commitments,
        commit: commitments[0] ? commitments[0].text : (r.commitment || ''),
        goal: r.goal || '',
      };
    });
  }
  const out = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      for (const line of fs.readFileSync(DATA_FILE, 'utf8').split('\n')) {
        if (!line) continue;
        try { out.push(JSON.parse(line)); } catch { /* skip malformed line */ }
      }
    }
  } catch { /* ignore read errors */ }
  return out;
}

// Persist one card. Fire-and-forget: a storage hiccup never blocks the live board.
function insert(entry) {
  if (mode === 'postgres') {
    const commitments = Array.isArray(entry.commitments) && entry.commitments.length
      ? entry.commitments
      : [{ text: entry.commit || '', goal: entry.goal || '' }];
    pool.query(
      'INSERT INTO submissions (ts, team, work, connections, reach, commitment, goal, commitments) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [entry.ts, entry.team, entry.work || '', JSON.stringify(entry.connections || []), entry.reach || '', entry.commit, entry.goal || '', JSON.stringify(commitments)]
    ).catch((err) => { console.error('db insert failed:', err.message); }); // eslint-disable-line no-console
  } else {
    try { fs.appendFile(DATA_FILE, `${JSON.stringify(entry)}\n`, () => {}); } catch { /* ignore */ }
  }
}

module.exports = { init, loadAll, insert, mode };
