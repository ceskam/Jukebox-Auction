import { runGrowthScout } from "../../../../lib/growth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return Response.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runGrowthScout();
    return Response.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    console.error("Growth Scout failed.", error);
    return Response.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Growth Scout failed.",
      },
      { status: 500 }
    );
  }
}
