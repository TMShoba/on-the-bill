import db from "../db.js";

/**
 * Optional auth: attaches req.user when Authorization: Bearer demo-token-{userId}
 * (matches current frontend tokens). Does not reject anonymous requests.
 */
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    req.user = null;
    return next();
  }
  const token = match[1].trim();
  let userId = null;
  if (token.startsWith("demo-token-")) {
    userId = token.slice("demo-token-".length);
  } else {
    // Future JWT: treat whole token as opaque user id for demo
    userId = token;
  }
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (row) {
    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role === "client" ? "promoter" : row.role,
      artistId: row.artist_id || null,
      createdAt: row.created_at,
    };
  } else {
    // Allow demo tokens for offline-seeded ids not in DB (artist-demo-1 etc.)
    req.user = {
      id: userId,
      name: "",
      email: "",
      role: userId.includes("artist") ? "artist" : "promoter",
      artistId: userId.includes("artist") ? userId : null,
      createdAt: new Date().toISOString(),
      ephemeral: true,
    };
  }
  next();
}

/** Require a resolved user */
export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  });
}
