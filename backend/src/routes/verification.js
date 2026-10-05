import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sanitizeString } from "../lib/security.js";
import { audit } from "../lib/audit.js";
import { validateSaId, hashIdNumber } from "../lib/saId.js";
import { BUCKETS, putObject, getObject, removeObject, parseDataUrl, extensionFor } from "../lib/storage.js";
import { requireAdmin } from "../lib/admin.js";
import { notifyVerificationSubmitted, notifyVerificationDecision } from "../lib/notify.js";

const router = Router();

const ID_DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const SELFIE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_ID_DOC = 8 * 1024 * 1024;
const MAX_SELFIE = 5 * 1024 * 1024;

function emptyRecord(userId) {
  return {
    userId,
    claimType: "",
    legalName: "",
    idNumberLast4: "",
    authorityNote: "",
    socialProofUrl: "",
    hasIdDocument: false,
    hasSelfie: false,
    status: "unverified",
  };
}

function mapVerification(row) {
  return {
    userId: row.user_id,
    artistProfileId: row.artist_id || undefined,
    claimType: row.claim_type || "",
    legalName: row.legal_name || "",
    idNumberLast4: row.id_number_last4 || "",
    authorityNote: row.authority_note || "",
    socialProofUrl: row.social_proof_url || "",
    hasIdDocument: Boolean(row.id_doc_key),
    hasSelfie: Boolean(row.selfie_key),
    status: row.status,
    submittedAt: row.submitted_at || undefined,
    reviewedAt: row.reviewed_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
  };
}

function requireArtist(req, res, next) {
  if (req.user.role !== "artist") {
    return res.status(403).json({ message: "Only artist accounts can be verified" });
  }
  next();
}

async function loadRecord(userId) {
  const row = await db.prepare("SELECT * FROM artist_verifications WHERE user_id = ?").get(userId);
  return row ? mapVerification(row) : emptyRecord(userId);
}

/** True once the artist user has passed the identity step (required to accept bookings). */
export async function isIdentityVerified(userId) {
  const row = await db.prepare("SELECT status FROM artist_verifications WHERE user_id = ?").get(userId);
  return row?.status === "identity_verified" || row?.status === "fully_verified";
}

// GET /api/verification/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.json(await loadRecord(req.user.id));
  } catch (e) {
    console.error("get verification", e);
    res.status(500).json({ message: "Failed to load verification" });
  }
});

/**
 * POST /api/verification — submit SA ID number, ID document and selfie.
 * The ID number is checked for structure; a person reviews the documents.
 * Only the last 4 digits and a keyed hash of the ID number are stored.
 */
