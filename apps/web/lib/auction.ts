import { OPENING_BID_USDC } from "./bid-rules";
import {
  calculateEffectiveBidUsdc,
  getQuietBidPower,
} from "./bid-power";
import { getHouseActivationTime } from "./house";
import { verifySolanaUsdcPayment } from "./payment";
import { createSupabaseServerClient } from "./supabase/server";

const LEGACY_BLOCK_LENGTH_MS = 15 * 60 * 1000;
const BLOCK_LENGTH_MS = 30 * 60 * 1000;
const PAYMENT_RECOVERY_GRACE_MS = 5 * 60 * 1000;
const START_TIME = Date.UTC(2026, 0, 1, 0, 0, 0);
const THIRTY_MINUTE_SCHEDULE_START = Date.UTC(2026, 8, 21, 7, 0, 0);
const FIRST_THIRTY_MINUTE_SEQUENCE =
  Math.floor(
    (THIRTY_MINUTE_SCHEDULE_START - START_TIME) / LEGACY_BLOCK_LENGTH_MS
  ) + 1;

export interface Auction {
  id: string;
  sequence: number;
  highestBid: number;
  highestEffectiveBid: number;
  leadingBidMultiplier: number;
  leadingQuietBalance: number;
  winner: string | null;
  isHouseBid: boolean;
  houseBidAmount: number;
  housePaymentSignature: string | null;
  houseActivatesAt: number;
  startsAt: number;
  endsAt: number;
  status: "live" | "scheduled" | "ended";
}

export interface Bid {
  id: number;
  auctionId: string;
  wallet: string;
  amountUsdc: number;
  effectiveBidUsdc: number;
  bidMultiplier: number;
  quietBalance: number;
  paymentStatus: string;
  paymentSignature: string | null;
  verificationProvider: string;
  bidSource: "user" | "house";
  createdAt: string;
}

function getAuctionNumber(offset = 0) {
  const now = Date.now();
  const currentSequence =
    now < THIRTY_MINUTE_SCHEDULE_START
      ? Math.floor((now - START_TIME) / LEGACY_BLOCK_LENGTH_MS) + 1
      : FIRST_THIRTY_MINUTE_SEQUENCE +
        Math.floor((now - THIRTY_MINUTE_SCHEDULE_START) / BLOCK_LENGTH_MS);

  return currentSequence + offset;
}

function getAuctionIdFromSequence(sequence: number) {
  return `attention-${sequence}`;
}

function parseAuctionSequence(auctionId: string) {
  const match = /^attention-(\d+)$/.exec(auctionId);
  const sequence = Number(match?.[1]);

  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error("Invalid auction ID.");
  }

  return sequence;
}

function getAuctionStartTime(sequence: number) {
  if (sequence < FIRST_THIRTY_MINUTE_SEQUENCE) {
    return START_TIME + (sequence - 1) * LEGACY_BLOCK_LENGTH_MS;
  }

  return (
    THIRTY_MINUTE_SCHEDULE_START +
    (sequence - FIRST_THIRTY_MINUTE_SEQUENCE) * BLOCK_LENGTH_MS
  );
}

function getAuctionEndTime(sequence: number) {
  return getAuctionStartTime(sequence + 1);
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
  effective_bid_usdc: number | string | null;
  bid_multiplier: number | string | null;
  quiet_balance: number | string | null;
  payment_signature: string | null;
  bid_source: "user" | "house" | null;
};

type BidRow = {
  id: number;
  auction_id: string;
  wallet: string;
  amount_usdc: number | string | null;
  effective_bid_usdc: number | string | null;
  bid_multiplier: number | string | null;
  quiet_balance: number | string | null;
  payment_status: string;
  payment_signature: string | null;
  verification_provider: string;
  bid_source: "user" | "house" | null;
  created_at: string;
};

