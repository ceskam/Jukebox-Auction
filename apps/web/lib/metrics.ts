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

const EMPTY_PLATFORM_METRICS: PlatformMetrics = {
  totalViews: 0,
  totalBidUsdc: 0,
  totalLinkClicks: 0,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function countEvents(eventType: AttentionEventType) {
  try {
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
  } catch (error) {
    console.warn(`Could not load ${eventType} count: ${getErrorMessage(error)}`);
    return 0;
  }
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bids")
      .select("amount_usdc")
      .eq("payment_status", "verified")
      .returns<BidAmountRow[]>();

    if (error) {
      console.warn(`Could not load total bid volume: ${error.message}`);
    }

    const totalBidUsdc = (error ? [] : data ?? []).reduce(
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
  } catch (error) {
    console.warn(`Could not load platform metrics: ${getErrorMessage(error)}`);
    return EMPTY_PLATFORM_METRICS;
  }
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

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("attention_events").insert({
      auction_id: auctionId,
      event_type: eventType,
      wallet,
      target_url: targetUrl,
    });

    if (error) {
      console.warn(`Could not record ${eventType}: ${error.message}`);
    }
  } catch (error) {
    console.warn(`Could not record ${eventType}: ${getErrorMessage(error)}`);
  }
}
