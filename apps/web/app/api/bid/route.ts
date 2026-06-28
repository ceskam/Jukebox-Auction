import { getBidHistory, getNextAuction, placeBid } from "../../../lib/auction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nextAuction = getNextAuction();

  return Response.json({
    auction: nextAuction,
    bids: getBidHistory(nextAuction.id),
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  const result = placeBid(
    Number(body.amountUsdc ?? body.amount),
    String(body.wallet ?? ""),
    body.paymentSignature ?? null
  );

  return Response.json(result, {
    status: result.success ? 200 : 400,
  });
}
