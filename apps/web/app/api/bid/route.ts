import { placeBid } from "../../../lib/auction";

export async function POST() {
  const result = placeBid(
    Math.floor(Math.random() * 100) + 1,
    "demo-wallet"
  );

  return Response.json(result);
}
