import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { one, many, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { sanitizeString } from "../lib/security.js";

const router = Router();

async function mapConversation(row, userId) {
  const unreadRow = await one(
    `SELECT COUNT(*)::int AS n FROM messages
     WHERE conversation_id = $1 AND sender_id != $2 AND read_flag = FALSE`,
    [row.id, userId || ""]
  );
  return {
    id: row.id,
    bookingId: row.booking_id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    promoterId: row.promoter_id,
    promoterName: row.promoter_name,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview || "",
    unreadCount: Number(unreadRow?.n || 0),
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

router.get("/conversations", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const artistKey = req.user.artistId || userId;
    const rows = await many(
      `SELECT * FROM conversations
       WHERE artist_id = $1 OR artist_id = $2 OR promoter_id = $3
       ORDER BY last_message_at DESC`,
      [userId, artistKey, userId]
    );
    res.json(await Promise.all(rows.map((r) => mapConversation(r, userId))));
  } catch (err) {
    next(err);
  }
});

router.get("/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const conv = await one("SELECT * FROM conversations WHERE id = $1", [
      req.params.id,
    ]);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!canAccessConversation(req.user, conv) && !req.user.ephemeral) {
      return res.status(403).json({ message: "Not your conversation" });
    }
    await query(
      `UPDATE messages SET read_flag = TRUE
       WHERE conversation_id = $1 AND sender_id != $2`,
      [req.params.id, req.user.id]
    );
    const rows = await many(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows.map(mapMessage));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/conversations/:id/messages",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 30, key: "msg" }),
  async (req, res, next) => {
    try {
      const body = sanitizeString(req.body?.body, 4000);
      const { attachment } = req.body || {};
      const conv = await one("SELECT * FROM conversations WHERE id = $1", [
        req.params.id,
      ]);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      if (!canAccessConversation(req.user, conv) && !req.user.ephemeral) {
        return res.status(403).json({ message: "Not your conversation" });
      }
      if (!body.trim() && !attachment) {
        return res.status(400).json({ message: "body or attachment required" });
      }
      const id = uuidv4();
      const now = new Date().toISOString();
      await query(
        `INSERT INTO messages (
          id, conversation_id, sender_id, sender_name, body, created_at, read_flag, attachment_json
        ) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7)`,
        [
          id,
          req.params.id,
          req.user.id,
          req.user.name || "User",
          body || (attachment ? `Sent ${attachment.name}` : ""),
          now,
          attachment ? JSON.stringify(attachment) : null,
        ]
      );
      await query(
        `UPDATE conversations SET last_message_at = $1, last_message_preview = $2 WHERE id = $3`,
        [now, body.slice(0, 80) || "Attachment", req.params.id]
      );
      const row = await one("SELECT * FROM messages WHERE id = $1", [id]);
      res.status(201).json(mapMessage(row));
    } catch (err) {
      next(err);
    }
  }
);

router.post("/conversations", requireAuth, async (req, res, next) => {
  try {
    const { bookingId, artistId, artistName, promoterId, promoterName, initialMessage } =
      req.body || {};
    if (!bookingId || !artistId || !promoterId) {
      return res.status(400).json({
        message: "bookingId, artistId and promoterId are required",
      });
    }
    const existing = await one(
      "SELECT * FROM conversations WHERE booking_id = $1",
      [bookingId]
    );
    if (existing) {
      return res.json(await mapConversation(existing, req.user.id));
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO conversations (
        id, booking_id, artist_id, artist_name, promoter_id, promoter_name,
        last_message_at, last_message_preview, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        bookingId,
        artistId,
        artistName || "Artist",
        promoterId,
        promoterName || "Promoter",
        now,
        initialMessage ? String(initialMessage).slice(0, 80) : "Booking chat",
        now,
      ]
    );
    if (initialMessage) {
      await query(
        `INSERT INTO messages (
          id, conversation_id, sender_id, sender_name, body, created_at, read_flag
        ) VALUES ($1,$2,$3,$4,$5,$6,FALSE)`,
        [
          uuidv4(),
          id,
          promoterId,
          promoterName || "Promoter",
          String(initialMessage),
          now,
        ]
      );
    }
    const row = await one("SELECT * FROM conversations WHERE id = $1", [id]);
    res.status(201).json(await mapConversation(row, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get("/unread-count", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const artistKey = req.user.artistId || userId;
    const convs = await many(
      `SELECT id FROM conversations
       WHERE artist_id = $1 OR artist_id = $2 OR promoter_id = $3`,
      [userId, artistKey, userId]
    );
    if (!convs.length) return res.json({ count: 0 });
    const row = await one(
      `SELECT COUNT(*)::int AS n FROM messages
       WHERE conversation_id = ANY($1::text[])
         AND sender_id != $2 AND read_flag = FALSE`,
      [convs.map((c) => c.id), userId]
    );
    res.json({ count: Number(row?.n || 0) });
  } catch (err) {
    next(err);
  }
});

export default router;
