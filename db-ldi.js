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
      'SELECT id, ts, first, last, division, region, entity, role, years, comps, skills, approach, value, goals FROM ldi_submissions ORDER BY id ASC'
    );
    return rows.map((r) => ({
      _dbid: r.id,
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
      let i = 0;
      for (const line of fs.readFileSync(DATA_FILE, 'utf8').split('\n')) {
        if (!line) continue;
        try { const o = JSON.parse(line); o._dbid = 'f' + (i++); out.push(o); } catch { /* skip malformed */ }
      }
    }
  } catch { /* ignore */ }
  return out;
}

// Returns a promise that resolves to the new row's database id (postgres) or null (file).
function insert(entry) {
  if (mode === 'postgres') {
    return pool.query(
      'INSERT INTO ldi_submissions (ts, first, last, division, region, entity, role, years, comps, skills, approach, value, goals) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
      [entry.ts, entry.first || '', entry.last || '', entry.division || '', entry.region || '', entry.entity || '', entry.role || '',
        (entry.years === null || entry.years === undefined) ? null : entry.years,
        JSON.stringify(entry.comps || []), JSON.stringify(entry.skills || []), entry.approach || '', entry.value || '',
        JSON.stringify(entry.goals || {})]
    ).then((r) => (r.rows[0] ? r.rows[0].id : null))
      .catch((err) => { console.error('ldi db insert failed:', err.message); return null; }); // eslint-disable-line no-console
  }
  try { fs.appendFile(DATA_FILE, `${JSON.stringify(entry)}\n`, () => {}); } catch { /* ignore */ }
  return Promise.resolve(null);
}

// Delete one row by its _dbid. Postgres uses the numeric id; file mode rewrites
// the data file, dropping the line at index N (id looks like 'f<N>').
async function remove(dbid) {
  if (dbid === null || dbid === undefined) return false;
  if (mode === 'postgres') {
    const n = Number(dbid); if (!Number.isFinite(n)) return false;
    const r = await pool.query('DELETE FROM ldi_submissions WHERE id=$1', [n]);
    return r.rowCount > 0;
  }
  try {
    const idx = Number(String(dbid).replace(/^f/, ''));
    if (!Number.isFinite(idx) || !fs.existsSync(DATA_FILE)) return false;
    const lines = fs.readFileSync(DATA_FILE, 'utf8').split('\n').filter((l) => l);
    if (idx < 0 || idx >= lines.length) return false;
    lines.splice(idx, 1);
    fs.writeFileSync(DATA_FILE, lines.length ? lines.join('\n') + '\n' : '');
    return true;
  } catch { return false; }
}

// Remove every row.
async function clearAll() {
  if (mode === 'postgres') { await pool.query('TRUNCATE TABLE ldi_submissions RESTART IDENTITY'); return true; }
  try { fs.writeFileSync(DATA_FILE, ''); return true; } catch { return false; }
}

module.exports = { init, loadAll, insert, remove, clearAll, mode };
