import db from "./db";

const BLOCK_LENGTH_MS = 15 * 60 * 1000;
const START_TIME = 1735689600000; // Jan 1, 2025

export interface Auction {
  id: string;
  highestBid: number;
  winner: string | null;
  endsAt: number;
}

function getCurrentAuctionId() {
  const auctionNumber = Math.floor((Date.now() - START_TIME) / BLOCK_LENGTH_MS) + 1;
  return `auction-${auctionNumber}`;
}

function getCurrentAuctionEndTime() {
  const auctionNumber = Math.floor((Date.now() - START_TIME) / BLOCK_LENGTH_MS) + 1;
  return START_TIME + auctionNumber * BLOCK_LENGTH_MS;
}

export function getCurrentAuction(): Auction {
  const auctionId = getCurrentAuctionId();

  const highestBid = db
    .prepare(
      "SELECT wallet, amount FROM bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 1"
    )
    .get(auctionId) as { wallet: string; amount: number } | undefined;

  return {
    id: auctionId,
    highestBid: highestBid?.amount ?? 0,
    winner: highestBid?.wallet ?? null,
    endsAt: getCurrentAuctionEndTime(),
  };
}

export function placeBid(amount: number, wallet: string) {
  const currentAuction = getCurrentAuction();

  if (amount <= currentAuction.highestBid) {
    return {
      success: false,
      message: "Bid must be higher than current highest bid.",
      auction: currentAuction,
    };
  }

  db.prepare(
    "INSERT INTO bids (auction_id, wallet, amount, created_at) VALUES (?, ?, ?, ?)"
  ).run(currentAuction.id, wallet, amount, new Date().toISOString());

  return {
    success: true,
    message: "Bid accepted.",
    auction: getCurrentAuction(),
  };
}
