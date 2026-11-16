import { getAttentionContent } from "./attention";
import { getAuctionBySequence, getCurrentAuction } from "./auction";
import { createSupabaseServerClient } from "./supabase/server";
import { publishReportToX } from "./x-publishing";

export type AttentionBlockReport = {
  blockAuctionId: string;
  blockSequence: number;
  featuredContentAuctionId: string;
  isRepeat: boolean;
  title: string;
  imageUrl: string;
  winningBidUsdc: number | null;
  startsAt: string;
  endsAt: string;
  impressions: number;
  uniqueViewers: number | null;
  linkClicks: number;
  clickThroughRate: number | null;
  costPerClick: number | null;
  publicationStatus: string;
  xPostId: string;
  retryCount: number;
};

function mapReport(row: any): AttentionBlockReport {
  return {
    blockAuctionId: row.block_auction_id,
    blockSequence: Number(row.block_sequence),
    featuredContentAuctionId: row.featured_content_auction_id,
    isRepeat: Boolean(row.is_repeat),
    title: row.title,
    imageUrl: row.image_url,
    winningBidUsdc: row.winning_bid_usdc === null ? null : Number(row.winning_bid_usdc),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    impressions: Number(row.impressions),
    uniqueViewers: row.unique_viewers === null ? null : Number(row.unique_viewers),
    linkClicks: Number(row.link_clicks),
    clickThroughRate: row.click_through_rate === null ? null : Number(row.click_through_rate),
    costPerClick: row.cost_per_click === null ? null : Number(row.cost_per_click),
    publicationStatus: row.publication_status,
    xPostId: row.x_post_id,
    retryCount: Number(row.retry_count ?? 0),
  };
}

export async function getAttentionBlockReport(auctionId: string) {
  const { data, error } = await createSupabaseServerClient().from("attention_block_reports").select("*").eq("block_auction_id", auctionId).maybeSingle();
  if (error) throw new Error(`Could not load report: ${error.message}`);
  return data ? mapReport(data) : undefined;
}

