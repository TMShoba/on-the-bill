import { Router } from "express";
import db from "../db.js";
import { emailEnabled, sendEmail } from "../lib/mailer.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeString,
} from "../lib/security.js";
import { audit } from "../lib/audit.js";

const router = Router();

const ALLOWED_TEMPLATES = new Set([
  "booking_request",
  "booking_accepted",
  "booking_declined",
  "payment_received",
]);

const SUBJECTS = {
  booking_request: (d) =>
    `New booking request from ${sanitizeString(d.promoterName, 80)}`,
  booking_accepted: (d) =>
    `${sanitizeString(d.artistName, 80)} accepted your booking request`,
  booking_declined: (d) =>
    `${sanitizeString(d.artistName, 80)} declined your booking request`,
  payment_received: (d) =>
    `${d.kind === "deposit" ? "Deposit" : "Payment"} received — ${sanitizeString(d.venue, 80)}`,
};

const BODIES = {
  booking_request: (d) =>
    `${sanitizeString(d.promoterName, 80)} wants to book you for ${sanitizeString(d.venue, 120)} on ${sanitizeString(d.eventDate, 40)}.\n\n` +
    `Log in to The LineUp to accept or decline this request.`,
  booking_accepted: (d) =>
    `Good news — ${sanitizeString(d.artistName, 80)} accepted your request for ${sanitizeString(d.venue, 120)} on ${sanitizeString(d.eventDate, 40)}.\n\n` +
    `Log in to The LineUp to view the booking details and next steps.`,
  booking_declined: (d) =>
    `${sanitizeString(d.artistName, 80)} declined your request for ${sanitizeString(d.venue, 120)} on ${sanitizeString(d.eventDate, 40)}.\n\n` +
    `You can browse other artists on The LineUp.`,
  payment_received: (d) =>
    `A ${d.kind === "deposit" ? "deposit" : "full payment"} of R${Number(d.amount || 0).toLocaleString()} for ${sanitizeString(d.venue, 120)} was recorded on The LineUp.\n\n` +
    `You can view the receipt from the booking details.`,
};

const emailLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: Number(process.env.RATE_LIMIT_EMAIL || 20),
  key: "email",
});

/**
 * POST /api/notifications/email
 * Requires auth — prevents open relay abuse.
 * Body: { to, template, data?, subject? }
 */
router.post("/email", requireAuth, emailLimiter, async (req, res) => {
  const to = normalizeEmail(req.body?.to);
  const template = sanitizeString(req.body?.template, 40);
  const data = req.body?.data && typeof req.body.data === "object"
    ? req.body.data
    : {};

  if (!to || !template) {
    return res.status(400).json({ message: "to and template are required" });
  }
  if (!isValidEmail(to)) {
    return res.status(400).json({ message: "Invalid recipient email" });
  }
  if (!ALLOWED_TEMPLATES.has(template)) {
    return res.status(400).json({ message: `Unknown template: ${template}` });
  }

  // Optional subject override — sanitized, limited
  const subject =
    sanitizeString(req.body?.subject, 120) || SUBJECTS[template](data);
  const text = BODIES[template](data);

  if (!emailEnabled) {
    audit("email_logged_only", { template, userId: req.user?.id });
    return res.json({ sent: false, reason: "SMTP not configured on server" });
  }

  const result = await sendEmail({ to, subject, text });
  audit(result.sent ? "email_sent" : "email_fail", { template, userId: req.user?.id });
  if (!result.sent) return res.status(502).json({ message: "Failed to send email" });
  res.json({ sent: true });
});

function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body || "",
    href: row.href || undefined,
    createdAt: row.created_at,
    read: Boolean(row.read_flag),
  };
}

// GET /api/notifications — latest in-app notifications for the signed-in user
router.get("/", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .prepare(
        `SELECT * FROM notifications WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 100`
      )
      .all(req.user.id);
    res.json(rows.map(mapNotification));
  } catch (e) {
    console.error("list notifications", e);
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_flag = 0")
      .get(req.user.id);
    res.json({ count: Number(row?.n || 0) });
  } catch (e) {
    console.error("notification count", e);
    res.status(500).json({ message: "Failed to load notification count" });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    await db
      .prepare("UPDATE notifications SET read_flag = 1 WHERE user_id = ? AND read_flag = 0")
      .run(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    console.error("read-all notifications", e);
    res.status(500).json({ message: "Failed to update notifications" });
  }
});

// POST /api/notifications/:id/read
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    await db
      .prepare("UPDATE notifications SET read_flag = 1 WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (e) {
    console.error("read notification", e);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

export default router;
