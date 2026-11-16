import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const USDC_DECIMALS = 6;
const LAMPORTS_PER_USDC = 10 ** USDC_DECIMALS;
const PUBLIC_SOLANA_CONFIG = {
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  NEXT_PUBLIC_USDC_MINT_ADDRESS: process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS,
  NEXT_PUBLIC_TREASURY_WALLET_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS,
};

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

function getRequiredPublicEnv(name: keyof typeof PUBLIC_SOLANA_CONFIG) {
  const value = PUBLIC_SOLANA_CONFIG[name];

  if (!value) {
    throw new Error(`Missing ${name}. Configure Solana USDC payments before bidding.`);
  }

  return value;
}

function getProvider(): PhantomProvider {
  const provider = (window as any).phantom?.solana;

  if (!provider?.isPhantom) {
    throw new Error("Phantom wallet not found. Install Phantom to bid with USDC.");
  }

  return provider;
}

function toUsdcBaseUnits(amountUsdc: number) {
  const baseUnits = Math.round(amountUsdc * LAMPORTS_PER_USDC);

  if (!Number.isFinite(amountUsdc) || !Number.isSafeInteger(baseUnits)) {
    throw new Error("This bid amount is too large to send safely.");
  }

  return BigInt(baseUnits);
}

function u64(value: bigint) {
  const result = new Uint8Array(8);
  new DataView(result.buffer).setBigUint64(0, value, true);
  return result;
}

async function anchorDiscriminator(name: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`global:${name}`));
  return new Uint8Array(digest).slice(0, 8);
}

async function sendPhantomTransaction(transaction: Transaction, bidderWallet: PublicKey, connection: Connection) {
  const provider = getProvider();
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = bidderWallet;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  if (provider.signAndSendTransaction) {
    const { signature } = await provider.signAndSendTransaction(transaction);
    await connection.confirmTransaction({ signature, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight }, "confirmed");
    return signature;
  }
  if (!provider.signTransaction) throw new Error("Phantom does not support transaction signing in this browser.");
  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function depositUsdcBidEscrow({ amountUsdc, wallet, auctionId }: { amountUsdc: number; wallet: string; auctionId: string }) {
  const preparedResponse = await fetch("/api/bid/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auctionId }),
  });
  const prepared = await preparedResponse.json();
  if (!preparedResponse.ok || !prepared.success) throw new Error(prepared.message ?? "Wallet escrow is not ready.");

  const rpcUrl = getRequiredPublicEnv("NEXT_PUBLIC_SOLANA_RPC_URL");
  const mint = new PublicKey(getRequiredPublicEnv("NEXT_PUBLIC_USDC_MINT_ADDRESS"));
  const bidder = new PublicKey(wallet);
  const programId = new PublicKey(String(prepared.programId));
  const auctionPda = new PublicKey(String(prepared.auctionPda));
  const connection = new Connection(rpcUrl, "confirmed");
  const nonceBytes = crypto.getRandomValues(new Uint8Array(8));
  const nonce = new DataView(nonceBytes.buffer).getBigUint64(0, true);
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("bid"), auctionPda.toBuffer(), bidder.toBuffer(), u64(nonce)],
    programId
  );
  const source = getAssociatedTokenAddressSync(mint, bidder);
  const vault = getAssociatedTokenAddressSync(mint, escrowPda, true);
  if (!(await connection.getAccountInfo(source))) throw new Error("This wallet does not have a USDC token account for the configured network.");
  const data = new Uint8Array(24);
  data.set(await anchorDiscriminator("deposit_bid"), 0);
  data.set(u64(toUsdcBaseUnits(amountUsdc)), 8);
  data.set(u64(nonce), 16);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: bidder, isSigner: true, isWritable: true },
      { pubkey: auctionPda, isSigner: false, isWritable: false },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  const signature = await sendPhantomTransaction(new Transaction().add(instruction), bidder, connection);
  return {
    paymentSignature: signature,
    escrowPda: escrowPda.toBase58(),
    escrowNonce: nonce.toString(),
    auctionPda: auctionPda.toBase58(),
    sequence: Number(prepared.sequence),
  };
}

export async function sendUsdcPayment({
  amountUsdc,
  wallet,
}: {
  amountUsdc: number;
  wallet: string;
}) {
  const rpcUrl = getRequiredPublicEnv("NEXT_PUBLIC_SOLANA_RPC_URL");
  const usdcMint = new PublicKey(getRequiredPublicEnv("NEXT_PUBLIC_USDC_MINT_ADDRESS"));
  const treasuryWallet = new PublicKey(getRequiredPublicEnv("NEXT_PUBLIC_TREASURY_WALLET_ADDRESS"));
  const bidderWallet = new PublicKey(wallet);
  const provider = getProvider();
  const connection = new Connection(rpcUrl, "confirmed");

  const sourceTokenAccount = getAssociatedTokenAddressSync(usdcMint, bidderWallet);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(usdcMint, treasuryWallet);
  const sourceAccount = await connection.getAccountInfo(sourceTokenAccount);

  if (!sourceAccount) {
    throw new Error("This wallet does not have a USDC token account for the configured network.");
  }

  const transaction = new Transaction();
  const treasuryAccount = await connection.getAccountInfo(treasuryTokenAccount);

  if (!treasuryAccount) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        bidderWallet,
        treasuryTokenAccount,
        treasuryWallet,
        usdcMint
      )
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      sourceTokenAccount,
      usdcMint,
      treasuryTokenAccount,
      bidderWallet,
      toUsdcBaseUnits(amountUsdc),
      USDC_DECIMALS
    )
  );

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = bidderWallet;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  if (provider.signAndSendTransaction) {
    const { signature } = await provider.signAndSendTransaction(transaction);
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

  if (!provider.signTransaction) {
    throw new Error("Phantom does not support transaction signing in this browser.");
  }

  const signedTransaction = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
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

export const sendUsdcBidPayment = sendUsdcPayment;
