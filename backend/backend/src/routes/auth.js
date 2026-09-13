import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import db from "../db.js";

const router = Router();

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "client" ? "promoter" : row.role,
    artistId: row.artist_id || undefined,
    createdAt: row.created_at,
  };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "name, email and password are required" });
  }

  const exists = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")
    .get(email);

  if (exists) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const userRole = role === "artist" ? "artist" : role === "promoter" ? "promoter" : "client";
  const passwordHash = await bcrypt.hash(password, 10);

  const artistId = req.body.artistId || null;
  db.prepare(
    `INSERT INTO users (id, name, email, password, role, artist_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, email.toLowerCase(), passwordHash, userRole, artistId, createdAt);

  const user = mapUser(
    db.prepare("SELECT * FROM users WHERE id = ?").get(id)
  );

  res.status(201).json({
    user,
    token: `demo-token-${user.id}`,
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "email and password are required" });
  }

  const row = db
    .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
    .get(email);

  if (!row) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  // bcrypt hashes always start with "$2" — anything else is a plain-text
  // password left over from before hashing was added. Accept it once, then
  // transparently upgrade it to a real hash so it never has to be checked
  // in plain text again.
  const isHashed = row.password.startsWith("$2");
  const valid = isHashed
    ? await bcrypt.compare(password, row.password)
    : password === row.password;

  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (!isHashed) {
    const upgraded = await bcrypt.hash(password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
      upgraded,
      row.id
    );
  }

  res.json({
    user: mapUser(row),
    token: `demo-token-${row.id}`,
  });
});

export default router;
