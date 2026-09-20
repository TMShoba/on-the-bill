import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { sanitizeString } from "../lib/security.js";

const router = Router();

async function mapConversation(row, userId) {
  const unreadRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE conversation_id = ? AND sender_id != ? AND read_flag = 0`
    )
    .get(row.id, userId || "");
  const unread = unreadRow?.n || 0;

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
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const artistKey = req.user.artistId || userId;
    const rows = await db
      .prepare(
        `SELECT * FROM conversations
         WHERE artist_id = ? OR artist_id = ? OR promoter_id = ?
         ORDER BY last_message_at DESC`
      )
      .all(userId, artistKey, userId);

    const list = Array.isArray(rows) ? rows : [];
    res.json(await Promise.all(list.map((r) => mapConversation(r, userId))));
  } catch (e) {
    console.error("listConversations", e);
    res.status(500).json({ message: "Failed to load conversations" });
  }
});

// GET /api/messages/conversations/:id/messages
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conv = await db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(req.params.id);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    if (!canAccessConversation(req.user, conv) && !req.user.ephemeral) {
      return res.status(403).json({ message: "Not your conversation" });
    }

    await db
      .prepare(
        `UPDATE messages SET read_flag = 1
         WHERE conversation_id = ? AND sender_id != ?`
      )
      .run(req.params.id, userId);

    const rows = await db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ?
         ORDER BY created_at ASC`
      )
      .all(req.params.id);

    const list = Array.isArray(rows) ? rows : [];
    res.json(list.map(mapMessage));
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
      const conv = await db
        .prepare("SELECT * FROM conversations WHERE id = ?")
        .get(req.params.id);
      if (!conv) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      if (!canAccessConversation(req.user, conv) && !req.user.ephemeral) {
        return res.status(403).json({ message: "Not your conversation" });
      }

      const body = sanitizeString(req.body?.body || req.body?.message || "", 4000);
      if (!body) {
        return res.status(400).json({ message: "Message body is required" });
      }

      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const senderName =
        sanitizeString(req.user.name || req.body?.senderName || "User", 120) ||
        "User";

      let attachmentJson = null;
      if (req.body?.attachment) {
        try {
          attachmentJson = JSON.stringify(req.body.attachment).slice(0, 4000);
        } catch {
          attachmentJson = null;
        }
      }

      await db
        .prepare(
          `INSERT INTO messages (
            id, conversation_id, sender_id, sender_name, body, created_at, read_flag, attachment_json
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
        )
        .run(
          id,
          req.params.id,
          userId,
          senderName,
          body,
          createdAt,
          attachmentJson
        );

      const preview = body.slice(0, 80);
      await db
        .prepare(
          `UPDATE conversations
           SET last_message_at = ?, last_message_preview = ?
           WHERE id = ?`
        )
        .run(createdAt, preview, req.params.id);

      const row = await db
        .prepare("SELECT * FROM messages WHERE id = ?")
        .get(id);
      res.status(201).json(mapMessage(row));
    } catch (e) {
      console.error("sendMessage", e);
      res.status(500).json({ message: "Failed to send message" });
    }
  }
);

// POST /api/messages/conversations
router.post("/conversations", requireAuth, async (req, res) => {
  try {
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

    const existing = await db
      .prepare("SELECT * FROM conversations WHERE booking_id = ?")
      .get(bookingId);
    if (existing) {
      return res.json(await mapConversation(existing, req.user.id));
    }

    const id = uuidv4();
    const now = new Date().toISOString();
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
        artistId,
        artistName || "Artist",
        promoterId,
        promoterName || "Promoter",
        now,
        initialMessage ? String(initialMessage).slice(0, 80) : "Booking chat"
      );

    if (initialMessage) {
      const mid = uuidv4();
      await db
        .prepare(
          `INSERT INTO messages (
            id, conversation_id, sender_id, sender_name, body, created_at, read_flag
          ) VALUES (?, ?, ?, ?, ?, ?, 0)`
        )
        .run(
          mid,
          id,
          promoterId,
          promoterName || "Promoter",
          String(initialMessage),
          now
        );
    }

    const row = await db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id);
    res.status(201).json(await mapConversation(row, req.user.id));
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
    const convRows = await db
      .prepare(
        `SELECT id FROM conversations
         WHERE artist_id = ? OR artist_id = ? OR promoter_id = ?`
      )
      .all(userId, artistKey, userId);

    const list = Array.isArray(convRows) ? convRows : [];
    const convIds = list.map((r) => r.id);

    if (convIds.length === 0) return res.json({ count: 0 });

    const placeholders = convIds.map(() => "?").join(",");
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages
         WHERE conversation_id IN (${placeholders})
           AND sender_id != ?
           AND read_flag = 0`
      )
      .get(...convIds, userId);

    res.json({ count: Number(row?.n || 0) });
  } catch (e) {
    console.error("unreadCount", e);
    res.status(500).json({ message: "Failed to load unread count" });
  }
});

export default router;
