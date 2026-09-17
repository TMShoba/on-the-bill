import "dotenv/config";
import express from "express";
import cors from "cors";
import { migrate, one } from "./db.js";
import { seedAll } from "./seed.js";
import artistsRouter from "./routes/artists.js";
import bookingsRouter from "./routes/bookings.js";
import authRouter from "./routes/auth.js";
import notificationsRouter from "./routes/notifications.js";
import messagesRouter from "./routes/messages.js";
import paymentsRouter from "./routes/payments.js";
import { isProductionSecretWeak } from "./lib/tokens.js";
import { rateLimit } from "./lib/rateLimit.js";
import { securityHeaders, safeErrorHandler } from "./lib/security.js";
import { audit } from "./lib/audit.js";

const app = express();
const PORT = process.env.PORT || 4000;

async function boot() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error(
      "\nDATABASE_URL is required.\n" +
        "Supabase: Project Settings → Database → Connection string (URI)\n" +
        "Example: postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-...pooler.supabase.com:6543/postgres\n"
    );
    process.exit(1);
  }

  await migrate();
  try {
    await seedAll();
  } catch (err) {
    console.error("Seed failed:", err.message);
  }

  if (isProductionSecretWeak()) {
    console.warn(
      "⚠️  JWT_SECRET is weak or default. Set a strong JWT_SECRET (32+ chars)."
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_TOKENS === "true"
  ) {
    console.warn("⚠️  ALLOW_DEMO_TOKENS=true in production is unsafe.");
  }

  if (
    process.env.TRUST_PROXY === "true" ||
    process.env.NODE_ENV === "production"
  ) {
    app.set("trust proxy", 1);
  }

  const defaultOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://on-the-bill.vercel.app",
  ];
  const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  app.use(securityHeaders);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        audit("cors_blocked", { origin });
        return cb(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Lineup-Internal"],
      maxAge: 600,
    })
  );

  app.use(
    "/api/payments/payfast/itn",
    express.urlencoded({ extended: false, limit: "32kb" })
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(
    "/api/",
    rateLimit({
      windowMs: 60_000,
      max: Number(process.env.RATE_LIMIT_API || 100),
      key: "api",
    })
  );
  app.disable("x-powered-by");

  app.get("/", (_req, res) => {
    res.json({
      name: "The LineUp API",
      version: "1.8.0",
      database: "PostgreSQL (Supabase)",
    });
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const row = await one("SELECT COUNT(*)::int AS c FROM artists");
      res.json({
        status: "ok",
        database: "postgres",
        artists: row?.c ?? 0,
        time: new Date().toISOString(),
      });
    } catch (err) {
      res.status(503).json({
        status: "error",
        database: "postgres",
        message: err.message,
        time: new Date().toISOString(),
      });
    }
  });

  app.use("/api/artists", artistsRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/payments", paymentsRouter);

  app.use((_req, res) => res.status(404).json({ message: "Not found" }));
  app.use(safeErrorHandler);

  app.listen(PORT, () => {
    console.log(`The LineUp API v1.8.0 (Supabase Postgres) on port ${PORT}`);
    console.log(`CORS origins: ${allowedOrigins.join(", ")}`);
  });
}

boot().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
