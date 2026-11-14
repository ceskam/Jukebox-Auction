import { NextResponse } from "next/server";

import { recordAttentionEvent } from "../../../../lib/metrics";
import { getAttentionContent } from "../../../../lib/attention";
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
    key: "link-click",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      auctionId?: string;
      featuredContentAuctionId?: string;
      url?: string;
    };

    const auctionId = String(body.auctionId ?? "");
    const featuredContentAuctionId = String(body.featuredContentAuctionId ?? "");
    const targetUrl = String(body.url ?? "");
    if (!/^attention-\d+$/.test(auctionId)) {
      return NextResponse.json({ error: "Invalid auction ID." }, { status: 400 });
    }
    const currentAuction = await getCurrentAuction();
    if (auctionId !== currentAuction.id) {
      return NextResponse.json({ error: "That attention block is not live." }, { status: 409 });
    }

    if (!/^attention-\d+$/.test(featuredContentAuctionId)) {
      return NextResponse.json({ error: "Invalid featured content ID." }, { status: 400 });
    }
    const approvedContent = await getAttentionContent(featuredContentAuctionId);
    if (!approvedContent?.url || approvedContent.url !== targetUrl) {
      return NextResponse.json({ error: "Invalid attention link." }, { status: 400 });
    }

    const isHouseSponsored = approvedContent.moderationNote.startsWith(
      "House-sponsored post:"
    );
    await recordAttentionEvent({
      auctionId,
      eventType: "link_click",
      featuredContentAuctionId,
      viewerHash: getArtDropClaimIdentity(request).engagementSessionHash,
      targetUrl,
      eventSource: isHouseSponsored ? "house" : "organic",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record link click.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
