
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

const FEE_RATE = 0.08;

function feeBreakdown(fee = 0) {
  const performanceFee = Number(fee) || 0;
  const platformFee = Math.min(2500, Math.max(performanceFee ? 25 : 0, Math.round(performanceFee * FEE_RATE)));
  const deposit = Math.round(performanceFee * 0.5);
  return {
    performanceFee,
    platformFee,
    artistPayout: performanceFee,
    depositTotal: deposit + Math.round(platformFee * 0.5),
    fullTotal: performanceFee + platformFee,
  };
}

export function buildContractText(row) {
  const fees = feeBreakdown(row.fee);
  const promoter = row.promoter_name || row.client_name || "Promoter";
  return [
    "THE LINEUP — BOOKING CONFIRMATION",
    `Booking: ${row.id}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "PARTIES",
    `  Artist: ${row.artist_name}`,
    `  Promoter: ${promoter}${row.client_email ? ` (${row.client_email})` : ""}`,
    "",
    "EVENT",
    `  Venue: ${row.venue || "TBC"}`,
    `  Address: ${[row.address, row.city].filter(Boolean).join(", ") || "TBC"}`,
    `  Date: ${row.event_date}`,
    `  Time: ${row.time || "TBC"}`,
    "",
    "PAYMENT",
    `  Performance fee: R${fees.performanceFee.toLocaleString()}`,
    `  Platform fee (paid by promoter on confirmation): R${fees.platformFee.toLocaleString()}`,
    `  Deposit due to secure the date: R${fees.depositTotal.toLocaleString()}`,
    `  Balance due on/before the event: R${(fees.fullTotal - fees.depositTotal).toLocaleString()}`,
    `  Artist receives in full: R${fees.artistPayout.toLocaleString()}`,
    "",
    "NOTES FROM BOOKING REQUEST",
    `  ${row.notes || row.message || "None provided"}`,
    "",
    "CANCELLATION",
    "  Governed by The LineUp cancellation policy at the time of booking.",
    "  This record is stored in Postgres when the artist confirms and does not change afterwards.",
  ].join("\n");
}

export async function ensureContract(row) {
  const existing = await db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(row.id);
  if (existing) return existing;
  const text = buildContractText(row);
  await db.prepare(
    `INSERT INTO booking_contracts (booking_id, text, generated_at) VALUES (?, ?, NOW())`
  ).run(row.id, text);
  return db.prepare("SELECT * FROM booking_contracts WHERE booking_id = ?").get(row.id);
}

export async function ensureReceipt(row, kind) {
  const existing = await db
    .prepare("SELECT * FROM receipts WHERE booking_id = ? AND kind = ?")
    .get(row.id, kind);
  if (existing) return existing;
  const fees = feeBreakdown(row.fee);
  const amount = kind === "deposit" ? fees.depositTotal : fees.fullTotal;
  const id = uuidv4();
  await db.prepare(
    `INSERT INTO receipts (
      id, booking_id, artist_id, artist_name, promoter_name, promoter_email, promoter_id,
      amount, platform_fee, artist_payout, kind, method, status, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'paid', NOW())`
  ).run(
    id,
    row.id,
    row.artist_id,
    row.artist_name,
    row.promoter_name || row.client_name || "",
    row.client_email || "",
    row.promoter_id || null,
    amount,
    kind === "deposit" ? Math.round(fees.platformFee * 0.5) : fees.platformFee,
    kind === "deposit" ? Math.round(fees.performanceFee * 0.5) : fees.performanceFee
  );
  return db.prepare("SELECT * FROM receipts WHERE id = ?").get(id);
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
