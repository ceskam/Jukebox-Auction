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
import { getNextAuction } from "./auction";
import { saveHouseAttentionContent } from "./attention";
import {
  getHouseAttention,
  HOUSE_BID_USDC,
  isHouseBotEnabled,
} from "./house";
import { verifySolanaUsdcPayment } from "./payment";
import { createSupabaseServerClient } from "./supabase/server";

const USDC_DECIMALS = 6;
const BASE_UNITS_PER_USDC = 10 ** USDC_DECIMALS;

type HouseBidReservation = {
  id: number;
  auction_id: string;
  wallet: string;
  payment_signature: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function getHouseKeypair() {
  const encodedSecret = getRequiredEnv("HOUSE_BOT_SECRET_KEY_BASE64");
  const secretBytes = Buffer.from(encodedSecret, "base64");

  if (secretBytes.length !== 64) {
    throw new Error("HOUSE_BOT_SECRET_KEY_BASE64 must decode to a 64-byte keypair.");
  }

  return Keypair.fromSecretKey(secretBytes);
}

function getDailyLimitUsdc() {
  const configured = Number(process.env.HOUSE_BOT_DAILY_LIMIT_USDC ?? "24");
  return Number.isFinite(configured) && configured >= HOUSE_BID_USDC
    ? configured
    : 24;
}

async function getHouseSpendLast24Hours() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select("amount_usdc")
    .eq("bid_source", "house")
    .in("payment_status", ["pending", "verified"])
    .gte("created_at", since)
    .returns<Array<{ amount_usdc: number | string | null }>>();

  if (error) {
    throw new Error(`Could not check the house-bot budget: ${error.message}`);
  }

  return (data ?? []).reduce(
    (total, bid) => total + Number(bid.amount_usdc ?? 0),
    0
  );
}

async function reserveHouseBid(auctionId: string, wallet: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .insert({
      auction_id: auctionId,
      wallet,
      amount_usdc: HOUSE_BID_USDC,
      payment_status: "pending",
      payment_signature: null,
      verification_provider: "house-bot-solana-usdc",
      bid_source: "house",
      created_at: new Date().toISOString(),
    })
    .select("id, auction_id, wallet, payment_signature")
    .single<HouseBidReservation>();

  if (error?.code === "23505") return undefined;
  if (error) throw new Error(`Could not reserve the house bid: ${error.message}`);
  return data;
}

async function getPendingHouseBid(auctionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bids")
    .select("id, auction_id, wallet, payment_signature")
    .eq("auction_id", auctionId)
    .eq("bid_source", "house")
    .eq("payment_status", "pending")
    .limit(1)
    .maybeSingle<HouseBidReservation>();

  if (error) {
    throw new Error(`Could not check pending house bids: ${error.message}`);
  }

  return data ?? undefined;
}

async function saveReservationSignature(id: number, signature: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("bids")
    .update({ payment_signature: signature })
    .eq("id", id)
    .eq("payment_status", "pending");

  if (error) {
    throw new Error(`USDC was sent but its receipt could not be saved: ${error.message}`);
  }
}

async function markReservationFailed(id: number, reason: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("bids")
    .update({
      payment_status: "failed",
      verification_provider: `house-bot-failed:${reason.slice(0, 80)}`,
    })
    .eq("id", id)
    .eq("payment_status", "pending");

  if (error) {
    console.error("Could not mark failed house-bot reservation.", error.message);
  }
}

async function sendHouseUsdcPayment(keypair: Keypair) {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const mintAddress = process.env.USDC_MINT_ADDRESS ?? process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS;
  const treasuryAddress =
    process.env.TREASURY_WALLET_ADDRESS ??
    process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS;

  if (!rpcUrl || !mintAddress || !treasuryAddress) {
    throw new Error("The server-side Solana RPC, USDC mint, and treasury are required.");
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const mint = new PublicKey(mintAddress);
  const treasury = new PublicKey(treasuryAddress);
  const houseWallet = keypair.publicKey;

  if (houseWallet.equals(treasury)) {
    throw new Error("The house wallet and treasury wallet must be different.");
  }

  const sourceTokenAccount = getAssociatedTokenAddressSync(mint, houseWallet);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, treasury);
  const sourceAccount = await connection.getAccountInfo(sourceTokenAccount);

  if (!sourceAccount) {
    throw new Error("The house wallet has no USDC token account on this network.");
  }

  const sourceBalance = await connection.getTokenAccountBalance(sourceTokenAccount);
  if (Number(sourceBalance.value.uiAmountString ?? "0") < HOUSE_BID_USDC) {
    throw new Error("The house wallet does not have enough USDC.");
  }

  const transaction = new Transaction();
  const treasuryAccount = await connection.getAccountInfo(treasuryTokenAccount);

  if (!treasuryAccount) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        houseWallet,
        treasuryTokenAccount,
        treasury,
        mint
      )
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      sourceTokenAccount,
      mint,
      treasuryTokenAccount,
      houseWallet,
      BigInt(Math.round(HOUSE_BID_USDC * BASE_UNITS_PER_USDC)),
      USDC_DECIMALS
    )
  );

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = houseWallet;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(keypair);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return signature;
}

