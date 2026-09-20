export const TOKENS_PER_ADDITIONAL_POWER = 1_000_000;
export const MAX_BID_MULTIPLIER = 10;
export const TOKENS_FOR_MAX_POWER =
  (MAX_BID_MULTIPLIER - 1) * TOKENS_PER_ADDITIONAL_POWER;

function round(value: number, decimalPlaces: number) {
  const scale = 10 ** decimalPlaces;
  return Math.round(value * scale) / scale;
}

export function calculateBidMultiplier(quietBalance: number) {
  const safeBalance = Number.isFinite(quietBalance)
    ? Math.max(0, quietBalance)
    : 0;

  return round(
    Math.min(
      MAX_BID_MULTIPLIER,
      1 + safeBalance / TOKENS_PER_ADDITIONAL_POWER
    ),
    6
  );
}

export function calculateEffectiveBidUsdc(
  amountUsdc: number,
  bidMultiplier: number
) {
  const safeAmount = Number.isFinite(amountUsdc) ? Math.max(0, amountUsdc) : 0;
  const safeMultiplier = Number.isFinite(bidMultiplier)
    ? Math.min(MAX_BID_MULTIPLIER, Math.max(1, bidMultiplier))
    : 1;

  return round(safeAmount * safeMultiplier, 8);
}
