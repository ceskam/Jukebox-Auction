import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import nacl from "tweetnacl";

import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import {
  buildWalletChallengeMessage,
  createWalletSessionToken,
  getWalletChallenge,
  isSameOriginRequest,
  WALLET_CHALLENGE_COOKIE,
  WALLET_SESSION_COOKIE,
  walletSessionCookieOptions,
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
    key: "wallet-verify",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => ({}))) as {
    wallet?: string;
    signature?: string;
  };
  const wallet = String(body.wallet ?? "");
  const challenge = getWalletChallenge(request);

  if (!challenge || challenge.wallet !== wallet) {
    return NextResponse.json(
      {
        success: false,
        message: "Wallet authentication expired. Please connect again.",
      },
      { status: 401 }
    );
  }

  try {
    const message = new TextEncoder().encode(
      buildWalletChallengeMessage(challenge)
    );
    const signature = Buffer.from(String(body.signature ?? ""), "base64");
    const publicKey = new PublicKey(wallet).toBytes();

    if (
      signature.length !== nacl.sign.signatureLength ||
      !nacl.sign.detached.verify(message, signature, publicKey)
    ) {
      throw new Error("Invalid wallet signature.");
    }

    const response = NextResponse.json({ success: true, wallet });
    response.cookies.set(
      WALLET_SESSION_COOKIE,
      createWalletSessionToken(wallet),
      walletSessionCookieOptions
    );
    response.cookies.set(WALLET_CHALLENGE_COOKIE, "", {
      ...walletSessionCookieOptions,
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not verify wallet ownership." },
      { status: 401 }
    );
  }
}
