import { getCurrentAuction } from "../../../../lib/auction";

export async function GET() {
  return Response.json(getCurrentAuction());
}
