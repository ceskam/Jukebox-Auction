import { placeBid } from "../../../lib/auction";

export async function POST(request: Request) {
  const body = await request.json();

  const result = placeBid(
    Number(body.amount),
    body.wallet || "demo-wallet"
  );

  return Response.json(result);
}
