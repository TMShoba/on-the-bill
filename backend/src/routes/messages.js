import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { sanitizeString } from "../lib/security.js";
import { notifyNewMessage, promoterUserIds } from "../lib/notify.js";
import { audit } from "../lib/audit.js";
import { BUCKETS, putObject, getObject } from "../lib/storage.js";

const router = Router();

/** Riders, invoices, contracts and press shots — nothing executable */
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/png",
  "image/jpeg",
]);
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

function mapConversation(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    promoterId: row.promoter_id,
    promoterName: row.promoter_name,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview || "",
    unreadCount: Number(row.unread || 0),
    bookingVenue: row.booking_venue || undefined,
    bookingDate: row.booking_date ? String(row.booking_date).slice(0, 10) : undefined,
    bookingCity: row.booking_city || undefined,
  };
}

function mapMessage(row) {
  let attachment;
  if (row.attachment_json) {
    try {
      attachment = JSON.parse(row.attachment_json);
    } catch {
      attachment = undefined;
    }
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body || "",
    createdAt: row.created_at,
    read: Boolean(row.read_flag),
    attachment,
  };
}

function isConversationParticipant(user, row) {
  if (!user) return false;
  if (user.id === row.artist_id || user.id === row.promoter_id) return true;
  if (user.artistId && user.artistId === row.artist_id) return true;
  return false;
}

function canAccessConversation(user, row) {
  if (isConversationParticipant(user, row)) return true;
  // Legacy demo tokens (dev only) mirror the booking routes
  return Boolean(user?.ephemeral && process.env.ALLOW_DEMO_TOKENS === "true");
}

/** Conversations for a user, with booking context and unread counts in one query */
const CONVERSATION_SELECT = `
  SELECT c.*, u.unread, b.venue AS booking_venue, b.event_date AS booking_date, b.city AS booking_city
  FROM conversations c
  LEFT JOIN (
    SELECT conversation_id, COUNT(*) AS unread
    FROM messages
    WHERE sender_id != ? AND read_flag = 0
    GROUP BY conversation_id
  ) u ON u.conversation_id = c.id
  LEFT JOIN bookings b ON b.id = c.booking_id`;

async function loadConversation(id, userId) {
  return db.prepare(`${CONVERSATION_SELECT} WHERE c.id = ?`).get(userId, id);
}

/** Validate a data-URL attachment; returns { meta, base64 } or { error } */
function parseAttachment(input) {
  if (!input || typeof input !== "object") return null;
  const match = /^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(input.dataUrl || ""));
  if (!match) return { error: "Attachment could not be read. Please try another file." };
  const type = match[1];
  if (!ALLOWED_ATTACHMENT_TYPES.has(type)) {
    return { error: "That file type isn't supported. Send a PDF, Word, Excel, text or image file." };
  }
  const base64 = match[2];
  const size = Buffer.byteLength(base64, "base64");
  if (size > MAX_ATTACHMENT_BYTES) return { error: "Files must be 2 MB or smaller." };
  const name = sanitizeString(input.name || "file", 120).replace(/[\\/]/g, "_") || "file";
  return { meta: { id: uuidv4(), name, type, size }, buffer: Buffer.from(base64, "base64") };
}

// GET /api/messages/conversations
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const artistKey = req.user.artistId || userId;
    const rows = await db
      .prepare(
        `${CONVERSATION_SELECT}
         WHERE c.artist_id = ? OR c.artist_id = ? OR c.promoter_id = ?
         ORDER BY c.last_message_at DESC`
      )
      .all(userId, userId, artistKey, userId);
    res.json((Array.isArray(rows) ? rows : []).map(mapConversation));
  } catch (e) {
    console.error("listConversations", e);
    res.status(500).json({ message: "Failed to load conversations" });
  }
});

// GET /api/messages/conversations/:id/messages — also marks the other side's messages read
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conv = await db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!canAccessConversation(req.user, conv)) {
      return res.status(403).json({ message: "Not your conversation" });
    }

    await db
      .prepare(
        `UPDATE messages SET read_flag = 1
         WHERE conversation_id = ? AND sender_id != ? AND read_flag = 0`
      )
      .run(req.params.id, userId);

    const rows = await db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(req.params.id);
    res.json((Array.isArray(rows) ? rows : []).map(mapMessage));
  } catch (e) {
    console.error("listMessages", e);
    res.status(500).json({ message: "Failed to load messages" });
  }
});

