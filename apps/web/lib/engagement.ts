import { createHash, randomBytes } from "node:crypto";

import { createSupabaseServerClient } from "./supabase/server";

export const ENGAGEMENT_COOKIE = "adbidcoin_engagement";
export const MINIMUM_VISIT_MS = 5 * 60 * 1000;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const SPONSOR_CLICK_WINDOW_MS = 24 * 60 * 60 * 1000;

type EngagementRow = {
  first_seen: string;
  last_seen: string;
  last_sponsor_click_at: string | null;
  sponsor_auction_id: string;
};

export type EngagementStatus = {
  eligible: boolean;
  visitComplete: boolean;
  sponsorClickComplete: boolean;
  secondsRemaining: number;
};

function cookieValue(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${ENGAGEMENT_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function sessionHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeSession(value: string) {
  return /^[A-Za-z0-9_-]{24,96}$/.test(value) ? value : "";
}

export function engagementCookie(value: string) {
  return `${ENGAGEMENT_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
}

export async function touchEngagement(
  request: Request,
  sponsorAuctionId = ""
) {
  const existing = normalizeSession(cookieValue(request));
  const session = existing || randomBytes(24).toString("base64url");
  const hash = sessionHash(session);
  const now = new Date().toISOString();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_sessions")
    .select("first_seen,last_seen,last_sponsor_click_at,sponsor_auction_id")
    .eq("session_hash", hash)
    .maybeSingle<EngagementRow>();
  if (error) throw new Error(`Could not load engagement session: ${error.message}`);

  if (data) {
    const sessionWasInactive =
      Date.now() - new Date(data.last_seen).getTime() > ACTIVE_WINDOW_MS;
    const update: Record<string, string | null> = { last_seen: now, updated_at: now };
    if (sessionWasInactive) {
      update.first_seen = now;
      update.last_sponsor_click_at = null;
      update.sponsor_auction_id = "";
    }
    if (sponsorAuctionId) {
      update.last_sponsor_click_at = now;
      update.sponsor_auction_id = sponsorAuctionId;
    }
    const { error: updateError } = await supabase
      .from("engagement_sessions")
      .update(update)
      .eq("session_hash", hash);
    if (updateError) throw new Error(`Could not update engagement: ${updateError.message}`);
  } else {
    const { error: insertError } = await supabase.from("engagement_sessions").insert({
      session_hash: hash,
      first_seen: now,
      last_seen: now,
      last_sponsor_click_at: sponsorAuctionId ? now : null,
      sponsor_auction_id: sponsorAuctionId,
    });
    if (insertError) throw new Error(`Could not start engagement session: ${insertError.message}`);
  }
  return { session, isNew: !existing };
}

export async function getEngagementStatus(request: Request): Promise<EngagementStatus> {
  const session = normalizeSession(cookieValue(request));
  if (!session) {
    return { eligible: false, visitComplete: false, sponsorClickComplete: false, secondsRemaining: 300 };
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_sessions")
    .select("first_seen,last_seen,last_sponsor_click_at,sponsor_auction_id")
    .eq("session_hash", sessionHash(session))
    .maybeSingle<EngagementRow>();
  if (error || !data) {
    return { eligible: false, visitComplete: false, sponsorClickComplete: false, secondsRemaining: 300 };
  }
  const now = Date.now();
  const elapsed = now - new Date(data.first_seen).getTime();
  const visitComplete = elapsed >= MINIMUM_VISIT_MS;
  const active = now - new Date(data.last_seen).getTime() <= ACTIVE_WINDOW_MS;
  const clickTime = data.last_sponsor_click_at
    ? new Date(data.last_sponsor_click_at).getTime()
    : 0;
  const { data: latestSponsor } = await supabase
    .from("attention_content")
    .select("auction_id")
    .eq("moderation_status", "approved")
    .like("moderation_note", "House-sponsored post:%")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ auction_id: string }>();
  const sponsorClickComplete = Boolean(
    latestSponsor?.auction_id &&
      data.sponsor_auction_id === latestSponsor.auction_id &&
      clickTime &&
      now - clickTime <= SPONSOR_CLICK_WINDOW_MS
  );
  return {
    eligible: visitComplete && active && sponsorClickComplete,
    visitComplete,
    sponsorClickComplete,
    secondsRemaining: Math.max(0, Math.ceil((MINIMUM_VISIT_MS - elapsed) / 1000)),
  };
}

export async function assertArtDropEngagement(request: Request) {
  const status = await getEngagementStatus(request);
  if (!status.visitComplete) {
    throw new Error(`Stay active on AdBidCoin for ${Math.max(1, Math.ceil(status.secondsRemaining / 60))} more minute(s) before claiming.`);
  }
  if (!status.sponsorClickComplete) {
    throw new Error("Visit the latest sponsored post before claiming this Art Drop.");
  }
  if (!status.eligible) {
    throw new Error("Your active session expired. Keep this page open briefly, then try again.");
  }
}
