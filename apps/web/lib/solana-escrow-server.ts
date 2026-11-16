import { createHash } from "node:crypto";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const USDC_BASE_UNITS = 1_000_000;

function discriminator(name: string) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64(value: bigint) {
  const result = Buffer.alloc(8);
  result.writeBigUInt64LE(value);
  return result;
}

function i64(value: bigint) {
  const result = Buffer.alloc(8);
  result.writeBigInt64LE(value);
  return result;
}

function escrowConfig() {
  if (process.env.WINNER_ONLY_AUCTIONS_ENABLED !== "true") throw new Error("Winner-only auctions are not enabled.");
  if (process.env.WALLET_ESCROW_ENABLED !== "true") throw new Error("Wallet escrow bidding is not enabled.");
  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
  const programAddress = process.env.SOLANA_ESCROW_PROGRAM_ID ?? "";
  const secret = process.env.SOLANA_ESCROW_AUTHORITY_SECRET_KEY_BASE64 ?? "";
  const mintAddress = process.env.USDC_MINT_ADDRESS ?? process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS ?? "";
  const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS ?? process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS ?? "";
  if (!rpcUrl || !programAddress || !secret || !mintAddress || !treasuryAddress) throw new Error("Wallet escrow is missing server configuration.");
  const decoded = Buffer.from(secret, "base64");
  if (decoded.length !== 64) throw new Error("Escrow authority secret must be a base64-encoded 64-byte Solana keypair.");
  return {
    connection: new Connection(rpcUrl, "confirmed"),
    programId: new PublicKey(programAddress),
    authority: Keypair.fromSecretKey(decoded),
    mint: new PublicKey(mintAddress),
    treasuryWallet: new PublicKey(treasuryAddress),
  };
}

export function getEscrowAvailability() {
  try {
    const config = escrowConfig();
    return { enabled: true, programId: config.programId.toBase58() };
  } catch (error) {
    return { enabled: false, programId: "", reason: error instanceof Error ? error.message : "Wallet escrow is unavailable." };
  }
}

export function deriveAuctionEscrow(programId: PublicKey, sequence: number) {
  return PublicKey.findProgramAddressSync([Buffer.from("auction"), u64(BigInt(sequence))], programId)[0];
}

export async function ensureAuctionEscrow(sequence: number, closesAtMs: number) {
  const { connection, programId, authority, mint, treasuryWallet } = escrowConfig();
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const auctionPda = deriveAuctionEscrow(programId, sequence);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, treasuryWallet);

  if (!(await connection.getAccountInfo(configPda, "confirmed"))) {
    const instruction = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: treasuryTokenAccount, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator("initialize_config"),
    });
    await sendAndConfirmTransaction(connection, new Transaction().add(instruction), [authority], { commitment: "confirmed" });
  }

  if (!(await connection.getAccountInfo(auctionPda, "confirmed"))) {
    const data = Buffer.concat([discriminator("initialize_auction"), u64(BigInt(sequence)), i64(BigInt(Math.floor(closesAtMs / 1000)))]);
    const instruction = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: auctionPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    try {
      await sendAndConfirmTransaction(connection, new Transaction().add(instruction), [authority], { commitment: "confirmed" });
    } catch (error) {
      if (!(await connection.getAccountInfo(auctionPda, "confirmed"))) throw error;
    }
  }
  return { programId: programId.toBase58(), auctionPda: auctionPda.toBase58(), sequence };
}

