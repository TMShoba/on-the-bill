import { Router } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sanitizeString } from "../lib/security.js";
import { rateLimit } from "../lib/rateLimit.js";

const router = Router();

function artistKey(user) {
  return user.artistId || user.id;
}

function requireArtist(req, res, next) {
  if (req.user.role !== "artist") return res.status(403).json({ message: "Artist accounts only" });
  next();
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

function todaySast() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
}

/** True when the artist has blocked this date (used by booking creation) */
export async function isDateBlocked(artistId, date) {
  const row = await db
    .prepare("SELECT id FROM artist_blocked_dates WHERE artist_id = ? AND date = ?")
    .get(String(artistId), String(date).slice(0, 10));
  return Boolean(row);
}

/** Blocked dates for an artist (public calendar shows them without the note) */
export async function blockedDates(artistId) {
  return db
    .prepare("SELECT date, note FROM artist_blocked_dates WHERE artist_id = ? ORDER BY date ASC")
    .all(String(artistId));
}

// GET /api/calendar/blocks — the signed-in artist's blocked dates
router.get("/blocks", requireAuth, requireArtist, async (req, res) => {
  try {
    res.json(await blockedDates(artistKey(req.user)));
  } catch (e) {
    console.error("list blocks", e);
    res.status(500).json({ message: "Failed to load blocked dates" });
  }
});

// POST /api/calendar/blocks { date, note? }
router.post("/blocks", requireAuth, requireArtist, async (req, res) => {
  try {
    const date = String(req.body?.date || "");
    if (!isDate(date)) return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    if (date < todaySast()) return res.status(400).json({ message: "You can't block a date in the past" });
    const key = artistKey(req.user);
    const booked = await db
      .prepare(
        `SELECT id FROM bookings WHERE artist_id = ? AND SUBSTRING(event_date, 1, 10) = ?
           AND status IN ('confirmed', 'paid') LIMIT 1`
      )
      .get(key, date);
    if (booked) return res.status(409).json({ message: "You already have a confirmed gig on that date" });
    await db
      .prepare(
        `INSERT INTO artist_blocked_dates (id, artist_id, date, note, created_at)
         VALUES (?, ?, ?, ?, NOW())
         ON CONFLICT (artist_id, date) DO UPDATE SET note = EXCLUDED.note`
      )
      .run(uuidv4(), key, date, sanitizeString(req.body?.note || "", 120));
    res.status(201).json(await blockedDates(key));
  } catch (e) {
    console.error("add block", e);
    res.status(500).json({ message: "Failed to block date" });
  }
});

// DELETE /api/calendar/blocks/:date
router.delete("/blocks/:date", requireAuth, requireArtist, async (req, res) => {
  try {
    const key = artistKey(req.user);
    await db.prepare("DELETE FROM artist_blocked_dates WHERE artist_id = ? AND date = ?").run(key, req.params.date);
    res.json(await blockedDates(key));
  } catch (e) {
    console.error("remove block", e);
    res.status(500).json({ message: "Failed to unblock date" });
  }
});

/* ------------------------------ iCal feed ------------------------------ */

function feedUrls(req, token) {
  const base = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const https = `${base}/api/calendar/feed/${token}.ics`;
  return { url: https, webcalUrl: https.replace(/^https?:/, "webcal:") };
}

async function ensureFeedToken(key, rotate = false) {
  await db
    .prepare(`INSERT INTO artist_profiles (artist_id, updated_at) VALUES (?, NOW()) ON CONFLICT (artist_id) DO NOTHING`)
    .run(key);
  const row = await db.prepare("SELECT calendar_token FROM artist_profiles WHERE artist_id = ?").get(key);
  if (row?.calendar_token && !rotate) return row.calendar_token;
  const token = crypto.randomBytes(24).toString("hex");
  await db.prepare("UPDATE artist_profiles SET calendar_token = ? WHERE artist_id = ?").run(token, key);
  return token;
}

// GET /api/calendar/feed-url — the artist's private subscription link
router.get("/feed-url", requireAuth, requireArtist, async (req, res) => {
  try {
    res.json(feedUrls(req, await ensureFeedToken(artistKey(req.user))));
  } catch (e) {
    console.error("feed url", e);
    res.status(500).json({ message: "Failed to create calendar link" });
  }
});

