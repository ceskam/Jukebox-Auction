import { createSupabaseServerClient } from "./supabase/server";

export type AttentionEventType = "page_view" | "link_click";

type BidAmountRow = {
  amount_usdc: number | string | null;
};

export type PlatformMetrics = {
  totalViews: number;
  totalBidUsdc: number;
  totalLinkClicks: number;
};

async function countEvents(eventType: AttentionEventType) {
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("attention_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType);

  if (error) {
    console.warn(`Could not load ${eventType} count: ${error.message}`);
    return 0;
  }

  return count ?? 0;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select("amount_usdc")
    .eq("payment_status", "verified")
    .returns<BidAmountRow[]>();

  if (error) {
    throw new Error(`Could not load total bid volume: ${error.message}`);
  }

  const totalBidUsdc = (data ?? []).reduce(
    (total, bid) => total + Number(bid.amount_usdc ?? 0),
    0
  );

  const [totalViews, totalLinkClicks] = await Promise.all([
    countEvents("page_view"),
    countEvents("link_click"),
  ]);

  return {
    totalViews,
    totalBidUsdc,
    totalLinkClicks,
  };
}

export async function recordAttentionEvent({
  auctionId,
  eventType,
  wallet = "",
  targetUrl = "",
}: {
  auctionId: string;
  eventType: AttentionEventType;
  wallet?: string;
  targetUrl?: string;
}) {
  if (!auctionId) {
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("attention_events").insert({
    auction_id: auctionId,
    event_type: eventType,
    wallet,
    target_url: targetUrl,
  });

  if (error) {
    throw new Error(`Could not record ${eventType}: ${error.message}`);
  }
}
