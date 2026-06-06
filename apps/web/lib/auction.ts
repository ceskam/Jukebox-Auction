export interface Auction {
  id: string;
  highestBid: number;
  winner: string | null;
  endsAt: number;
}

export const currentAuction: Auction = {
  id: "auction-1",
  highestBid: 0,
  winner: null,
  endsAt: Date.now() + 15 * 60 * 1000,
};

export function placeBid(amount: number, wallet: string) {
  if (amount <= currentAuction.highestBid) {
    return {
      success: false,
      message: "Bid must be higher than current highest bid.",
      auction: currentAuction,
    };
  }

  currentAuction.highestBid = amount;
  currentAuction.winner = wallet;

  return {
    success: true,
    message: "Bid accepted.",
    auction: currentAuction,
  };
}
