import { claimArtDrop } from "../../../../lib/art-drops";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import {
  getAuthenticatedWallet,
  isSameOriginRequest,
} from "../../../../lib/security";
import { verifyTurnstile } from "../../../../lib/turnstile";
import { assertArtDropEngagement } from "../../../../lib/engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const limit = checkRateLimit(request, {
    key: "art-drop-claim",
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);

  const wallet = getAuthenticatedWallet(request);
  if (!wallet) {
    return Response.json(
      { success: false, message: "Connect and authenticate Phantom before claiming." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    turnstileToken?: string;
  };

  try {
    await verifyTurnstile(request, String(body.turnstileToken ?? ""));
    await assertArtDropEngagement(request);
    const result = await claimArtDrop({
      code: String(body.code ?? ""),
      wallet,
    });
    return Response.json({
      ...result,
      message:
        result.action === "paid"
          ? `${result.rewardUsdc.toFixed(2)} USDC was sent to your connected wallet.`
          : "Your payout was submitted and is awaiting confirmation.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Art Drop claim failed.";
    const retryableConfiguration = /not configured|disabled|paused/i.test(message);
    return Response.json(
      { success: false, message },
      { status: retryableConfiguration ? 503 : 400 }
    );
  }
}
