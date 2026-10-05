import { getProfileStrength, type ArtistProfile } from "../Services/artistProfileStore";

/** Minimum profile strength before an artist is treated as "bookable ready" */
export const BOOKABLE_THRESHOLD = 70;

export function getArtistTrustBadge(profile: ArtistProfile | undefined): {
  percent: number;
  label: string;
  tone: "strong" | "ok" | "weak";
} {
  const { percent } = getProfileStrength(profile, {
    artistId: profile?.artistId,
    hasPublicBio: true,
  });
  if (percent >= 100)
    return { percent, label: "Profile complete", tone: "strong" };
  if (percent >= BOOKABLE_THRESHOLD)
    return { percent, label: "Bookable profile", tone: "ok" };
  return {
    percent,
    label: `Profile ${percent}% — finish for better bookings`,
    tone: "weak",
  };
}
