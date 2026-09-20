import { getQuietBidPower } from "../../../lib/bid-power";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { getAuthenticatedWallet } from "../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, {
    key: "bid-power",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const wallet = getAuthenticatedWallet(request);
  if (!wallet) {
    return Response.json(
      { success: false, message: "Connect Phantom to load QUIET bid power." },
      { status: 401 }
    );
  }

  try {
    const bidPower = await getQuietBidPower(wallet);
    return Response.json(
      { success: true, wallet, bidPower },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Could not load QUIET bid power.", error);
    return Response.json(
      {
        success: false,
        message: "QUIET bid power is temporarily unavailable. Try again shortly.",
      },
      { status: 503 }
    );
  }
}
