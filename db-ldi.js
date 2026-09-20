'use strict';

/**
 * Storage layer for the LDI Leaders' app (competency prioritization).
 * Separate table from the staff board so the two never mix, even if they
 * ever shared a database. Postgres when DATABASE_URL is set (durable),
 * otherwise an append-only JSON-lines file for local dev.
 */

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const DATA_FILE = process.env.LDI_DATA_FILE || path.join(__dirname, 'data', 'ldi_submissions.jsonl');
const mode = DATABASE_URL ? 'postgres' : 'file';

let pool = null;

async function init() {
  if (mode === 'postgres') {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1)/.test(DATABASE_URL) || /\bsslmode=disable\b/.test(DATABASE_URL);
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS ldi_submissions (
      id        BIGSERIAL PRIMARY KEY,
      ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
      first     TEXT DEFAULT '',
      last      TEXT DEFAULT '',
      division  TEXT DEFAULT '',
      region    TEXT DEFAULT '',
      entity    TEXT DEFAULT '',
      role      TEXT DEFAULT '',
      years     DOUBLE PRECISION,
      comps     JSONB DEFAULT '[]'::jsonb,
      skills    JSONB DEFAULT '[]'::jsonb,
      approach  TEXT DEFAULT '',
      value     TEXT DEFAULT '',
      goals     JSONB DEFAULT '{}'::jsonb
    )`);
    // Existing (already-live) databases won't have the columns from CREATE TABLE
    // IF NOT EXISTS, so add them explicitly for a running deployment.
    await pool.query(`ALTER TABLE ldi_submissions ADD COLUMN IF NOT EXISTS approach TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE ldi_submissions ADD COLUMN IF NOT EXISTS value TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE ldi_submissions ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '{}'::jsonb`);
    await pool.query(`ALTER TABLE ldi_submissions ADD COLUMN IF NOT EXISTS region TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE ldi_submissions ADD COLUMN IF NOT EXISTS entity TEXT DEFAULT ''`);
  } else {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  }
}

async function loadAll() {
  if (mode === 'postgres') {
    const { rows } = await pool.query(
      'SELECT ts, first, last, division, region, entity, role, years, comps, skills, approach, value, goals FROM ldi_submissions ORDER BY id ASC'
    );
    return rows.map((r) => ({
      ts: r.ts ? new Date(r.ts).toISOString() : '',
      first: r.first || '',
      last: r.last || '',
      division: r.division || '',
      region: r.region || '',
      entity: r.entity || '',
      role: r.role || '',
      years: (r.years === null || r.years === undefined) ? null : Number(r.years),
      comps: Array.isArray(r.comps) ? r.comps : [],
      skills: Array.isArray(r.skills) ? r.skills : [],
      approach: r.approach || '',
      value: r.value || '',
      goals: (r.goals && typeof r.goals === 'object') ? r.goals : {},
    }));
  }
  const out = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      for (const line of fs.readFileSync(DATA_FILE, 'utf8').split('\n')) {
        if (!line) continue;
        try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
      }
    }
  } catch { /* ignore */ }
  return out;
}

function insert(entry) {
  if (mode === 'postgres') {
    pool.query(
      'INSERT INTO ldi_submissions (ts, first, last, division, region, entity, role, years, comps, skills, approach, value, goals) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [entry.ts, entry.first || '', entry.last || '', entry.division || '', entry.region || '', entry.entity || '', entry.role || '',
        (entry.years === null || entry.years === undefined) ? null : entry.years,
        JSON.stringify(entry.comps || []), JSON.stringify(entry.skills || []), entry.approach || '', entry.value || '',
        JSON.stringify(entry.goals || {})]
    ).catch((err) => { console.error('ldi db insert failed:', err.message); }); // eslint-disable-line no-console
  } else {
    try { fs.appendFile(DATA_FILE, `${JSON.stringify(entry)}\n`, () => {}); } catch { /* ignore */ }
  }
}

module.exports = { init, loadAll, insert, mode };
