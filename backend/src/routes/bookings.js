import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import { sanitizeString, normalizeEmail, isValidEmail } from "../lib/security.js";
import { ensureContract, ensureReceipt } from "../lib/documents.js";
import {
  notifyNewBookingRequest,
  notifyBookingStatusChange,
  notifyPaymentReceived,
} from "../lib/notify.js";
import { isIdentityVerified } from "./verification.js";
import { isDateBlocked, blockedDates } from "./calendar.js";

const router = Router();

const TRAVEL_FLAGS = ["flights", "accommodation", "groundTransport", "visaSupport"];

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-ZA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Keep only known travel fields so the stored JSON stays predictable */
function sanitizeTravel(input) {
  if (!input || typeof input !== "object") return null;
  const travel = {};
  for (const flag of TRAVEL_FLAGS) travel[flag] = Boolean(input[flag]);
  const crew = Number(input.crewSize);
  travel.crewSize = Number.isFinite(crew) ? Math.min(Math.max(Math.round(crew), 1), 30) : 1;
  travel.notes = sanitizeString(input.notes || "", 1000);
  return travel;
}

function parseTravel(json) {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

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
    eventCountry: row.event_country || "ZA",
    eventTimezone: row.event_timezone || "Africa/Johannesburg",
    travel: parseTravel(row.travel_json),
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

function isPromoterOwner(user, row) {
  if (!user) return false;
  if (user.id && row.promoter_id === user.id) return true;
  if (user.email && row.client_email) {
    return row.client_email.toLowerCase() === user.email.toLowerCase();
  }
  return false;
}

// GET /api/bookings
router.get("/", optionalAuth, async (req, res) => {
  let rows = [];
  if (req.user && !req.user.ephemeral) {
    if (req.user.role === "artist") {
      const artistKey = req.user.artistId || req.user.id;
      rows = await db
        .prepare(
          `SELECT * FROM bookings
           WHERE artist_id = ? OR artist_id = ?
           ORDER BY created_at DESC`
        )
        .all(artistKey, req.user.id);
    } else {
      rows = await db
        .prepare(
          `SELECT * FROM bookings
           WHERE promoter_id = ? OR LOWER(client_email) = LOWER(?)
           ORDER BY created_at DESC`
        )
        .all(req.user.id, req.user.email || "");
    }
  } else if (req.user?.ephemeral && process.env.ALLOW_DEMO_TOKENS === "true") {
    if (req.user.role === "artist") {
      rows = await db
        .prepare(
          `SELECT * FROM bookings
           WHERE artist_id = ? OR artist_id = ?
           ORDER BY created_at DESC LIMIT 100`
        )
        .all(req.user.id, req.user.artistId || req.user.id);
      if (rows.length === 0) {
        rows = await db
          .prepare(`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 20`)
          .all();
      }
    } else {
      rows = await db
        .prepare(
          `SELECT * FROM bookings
           WHERE promoter_id = ? OR LOWER(client_email) = LOWER(?)
           ORDER BY created_at DESC`
        )
        .all(req.user.id, req.user.email || "");
    }
  }
  res.json(rows.map(mapBooking));
});


// GET /api/bookings/artist/:artistId/calendar
// Promoters see the artist's gigs (status, time, city) — not other promoters' contact or fee.
router.get("/artist/:artistId/calendar", optionalAuth, async (req, res) => {
  try {
    const rows = await db
      .prepare(
        `SELECT id, artist_id, artist_name, event_date, time, city, venue, status,
                event_country, event_timezone
         FROM bookings
         WHERE artist_id::text = ?
           AND status IN ('pending', 'confirmed', 'paid', 'declined')
         ORDER BY event_date ASC`
      )
      .all(String(req.params.artistId));
    const list = Array.isArray(rows) ? rows : [];
    // Dates the artist blocked show as unavailable (the artist's note stays private)
    const blocks = (await blockedDates(req.params.artistId)).map((b) => ({
      id: `block-${b.date}`,
      artistId: String(req.params.artistId),
      artistName: "",
      eventDate: b.date,
      time: "",
      city: "",
      venue: "Unavailable",
      status: "blocked",
      clientName: "",
      clientEmail: "",
      message: "",
    }));
    res.json([
      ...blocks,
      ...list.map((row) => ({
        id: row.id,
        artistId: row.artist_id,
        artistName: row.artist_name,
        eventDate: String(row.event_date || "").slice(0, 10),
        time: row.time || "",
        city: row.city || "",
        eventCountry: row.event_country || "ZA",
        eventTimezone: row.event_timezone || "Africa/Johannesburg",
        venue: row.venue || (row.status === "pending" ? "Hold" : "Booked"),
        status: row.status,
        clientName: "",
        clientEmail: "",
        message: "",
      })),
    ]);
  } catch (e) {
    console.error("artist calendar", e);
    res.status(500).json({ message: "Failed to load artist calendar" });
  }
});

// GET /api/bookings/:id
router.get("/:id", optionalAuth, async (req, res) => {
  const row = await db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ message: "Booking not found" });

  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!canAccessBooking(req.user, row) && !req.user.ephemeral) {
    return res.status(403).json({ message: "Not your booking" });
  }
  res.json(mapBooking(row));
});

