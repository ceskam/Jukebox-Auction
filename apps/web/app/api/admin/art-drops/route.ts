import {
  cancelArtDrop,
  createArtDropNow,
  getArtDropAdminData,
  reconcileArtDrop,
  setArtDropsPaused,
} from "../../../../lib/art-drops";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { hasAdminSession, isSameOriginRequest } from "../../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!hasAdminSession(request)) {
    return Response.json(
      { success: false, message: "Admin token required." },
      { status: 401 }
    );
  }
  try {
    return Response.json({ success: true, ...(await getArtDropAdminData()) });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not load Art Drops. Run database/art-drops.sql first.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }
  if (!hasAdminSession(request)) {
    return Response.json(
      { success: false, message: "Admin token required." },
      { status: 401 }
    );
  }
  const limit = checkRateLimit(request, {
    key: "admin-art-drops",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.resetAt);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.action) {
      case "set_paused":
        await setArtDropsPaused(Boolean(body.paused));
        return Response.json({
          success: true,
          message: Boolean(body.paused) ? "Art Drops paused." : "Art Drops resumed.",
        });
      case "create_now": {
        const result = await createArtDropNow();
        return Response.json({
          ...result,
          message:
            result.action === "daily-limit"
              ? "The rolling 24-hour reward limit has been reached."
              : "A new Art Drop is live.",
        });
      }
      case "cancel":
        await cancelArtDrop(String(body.id ?? ""));
        return Response.json({ success: true, message: "Art Drop cancelled." });
      case "reconcile": {
        const result = await reconcileArtDrop(String(body.id ?? ""));
        return Response.json({
          success: true,
          message: `Confirmed payout ${result.signature} and marked the Art Drop paid.`,
        });
      }
      default:
        return Response.json(
          { success: false, message: "Unknown Art Drop action." },
          { status: 400 }
        );
    }
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Art Drop action failed.",
      },
      { status: 400 }
    );
  }
}
