import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "onthebill.db");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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
    role TEXT NOT NULL CHECK(role IN ('client', 'artist', 'promoter')),
    artist_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    event_date TEXT NOT NULL,
    venue TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'confirmed', 'declined', 'paid')),
    created_at TEXT NOT NULL,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    time TEXT DEFAULT '',
    fee INTEGER,
    promoter_name TEXT DEFAULT '',
    promoter_id TEXT,
    notes TEXT DEFAULT '',
    reminder_opt_in INTEGER DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid'
      CHECK(payment_status IN ('unpaid', 'deposit', 'paid', 'disputed')),
    paid_at TEXT,
    dispute_reason TEXT,
    disputed_at TEXT,
    FOREIGN KEY (artist_id) REFERENCES artists(id)
  );
`);

/** Additive migrations for older DBs created before expanded columns */
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("users", "artist_id", "TEXT");
// Allow promoter role on older DBs — SQLite can't alter CHECK easily; new inserts use app validation

ensureColumn("bookings", "address", "TEXT DEFAULT ''");
ensureColumn("bookings", "city", "TEXT DEFAULT ''");
ensureColumn("bookings", "time", "TEXT DEFAULT ''");
ensureColumn("bookings", "fee", "INTEGER");
ensureColumn("bookings", "promoter_name", "TEXT DEFAULT ''");
ensureColumn("bookings", "promoter_id", "TEXT");
ensureColumn("bookings", "notes", "TEXT DEFAULT ''");
ensureColumn("bookings", "reminder_opt_in", "INTEGER DEFAULT 0");
ensureColumn("bookings", "payment_status", "TEXT DEFAULT 'unpaid'");
ensureColumn("bookings", "paid_at", "TEXT");
ensureColumn("bookings", "dispute_reason", "TEXT");
ensureColumn("bookings", "disputed_at", "TEXT");

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    promoter_id TEXT NOT NULL,
    promoter_name TEXT NOT NULL,
    last_message_at TEXT NOT NULL,
    last_message_preview TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    body TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    read_flag INTEGER DEFAULT 0,
    attachment_json TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_artist ON conversations(artist_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_promoter ON conversations(promoter_id);
`);

export default db;
