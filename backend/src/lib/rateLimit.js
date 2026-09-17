/**
 * Tiny in-memory rate limiter (per IP + route key).
 * Fine for a single Railway instance; use Redis if you scale out.
 */
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 60, key = "global" } = {}) {
  return (req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const bucketKey = `${key}:${ip}`;
    const now = Date.now();
    let entry = buckets.get(bucketKey);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, entry);
    }
    entry.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, max - entry.count))
    );
    if (entry.count > max) {
      return res.status(429).json({
        message: "Too many requests. Please wait a moment and try again.",
      });
    }
    next();
  };
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
  }
}, 5 * 60_000).unref?.();
