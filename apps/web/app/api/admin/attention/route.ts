import {
  getRecentAttentionContent,
  moderateAttentionContent,
} from "../../../../lib/attention";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import {
  hasAdminSession,
  isSameOriginRequest,
} from "../../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminSession(request)) {
    return Response.json(
      { success: false, message: "Admin token required." },
      { status: 401 }
    );
  }

  return Response.json({
    success: true,
    content: await getRecentAttentionContent(),
  });
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

  const rateLimit = checkRateLimit(request, {
    key: "admin-moderation",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = await request.json();
  const status = String(body.status ?? "");

  if (
    status !== "pending" &&
    status !== "approved" &&
    status !== "hidden" &&
    status !== "rejected"
  ) {
    return Response.json(
      { success: false, message: "Choose pending, approved, hidden, or rejected." },
      { status: 400 }
    );
  }

  const result = await moderateAttentionContent({
    auctionId: String(body.auctionId ?? ""),
    status,
    note: String(body.note ?? ""),
    reviewedBy: "admin",
  });

  return Response.json(result, {
    status: result.success ? 200 : 400,
  });
}
