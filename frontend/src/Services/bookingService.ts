import { api } from "./api";
import type { Booking, BookingStatus, PaymentStatus } from "../Types/Artist";
import {
  notifyNewBookingRequest,
  notifyBookingStatusChange,
  notifyPaymentReceived,
} from "./notificationStore";
import { recordSuccessfulGig } from "./reputationStore";
import { createReceipt } from "./receiptStore";

export type CreateBookingPayload = {
  artistId: string;
  clientName: string;
  clientEmail: string;
  eventDate: string;
  venue?: string;
  message?: string;
  address?: string;
  city?: string;
  time?: string;
  fee?: number;
  promoterName?: string;
  notes?: string;
  reminderOptIn?: boolean;
};

export async function createBooking(
  payload: CreateBookingPayload
): Promise<Booking> {
  const { data } = await api.post<Booking>("/bookings", payload);
  try {
    notifyNewBookingRequest({
      artistId: data.artistId,
      promoterName: data.promoterName || data.clientName,
      venue: data.venue || "an event",
      eventDate: data.eventDate,
    });
  } catch {
    /* local notifications optional */
  }
  return data;
}

export async function getBookings(): Promise<Booking[]> {
  const { data } = await api.get<Booking[]>("/bookings");
  return data;
}

export async function getBooking(id: string): Promise<Booking> {
  const { data } = await api.get<Booking>(`/bookings/${id}`);
  return data;
}

export async function updateBookingStatusApi(
  id: string,
  status: BookingStatus
): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${id}`, { status });
  try {
    if (status === "confirmed" || status === "declined") {
      notifyBookingStatusChange({
        promoterId: data.promoterId || data.clientEmail,
        artistId: data.artistId,
        artistName: data.artistName,
        venue: data.venue || "your event",
        eventDate: data.eventDate,
        status,
      });
    }
  } catch {
    /* ignore */
  }
  return data;
}

export async function updateBookingPaymentApi(
  id: string,
  paymentStatus: PaymentStatus,
  disputeReason?: string
): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${id}`, {
    paymentStatus,
    disputeReason,
    status: paymentStatus === "paid" ? "paid" : undefined,
  });
  try {
    if (paymentStatus === "paid" || paymentStatus === "deposit") {
      recordSuccessfulGig(data.artistId);
      const amount = data.fee || 0;
      const depositAmt = paymentStatus === "deposit" ? Math.round(amount * 0.3) : amount;
      createReceipt({
        bookingId: data.id,
        artistId: data.artistId,
        artistName: data.artistName,
        promoterName: data.promoterName || data.clientName,
        promoterEmail: data.clientEmail,
        amount: depositAmt,
        platformFee: Math.round(depositAmt * 0.05),
        artistPayout: Math.round(depositAmt * 0.95),
        kind: paymentStatus === "deposit" ? "deposit" : "full",
        method: "manual",
        status: "paid",
        paidAt: data.paidAt || new Date().toISOString(),
      });
      notifyPaymentReceived({
        artistId: data.artistId,
        promoterId: data.promoterId || data.clientEmail,
        amount: depositAmt,
        venue: data.venue || "your event",
        kind: paymentStatus === "deposit" ? "deposit" : "full",
      });
    }
  } catch {
    /* ignore */
  }
  return data;
}

export async function updateBookingReminderApi(
  id: string,
  reminderOptIn: boolean
): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${id}`, {
    reminderOptIn,
  });
  return data;
}

export async function openBookingDisputeApi(
  id: string,
  reason: string
): Promise<Booking> {
  const { data } = await api.patch<Booking>(`/bookings/${id}`, {
    paymentStatus: "disputed",
    disputeReason: reason,
  });
  return data;
}
