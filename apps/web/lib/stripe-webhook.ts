import { createSupabaseServerClient } from "./supabase/server";

export async function applyStripeEvent(event: any) {
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase.from("stripe_webhook_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (existing) return;
  const object = event?.data?.object ?? {};

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (object.payment_status === "paid" || event.type.endsWith("async_payment_succeeded")) {
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
    const purchaseId = String(object.metadata?.purchase_id ?? "");
    if (purchaseId) await supabase.from("credit_purchases").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", purchaseId).eq("status", "pending");
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
