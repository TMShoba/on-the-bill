import { Router } from "express";
import nodemailer from "nodemailer";

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

const SUBJECTS = {
  booking_request: (d) => `New booking request from ${d.promoterName}`,
  booking_accepted: (d) => `${d.artistName} accepted your booking request`,
  booking_declined: (d) => `${d.artistName} declined your booking request`,
  payment_received: (d) =>
    `${d.kind === "deposit" ? "Deposit" : "Payment"} received — ${d.venue}`,
};

const BODIES = {
  booking_request: (d) =>
    `${d.promoterName} wants to book you for ${d.venue} on ${d.eventDate}.\n\n` +
    `Log in to The LineUp to accept or decline this request.`,
  booking_accepted: (d) =>
    `Good news — ${d.artistName} accepted your request for ${d.venue} on ${d.eventDate}.\n\n` +
    `Log in to The LineUp to view the booking details and next steps.`,
  booking_declined: (d) =>
    `${d.artistName} declined your request for ${d.venue} on ${d.eventDate}.\n\n` +
    `You can browse other artists at thelineup.co.za/artists.`,
  payment_received: (d) =>
    `A ${d.kind === "deposit" ? "deposit" : "full payment"} of R${Number(
      d.amount || 0
    ).toLocaleString()} for ${d.venue} was recorded on The LineUp.\n\n` +
    `You can view the receipt from the booking's details.`,
};

// POST /api/notifications/email
// Body: { to, subject?, template, data }
router.post("/email", async (req, res) => {
  const { to, template, data } = req.body || {};

  if (!to || !template) {
    return res.status(400).json({ message: "to and template are required" });
  }
  if (!SUBJECTS[template] || !BODIES[template]) {
    return res.status(400).json({ message: `Unknown template: ${template}` });
  }

  const subject = req.body.subject || SUBJECTS[template](data || {});
  const text = BODIES[template](data || {});

  if (!transporter) {
    // No SMTP configured — log instead of failing the whole request, so
    // local/dev environments (and CI) don't need real email credentials.
    console.info(`[email:not-configured] Would send "${template}" to ${to}`);
    console.info(`  Subject: ${subject}`);
    console.info(`  Body: ${text}`);
    return res.json({ sent: false, reason: "SMTP not configured on server" });
  }

  try {
    await transporter.sendMail({ from: FROM_ADDRESS, to, subject, text });
    res.json({ sent: true });
  } catch (err) {
    console.error("Email send failed:", err);
    res.status(502).json({ message: "Failed to send email" });
  }
});

export default router;
