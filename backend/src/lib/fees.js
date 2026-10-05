/**
 * Platform fee policy — must stay in sync with frontend/src/Services/platformFees.ts.
 * Promoter pays the artist fee + platform fee on top; artist receives the full fee.
 */
export const PLATFORM_FEE_RATE = 0.08;
export const PLATFORM_FEE_MIN = 25;
export const PLATFORM_FEE_MAX = 2500;
export const DEPOSIT_RATE = 0.3;

export function calcPlatformFee(performanceFee) {
  const raw = performanceFee * PLATFORM_FEE_RATE;
  return Math.round(Math.min(PLATFORM_FEE_MAX, Math.max(PLATFORM_FEE_MIN, raw)));
}

export function getFeeBreakdown(performanceFee) {
  const fee = Math.max(0, Number(performanceFee) || 0);
  const platformFee = fee > 0 ? calcPlatformFee(fee) : 0;
  const depositAmount = fee > 0 ? Math.round(fee * DEPOSIT_RATE) : 0;
  const depositPlatformFee = depositAmount > 0 ? calcPlatformFee(depositAmount) : 0;
  return {
    performanceFee: fee,
    platformFee,
    depositAmount,
    depositPlatformFee,
    depositTotal: depositAmount + depositPlatformFee,
    fullTotal: fee + platformFee,
    artistPayout: fee,
  };
}
