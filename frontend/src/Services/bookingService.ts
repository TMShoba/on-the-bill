import { api } from "./api";
import type {
  Booking,
  BookingStatus,
  PaymentStatus,
  TravelRequirements,
} from "../Types/Artist";

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
  eventCountry?: string;
  eventTimezone?: string;
  travel?: TravelRequirements;
};

export async function createBooking(
  payload: CreateBookingPayload
): Promise<Booking> {
  // The API notifies the artist
  const { data } = await api.post<Booking>("/bookings", payload);
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
  // The API generates the contract and notifies the promoter
  const { data } = await api.patch<Booking>(`/bookings/${id}`, { status });
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
  // The API records the receipt and notifies both parties
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
