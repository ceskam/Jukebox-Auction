export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { success: false, message: "House sponsorship packages are disabled." },
    { status: 410 }
  );
}

export async function POST() {
  return Response.json(
    { success: false, message: "House sponsorship packages are disabled." },
    { status: 410 }
  );
}
