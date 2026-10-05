import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sanitizeString } from "../lib/security.js";
import { audit } from "../lib/audit.js";
import { isIdentityVerified } from "./verification.js";
import { v4 as uuidv4 } from "uuid";
import { BUCKETS, putObject, removeObject, publicUrl, parseDataUrl, extensionFor } from "../lib/storage.js";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO = 5 * 1024 * 1024;
export const PRICE_VISIBILITY = ["exact", "band", "on_request"];

const router = Router();

const ACCOUNT_TYPES = new Set(["cheque", "savings", "transmission", ""]);

function artistKey(user) {
  return user.artistId || user.id;
}

function mapExtras(row, req) {
  return {
    bio: row?.bio || "",
    demoMixUrl: row?.demo_mix_url || "",
    phone: row?.phone || "",
    instagram: row?.instagram || "",
    hasPhoto: Boolean(row?.photo_key || row?.has_photo),
    photoUrl: row?.photo_key ? publicUrl(BUCKETS.photos, row.photo_key, req) : null,
    priceVisibility: PRICE_VISIBILITY.includes(row?.price_visibility) ? row.price_visibility : "band",
  };
}

function mapBanking(row) {
  if (!row || !row.account_number) return null;
  return {
    bankName: row.bank_name || "",
    accountName: row.account_name || "",
    accountNumber: row.account_number || "",
    branchCode: row.branch_code || "",
    accountType: row.account_type || "",
    referenceHint: row.reference_hint || "",
  };
}

function requireArtist(req, res, next) {
  if (req.user.role !== "artist") {
    return res.status(403).json({ message: "Artist accounts only" });
  }
  next();
}

async function ensureRow(key) {
  await db
    .prepare(
      `INSERT INTO artist_profiles (artist_id, updated_at) VALUES (?, NOW())
       ON CONFLICT (artist_id) DO NOTHING`
    )
    .run(key);
}

async function loadProfile(key, req) {
  const row = await db.prepare("SELECT * FROM artist_profiles WHERE artist_id = ?").get(key);
  return { artistId: key, extras: mapExtras(row, req), banking: mapBanking(row) };
}

