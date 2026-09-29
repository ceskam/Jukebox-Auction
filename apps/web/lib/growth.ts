import { createHmac, randomBytes } from "node:crypto";
import { PublicKey } from "@solana/web3.js";

import { getReferralAttribution } from "./security";
import { createSupabaseServerClient } from "./supabase/server";

export type OpportunityStatus = "new" | "approved" | "published" | "dismissed";
export type PolicyRisk = "low" | "opt_in_only" | "manual_review" | "do_not_post";
export type RewardStatus = "pending" | "approved" | "paid" | "rejected";

export type GrowthOpportunity = {
  id: number;
  source: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  searchQuery: string;
  relevanceScore: number;
  policyRisk: PolicyRisk;
  status: OpportunityStatus;
  draftText: string;
  telegramMessageId: string;
  discoveredAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

type SearchResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
};

type OpportunityRow = {
  id: number;
  source: string;
  source_url: string;
  title: string;
  excerpt: string;
  search_query: string;
  relevance_score: number;
  policy_risk: PolicyRisk;
  status: OpportunityStatus;
  draft_text: string;
  telegram_message_id: string;
  discovered_at: string;
  reviewed_at: string | null;
  published_at: string | null;
};

const DEFAULT_QUERIES = [
  '"where to promote" Solana project',
  '"crypto marketing" Solana community',
  '"launching a token" Solana',
  '"promote my token" crypto',
];

const HIGH_INTENT_TERMS = [
  "advertise",
  "attention",
  "community",
  "launch",
  "marketing",
  "promote",
  "promotion",
  "solana",
  "sponsor",
  "token",
];

function clampText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function parseHttpsUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:") return undefined;
    if (url.hostname === "adbidcoin.com" || url.hostname.endsWith(".adbidcoin.com")) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function getSourceAndRisk(url: URL): { source: string; risk: PolicyRisk } {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "x.com" || host === "twitter.com") {
    return { source: "X", risk: "manual_review" };
  }
  if (host === "reddit.com" || host.endsWith(".reddit.com")) {
    return { source: "Reddit", risk: "manual_review" };
  }
  if (host === "discord.com" || host === "discord.gg") {
    return { source: "Discord", risk: "opt_in_only" };
  }
  if (host === "t.me" || host === "telegram.me") {
    return { source: "Telegram", risk: "opt_in_only" };
  }

  return { source: host, risk: "manual_review" };
}

function scoreOpportunity(result: SearchResult, url: URL) {
  const text = `${result.title ?? ""} ${result.description ?? ""}`.toLowerCase();
  const matchedTerms = HIGH_INTENT_TERMS.filter((term) => text.includes(term));
  const sourceBonus = /^(x\.com|twitter\.com|reddit\.com|t\.me|telegram\.me|discord\.com|discord\.gg)$/.test(
    url.hostname.replace(/^www\./, "").toLowerCase()
  )
    ? 10
    : 0;
  const questionBonus = /\b(how|where|best|recommend|looking for|need)\b/.test(text)
    ? 12
    : 0;
  const recentBonus = result.age ? 8 : 0;

  return Math.min(100, 28 + matchedTerms.length * 7 + sourceBonus + questionBonus + recentBonus);
}

function buildDraft(title: string, source: string) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://adbidcoin.com").replace(
    /\/$/,
    ""
  );
  const campaignUrl = new URL(siteUrl);
  campaignUrl.searchParams.set("utm_source", source.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  campaignUrl.searchParams.set("utm_medium", "community");
  campaignUrl.searchParams.set("utm_campaign", "growth_scout");

  return [
    `This may be useful for the discussion around “${clampText(title, 90)}.”`,
    "AdBidCoin is a live 30-minute attention auction where verified bidders compete for homepage placement using USDC on Solana. QUIET holders can receive additional bid power.",
    `Live auction: ${campaignUrl.toString()}`,
    "Sponsored link from AdBidCoin. Please remove if it is not welcome here.",
  ].join("\n\n");
}

