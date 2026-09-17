/**
 * Security helpers — validation, sanitization, headers.
 * No extra dependencies; safe defaults for a booking API.
 */

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Strip control chars and limit length */
export function sanitizeString(value, maxLen = 500) {
  if (value == null) return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  if (e.length > 254) return false;
  return EMAIL_RE.test(e);
}

export function normalizeEmail(email) {
  return sanitizeString(email, 254).toLowerCase();
}

/** Password policy for registration */
export function validatePassword(password) {
  const p = String(password || "");
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password is too long";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    return "Password must include at least one letter and one number";
  }
  return null;
}

/** Block obvious script injection in free-text fields */
export function looksLikeXss(value) {
  const s = String(value || "").toLowerCase();
  return (
    s.includes("<script") ||
    s.includes("javascript:") ||
    s.includes("onerror=") ||
    s.includes("onload=") ||
    s.includes("<iframe")
  );
}

export function rejectIfXss(value, fieldName = "field") {
  if (looksLikeXss(value)) {
    const err = new Error(`Invalid content in ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return value;
}

/**
 * Express middleware: security headers for an API.
 */
export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "0"); // modern browsers; rely on CSP elsewhere
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  // API responses should not be cached by shared caches when authenticated
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  next();
}

/**
 * Hide internal errors from clients in production.
 */
export function safeErrorHandler(err, _req, res, _next) {
  if (err?.message?.startsWith("CORS blocked")) {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error("[error]", err.message || err);
  }
  res.status(status).json({
    message:
      status < 500 && err.message
        ? err.message
        : "Something went wrong. Please try again.",
    ...(process.env.NODE_ENV === "development" && status >= 500
      ? { error: err.message }
      : {}),
  });
}

/** Never leak password hashes or internal columns */
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "client" ? "promoter" : row.role,
    artistId: row.artist_id || row.artistId || undefined,
    createdAt: row.created_at || row.createdAt,
  };
}

/** Constant-time-ish delay to slow brute force slightly */
export function asyncDelay(ms = 200) {
  return new Promise((r) => setTimeout(r, ms));
}
