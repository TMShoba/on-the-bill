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

    
    CREATE TABLE IF NOT EXISTS booking_contracts (
      booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      artist_id TEXT,
      artist_name TEXT DEFAULT '',
      promoter_name TEXT DEFAULT '',
      promoter_email TEXT DEFAULT '',
      promoter_id TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      platform_fee INTEGER NOT NULL DEFAULT 0,
      artist_payout INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL CHECK (kind IN ('deposit', 'full')),
      method TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'refunded')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_booking ON receipts(booking_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_artist ON receipts(artist_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_promoter ON receipts(promoter_id);

    CREATE TABLE IF NOT EXISTS artist_verifications (
      user_id TEXT PRIMARY KEY,
      artist_id TEXT,
      claim_type TEXT DEFAULT '',
      legal_name TEXT DEFAULT '',
      id_number_last4 TEXT DEFAULT '',
      id_doc_label TEXT DEFAULT '',
      selfie_label TEXT DEFAULT '',
      authority_note TEXT DEFAULT '',
      social_proof_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'pending_review', 'identity_verified', 'fully_verified', 'rejected')),
      submitted_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      rejection_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, artist_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      href TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_flag INTEGER DEFAULT 0
    );

    -- Keyed by catalog artist id (or the artist user id when not linked to the catalog)
    CREATE TABLE IF NOT EXISTS artist_profiles (
      artist_id TEXT PRIMARY KEY,
      bio TEXT DEFAULT '',
      demo_mix_url TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      has_photo INTEGER DEFAULT 0,
      bank_name TEXT DEFAULT '',
      account_name TEXT DEFAULT '',
      account_number TEXT DEFAULT '',
      branch_code TEXT DEFAULT '',
      account_type TEXT DEFAULT '',
      reference_hint TEXT DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- International bookings: where the event is and what travel the promoter covers
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_country TEXT DEFAULT 'ZA';
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_timezone TEXT DEFAULT 'Africa/Johannesburg';
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_json TEXT;

    -- Message files live apart from message rows so thread lists stay light
    CREATE TABLE IF NOT EXISTS message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);

    -- Database storage driver (used when Supabase Storage isn't configured)
    CREATE TABLE IF NOT EXISTS stored_files (
      bucket TEXT NOT NULL,
      key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bucket, key)
    );

    -- Attachments now live in storage; data_base64 remains for older rows
    ALTER TABLE message_attachments ADD COLUMN IF NOT EXISTS storage_key TEXT;
    ALTER TABLE message_attachments ALTER COLUMN data_base64 DROP NOT NULL;

    ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS photo_key TEXT;
    -- exact | band | on_request
    ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS price_visibility TEXT DEFAULT 'band';
    -- Secret for the read-only iCal feed (calendar apps can't send auth headers)
    ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS calendar_token TEXT;

    CREATE TABLE IF NOT EXISTS artist_blocked_dates (
      id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (artist_id, date)
    );

    -- Identity checks: full ID is never stored, only a hash (duplicate detection) + last 4
    ALTER TABLE artist_verifications ADD COLUMN IF NOT EXISTS id_number_hash TEXT;
    ALTER TABLE artist_verifications ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
    ALTER TABLE artist_verifications ADD COLUMN IF NOT EXISTS id_doc_key TEXT;
    ALTER TABLE artist_verifications ADD COLUMN IF NOT EXISTS selfie_key TEXT;
    ALTER TABLE artist_verifications ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
    ALTER TABLE artist_verifications ADD COLUMN IF NOT EXISTS review_notes TEXT;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications INTEGER DEFAULT 1;

    CREATE INDEX IF NOT EXISTS idx_blocked_artist ON artist_blocked_dates(artist_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_status ON artist_verifications(status);

    CREATE INDEX IF NOT EXISTS idx_verifications_artist ON artist_verifications(artist_id);
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_bookings_artist ON bookings(artist_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_promoter ON bookings(promoter_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
    CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
  `);
}
