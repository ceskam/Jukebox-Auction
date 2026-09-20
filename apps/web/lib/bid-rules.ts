export const OPENING_BID_USDC = 0.25;
export const BID_INCREMENT_EFFECTIVE_USDC = 1;

export function getMinimumBidUsdc(
  currentHighestEffectiveBid: number,
  bidMultiplier = 1
) {
  if (
    !Number.isFinite(currentHighestEffectiveBid) ||
    currentHighestEffectiveBid <= 0
  ) {
    return OPENING_BID_USDC;
  }

  const safeMultiplier = Number.isFinite(bidMultiplier)
    ? Math.min(10, Math.max(1, bidMultiplier))
    : 1;
  const requiredRawBid =
    (currentHighestEffectiveBid + BID_INCREMENT_EFFECTIVE_USDC) /
    safeMultiplier;

  return Math.max(
    OPENING_BID_USDC,
    Math.ceil(requiredRawBid * 100) / 100
  );
}
