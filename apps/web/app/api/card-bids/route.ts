import { getCardBidAccount, getCardBidAvailability, getCardBidFeePercent } from "../../../lib/card-bids";
import { getAuthenticatedUser } from "../../../lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ success: false, message: "Sign in to view card bids." }, { status: 401 });
  try {
    return Response.json({
      success: true,
      user,
      authorizations: await getCardBidAccount(user.id),
      feePercent: getCardBidFeePercent(),
      stripe: getCardBidAvailability(),
    });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Could not load card bids." }, { status: 503 });
  }
}
