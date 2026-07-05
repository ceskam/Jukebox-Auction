import { verifySolanaUsdcPayment } from "./payment";
import { createSupabaseServerClient } from "./supabase/server";

const BLOCK_LENGTH_MS = 15 * 60 * 1000;
const START_TIME = Date.UTC(2026, 0, 1, 0, 0, 0);

export interface Auction {
  id: string;
  sequence: number;
  highestBid: number;
  winner: string | null;
  startsAt: number;
  endsAt: number;
  status: "live" | "scheduled" | "ended";
}

export interface Bid {
  id: number;
  auctionId: string;
  wallet: string;
  amountUsdc: number;
  paymentStatus: string;
  paymentSignature: string | null;
  verificationProvider: string;
  createdAt: string;
}

function getAuctionNumber(offset = 0) {
  return Math.floor((Date.now() - START_TIME) / BLOCK_LENGTH_MS) + 1 + offset;
}

function getAuctionIdFromSequence(sequence: number) {
  return `attention-${sequence}`;
}

function parseAuctionSequence(auctionId: string) {
  const sequence = Number(auctionId.replace("attention-", ""));
  return Number.isFinite(sequence) && sequence > 0 ? sequence : getAuctionNumber();
}

function getAuctionStartTime(sequence: number) {
  return START_TIME + (sequence - 1) * BLOCK_LENGTH_MS;
}

function getAuctionEndTime(sequence: number) {
  return START_TIME + sequence * BLOCK_LENGTH_MS;
}

function getAuctionStatus(sequence: number): Auction["status"] {
  const currentSequence = getAuctionNumber();

  if (sequence < currentSequence) return "ended";
  if (sequence > currentSequence) return "scheduled";
  return "live";
}

type HighestBidRow = {
  wallet: string;
  amount_usdc: number | string | null;
};

type BidRow = {
  id: number;
  auction_id: string;
  wallet: string;
  amount_usdc: number | string | null;
  payment_status: string;
  payment_signature: string | null;
  verification_provider: string;
  created_at: string;
};

async function hasExistingPaymentSignature(paymentSignature: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select("id")
    .eq("payment_signature", paymentSignature)
    .limit(1)
    .maybeSingle<{ id: number }>();

  if (error) {
    throw new Error(`Could not check payment signature: ${error.message}`);
  }

  return Boolean(data);
}

async function ensureAuction(sequence: number) {
  const id = getAuctionIdFromSequence(sequence);
  const now = new Date().toISOString();
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("auctions").upsert(
    {
      id,
      sequence,
      starts_at: getAuctionStartTime(sequence),
      ends_at: getAuctionEndTime(sequence),
      status: getAuctionStatus(sequence),
      created_at: now,
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    throw new Error(`Could not ensure auction ${id}: ${error.message}`);
  }

  return id;
}

async function getHighestBid(auctionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select("wallet, amount_usdc")
    .eq("auction_id", auctionId)
    .eq("payment_status", "verified")
    .order("amount_usdc", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<HighestBidRow>();

  if (error) {
    throw new Error(`Could not load highest bid for ${auctionId}: ${error.message}`);
  }

  return data ?? undefined;
}

export async function getAuctionBySequence(sequence: number): Promise<Auction> {
  const auctionId = await ensureAuction(sequence);
  const highestBid = await getHighestBid(auctionId);
  const highestBidAmount = Number(highestBid?.amount_usdc ?? 0);

  return {
    id: auctionId,
    sequence,
    highestBid: highestBidAmount,
    winner: highestBid?.wallet ?? null,
    startsAt: getAuctionStartTime(sequence),
    endsAt: getAuctionEndTime(sequence),
    status: getAuctionStatus(sequence),
  };
}

export function getAuctionById(auctionId: string): Promise<Auction> {
  return getAuctionBySequence(parseAuctionSequence(auctionId));
}

export function getCurrentAuction(): Promise<Auction> {
  return getAuctionBySequence(getAuctionNumber());
}

export function getNextAuction(): Promise<Auction> {
  return getAuctionBySequence(getAuctionNumber(1));
}

export async function getBidHistory(auctionId: string, limit = 8): Promise<Bid[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select(
      "id, auction_id, wallet, amount_usdc, payment_status, payment_signature, verification_provider, created_at"
    )
    .eq("auction_id", auctionId)
    .eq("payment_status", "verified")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<BidRow[]>();

  if (error) {
    throw new Error(`Could not load bid history for ${auctionId}: ${error.message}`);
  }

  return (data ?? []).map((bid) => ({
    id: bid.id,
    auctionId: bid.auction_id,
    wallet: bid.wallet,
    amountUsdc: Number(bid.amount_usdc ?? 0),
    paymentStatus: bid.payment_status,
    paymentSignature: bid.payment_signature,
    verificationProvider: bid.verification_provider,
    createdAt: bid.created_at,
  }));
}

export async function placeBid(
  amountUsdc: number,
  wallet: string,
  paymentSignature?: string | null
) {
  const nextAuction = await getNextAuction();
  const roundedAmount = Math.round(amountUsdc * 100) / 100;

  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    return {
      success: false,
      message: "Enter a valid USDC bid amount.",
      auction: nextAuction,
    };
  }

  if (!paymentSignature && roundedAmount <= nextAuction.highestBid) {
    return {
      success: false,
      message: `Bid must be higher than ${nextAuction.highestBid.toFixed(2)} USDC.`,
      auction: nextAuction,
    };
  }

  const verification = await verifySolanaUsdcPayment({
    amountUsdc: roundedAmount,
    wallet,
    paymentSignature,
  });

  if (!verification.ok) {
    return {
      success: false,
      message: verification.message ?? "Payment verification failed.",
      auction: nextAuction,
    };
  }

  if (verification.signature && (await hasExistingPaymentSignature(verification.signature))) {
    return {
      success: false,
      message: "This USDC payment has already been used for a bid.",
      auction: nextAuction,
    };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("bids").insert({
    auction_id: nextAuction.id,
    wallet,
    amount_usdc: roundedAmount,
    payment_status: verification.status,
    payment_signature: verification.signature,
    verification_provider: verification.provider,
    created_at: new Date().toISOString(),
  });

  if (error) {
    return {
      success: false,
      message: `Could not save bid: ${error.message}`,
      auction: nextAuction,
    };
  }

  const updatedAuction = await getNextAuction();

  return {
    success: true,
    message: "Bid accepted for the next Attention Bid block.",
    auction: updatedAuction,
    bidHistory: await getBidHistory(updatedAuction.id),
  };
}

export const auctionTiming = {
  blockLengthMs: BLOCK_LENGTH_MS,
  startTime: START_TIME,
};
