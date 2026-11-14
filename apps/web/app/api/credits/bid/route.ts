import { placeCreditBid } from "../../../../lib/credits";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { isSameOriginRequest } from "../../../../lib/security";
import { getAuthenticatedUser } from "../../../../lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  const limit = checkRateLimit(request, { key: "credit-bid", limit: 20, windowMs: 30 * 60 * 1000 });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ success: false, message: "Sign in before bidding with credits." }, { status: 401 });
  try {
    const body = await request.json();
    return Response.json(await placeCreditBid(user.id, Number(body.amount), String(body.auctionId)));
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Could not place credit bid." }, { status: 400 });
  }
}
