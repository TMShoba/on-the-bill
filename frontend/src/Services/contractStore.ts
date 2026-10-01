import type { Booking } from "../Types/Artist";
import { getFeeBreakdown } from "./platformFees";

export type BookingContract = {
  bookingId: string;
  generatedAt: string;
  /** Plain-text snapshot — frozen at accept time so later edits to fee/date
   * elsewhere never retroactively change what was agreed. */
  text: string;
};

const KEY_PREFIX = "otb_contract_";

export function getContract(bookingId: string): BookingContract | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + bookingId);
    return raw ? (JSON.parse(raw) as BookingContract) : null;
  } catch {
    return null;
  }
}

function buildContractText(gig: Booking): string {
  const fees = getFeeBreakdown(gig.fee || 0);
  const promoter = gig.promoterName || gig.clientName || "Promoter";

  return [
    `BOOKING CONFIRMATION — THE LINEUP`,
    `Generated ${new Date().toLocaleString("en-ZA")}`,
    ``,
    `This confirms the agreement below between the Artist and the Promoter.`,
    `The LineUp is a booking facilitator only and is not a party to this`,
    `performance agreement — the contractual relationship is directly between`,
    `the Artist and the Promoter named here.`,
    ``,
    `PARTIES`,
    `  Artist: ${gig.artistName}`,
    `  Promoter: ${promoter}${gig.clientEmail ? ` (${gig.clientEmail})` : ""}`,
    ``,
    `EVENT`,
    `  Venue: ${gig.venue || "TBC"}`,
    `  Address: ${[gig.address, gig.city].filter(Boolean).join(", ") || "TBC"}`,
    `  Date: ${gig.eventDate}`,
    `  Time: ${gig.time || "TBC"}`,
    ``,
    `PAYMENT`,
    `  Performance fee: R${fees.performanceFee.toLocaleString()}`,
    `  Platform fee (paid by promoter): R${fees.platformFee.toLocaleString()}`,
    `  Deposit due to secure the date: R${fees.depositTotal.toLocaleString()}`,
    `  Balance due on/before the event: R${(fees.fullTotal - fees.depositTotal).toLocaleString()}`,
    `  Artist receives in full: R${fees.artistPayout.toLocaleString()}`,
    ``,
    `NOTES FROM BOOKING REQUEST`,
    `  ${gig.notes || gig.message || "None provided"}`,
    ``,
    `CANCELLATION`,
    `  Governed by The LineUp's published Cancellation Policy at the time of`,
    `  booking (see thelineup.co.za/legal/cancellation). In short: more than`,
    `  14 days out, either party may cancel; inside 7 days, cancelling party`,
    `  should expect limited or no refund of amounts already paid, except`,
    `  where the other party is in material breach.`,
    ``,
    `This record is generated automatically when the Artist accepts the`,
    `booking request and does not change afterwards. It is not a substitute`,
    `for independent legal advice for high-value or complex bookings.`,
  ].join("\n");
}

/** Call once, right when a booking transitions to "confirmed". Safe to call
 * repeatedly — only the first snapshot is kept. */
export function ensureContract(gig: Booking): BookingContract {
  const existing = getContract(gig.id);
  if (existing) return existing;

  const contract: BookingContract = {
    bookingId: gig.id,
    generatedAt: new Date().toISOString(),
    text: buildContractText(gig),
  };
  localStorage.setItem(KEY_PREFIX + gig.id, JSON.stringify(contract));
  return contract;
}


export function downloadContract(contract: BookingContract, filename?: string) {
  const blob = new Blob([contract.text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `lineup-contract-${contract.bookingId.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
