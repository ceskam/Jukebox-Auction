import { timingSafeEqual } from "node:crypto";
import { runAttentionReportScheduler } from "../../../../lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const valid = secret.length >= 32 && Buffer.byteLength(supplied) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) return Response.json({ success: false }, { status: 401 });
  try {
    return Response.json(await runAttentionReportScheduler(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Attention report scheduler failed.", error);
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Report scheduler failed." }, { status: 500 });
  }
}
