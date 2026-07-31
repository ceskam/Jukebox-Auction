import {
  getAttentionContent,
  saveAttentionContent,
} from "../../../lib/attention";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rate-limit";
import {
  getAuthenticatedWallet,
  isSameOriginRequest,
} from "../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const auctionId = searchParams.get("auctionId");

  if (!auctionId) {
    return Response.json(null);
  }

  return Response.json((await getAttentionContent(auctionId)) ?? null);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { success: false, message: "Invalid request origin." },
      { status: 403 }
    );
  }

  const authenticatedWallet = getAuthenticatedWallet(request);

  if (!authenticatedWallet) {
    return Response.json(
      {
        success: false,
        message: "Reconnect and sign with the winning wallet before publishing.",
      },
      { status: 401 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    key: "attention-submit",
    limit: 12,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 6 * 1024 * 1024) {
    return Response.json(
      { success: false, message: "Submission is too large." },
      { status: 413 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const image = form.get("image");

    const result = await saveAttentionContent({
      auctionId: String(form.get("auctionId") ?? ""),
      wallet: authenticatedWallet,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      url: String(form.get("url") ?? ""),
      imageUrl: String(form.get("imageUrl") ?? ""),
      imageFile: image instanceof File ? image : null,
    });

    return Response.json(result, {
      status: result.success ? 200 : 403,
    });
  }

  const body = await request.json();
  const result = await saveAttentionContent({
    auctionId: String(body.auctionId ?? ""),
    wallet: authenticatedWallet,
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    url: String(body.url ?? ""),
    imageUrl: String(body.imageUrl ?? ""),
  });

  return Response.json(result, {
    status: result.success ? 200 : 403,
  });
}
