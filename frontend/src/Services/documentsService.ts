import { api } from "./api";
import type { Booking } from "../Types/Artist";
import { downloadContract, ensureContract, getContract, type BookingContract } from "./contractStore";
import { downloadReceipt, getReceiptsForBooking, type Receipt } from "./receiptStore";

export type BookingDocumentsRow = {
  bookingId: string;
  artistName: string;
  promoterName: string;
  eventDate: string;
  venue: string;
  status: string;
  contract: BookingContract | null;
  receipts: Receipt[];
};

export async function listDocumentsApi(): Promise<BookingDocumentsRow[]> {
  const { data } = await api.get<BookingDocumentsRow[]>("/documents");
  return Array.isArray(data) ? data : [];
}

export function listDocumentsLocal(bookings: Booking[]): BookingDocumentsRow[] {
  return bookings
    .map((b) => {
      const receipts = getReceiptsForBooking(b.id);
      const contract =
        b.status === "confirmed" || b.status === "paid" ? ensureContract(b) : getContract(b.id);
      return {
        bookingId: b.id,
        artistName: b.artistName,
        promoterName: b.promoterName || b.clientName,
        eventDate: b.eventDate,
        venue: b.venue || "",
        status: b.status,
        contract,
        receipts,
      };
    })
    .filter((row) => row.receipts.length > 0 || row.contract);
}

export { downloadContract, downloadReceipt };