// POST /api/bookings
router.post(
  "/",
  rateLimit({ windowMs: 60_000, max: 20, key: "bookings-create" }),
  optionalAuth,
  async (req, res) => {
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
      eventCountry,
      eventTimezone,
      travel,
    } = req.body;

    const country = /^[A-Z]{2}$/.test(String(eventCountry || "")) ? eventCountry : "ZA";
    const timezone =
      eventTimezone && isValidTimezone(eventTimezone) ? eventTimezone : "Africa/Johannesburg";
    const travelJson = country !== "ZA" && travel ? JSON.stringify(sanitizeTravel(travel)) : null;

    if (!artistId || !clientName || !clientEmail || !eventDate) {
      return res.status(400).json({
        message:
          "artistId, clientName, clientEmail and eventDate are required",
      });
    }

    if (!isValidEmail(clientEmail)) {
      return res.status(400).json({ message: "Valid clientEmail is required" });
    }

    const artist = await db
      .prepare("SELECT id, stage_name FROM artists WHERE id = ?")
      .get(artistId);

    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    if (await isDateBlocked(artistId, eventDate)) {
      return res.status(409).json({ message: "The artist isn't available on that date. Please pick another day." });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const promoterId = req.user?.id || null;

    await db.prepare(
      `INSERT INTO bookings (
        id, artist_id, artist_name, client_name, client_email,
        event_date, venue, message, status, created_at,
        address, city, time, fee, promoter_name, promoter_id, notes,
        reminder_opt_in, payment_status, event_country, event_timezone, travel_json
      ) VALUES (
        @id, @artist_id, @artist_name, @client_name, @client_email,
        @event_date, @venue, @message, 'pending', @created_at,
        @address, @city, @time, @fee, @promoter_name, @promoter_id, @notes,
        @reminder_opt_in, 'unpaid', @event_country, @event_timezone, @travel_json
      )`
    ).run({
      id,
      artist_id: artistId,
      artist_name: artist.stage_name,
      client_name: sanitizeString(clientName, 120),
      client_email: normalizeEmail(clientEmail),
      event_date: eventDate,
      venue: sanitizeString(venue || "", 200),
      message: sanitizeString(message || "", 2000),
      created_at: createdAt,
      address: address || "",
      city: city || "",
      time: time || "",
      fee: fee != null && fee !== "" ? Number(fee) : null,
      promoter_name: promoterName || clientName,
      promoter_id: promoterId,
      notes: notes || message || "",
      reminder_opt_in: reminderOptIn ? 1 : 0,
      event_country: country,
      event_timezone: timezone,
      travel_json: travelJson,
    });

    const row = await db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
    await notifyNewBookingRequest(row);
    res.status(201).json(mapBooking(row));
  }
);

// PATCH /api/bookings/:id — ownership enforced; clients cannot self-mark as paid
router.patch("/:id", requireAuth, async (req, res) => {
  const existing = await db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(req.params.id);

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

    // Only the artist may accept / decline
    if (status === "confirmed" || status === "declined") {
      if (!isArtistOwner(req.user, existing) && !req.user.ephemeral) {
        return res.status(403).json({
          message: "Only the booked artist can accept or decline",
        });
      }
    }

    // Accepting a booking requires a verified identity
    if (
      status === "confirmed" &&
      existing.status !== "confirmed" &&
      !req.user.ephemeral &&
      !(await isIdentityVerified(req.user.id))
    ) {
      return res.status(403).json({
        message: "Verify your identity before accepting bookings",
      });
    }

    // Clients must not set status=paid directly — payments go via PayFast ITN
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

    // Allow dispute from either party; deposit/paid only via ITN or trusted server
    if (paymentStatus === "disputed") {
      nextPayment = "disputed";
      dispute_reason =
        disputeReason || existing.dispute_reason || "Dispute opened";
      disputed_at = new Date().toISOString();
    } else if (paymentStatus === "unpaid") {
      // Allow clearing a mistaken client-side flag only when currently unpaid path
      if (existing.payment_status === "unpaid") {
        nextPayment = "unpaid";
      } else {
        return res.status(403).json({
          message: "Paid bookings can only be updated by the payment system",
        });
      }
    } else {
      // deposit / paid — require internal header or admin; for demo allow if ALLOW_DEMO
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

  if (typeof reminderOptIn === "boolean") {
    reminder = reminderOptIn ? 1 : 0;
  }

  if (disputeReason && !paymentStatus) {
    nextPayment = "disputed";
    dispute_reason = disputeReason;
    disputed_at = new Date().toISOString();
  }

  await db.prepare(
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

  const row = await db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(req.params.id);
  if (row && (nextStatus === "confirmed" || nextStatus === "paid")) {
    await ensureContract(row);
  }
  if (row && (nextPayment === "deposit" || nextPayment === "paid")) {
    const { receipt, created } = await ensureReceipt(
      row,
      nextPayment === "paid" ? "full" : "deposit"
    );
    if (created) await notifyPaymentReceived(row, receipt);
  }
  if (
    row &&
    nextStatus !== existing.status &&
    (nextStatus === "confirmed" || nextStatus === "declined")
  ) {
    await notifyBookingStatusChange(row, nextStatus);
  }
  res.json(mapBooking(row));
});

export default router;