export async function getRecentAttentionBlockReports(limit = 6) {
  const { data, error } = await createSupabaseServerClient()
    .from("attention_block_reports")
    .select("*")
    .order("ends_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load recent reports: ${error.message}`);
  return (data ?? []).map(mapReport);
}

async function generateReport(sequence: number) {
  const auction = await getAuctionBySequence(sequence);
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase.from("attention_block_reports").select("*").eq("block_auction_id", auction.id).maybeSingle();
  if (existing) return mapReport(existing);
  const { data: events, error } = await supabase
    .from("attention_events")
    .select("event_type,viewer_hash,featured_content_auction_id")
    .eq("auction_id", auction.id);
  if (error) throw new Error(`Could not load block metrics: ${error.message}`);
  const rows = events ?? [];
  const featuredCounts = new Map<string, number>();
  for (const row of rows as any[]) {
    const id = row.featured_content_auction_id ?? "";
    if (id) featuredCounts.set(id, (featuredCounts.get(id) ?? 0) + 1);
  }
  const featuredContentAuctionId = [...featuredCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const content = featuredContentAuctionId ? await getAttentionContent(featuredContentAuctionId) : undefined;
  const metricRows = featuredContentAuctionId
    ? rows.filter((row: any) => row.featured_content_auction_id === featuredContentAuctionId)
    : rows;
  const impressions = metricRows.filter((row: any) => row.event_type === "page_view").length;
  const linkClicks = metricRows.filter((row: any) => row.event_type === "link_click").length;
  const viewerHashes = new Set(metricRows.filter((row: any) => row.event_type === "page_view" && row.viewer_hash).map((row: any) => row.viewer_hash));
  const isRepeat = Boolean(featuredContentAuctionId && featuredContentAuctionId !== auction.id);
  const winningBid = !isRepeat && auction.highestBid > 0 ? auction.highestBid : null;
  const report = {
    block_auction_id: auction.id,
    block_sequence: auction.sequence,
    featured_content_auction_id: featuredContentAuctionId,
    is_repeat: isRepeat,
    title: content?.title ?? "Featured post unavailable",
    image_url: content?.imageUrl ?? "",
    winning_bid_usdc: winningBid,
    starts_at: new Date(auction.startsAt).toISOString(),
    ends_at: new Date(auction.endsAt).toISOString(),
    impressions,
    unique_viewers: viewerHashes.size || null,
    link_clicks: linkClicks,
    click_through_rate: impressions > 0 ? (linkClicks / impressions) * 100 : null,
    cost_per_click: winningBid && linkClicks > 0 ? winningBid / linkClicks : null,
    publication_status: "pending",
  };
  const { data, error: insertError } = await supabase.from("attention_block_reports").insert(report).select("*").single();
  if (insertError?.code === "23505") return getAttentionBlockReport(auction.id);
  if (insertError) throw new Error(`Could not save block report: ${insertError.message}`);
  return mapReport(data);
}

function reportCaption(report: AttentionBlockReport) {
  const ctr = report.clickThroughRate === null ? "CTR unavailable" : `${report.clickThroughRate.toFixed(1)}% CTR`;
  const appearance = report.isRepeat ? "repeat appearance" : "new auction win";
  return `📊 AdBidCoin block #${report.blockSequence}: ${report.title} — ${report.impressions} impressions, ${report.linkClicks} clicks, ${ctr} (${appearance}). Bid for the current block: https://adbidcoin.com/#auction`;
}

async function publishReport(report: AttentionBlockReport) {
  if (process.env.X_REPORTS_ENABLED !== "true" || report.xPostId || report.publicationStatus === "published" || report.publicationStatus === "publishing") return report;
  const supabase = createSupabaseServerClient();
  const { data: claimed, error: claimError } = await supabase
    .from("attention_block_reports")
    .update({ publication_status: "publishing", x_error: "", updated_at: new Date().toISOString() })
    .eq("block_auction_id", report.blockAuctionId)
    .in("publication_status", ["pending", "failed"])
    .eq("x_post_id", "")
    .select("block_auction_id")
    .maybeSingle();
  if (claimError || !claimed) return report;
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adbidcoin.com";
    const xPostId = await publishReportToX({
      caption: reportCaption(report),
      imageUrl: `${siteUrl}/api/reports/${encodeURIComponent(report.blockAuctionId)}/image`,
    });
    const { error } = await supabase.from("attention_block_reports").update({
      publication_status: "published",
      x_post_id: xPostId,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("block_auction_id", report.blockAuctionId).eq("publication_status", "publishing");
    if (error) throw new Error(`X post succeeded but receipt storage failed: ${error.message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "X publication failed";
    // If X accepted the post but saving its receipt failed, keep `publishing`
    // for manual reconciliation rather than risk a duplicate X post.
    if (!message.startsWith("X post succeeded") && !message.startsWith("X post outcome is unknown")) {
      await supabase.from("attention_block_reports").update({
        publication_status: "failed",
        x_error: message.slice(0, 500),
        retry_count: report.retryCount + 1,
        updated_at: new Date().toISOString(),
      }).eq("block_auction_id", report.blockAuctionId).eq("publication_status", "publishing");
    }
  }
  return (await getAttentionBlockReport(report.blockAuctionId)) ?? report;
}

export async function runAttentionReportScheduler() {
  const current = await getCurrentAuction();
  const supabase = createSupabaseServerClient();
  const { data: latestReport, error: latestError } = await supabase
    .from("attention_block_reports")
    .select("block_sequence")
    .order("block_sequence", { ascending: false })
    .limit(1)
    .maybeSingle<{ block_sequence: number | string }>();
  if (latestError) throw new Error(`Could not load the report cursor: ${latestError.message}`);
  const lastSequence = latestReport
    ? Number(latestReport.block_sequence)
    : current.sequence - 2;
  // Catch up after cron or provider outages without flooding a first launch
  // with historical blocks. A one-day bound keeps each run predictable.
  const firstSequence = Math.max(1, lastSequence + 1, current.sequence - 48);
  const sequences = Array.from(
    { length: Math.max(0, current.sequence - firstSequence) },
    (_, index) => firstSequence + index
  );
  const generated: AttentionBlockReport[] = [];
  for (const sequence of sequences) {
    const report = await generateReport(sequence);
    if (report) generated.push(report);
  }
  const { data: retryRows, error } = await supabase
    .from("attention_block_reports")
    .select("*")
    .in("publication_status", ["pending", "failed"])
    .eq("x_post_id", "")
    .order("ends_at", { ascending: true })
    .limit(5);
  if (error) throw new Error(`Could not load report publication queue: ${error.message}`);
  const queue = new Map<string, AttentionBlockReport>();
  for (const report of [...generated, ...(retryRows ?? []).map(mapReport)]) {
    queue.set(report.blockAuctionId, report);
  }
  const results = [];
  for (const report of queue.values()) results.push(await publishReport(report));
  return { success: true, reports: results.map((report) => ({ auctionId: report.blockAuctionId, status: report.publicationStatus, xPostId: report.xPostId })) };
}
