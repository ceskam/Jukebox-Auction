import { createSupabaseServerClient } from "./supabase/server";
import { stripeGet, stripePost } from "./stripe";

async function releaseRejectedAuthorization(paymentIntentId: string, authorizationId: string, reason: string) {
  const supabase = createSupabaseServerClient();
  try {
    await stripePost(
      `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
      new URLSearchParams(),
      `release-rejected-card-bid:${authorizationId}`
    );
  } finally {
    await supabase.from("card_bid_authorizations").update({
      status: "failed",
      failure_reason: reason.slice(0, 500),
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", authorizationId);
  }
}

async function recordCardAuthorization(session: any) {
  const authorizationId = String(session.metadata?.authorization_id ?? "");
  const paymentIntentId = String(session.payment_intent ?? "");
  if (!authorizationId || !paymentIntentId) throw new Error("Card bid Checkout Session is missing authorization metadata.");
  const supabase = createSupabaseServerClient();
  const { data: authorization, error } = await supabase
    .from("card_bid_authorizations")
    .select("id,amount_usd,fee_usd,status")
    .eq("id", authorizationId)
    .single<any>();
  if (error || !authorization) throw new Error("Card bid authorization record was not found.");
  if (authorization.status === "authorized" || authorization.status === "captured") return;

  const intent = await stripeGet(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
  const expectedCents = Math.round((Number(authorization.amount_usd) + Number(authorization.fee_usd)) * 100);
  if (
    intent.status !== "requires_capture" ||
    Number(intent.amount_capturable) !== expectedCents ||
    String(intent.metadata?.authorization_id ?? "") !== authorizationId
  ) {
    await releaseRejectedAuthorization(paymentIntentId, authorizationId, "Stripe authorization evidence did not match the bid.");
    throw new Error("Stripe authorization evidence did not match the bid.");
  }

  const { error: rpcError } = await supabase.rpc("record_card_authorized_bid", {
    requested_authorization_id: authorizationId,
    requested_payment_intent_id: paymentIntentId,
  });
  if (rpcError) {
    await releaseRejectedAuthorization(paymentIntentId, authorizationId, rpcError.message);
    throw new Error(rpcError.message);
  }
}

export async function applyStripeEvent(event: any) {
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase.from("stripe_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (existing) return;
  const object = event?.data?.object ?? {};

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (object.metadata?.kind === "card_bid_authorization") {
      await recordCardAuthorization(object);
    } else if (object.payment_status === "paid" || event.type.endsWith("async_payment_succeeded")) {
      const purchaseId = String(object.metadata?.purchase_id ?? "");
      if (!purchaseId) throw new Error("Stripe Checkout Session is missing purchase metadata.");
      const { error } = await supabase.rpc("settle_credit_purchase", {
        requested_purchase_id: purchaseId,
        requested_session_id: String(object.id ?? ""),
        requested_payment_intent_id: String(object.payment_intent ?? ""),
      });
      if (error) throw new Error(error.message);
    }
  } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const authorizationId = String(object.metadata?.authorization_id ?? "");
    if (authorizationId) {
      await supabase.from("card_bid_authorizations").update({ status: "expired", failure_reason: event.type, updated_at: new Date().toISOString() }).eq("id", authorizationId).eq("status", "pending");
    }
    const purchaseId = String(object.metadata?.purchase_id ?? "");
    if (purchaseId) await supabase.from("credit_purchases").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", purchaseId).eq("status", "pending");
  } else if (event.type === "payment_intent.canceled" || event.type === "payment_intent.payment_failed") {
    const authorizationId = String(object.metadata?.authorization_id ?? "");
    if (authorizationId) {
      await supabase.from("card_bid_authorizations").update({
        status: event.type === "payment_intent.canceled" ? "released" : "failed",
        failure_reason: event.type === "payment_intent.payment_failed" ? String(object.last_payment_error?.message ?? "Card authorization failed") : "",
        released_at: event.type === "payment_intent.canceled" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", authorizationId).not("status", "eq", "captured");
    }
  } else if (event.type === "charge.refunded") {
    // charge.refunded supplies the cumulative refunded amount. Passing that
    // total to the ledger keeps partial and repeated refunds idempotent.
    const paymentIntentId = String(object.payment_intent ?? "");
    if (paymentIntentId) {
      const { data: purchase } = await supabase.from("credit_purchases").select("id,credits,amount_usd,fee_usd").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle<any>();
      if (purchase) {
        const totalCharged = Math.max(1, Math.round((Number(purchase.amount_usd) + Number(purchase.fee_usd)) * 100));
        const refundedCents = Number(object.amount_refunded ?? object.amount ?? 0);
        const refundedCredits = Math.round((Number(purchase.credits) * Math.min(1, refundedCents / totalCharged)) * 100) / 100;
        const { error } = await supabase.rpc("apply_credit_refund", { requested_purchase_id: purchase.id, requested_refunded_credits: refundedCredits });
        if (error) throw new Error(error.message);
      }
    }
  }

  const { error: eventError } = await supabase.from("stripe_webhook_events").insert({ event_id: event.id, event_type: event.type });
  if (eventError?.code !== "23505") {
    if (eventError) throw new Error(eventError.message);
  }
}
