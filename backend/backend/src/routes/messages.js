import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const router = Router();

function mapConversation(row, userId) {
  const unread = db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE conversation_id = ? AND sender_id != ? AND read_flag = 0`
    )
    .get(row.id, userId || "")?.n || 0;

  return {
    id: row.id,
    bookingId: row.booking_id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    promoterId: row.promoter_id,
    promoterName: row.promoter_name,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview || "",
    unreadCount: Number(unread),
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

function canAccessConversation(user, row) {
  if (!user) return false;
  if (user.id === row.artist_id || user.id === row.promoter_id) return true;
  if (user.artistId && user.artistId === row.artist_id) return true;
  return false;
}

// GET /api/messages/conversations
router.get("/conversations", requireAuth, (req, res) => {
  const userId = req.user.id;
  const artistKey = req.user.artistId || userId;
  const rows = db
    .prepare(
      `SELECT * FROM conversations
       WHERE artist_id = ? OR artist_id = ? OR promoter_id = ?
       ORDER BY last_message_at DESC`
    )
    .all(userId, artistKey, userId);
  res.json(rows.map((r) => mapConversation(r, userId)));
});

// GET /api/messages/conversations/:id/messages
router.get("/conversations/:id/messages", requireAuth, (req, res) => {
  const userId = req.user.id;
  const conv = db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(req.params.id);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!canAccessConversation(req.user, conv) && !req.user.ephemeral) {
    return res.status(403).json({ message: "Not your conversation" });
  }

  // Mark messages from the other party as read
  db.prepare(
    `UPDATE messages SET read_flag = 1
     WHERE conversation_id = ? AND sender_id != ?`
  ).run(req.params.id, userId);

  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ?
       ORDER BY created_at ASC`
    )
    .all(req.params.id);

  res.json(rows.map(mapMessage));
});

// POST /api/messages/conversations/:id/messages
router.post("/conversations/:id/messages", requireAuth, (req, res) => {
  const userId = req.user.id;
  const conv = db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(req.params.id);
  if (!conv) return res.status(404).json({ message: "Conversation not found" });
  if (!canAccessConversation(req.user, conv) && !req.user.ephemeral) {
    return res.status(403).json({ message: "Not your conversation" });
  }

  const { body, attachment, senderName } = req.body;
  if ((!body || !String(body).trim()) && !attachment) {
    return res.status(400).json({ message: "body or attachment required" });
  }

  // Cap attachment JSON size (~1.5MB base64 is large for SQLite demo)
  let attachmentJson = null;
  if (attachment) {
    const raw = JSON.stringify(attachment);
    if (raw.length > 2_000_000) {
      return res.status(400).json({
        message: "Attachment too large (max ~1.5MB)",
      });
    }
    attachmentJson = raw;
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const preview = attachment
    ? `📎 ${attachment.name}${body ? ` — ${String(body).slice(0, 60)}` : ""}`
    : String(body).slice(0, 80);

  db.prepare(
    `INSERT INTO messages (
      id, conversation_id, sender_id, sender_name, body, created_at, read_flag, attachment_json
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    req.params.id,
    userId,
    senderName || req.user.name || "User",
    body ? String(body) : attachment ? `Sent ${attachment.name}` : "",
    createdAt,
    attachmentJson
  );

  db.prepare(
    `UPDATE conversations SET last_message_at = ?, last_message_preview = ? WHERE id = ?`
  ).run(createdAt, preview, req.params.id);

  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  res.status(201).json(mapMessage(row));
});

// POST /api/messages/conversations — ensure conversation for a booking
router.post("/conversations", requireAuth, (req, res) => {
  const {
    bookingId,
    artistId,
    artistName,
    promoterId,
    promoterName,
    initialMessage,
  } = req.body;

  if (!bookingId || !artistId || !promoterId) {
    return res.status(400).json({
      message: "bookingId, artistId and promoterId are required",
    });
  }

  const existing = db
    .prepare("SELECT * FROM conversations WHERE booking_id = ?")
    .get(bookingId);
  if (existing) {
    return res.json(mapConversation(existing, req.user.id));
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO conversations (
      id, booking_id, artist_id, artist_name, promoter_id, promoter_name,
      last_message_at, last_message_preview, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    bookingId,
    artistId,
    artistName || "Artist",
    promoterId,
    promoterName || "Promoter",
    now,
    initialMessage ? String(initialMessage).slice(0, 80) : "Booking chat",
    now
  );

  if (initialMessage) {
    const mid = uuidv4();
    db.prepare(
      `INSERT INTO messages (
        id, conversation_id, sender_id, sender_name, body, created_at, read_flag
      ) VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(
      mid,
      id,
      promoterId,
      promoterName || "Promoter",
      String(initialMessage),
      now
    );
  }

  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  res.status(201).json(mapConversation(row, req.user.id));
});

// GET /api/messages/unread-count
router.get("/unread-count", requireAuth, (req, res) => {
  const userId = req.user.id;
  const artistKey = req.user.artistId || userId;
  const convIds = db
    .prepare(
      `SELECT id FROM conversations
       WHERE artist_id = ? OR artist_id = ? OR promoter_id = ?`
    )
    .all(userId, artistKey, userId)
    .map((r) => r.id);

  if (convIds.length === 0) return res.json({ count: 0 });

  const placeholders = convIds.map(() => "?").join(",");
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE conversation_id IN (${placeholders})
         AND sender_id != ?
         AND read_flag = 0`
    )
    .get(...convIds, userId);

  res.json({ count: Number(row?.n || 0) });
});

export default router;
