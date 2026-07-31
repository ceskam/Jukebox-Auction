import { getBidHistory, getNextAuction, placeBid } from "../../../lib/auction";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import {
  getAuthenticatedWallet,
  isSameOriginRequest,
} from "../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nextAuction = await getNextAuction();

  return Response.json({
    auction: nextAuction,
    bids: await getBidHistory(nextAuction.id),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    key: "bid",
    limit: 12,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const authenticatedWallet = getAuthenticatedWallet(request);
  if (!authenticatedWallet) {
    return Response.json(
      { success: false, message: "Reconnect Phantom to verify wallet ownership." },
      { status: 401 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8_192) {
    return Response.json(
      { success: false, message: "Bid request is too large." },
      { status: 413 }
    );
  }

  const body = await request.json().catch(() => ({}));

  try {
    const result = await placeBid(
      Number(body.amountUsdc ?? body.amount),
      authenticatedWallet,
      String(body.auctionId ?? ""),
      body.paymentSignature ?? null
    );

    return Response.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error("Could not record verified bid.", error);
    return Response.json(
      {
        success: false,
        message:
          "Could not record the bid right now. Your payment receipt can be retried.",
      },
      { status: 500 }
    );
  }
}
