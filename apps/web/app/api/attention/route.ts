import {
  getAttentionContent,
  saveAttentionContent,
} from "../../../lib/attention";

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
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const image = form.get("image");

    const result = await saveAttentionContent({
      auctionId: String(form.get("auctionId") ?? ""),
      wallet: String(form.get("wallet") ?? ""),
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
    wallet: String(body.wallet ?? ""),
    title: String(body.title ?? ""),
    description: String(body.description ?? ""),
    url: String(body.url ?? ""),
    imageUrl: String(body.imageUrl ?? ""),
  });

  return Response.json(result, {
    status: result.success ? 200 : 403,
  });
}
