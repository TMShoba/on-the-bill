import db from "../db.js";
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

/**
 * Optional auth: attaches req.user from Bearer JWT (or legacy demo token if enabled).
 * Does not reject anonymous requests.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      req.user = null;
      return next();
    }

    const token = match[1].trim();

    const payload = verifyToken(token);
    if (payload) {
      const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
      if (row) {
        req.user = mapRowToUser(row);
        return next();
      }
      req.user = null;
      return next();
    }

    const legacy = parseLegacyDemoToken(token);
    if (legacy) {
      const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(legacy.sub);
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
  } catch (e) {
    console.error("optionalAuth error:", e.message);
    req.user = null;
    next();
  }
}

/** Require a resolved non-anonymous user */
export async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  });
}

/** Reject ephemeral demo users for sensitive mutations when demos are off */
export async function requireRealUser(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.ephemeral && process.env.ALLOW_DEMO_TOKENS !== "true") {
      return res.status(403).json({
        message: "Please sign in with a real account to continue.",
      });
    }
    next();
  });
}
