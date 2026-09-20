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
router.get("/", async (req, res) => {
  try {
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

    const rows = Object.keys(params).length
      ? await db.prepare(sql).all(params)
      : await db.prepare(sql).all();
    res.json(rows.map(mapArtist));
  } catch (e) {
    console.error("artists list", e);
    res.status(500).json({ message: "Failed to load artists" });
  }
});

// GET /api/artists/:id
router.get("/:id", async (req, res) => {
  try {
    const row = await db
      .prepare("SELECT * FROM artists WHERE id = ?")
      .get(req.params.id);

    if (!row) {
      return res.status(404).json({ message: "Artist not found" });
    }

    res.json(mapArtist(row));
  } catch (e) {
    console.error("artist detail", e);
    res.status(500).json({ message: "Failed to load artist" });
  }
});

export default router;
