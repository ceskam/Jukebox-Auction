import { NextResponse } from "next/server";

import { recordAttentionEvent } from "../../../../lib/metrics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      auctionId?: string;
      url?: string;
    };

    await recordAttentionEvent({
      auctionId: body.auctionId ?? "",
      eventType: "link_click",
      targetUrl: body.url ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not record link click.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
