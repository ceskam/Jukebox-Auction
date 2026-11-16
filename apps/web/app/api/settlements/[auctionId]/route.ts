import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await context.params;
  if (!/^attention-\d+$/.test(auctionId)) return Response.json({ success: false, message: "Invalid auction ID." }, { status: 400 });
  const supabase = createSupabaseServerClient();
  const [{ data: settlement, error }, { data: walletReceipts, error: walletError }] = await Promise.all([
    supabase.from("auction_settlement_receipts").select("*").eq("auction_id", auctionId).maybeSingle(),
    supabase
      .from("wallet_bid_escrows")
      .select("wallet,amount_usdc,status,deposit_signature,settlement_signature")
      .eq("auction_id", auctionId)
      .in("status", ["settled", "refunded"])
      .order("created_at", { ascending: true }),
  ]);
  if (error || walletError) return Response.json({ success: false, message: "Settlement receipts are unavailable." }, { status: 503 });
  return Response.json({ success: true, auctionId, settlement: settlement ?? null, walletReceipts: walletReceipts ?? [] }, { headers: { "Cache-Control": "public, max-age=30" } });
}
