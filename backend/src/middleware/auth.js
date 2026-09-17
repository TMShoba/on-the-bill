import { one } from "../db.js";
import { verifyToken, parseLegacyDemoToken } from "../lib/tokens.js";

function mapRowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "client" ? "promoter" : row.role,
    artistId: row.artist_id || null,
    createdAt: row.created_at,
  };
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    req.user = null;
    return next();
  }
  const token = match[1].trim();

  (async () => {
    const payload = verifyToken(token);
    if (payload) {
      const row = await one("SELECT * FROM users WHERE id = $1", [payload.sub]);
      req.user = row ? mapRowToUser(row) : null;
      return next();
    }
    const legacy = parseLegacyDemoToken(token);
    if (legacy) {
      const row = await one("SELECT * FROM users WHERE id = $1", [legacy.sub]);
      if (row) {
        req.user = mapRowToUser(row);
        return next();
      }
      req.user = {
        id: legacy.sub,
        name: "",
        email: "",
        role: legacy.role || "promoter",
        artistId: legacy.artistId || null,
        createdAt: new Date().toISOString(),
        ephemeral: true,
      };
      return next();
    }
    req.user = null;
    next();
  })().catch(next);
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  });
}
