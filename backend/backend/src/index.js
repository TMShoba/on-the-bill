import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./db.js";
import artistsRouter from "./routes/artists.js";
import bookingsRouter from "./routes/bookings.js";
import authRouter from "./routes/auth.js";
import notificationsRouter from "./routes/notifications.js";
import messagesRouter from "./routes/messages.js";

// Auto-seed database on startup
try {
  await import("./seed.js");
  console.log("Database seeded successfully.");
} catch (error) {
  console.error("Seed failed:", error);
}

const app = express();
const PORT = process.env.PORT || 4000;

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://on-the-bill.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "The LineUp API",
    version: "1.3.0",
    database: "SQLite",
    endpoints: {
      artists: "GET /api/artists",
      artist: "GET /api/artists/:id",
      bookings: "GET|POST /api/bookings",
      messages: "GET|POST /api/messages/*",
      email: "POST /api/notifications/email",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
    },
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: "sqlite",
    time: new Date().toISOString(),
  });
});

// Routes
app.use("/api/artists", artistsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/messages", messagesRouter);

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development"
      ? err.message
      : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(
    `The LineUp API (SQLite) running on port ${PORT}`
  );
});