// POST /api/messages/conversations/:id/messages
router.post(
  "/conversations/:id/messages",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 30, key: "msg" }),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const conv = await db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      if (!canAccessConversation(req.user, conv)) {
        return res.status(403).json({ message: "Not your conversation" });
      }

      const attachment = parseAttachment(req.body?.attachment);
      if (attachment?.error) return res.status(400).json({ message: attachment.error });

      let body = sanitizeString(req.body?.body || req.body?.message || "", 4000);
      if (!body && !attachment) {
        return res.status(400).json({ message: "Message body is required" });
      }
      if (!body && attachment) body = `Sent ${attachment.meta.name}`;

      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const senderName =
        sanitizeString(req.user.name || req.body?.senderName || "User", 120) || "User";

      await db
        .prepare(
          `INSERT INTO messages (
            id, conversation_id, sender_id, sender_name, body, created_at, read_flag, attachment_json
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
        )
        .run(id, req.params.id, userId, senderName, body, createdAt, attachment ? JSON.stringify(attachment.meta) : null);

      if (attachment) {
        // File goes to storage; the row keeps metadata + the object key
        const storageKey = `${req.params.id}/${attachment.meta.id}`;
        await putObject(BUCKETS.attachments, storageKey, attachment.buffer, attachment.meta.type);
        await db
          .prepare(
            `INSERT INTO message_attachments (id, message_id, conversation_id, name, type, size, storage_key)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            attachment.meta.id,
            id,
            req.params.id,
            attachment.meta.name,
            attachment.meta.type,
            attachment.meta.size,
            storageKey
          );
      }

      const preview = (attachment ? `📎 ${attachment.meta.name}` : body).slice(0, 80);
      await db
        .prepare(
          `UPDATE conversations SET last_message_at = ?, last_message_preview = ? WHERE id = ?`
        )
        .run(createdAt, preview, req.params.id);

      await notifyNewMessage(conv, { id: userId, artistId: req.user.artistId, name: senderName }, preview);

      const row = await db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
      res.status(201).json(mapMessage(row));
    } catch (e) {
      console.error("sendMessage", e);
      res.status(500).json({ message: "Failed to send message" });
    }
  }
);

// GET /api/messages/attachments/:id — download a file (participants only)
router.get("/attachments/:id", requireAuth, async (req, res) => {
  try {
    const att = await db.prepare("SELECT * FROM message_attachments WHERE id = ?").get(req.params.id);
    if (!att) return res.status(404).json({ message: "File not found" });
    const conv = await db.prepare("SELECT * FROM conversations WHERE id = ?").get(att.conversation_id);
    if (!conv || !canAccessConversation(req.user, conv)) {
      return res.status(403).json({ message: "Not your conversation" });
    }
    let buffer;
    if (att.storage_key) {
      const file = await getObject(BUCKETS.attachments, att.storage_key);
      if (!file) return res.status(404).json({ message: "File not found" });
      buffer = file.buffer;
    } else {
      buffer = Buffer.from(att.data_base64 || "", "base64"); // stored before the storage move
    }
    res.set("Content-Type", att.type);
    res.set("Cache-Control", "private, no-store");
    res.attachment(att.name);
    res.send(buffer);
  } catch (e) {
    console.error("downloadAttachment", e);
    res.status(500).json({ message: "Failed to download file" });
  }
});

/**
 * POST /api/messages/conversations — open (or reuse) the chat for a booking.
 * Participants come from the booking itself, never from the request body.
 */
router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || "");
    if (!bookingId) return res.status(400).json({ message: "bookingId is required" });

    const booking = await db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const user = req.user;
    const isArtist =
      user.role === "artist" && (user.artistId || user.id) === booking.artist_id;
    const promoterIds = await promoterUserIds(booking);
    const isPromoter = promoterIds.includes(user.id);
    const demo = user.ephemeral && process.env.ALLOW_DEMO_TOKENS === "true";
    if (!isArtist && !isPromoter && !demo) {
      audit("conversation_forbidden", { userId: user.id, bookingId });
      return res.status(403).json({ message: "Not your booking" });
    }

    const existing = await db.prepare("SELECT id FROM conversations WHERE booking_id = ?").get(bookingId);
    if (existing) return res.json(mapConversation(await loadConversation(existing.id, user.id)));

    const promoterId = booking.promoter_id || promoterIds[0];
    if (!promoterId) {
      return res.status(409).json({ message: "The promoter for this booking has no account yet" });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const initialMessage = sanitizeString(req.body?.initialMessage || "", 4000);
    await db
      .prepare(
        `INSERT INTO conversations (
          id, booking_id, artist_id, artist_name, promoter_id, promoter_name,
          last_message_at, last_message_preview
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        bookingId,
        booking.artist_id,
        booking.artist_name,
        promoterId,
        booking.promoter_name || booking.client_name || "Promoter",
        now,
        initialMessage ? initialMessage.slice(0, 80) : "Booking chat"
      );

    if (initialMessage) {
      // The opening message is always from the person who opened the chat
      await db
        .prepare(
          `INSERT INTO messages (id, conversation_id, sender_id, sender_name, body, created_at, read_flag)
           VALUES (?, ?, ?, ?, ?, ?, 0)`
        )
        .run(uuidv4(), id, user.id, sanitizeString(user.name || "User", 120), initialMessage, now);
    }

    res.status(201).json(mapConversation(await loadConversation(id, user.id)));
  } catch (e) {
    console.error("createConversation", e);
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// GET /api/messages/unread-count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const artistKey = req.user.artistId || userId;
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE (c.artist_id = ? OR c.artist_id = ? OR c.promoter_id = ?)
           AND m.sender_id != ? AND m.read_flag = 0`
      )
      .get(userId, artistKey, userId, userId);
    res.json({ count: Number(row?.n || 0) });
  } catch (e) {
    console.error("unreadCount", e);
    res.status(500).json({ message: "Failed to load unread count" });
  }
});

export default router;
