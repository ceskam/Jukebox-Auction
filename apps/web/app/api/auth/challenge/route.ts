import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import {
  createWalletChallenge,
  isSameOriginRequest,
  WALLET_CHALLENGE_COOKIE,
  walletChallengeCookieOptions,
} from "../../../../lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    key: "wallet-challenge",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => ({}))) as {
    wallet?: string;
  };
  const wallet = String(body.wallet ?? "");

  try {
    const normalizedWallet = new PublicKey(wallet).toBase58();

    if (normalizedWallet !== wallet) {
      throw new Error("Wallet address is not normalized.");
    }

    const challenge = createWalletChallenge(wallet);
    const response = NextResponse.json({
      success: true,
      message: challenge.message,
    });

    response.cookies.set(
      WALLET_CHALLENGE_COOKIE,
      challenge.token,
      walletChallengeCookieOptions
    );

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "Use a valid Solana wallet address." },
      { status: 400 }
    );
  }
}