export async function verifyEscrowDeposit({
  sequence,
  auctionPda,
  escrowPda,
  wallet,
  amountUsdc,
  nonce,
  signature,
}: {
  sequence: number;
  auctionPda: string;
  escrowPda: string;
  wallet: string;
  amountUsdc: number;
  nonce: string;
  signature: string;
}) {
  const { connection, programId } = escrowConfig();
  const bidder = new PublicKey(wallet);
  const expectedAuction = deriveAuctionEscrow(programId, sequence);
  if (expectedAuction.toBase58() !== auctionPda) throw new Error("Auction escrow address does not match.");
  const nonceValue = BigInt(nonce);
  const [expectedBid] = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), expectedAuction.toBuffer(), bidder.toBuffer(), u64(nonceValue)],
    programId
  );
  if (expectedBid.toBase58() !== escrowPda) throw new Error("Bid escrow address does not match.");

  const [transaction, account] = await Promise.all([
    connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }),
    connection.getAccountInfo(expectedBid, "confirmed"),
  ]);
  if (!transaction || transaction.meta?.err) throw new Error("Escrow deposit transaction is not confirmed.");
  if (!account || !account.owner.equals(programId)) throw new Error("Escrow bid account was not created by the configured program.");
  if (!transaction.transaction.message.staticAccountKeys.some((key) => key.equals(expectedBid))) throw new Error("Deposit receipt does not include this escrow account.");
  const data = Buffer.from(account.data);
  if (data.length < 90) throw new Error("Escrow bid account is malformed.");
  const storedAuction = new PublicKey(data.subarray(8, 40));
  const storedBidder = new PublicKey(data.subarray(40, 72));
  const storedAmount = data.readBigUInt64LE(72);
  const storedNonce = data.readBigUInt64LE(80);
  const status = data[88];
  const expectedAmount = BigInt(Math.round(amountUsdc * USDC_BASE_UNITS));
  if (!storedAuction.equals(expectedAuction) || !storedBidder.equals(bidder) || storedAmount !== expectedAmount || storedNonce !== nonceValue || status !== 0) {
    throw new Error("Escrow account data does not match this bid.");
  }
  return { ok: true, escrowPda: expectedBid.toBase58(), signature };
}

function auctionState(data: Buffer) {
  if (data.length < 59) throw new Error("Auction escrow account is malformed.");
  return {
    finalized: data[24] === 1,
    winnerKind: data[25],
    winningBid: new PublicKey(data.subarray(26, 58)),
  };
}

export async function finalizeAuctionEscrow(sequence: number, winnerKind: 0 | 1 | 2, winningBidPda = "") {
  const { connection, programId, authority } = escrowConfig();
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const auctionPda = deriveAuctionEscrow(programId, sequence);
  const info = await connection.getAccountInfo(auctionPda, "confirmed");
  if (!info) return { signature: "", skipped: true };
  const winner = winnerKind === 1 ? new PublicKey(winningBidPda) : SystemProgram.programId;
  const current = auctionState(Buffer.from(info.data));
  if (current.finalized) {
    const matchingWinner = winnerKind !== 1 || current.winningBid.equals(winner);
    if (current.winnerKind !== winnerKind || !matchingWinner) throw new Error("Auction escrow was finalized with a different winner.");
    return { signature: "", replay: true };
  }
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: auctionPda, isSigner: false, isWritable: true },
      { pubkey: winner, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([discriminator("finalize_auction"), Buffer.from([winnerKind])]),
  });
  const signature = await sendAndConfirmTransaction(connection, new Transaction().add(instruction), [authority], { commitment: "confirmed" });
  return { signature };
}

export async function getAuctionEscrowState(sequence: number) {
  const { connection, programId } = escrowConfig();
  const auctionPda = deriveAuctionEscrow(programId, sequence);
  const info = await connection.getAccountInfo(auctionPda, "confirmed");
  if (!info) return undefined;
  const data = Buffer.from(info.data);
  if (data.length < 107) throw new Error("Auction escrow account is malformed.");
  return {
    address: auctionPda.toBase58(),
    ...auctionState(data),
    highestWalletAmount: data.readBigUInt64LE(58),
    highestWalletBid: new PublicKey(data.subarray(66, 98)).toBase58(),
    bidCount: data.readBigUInt64LE(98),
  };
}

export async function settleWalletEscrowBid({ sequence, escrowPda, bidderWallet, payTreasury }: { sequence: number; escrowPda: string; bidderWallet: string; payTreasury: boolean }) {
  const { connection, programId, authority, mint, treasuryWallet } = escrowConfig();
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const auctionPda = deriveAuctionEscrow(programId, sequence);
  const bid = new PublicKey(escrowPda);
  const bidder = new PublicKey(bidderWallet);
  const vault = getAssociatedTokenAddressSync(mint, bid, true);
  const destination = payTreasury
    ? getAssociatedTokenAddressSync(mint, treasuryWallet)
    : getAssociatedTokenAddressSync(mint, bidder);
  const transaction = new Transaction();
  if (!payTreasury && !(await connection.getAccountInfo(destination, "confirmed"))) {
    transaction.add(createAssociatedTokenAccountInstruction(authority.publicKey, destination, bidder, mint));
  }
  transaction.add(new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: auctionPda, isSigner: false, isWritable: false },
      { pubkey: bid, isSigner: false, isWritable: true },
      { pubkey: bidder, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: discriminator("settle_bid"),
  }));
  const signature = await sendAndConfirmTransaction(connection, transaction, [authority], { commitment: "confirmed" });
  return { signature };
}
