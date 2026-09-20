import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./db.js";
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

import { migrate } from "./db.js";

async function bootDatabase() {
  await migrate();
  console.log("Postgres schema ready.");
  try {
    const seedMod = await import("./seed.js");
    await seedMod.default;
    console.log("Database seed ready.");
  } catch (e) {
    console.error("Seed warning (API will still start):", e.message);
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

if (isProductionSecretWeak()) {
  console.warn(
    "⚠️  JWT_SECRET is weak or default. Set a strong JWT_SECRET (32+ chars) before production."
  );
}
if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_DEMO_TOKENS === "true"
) {
  console.warn(
    "⚠️  ALLOW_DEMO_TOKENS=true in production is unsafe. Set it to false."
  );
}

// Railway / reverse proxies — required for correct client IPs
app.set("trust proxy", 1);

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://on-the-bill.vercel.app",
  "https://on-the-bill-git-main.vercel.app",
];
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (allowedOrigins.includes(normalized)) return true;
  // Preview deployments: https://on-the-bill-*.vercel.app
  if (/^https:\/\/on-the-bill[a-z0-9-]*\.vercel\.app$/i.test(normalized)) {
    return true;
  }
  return false;
}

app.use(securityHeaders);

// CORS must run first and must NOT throw — throwing drops ACAO headers on preflight
app.use(
  cors({
    origin(origin, cb) {
      if (isOriginAllowed(origin)) {
        return cb(null, true);
      }
      audit("cors_blocked", { origin });
      // false = omit ACAO (browser blocks) without 500
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Lineup-Internal",
      "X-Requested-With",
    ],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
);

// Explicit preflight for all API routes (belt + suspenders)
app.options("/api/*", cors());

app.use(
  "/api/payments/payfast/itn",
  express.urlencoded({ extended: false, limit: "32kb" })
);
app.use(express.json({ limit: "256kb" }));

// Rate limit — skip OPTIONS so preflight is never 429'd
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_API || 120),
  key: "api",
});
app.use("/api/", (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  return apiLimiter(req, res, next);
});

app.disable("x-powered-by");

app.get("/", (_req, res) => {
  res.json({
    name: "The LineUp API",
    version: "1.12.0",
    database: "Postgres",
    cors: allowedOrigins,
  });
});

app.get("/api/health", async (_req, res) => {
  let artistCount = 0;
  try {
    const row = await db.prepare("SELECT COUNT(*) AS c FROM artists").get();
    artistCount = Number(row?.c || 0);
  } catch (e) {
    console.error("health:", e.message);
  }
  res.json({
    status: "ok",
    database: "postgres",
    artists: artistCount,
    time: new Date().toISOString(),
  });
});

app.use("/api/artists", artistsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/payments", paymentsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(safeErrorHandler);

await bootDatabase().catch((e) => {
  console.error("Database boot failed:", e.message);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`The LineUp API v1.12.0 on port ${PORT}`);
  console.log(`CORS origins: ${allowedOrigins.join(", ")}`);
});
