import { Router } from "express";

const router = Router();

/**
 * Display-only currency conversion for international promoters.
 * All charges stay in ZAR — these rates only power "≈ $1,200" estimates.
 *
 * Source: open.er-api.com (free, no key; attribution required in the UI).
 */
const SOURCE_URL = "https://open.er-api.com/v6/latest/ZAR";
const CACHE_MS = 12 * 60 * 60 * 1000;

export const SUPPORTED_CURRENCIES = [
  "ZAR", "USD", "EUR", "GBP", "AUD", "CAD", "AED",
  "NGN", "KES", "GHS", "BWP", "NAD", "ZMW", "MZN", "TZS", "UGX", "RWF", "MAD", "EGP",
  "CHF", "SEK", "BRL",
];

/** Approximate units per 1 ZAR (Oct 2026) — used only when the live source is unreachable */
const FALLBACK_RATES = {
  ZAR: 1, USD: 0.06, EUR: 0.053, GBP: 0.045, AUD: 0.086, CAD: 0.086, AED: 0.22,
  NGN: 82, KES: 7.8, GHS: 0.71, BWP: 0.85, NAD: 1, ZMW: 1.2, MZN: 3.9, TZS: 162,
  UGX: 240, RWF: 90, MAD: 0.59, EGP: 3.1, CHF: 0.05, SEK: 0.6, BRL: 0.31,
};

let cache = null;

async function loadRates() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.payload;
  try {
    const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.result !== "success" || !data.rates) throw new Error("Bad payload");
    const rates = {};
    for (const code of SUPPORTED_CURRENCIES) {
      const rate = Number(data.rates[code]);
      if (Number.isFinite(rate) && rate > 0) rates[code] = rate;
    }
    const payload = {
      base: "ZAR",
      rates,
      updatedAt: data.time_last_update_utc || new Date().toUTCString(),
      source: "live",
    };
    cache = { fetchedAt: Date.now(), payload };
    return payload;
  } catch (e) {
    console.warn("fx: live rates unavailable, using fallback —", e.message);
    // Serve the last good rates if we have them; otherwise the fallback table
    if (cache) return cache.payload;
    return { base: "ZAR", rates: FALLBACK_RATES, updatedAt: null, source: "fallback" };
  }
}

// GET /api/fx — { base: "ZAR", rates: { USD: 0.055, ... }, updatedAt, source }
router.get("/", async (_req, res) => {
  const payload = await loadRates();
  res.set("Cache-Control", "public, max-age=3600");
  res.json(payload);
});

export default router;
