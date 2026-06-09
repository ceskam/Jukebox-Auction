import { currentAuction } from "../../../lib/auction";

export async function GET() {
  return Response.json(currentAuction);
}
