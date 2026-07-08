import {
  getRecentAttentionContent,
  moderateAttentionContent,
} from "../../../../lib/attention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  const requestToken = request.headers.get("x-admin-token");

  return Boolean(adminToken && requestToken && requestToken === adminToken);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
  if (!isAuthorized(request)) {
    return Response.json(
      { success: false, message: "Admin token required." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const status = String(body.status ?? "");

  if (status !== "approved" && status !== "hidden" && status !== "rejected") {
    return Response.json(
      { success: false, message: "Choose approved, hidden, or rejected." },
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