// POST /api/calendar/feed-url/rotate — invalidate the old link (e.g. if it was shared)
router.post("/feed-url/rotate", requireAuth, requireArtist, async (req, res) => {
  try {
    res.json(feedUrls(req, await ensureFeedToken(artistKey(req.user), true)));
  } catch (e) {
    console.error("rotate feed", e);
    res.status(500).json({ message: "Failed to reset calendar link" });
  }
});

/** Minutes the zone is ahead of UTC at an instant */
function zoneOffsetMinutes(timeZone, utcMs) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value])
  );
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMs) / 60000);
}

/** Venue wall-clock time → UTC ms */
function zonedToUtc(date, time, timeZone) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm || 0);
  let utc = wall - zoneOffsetMinutes(timeZone, wall) * 60000;
  utc = wall - zoneOffsetMinutes(timeZone, utc) * 60000;
  return utc;
}

const icsStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDate = (date) => date.replace(/-/g, "");
const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

function icsText(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines to 75 octets as RFC 5545 requires */
function fold(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

const SET_HOURS = Number(process.env.CALENDAR_DEFAULT_SET_HOURS || 3);

export function buildIcs({ artistName, bookings, blocks }) {
  const now = icsStamp(Date.now());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The LineUp//Artist Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(`${artistName} · The LineUp`)}`,
    "X-WR-TIMEZONE:Africa/Johannesburg",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const b of bookings) {
    const date = String(b.event_date).slice(0, 10);
    const tentative = b.status === "pending";
    const where = [b.venue, b.city].filter(Boolean).join(", ");
    lines.push("BEGIN:VEVENT", `UID:booking-${b.id}@thelineup.co.za`, `DTSTAMP:${now}`);
    if (b.time && /^\d{1,2}:\d{2}/.test(b.time)) {
      const start = zonedToUtc(date, b.time, b.event_timezone || "Africa/Johannesburg");
      lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(start + SET_HOURS * 3600000)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(date)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(date))}`);
    }
    lines.push(
      `SUMMARY:${icsText(`${tentative ? "Hold: " : ""}${b.venue || "Gig"}${b.promoter_name ? ` — ${b.promoter_name}` : ""}`)}`,
      `LOCATION:${icsText(where)}`,
      `DESCRIPTION:${icsText(
        `${tentative ? "Pending request" : b.status === "paid" ? "Confirmed · paid" : "Confirmed"} on The LineUp.` +
          (b.event_timezone && b.event_timezone !== "Africa/Johannesburg" ? `\nVenue time zone: ${b.event_timezone}` : "")
      )}`,
      `STATUS:${tentative ? "TENTATIVE" : "CONFIRMED"}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  for (const block of blocks) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:block-${block.date}@thelineup.co.za`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${icsDate(block.date)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDay(block.date))}`,
      `SUMMARY:${icsText(block.note ? `Unavailable — ${block.note}` : "Unavailable")}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

// GET /api/calendar/feed/:token.ics — public by secret token (calendar apps can't log in)
router.get(
  "/feed/:file",
  rateLimit({ windowMs: 60_000, max: 30, key: "ics" }),
  async (req, res) => {
    try {
      const token = String(req.params.file || "").replace(/\.ics$/, "");
      if (!/^[a-f0-9]{48}$/.test(token)) return res.status(404).send("Not found");
      const profile = await db.prepare("SELECT artist_id FROM artist_profiles WHERE calendar_token = ?").get(token);
      if (!profile) return res.status(404).send("Not found");
      const artist = await db.prepare("SELECT stage_name FROM artists WHERE id = ?").get(profile.artist_id);
      const user = artist ? null : await db.prepare("SELECT name FROM users WHERE id = ?").get(profile.artist_id);
      const bookings = await db
        .prepare(
          `SELECT id, event_date, time, venue, city, status, promoter_name, event_timezone
           FROM bookings WHERE artist_id = ? AND status IN ('pending', 'confirmed', 'paid')
           ORDER BY event_date ASC`
        )
        .all(profile.artist_id);
      const ics = buildIcs({
        artistName: artist?.stage_name || user?.name || "Artist",
        bookings,
        blocks: await blockedDates(profile.artist_id),
      });
      res.set("Content-Type", "text/calendar; charset=utf-8");
      res.set("Content-Disposition", 'inline; filename="lineup-calendar.ics"');
      res.set("Cache-Control", "private, max-age=900");
      res.send(ics);
    } catch (e) {
      console.error("ics feed", e);
      res.status(500).send("Calendar unavailable");
    }
  }
);

export default router;
