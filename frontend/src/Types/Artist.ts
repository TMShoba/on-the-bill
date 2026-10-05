export type Artist = {
  id: string;
  stageName: string;
  genre: string;
  location: string;
  /** Exact rate in ZAR — null when the artist hides it from this viewer */
  rate: number | null;
  priceVisibility?: PriceVisibility;
  /** Public range when priceVisibility is "band" */
  priceBand?: { min: number; max: number } | null;
  imageUrl: string;
  bio?: string;
  /** Server-computed trust signals */
  verificationStatus?:
    | "unverified"
    | "pending_review"
    | "identity_verified"
    | "fully_verified"
    | "rejected";
  completedBookings?: number;
};

export type PriceVisibility = "exact" | "band" | "on_request";

/** "blocked" only appears on artist calendars (dates the artist marked unavailable) */
export type BookingStatus = "pending" | "confirmed" | "declined" | "paid" | "blocked";

export type PaymentStatus = "unpaid" | "deposit" | "paid" | "disputed";

/** What the promoter covers for an international booking */
export type TravelRequirements = {
  flights: boolean;
  accommodation: boolean;
  groundTransport: boolean;
  visaSupport: boolean;
  crewSize: number;
  notes?: string;
};

export type Booking = {
  id: string;
  artistId: string;
  artistName: string;
  clientName: string;
  clientEmail: string;
  eventDate: string;
  venue: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  address?: string;
  city?: string;
  time?: string;
  fee?: number;
  promoterName?: string;
  promoterId?: string;
  notes?: string;
  reminderOptIn?: boolean;
  /** Money trail — separate from lifecycle status for clarity */
  paymentStatus?: PaymentStatus;
  paidAt?: string;
  disputeReason?: string;
  disputedAt?: string;
  /** ISO 3166 alpha-2, "ZA" for local bookings */
  eventCountry?: string;
  /** IANA time zone of the venue */
  eventTimezone?: string;
  travel?: TravelRequirements;
};

export type UserRole = "artist" | "promoter" | "client";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Catalog artist id when role is artist (e.g. "2" for DJ Maphorisa) */
  artistId?: string;
  createdAt: string;
  /** Can review artist verifications */
  isAdmin?: boolean;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type MessageAttachment = {
  /** Server file id — download via /messages/attachments/:id */
  id?: string;
  name: string;
  type: string;
  size: number;
  /** Present while uploading (and on older messages stored inline) */
  dataUrl?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  read: boolean;
  attachment?: MessageAttachment;
};

export type Conversation = {
  id: string;
  bookingId: string;
  artistId: string;
  artistName: string;
  promoterId: string;
  promoterName: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  /** Booking context so promoters with several gigs can tell chats apart */
  bookingVenue?: string;
  bookingDate?: string;
  bookingCity?: string;
};
