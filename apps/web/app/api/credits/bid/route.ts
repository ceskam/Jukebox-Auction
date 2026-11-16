export const runtime = "nodejs";

export async function POST() {
  return Response.json({
    success: false,
    message: "Prepaid credit bidding has been retired. Existing balances require administrator reconciliation.",
  }, { status: 410 });
}
