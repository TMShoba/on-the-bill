/**
 * Payment receipts are created by the API when a payment is recorded
 * (PayFast ITN or a trusted status update). Fetch and download them (as PDF)
 * via documentsService.
 */

export type Receipt = {
  id: string;
  bookingId: string;
  artistId: string;
  artistName: string;
  promoterName: string;
  promoterEmail?: string;
  amount: number;
  platformFee: number;
  artistPayout: number;
  /** deposit | full */
  kind: "deposit" | "full";
  method: "payfast" | "eft" | "manual";
  status: "pending" | "paid" | "refunded";
  createdAt: string;
  paidAt?: string;
};

