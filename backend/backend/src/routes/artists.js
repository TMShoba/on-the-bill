import { Router } from "express";
import db from "../db.js";

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

// GET /api/artists
router.get("/", (req, res) => {
  const { genre, location, q } = req.query;

  let sql = "SELECT * FROM artists WHERE 1=1";
  const params = {};

  if (genre) {
    sql += " AND LOWER(genre) = LOWER(@genre)";
    params.genre = String(genre);
  }

  if (location) {
    sql += " AND LOWER(location) LIKE LOWER(@location)";
    params.location = `%${String(location)}%`;
  }

  if (q) {
    sql += ` AND (
      LOWER(stage_name) LIKE LOWER(@q)
      OR LOWER(genre) LIKE LOWER(@q)
      OR LOWER(location) LIKE LOWER(@q)
    )`;
    params.q = `%${String(q)}%`;
  }

  sql += " ORDER BY stage_name ASC";

  const rows = db.prepare(sql).all(params);
  res.json(rows.map(mapArtist));
});

// GET /api/artists/:id
router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM artists WHERE id = ?")
    .get(req.params.id);

  if (!row) {
    return res.status(404).json({ message: "Artist not found" });
  }

  res.json(mapArtist(row));
});

export default router;
