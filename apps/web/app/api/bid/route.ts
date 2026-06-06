import { currentAuction } from "@/lib/auction";

export async function GET() {
  return Response.json({
    highestBid: currentAuction.highestBid,
    winner: currentAuction.winner,
  });
}
