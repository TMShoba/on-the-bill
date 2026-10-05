/**
 * Platform admins (verification reviewers) are configured by email:
 * ADMIN_EMAILS=ops@thelineup.co.za,reviewer@thelineup.co.za
 */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Seeded for demos with a public password — never an admin in production */
export const DEMO_ADMIN_EMAIL = "admin@thelineup.co.za";

export function isAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).toLowerCase();
  if (normalized === DEMO_ADMIN_EMAIL && process.env.NODE_ENV === "production") return false;
  return adminEmails().includes(normalized);
}

/** Express middleware — use after requireAuth */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.ephemeral || !isAdminEmail(req.user.email)) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
