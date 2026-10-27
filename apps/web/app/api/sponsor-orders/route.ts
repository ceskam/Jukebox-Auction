import { createSponsorOrder } from "../../../lib/sponsors";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { getAuthenticatedWallet, isSameOriginRequest } from "../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
  const limit = checkRateLimit(request, { key: "sponsor-order", limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);
  const wallet = getAuthenticatedWallet(request);
  if (!wallet) {
    return Response.json({ success: false, message: "Connect and authenticate Phantom first." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const order = await createSponsorOrder({
      wallet,
      planCode: String(body.planCode ?? ""),
      paymentSignature: String(body.paymentSignature ?? ""),
      sponsorName: String(body.sponsorName ?? ""),
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      url: String(body.url ?? ""),
      imageUrl: String(body.imageUrl ?? ""),
      contact: String(body.contact ?? ""),
    });
    return Response.json({ success: true, order, message: "Payment verified. Your package is queued for content review." });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Could not create sponsor package." },
      { status: 400 }
    );
  }
}