router.post("/", requireAuth, requireArtist, async (req, res) => {
  try {
    const b = req.body || {};
    const existing = await db.prepare("SELECT * FROM artist_verifications WHERE user_id = ?").get(req.user.id);
    if (existing && ["identity_verified", "fully_verified"].includes(existing.status)) {
      return res.status(409).json({ message: "You're already verified." });
    }

    const claimType = ["self", "manager"].includes(b.claimType) ? b.claimType : "";
    if (!claimType) return res.status(400).json({ message: "Tell us if you are the artist or their manager." });
    const legalName = sanitizeString(b.legalName || "", 160).trim();
    if (legalName.length < 3 || !/\s/.test(legalName)) {
      return res.status(400).json({ message: "Enter your full legal name as it appears on your ID." });
    }
    const authorityNote = sanitizeString(b.authorityNote || "", 2000);
    if (claimType === "manager" && authorityNote.trim().length < 20) {
      return res.status(400).json({ message: "Managers must explain their authority to represent the artist." });
    }
    const socialProofUrl = sanitizeString(b.socialProofUrl || "", 500);

    const id = validateSaId(b.idNumber);
    if (!id.valid) return res.status(400).json({ message: id.reason });
    const idHash = hashIdNumber(id.id);

    // Same ID already verified on another account → stop; pending elsewhere → flag for reviewer
    const others = await db
      .prepare("SELECT user_id, status FROM artist_verifications WHERE id_number_hash = ? AND user_id != ?")
      .all(idHash, req.user.id);
    if (others.some((o) => ["identity_verified", "fully_verified"].includes(o.status))) {
      audit("verification_duplicate_id", { userId: req.user.id });
      return res.status(409).json({ message: "This ID number is already verified on another account. Contact support." });
    }
    const reviewNotes = others.length ? "ID number also submitted by another account" : null;

    // Documents: required on first submission, optional when resubmitting
    const idDoc = b.idDocument ? parseDataUrl(b.idDocument, { allowedTypes: ID_DOC_TYPES, maxBytes: MAX_ID_DOC }) : null;
    if (idDoc?.error) return res.status(400).json({ message: `ID document: ${idDoc.error}` });
    const selfie = b.selfie ? parseDataUrl(b.selfie, { allowedTypes: SELFIE_TYPES, maxBytes: MAX_SELFIE }) : null;
    if (selfie?.error) return res.status(400).json({ message: `Selfie: ${selfie.error}` });
    if (!idDoc && !existing?.id_doc_key) return res.status(400).json({ message: "Upload a photo or scan of your ID." });
    if (!selfie && !existing?.selfie_key) return res.status(400).json({ message: "Upload a selfie holding your ID." });

    let idDocKey = existing?.id_doc_key || null;
    let selfieKey = existing?.selfie_key || null;
    if (idDoc) {
      const key = `${req.user.id}/${uuidv4()}-id.${extensionFor(idDoc.type)}`;
      await putObject(BUCKETS.verification, key, idDoc.buffer, idDoc.type);
      if (idDocKey) await removeObject(BUCKETS.verification, idDocKey);
      idDocKey = key;
    }
    if (selfie) {
      const key = `${req.user.id}/${uuidv4()}-selfie.${extensionFor(selfie.type)}`;
      await putObject(BUCKETS.verification, key, selfie.buffer, selfie.type);
      if (selfieKey) await removeObject(BUCKETS.verification, selfieKey);
      selfieKey = key;
    }

    const artistId = req.user.artistId || req.user.id;
    await db
      .prepare(
        `INSERT INTO artist_verifications (
          user_id, artist_id, claim_type, legal_name, id_number_last4, id_number_hash, date_of_birth,
          id_doc_label, selfie_label, id_doc_key, selfie_key, authority_note, social_proof_url,
          status, submitted_at, reviewed_at, rejection_reason, review_notes, reviewed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, 'pending_review', NOW(), NULL, NULL, ?, NULL)
        ON CONFLICT (user_id) DO UPDATE SET
          artist_id = EXCLUDED.artist_id,
          claim_type = EXCLUDED.claim_type,
          legal_name = EXCLUDED.legal_name,
          id_number_last4 = EXCLUDED.id_number_last4,
          id_number_hash = EXCLUDED.id_number_hash,
          date_of_birth = EXCLUDED.date_of_birth,
          id_doc_key = EXCLUDED.id_doc_key,
          selfie_key = EXCLUDED.selfie_key,
          authority_note = EXCLUDED.authority_note,
          social_proof_url = EXCLUDED.social_proof_url,
          status = 'pending_review',
          submitted_at = NOW(),
          reviewed_at = NULL,
          rejection_reason = NULL,
          review_notes = EXCLUDED.review_notes,
          reviewed_by = NULL`
      )
      .run(
        req.user.id,
        artistId,
        claimType,
        legalName,
        id.last4,
        idHash,
        id.dateOfBirth,
        idDocKey,
        selfieKey,
        authorityNote,
        socialProofUrl,
        reviewNotes
      );
    audit("verification_submitted", { userId: req.user.id });
    await notifyVerificationSubmitted(req.user, legalName);
    res.json(await loadRecord(req.user.id));
  } catch (e) {
    console.error("submit verification", e);
    res.status(500).json({ message: "Failed to submit verification" });
  }
});

// POST /api/verification/demo-approve — demo environments only
router.post("/demo-approve", requireAuth, requireArtist, async (req, res) => {
  if (process.env.ALLOW_DEMO_TOKENS !== "true") {
    return res.status(403).json({ message: "Demo approval is disabled" });
  }
  try {
    await db
      .prepare(
        `INSERT INTO artist_verifications (user_id, artist_id, claim_type, status, submitted_at, reviewed_at, reviewed_by)
         VALUES (?, ?, 'self', 'fully_verified', NOW(), NOW(), 'demo')
         ON CONFLICT (user_id) DO UPDATE SET
           status = 'fully_verified', reviewed_at = NOW(), rejection_reason = NULL, reviewed_by = 'demo'`
      )
      .run(req.user.id, req.user.artistId || req.user.id);
    res.json(await loadRecord(req.user.id));
  } catch (e) {
    console.error("demo approve", e);
    res.status(500).json({ message: "Failed to approve" });
  }
});