// GET /api/artist-profile/me — the signed-in artist's own extras + banking
router.get("/me", requireAuth, requireArtist, async (req, res) => {
  try {
    res.json(await loadProfile(artistKey(req.user), req));
  } catch (e) {
    console.error("get artist profile", e);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

// PATCH /api/artist-profile/me — partial update of profile extras
router.patch("/me", requireAuth, requireArtist, async (req, res) => {
  try {
    const key = artistKey(req.user);
    const b = req.body || {};
    const fields = {
      bio: b.bio !== undefined ? sanitizeString(b.bio, 4000) : undefined,
      demo_mix_url: b.demoMixUrl !== undefined ? sanitizeString(b.demoMixUrl, 500) : undefined,
      phone: b.phone !== undefined ? sanitizeString(b.phone, 40) : undefined,
      instagram: b.instagram !== undefined ? sanitizeString(b.instagram, 120) : undefined,
      price_visibility: PRICE_VISIBILITY.includes(b.priceVisibility) ? b.priceVisibility : undefined,
    };
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    await ensureRow(key);
    if (entries.length) {
      const sets = entries.map(([col]) => `${col} = ?`).join(", ");
      await db
        .prepare(`UPDATE artist_profiles SET ${sets}, updated_at = NOW() WHERE artist_id = ?`)
        .run(...entries.map(([, v]) => v), key);
    }
    res.json(await loadProfile(key, req));
  } catch (e) {
    console.error("update artist profile", e);
    res.status(500).json({ message: "Failed to save profile" });
  }
});

// PUT /api/artist-profile/me/banking — requires identity verification
router.put("/me/banking", requireAuth, requireArtist, async (req, res) => {
  try {
    if (!(await isIdentityVerified(req.user.id))) {
      return res.status(403).json({
        message: "Complete artist verification before adding banking details",
      });
    }
    const b = req.body || {};
    const banking = {
      bankName: sanitizeString(b.bankName || "", 80),
      accountName: sanitizeString(b.accountName || "", 120),
      accountNumber: String(b.accountNumber || "").replace(/\D/g, "").slice(0, 20),
      branchCode: String(b.branchCode || "").replace(/\D/g, "").slice(0, 10),
      accountType: ACCOUNT_TYPES.has(b.accountType) ? b.accountType : "",
      referenceHint: sanitizeString(b.referenceHint || "", 120),
    };
    if (!banking.bankName || !banking.accountName || banking.accountNumber.length < 6 || !banking.branchCode) {
      return res.status(400).json({
        message: "Bank name, account holder, account number and branch code are required",
      });
    }
    const key = artistKey(req.user);
    await ensureRow(key);
    await db
      .prepare(
        `UPDATE artist_profiles SET
          bank_name = ?, account_name = ?, account_number = ?, branch_code = ?,
          account_type = ?, reference_hint = ?, updated_at = NOW()
         WHERE artist_id = ?`
      )
      .run(
        banking.bankName,
        banking.accountName,
        banking.accountNumber,
        banking.branchCode,
        banking.accountType,
        banking.referenceHint,
        key
      );
    audit("banking_updated", { userId: req.user.id });
    res.json(await loadProfile(key, req));
  } catch (e) {
    console.error("update banking", e);
    res.status(500).json({ message: "Failed to save banking details" });
  }
});

// PUT /api/artist-profile/me/photo  { dataUrl }  — stored in the public photos bucket
router.put("/me/photo", requireAuth, requireArtist, async (req, res) => {
  try {
    const parsed = parseDataUrl(req.body?.dataUrl, { allowedTypes: PHOTO_TYPES, maxBytes: MAX_PHOTO });
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const key = artistKey(req.user);
    await ensureRow(key);
    const prev = await db.prepare("SELECT photo_key FROM artist_profiles WHERE artist_id = ?").get(key);
    const objectKey = `${key}/${uuidv4()}.${extensionFor(parsed.type)}`;
    await putObject(BUCKETS.photos, objectKey, parsed.buffer, parsed.type);
    await db
      .prepare("UPDATE artist_profiles SET photo_key = ?, has_photo = 1, updated_at = NOW() WHERE artist_id = ?")
      .run(objectKey, key);
    if (prev?.photo_key) await removeObject(BUCKETS.photos, prev.photo_key);
    res.json(await loadProfile(key, req));
  } catch (e) {
    console.error("upload photo", e);
    res.status(500).json({ message: "Failed to upload photo" });
  }
});

// DELETE /api/artist-profile/me/photo
router.delete("/me/photo", requireAuth, requireArtist, async (req, res) => {
  try {
    const key = artistKey(req.user);
    const prev = await db.prepare("SELECT photo_key FROM artist_profiles WHERE artist_id = ?").get(key);
    await db.prepare("UPDATE artist_profiles SET photo_key = NULL, has_photo = 0 WHERE artist_id = ?").run(key);
    if (prev?.photo_key) await removeObject(BUCKETS.photos, prev.photo_key);
    res.json(await loadProfile(key, req));
  } catch (e) {
    console.error("delete photo", e);
    res.status(500).json({ message: "Failed to remove photo" });
  }
});

/**
 * GET /api/artist-profile/:artistId/banking
 * Visible to the artist, or to a promoter with a confirmed/paid booking with this artist.
 */
router.get("/:artistId/banking", requireAuth, async (req, res) => {
  try {
    const key = req.params.artistId;
    const user = req.user;
    let allowed = user.role === "artist" && artistKey(user) === key;
    if (!allowed && user.role !== "artist") {
      const booking = await db
        .prepare(
          `SELECT id FROM bookings
           WHERE artist_id = ?
             AND status IN ('confirmed', 'paid')
             AND (promoter_id = ? OR LOWER(client_email) = LOWER(?))
           LIMIT 1`
        )
        .get(key, user.id, user.email || "");
      allowed = Boolean(booking);
    }
    if (!allowed) {
      return res.status(403).json({ message: "Banking is shared after a booking is confirmed" });
    }
    const row = await db.prepare("SELECT * FROM artist_profiles WHERE artist_id = ?").get(key);
    res.json({ banking: mapBanking(row) });
  } catch (e) {
    console.error("get banking", e);
    res.status(500).json({ message: "Failed to load banking details" });
  }
});

export default router;
