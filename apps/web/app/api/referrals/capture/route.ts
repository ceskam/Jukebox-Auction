import { NextResponse } from "next/server";

import { recordReferralVisit } from "../../../../lib/growth";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import {
  createReferralAttributionToken,
  isSameOriginRequest,
  REFERRAL_ATTRIBUTION_COOKIE,
  referralAttributionCookieOptions,
} from "../../../../lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, {
    key: "referral-capture",
    limit: 12,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      code?: string;
      landingPath?: string;
    };
    const code = await recordReferralVisit(
      request,
      String(body.code ?? ""),
      String(body.landingPath ?? "/")
    );
    const response = NextResponse.json({ success: true });
    response.cookies.set(
      REFERRAL_ATTRIBUTION_COOKIE,
      createReferralAttributionToken(code),
      referralAttributionCookieOptions
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Could not record referral.",
      },
      { status: 400 }
    );
  }
}
