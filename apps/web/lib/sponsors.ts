import { verifySolanaUsdcPayment } from "./payment";
import { createSupabaseServerClient } from "./supabase/server";
import type { HouseAttention } from "./house";
import { reservePaymentReceipt } from "./payment-receipts";

export const SPONSOR_PLANS = {
  starter: { name: "Auto 20", priceUsdc: 200, placements: 20 },
  growth: { name: "Auto 50", priceUsdc: 400, placements: 50 },
} as const;

export type SponsorPlanCode = keyof typeof SPONSOR_PLANS;

type SponsorOrderRow = {
  id: string;
  plan_code: SponsorPlanCode;
  sponsor_name: string;
  title: string;
  description: string;
  url: string;
  image_url: string;
  minimum_placements: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  last_featured_at: string | null;
};

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function createSponsorOrder(input: {
  wallet: string;
  planCode: string;
  paymentSignature: string;
  sponsorName: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  contact: string;
}) {
  const plan = SPONSOR_PLANS[input.planCode as SponsorPlanCode];
  if (!plan) throw new Error("Choose a valid sponsor package.");
  const title = input.title.trim().slice(0, 120);
  const sponsorName = input.sponsorName.trim().slice(0, 80);
  const description = input.description.trim().slice(0, 600);
  const url = validHttpsUrl(input.url);
  const imageUrl = input.imageUrl.trim() ? validHttpsUrl(input.imageUrl) : "";
  if (!sponsorName || !title || !description || !url) {
    throw new Error("Sponsor name, title, description, and an HTTPS destination are required.");
  }
  const supabase = createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("sponsor_orders")
    .select("id,status,wallet,plan_code")
    .eq("payment_signature", input.paymentSignature)
    .maybeSingle<{ id: string; status: string; wallet: string; plan_code: string }>();
  if (existing) {
    if (existing.wallet !== input.wallet || existing.plan_code !== input.planCode) {
      throw new Error("This payment receipt belongs to a different sponsor order.");
    }
    return { id: existing.id, status: existing.status };
  }
  const verification = await verifySolanaUsdcPayment({
    amountUsdc: plan.priceUsdc,
    wallet: input.wallet,
    paymentSignature: input.paymentSignature,
  });
  if (!verification.ok || !verification.signature) {
    throw new Error(verification.message ?? "Sponsor payment could not be verified.");
  }
  await reservePaymentReceipt({
    signature: verification.signature,
    purpose: "sponsor",
    wallet: input.wallet,
    amountUsdc: plan.priceUsdc,
    referenceKey: `sponsor:${input.planCode}`,
  });
  const { data: usedBid } = await supabase
    .from("bids")
    .select("id")
    .eq("payment_signature", verification.signature)
    .maybeSingle();
  if (usedBid) throw new Error("This payment receipt is already attached to a bid.");
  const { data, error } = await supabase
    .from("sponsor_orders")
    .insert({
      wallet: input.wallet,
      plan_code: input.planCode,
      amount_usdc: plan.priceUsdc,
      minimum_placements: plan.placements,
      sponsor_name: sponsorName,
      title,
      description,
      url,
      image_url: imageUrl,
      contact: input.contact.trim().slice(0, 160),
      payment_signature: verification.signature,
      status: "pending_review",
    })
    .select("id,status")
    .single<{ id: string; status: string }>();
  if (error) {
    if (error.code === "23505") throw new Error("This sponsor payment was already recorded.");
    throw new Error(`Could not save sponsor package: ${error.message}`);
  }
  return data;
}

export async function getPaidSponsorForRotation(): Promise<
  { orderId: string; content: HouseAttention } | undefined
> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sponsor_orders")
    .select("id,plan_code,sponsor_name,title,description,url,image_url,minimum_placements,status,starts_at,ends_at,last_featured_at")
    .eq("status", "active")
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("last_featured_at", { ascending: true, nullsFirst: true })
    .limit(25)
    .returns<SponsorOrderRow[]>();
  if (error) throw new Error(`Could not load paid sponsor rotation: ${error.message}`);
  if (!data?.length) return undefined;

  for (const order of data) {
    const { count } = await supabase
      .from("sponsor_placements")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order.id)
      .eq("status", "published");
    if ((count ?? 0) < order.minimum_placements) {
      return {
        orderId: order.id,
        content: {
          sponsor: order.sponsor_name,
          title: order.title,
          description: order.description,
          url: order.url,
          imageUrl: order.image_url,
        },
      };
    }
  }
  const bonus = data[0];
  return {
    orderId: bonus.id,
    content: {
      sponsor: bonus.sponsor_name,
      title: bonus.title,
      description: bonus.description,
      url: bonus.url,
      imageUrl: bonus.image_url,
    },
  };
}

export async function recordSponsorPlacement(orderId: string, auctionId: string) {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("sponsor_placements").upsert(
    { order_id: orderId, auction_id: auctionId, channel: "homepage", status: "published", featured_at: now },
    { onConflict: "auction_id" }
  );
  if (error) throw new Error(`Could not record sponsor placement: ${error.message}`);
  await supabase.from("sponsor_orders").update({ last_featured_at: now, updated_at: now }).eq("id", orderId);
}
