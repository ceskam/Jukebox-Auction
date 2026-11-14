import { applyStripeEvent } from "../../../../lib/stripe-webhook";
import { verifyStripeSignature } from "../../../../lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  try {
    verifyStripeSignature(payload, request.headers.get("stripe-signature") ?? "");
    const event = JSON.parse(payload);
    await applyStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed.", error);
    return Response.json({ received: false, message: error instanceof Error ? error.message : "Webhook failed." }, { status: 400 });
  }
}
