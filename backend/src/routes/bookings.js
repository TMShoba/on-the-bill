import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { one, many, query } from "../db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  sanitizeString,
  normalizeEmail,
  isValidEmail,
} from "../lib/security.js";

const router = Router();

function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    clientName: row.client_name,
    clientEmail: row.client_email,
    eventDate: row.event_date,
    venue: row.venue || "",
    message: row.message || "",
    status: row.status,
    createdAt: row.created_at,
    address: row.address || "",
    city: row.city || "",
    time: row.time || "",
    fee: row.fee != null ? row.fee : undefined,
    promoterName: row.promoter_name || row.client_name || "",
    promoterId: row.promoter_id || undefined,
    notes: row.notes || "",
    reminderOptIn: Boolean(row.reminder_opt_in),
    paymentStatus: row.payment_status || "unpaid",
    paidAt: row.paid_at || undefined,
    disputeReason: row.dispute_reason || undefined,
    disputedAt: row.disputed_at || undefined,
  };
}

function canAccessBooking(user, row) {
  if (!user) return false;
  if (user.role === "artist") {
    const artistKey = user.artistId || user.id;
    return row.artist_id === artistKey || row.artist_id === user.id;
  }
  if (user.id && row.promoter_id === user.id) return true;
  if (user.email && row.client_email) {
    return row.client_email.toLowerCase() === user.email.toLowerCase();
  }
  return false;
}

function isArtistOwner(user, row) {
  if (!user || user.role !== "artist") return false;
  const artistKey = user.artistId || user.id;
  return row.artist_id === artistKey || row.artist_id === user.id;
}

