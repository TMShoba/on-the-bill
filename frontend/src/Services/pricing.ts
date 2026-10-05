import type { Artist } from "../Types/Artist";

function compactRand(n: number): string {
  return n >= 1000 ? `R${Math.round(n / 1000)}k` : `R${n}`;
}

/**
 * How to show an artist's price to this viewer. The API only sends the exact
 * rate when the viewer may see it (see priceVisibility on the server).
 */
export function priceDisplay(artist: Pick<Artist, "rate" | "priceBand" | "priceVisibility">): {
  /** Short label, e.g. "R50,000", "R40k–R60k" or "On request" */
  label: string;
  /** Exact ZAR amount for conversions; null when not visible */
  amount: number | null;
  kind: "exact" | "band" | "hidden";
} {
  if (typeof artist.rate === "number") {
    return { label: `R${artist.rate.toLocaleString()}`, amount: artist.rate, kind: "exact" };
  }
  if (artist.priceBand) {
    return {
      label: `${compactRand(artist.priceBand.min)}–${compactRand(artist.priceBand.max)}`,
      amount: artist.priceBand.min,
      kind: "band",
    };
  }
  return { label: "On request", amount: null, kind: "hidden" };
}

/** Lowest plausible fee, for filters and the booking form's starting offer */
export function priceFloor(artist: Pick<Artist, "rate" | "priceBand">): number | null {
  if (typeof artist.rate === "number") return artist.rate;
  return artist.priceBand?.min ?? null;
}
