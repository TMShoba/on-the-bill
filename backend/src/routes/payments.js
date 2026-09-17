import { Router } from "express";
import crypto from "crypto";
import { one, query } from "../db.js";

const router = Router();

function buildSignature(data, passphrase) {
  const keys = Object.keys(data)
    .filter((k) => k !== "signature" && data[k] !== undefined && data[k] !== "")
    .sort();
  const paramString = keys
    .map(
      (k) =>
        `${k}=${encodeURIComponent(String(data[k]).trim()).replace(/%20/g, "+")}`
    )
    .join("&");
  const withPass = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
    : paramString;
  return crypto.createHash("md5").update(withPass).digest("hex");
}

router.post("/payfast/itn", async (req, res) => {
  try {
    const body = req.body || {};
    const bookingId = body.custom_str1 || body.m_payment_id;
    const passphrase = process.env.PAYFAST_PASSPHRASE || "";

    if (passphrase && body.signature) {
      if (buildSignature(body, passphrase) !== body.signature) {
        return res.status(400).send("Invalid signature");
      }
    }

    if (!bookingId) return res.status(400).send("Missing booking reference");

    const existing = await one("SELECT * FROM bookings WHERE id = $1", [
      bookingId,
    ]);
    if (!existing) return res.status(200).send("OK");

    if (String(body.payment_status || "").toUpperCase() === "COMPLETE") {
      const kind = body.custom_str2 === "deposit" ? "deposit" : "paid";
      const nextPayment = kind === "deposit" ? "deposit" : "paid";
      const nextStatus = kind === "deposit" ? existing.status : "paid";
      await query(
        `UPDATE bookings SET payment_status = $1, status = $2, paid_at = NOW(),
         dispute_reason = NULL, disputed_at = NULL WHERE id = $3`,
        [nextPayment, nextStatus, bookingId]
      );
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("[payfast/itn]", err.message);
    res.status(500).send("Error");
  }
});

router.get("/payfast/config", (_req, res) => {
  res.json({
    live: process.env.PAYFAST_LIVE === "true",
    merchantIdConfigured: Boolean(process.env.PAYFAST_MERCHANT_ID),
    itnPath: "/api/payments/payfast/itn",
    database: "postgres",
  });
});

export default router;
