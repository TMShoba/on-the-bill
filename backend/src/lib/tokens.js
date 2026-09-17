import crypto from "crypto";

const SECRET =
  process.env.JWT_SECRET ||
  process.env.AUTH_SECRET ||
  "the-lineup-dev-secret-change-me-in-production";

const TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7); // 7 days

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function sign(data) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Create a signed token: header.payload.signature
 * Payload includes sub (user id), role, exp.
 */
export function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({
    sub: user.id,
    role: user.role === "client" ? "promoter" : user.role,
    name: user.name,
    email: user.email,
    artistId: user.artistId || user.artist_id || null,
    iat: now,
    exp: now + TTL_SECONDS,
  });
  const sig = sign(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

/**
 * Verify and decode token. Returns payload or null.
 */
export function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = sign(`${header}.${payload}`);
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    if (!json.exp || json.exp < Math.floor(Date.now() / 1000)) return null;
    if (!json.sub) return null;
    return json;
  } catch {
    return null;
  }
}

/** Dev-only: accept legacy demo-token-* when ALLOW_DEMO_TOKENS=true */
export function parseLegacyDemoToken(token) {
  if (process.env.ALLOW_DEMO_TOKENS !== "true") return null;
  if (!token?.startsWith("demo-token-")) return null;
  const userId = token.slice("demo-token-".length);
  if (!userId) return null;
  return {
    sub: userId,
    role: userId.includes("artist") ? "artist" : "promoter",
    artistId: userId.includes("artist") ? userId : null,
    ephemeral: true,
  };
}

export function isProductionSecretWeak() {
  return (
    process.env.NODE_ENV === "production" &&
    (SECRET === "the-lineup-dev-secret-change-me-in-production" ||
      SECRET.length < 24)
  );
}
