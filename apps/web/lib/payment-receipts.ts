import { createSupabaseServerClient } from "./supabase/server";

type ReceiptPurpose = "bid" | "sponsor";

export async function reservePaymentReceipt(input: {
  signature: string;
  purpose: ReceiptPurpose;
  wallet: string;
  amountUsdc: number;
  referenceKey: string;
}) {
  const supabase = createSupabaseServerClient();
  const row = {
    signature: input.signature,
    purpose: input.purpose,
    wallet: input.wallet,
    amount_usdc: input.amountUsdc,
    reference_key: input.referenceKey,
  };
  const { error } = await supabase.from("payment_receipts").insert(row);
  if (!error) return;
  if (error.code !== "23505") {
    throw new Error(`Could not reserve payment receipt: ${error.message}`);
  }
  const { data: existing, error: lookupError } = await supabase
    .from("payment_receipts")
    .select("purpose,wallet,amount_usdc,reference_key")
    .eq("signature", input.signature)
    .single<{ purpose: string; wallet: string; amount_usdc: number | string; reference_key: string }>();
  if (lookupError || !existing) throw new Error("This payment receipt is already in use.");
  if (
    existing.purpose !== input.purpose ||
    existing.wallet !== input.wallet ||
    Number(existing.amount_usdc) !== input.amountUsdc ||
    existing.reference_key !== input.referenceKey
  ) {
    throw new Error("This payment receipt is already attached to a different purchase.");
  }
}
