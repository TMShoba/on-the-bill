import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { one, query } from "../db.js";
import {
  createToken,
  verifyToken,
  parseLegacyDemoToken,
} from "../lib/tokens.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeString,
  validatePassword,
  publicUser,
  asyncDelay,
} from "../lib/security.js";
import { audit } from "../lib/audit.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH || 10),
  key: "auth",
});

router.post("/register", authLimiter, async (req, res) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    const emailNorm = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const role = req.body?.role;

    if (!name || !emailNorm || !password) {
      return res
        .status(400)
        .json({ message: "name, email and password are required" });
    }
    if (!isValidEmail(emailNorm)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ message: pwErr });

    const exists = await one(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [emailNorm]
    );
    if (exists) {
      audit("register_conflict", { email: emailNorm });
      return res.status(409).json({ message: "Email already registered" });
    }

    const id = uuidv4();
    const userRole =
      role === "artist" ? "artist" : role === "promoter" ? "promoter" : "client";
    const artistId =
      userRole === "artist" &&
      req.body?.artistId &&
      process.env.ALLOW_DEMO_TOKENS === "true"
        ? sanitizeString(req.body.artistId, 64)
        : null;

    const passwordHash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (id, name, email, password, role, artist_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [id, name, emailNorm, passwordHash, userRole, artistId]
    );

    const row = await one("SELECT * FROM users WHERE id = $1", [id]);
    const user = publicUser(row);
    audit("register_ok", { userId: id, role: userRole });
    res.status(201).json({ user, token: createToken(user) });
  } catch (err) {
    console.error("[auth/register]", err.message);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const emailNorm = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!emailNorm || !password) {
      return res
        .status(400)
        .json({ message: "email and password are required" });
    }

    const row = await one(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [emailNorm]
    );

    const fail = async () => {
      await asyncDelay(250);
      audit("login_fail", { email: emailNorm });
      return res.status(401).json({ message: "Invalid email or password" });
    };

    if (!row) return fail();

    const isHashed = String(row.password).startsWith("$2");
    const valid = isHashed
      ? await bcrypt.compare(password, row.password)
      : password === row.password;
    if (!valid) return fail();

    if (!isHashed) {
      const upgraded = await bcrypt.hash(password, 12);
      await query("UPDATE users SET password = $1 WHERE id = $2", [
        upgraded,
        row.id,
      ]);
    }

    const user = publicUser(row);
    audit("login_ok", { userId: user.id });
    res.json({ user, token: createToken(user) });
  } catch (err) {
    console.error("[auth/login]", err.message);
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = match[1].trim();
  let userId = null;
  const payload = verifyToken(token);
  if (payload) userId = payload.sub;
  else {
    const legacy = parseLegacyDemoToken(token);
    if (legacy) userId = legacy.sub;
  }
  if (!userId) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  const row = await one("SELECT * FROM users WHERE id = $1", [userId]);
  if (!row) return res.status(401).json({ message: "User not found" });
  res.json({ user: publicUser(row) });
});

export default router;
