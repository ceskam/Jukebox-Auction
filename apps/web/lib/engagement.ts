import { createHash, randomBytes } from "node:crypto";

import { getLatestWinnerAttentionContent } from "./attention";
import { createSupabaseServerClient } from "./supabase/server";

export const ENGAGEMENT_COOKIE = "adbidcoin_engagement";
export const MINIMUM_VISIT_MS = 5 * 60 * 1000;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const WINNER_POST_CLICK_WINDOW_MS = 24 * 60 * 60 * 1000;

type EngagementRow = {
  first_seen: string;
  last_seen: string;
  // Legacy database names retained to avoid a destructive production migration.
  // They now store the latest clicked winning-post time and auction ID.
  last_sponsor_click_at: string | null;
  sponsor_auction_id: string;
};

export type EngagementStatus = {
  eligible: boolean;
  visitComplete: boolean;
  winnerPostClickComplete: boolean;
  secondsRemaining: number;
  sessionHash?: string;
  winnerAuctionId?: string;
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
  winnerAuctionId = ""
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
    if (winnerAuctionId) {
      update.last_sponsor_click_at = now;
      update.sponsor_auction_id = winnerAuctionId;
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
      last_sponsor_click_at: winnerAuctionId ? now : null,
      sponsor_auction_id: winnerAuctionId,
    });
    if (insertError) throw new Error(`Could not start engagement session: ${insertError.message}`);
  }
  return { session, isNew: !existing };
}

export async function getEngagementStatus(request: Request): Promise<EngagementStatus> {
  const session = normalizeSession(cookieValue(request));
  if (!session) {
    return { eligible: false, visitComplete: false, winnerPostClickComplete: false, secondsRemaining: 300 };
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_sessions")
    .select("first_seen,last_seen,last_sponsor_click_at,sponsor_auction_id")
    .eq("session_hash", sessionHash(session))
    .maybeSingle<EngagementRow>();
  if (error || !data) {
    return { eligible: false, visitComplete: false, winnerPostClickComplete: false, secondsRemaining: 300 };
  }
  const now = Date.now();
  const elapsed = now - new Date(data.first_seen).getTime();
  const visitComplete = elapsed >= MINIMUM_VISIT_MS;
  const active = now - new Date(data.last_seen).getTime() <= ACTIVE_WINDOW_MS;
  const clickTime = data.last_sponsor_click_at
    ? new Date(data.last_sponsor_click_at).getTime()
    : 0;
  const latestWinnerPost = await getLatestWinnerAttentionContent({ requireUrl: true });
  const winnerPostClickComplete = Boolean(
    latestWinnerPost?.auctionId &&
      data.sponsor_auction_id === latestWinnerPost.auctionId &&
      clickTime &&
      now - clickTime <= WINNER_POST_CLICK_WINDOW_MS
  );
  return {
    sessionHash: sessionHash(session),
    winnerAuctionId: latestWinnerPost?.auctionId,
    eligible: visitComplete && active && winnerPostClickComplete,
    visitComplete,
    winnerPostClickComplete,
    secondsRemaining: Math.max(0, Math.ceil((MINIMUM_VISIT_MS - elapsed) / 1000)),
  };
}

export async function assertArtDropEngagement(request: Request) {
  const status = await getEngagementStatus(request);
  if (!status.visitComplete) {
    throw new Error(`Stay active on AdBidCoin for ${Math.max(1, Math.ceil(status.secondsRemaining / 60))} more minute(s) before claiming.`);
  }
  if (!status.winnerPostClickComplete) {
    throw new Error("Visit the latest winning auction post before claiming this Art Drop.");
  }
  if (!status.eligible) {
    throw new Error("Your active session expired. Keep this page open briefly, then try again.");
  }
  return { sessionHash: status.sessionHash!, winnerAuctionId: status.winnerAuctionId! };
}
