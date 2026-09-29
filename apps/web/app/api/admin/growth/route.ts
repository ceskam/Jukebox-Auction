import {
  createReferralCode,
  getGrowthAdminData,
  publishOpportunityToTelegram,
  runGrowthScout,
  updateOpportunity,
  updateReward,
  type OpportunityStatus,
  type RewardStatus,
} from "../../../../lib/growth";
import { checkRateLimit, rateLimitResponse } from "../../../../lib/rate-limit";
import { hasAdminSession, isSameOriginRequest } from "../../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminSession(request)) {
    return Response.json({ success: false, message: "Admin token required." }, { status: 401 });
  }

  try {
    return Response.json({ success: true, ...(await getGrowthAdminData()) });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not load Growth Scout. Run database/growth-scout.sql first.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
  if (!hasAdminSession(request)) {
    return Response.json({ success: false, message: "Admin token required." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    key: "admin-growth",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    switch (body.action) {
      case "run_scout": {
        const result = await runGrowthScout();
        return Response.json(result, { status: result.success ? 200 : 503 });
      }
      case "create_referral": {
        const result = await createReferralCode({
          code: String(body.code ?? ""),
          label: String(body.label ?? ""),
          promoterWallet: String(body.promoterWallet ?? ""),
          rewardUsdc: Number(body.rewardUsdc ?? 1),
        });
        return Response.json({
          success: true,
          message: `Referral ${result.code} created.`,
          ...result,
        });
      }
      case "update_opportunity": {
        const status = String(body.status ?? "") as OpportunityStatus;
        if (!["new", "approved", "published", "dismissed"].includes(status)) {
          throw new Error("Invalid opportunity status.");
        }
        await updateOpportunity({
          id: Number(body.id),
          status,
          draftText: String(body.draftText ?? ""),
        });
        return Response.json({ success: true, message: "Opportunity updated." });
      }
      case "publish_telegram": {
        const result = await publishOpportunityToTelegram(
          Number(body.id),
          String(body.draftText ?? "")
        );
        return Response.json({
          success: true,
          message: `Published to the configured Telegram channel${
            result.messageId ? ` as message ${result.messageId}` : ""
          }.`,
        });
      }
      case "update_reward": {
        const status = String(body.status ?? "") as RewardStatus;
        if (!["pending", "approved", "paid", "rejected"].includes(status)) {
          throw new Error("Invalid reward status.");
        }
        await updateReward({
          id: Number(body.id),
          status,
          payoutSignature: String(body.payoutSignature ?? ""),
        });
        return Response.json({ success: true, message: "Reward ledger updated." });
      }
      default:
        return Response.json({ success: false, message: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Growth action failed.",
      },
      { status: 400 }
    );
  }
}
