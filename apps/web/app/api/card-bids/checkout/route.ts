import { createCardBidCheckout, quoteCardBid } from "../../../../lib/card-bids";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { isSameOriginRequest } from "../../../../lib/security";
import { getAuthenticatedUser } from "../../../../lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  const limit = checkRateLimit(request, { key: "card-bid-checkout", limit: 8, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ success: false, message: "Sign in before authorizing a card bid." }, { status: 401 });
  try {
    const body = await request.json();
    const quote = quoteCardBid(Number(body.amount));
    const result = await createCardBidCheckout({
      userId: user.id,
      email: user.email,
      amount: quote.bidValueUsdc,
      auctionId: String(body.auctionId ?? ""),
      origin: new URL(request.url).origin,
    });
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Could not create card authorization." }, { status: 400 });
  }
}
