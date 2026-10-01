/**
 * Platform fee policy — transparent for both sides.
 *
 * Default: promoter pays artist fee + platform fee on top
 * (artist still receives the agreed performance fee in full).
 */

/** Platform takes 8% of the performance fee, min R25, max R2 500 */
// Promoters pay this percentage on a confirmed booking. Artists pay a subscription separately.
export const PLATFORM_FEE_RATE = 0.08;
export const PLATFORM_FEE_MIN = 25;
export const PLATFORM_FEE_MAX = 2500;

/** Default deposit = 30% of performance fee (before platform fee) */
export const DEPOSIT_RATE = 0.3;

export function calcPlatformFee(performanceFee: number): number {
  const raw = performanceFee * PLATFORM_FEE_RATE;
  return Math.round(
    Math.min(PLATFORM_FEE_MAX, Math.max(PLATFORM_FEE_MIN, raw))
  );
}

export function calcDeposit(performanceFee: number): number {
  return Math.round(performanceFee * DEPOSIT_RATE);
}

export type FeeBreakdown = {
  performanceFee: number;
  platformFee: number;
  /** What promoter pays for a deposit step */
  depositAmount: number;
  depositPlatformFee: number;
  depositTotal: number;
  /** Full settlement */
  fullPlatformFee: number;
  fullTotal: number;
  /** Artist receives */
  artistPayout: number;
  whoPaysPlatformFee: "promoter";
  summary: string;
};

export function getFeeBreakdown(performanceFee: number): FeeBreakdown {
  const fee = Math.max(0, Number(performanceFee) || 0);
  const platformFee = fee > 0 ? calcPlatformFee(fee) : 0;
  const depositAmount = fee > 0 ? calcDeposit(fee) : 0;
  const depositPlatformFee =
    depositAmount > 0 ? calcPlatformFee(depositAmount) : 0;

  return {
    performanceFee: fee,
    platformFee,
    depositAmount,
    depositPlatformFee,
    depositTotal: depositAmount + depositPlatformFee,
    fullPlatformFee: platformFee,
    fullTotal: fee + platformFee,
    artistPayout: fee,
    whoPaysPlatformFee: "promoter",
    summary:
      "Promoter pays the artist fee + platform fee. The artist receives the full agreed performance fee.",
  };
}
