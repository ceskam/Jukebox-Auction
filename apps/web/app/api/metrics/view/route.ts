import { NextResponse } from "next/server";

import { recordAttentionEvent } from "../../../../lib/metrics";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { isSameOriginRequest } from "../../../../lib/security";
import { getArtDropClaimIdentity } from "../../../../lib/engagement";
import { getCurrentAuction } from "../../../../lib/auction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, {
    key: "page-view",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      auctionId?: string;
      featuredContentAuctionId?: string;
    };

    const auctionId = String(body.auctionId ?? "");
    const featuredContentAuctionId = String(body.featuredContentAuctionId ?? "");
    if (!/^attention-\d+$/.test(auctionId)) {
      return NextResponse.json({ error: "Invalid auction ID." }, { status: 400 });
    }
    const currentAuction = await getCurrentAuction();
    if (auctionId !== currentAuction.id) {
      return NextResponse.json({ error: "That attention block is not live." }, { status: 409 });
    }

    await recordAttentionEvent({
      auctionId,
      eventType: "page_view",
      featuredContentAuctionId: /^attention-\d+$/.test(featuredContentAuctionId)
        ? featuredContentAuctionId
        : "",
      viewerHash: getArtDropClaimIdentity(request).engagementSessionHash,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record page view.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
