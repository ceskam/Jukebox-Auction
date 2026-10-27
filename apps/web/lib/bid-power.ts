export {
  calculateBidMultiplier,
  calculateEffectiveBidUsdc,
  MAX_BID_MULTIPLIER,
  TOKENS_FOR_MAX_POWER,
  TOKENS_PER_ADDITIONAL_POWER,
} from "./bid-power-math";

export const QUIET_MINT_ADDRESS =
  process.env.QUIET_MINT_ADDRESS ??
  "JCfSVdmBNKwMnMUMccfNbQQVVJKYsQNbXCqhdRuZpump";

export type BidPowerSnapshot = {
  quietBalance: number;
  bidMultiplier: number;
  snapshotSlot: number;
  mintAddress: string;
};

export async function getQuietBidPower(
  wallet: string
): Promise<BidPowerSnapshot> {
  // Third-party token bid power is intentionally disabled. Keep the stable 1x
  // snapshot shape so historical bids remain readable while new bids compete
  // at their verified USDC face value.
  void wallet;
  return {
    quietBalance: 0,
    bidMultiplier: 1,
    snapshotSlot: 0,
    mintAddress: QUIET_MINT_ADDRESS,
  };

}
