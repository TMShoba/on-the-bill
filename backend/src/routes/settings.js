import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

async function load(userId) {
  const row = await db.prepare("SELECT email_notifications FROM users WHERE id = ?").get(userId);
  return { emailNotifications: row ? row.email_notifications !== 0 : true };
}

// GET /api/settings
router.get("/", requireAuth, async (req, res) => {
  try {
    res.json(await load(req.user.id));
  } catch (e) {
    console.error("get settings", e);
    res.status(500).json({ message: "Failed to load settings" });
  }
});

// PATCH /api/settings { emailNotifications }
router.patch("/", requireAuth, async (req, res) => {
  try {
    if (typeof req.body?.emailNotifications === "boolean") {
      await db
        .prepare("UPDATE users SET email_notifications = ? WHERE id = ?")
        .run(req.body.emailNotifications ? 1 : 0, req.user.id);
    }
    res.json(await load(req.user.id));
  } catch (e) {
    console.error("update settings", e);
    res.status(500).json({ message: "Failed to save settings" });
  }
});

export default router;
