import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Transaction,
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
  return BigInt(Math.round(amountUsdc * LAMPORTS_PER_USDC));
}

export async function sendUsdcBidPayment({
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
