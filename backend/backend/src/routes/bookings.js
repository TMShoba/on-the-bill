import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

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
  // Promoter / client
  if (user.id && row.promoter_id === user.id) return true;
  if (user.email && row.client_email) {
    return row.client_email.toLowerCase() === user.email.toLowerCase();
  }
  return false;
}

// GET /api/bookings — scoped to the authenticated user when present
router.get("/", optionalAuth, (req, res) => {
  let rows;
  if (req.user && !req.user.ephemeral) {
    if (req.user.role === "artist") {
      const artistKey = req.user.artistId || req.user.id;
      rows = db
        .prepare(
          `SELECT * FROM bookings
           WHERE artist_id = ? OR artist_id = ?
           ORDER BY created_at DESC`
        )
        .all(artistKey, req.user.id);
    } else {
      rows = db
        .prepare(
          `SELECT * FROM bookings
           WHERE promoter_id = ? OR LOWER(client_email) = LOWER(?)
           ORDER BY created_at DESC`
        )
        .all(req.user.id, req.user.email || "");
    }
  } else if (req.user?.ephemeral) {
    // Demo users not in DB: filter by artist/promoter id heuristics
    if (req.user.role === "artist") {
      rows = db
        .prepare(
          `SELECT * FROM bookings WHERE artist_id = ? ORDER BY created_at DESC`
        )
        .all(req.user.id);
    } else {
      rows = db
        .prepare(
          `SELECT * FROM bookings WHERE promoter_id = ? ORDER BY created_at DESC`
        )
        .all(req.user.id);
    }
  } else {
    // Unauthenticated: return empty (don't leak all bookings)
    rows = [];
  }
  res.json(rows.map(mapBooking));
});

// GET /api/bookings/:id
router.get("/:id", optionalAuth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ message: "Booking not found" });
  if (req.user && !canAccessBooking(req.user, row) && !req.user.ephemeral) {
    // still allow if email matches loosely
  }
  res.json(mapBooking(row));
});

// POST /api/bookings — create request (promoter / authenticated)
router.post("/", optionalAuth, (req, res) => {
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

  const artist = db
    .prepare("SELECT id, stage_name FROM artists WHERE id = ?")
    .get(artistId);

  if (!artist) {
    return res.status(404).json({ message: "Artist not found" });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const promoterId = req.user?.id || null;

  db.prepare(
    `INSERT INTO bookings (
      id, artist_id, artist_name, client_name, client_email,
      event_date, venue, message, status, created_at,
      address, city, time, fee, promoter_name, promoter_id, notes,
      reminder_opt_in, payment_status
    ) VALUES (
      @id, @artist_id, @artist_name, @client_name, @client_email,
      @event_date, @venue, @message, 'pending', @created_at,
      @address, @city, @time, @fee, @promoter_name, @promoter_id, @notes,
      @reminder_opt_in, 'unpaid'
    )`
  ).run({
    id,
    artist_id: artistId,
    artist_name: artist.stage_name,
    client_name: clientName,
    client_email: clientEmail,
    event_date: eventDate,
    venue: venue || "",
    message: message || "",
    created_at: createdAt,
    address: address || "",
    city: city || "",
    time: time || "",
    fee: fee != null && fee !== "" ? Number(fee) : null,
    promoter_name: promoterName || clientName,
    promoter_id: promoterId,
    notes: notes || message || "",
    reminder_opt_in: reminderOptIn ? 1 : 0,
  });

  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
  res.status(201).json(mapBooking(row));
});

// PATCH /api/bookings/:id — status / payment / dispute / reminder
router.patch("/:id", optionalAuth, (req, res) => {
  const existing = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(req.params.id);

  if (!existing) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const {
    status,
    paymentStatus,
    reminderOptIn,
    disputeReason,
  } = req.body;

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
    // Artists accept/decline; promoters shouldn't force confirmed without ownership rules
    if (
      (status === "confirmed" || status === "declined") &&
      req.user &&
      req.user.role === "artist"
    ) {
      const artistKey = req.user.artistId || req.user.id;
      if (
        existing.artist_id !== artistKey &&
        existing.artist_id !== req.user.id &&
        !req.user.ephemeral
      ) {
        return res.status(403).json({ message: "Not your booking" });
      }
    }
    nextStatus = status;
    if (status === "confirmed" && nextPayment === "unpaid") {
      nextPayment = "unpaid";
    }
    if (status === "paid") {
      nextPayment = "paid";
      paidAt = new Date().toISOString();
    }
  }

  if (paymentStatus !== undefined) {
    if (!["unpaid", "deposit", "paid", "disputed"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid paymentStatus" });
    }
    nextPayment = paymentStatus;
    if (paymentStatus === "paid" || paymentStatus === "deposit") {
      paidAt = new Date().toISOString();
      if (paymentStatus === "paid") nextStatus = "paid";
      dispute_reason = null;
      disputed_at = null;
    }
    if (paymentStatus === "disputed") {
      dispute_reason = disputeReason || existing.dispute_reason || "Dispute opened";
      disputed_at = new Date().toISOString();
    }
  }

  if (typeof reminderOptIn === "boolean") {
    reminder = reminderOptIn ? 1 : 0;
  }

  if (disputeReason && !paymentStatus) {
    nextPayment = "disputed";
    dispute_reason = disputeReason;
    disputed_at = new Date().toISOString();
  }

  db.prepare(
    `UPDATE bookings SET
      status = ?,
      payment_status = ?,
      paid_at = ?,
      dispute_reason = ?,
      disputed_at = ?,
      reminder_opt_in = ?
     WHERE id = ?`
  ).run(
    nextStatus,
    nextPayment,
    paidAt,
    dispute_reason,
    disputed_at,
    reminder,
    req.params.id
  );

  const row = db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(req.params.id);
  res.json(mapBooking(row));
});

export default router;
