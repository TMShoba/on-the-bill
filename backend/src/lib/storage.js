import { createClient } from "@supabase/supabase-js";
import db from "../db.js";

/**
 * File storage with two drivers:
 *  - Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (production)
 *  - a Postgres table otherwise (local dev / tests)
 * Callers only store object keys; URLs are derived at read time.
 */

export const BUCKETS = {
  attachments: { name: "message-attachments", public: false },
  photos: { name: "artist-photos", public: true },
  verification: { name: "verification-docs", public: false },
};

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

export const storageDriver = supabase ? "supabase" : "database";

/** Create buckets on boot (Supabase) — safe to call repeatedly */
export async function ensureBuckets() {
  if (!supabase) return;
  const { data: existing, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Supabase storage: ${error.message}`);
  const names = new Set((existing || []).map((b) => b.name));
  for (const bucket of Object.values(BUCKETS)) {
    if (names.has(bucket.name)) continue;
    const { error: createError } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.public ? "5MB" : "10MB",
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`Supabase storage: ${createError.message}`);
    }
  }
}

export async function putObject(bucket, key, buffer, contentType) {
  if (supabase) {
    const { error } = await supabase.storage
      .from(bucket.name)
      .upload(key, buffer, { contentType, upsert: true, cacheControl: bucket.public ? "31536000" : "0" });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return key;
  }
  await db
    .prepare(
      `INSERT INTO stored_files (bucket, key, content_type, size, data_base64, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON CONFLICT (bucket, key) DO UPDATE SET
         content_type = EXCLUDED.content_type, size = EXCLUDED.size, data_base64 = EXCLUDED.data_base64`
    )
    .run(bucket.name, key, contentType, buffer.length, buffer.toString("base64"));
  return key;
}

/** Returns { buffer, contentType } or null when missing */
export async function getObject(bucket, key) {
  if (supabase) {
    const { data, error } = await supabase.storage.from(bucket.name).download(key);
    if (error || !data) return null;
    return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
  }
  const row = await db
    .prepare("SELECT content_type, data_base64 FROM stored_files WHERE bucket = ? AND key = ?")
    .get(bucket.name, key);
  if (!row) return null;
  return { buffer: Buffer.from(row.data_base64, "base64"), contentType: row.content_type };
}

export async function removeObject(bucket, key) {
  if (!key) return;
  if (supabase) {
    await supabase.storage.from(bucket.name).remove([key]);
    return;
  }
  await db.prepare("DELETE FROM stored_files WHERE bucket = ? AND key = ?").run(bucket.name, key);
}

/**
 * Public URL for an object in a public bucket. With the database driver the
 * API serves it itself, so the URL is built from the incoming request's host.
 */
export function publicUrl(bucket, key, req) {
  if (!key) return null;
  if (supabase) return supabase.storage.from(bucket.name).getPublicUrl(key).data.publicUrl;
  const base = process.env.API_PUBLIC_URL || (req ? `${req.protocol}://${req.get("host")}` : "");
  return `${base}/api/files/${bucket.name}/${encodeURIComponent(key)}`;
}

/** Parse and validate a base64 data URL upload */
export function parseDataUrl(dataUrl, { allowedTypes, maxBytes }) {
  const match = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return { error: "File could not be read. Please try another file." };
  const type = match[1];
  if (!allowedTypes.has(type)) return { error: "That file type isn't supported." };
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > maxBytes) {
    return { error: `Files must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.` };
  }
  return { type, buffer };
}

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export function extensionFor(type) {
  return EXTENSIONS[type] || "bin";
}
