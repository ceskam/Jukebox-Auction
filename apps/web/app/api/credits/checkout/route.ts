export const runtime = "nodejs";

export async function POST() {
  return Response.json({
    success: false,
    message: "Prepaid platform-credit sales have been retired. Use a winner-only card authorization instead.",
  }, { status: 410 });
}
