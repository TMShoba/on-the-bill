import { Router } from "express";
import { BUCKETS, getObject, storageDriver } from "../lib/storage.js";

const router = Router();

/**
 * GET /api/files/:bucket/:key — serves PUBLIC bucket objects when using the
 * database storage driver. With Supabase, public URLs point at Supabase directly.
 * Private buckets are never served here.
 */
router.get("/:bucket/:key", async (req, res) => {
  try {
    const bucket = Object.values(BUCKETS).find((b) => b.name === req.params.bucket);
    if (!bucket || !bucket.public || storageDriver !== "database") return res.status(404).send("Not found");
    const file = await getObject(bucket, req.params.key);
    if (!file) return res.status(404).send("Not found");
    res.set("Content-Type", file.contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(file.buffer);
  } catch (e) {
    console.error("serve file", e);
    res.status(500).send("Error");
  }
});

export default router;
