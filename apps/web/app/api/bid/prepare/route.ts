import { getNextAuction } from "../../../../lib/auction";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { getAuthenticatedWallet, isSameOriginRequest } from "../../../../lib/security";
import { ensureAuctionEscrow } from "../../../../lib/solana-escrow-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  const limit = checkRateLimit(request, { key: "prepare-escrow", limit: 20, windowMs: 30 * 60 * 1000 });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);
  if (!getAuthenticatedWallet(request)) return Response.json({ success: false, message: "Reconnect Phantom to verify wallet ownership." }, { status: 401 });
  try {
    const body = await request.json();
    const auction = await getNextAuction();
    if (String(body.auctionId ?? "") !== auction.id) throw new Error("That auction has closed. Refresh and try again.");
    return Response.json({ success: true, ...(await ensureAuctionEscrow(auction.sequence, auction.startsAt)) });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Could not prepare wallet escrow." }, { status: 503 });
  }
}
