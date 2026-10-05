/**
 * Booking contracts are generated and frozen by the API when an artist accepts
 * a booking. Fetch and download them (as PDF) via documentsService.
 */

export type BookingContract = {
  bookingId: string;
  generatedAt: string;
  /** Plain-text snapshot — frozen at accept time so later edits to fee/date
   * elsewhere never retroactively change what was agreed. */
  text: string;
};

