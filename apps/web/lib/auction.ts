import db from "./db";

export interface Auction {
  id: string;
  highestBid: number;
  winner: string | null;
  endsAt: number;
}

export function getCurrentAuction(): Auction {
  const highestBid = db
    .prepare(
      "SELECT wallet, amount FROM bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 1"
    )
    .get("auction-1") as { wallet: string; amount: number } | undefined;

  return {
    id: "auction-1",
    highestBid: highestBid?.amount ?? 0,
    winner: highestBid?.wallet ?? null,
    endsAt: Date.now() + 15 * 60 * 1000,
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
  ).run("auction-1", wallet, amount, new Date().toISOString());

  return {
    success: true,
    message: "Bid accepted.",
    auction: getCurrentAuction(),
  };
}