function mapOpportunity(row: OpportunityRow): GrowthOpportunity {
  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    excerpt: row.excerpt,
    searchQuery: row.search_query,
    relevanceScore: row.relevance_score,
    policyRisk: row.policy_risk,
    status: row.status,
    draftText: row.draft_text,
    telegramMessageId: row.telegram_message_id,
    discoveredAt: row.discovered_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
  };
}

export async function runGrowthScout() {
  if (process.env.GROWTH_SCOUT_ENABLED !== "true") {
    return {
      success: true,
      skipped: true,
      message: "Growth Scout is disabled.",
      found: 0,
      saved: 0,
    };
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      message: "BRAVE_SEARCH_API_KEY is not configured.",
      found: 0,
      saved: 0,
    };
  }

  const queries = (process.env.GROWTH_SCOUT_QUERIES ?? "")
    .split("||")
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, 8);
  const activeQueries = queries.length > 0 ? queries : DEFAULT_QUERIES;
  const candidates: Array<Record<string, unknown>> = [];

  for (const query of activeQueries) {
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("count", "10");
    endpoint.searchParams.set("freshness", "pw");
    endpoint.searchParams.set("search_lang", "en");
    endpoint.searchParams.set("country", "US");

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}.`);
    }

    const body = (await response.json()) as { web?: { results?: SearchResult[] } };
    for (const result of body.web?.results ?? []) {
      const url = parseHttpsUrl(result.url);
      if (!url) continue;
      const title = clampText(result.title, 240);
      if (!title) continue;
      const { source, risk } = getSourceAndRisk(url);
      const score = scoreOpportunity(result, url);
      if (score < 45) continue;

      candidates.push({
        source,
        source_url: url.toString().slice(0, 2_000),
        title,
        excerpt: clampText(result.description, 1_000),
        search_query: query,
        relevance_score: score,
        policy_risk: risk,
        status: "new",
        draft_text: buildDraft(title, source),
        discovered_at: new Date().toISOString(),
      });
    }
  }

  const uniqueCandidates = Array.from(
    new Map(candidates.map((candidate) => [candidate.source_url, candidate])).values()
  );

  if (uniqueCandidates.length === 0) {
    return { success: true, message: "No new high-intent results found.", found: 0, saved: 0 };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("growth_opportunities")
    .upsert(uniqueCandidates, { onConflict: "source_url", ignoreDuplicates: true })
    .select("id");

  if (error) throw new Error(`Could not save scout results: ${error.message}`);

  return {
    success: true,
    message: `Scout reviewed ${uniqueCandidates.length} relevant results.`,
    found: uniqueCandidates.length,
    saved: data?.length ?? 0,
  };
}

export async function getGrowthAdminData() {
  const supabase = createSupabaseServerClient();
  const [opportunitiesResult, codesResult, conversionsResult, visitCountResult] =
    await Promise.all([
      supabase
        .from("growth_opportunities")
        .select(
          "id, source, source_url, title, excerpt, search_query, relevance_score, policy_risk, status, draft_text, telegram_message_id, discovered_at, reviewed_at, published_at"
        )
        .order("relevance_score", { ascending: false })
        .order("discovered_at", { ascending: false })
        .limit(100),
      supabase
        .from("referral_codes")
        .select("id, code, label, promoter_wallet, reward_usdc, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("referral_conversions")
        .select(
          "id, referral_code, referred_wallet, bid_id, reward_usdc, status, payout_signature, converted_at, reviewed_at, paid_at"
        )
        .order("converted_at", { ascending: false })
        .limit(100),
      supabase.from("referral_visits").select("*", { count: "exact", head: true }),
    ]);

  const firstError = [
    opportunitiesResult.error,
    codesResult.error,
    conversionsResult.error,
    visitCountResult.error,
  ].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  return {
    opportunities: ((opportunitiesResult.data ?? []) as OpportunityRow[]).map(
      mapOpportunity
    ),
    referralCodes: (codesResult.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      promoterWallet: row.promoter_wallet,
      rewardUsdc: Number(row.reward_usdc),
      status: row.status,
      createdAt: row.created_at,
    })),
    conversions: (conversionsResult.data ?? []).map((row) => ({
      id: row.id,
      referralCode: row.referral_code,
      referredWallet: row.referred_wallet,
      bidId: row.bid_id,
      rewardUsdc: Number(row.reward_usdc),
      status: row.status,
      payoutSignature: row.payout_signature,
      convertedAt: row.converted_at,
      reviewedAt: row.reviewed_at,
      paidAt: row.paid_at,
    })),
    stats: {
      visits: visitCountResult.count ?? 0,
      pendingRewards: (conversionsResult.data ?? []).filter(
        (row) => row.status === "pending"
      ).length,
      approvedRewardUsdc: (conversionsResult.data ?? [])
        .filter((row) => row.status === "approved")
        .reduce((total, row) => total + Number(row.reward_usdc), 0),
    },
  };
}

export async function createReferralCode(input: {
  code?: string;
  label: string;
  promoterWallet?: string;
  rewardUsdc: number;
}) {
  const label = clampText(input.label, 100);
  const suppliedCode = String(input.code ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const code = (suppliedCode || `${label.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${randomBytes(3).toString("hex").toUpperCase()}`)
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const promoterWallet = clampText(input.promoterWallet, 64);
  const rewardUsdc = Math.round(Number(input.rewardUsdc) * 100) / 100;

  if (!label || code.length < 3 || !Number.isFinite(rewardUsdc) || rewardUsdc < 0 || rewardUsdc > 25) {
    throw new Error("Use a label, a 3-character code, and a reward from 0 to 25 USDC.");
  }
  if (rewardUsdc > 0) {
    try {
      new PublicKey(promoterWallet);
    } catch {
      throw new Error("A valid Solana payout wallet is required for a paid referral.");
    }
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("referral_codes").insert({
    code,
    label,
    promoter_wallet: promoterWallet,
    reward_usdc: rewardUsdc,
    status: "active",
  });
  if (error) throw new Error(`Could not create referral code: ${error.message}`);

  return { code };
}

export async function updateOpportunity(input: {
  id: number;
  status: OpportunityStatus;
  draftText?: string;
}) {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new Error("Invalid opportunity ID.");
  }
  const update: Record<string, unknown> = {
    status: input.status,
    reviewed_at: new Date().toISOString(),
  };
  if (typeof input.draftText === "string") {
    update.draft_text = clampText(input.draftText, 4_000);
  }
  if (input.status === "published") update.published_at = new Date().toISOString();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("growth_opportunities")
    .update(update)
    .eq("id", input.id);
  if (error) throw new Error(`Could not update opportunity: ${error.message}`);
}

export async function updateReward(input: {
  id: number;
  status: RewardStatus;
  payoutSignature?: string;
}) {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) {
    throw new Error("Invalid reward ID.");
  }
  const payoutSignature = clampText(input.payoutSignature, 128);
  if (
    input.status === "paid" &&
    (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(payoutSignature) || payoutSignature.length < 64)
  ) {
    throw new Error("Add the Solana payout signature before marking a reward paid.");
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: input.status,
    reviewed_at: now,
    payout_signature: input.status === "paid" ? payoutSignature : "",
    paid_at: input.status === "paid" ? now : null,
  };
  const supabase = createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("referral_conversions")
    .select("status, payout_signature")
    .eq("id", input.id)
    .maybeSingle<{ status: RewardStatus; payout_signature: string }>();
  if (readError || !existing) throw new Error("Reward was not found.");
  if (existing.status === "paid") {
    if (input.status === "paid" && existing.payout_signature === payoutSignature) return;
    throw new Error("A paid reward is locked and cannot be changed.");
  }
  if (input.status === "paid" && existing.status !== "approved") {
    throw new Error("Approve the reward before recording its payout.");
  }
  const { error } = await supabase
    .from("referral_conversions")
    .update(update)
    .eq("id", input.id);
  if (error) throw new Error(`Could not update reward: ${error.message}`);
}

export async function publishOpportunityToTelegram(id: number, draftText?: string) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid opportunity ID.");
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_GROWTH_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram bot settings are not configured.");

  const supabase = createSupabaseServerClient();
  if (typeof draftText === "string") {
    await updateOpportunity({ id, status: "approved", draftText });
  }
  const { data, error } = await supabase
    .from("growth_opportunities")
    .select("draft_text")
    .eq("id", id)
    .maybeSingle<{ draft_text: string }>();
  if (error || !data?.draft_text) throw new Error("Opportunity draft was not found.");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: data.draft_text.slice(0, 4_096),
      disable_web_page_preview: false,
    }),
    cache: "no-store",
  });
  const result = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };
  if (!response.ok || !result.ok) {
    throw new Error(result.description ?? `Telegram returned ${response.status}.`);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("growth_opportunities")
    .update({
      status: "published",
      telegram_message_id: String(result.result?.message_id ?? ""),
      reviewed_at: now,
      published_at: now,
    })
    .eq("id", id);
  if (updateError) throw new Error(`Telegram posted, but status update failed: ${updateError.message}`);

  return { messageId: result.result?.message_id ?? null };
}

function getVisitorHash(request: Request) {
  const secret = process.env.WALLET_AUTH_SECRET ?? process.env.ADMIN_TOKEN ?? "";
  if (secret.length < 32) throw new Error("A strong server signing secret is required.");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = clampText(request.headers.get("user-agent"), 300);
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", secret)
    .update(`${day}|${forwarded}|${userAgent}`)
    .digest("hex");
}

export async function recordReferralVisit(request: Request, code: string, landingPath: string) {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("code", normalizedCode)
    .eq("status", "active")
    .maybeSingle<{ code: string }>();
  if (error || !data) throw new Error("Referral code is not active.");

  const visitorHash = getVisitorHash(request);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("referral_visits")
    .select("id")
    .eq("referral_code", normalizedCode)
    .eq("visitor_hash", visitorHash)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle<{ id: number }>();

  if (!existing) {
    const { error: insertError } = await supabase.from("referral_visits").insert({
      referral_code: normalizedCode,
      visitor_hash: visitorHash,
      landing_path: clampText(landingPath || "/", 500),
    });
    if (insertError) throw new Error(`Could not record referral: ${insertError.message}`);
  }

  return normalizedCode;
}

export async function recordReferralConversion(
  request: Request,
  wallet: string,
  paymentSignature: string
) {
  const attribution = getReferralAttribution(request);
  if (!attribution?.code || !paymentSignature) return;

  const supabase = createSupabaseServerClient();
  const [{ data: code }, { data: bid }] = await Promise.all([
    supabase
      .from("referral_codes")
      .select("code, reward_usdc, promoter_wallet")
      .eq("code", attribution.code)
      .eq("status", "active")
      .maybeSingle<{
        code: string;
        reward_usdc: number | string;
        promoter_wallet: string;
      }>(),
    supabase
      .from("bids")
      .select("id, payment_signature, amount_usdc")
      .eq("wallet", wallet)
      .eq("payment_status", "verified")
      .eq("bid_source", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: number;
        payment_signature: string;
        amount_usdc: number | string;
      }>(),
  ]);

  if (!code || !bid || bid.payment_signature !== paymentSignature) return;
  if (code.promoter_wallet && code.promoter_wallet === wallet) return;
  const minimumFirstBid = Math.max(
    0.25,
    Number(process.env.REFERRAL_MIN_FIRST_BID_USDC ?? 1)
  );
  if (!Number.isFinite(minimumFirstBid) || Number(bid.amount_usdc) < minimumFirstBid) {
    return;
  }

  const { error } = await supabase.from("referral_conversions").insert({
    referral_code: code.code,
    referred_wallet: wallet,
    bid_id: bid.id,
    reward_usdc: Number(code.reward_usdc),
    status: "pending",
  });
  if (error && error.code !== "23505") {
    console.warn(`Could not record referral conversion: ${error.message}`);
  }
}
