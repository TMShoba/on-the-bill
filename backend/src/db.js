import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

/**
 * Supabase Postgres connection.
 * Prefer Session pooler (port 5432) for Node servers, or Transaction pooler (6543).
 * Set DATABASE_URL in .env — never commit real passwords.
 */
const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

if (!connectionString) {
  console.warn(
    "⚠️  DATABASE_URL is not set. Set it to your Supabase Postgres URI."
  );
}

// Supabase pooler + serverless-friendly settings
export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err.message);
});

/** Convert ? placeholders to $1, $2, ... */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Expand named @param objects (better-sqlite3 style) into ordered arrays.
 * Only used when a single object argument is passed.
 */
function expandNamed(sql, paramsObj) {
  const names = [];
  const pgSql = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    names.push(name);
    return `$${names.length}`;
  });
  const values = names.map((n) => paramsObj[n]);
  return { sql: pgSql, values };
}

function normalizeArgs(sql, args) {
  if (
    args.length === 1 &&
    args[0] &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0]) &&
    sql.includes("@")
  ) {
    return expandNamed(sql, args[0]);
  }
  return { sql: toPg(sql), values: args };
}

export async function query(sql, ...args) {
  const { sql: text, values } = normalizeArgs(sql, args);
  return pool.query(text, values);
}

export async function get(sql, ...args) {
  const res = await query(sql, ...args);
  return res.rows[0] || null;
}

export async function all(sql, ...args) {
  const res = await query(sql, ...args);
  return Array.isArray(res.rows) ? res.rows : [];
}

export async function run(sql, ...args) {
  const res = await query(sql, ...args);
  return {
    changes: res.rowCount ?? 0,
    rowCount: res.rowCount ?? 0,
  };
}

/** better-sqlite3 compatible prepare() returning async get/all/run */
export function prepare(sql) {
  return {
    get: (...args) => get(sql, ...args),
    all: (...args) => all(sql, ...args),
    run: (...args) => run(sql, ...args),
  };
}

const db = {
  prepare,
  get,
  all,
  run,
  query,
  pool,
  async exec(sql) {
    await pool.query(sql);
  },
};

export default db;

/**
 * Create schema if missing (idempotent).
 * Call once at startup before seed.
 */
export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      stage_name TEXT NOT NULL,
      genre TEXT NOT NULL,
      location TEXT NOT NULL,
      rate INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      bio TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('client', 'artist', 'promoter')),
      artist_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL REFERENCES artists(id),
      artist_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      event_date TEXT NOT NULL,
      venue TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'declined', 'paid')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      time TEXT DEFAULT '',
      fee INTEGER,
      promoter_name TEXT DEFAULT '',
      promoter_id TEXT,
      notes TEXT DEFAULT '',
      reminder_opt_in INTEGER DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'deposit', 'paid', 'disputed')),
      paid_at TIMESTAMPTZ,
      dispute_reason TEXT,
      disputed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      artist_id TEXT NOT NULL,
      artist_name TEXT DEFAULT '',
      promoter_id TEXT NOT NULL,
      promoter_name TEXT DEFAULT '',
      last_message_at TIMESTAMPTZ,
      last_message_preview TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL,
      sender_name TEXT DEFAULT '',
      body TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_flag INTEGER DEFAULT 0,
      attachment_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_artist ON bookings(artist_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_promoter ON bookings(promoter_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
    CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
  `);
}
