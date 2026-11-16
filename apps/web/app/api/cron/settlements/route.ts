import { timingSafeEqual } from "node:crypto";
import { runAuctionSettlementScheduler } from "../../../../lib/settlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const valid = secret.length >= 32 && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) return Response.json({ success: false }, { status: 401 });
  if (process.env.WINNER_ONLY_AUCTIONS_ENABLED !== "true") {
    return Response.json({ success: true, enabled: false, processed: 0 });
  }
  try {
    return Response.json(await runAuctionSettlementScheduler(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Auction settlement scheduler failed.", error);
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Settlement scheduler failed." }, { status: 500 });
  }
}
