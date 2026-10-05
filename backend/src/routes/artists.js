import { Router } from "express";
import db from "../db.js";
import { optionalAuth } from "../middleware/auth.js";
import { BUCKETS, publicUrl } from "../lib/storage.js";

const router = Router();

/** Rounded range around the rate, e.g. R50,000 → R40k–R60k */
export function priceBand(rate) {
  const step = rate >= 20000 ? 5000 : 1000;
  const min = Math.max(step, Math.floor((rate * 0.85) / step) * step);
  const max = Math.ceil((rate * 1.15) / step) * step;
  return { min, max };
}

/**
 * What a viewer may see of the artist's rate:
 *  exact      → everyone sees the exact rate
 *  band       → public sees a range; signed-in promoters (and the artist) see the rate
 *  on_request → public sees "on request"; signed-in promoters (and the artist) see the rate
 */
function pricingFor(row, viewer) {
  const visibility = ["exact", "band", "on_request"].includes(row.price_visibility) ? row.price_visibility : "band";
  const isOwner = viewer?.role === "artist" && (viewer.artistId || viewer.id) === row.id;
  const isPromoter = viewer && !viewer.ephemeral && viewer.role !== "artist";
  const showExact = visibility === "exact" || isOwner || isPromoter;
  return {
    priceVisibility: visibility,
    rate: showExact ? row.rate : null,
    priceBand: visibility === "band" ? priceBand(row.rate) : null,
  };
}

function mapArtist(row, req) {
  return {
    id: row.id,
    stageName: row.stage_name,
    genre: row.genre,
    location: row.location,
    ...pricingFor(row, req.user),
    imageUrl: row.photo_key ? publicUrl(BUCKETS.photos, row.photo_key, req) : row.image_url,
    bio: row.bio,
    verificationStatus: VERIFICATION_BY_RANK[row.verification_rank] || "unverified",
    completedBookings: Number(row.completed_bookings || 0),
  };
}

/** Best status wins when several accounts (artist + manager) are linked to one artist */
const VERIFICATION_BY_RANK = [
  "fully_verified",
  "identity_verified",
  "pending_review",
  "rejected",
];

/** Public trust signals: best verification status of any linked account + completed gigs */
const ARTIST_SELECT = `SELECT a.*, vr.verification_rank, cb.completed_bookings,
  p.photo_key, p.price_visibility
FROM artists a
LEFT JOIN artist_profiles p ON p.artist_id = a.id
LEFT JOIN (
  SELECT artist_id, MIN(CASE status
    WHEN 'fully_verified' THEN 0
    WHEN 'identity_verified' THEN 1
    WHEN 'pending_review' THEN 2
    WHEN 'rejected' THEN 3
    ELSE 4 END) AS verification_rank
  FROM artist_verifications
  GROUP BY artist_id
) vr ON vr.artist_id = a.id
LEFT JOIN (
  SELECT artist_id, COUNT(*) AS completed_bookings
  FROM bookings
  WHERE status = 'paid' OR payment_status = 'paid'
  GROUP BY artist_id
) cb ON cb.artist_id = a.id`;

// GET /api/artists
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { genre, location, q } = req.query;

    let sql = `${ARTIST_SELECT} WHERE 1=1`;
    const params = {};

    if (genre) {
      sql += " AND LOWER(a.genre) = LOWER(@genre)";
      params.genre = String(genre);
    }

    if (location) {
      sql += " AND LOWER(a.location) LIKE LOWER(@location)";
      params.location = `%${String(location)}%`;
    }

    if (q) {
      sql += ` AND (
      LOWER(a.stage_name) LIKE LOWER(@q)
      OR LOWER(a.genre) LIKE LOWER(@q)
      OR LOWER(a.location) LIKE LOWER(@q)
    )`;
      params.q = `%${String(q)}%`;
    }

    sql += " ORDER BY a.stage_name ASC";

    const rows = Object.keys(params).length
      ? await db.prepare(sql).all(params)
      : await db.prepare(sql).all();
    res.json(rows.map((row) => mapArtist(row, req)));
  } catch (e) {
    console.error("artists list", e);
    res.status(500).json({ message: "Failed to load artists" });
  }
});

// GET /api/artists/:id
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const row = await db
      .prepare(`${ARTIST_SELECT} WHERE a.id = ?`)
      .get(req.params.id);

    if (!row) {
      return res.status(404).json({ message: "Artist not found" });
    }

    res.json(mapArtist(row, req));
  } catch (e) {
    console.error("artist detail", e);
    res.status(500).json({ message: "Failed to load artist" });
  }
});

export default router;
