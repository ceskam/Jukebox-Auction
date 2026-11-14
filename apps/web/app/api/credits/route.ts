import { getCreditAccount, getCreditFeePercent, getStripeCreditAvailability } from "../../../lib/credits";
import { getAuthenticatedUser } from "../../../lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ success: false, message: "Sign in to view credits." }, { status: 401 });
  try {
    return Response.json({
      success: true,
      user,
      ...(await getCreditAccount(user.id)),
      feePercent: getCreditFeePercent(),
      stripe: getStripeCreditAvailability(),
    });
  } catch (error) {
    return Response.json({ success: false, message: error instanceof Error ? error.message : "Could not load credits." }, { status: 503 });
  }
}
