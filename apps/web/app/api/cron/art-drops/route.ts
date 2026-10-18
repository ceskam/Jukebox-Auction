import { timingSafeEqual } from "node:crypto";

import { runArtDropScheduler } from "../../../../lib/art-drops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return Boolean(
    secret.length >= 32 &&
      suppliedBytes.length === expectedBytes.length &&
      timingSafeEqual(suppliedBytes, expectedBytes)
  );
}
export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return Response.json({ success: false }, { status: 401 });
  }
  try {
    return Response.json(await runArtDropScheduler(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Art Drop scheduler failed.", error);
    return Response.json(
      { success: false, action: "error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
