import { NextResponse } from "next/server";

import { recordAttentionEvent } from "../../../../lib/metrics";
import { getAttentionContent } from "../../../../lib/attention";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { isSameOriginRequest } from "../../../../lib/security";

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
      url?: string;
    };

    const auctionId = String(body.auctionId ?? "");
    const targetUrl = String(body.url ?? "");
    if (!/^attention-\d+$/.test(auctionId)) {
      return NextResponse.json({ error: "Invalid auction ID." }, { status: 400 });
    }

    const approvedContent = await getAttentionContent(auctionId);
    if (!approvedContent?.url || approvedContent.url !== targetUrl) {
      return NextResponse.json({ error: "Invalid attention link." }, { status: 400 });
    }

    await recordAttentionEvent({
      auctionId,
      eventType: "link_click",
      targetUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record link click.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