async function getExistingPayment(paymentSignature: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select("id, auction_id, wallet, amount_usdc")
    .eq("payment_signature", paymentSignature)
    .limit(1)
    .maybeSingle<{
      id: number;
      auction_id: string;
      wallet: string;
      amount_usdc: number | string;
    }>();

  if (error) {
    throw new Error(`Could not check payment signature: ${error.message}`);
  }

  return data ?? undefined;
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

async function getHighestBidBySource(
  auctionId: string,
  bidSource: "user" | "house"
) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select(
      "wallet, amount_usdc, effective_bid_usdc, bid_multiplier, quiet_balance, payment_signature, bid_source"
    )
    .eq("auction_id", auctionId)
    .eq("payment_status", "verified")
    .eq("bid_source", bidSource)
    .order("effective_bid_usdc", { ascending: false })
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
  const [highestUserBid, houseBid] = await Promise.all([
    getHighestBidBySource(auctionId, "user"),
    getHighestBidBySource(auctionId, "house"),
  ]);
  const winningBid = highestUserBid ?? houseBid;
  const highestBidAmount = Number(highestUserBid?.amount_usdc ?? 0);
  const highestEffectiveBid = Number(
    highestUserBid?.effective_bid_usdc ?? 0
  );
  const startsAt = getAuctionStartTime(sequence);

  return {
    id: auctionId,
    sequence,
    highestBid: highestBidAmount,
    highestEffectiveBid,
    leadingBidMultiplier: Number(highestUserBid?.bid_multiplier ?? 1),
    leadingQuietBalance: Number(highestUserBid?.quiet_balance ?? 0),
    winner: winningBid?.wallet ?? null,
    isHouseBid: Boolean(!highestUserBid && houseBid),
    houseBidAmount: Number(houseBid?.amount_usdc ?? 0),
    housePaymentSignature: houseBid?.payment_signature ?? null,
    houseActivatesAt: getHouseActivationTime(
      getAuctionStartTime(Math.max(1, sequence - 1))
    ),
    startsAt,
    endsAt: getAuctionEndTime(sequence),
    status: getAuctionStatus(sequence),
  };
}

export function getAuctionById(auctionId: string): Promise<Auction> {
  const sequence = parseAuctionSequence(auctionId);
  const currentSequence = getAuctionNumber();

  if (sequence < currentSequence || sequence > currentSequence + 1) {
    throw new Error("Auction is outside the active bidding window.");
  }

  return getAuctionBySequence(sequence);
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
      "id, auction_id, wallet, amount_usdc, effective_bid_usdc, bid_multiplier, quiet_balance, payment_status, payment_signature, verification_provider, bid_source, created_at"
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
    effectiveBidUsdc: Number(bid.effective_bid_usdc ?? bid.amount_usdc ?? 0),
    bidMultiplier: Number(bid.bid_multiplier ?? 1),
    quietBalance: Number(bid.quiet_balance ?? 0),
    paymentStatus: bid.payment_status,
    paymentSignature: bid.payment_signature,
    verificationProvider: bid.verification_provider,
    bidSource: bid.bid_source ?? "user",
    createdAt: bid.created_at,
  }));
}

