import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/favorites — saved artists for the signed-in user, newest first
router.get("/", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .prepare(
        `SELECT a.*, f.created_at AS saved_at
         FROM favorites f JOIN artists a ON a.id = f.artist_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`
      )
      .all(req.user.id);
    res.json(
      rows.map((row) => ({
        id: row.id,
        stageName: row.stage_name,
        genre: row.genre,
        location: row.location,
        rate: row.rate,
        imageUrl: row.image_url,
        savedAt: row.saved_at,
      }))
    );
  } catch (e) {
    console.error("list favorites", e);
    res.status(500).json({ message: "Failed to load saved artists" });
  }
});

// PUT /api/favorites/:artistId
router.put("/:artistId", requireAuth, async (req, res) => {
  try {
    const artist = await db.prepare("SELECT id FROM artists WHERE id = ?").get(req.params.artistId);
    if (!artist) return res.status(404).json({ message: "Artist not found" });
    await db
      .prepare(
        `INSERT INTO favorites (user_id, artist_id, created_at) VALUES (?, ?, NOW())
         ON CONFLICT (user_id, artist_id) DO NOTHING`
      )
      .run(req.user.id, artist.id);
    res.json({ artistId: artist.id, saved: true });
  } catch (e) {
    console.error("add favorite", e);
    res.status(500).json({ message: "Failed to save artist" });
  }
});

// DELETE /api/favorites/:artistId
router.delete("/:artistId", requireAuth, async (req, res) => {
  try {
    await db
      .prepare("DELETE FROM favorites WHERE user_id = ? AND artist_id = ?")
      .run(req.user.id, req.params.artistId);
    res.json({ artistId: req.params.artistId, saved: false });
  } catch (e) {
    console.error("remove favorite", e);
    res.status(500).json({ message: "Failed to remove saved artist" });
  }
});

export default router;
