import { NextResponse } from "next/server";

import { recordAttentionEvent } from "../../../../lib/metrics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      auctionId?: string;
    };

    await recordAttentionEvent({
      auctionId: body.auctionId ?? "",
      eventType: "page_view",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record page view.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
