import { createHash, randomBytes, randomInt } from "node:crypto";

import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import { createSupabaseServerClient } from "./supabase/server";

const USDC_DECIMALS = 6;
const BASE_UNITS_PER_USDC = 10 ** USDC_DECIMALS;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ArtDropStatus =
  | "scheduled"
  | "active"
  | "reserved"
  | "paid"
  | "expired"
  | "cancelled"
  | "payout_review";

type ArtDropRow = {
  id: string;
  public_id: string;
  claim_code: string;
  code_hash: string;
  reward_usdc: number | string;
  status: ArtDropStatus;
  scheduled_for: string;
  published_at: string | null;
  expires_at: string | null;
  reserved_at: string | null;
  claim_wallet: string;
  payout_signature: string;
  payout_error: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PublicArtDrop = {
  publicId: string;
  claimCode: string;
  rewardUsdc: number;
  status: "active" | "paid";
  expiresAt: string | null;
  claimWallet: string;
  payoutSignature: string;
  paidAt: string | null;
};

export type AdminArtDrop = Omit<PublicArtDrop, "status"> & {
  id: string;
  status: ArtDropStatus;
  scheduledFor: string;
  publishedAt: string | null;
  reservedAt: string | null;
  payoutError: string;
  createdAt: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function positiveNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getRewardUsdc() {
  return Math.min(100, positiveNumber("ART_DROP_REWARD_USDC", 10));
}

function getDailyLimitUsdc() {
  return Math.max(getRewardUsdc(), positiveNumber("ART_DROP_DAILY_LIMIT_USDC", 50));
}

function getExpiryMinutes() {
  return Math.max(5, positiveNumber("ART_DROP_EXPIRY_MINUTES", 60));
}

function getIntervalHours() {
  const minimum = Math.max(0.25, positiveNumber("ART_DROP_MIN_INTERVAL_HOURS", 4));
  const maximum = Math.max(minimum, positiveNumber("ART_DROP_MAX_INTERVAL_HOURS", 12));
  return { minimum, maximum };
}

export function isArtDropsEnabled() {
  return process.env.ART_DROPS_ENABLED === "true";
}

function getTreasuryKeypair() {
  const secret = Buffer.from(requiredEnv("ART_DROP_TREASURY_SECRET_KEY_BASE64"), "base64");
  if (secret.length !== 64) {
    throw new Error("ART_DROP_TREASURY_SECRET_KEY_BASE64 must decode to a 64-byte keypair.");
  }
  return Keypair.fromSecretKey(secret);
}

async function getTreasuryBalances() {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const mintAddress = process.env.USDC_MINT_ADDRESS ?? process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS;
  if (!rpcUrl || !mintAddress) {
    throw new Error("The server-side Solana RPC and USDC mint are required.");
  }
  const keypair = getTreasuryKeypair();
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  const tokenAccount = getAssociatedTokenAddressSync(mint, keypair.publicKey);
  const [lamports, tokenAccountInfo] = await Promise.all([
    connection.getBalance(keypair.publicKey, "confirmed"),
    connection.getAccountInfo(tokenAccount, "confirmed"),
  ]);
  const usdc = tokenAccountInfo
    ? Number((await connection.getTokenAccountBalance(tokenAccount, "confirmed")).value.uiAmountString ?? "0")
    : 0;
  return {
    wallet: keypair.publicKey.toBase58(),
    usdc,
    sol: lamports / 1_000_000_000,
  };
}

async function assertTreasuryReady() {
  const balances = await getTreasuryBalances();
  if (balances.usdc < getRewardUsdc()) {
    throw new Error(
      `Art Drop treasury needs at least ${getRewardUsdc().toFixed(2)} USDC before a drop can be published.`
    );
  }
  if (balances.sol < 0.005) {
    throw new Error("Art Drop treasury needs at least 0.005 SOL for fees and token-account creation.");
  }
  return balances;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function hashCode(code: string) {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

function generateCodePart(length: number) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return value;
}

function generateClaimCode() {
  return `AD-${generateCodePart(4)}-${generateCodePart(4)}`;
}

function mapPublicDrop(row: ArtDropRow): PublicArtDrop {
  return {
    publicId: row.public_id,
    claimCode: row.claim_code,
    rewardUsdc: Number(row.reward_usdc),
    status: row.status === "paid" ? "paid" : "active",
    expiresAt: row.expires_at,
    claimWallet: row.claim_wallet,
    payoutSignature: row.payout_signature,
    paidAt: row.paid_at,
  };
}

function mapAdminDrop(row: ArtDropRow): AdminArtDrop {
  return {
    ...mapPublicDrop(row),
    id: row.id,
    status: row.status,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    reservedAt: row.reserved_at,
    payoutError: row.payout_error,
    createdAt: row.created_at,
  };
}

export async function getPublicArtDrops() {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const [{ data: active, error: activeError }, { data: paid, error: paidError }] =
    await Promise.all([
      supabase
        .from("art_drops")
        .select("*")
        .eq("status", "active")
        .gt("expires_at", now)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle<ArtDropRow>(),
      supabase
        .from("art_drops")
        .select("*")
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(6)
        .returns<ArtDropRow[]>(),
    ]);

  if (activeError || paidError) {
    throw new Error(
      `Could not load Art Drops: ${activeError?.message ?? paidError?.message}`
    );
  }

  return {
    active: active ? mapPublicDrop(active) : undefined,
    recent: (paid ?? []).map(mapPublicDrop),
  };
}

export async function getPublicArtDropById(publicId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("art_drops")
    .select("*")
    .eq("public_id", publicId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<ArtDropRow>();
  if (error) throw new Error(`Could not load Art Drop: ${error.message}`);
  return data ? mapPublicDrop(data) : undefined;
}

async function getControl() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("art_drop_control")
    .select("paused")
    .eq("id", 1)
    .single<{ paused: boolean }>();
  if (error) throw new Error(`Could not load Art Drop controls: ${error.message}`);
  return data;
}

export async function getArtDropAdminData() {
  const supabase = createSupabaseServerClient();
  const [{ data: control, error: controlError }, { data: drops, error: dropsError }] =
    await Promise.all([
      supabase
        .from("art_drop_control")
        .select("paused")
        .eq("id", 1)
        .single<{ paused: boolean }>(),
      supabase
        .from("art_drops")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<ArtDropRow[]>(),
    ]);
  if (controlError || dropsError) {
    throw new Error(
      `Could not load Art Drop admin data: ${controlError?.message ?? dropsError?.message}`
    );
  }

  let treasuryWallet = "";
  let treasuryUsdc = 0;
  let treasurySol = 0;
  let signerConfigured = false;
  let treasuryStatus = "Signer is not configured.";
  try {
    treasuryWallet = getTreasuryKeypair().publicKey.toBase58();
    signerConfigured = true;
    treasuryStatus = "Balance unavailable.";
    const balances = await getTreasuryBalances();
    treasuryUsdc = balances.usdc;
    treasurySol = balances.sol;
    treasuryStatus = "Ready";
  } catch {
    // Configuration status is intentionally reported without revealing secrets.
  }

  return {
    enabled: isArtDropsEnabled(),
    paused: Boolean(control?.paused),
    signerConfigured,
    treasuryWallet,
    treasuryUsdc,
    treasurySol,
    treasuryStatus,
    rewardUsdc: getRewardUsdc(),
    dailyLimitUsdc: getDailyLimitUsdc(),
    drops: (drops ?? []).map(mapAdminDrop),
  };
}

export async function setArtDropsPaused(paused: boolean) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("art_drop_control")
    .update({ paused })
    .eq("id", 1);
  if (error) throw new Error(`Could not update Art Drop controls: ${error.message}`);
}

async function expireOldDrops() {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("art_drops")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());
  if (error) throw new Error(`Could not expire Art Drops: ${error.message}`);
}

async function getOpenDrop() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("art_drops")
    .select("*")
    .in("status", ["scheduled", "active", "reserved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ArtDropRow>();
  if (error) throw new Error(`Could not check open Art Drops: ${error.message}`);
  return data ?? undefined;
}

async function getAllocatedLast24Hours() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("art_drops")
    .select("reward_usdc")
    .in("status", ["scheduled", "active", "reserved", "paid", "payout_review"])
    .gte("created_at", since)
    .returns<Array<{ reward_usdc: number | string }>>();
  if (error) throw new Error(`Could not check the Art Drop budget: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.reward_usdc), 0);
}

async function createDrop(activateNow: boolean) {
  await assertTreasuryReady();
  const rewardUsdc = getRewardUsdc();
  const allocated = await getAllocatedLast24Hours();
  if (allocated + rewardUsdc > getDailyLimitUsdc()) {
    return { success: true, action: "daily-limit" as const };
  }

  const now = Date.now();
  const { minimum, maximum } = getIntervalHours();
  const delayMs = activateNow
    ? 0
    : randomInt(
        Math.round(minimum * 60 * 60 * 1000),
        Math.round(maximum * 60 * 60 * 1000) + 1
      );
  const scheduledFor = new Date(now + delayMs);
  const code = generateClaimCode();
  const status: ArtDropStatus = activateNow ? "active" : "scheduled";
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("art_drops")
    .insert({
      public_id: `drop-${randomBytes(8).toString("hex")}`,
      claim_code: code,
      code_hash: hashCode(code),
      reward_usdc: rewardUsdc,
      status,
      scheduled_for: scheduledFor.toISOString(),
      published_at: activateNow ? scheduledFor.toISOString() : null,
      expires_at: activateNow
        ? new Date(now + getExpiryMinutes() * 60 * 1000).toISOString()
        : null,
    })
    .select("*")
    .single<ArtDropRow>();
  if (error?.code === "23505") {
    return { success: true, action: "already-open" as const };
  }
  if (error) throw new Error(`Could not create Art Drop: ${error.message}`);
  return {
    success: true,
    action: activateNow ? ("published" as const) : ("scheduled" as const),
    drop: mapAdminDrop(data),
  };
}

async function publishScheduledDrop(drop: ArtDropRow) {
  await assertTreasuryReady();
  const now = new Date();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("art_drops")
    .update({
      status: "active",
      published_at: now.toISOString(),
      expires_at: new Date(now.getTime() + getExpiryMinutes() * 60 * 1000).toISOString(),
    })
    .eq("id", drop.id)
    .eq("status", "scheduled")
    .select("*")
    .single<ArtDropRow>();
  if (error) throw new Error(`Could not publish Art Drop: ${error.message}`);
  return { success: true, action: "published" as const, drop: mapAdminDrop(data) };
}

export async function createArtDropNow() {
  if (!isArtDropsEnabled()) throw new Error("Art Drops are disabled in Vercel.");
  await expireOldDrops();
  const control = await getControl();
  if (control.paused) throw new Error("Resume Art Drops before publishing one.");
  const open = await getOpenDrop();
  if (open?.status === "scheduled") return publishScheduledDrop(open);
  if (open) throw new Error("An Art Drop is already active or being paid.");
  return createDrop(true);
}

export async function cancelArtDrop(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("art_drops")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["scheduled", "active"]);
  if (error) throw new Error(`Could not cancel Art Drop: ${error.message}`);
}

export async function reconcileArtDrop(id: string) {
  const supabase = createSupabaseServerClient();
  const { data: drop, error } = await supabase
    .from("art_drops")
    .select("*")
    .eq("id", id)
    .eq("status", "payout_review")
    .single<ArtDropRow>();
  if (error || !drop) throw new Error("This Art Drop is not awaiting payout review.");
  if (!drop.payout_signature) {
    throw new Error("No transaction was submitted. Keep this row for audit review; do not retry automatically.");
  }

  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("The server-side Solana RPC is required.");
  const connection = new Connection(rpcUrl, "confirmed");
  const statuses = await connection.getSignatureStatuses([drop.payout_signature], {
    searchTransactionHistory: true,
  });
  const status = statuses.value[0];
  if (!status) throw new Error("The payout is not visible on-chain yet. Review it again later.");
  if (status.err) throw new Error("The on-chain payout failed. Do not mark this reward paid.");
  if (!status.confirmationStatus || status.confirmationStatus === "processed") {
    throw new Error("The payout is not confirmed yet. Review it again later.");
  }

  const { error: updateError } = await supabase
    .from("art_drops")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payout_error: "",
    })
    .eq("id", id)
    .eq("status", "payout_review")
    .eq("payout_signature", drop.payout_signature);
  if (updateError) throw new Error(`Could not finalize the reconciled payout: ${updateError.message}`);
  return { signature: drop.payout_signature };
}

export async function runArtDropScheduler() {
  if (!isArtDropsEnabled()) return { success: true, action: "disabled" as const };
  await expireOldDrops();
  const control = await getControl();
  if (control.paused) return { success: true, action: "paused" as const };

  const open = await getOpenDrop();
  if (open?.status === "scheduled") {
    if (new Date(open.scheduled_for).getTime() > Date.now()) {
      return { success: true, action: "waiting" as const, scheduledFor: open.scheduled_for };
    }
    return publishScheduledDrop(open);
  }
  if (open) return { success: true, action: "already-open" as const };
  return createDrop(false);
}

async function sendRewardUsdc(recipientAddress: string, amountUsdc: number) {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const mintAddress = process.env.USDC_MINT_ADDRESS ?? process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS;
  if (!rpcUrl || !mintAddress) {
    throw new Error("The server-side Solana RPC and USDC mint are required.");
  }

  const keypair = getTreasuryKeypair();
  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(recipientAddress);
  const source = getAssociatedTokenAddressSync(mint, keypair.publicKey);
  const destination = getAssociatedTokenAddressSync(mint, recipient);
  const sourceInfo = await connection.getAccountInfo(source);
  if (!sourceInfo) throw new Error("The Art Drop treasury has no USDC token account.");

  const sourceBalance = await connection.getTokenAccountBalance(source);
  if (Number(sourceBalance.value.uiAmountString ?? "0") < amountUsdc) {
    throw new Error("The Art Drop treasury does not have enough USDC.");
  }

  const transaction = new Transaction();
  if (!(await connection.getAccountInfo(destination))) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        destination,
        recipient,
        mint
      )
    );
  }
  transaction.add(
    createTransferCheckedInstruction(
      source,
      mint,
      destination,
      keypair.publicKey,
      BigInt(Math.round(amountUsdc * BASE_UNITS_PER_USDC)),
      USDC_DECIMALS
    )
  );

  const latest = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = keypair.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(keypair);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
  });
  return { connection, signature, latest };
}

export async function claimArtDrop({ code, wallet }: { code: string; wallet: string }) {
  if (!isArtDropsEnabled()) throw new Error("Art Drops are not accepting claims yet.");
  const control = await getControl();
  if (control.paused) throw new Error("Art Drops are temporarily paused.");

  const normalizedWallet = new PublicKey(wallet).toBase58();
  if (normalizedWallet !== wallet) throw new Error("Use a valid connected Solana wallet.");
  const normalizedCode = normalizeCode(code);
  if (!/^AD-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizedCode)) {
    throw new Error("Enter the code exactly as it appears in the Art Drop graphic.");
  }

  const supabase = createSupabaseServerClient();
  const cooldownSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: previousReward, error: cooldownError } = await supabase
    .from("art_drops")
    .select("id")
    .eq("status", "paid")
    .eq("claim_wallet", wallet)
    .gte("paid_at", cooldownSince)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (cooldownError) {
    throw new Error(`Could not verify reward eligibility: ${cooldownError.message}`);
  }
  if (previousReward) {
    throw new Error("This wallet has already received an Art Drop in the last 30 days.");
  }

  const { data, error } = await supabase
    .rpc("reserve_art_drop", {
      requested_code_hash: hashCode(normalizedCode),
      requested_wallet: wallet,
    })
    .returns<ArtDropRow[]>();
  if (error) throw new Error(`Could not reserve this Art Drop: ${error.message}`);
  const drop = data?.[0];
  if (!drop) throw new Error("This code is invalid, expired, or already claimed.");
  if (drop.payout_signature) {
    return {
      success: true,
      action: "submitted" as const,
      signature: drop.payout_signature,
      rewardUsdc: Number(drop.reward_usdc),
    };
  }

  let signature = "";
  try {
    const payment = await sendRewardUsdc(wallet, Number(drop.reward_usdc));
    signature = payment.signature;
    const { error: saveError } = await supabase
      .from("art_drops")
      .update({ payout_signature: signature, payout_error: "" })
      .eq("id", drop.id)
      .eq("status", "reserved")
      .eq("claim_wallet", wallet);
    if (saveError) {
      console.error("Art Drop payout was submitted but its signature was not saved.", {
        dropId: drop.id,
        signature,
      });
      throw new Error("Reward submitted and awaiting manual reconciliation.");
    }

    const confirmation = await payment.connection.confirmTransaction(
      {
        signature,
        blockhash: payment.latest.blockhash,
        lastValidBlockHeight: payment.latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    if (confirmation.value.err) {
      throw new Error("The Solana network reported that the reward transaction failed.");
    }
    const { error: paidError } = await supabase
      .from("art_drops")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", drop.id)
      .eq("status", "reserved")
      .eq("claim_wallet", wallet)
      .eq("payout_signature", signature);
    if (paidError) throw new Error(`Payout confirmed but finalization failed: ${paidError.message}`);

    return {
      success: true,
      action: "paid" as const,
      signature,
      rewardUsdc: Number(drop.reward_usdc),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Art Drop payout error.";
    await supabase
      .from("art_drops")
      .update({ status: "payout_review", payout_error: message.slice(0, 300) })
      .eq("id", drop.id)
      .eq("claim_wallet", wallet);
    if (signature) {
      console.error("Art Drop payout needs reconciliation.", { dropId: drop.id, signature });
    }
    throw error;
  }
}
