import type { Artist } from "../Types/Artist";

/** Reputation badges, derived from the server's completed-booking count on the artist. */
export function getArtistBadges(artist: Pick<Artist, "completedBookings">): {
  verifiedStyle: boolean;
  completedBooking: boolean;
  completedCount: number;
  label: string | null;
} {
  const count = artist.completedBookings || 0;
  return {
    verifiedStyle: count >= 1,
    completedBooking: count >= 1,
    completedCount: count,
    label:
      count >= 1
        ? count === 1
          ? "Completed booking on The LineUp"
          : `${count} completed bookings on The LineUp`
        : null,
  };
}
