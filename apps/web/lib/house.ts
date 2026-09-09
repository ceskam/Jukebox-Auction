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
    title: "Quiet Coin: join the conversation",
    description:
      "Step into the Quiet Coin Telegram for community conversation, project updates, and a closer look at what people are building together. This is a disclosed, house-sponsored post from AttentionBid.",
    url: "https://t.me/quietcoinchat",
    imageUrl: "/house-sponsors/quiet-coin.svg",
  },
  {
    sponsor: "LivePayout",
    title: "LivePayout: see what happens live",
    description:
      "Explore LivePayout and discover a platform focused on creators, live streams, and audience participation. Visit the site to see what the team is building. This is a disclosed, house-sponsored post from AttentionBid.",
    url: "https://www.livepayout.org/",
    imageUrl: "/house-sponsors/livepayout.svg",
  },
  {
    sponsor: "Cash App referral",
    title: "Join Cash App with $Canderson91",
    description:
      "Looking for a simple way to send and receive money? Visit the $Canderson91 Cash App referral page and check whether an offer is available to you. This is a disclosed, house-sponsored referral from AttentionBid.",
    url: "https://cash.app/$Canderson91",
    imageUrl: "/house-sponsors/cash-app.svg",
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
