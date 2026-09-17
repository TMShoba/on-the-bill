import { Router } from "express";
import nodemailer from "nodemailer";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeString,
} from "../lib/security.js";
import { audit } from "../lib/audit.js";

const router = Router();

const SMTP_CONFIGURED = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

const transporter = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const FROM_ADDRESS =
  process.env.SMTP_FROM || "The LineUp <no-reply@thelineup.co.za>";

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

  if (!transporter) {
    console.info(`[email:not-configured] Would send "${template}" to (redacted)`);
    audit("email_logged_only", { template, userId: req.user?.id });
    return res.json({ sent: false, reason: "SMTP not configured on server" });
  }

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, text });
    audit("email_sent", { template, userId: req.user?.id });
    res.json({ sent: true });
  } catch (err) {
    console.error("Email send failed:", err.message);
    audit("email_fail", { template, userId: req.user?.id });
    res.status(502).json({ message: "Failed to send email" });
  }
});

export default router;
