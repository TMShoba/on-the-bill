import { Router } from "express";
import { many, one } from "../db.js";

const router = Router();

function mapArtist(row) {
  return {
    id: row.id,
    stageName: row.stage_name,
    genre: row.genre,
    location: row.location,
    rate: row.rate,
    imageUrl: row.image_url,
    bio: row.bio,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { genre, location, q } = req.query;
    const clauses = [];
    const params = [];
    let i = 1;
    if (genre) {
      clauses.push(`LOWER(genre) = LOWER($${i++})`);
      params.push(String(genre));
    }
    if (location) {
      clauses.push(`LOWER(location) LIKE LOWER($${i++})`);
      params.push(`%${String(location)}%`);
    }
    if (q) {
      clauses.push(
        `(LOWER(stage_name) LIKE LOWER($${i}) OR LOWER(genre) LIKE LOWER($${i}) OR LOWER(location) LIKE LOWER($${i}))`
      );
      params.push(`%${String(q)}%`);
      i++;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await many(
      `SELECT * FROM artists ${where} ORDER BY stage_name ASC`,
      params
    );
    res.json(rows.map(mapArtist));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const row = await one("SELECT * FROM artists WHERE id = $1", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Artist not found" });
    res.json(mapArtist(row));
  } catch (err) {
    next(err);
  }
});

export default router;
