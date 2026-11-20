import { createSupabaseServerClient } from "./supabase/server";
import { stripeGet, stripePost } from "./stripe";
import { finalizeAuctionEscrow, getAuctionEscrowState, settleWalletEscrowBid } from "./solana-escrow-server";

type BidRow = {
  id: number;
  auction_id: string;
  wallet: string;
  amount_usdc: number | string;
  effective_bid_usdc: number | string;
  funding_source: string;
  settlement_status: string;
  settlement_reference: string;
};

class PermanentCardAuthorizationError extends Error {}

async function captureCardWinner(bid: BidRow) {
  const supabase = createSupabaseServerClient();
  const { data: authorization, error } = await supabase
    .from("card_bid_authorizations")
    .select("id,stripe_payment_intent_id,amount_usd,fee_usd,status")
    .eq("bid_id", bid.id)
    .single<any>();
  if (error || !authorization?.stripe_payment_intent_id) throw new Error("Winning card authorization is missing its PaymentIntent.");
  const paymentIntentId = String(authorization.stripe_payment_intent_id);
  const intent = await stripeGet(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
  if (intent.status !== "succeeded") {
    if (intent.status !== "requires_capture") {
      await supabase.from("card_bid_authorizations").update({ status: "failed", failure_reason: `PaymentIntent is ${intent.status}`, updated_at: new Date().toISOString() }).eq("id", authorization.id);
      throw new PermanentCardAuthorizationError(`Winning card authorization cannot be captured from ${intent.status}.`);
    }
    const amountCents = Math.round((Number(authorization.amount_usd) + Number(authorization.fee_usd)) * 100);
    const body = new URLSearchParams();
    body.set("amount_to_capture", String(amountCents));
    await supabase.from("card_bid_authorizations").update({ status: "capture_pending", updated_at: new Date().toISOString() }).eq("id", authorization.id);
    await supabase.from("bids").update({ settlement_status: "capture_pending" }).eq("id", bid.id);
    try {
      await stripePost(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/capture`, body, `capture-winning-bid:${bid.auction_id}:${bid.id}`);
    } catch (error) {
      const refreshed = await stripeGet(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
      if (refreshed.status === "canceled" || refreshed.status === "requires_payment_method") {
        await supabase.from("card_bid_authorizations").update({ status: "failed", failure_reason: `Capture failed: ${refreshed.status}`, updated_at: new Date().toISOString() }).eq("id", authorization.id);
        throw new PermanentCardAuthorizationError(`Winning card authorization failed with ${refreshed.status}.`);
      }
      throw error;
    }
  }
  const now = new Date().toISOString();
  await supabase.from("card_bid_authorizations").update({ status: "captured", captured_at: now, updated_at: now }).eq("id", authorization.id);
  await supabase.from("bids").update({ settlement_status: "captured", settlement_reference: paymentIntentId }).eq("id", bid.id);
  return paymentIntentId;
}

async function releaseLosingCardBids(auctionId: string, winningBidId?: number) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("card_bid_authorizations")
    .select("id,bid_id,stripe_payment_intent_id,status")
    .eq("auction_id", auctionId)
    .in("status", ["pending", "authorized", "release_pending"]);
  if (winningBidId) query = query.neq("bid_id", winningBidId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const released: string[] = [];
  for (const row of data ?? []) {
    if (!row.stripe_payment_intent_id) continue;
    await supabase.from("card_bid_authorizations").update({ status: "release_pending", updated_at: new Date().toISOString() }).eq("id", row.id);
    if (row.bid_id) await supabase.from("bids").update({ settlement_status: "release_pending" }).eq("id", row.bid_id);
    const intent = await stripeGet(`/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`);
    if (intent.status !== "canceled") {
      if (intent.status === "requires_capture") {
        await stripePost(
          `/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}/cancel`,
          new URLSearchParams(),
          `release-losing-bid:${auctionId}:${row.id}`
        );
      } else if (intent.status === "succeeded") {
        throw new Error(`Losing card bid ${row.id} was unexpectedly captured.`);
      }
    }
    const now = new Date().toISOString();
    await supabase.from("card_bid_authorizations").update({ status: "released", released_at: now, updated_at: now }).eq("id", row.id);
    if (row.bid_id) await supabase.from("bids").update({ settlement_status: "released", settlement_reference: String(row.stripe_payment_intent_id) }).eq("id", row.bid_id);
    released.push(row.id);
  }
  return released;
}

export async function settleAuction(auctionId: string) {
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase.from("auction_settlements").select("status").eq("auction_id", auctionId).maybeSingle<any>();
  if (existing?.status === "settled") return { auctionId, status: "settled", replay: true };
  await supabase.from("auction_settlements").upsert({ auction_id: auctionId, status: "settling", started_at: new Date().toISOString(), error: "", updated_at: new Date().toISOString() }, { onConflict: "auction_id" });

  try {
    const { data: bids, error } = await supabase
      .from("bids")
      .select("id,auction_id,wallet,amount_usdc,effective_bid_usdc,funding_source,settlement_status,settlement_reference")
      .eq("auction_id", auctionId)
      .eq("payment_status", "verified")
      .eq("bid_source", "user")
      .order("effective_bid_usdc", { ascending: false })
      .order("amount_usdc", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<BidRow[]>();
    if (error) throw new Error(error.message);
    const winner = bids?.[0];
    const { data: auctionRow, error: auctionError } = await supabase.from("auctions").select("sequence").eq("id", auctionId).single<any>();
    if (auctionError) throw new Error(auctionError.message);
    const { data: walletEscrows, error: escrowError } = await supabase
      .from("wallet_bid_escrows")
      .select("id,bid_id,wallet,escrow_pda,status")
      .eq("auction_id", auctionId);
    if (escrowError) throw new Error(escrowError.message);
    if (process.env.WALLET_ESCROW_ENABLED === "true") {
      const chainState = await getAuctionEscrowState(Number(auctionRow.sequence));
      if (chainState && chainState.bidCount !== BigInt(walletEscrows?.length ?? 0)) {
        throw new Error("Not every on-chain wallet deposit has reached the database yet; settlement will retry.");
      }
      if (
        chainState && chainState.highestWalletAmount > 0n &&
        !walletEscrows?.some((row: any) => row.escrow_pda === chainState.highestWalletBid)
      ) {
        throw new Error("The highest on-chain wallet deposit has not reached the database yet; settlement will retry.");
      }
    }
    let winnerReference = "";
    if (winner?.funding_source === "card_authorization") {
      try {
        winnerReference = await captureCardWinner(winner);
      } catch (error) {
        if (error instanceof PermanentCardAuthorizationError) {
          await supabase.from("bids").update({ payment_status: "failed", settlement_status: "failed" }).eq("id", winner.id);
          // Re-run winner selection immediately so the next highest valid bid
          // can settle instead of freezing every losing authorization/escrow.
          return settleAuction(auctionId);
        }
        throw error;
      }
    } else if (winner && winner.funding_source !== "wallet_escrow") {
      // Historical direct-wallet and prepaid-credit bids were already paid.
      winnerReference = winner.settlement_reference || "legacy-prepaid";
      await supabase.from("bids").update({ settlement_status: "captured", settlement_reference: winnerReference }).eq("id", winner.id);
    }

    if ((walletEscrows ?? []).length > 0) {
      const walletWinner = winner?.funding_source === "wallet_escrow";
      const winnerEscrow = walletWinner ? walletEscrows?.find((row: any) => Number(row.bid_id) === winner.id) : undefined;
      if (walletWinner && !winnerEscrow) throw new Error("Winning wallet escrow is missing from the settlement ledger.");
      const winnerKind: 0 | 1 | 2 = walletWinner ? 1 : winner ? 2 : 0;
      await finalizeAuctionEscrow(Number(auctionRow.sequence), winnerKind, winnerEscrow?.escrow_pda ?? "");
      const activeEscrows = (walletEscrows ?? []).filter((row: any) => ["deposited", "settle_pending", "refund_pending"].includes(row.status));
      for (const escrow of activeEscrows) {
        const paysTreasury = walletWinner && Number(escrow.bid_id) === winner.id;
        const pendingStatus = paysTreasury ? "settle_pending" : "refund_pending";
        await supabase.from("wallet_bid_escrows").update({ status: pendingStatus, updated_at: new Date().toISOString() }).eq("id", escrow.id);
        await supabase.from("bids").update({ settlement_status: pendingStatus }).eq("id", escrow.bid_id);
        const settled = await settleWalletEscrowBid({
          sequence: Number(auctionRow.sequence),
          escrowPda: escrow.escrow_pda,
          bidderWallet: escrow.wallet,
          payTreasury: paysTreasury,
        });
        const finalStatus = paysTreasury ? "settled" : "refunded";
        await supabase.from("wallet_bid_escrows").update({ status: finalStatus, settlement_signature: settled.signature, failure_reason: "", updated_at: new Date().toISOString() }).eq("id", escrow.id);
        await supabase.from("bids").update({ settlement_status: paysTreasury ? "captured" : "refunded", settlement_reference: settled.signature }).eq("id", escrow.bid_id);
        if (paysTreasury) winnerReference = settled.signature;
      }
    }

    await releaseLosingCardBids(auctionId, winner?.id);
    const now = new Date().toISOString();
    await supabase.from("auction_settlements").upsert({
      auction_id: auctionId,
      winning_bid_id: winner?.id ?? null,
      funding_source: winner?.funding_source ?? "",
      status: "settled",
      winner_reference: winnerReference,
      error: "",
      settled_at: now,
      updated_at: now,
    }, { onConflict: "auction_id" });
    return { auctionId, status: "settled", winningBidId: winner?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settlement failed.";
    await supabase.from("auction_settlements").upsert({ auction_id: auctionId, status: "needs_review", error: message.slice(0, 1000), updated_at: new Date().toISOString() }, { onConflict: "auction_id" });
    throw error;
  }
}

export async function runAuctionSettlementScheduler() {
  const supabase = createSupabaseServerClient();
  // Bidding for an attention block closes when that block starts. Give
  // confirmed wallet deposits and signed Stripe webhooks a short period to
  // reach the database, then capture the winner before the block is far under
  // way. Waiting for `ends_at` would make the winner pay only after their
  // 30-minute placement had already expired.
  const nowMs = Date.now() - 2 * 60 * 1000;
  const { data: auctions, error } = await supabase
    .from("auctions")
    .select("id,starts_at")
    .lte("starts_at", nowMs)
    .order("starts_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  const results = [];
  for (const auction of auctions ?? []) {
    try {
      results.push(await settleAuction(auction.id));
    } catch (error) {
      results.push({ auctionId: auction.id, status: "needs_review", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { success: true, processed: results.length, results };
}