/* ---------------------------- Admin review ---------------------------- */

function mapForReview(row) {
  return {
    ...mapVerification(row),
    dateOfBirth: row.date_of_birth || undefined,
    reviewNotes: row.review_notes || undefined,
    reviewedBy: row.reviewed_by || undefined,
    accountName: row.account_name,
    accountEmail: row.account_email,
    stageName: row.stage_name || undefined,
  };
}

// GET /api/verification/admin/queue?status=pending_review
router.get("/admin/queue", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "pending_review");
    const allowed = ["pending_review", "identity_verified", "fully_verified", "rejected"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Unknown status" });
    const rows = await db
      .prepare(
        `SELECT v.*, u.name AS account_name, u.email AS account_email, a.stage_name
         FROM artist_verifications v
         JOIN users u ON u.id = v.user_id
         LEFT JOIN artists a ON a.id = v.artist_id
         WHERE v.status = ?
         ORDER BY v.submitted_at ASC`
      )
      .all(status);
    res.json(rows.map(mapForReview));
  } catch (e) {
    console.error("verification queue", e);
    res.status(500).json({ message: "Failed to load the review queue" });
  }
});

// GET /api/verification/admin/:userId/files/:kind  (kind = id | selfie)
router.get("/admin/:userId/files/:kind", requireAuth, requireAdmin, async (req, res) => {
  try {
    const row = await db.prepare("SELECT id_doc_key, selfie_key FROM artist_verifications WHERE user_id = ?").get(req.params.userId);
    const key = req.params.kind === "id" ? row?.id_doc_key : req.params.kind === "selfie" ? row?.selfie_key : null;
    if (!key) return res.status(404).json({ message: "File not found" });
    const file = await getObject(BUCKETS.verification, key);
    if (!file) return res.status(404).json({ message: "File not found" });
    audit("verification_file_viewed", { adminId: req.user.id, userId: req.params.userId, kind: req.params.kind });
    res.set("Content-Type", file.contentType);
    res.set("Cache-Control", "private, no-store");
    res.send(file.buffer);
  } catch (e) {
    console.error("verification file", e);
    res.status(500).json({ message: "Failed to load file" });
  }
});

// POST /api/verification/admin/:userId/decision  { decision: approve_identity | approve_full | reject, reason? }
router.post("/admin/:userId/decision", requireAuth, requireAdmin, async (req, res) => {
  try {
    const decision = String(req.body?.decision || "");
    const statusFor = { approve_identity: "identity_verified", approve_full: "fully_verified", reject: "rejected" };
    const status = statusFor[decision];
    if (!status) return res.status(400).json({ message: "decision must be approve_identity, approve_full or reject" });
    const reason = sanitizeString(req.body?.reason || "", 500).trim();
    if (status === "rejected" && reason.length < 5) {
      return res.status(400).json({ message: "Give the artist a reason so they can fix their submission." });
    }
    const row = await db.prepare("SELECT status FROM artist_verifications WHERE user_id = ?").get(req.params.userId);
    if (!row) return res.status(404).json({ message: "No submission for this user" });

    await db
      .prepare(
        `UPDATE artist_verifications
         SET status = ?, reviewed_at = NOW(), reviewed_by = ?, rejection_reason = ?
         WHERE user_id = ?`
      )
      .run(status, req.user.email, status === "rejected" ? reason : null, req.params.userId);
    audit("verification_decision", { adminId: req.user.id, userId: req.params.userId, status });
    await notifyVerificationDecision(req.params.userId, status, reason);
    const updated = await db
      .prepare(
        `SELECT v.*, u.name AS account_name, u.email AS account_email, a.stage_name
         FROM artist_verifications v JOIN users u ON u.id = v.user_id
         LEFT JOIN artists a ON a.id = v.artist_id WHERE v.user_id = ?`
      )
      .get(req.params.userId);
    res.json(mapForReview(updated));
  } catch (e) {
    console.error("verification decision", e);
    res.status(500).json({ message: "Failed to save decision" });
  }
});

export default router;
