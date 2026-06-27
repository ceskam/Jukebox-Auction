import db from "./db";
import { verifyDemoUsdcPayment } from "./payment";

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

function ensureAuction(sequence: number) {
  const id = getAuctionIdFromSequence(sequence);
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO auctions (id, sequence, starts_at, ends_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      status = excluded.status
    `
  ).run(
    id,
    sequence,
    getAuctionStartTime(sequence),
    getAuctionEndTime(sequence),
    getAuctionStatus(sequence),
    now
  );

  return id;
}

function getHighestBid(auctionId: string) {
  return db
    .prepare(
      `
      SELECT wallet, COALESCE(amount_usdc, amount) AS amount_usdc
      FROM bids
      WHERE auction_id = ? AND payment_status = 'verified'
      ORDER BY COALESCE(amount_usdc, amount) DESC, created_at ASC
      LIMIT 1
      `
    )
    .get(auctionId) as { wallet: string; amount_usdc: number } | undefined;
}

export function getAuctionBySequence(sequence: number): Auction {
  const auctionId = ensureAuction(sequence);
  const highestBid = getHighestBid(auctionId);

  return {
    id: auctionId,
    sequence,
    highestBid: highestBid?.amount_usdc ?? 0,
    winner: highestBid?.wallet ?? null,
    startsAt: getAuctionStartTime(sequence),
    endsAt: getAuctionEndTime(sequence),
    status: getAuctionStatus(sequence),
  };
}

export function getAuctionById(auctionId: string): Auction {
  return getAuctionBySequence(parseAuctionSequence(auctionId));
}

export function getCurrentAuction(): Auction {
  return getAuctionBySequence(getAuctionNumber());
}

export function getNextAuction(): Auction {
  return getAuctionBySequence(getAuctionNumber(1));
}

export function getBidHistory(auctionId: string, limit = 8): Bid[] {
  return (
    db
      .prepare(
        `
        SELECT
          id,
          auction_id AS auctionId,
          wallet,
          COALESCE(amount_usdc, amount) AS amountUsdc,
          payment_status AS paymentStatus,
          payment_signature AS paymentSignature,
          verification_provider AS verificationProvider,
          created_at AS createdAt
        FROM bids
        WHERE auction_id = ? AND payment_status = 'verified'
        ORDER BY created_at DESC
        LIMIT ?
        `
      )
      .all(auctionId, limit) as Bid[]
  ).map((bid) => ({
    ...bid,
    amountUsdc: Number(bid.amountUsdc),
  }));
}

export function placeBid(
  amountUsdc: number,
  wallet: string,
  paymentSignature?: string | null
) {
  const nextAuction = getNextAuction();
  const roundedAmount = Math.round(amountUsdc * 100) / 100;

  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    return {
      success: false,
      message: "Enter a valid USDC bid amount.",
      auction: nextAuction,
    };
  }

  if (roundedAmount <= nextAuction.highestBid) {
    return {
      success: false,
      message: `Bid must be higher than ${nextAuction.highestBid.toFixed(2)} USDC.`,
      auction: nextAuction,
    };
  }

  const verification = verifyDemoUsdcPayment({
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

  db.prepare(
    `
    INSERT INTO bids (
      auction_id,
      wallet,
      amount,
      amount_usdc,
      payment_status,
      payment_signature,
      verification_provider,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    nextAuction.id,
    wallet,
    Math.round(roundedAmount),
    roundedAmount,
    verification.status,
    verification.signature,
    verification.provider,
    new Date().toISOString()
  );

  const updatedAuction = getNextAuction();

  return {
    success: true,
    message: "Bid accepted for the next Attention Bid block.",
    auction: updatedAuction,
    bidHistory: getBidHistory(updatedAuction.id),
  };
}

export const auctionTiming = {
  blockLengthMs: BLOCK_LENGTH_MS,
  startTime: START_TIME,
};
