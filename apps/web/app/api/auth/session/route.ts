import { NextResponse } from "next/server";

import {
  getAuthenticatedWallet,
  isSameOriginRequest,
  WALLET_SESSION_COOKIE,
  walletSessionCookieOptions,
} from "../../../../lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const wallet = getAuthenticatedWallet(request);
  return NextResponse.json({ authenticated: Boolean(wallet), wallet });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(WALLET_SESSION_COOKIE, "", {
    ...walletSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
