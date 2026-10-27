import { NextResponse } from "next/server";

import {
  engagementCookie,
  getEngagementStatus,
  touchEngagement,
} from "../../../lib/engagement";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import { isSameOriginRequest } from "../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const limit = checkRateLimit(request, { key: "engagement", limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);
  try {
    const result = await touchEngagement(request);
    const response = NextResponse.json({ success: true });
    if (result.isNew) response.headers.set("Set-Cookie", engagementCookie(result.session));
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Engagement tracking failed." },
      { status: 503 }
    );
  }
}

export async function GET(request: Request) {
  return NextResponse.json(await getEngagementStatus(request));
}
