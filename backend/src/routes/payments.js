import { Router } from "express";
import crypto from "crypto";
import db from "../db.js";

const router = Router();

/**
 * PayFast ITN (Instant Transaction Notification) webhook.
 * PayFast POSTs form-urlencoded fields; we verify signature when passphrase is set.
 * Docs: https://developers.payfast.co.za/docs#step_4_itn
 */
function buildSignature(data, passphrase) {
  const keys = Object.keys(data)
    .filter((k) => k !== "signature" && data[k] !== undefined && data[k] !== "")
    .sort();
  const paramString = keys
    .map((k) => `${k}=${encodeURIComponent(String(data[k]).trim()).replace(/%20/g, "+")}`)
    .join("&");
  const withPass = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : paramString;
  return crypto.createHash("md5").update(withPass).digest("hex");
}

// POST /api/payments/payfast/itn
router.post("/payfast/itn", async (req, res) => {
  // PayFast expects a plain 200 as soon as possible
  const body = req.body || {};
  const {
    payment_status,
    m_payment_id,
    pf_payment_id,
    amount_gross,
    custom_str1, // we put booking id here
    signature,
  } = body;

  const bookingId = custom_str1 || m_payment_id;
  const passphrase = process.env.PAYFAST_PASSPHRASE || "";

  if (passphrase && signature) {
    const expected = buildSignature(body, passphrase);
    if (expected !== signature) {
      console.warn("[payfast/itn] Invalid signature", { bookingId, pf_payment_id });
      return res.status(400).send("Invalid signature");
    }
  } else if (process.env.NODE_ENV === "production" && process.env.PAYFAST_PASSPHRASE) {
    console.warn("[payfast/itn] Missing signature in production");
    return res.status(400).send("Signature required");
  }

  if (!bookingId) {
    console.warn("[payfast/itn] No booking id in payload");
    return res.status(400).send("Missing booking reference");
  }

  const existing = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(bookingId);

  if (!existing) {
    console.warn("[payfast/itn] Unknown booking", bookingId);
    // Still 200 so PayFast stops retrying for unknown/test ids
    return res.status(200).send("OK");
  }

  const status = String(payment_status || "").toUpperCase();
  if (status === "COMPLETE") {
    const kind = body.custom_str2 === "deposit" ? "deposit" : "paid";
    const nextPayment = kind === "deposit" ? "deposit" : "paid";
    const nextStatus = kind === "deposit" ? existing.status : "paid";
    const paidAt = new Date().toISOString();

    await db.prepare(
      `UPDATE bookings SET
        payment_status = ?,
        status = ?,
        paid_at = ?,
        dispute_reason = NULL,
        disputed_at = NULL
       WHERE id = ?`
    ).run(nextPayment, nextStatus, paidAt, bookingId);

    console.info(
      `[payfast/itn] Booking ${bookingId} marked ${nextPayment} (pf=${pf_payment_id}, amount=${amount_gross})`
    );
  } else {
    console.info(
      `[payfast/itn] Booking ${bookingId} payment_status=${payment_status} (ignored)`
    );
  }

  res.status(200).send("OK");
});

// GET /api/payments/payfast/config — public config for frontend (no secrets)
router.get("/payfast/config", (_req, res) => {
  const live = process.env.PAYFAST_LIVE === "true";
  res.json({
    live,
    merchantIdConfigured: Boolean(process.env.PAYFAST_MERCHANT_ID),
    itnPath: "/api/payments/payfast/itn",
  });
});

export default router;
