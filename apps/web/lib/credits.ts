import { createHmac, timingSafeEqual } from "node:crypto";

import { getMinimumBidUsdc } from "./bid-rules";
import { getBidHistory, getNextAuction } from "./auction";
import { createSupabaseServerClient } from "./supabase/server";

const MIN_PURCHASE_CREDITS = 5;
const MAX_PURCHASE_CREDITS = 500;

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

export function getCreditFeePercent() {
  return Math.max(0, Math.min(25, numberEnv("CREDIT_PURCHASE_FEE_PERCENT", 0)));
}

export function getStripeCreditAvailability() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const testMode = key.startsWith("sk_test_");
  const liveMode = key.startsWith("sk_live_");
  const approvalConfirmed = process.env.STRIPE_APPROVAL_CONFIRMED === "true";
  const enabled = process.env.STRIPE_CREDITS_ENABLED === "true";
  return {
    enabled: enabled && Boolean(key) && (testMode || (liveMode && approvalConfirmed)),
    testMode,
    liveMode,
    approvalConfirmed,
    reason: !enabled
      ? "Card credit purchases are not enabled."
      : !key
        ? "Stripe is not configured."
        : liveMode && !approvalConfirmed
          ? "Live purchases require written Stripe approval for this auction-credit model."
          : "",
  };
}

export function quoteCreditPurchase(creditsInput: number) {
  const credits = Math.round(creditsInput * 100) / 100;
  if (!Number.isFinite(credits) || credits < MIN_PURCHASE_CREDITS || credits > MAX_PURCHASE_CREDITS) {
    throw new Error(`Choose between ${MIN_PURCHASE_CREDITS} and ${MAX_PURCHASE_CREDITS} credits.`);
  }
  const amountUsd = credits;
  const feeUsd = Math.round(amountUsd * getCreditFeePercent()) / 100;
  return { credits, amountUsd, feeUsd, totalUsd: Math.round((amountUsd + feeUsd) * 100) / 100 };
}

export async function getCreditAccount(userId: string) {
  const supabase = createSupabaseServerClient();
  const [{ data: account, error: accountError }, { data: transactions, error: transactionError }] = await Promise.all([
    supabase
      .from("platform_credit_accounts")
      .select("balance_credits,reserved_credits,deficit_credits,status")
      .eq("user_id", userId)
      .maybeSingle<{
        balance_credits: number | string;
        reserved_credits: number | string;
        deficit_credits: number | string;
        status: "active" | "frozen";
      }>(),
    supabase
      .from("platform_credit_transactions")
      .select("id,kind,amount_credits,balance_after,reference_type,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  if (accountError || transactionError) {
    throw new Error(`Could not load platform credits: ${accountError?.message ?? transactionError?.message}`);
  }
  return {
    balanceCredits: Number(account?.balance_credits ?? 0),
    reservedCredits: Number(account?.reserved_credits ?? 0),
    deficitCredits: Number(account?.deficit_credits ?? 0),
    status: account?.status ?? "active",
    transactions: (transactions ?? []).map((row: any) => ({
      id: row.id,
      kind: row.kind,
      amountCredits: Number(row.amount_credits),
      balanceAfter: Number(row.balance_after),
      referenceType: row.reference_type,
      createdAt: row.created_at,
    })),
  };
}

async function stripeRequest(path: string, body: URLSearchParams, idempotencyKey: string) {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? "Stripe could not create Checkout.");
  return result;
}

export async function createCreditCheckout({
  userId,
  email,
  credits,
  origin,
}: {
  userId: string;
  email: string;
  credits: number;
  origin: string;
}) {
  const availability = getStripeCreditAvailability();
  if (!availability.enabled) throw new Error(availability.reason);
  const quote = quoteCreditPurchase(credits);
  const supabase = createSupabaseServerClient();
  const { data: purchase, error } = await supabase
    .from("credit_purchases")
    .insert({
      user_id: userId,
      amount_usd: quote.amountUsd,
      fee_usd: quote.feeUsd,
      credits: quote.credits,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`Could not start credit purchase: ${error.message}`);

  try {
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("payment_method_types[0]", "card");
    body.set("success_url", `${origin}/?credit_checkout=success&session_id={CHECKOUT_SESSION_ID}#platform-credits`);
    body.set("cancel_url", `${origin}/?credit_checkout=cancelled#platform-credits`);
    body.set("customer_email", email);
    body.set("client_reference_id", userId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(Math.round(quote.totalUsd * 100)));
    body.set("line_items[0][price_data][product_data][name]", `${quote.credits.toFixed(2)} AdBidCoin platform credits`);
    body.set("line_items[0][price_data][product_data][description]", "Internal, non-transferable auction bidding balance. 1 credit = 1 USDC of bidding value.");
    body.set("metadata[purchase_id]", purchase.id);
    body.set("metadata[user_id]", userId);
    body.set("metadata[credits]", quote.credits.toFixed(2));
    body.set("payment_intent_data[metadata][purchase_id]", purchase.id);
    const session = await stripeRequest("/v1/checkout/sessions", body, `credit-checkout:${purchase.id}`);
    const { error: updateError } = await supabase
      .from("credit_purchases")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", purchase.id);
    if (updateError) throw new Error(updateError.message);
    return { url: session.url as string, quote, mode: availability.testMode ? "test" : "live" };
  } catch (checkoutError) {
    await supabase.from("credit_purchases").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", purchase.id);
    throw checkoutError;
  }
}

export function verifyStripeSignature(payload: string, signatureHeader: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) throw new Error("Stripe webhook signing is not configured.");
  const pieces = signatureHeader.split(",").map((part) => part.split("="));
  const timestamp = pieces.find(([key]) => key === "t")?.[1] ?? "";
  const signatures = pieces.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Expired Stripe webhook signature.");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBytes = Buffer.from(expected);
  const valid = signatures.some((candidate) => {
    const bytes = Buffer.from(candidate ?? "");
    return bytes.length === expectedBytes.length && timingSafeEqual(bytes, expectedBytes);
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature.");
}

export async function placeCreditBid(userId: string, amountInput: number, requestedAuctionId: string) {
  const nextAuction = await getNextAuction();
  const amount = Math.round(amountInput * 100) / 100;
  const minimum = getMinimumBidUsdc(nextAuction.highestEffectiveBid, 1);
  if (!Number.isFinite(amount) || amount < minimum) {
    throw new Error(`Enter a credit bid of at least ${minimum.toFixed(2)} credits.`);
  }
  if (requestedAuctionId !== nextAuction.id) throw new Error("That auction has closed. Refresh and try again.");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("place_credit_bid", {
    requested_user_id: userId,
    requested_auction_id: requestedAuctionId,
    requested_amount: amount,
  });
  if (error) throw new Error(error.message);
  const updated = await getNextAuction();
  return {
    success: true,
    bidId: Number(data),
    message: updated.winner === `credit:${userId}`
      ? `Your ${amount.toFixed(2)} credit bid is leading.`
      : "Your credit bid was recorded. Another verified bid is currently higher.",
    auction: updated,
    bidHistory: await getBidHistory(updated.id),
  };
}
