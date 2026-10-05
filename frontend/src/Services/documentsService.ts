import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { api } from "./api";
import type { BookingContract } from "./contractStore";
import type { Receipt } from "./receiptStore";

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

export type BookingDocuments = {
  contract: BookingContract | null;
  receipts: Receipt[];
};

export async function listDocumentsApi(): Promise<BookingDocumentsRow[]> {
  const { data } = await api.get<BookingDocumentsRow[]>("/documents");
  return Array.isArray(data) ? data : [];
}

export async function getBookingDocumentsApi(bookingId: string): Promise<BookingDocuments> {
  const { data } = await api.get<BookingDocuments>(
    `/documents/${encodeURIComponent(bookingId)}`
  );
  return {
    contract: data?.contract || null,
    receipts: Array.isArray(data?.receipts) ? data.receipts : [],
  };
}

/** Contract + receipts for one booking. Pass a changing `version` to refetch after updates. */
export function useBookingDocuments(bookingId: string | undefined, version: unknown = 0) {
  return useQuery({
    queryKey: ["documents", bookingId, version],
    queryFn: () => getBookingDocumentsApi(bookingId!),
    enabled: Boolean(bookingId),
  });
}

/** Fetch a server-generated PDF with the user's auth header and save it */
async function downloadPdf(path: string, filename: string): Promise<void> {
  try {
    const { data } = await api.get<Blob>(path, { responseType: "blob", timeout: 60000 });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    let message = "Could not download the PDF. Please try again.";
    // Error bodies come back as a Blob because of responseType
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      try {
        message = JSON.parse(await e.response.data.text()).message || message;
      } catch {
        /* keep default */
      }
    }
    window.alert(message);
  }
}

export function downloadContract(contract: BookingContract): Promise<void> {
  return downloadPdf(
    `/documents/${encodeURIComponent(contract.bookingId)}/contract.pdf`,
    `LineUp-contract-${contract.bookingId.slice(0, 8)}.pdf`
  );
}

export function downloadReceipt(receipt: Receipt): Promise<void> {
  return downloadPdf(
    `/documents/receipts/${encodeURIComponent(receipt.id)}/pdf`,
    `LineUp-receipt-${receipt.id.slice(0, 8)}.pdf`
  );
}
