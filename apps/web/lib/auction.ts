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
