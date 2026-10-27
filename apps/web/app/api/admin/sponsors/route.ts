import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { hasAdminSession, isSameOriginRequest } from "../../../../lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminSession(request)) return Response.json({ success: false }, { status: 401 });
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sponsor_orders")
    .select("id,wallet,plan_code,amount_usdc,minimum_placements,sponsor_name,title,description,url,image_url,contact,status,payment_signature,starts_at,ends_at,last_featured_at,created_at,sponsor_placements(count)")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 });
  return Response.json({ success: true, orders: data ?? [] });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ success: false }, { status: 403 });
  if (!hasAdminSession(request)) return Response.json({ success: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (!["active", "paused", "rejected"].includes(status)) {
    return Response.json({ success: false, message: "Invalid sponsor status." }, { status: 400 });
  }
  const now = new Date();
  const update: Record<string, string> = { status, updated_at: now.toISOString() };
  if (status === "active") {
    update.starts_at = now.toISOString();
    update.ends_at = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  }
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("sponsor_orders").update(update).eq("id", String(body.id ?? ""));
  if (error) return Response.json({ success: false, message: error.message }, { status: 400 });
  return Response.json({ success: true, message: `Sponsor package ${status}.` });
}
