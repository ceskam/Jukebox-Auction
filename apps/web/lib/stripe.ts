import { createHmac, timingSafeEqual } from "node:crypto";

function stripeKey() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) throw new Error("Stripe is not configured.");
  return key;
}

export async function stripePost(
  path: string,
  body: URLSearchParams,
  idempotencyKey: string
) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? "Stripe request failed.");
  return result;
}

export async function stripeGet(path: string) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? "Stripe request failed.");
  return result;
}

export function verifyStripeSignature(payload: string, signatureHeader: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret) throw new Error("Stripe webhook signing is not configured.");
  const pieces = signatureHeader.split(",").map((part) => part.split("="));
  const timestamp = pieces.find(([key]) => key === "t")?.[1] ?? "";
  const signatures = pieces.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error("Expired Stripe webhook signature.");
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBytes = Buffer.from(expected);
  const valid = signatures.some((candidate) => {
    const bytes = Buffer.from(candidate ?? "");
    return bytes.length === expectedBytes.length && timingSafeEqual(bytes, expectedBytes);
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature.");
}
