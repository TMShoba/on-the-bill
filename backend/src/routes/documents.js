
import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureContract, mapContract, mapReceipt } from "../lib/documents.js";

const router = Router();

function canAccess(user, booking) {
  if (!user || !booking) return false;
  if (user.role === "artist") {
    const artistKey = user.artistId || user.id;
    return booking.artist_id === artistKey || booking.artist_id === user.id;
  }
  if (booking.promoter_id && booking.promoter_id === user.id) return true;
  if (user.email && booking.client_email) {
    return booking.client_email.toLowerCase() === user.email.toLowerCase();
  }
  return false;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let bookings;
    if (user.role === "artist") {
      const artistKey = user.artistId || user.id;
      bookings = await db
        .prepare("SELECT * FROM bookings WHERE artist_id = ? OR artist_id = ? ORDER BY event_date DESC")
        .all(artistKey, user.id);
    } else {
      bookings = await db
        .prepare(
          "SELECT * FROM bookings WHERE promoter_id = ? OR LOWER(client_email) = LOWER(?) ORDER BY event_date DESC"
        )
        .all(user.id, user.email || "");
    }
    const list = Array.isArray(bookings) ? bookings : [];
    const out = [];
    for (const b of list) {
      if ((b.status === "confirmed" || b.status === "paid") ) {
        await ensureContract(b);
      }
      if (b.payment_status === "deposit" || b.payment_status === "paid") {
        const { ensureReceipt } = await import("../lib/documents.js");
        await ensureReceipt(b, b.payment_status === "paid" ? "full" : "deposit");
      }
      const contract = await db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(b.id);
      const receipts = await db.prepare("SELECT * FROM receipts WHERE booking_id = ? ORDER BY created_at ASC").all(b.id);
      if (!contract && (!receipts || receipts.length === 0)) continue;
      out.push({
        bookingId: b.id,
        artistName: b.artist_name,
        promoterName: b.promoter_name || b.client_name,
        eventDate: b.event_date,
        venue: b.venue || "",
        status: b.status,
        contract: mapContract(contract),
        receipts: (Array.isArray(receipts) ? receipts : []).map(mapReceipt),
      });
    }
    res.json(out);
  } catch (e) {
    console.error("list documents", e);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

router.get("/:bookingId", requireAuth, async (req, res) => {
  try {
    const booking = await db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!canAccess(req.user, booking)) return res.status(403).json({ message: "Not your booking" });
    if (booking.status === "confirmed" || booking.status === "paid") await ensureContract(booking);
    const contract = await db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(booking.id);
    const receipts = await db.prepare("SELECT * FROM receipts WHERE booking_id = ? ORDER BY created_at ASC").all(booking.id);
    res.json({
      contract: mapContract(contract),
      receipts: (Array.isArray(receipts) ? receipts : []).map(mapReceipt),
    });
  } catch (e) {
    console.error("get documents", e);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

export default router;
