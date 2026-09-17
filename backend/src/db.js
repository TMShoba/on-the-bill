import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

/**
 * Supabase / any Postgres.
 * Project Settings → Database → Connection string (URI)
 * Prefer the "Transaction" pooler URI on port 6543 for serverless,
 * or direct 5432 for a long-running Node API on Railway/local.
 */
const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

if (!connectionString) {
  console.warn(
    "[db] DATABASE_URL is not set. Add your Supabase connection string to .env"
  );
}

const useSsl =
  process.env.DATABASE_SSL === "false"
    ? false
    : process.env.DATABASE_SSL === "true" ||
      /supabase\.co|neon\.tech|railway\.app/i.test(connectionString) ||
      process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error", err.message);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function one(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

export async function many(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      stage_name TEXT NOT NULL,
      genre TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      rate INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('client', 'artist', 'promoter')),
      artist_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
      ON users (LOWER(email));

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL REFERENCES artists(id),
      artist_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      event_date TEXT NOT NULL,
      venue TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'declined', 'paid')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      fee INTEGER,
      promoter_name TEXT NOT NULL DEFAULT '',
      promoter_id TEXT,
      notes TEXT NOT NULL DEFAULT '',
      reminder_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
      payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'deposit', 'paid', 'disputed')),
      paid_at TIMESTAMPTZ,
      dispute_reason TEXT,
      disputed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS bookings_artist_idx ON bookings(artist_id);
    CREATE INDEX IF NOT EXISTS bookings_promoter_idx ON bookings(promoter_id);
    CREATE INDEX IF NOT EXISTS bookings_client_email_idx ON bookings(LOWER(client_email));

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      artist_id TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      promoter_id TEXT NOT NULL,
      promoter_name TEXT NOT NULL,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_preview TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_booking_idx
      ON conversations(booking_id);
    CREATE INDEX IF NOT EXISTS conversations_artist_idx ON conversations(artist_id);
    CREATE INDEX IF NOT EXISTS conversations_promoter_idx ON conversations(promoter_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_flag BOOLEAN NOT NULL DEFAULT FALSE,
      attachment_json TEXT
    );
    CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id);
  `);
  console.log("[db] Schema ready (PostgreSQL / Supabase)");
}

export default { pool, query, one, many, migrate };