router.get("/", optionalAuth, async (req, res, next) => {
  try {
    let rows = [];
    if (req.user && !req.user.ephemeral) {
      if (req.user.role === "artist") {
        const artistKey = req.user.artistId || req.user.id;
        rows = await many(
          `SELECT * FROM bookings
           WHERE artist_id = $1 OR artist_id = $2
           ORDER BY created_at DESC`,
          [artistKey, req.user.id]
        );
      } else {
        rows = await many(
          `SELECT * FROM bookings
           WHERE promoter_id = $1 OR LOWER(client_email) = LOWER($2)
           ORDER BY created_at DESC`,
          [req.user.id, req.user.email || ""]
        );
      }
    } else if (req.user?.ephemeral && process.env.ALLOW_DEMO_TOKENS === "true") {
      if (req.user.role === "artist") {
        rows = await many(
          `SELECT * FROM bookings
           WHERE artist_id = $1 OR artist_id = $2
           ORDER BY created_at DESC LIMIT 100`,
          [req.user.id, req.user.artistId || req.user.id]
        );
      } else {
        rows = await many(
          `SELECT * FROM bookings
           WHERE promoter_id = $1 OR LOWER(client_email) = LOWER($2)
           ORDER BY created_at DESC`,
          [req.user.id, req.user.email || ""]
        );
      }
    }
    res.json(rows.map(mapBooking));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const row = await one("SELECT * FROM bookings WHERE id = $1", [
      req.params.id,
    ]);
    if (!row) return res.status(404).json({ message: "Booking not found" });
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!canAccessBooking(req.user, row) && !req.user.ephemeral) {
      return res.status(403).json({ message: "Not your booking" });
    }
    res.json(mapBooking(row));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  rateLimit({ windowMs: 60_000, max: 20, key: "bookings-create" }),
  optionalAuth,
  async (req, res, next) => {
    try {
      const {
        artistId,
        clientName,
        clientEmail,
        eventDate,
        venue,
        message,
        address,
        city,
        time,
        fee,
        promoterName,
        notes,
        reminderOptIn,
      } = req.body;

      if (!artistId || !clientName || !clientEmail || !eventDate) {
        return res.status(400).json({
          message:
            "artistId, clientName, clientEmail and eventDate are required",
        });
      }
      if (!isValidEmail(clientEmail)) {
        return res
          .status(400)
          .json({ message: "Valid clientEmail is required" });
      }

      const artist = await one(
        "SELECT id, stage_name FROM artists WHERE id = $1",
        [artistId]
      );
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      const id = uuidv4();
      const promoterId = req.user?.id || null;

      await query(
        `INSERT INTO bookings (
          id, artist_id, artist_name, client_name, client_email,
          event_date, venue, message, status, created_at,
          address, city, time, fee, promoter_name, promoter_id, notes,
          reminder_opt_in, payment_status
        ) VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,'pending',NOW(),
          $9,$10,$11,$12,$13,$14,$15,
          $16,'unpaid'
        )`,
        [
          id,
          artistId,
          artist.stage_name,
          sanitizeString(clientName, 120),
          normalizeEmail(clientEmail),
          eventDate,
          sanitizeString(venue || "", 200),
          sanitizeString(message || "", 2000),
          sanitizeString(address || "", 200),
          sanitizeString(city || "", 100),
          sanitizeString(time || "", 20),
          fee != null && fee !== "" ? Number(fee) : null,
          sanitizeString(promoterName || clientName, 120),
          promoterId,
          sanitizeString(notes || message || "", 2000),
          Boolean(reminderOptIn),
        ]
      );

      const row = await one("SELECT * FROM bookings WHERE id = $1", [id]);
      res.status(201).json(mapBooking(row));
    } catch (err) {
      next(err);
    }
  }
);

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await one("SELECT * FROM bookings WHERE id = $1", [
      req.params.id,
    ]);
    if (!existing) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (!canAccessBooking(req.user, existing) && !req.user.ephemeral) {
      return res.status(403).json({ message: "Not your booking" });
    }

    const { status, paymentStatus, reminderOptIn, disputeReason } = req.body;
    let nextStatus = existing.status;
    let nextPayment = existing.payment_status || "unpaid";
    let paidAt = existing.paid_at;
    let dispute_reason = existing.dispute_reason;
    let disputed_at = existing.disputed_at;
    let reminder = existing.reminder_opt_in;

    if (status !== undefined) {
      if (!["pending", "confirmed", "declined", "paid"].includes(status)) {
        return res.status(400).json({
          message: "status must be pending, confirmed, declined, or paid",
        });
      }
      if (status === "confirmed" || status === "declined") {
        if (!isArtistOwner(req.user, existing) && !req.user.ephemeral) {
          return res.status(403).json({
            message: "Only the booked artist can accept or decline",
          });
        }
      }
      if (status === "paid") {
        return res.status(403).json({
          message:
            "Payment status is confirmed by the payment gateway, not manually",
        });
      }
      nextStatus = status;
    }

    if (paymentStatus !== undefined) {
      if (!["unpaid", "deposit", "paid", "disputed"].includes(paymentStatus)) {
        return res.status(400).json({ message: "Invalid paymentStatus" });
      }
      if (paymentStatus === "disputed") {
        nextPayment = "disputed";
        dispute_reason =
          disputeReason || existing.dispute_reason || "Dispute opened";
        disputed_at = new Date().toISOString();
      } else if (paymentStatus === "unpaid") {
        if (existing.payment_status === "unpaid") nextPayment = "unpaid";
        else {
          return res.status(403).json({
            message: "Paid bookings can only be updated by the payment system",
          });
        }
      } else {
        const internal =
          req.headers["x-lineup-internal"] === process.env.INTERNAL_API_KEY &&
          process.env.INTERNAL_API_KEY;
        if (!internal && process.env.ALLOW_DEMO_TOKENS !== "true") {
          return res.status(403).json({
            message:
              "Payment confirmation is handled by PayFast. Complete checkout to update status.",
          });
        }
        nextPayment = paymentStatus;
        paidAt = new Date().toISOString();
        if (paymentStatus === "paid") nextStatus = "paid";
        dispute_reason = null;
        disputed_at = null;
      }
    }

    if (typeof reminderOptIn === "boolean") reminder = reminderOptIn;

    if (disputeReason && !paymentStatus) {
      nextPayment = "disputed";
      dispute_reason = disputeReason;
      disputed_at = new Date().toISOString();
    }

    await query(
      `UPDATE bookings SET
        status = $1, payment_status = $2, paid_at = $3,
        dispute_reason = $4, disputed_at = $5, reminder_opt_in = $6
       WHERE id = $7`,
      [
        nextStatus,
        nextPayment,
        paidAt,
        dispute_reason,
        disputed_at,
        Boolean(reminder),
        req.params.id,
      ]
    );

    const row = await one("SELECT * FROM bookings WHERE id = $1", [
      req.params.id,
    ]);
    res.json(mapBooking(row));
  } catch (err) {
    next(err);
  }
});

export default router;