export async function placeBid(
  amountUsdc: number,
  wallet: string,
  requestedAuctionId: string,
  paymentSignature?: string | null
) {
  const nextAuction = await getNextAuction();
  const roundedAmount = Math.round(amountUsdc * 100) / 100;

  if (!Number.isFinite(roundedAmount) || roundedAmount < OPENING_BID_USDC) {
    return {
      success: false,
      message: `The opening bid is ${OPENING_BID_USDC.toFixed(2)} USDC.`,
      auction: nextAuction,
    };
  }

  if (!paymentSignature) {
    return {
      success: false,
      message: "A confirmed Solana USDC transaction signature is required.",
      auction: nextAuction,
    };
  }

  const existingPayment = await getExistingPayment(paymentSignature);

  if (existingPayment) {
    const existingAmount = Number(existingPayment.amount_usdc);
    const existingAuction = await getAuctionBySequence(
      parseAuctionSequence(existingPayment.auction_id)
    );

    if (
      existingPayment.wallet !== wallet ||
      existingAmount !== roundedAmount ||
      existingPayment.auction_id !== requestedAuctionId
    ) {
      return {
        success: false,
        message: "This payment receipt is already attached to a different bid.",
        auction: existingAuction,
      };
    }

    return {
      success: true,
      message: "This payment was already verified and recorded.",
      auction: existingAuction,
      bidHistory: await getBidHistory(existingAuction.id),
    };
  }

  let requestedAuction: Auction;

  try {
    requestedAuction = await getAuctionById(requestedAuctionId);
  } catch {
    return {
      success: false,
      message: "This bid has an invalid auction ID.",
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

  const isNormalNextAuction = requestedAuction.id === nextAuction.id;
  const isRecoverableCurrentAuction =
    requestedAuction.sequence === nextAuction.sequence - 1 &&
    Boolean(verification.blockTimeMs) &&
    verification.blockTimeMs! < requestedAuction.startsAt &&
    Date.now() <= requestedAuction.startsAt + PAYMENT_RECOVERY_GRACE_MS;

  if (!isNormalNextAuction && !isRecoverableCurrentAuction) {
    return {
      success: false,
      message:
        "That auction has closed. Keep the transaction receipt and contact the administrator for review.",
      auction: nextAuction,
    };
  }

  const targetAuction = isNormalNextAuction ? nextAuction : requestedAuction;
  let bidPower;

  try {
    bidPower = await getQuietBidPower(wallet);
  } catch {
    return {
      success: false,
      message:
        "USDC was received, but QUIET bid power could not be verified. Retry this saved receipt without sending another payment.",
      auction: nextAuction,
    };
  }

  const effectiveBidUsdc = calculateEffectiveBidUsdc(
    roundedAmount,
    bidPower.bidMultiplier
  );
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("bids").insert({
    auction_id: targetAuction.id,
    wallet,
    amount_usdc: roundedAmount,
    quiet_balance: bidPower.quietBalance,
    quiet_balance_slot: bidPower.snapshotSlot,
    bid_multiplier: bidPower.bidMultiplier,
    effective_bid_usdc: effectiveBidUsdc,
    payment_status: verification.status,
    payment_signature: verification.signature,
    verification_provider: verification.provider,
    bid_source: "user",
    created_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505" && verification.signature) {
      const concurrentPayment = await getExistingPayment(verification.signature);
      if (
        concurrentPayment?.wallet === wallet &&
        Number(concurrentPayment.amount_usdc) === roundedAmount &&
        concurrentPayment.auction_id === targetAuction.id
      ) {
        return {
          success: true,
          message: "This payment was already verified and recorded.",
          auction: await getAuctionById(targetAuction.id),
          bidHistory: await getBidHistory(targetAuction.id),
        };
      }
    }

    return {
      success: false,
      message: `Could not save bid: ${error.message}`,
      auction: nextAuction,
    };
  }

  const updatedAuction = await getAuctionById(targetAuction.id);
  const isLeading =
    updatedAuction.winner === wallet &&
    updatedAuction.highestEffectiveBid === effectiveBidUsdc;

  return {
    success: true,
    message: isLeading
      ? `USDC received. Your ${bidPower.bidMultiplier.toFixed(2)}x bid power produces a ${effectiveBidUsdc.toFixed(2)} USDC effective bid, and you're leading.`
      : "USDC received and your bid was recorded. Another verified bid is currently higher.",
    auction: updatedAuction,
    bidHistory: await getBidHistory(updatedAuction.id),
  };
}

export const auctionTiming = {
  blockLengthMs: BLOCK_LENGTH_MS,
  legacyBlockLengthMs: LEGACY_BLOCK_LENGTH_MS,
  thirtyMinuteScheduleStart: THIRTY_MINUTE_SCHEDULE_START,
  firstThirtyMinuteSequence: FIRST_THIRTY_MINUTE_SEQUENCE,
  startTime: START_TIME,
};
