import db from "./db";

const BLOCK_LENGTH_MS = 15 * 60 * 1000;
const START_TIME = 1735689600000; // Jan 1, 2025

export interface Auction {
  id: string;
  highestBid: number;
  winner: string | null;
  endsAt: number;
}

function getAuctionNumber(offset = 0) {
  return Math.floor((Date.now() - START_TIME) / BLOCK_LENGTH_MS) + 1 + offset;
}

function getAuctionId(offset = 0) {
  return `auction-${getAuctionNumber(offset)}`;
}

function getAuctionEndTime(offset = 0) {
  return START_TIME + getAuctionNumber(offset) * BLOCK_LENGTH_MS;
}

function getAuctionById(auctionId: string, offset = 0): Auction {
  const highestBid = db
    .prepare(
      "SELECT wallet, amount FROM bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 1"
    )
    .get(auctionId) as { wallet: string; amount: number } | undefined;

  return {
    id: auctionId,
    highestBid: highestBid?.amount ?? 0,
    winner: highestBid?.wallet ?? null,
    endsAt: getAuctionEndTime(offset),
  };
}

export function getCurrentAuction(): Auction {
  return getAuctionById(getAuctionId(0), 0);
}

export function getNextAuction(): Auction {
  return getAuctionById(getAuctionId(1), 1);
}

export function placeBid(amount: number, wallet: string) {
  const nextAuction = getNextAuction();

  if (amount <= nextAuction.highestBid) {
    return {
      success: false,
      message: "Bid must be higher than current highest bid.",
      auction: nextAuction,
    };
  }

  db.prepare(
    "INSERT INTO bids (auction_id, wallet, amount, created_at) VALUES (?, ?, ?, ?)"
  ).run(nextAuction.id, wallet, amount, new Date().toISOString());

  return {
    success: true,
    message: "Bid accepted for next attention block.",
    auction: getNextAuction(),
  };
}
