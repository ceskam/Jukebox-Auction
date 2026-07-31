import { NextResponse } from "next/server";

import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
  hasAdminSession,
  isSameOriginRequest,
  verifyAdminToken,
} from "../../../../lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: hasAdminSession(request) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    key: "admin-login",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
  };

  if (!verifyAdminToken(String(body.token ?? ""))) {
    return NextResponse.json(
      { success: false, message: "Invalid admin token." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true, authenticated: true });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(),
    adminSessionCookieOptions
  );
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