async function finalizeHouseBid({
  reservation,
  sequence,
}: {
  reservation: HouseBidReservation;
  sequence: number;
}) {
  if (!reservation.payment_signature) {
    return { completed: false as const };
  }

  const verification = await verifySolanaUsdcPayment({
    amountUsdc: HOUSE_BID_USDC,
    wallet: reservation.wallet,
    paymentSignature: reservation.payment_signature,
  });

  if (!verification.ok || !verification.signature) {
    return { completed: false as const };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("bids")
    .update({
      payment_status: "verified",
      payment_signature: verification.signature,
      verification_provider: "house-bot-solana-usdc",
    })
    .eq("id", reservation.id)
    .eq("payment_status", "pending");

  if (error) {
    throw new Error(`USDC was sent but the house bid could not be finalized: ${error.message}`);
  }

  const refreshedAuction = await getNextAuction();
  const content = getHouseAttention(sequence);

  if (
    refreshedAuction.id === reservation.auction_id &&
    refreshedAuction.highestBid === 0 &&
    refreshedAuction.winner === reservation.wallet
  ) {
    await saveHouseAttentionContent({
      auctionId: reservation.auction_id,
      wallet: reservation.wallet,
      ...content,
    });
  }

  return {
    completed: true as const,
    signature: verification.signature,
    sponsor: content.sponsor,
  };
}

export async function runHouseBid() {
  if (!isHouseBotEnabled()) {
    return { success: true, action: "disabled" as const };
  }

  const nextAuction = await getNextAuction();

  if (Date.now() < nextAuction.houseActivatesAt) {
    return { success: true, action: "waiting" as const };
  }

  if (nextAuction.isHouseBid) {
    return { success: true, action: "already-complete" as const };
  }

  const pendingBid = await getPendingHouseBid(nextAuction.id);
  if (pendingBid?.payment_signature) {
    const recovered = await finalizeHouseBid({
      reservation: pendingBid,
      sequence: nextAuction.sequence,
    });

    return recovered.completed
      ? {
          success: true,
          action: "bid-recovered" as const,
          auctionId: nextAuction.id,
          signature: recovered.signature,
          sponsor: recovered.sponsor,
        }
      : { success: true, action: "pending-verification" as const };
  }

  if (pendingBid) {
    return { success: true, action: "already-reserved" as const };
  }

  if (nextAuction.highestBid > 0) {
    return { success: true, action: "user-bid-present" as const };
  }

  const spend = await getHouseSpendLast24Hours();
  if (spend + HOUSE_BID_USDC > getDailyLimitUsdc()) {
    return { success: true, action: "daily-limit" as const };
  }

  const keypair = getHouseKeypair();
  const wallet = keypair.publicKey.toBase58();
  const reservation = await reserveHouseBid(nextAuction.id, wallet);

  if (!reservation) {
    return { success: true, action: "already-reserved" as const };
  }

  let submittedSignature = "";

  try {
    const refreshedAuction = await getNextAuction();
    if (refreshedAuction.highestBid > 0) {
      await markReservationFailed(reservation.id, "user-bid-present");
      return { success: true, action: "user-bid-present" as const };
    }

    submittedSignature = await sendHouseUsdcPayment(keypair);
    await saveReservationSignature(reservation.id, submittedSignature);
    const completed = await finalizeHouseBid({
      reservation: {
        ...reservation,
        payment_signature: submittedSignature,
      },
      sequence: nextAuction.sequence,
    });

    if (!completed.completed) {
      return { success: true, action: "pending-verification" as const };
    }

    return {
      success: true,
      action: "bid-created" as const,
      auctionId: nextAuction.id,
      signature: completed.signature,
      sponsor: completed.sponsor,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown house-bot error.";
    if (!submittedSignature) {
      await markReservationFailed(reservation.id, message);
    } else {
      console.error("House USDC was sent and needs manual reconciliation.", {
        auctionId: reservation.auction_id,
        signature: submittedSignature,
      });
    }
    throw error;
  }
}
