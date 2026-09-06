const DEFAULT_HOUSE_DELAY_MINUTES = 10;

export const HOUSE_NAME = "AttentionBid House";
export const HOUSE_BID_USDC = 0.25;

export type HouseAttention = {
  sponsor: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
};

const HOUSE_ATTENTION_ROTATION: HouseAttention[] = [
  {
    sponsor: "Quiet Coin",
    title: "Join the Quiet Coin community",
    description:
      "House-sponsored post from AttentionBid. Join the Quiet Coin Telegram chat for community updates and conversation.",
    url: "https://t.me/quietcoinchat",
    imageUrl: "",
  },
  {
    sponsor: "LivePayout",
    title: "Explore LivePayout",
    description:
      "House-sponsored post from AttentionBid. Visit LivePayout to explore its creator and streaming platform.",
    url: "https://www.livepayout.org/",
    imageUrl: "",
  },
  {
    sponsor: "Cash App referral",
    title: "Join Cash App with $Canderson91",
    description:
      "House-sponsored referral post from AttentionBid. Follow the link to visit $Canderson91 on Cash App.",
    url: "https://cash.app/$Canderson91",
    imageUrl: "",
  },
];

function getHouseDelayMs() {
  const configuredMinutes = Number(
    process.env.HOUSE_BOT_DELAY_MINUTES ?? DEFAULT_HOUSE_DELAY_MINUTES
  );
  const safeMinutes = Number.isFinite(configuredMinutes)
    ? Math.min(14, Math.max(1, configuredMinutes))
    : DEFAULT_HOUSE_DELAY_MINUTES;

  return safeMinutes * 60 * 1000;
}

export function isHouseBotEnabled() {
  return process.env.HOUSE_BOT_ENABLED === "true";
}

export function getHouseActivationTime(auctionStartsAt: number, blockLengthMs: number) {
  const biddingOpenedAt = auctionStartsAt - blockLengthMs;
  return biddingOpenedAt + getHouseDelayMs();
}

export function getHouseAttention(sequence: number): HouseAttention {
  const index = Math.abs(sequence) % HOUSE_ATTENTION_ROTATION.length;
  return HOUSE_ATTENTION_ROTATION[index];
}
