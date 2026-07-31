import { NextResponse } from "next/server";

import { recordAttentionEvent } from "../../../../lib/metrics";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { isSameOriginRequest } from "../../../../lib/security";

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
    };

    const auctionId = String(body.auctionId ?? "");
    if (!/^attention-\d+$/.test(auctionId)) {
      return NextResponse.json({ error: "Invalid auction ID." }, { status: 400 });
    }

    await recordAttentionEvent({
      auctionId,
      eventType: "page_view",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record page view.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
