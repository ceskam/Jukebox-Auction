export const OPENING_BID_USDC = 0.25;
export const BID_INCREMENT_USDC = 1;

export function getMinimumBidUsdc(currentHighBid: number) {
  if (!Number.isFinite(currentHighBid) || currentHighBid <= 0) {
    return OPENING_BID_USDC;
  }

  return Math.round((currentHighBid + BID_INCREMENT_USDC) * 100) / 100;
}
