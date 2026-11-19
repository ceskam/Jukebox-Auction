import { getMinimumBidUsdc, MIN_CARD_BID_USD } from "./bid-rules";
import { getNextAuction } from "./auction";
import { createSupabaseServerClient } from "./supabase/server";
import { stripePost } from "./stripe";

const MAX_CARD_BID_USD = 2_000;

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

export function getCardBidFeePercent() {
  return Math.max(0, Math.min(25, numberEnv("CARD_BID_FEE_PERCENT", 0)));
}

export function getCardBidAvailability() {
  const winnerOnlyEnabled = process.env.WINNER_ONLY_AUCTIONS_ENABLED === "true";
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const testMode = key.startsWith("sk_test_");
  const liveMode = key.startsWith("sk_live_");
  const approvalConfirmed = process.env.STRIPE_APPROVAL_CONFIRMED === "true";
  const enabled = process.env.STRIPE_CARD_BIDS_ENABLED === "true";
  return {
    enabled: winnerOnlyEnabled && enabled && Boolean(key) && (testMode || (liveMode && approvalConfirmed)),
    testMode,
    liveMode,
    approvalConfirmed,
    reason: !winnerOnlyEnabled
      ? "Winner-only auctions are not enabled."
      : !enabled
      ? "Card bid authorizations are not enabled."
      : !key
        ? "Stripe is not configured."
        : liveMode && !approvalConfirmed
          ? "Live card bidding requires documented Stripe account clearance for this exact winner-only auction flow."
          : "",
  };
}

export function quoteCardBid(amountInput: number) {
  const bidValueUsdc = Math.round(amountInput * 100) / 100;
  if (!Number.isFinite(bidValueUsdc) || bidValueUsdc < MIN_CARD_BID_USD || bidValueUsdc > MAX_CARD_BID_USD) {
    throw new Error(`Choose a card bid from ${MIN_CARD_BID_USD.toFixed(2)} to ${MAX_CARD_BID_USD.toLocaleString()} USD.`);
  }
  const feeUsd = Math.round(bidValueUsdc * getCardBidFeePercent()) / 100;
  return {
    amountUsd: bidValueUsdc,
    feeUsd,
    totalAuthorizedUsd: Math.round((bidValueUsdc + feeUsd) * 100) / 100,
    bidValueUsdc,
  };
}

export async function getCardBidAccount(userId: string) {
  if (process.env.WINNER_ONLY_AUCTIONS_ENABLED !== "true") return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("card_bid_authorizations")
    .select("id,auction_id,amount_usd,fee_usd,bid_value_usdc,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(`Could not load card bids: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    auctionId: row.auction_id,
    amountUsd: Number(row.amount_usd),
    feeUsd: Number(row.fee_usd),
    bidValueUsdc: Number(row.bid_value_usdc),
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function createCardBidCheckout({
  userId,
  email,
  amount,
  auctionId,
  origin,
}: {
  userId: string;
  email: string;
  amount: number;
  auctionId: string;
  origin: string;
}) {
  const availability = getCardBidAvailability();
  if (!availability.enabled) throw new Error(availability.reason);
  const quote = quoteCardBid(amount);
  const nextAuction = await getNextAuction();
  if (auctionId !== nextAuction.id) throw new Error("That auction has closed. Refresh and try again.");
  const minimum = Math.max(
    MIN_CARD_BID_USD,
    getMinimumBidUsdc(nextAuction.highestEffectiveBid, 1)
  );
  if (quote.bidValueUsdc < minimum) throw new Error(`Enter a bid of at least ${minimum.toFixed(2)} USD.`);

  const supabase = createSupabaseServerClient();
  const { data: authorization, error } = await supabase
    .from("card_bid_authorizations")
    .insert({
      user_id: userId,
      auction_id: auctionId,
      amount_usd: quote.amountUsd,
      fee_usd: quote.feeUsd,
      bid_value_usdc: quote.bidValueUsdc,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`Could not start card authorization: ${error.message}`);

  try {
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("payment_method_types[0]", "card");
    body.set("success_url", `${origin}/?card_bid=authorized#card-bidding`);
    body.set("cancel_url", `${origin}/?card_bid=cancelled#card-bidding`);
    body.set("customer_email", email);
    body.set("client_reference_id", userId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(Math.round(quote.totalAuthorizedUsd * 100)));
    body.set("line_items[0][price_data][product_data][name]", `${quote.bidValueUsdc.toFixed(2)} USDC-value AdBidCoin bid authorization`);
    body.set("line_items[0][price_data][product_data][description]", "Temporary card authorization. Captured only if this bid wins; losing holds are released.");
    body.set("metadata[kind]", "card_bid_authorization");
    body.set("metadata[authorization_id]", authorization.id);
    body.set("metadata[user_id]", userId);
    body.set("metadata[auction_id]", auctionId);
    body.set("payment_intent_data[capture_method]", "manual");
    body.set("payment_intent_data[metadata][kind]", "card_bid_authorization");
    body.set("payment_intent_data[metadata][authorization_id]", authorization.id);
    body.set("payment_intent_data[metadata][auction_id]", auctionId);
    const session = await stripePost("/v1/checkout/sessions", body, `card-bid-checkout:${authorization.id}`);
    const { error: updateError } = await supabase
      .from("card_bid_authorizations")
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", authorization.id);
    if (updateError) throw new Error(updateError.message);
    return { url: String(session.url), quote, mode: availability.testMode ? "test" : "live" };
  } catch (checkoutError) {
    await supabase.from("card_bid_authorizations").update({ status: "failed", failure_reason: "Checkout creation failed", updated_at: new Date().toISOString() }).eq("id", authorization.id);
    throw checkoutError;
  }
}
