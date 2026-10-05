import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { getFeeBreakdown } from "./fees.js";

function countryName(code) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

/** The event start in South African time, e.g. "00:00 on 2026-12-13" */
function artistLocalStart(row) {
  const tz = row.event_timezone;
  if (!tz || tz === "Africa/Johannesburg" || !row.event_date || !row.time) return null;
  try {
    const [y, m, d] = String(row.event_date).slice(0, 10).split("-").map(Number);
    const [hh, mm] = String(row.time).split(":").map(Number);
    const wall = Date.UTC(y, m - 1, d, hh, mm || 0);
    const offsetAt = (utc) => {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit",
          day: "2-digit", hour: "2-digit", minute: "2-digit",
        }).formatToParts(new Date(utc)).map((x) => [x.type, x.value])
      );
      return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - utc;
    };
    let utc = wall - offsetAt(wall);
    utc = wall - offsetAt(utc);
    const sa = new Date(utc);
    const date = sa.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const time = sa.toLocaleTimeString("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return `${time} on ${date}`;
  } catch {
    return null;
  }
}

function travelLines(row) {
  if (!row.travel_json) return [];
  let t;
  try {
    t = JSON.parse(row.travel_json);
  } catch {
    return [];
  }
  const yes = (v) => (v ? "Provided by promoter" : "Not included");
  return [
    "",
    "TRAVEL (INTERNATIONAL BOOKING)",
    `  Flights: ${yes(t.flights)}`,
    `  Accommodation: ${yes(t.accommodation)}`,
    `  Ground transport: ${yes(t.groundTransport)}`,
    `  Visa invitation letter: ${t.visaSupport ? "Promoter to supply" : "Not required / not included"}`,
    `  Travelling party: ${t.crewSize || 1} ${t.crewSize === 1 ? "person" : "people"}`,
    ...(t.notes ? [`  Notes: ${t.notes}`] : []),
  ];
}

export function buildContractText(row) {
  const fees = getFeeBreakdown(row.fee);
  const promoter = row.promoter_name || row.client_name || "Promoter";
  const international = row.event_country && row.event_country !== "ZA";
  return [
    "BOOKING CONFIRMATION — THE LINEUP",
    `Booking: ${row.id}`,
    `Generated ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}`,
    "",
    "This confirms the agreement below between the Artist and the Promoter.",
    "The LineUp is a booking facilitator only and is not a party to this",
    "performance agreement — the contractual relationship is directly between",
    "the Artist and the Promoter named here.",
    "",
    "PARTIES",
    `  Artist: ${row.artist_name}`,
    `  Promoter: ${promoter}${row.client_email ? ` (${row.client_email})` : ""}`,
    "",
    "EVENT",
    `  Venue: ${row.venue || "TBC"}`,
    `  Address: ${[row.address, row.city].filter(Boolean).join(", ") || "TBC"}`,
    `  Date: ${row.event_date}`,
    `  Time: ${row.time || "TBC"}${row.event_timezone ? ` (${row.event_timezone})` : ""}`,
    ...(artistLocalStart(row) ? [`  Artist time (SAST): ${artistLocalStart(row)}`] : []),
    ...(international ? [`  Country: ${countryName(row.event_country)}`] : []),
    ...travelLines(row),
    "",
    "PAYMENT",
    `  Performance fee: R${fees.performanceFee.toLocaleString()}`,
    `  Platform fee (paid by promoter): R${fees.platformFee.toLocaleString()}`,
    `  Deposit due to secure the date: R${fees.depositTotal.toLocaleString()}`,
    `  Balance due on/before the event: R${(fees.fullTotal - fees.depositTotal).toLocaleString()}`,
    `  Artist receives in full: R${fees.artistPayout.toLocaleString()}`,
    ...(international ? ["  All amounts are in South African Rand (ZAR)."] : []),
    "",
    "NOTES FROM BOOKING REQUEST",
    `  ${row.notes || row.message || "None provided"}`,
    "",
    "CANCELLATION",
    "  Governed by The LineUp's published Cancellation Policy at the time of",
    "  booking (see thelineup.co.za/legal/cancellation). In short: more than",
    "  14 days out, either party may cancel; inside 7 days, cancelling party",
    "  should expect limited or no refund of amounts already paid, except",
    "  where the other party is in material breach.",
    "",
    "This record is generated automatically when the Artist accepts the",
    "booking request and does not change afterwards. It is not a substitute",
    "for independent legal advice for high-value or complex bookings.",
  ].join("\n");
}

export async function ensureContract(row) {
  const existing = await db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(row.id);
  if (existing) return existing;
  const text = buildContractText(row);
  await db.prepare(
    `INSERT INTO booking_contracts (booking_id, text, generated_at) VALUES (?, ?, NOW())
     ON CONFLICT (booking_id) DO NOTHING`
  ).run(row.id, text);
  return db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(row.id);
}

/** Amounts for a receipt. A full payment after a deposit only covers the balance. */
function receiptAmounts(fee, kind, depositAlreadyPaid) {
  const fees = getFeeBreakdown(fee);
  if (kind === "deposit") {
    return {
      amount: fees.depositTotal,
      platformFee: fees.depositPlatformFee,
      artistPayout: fees.depositAmount,
    };
  }
  if (depositAlreadyPaid) {
    return {
      amount: fees.fullTotal - fees.depositTotal,
      platformFee: fees.platformFee - fees.depositPlatformFee,
      artistPayout: fees.performanceFee - fees.depositAmount,
    };
  }
  return {
    amount: fees.fullTotal,
    platformFee: fees.platformFee,
    artistPayout: fees.artistPayout,
  };
}

/**
 * Create the receipt for a payment step once. Returns { receipt, created } so callers
 * can notify only on the first write.
 */
export async function ensureReceipt(row, kind, method = "manual") {
  const existing = await db
    .prepare("SELECT * FROM receipts WHERE booking_id = ? AND kind = ?")
    .get(row.id, kind);
  if (existing) return { receipt: existing, created: false };

  const deposit = kind === "full"
    ? await db.prepare("SELECT id FROM receipts WHERE booking_id = ? AND kind = 'deposit'").get(row.id)
    : null;
  const amounts = receiptAmounts(row.fee, kind, Boolean(deposit));
  const id = uuidv4();
  await db.prepare(
    `INSERT INTO receipts (
      id, booking_id, artist_id, artist_name, promoter_name, promoter_email, promoter_id,
      amount, platform_fee, artist_payout, kind, method, status, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', NOW())`
  ).run(
    id,
    row.id,
    row.artist_id,
    row.artist_name,
    row.promoter_name || row.client_name || "",
    row.client_email || "",
    row.promoter_id || null,
    amounts.amount,
    amounts.platformFee,
    amounts.artistPayout,
    kind,
    method
  );
  const receipt = await db.prepare("SELECT * FROM receipts WHERE id = ?").get(id);
  return { receipt, created: true };
}

export function mapContract(row) {
  if (!row) return null;
  return {
    bookingId: row.booking_id,
    text: row.text,
    generatedAt: row.generated_at,
  };
}

export function mapReceipt(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    promoterName: row.promoter_name,
    promoterEmail: row.promoter_email,
    amount: row.amount,
    platformFee: row.platform_fee,
    artistPayout: row.artist_payout,
    kind: row.kind,
    method: row.method,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}
