/**
 * International booking helpers: markets, currencies and time-zone conversion.
 * Artists on The LineUp are South Africa-based, so "artist time" is always SAST.
 */

import type { TravelRequirements } from "../Types/Artist";

export const ARTIST_TIMEZONE = "Africa/Johannesburg";

/** Sensible starting point for an international booking request */
export const DEFAULT_TRAVEL: TravelRequirements = {
  flights: true,
  accommodation: true,
  groundTransport: true,
  visaSupport: false,
  crewSize: 2,
  notes: "",
};

export type Country = {
  code: string;
  name: string;
  currency: string;
  /** First entry is the default; multi-zone countries list the main ones */
  timezones: string[];
};

export const COUNTRIES: Country[] = [
  { code: "ZA", name: "South Africa", currency: "ZAR", timezones: ["Africa/Johannesburg"] },
  { code: "BW", name: "Botswana", currency: "BWP", timezones: ["Africa/Gaborone"] },
  { code: "NA", name: "Namibia", currency: "NAD", timezones: ["Africa/Windhoek"] },
  { code: "ZW", name: "Zimbabwe", currency: "USD", timezones: ["Africa/Harare"] },
  { code: "ZM", name: "Zambia", currency: "ZMW", timezones: ["Africa/Lusaka"] },
  { code: "MZ", name: "Mozambique", currency: "MZN", timezones: ["Africa/Maputo"] },
  { code: "LS", name: "Lesotho", currency: "ZAR", timezones: ["Africa/Maseru"] },
  { code: "SZ", name: "Eswatini", currency: "ZAR", timezones: ["Africa/Mbabane"] },
  { code: "NG", name: "Nigeria", currency: "NGN", timezones: ["Africa/Lagos"] },
  { code: "GH", name: "Ghana", currency: "GHS", timezones: ["Africa/Accra"] },
  { code: "KE", name: "Kenya", currency: "KES", timezones: ["Africa/Nairobi"] },
  { code: "TZ", name: "Tanzania", currency: "TZS", timezones: ["Africa/Dar_es_Salaam"] },
  { code: "UG", name: "Uganda", currency: "UGX", timezones: ["Africa/Kampala"] },
  { code: "RW", name: "Rwanda", currency: "RWF", timezones: ["Africa/Kigali"] },
  { code: "MA", name: "Morocco", currency: "MAD", timezones: ["Africa/Casablanca"] },
  { code: "EG", name: "Egypt", currency: "EGP", timezones: ["Africa/Cairo"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezones: ["Europe/London"] },
  { code: "IE", name: "Ireland", currency: "EUR", timezones: ["Europe/Dublin"] },
  { code: "NL", name: "Netherlands", currency: "EUR", timezones: ["Europe/Amsterdam"] },
  { code: "DE", name: "Germany", currency: "EUR", timezones: ["Europe/Berlin"] },
  { code: "FR", name: "France", currency: "EUR", timezones: ["Europe/Paris"] },
  { code: "BE", name: "Belgium", currency: "EUR", timezones: ["Europe/Brussels"] },
  { code: "ES", name: "Spain", currency: "EUR", timezones: ["Europe/Madrid", "Atlantic/Canary"] },
  { code: "PT", name: "Portugal", currency: "EUR", timezones: ["Europe/Lisbon"] },
  { code: "IT", name: "Italy", currency: "EUR", timezones: ["Europe/Rome"] },
  { code: "CH", name: "Switzerland", currency: "CHF", timezones: ["Europe/Zurich"] },
  { code: "SE", name: "Sweden", currency: "SEK", timezones: ["Europe/Stockholm"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezones: ["Asia/Dubai"] },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    timezones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
    ],
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    timezones: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Halifax"],
  },
  {
    code: "BR",
    name: "Brazil",
    currency: "BRL",
    timezones: ["America/Sao_Paulo", "America/Manaus"],
  },
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    timezones: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth"],
  },
];

export const CURRENCIES: { code: string; label: string }[] = [
  { code: "ZAR", label: "South African rand" },
  { code: "USD", label: "US dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British pound" },
  { code: "AUD", label: "Australian dollar" },
  { code: "CAD", label: "Canadian dollar" },
  { code: "AED", label: "UAE dirham" },
  { code: "CHF", label: "Swiss franc" },
  { code: "SEK", label: "Swedish krona" },
  { code: "BRL", label: "Brazilian real" },
  { code: "NGN", label: "Nigerian naira" },
  { code: "KES", label: "Kenyan shilling" },
  { code: "GHS", label: "Ghanaian cedi" },
  { code: "BWP", label: "Botswana pula" },
  { code: "NAD", label: "Namibian dollar" },
  { code: "ZMW", label: "Zambian kwacha" },
  { code: "MZN", label: "Mozambican metical" },
  { code: "TZS", label: "Tanzanian shilling" },
  { code: "UGX", label: "Ugandan shilling" },
  { code: "RWF", label: "Rwandan franc" },
  { code: "MAD", label: "Moroccan dirham" },
  { code: "EGP", label: "Egyptian pound" },
];

export function findCountry(code: string | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** Readable zone label, e.g. "America/New_York" → "New York" */
export function zoneLabel(tz: string): string {
  return tz.split("/").pop()!.replace(/_/g, " ");
}

/** Guess the viewer's country from the browser locale (e.g. "en-GB" → GB) */
export function detectCountry(): Country | undefined {
  try {
    const locale = navigator.languages?.[0] || navigator.language || "";
    const region = new Intl.Locale(locale).maximize().region;
    return findCountry(region);
  } catch {
    return undefined;
  }
}

export function formatMoney(amount: number, currency: string): string {
  const big = Math.abs(amount) >= 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: big ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

/** Minutes the zone is ahead of UTC at a given instant */
function zoneOffsetMinutes(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Wall-clock date + time in a zone → UTC epoch ms (handles DST edges) */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh)) return null;
  const guess = Date.UTC(y, m - 1, d, hh, mm || 0);
  const first = zoneOffsetMinutes(timeZone, guess);
  let utc = guess - first * 60000;
  const second = zoneOffsetMinutes(timeZone, utc);
  if (second !== first) utc = guess - second * 60000;
  return utc;
}

export function formatInZone(utcMs: number, timeZone: string) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcMs));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utcMs));
  return { date, time };
}

/**
 * Convert an event's local start time to the artist's time (SAST).
 * dayShift is -1 / 0 / +1 when the artist's calendar date differs.
 */
export function eventTimeForArtist(date: string, time: string, eventTimezone: string) {
  const utc = zonedTimeToUtc(date, time, eventTimezone);
  if (utc == null) return null;
  const artist = formatInZone(utc, ARTIST_TIMEZONE);
  const dayShift = Math.round(
    (Date.parse(`${artist.date}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000
  );
  const diffHours =
    (zoneOffsetMinutes(eventTimezone, utc) - zoneOffsetMinutes(ARTIST_TIMEZONE, utc)) / 60;
  return { ...artist, dayShift, diffHours };
}

/** Current wall-clock time in a zone, e.g. "21:05" */
export function nowInZone(timeZone: string): string {
  return formatInZone(Date.now(), timeZone).time;
}
