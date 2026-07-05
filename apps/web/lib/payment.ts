import {
  Connection,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const USDC_DECIMALS = 6;
const LAMPORTS_PER_USDC = 10 ** USDC_DECIMALS;

export type PaymentVerification = {
  ok: boolean;
  status: "verified" | "failed";
  signature: string | null;
  provider: "demo-solana-usdc" | "solana-usdc";
  message?: string;
};

type PaymentInput = {
  amountUsdc: number;
  wallet: string;
  paymentSignature?: string | null;
};

function isDemoPaymentsEnabled() {
  return process.env.ENABLE_DEMO_PAYMENTS === "true";
}

function getSolanaRpcUrl() {
  return process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
}

function getUsdcMintAddress() {
  return process.env.USDC_MINT_ADDRESS ?? process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS;
}

function getTreasuryWalletAddress() {
  return (
    process.env.TREASURY_WALLET_ADDRESS ??
    process.env.NEXT_PUBLIC_TREASURY_WALLET_ADDRESS
  );
}

function toUsdcBaseUnits(amountUsdc: number) {
  return BigInt(Math.round(amountUsdc * LAMPORTS_PER_USDC));
}

function normalizeTokenAmount(amount: unknown) {
  if (typeof amount === "number") return BigInt(amount);
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "string" && /^\d+$/.test(amount)) return BigInt(amount);
  return undefined;
}

function getParsedTokenAmount(info: Record<string, unknown>) {
  const tokenAmount = info.tokenAmount;

  if (tokenAmount && typeof tokenAmount === "object" && "amount" in tokenAmount) {
    return normalizeTokenAmount((tokenAmount as { amount?: unknown }).amount);
  }

  return normalizeTokenAmount(info.amount);
}

function isParsedInstruction(
  instruction: ParsedInstruction | PartiallyDecodedInstruction
): instruction is ParsedInstruction {
  return "parsed" in instruction;
}

function verifyTransferInstruction({
  instruction,
  wallet,
  amountUsdc,
  usdcMint,
  treasuryTokenAccount,
}: {
  instruction: ParsedInstruction | PartiallyDecodedInstruction;
  wallet: string;
  amountUsdc: number;
  usdcMint: PublicKey;
  treasuryTokenAccount: PublicKey;
}) {
  if (!isParsedInstruction(instruction)) return false;
  if (instruction.program !== "spl-token") return false;

  const parsed = instruction.parsed;
  if (!parsed || typeof parsed !== "object") return false;

  const type = (parsed as { type?: string }).type;
  if (type !== "transfer" && type !== "transferChecked") return false;

  const info = (parsed as { info?: Record<string, unknown> }).info;
  if (!info) return false;

  const destination = String(info.destination ?? "");
  const owner = String(info.owner ?? info.authority ?? "");
  const mint = info.mint ? String(info.mint) : usdcMint.toBase58();
  const amount = getParsedTokenAmount(info);

  return (
    owner === wallet &&
    destination === treasuryTokenAccount.toBase58() &&
    mint === usdcMint.toBase58() &&
    amount === toUsdcBaseUnits(amountUsdc)
  );
}

function isRecentTransaction(blockTime: number | null | undefined) {
  if (!blockTime) return false;

  const maxAgeMs = 20 * 60 * 1000;
  return Date.now() - blockTime * 1000 <= maxAgeMs;
}

export async function verifySolanaUsdcPayment({
  amountUsdc,
  wallet,
  paymentSignature,
}: PaymentInput): Promise<PaymentVerification> {
  if (!wallet) {
    return {
      ok: false,
      status: "failed",
      signature: null,
      provider: "solana-usdc",
      message: "Connect a wallet before placing a bid.",
    };
  }

  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return {
      ok: false,
      status: "failed",
      signature: null,
      provider: "solana-usdc",
      message: "Enter a valid USDC bid amount.",
    };
  }

  if (!paymentSignature) {
    return {
      ok: false,
      status: "failed",
      signature: null,
      provider: "solana-usdc",
      message: "A confirmed Solana USDC transaction signature is required.",
    };
  }

  const rpcUrl = getSolanaRpcUrl();
  const usdcMintAddress = getUsdcMintAddress();
  const treasuryWalletAddress = getTreasuryWalletAddress();

  if (!rpcUrl || !usdcMintAddress || !treasuryWalletAddress) {
    if (isDemoPaymentsEnabled()) {
      return verifyDemoUsdcPayment({ amountUsdc, wallet, paymentSignature });
    }

    return {
      ok: false,
      status: "failed",
      signature: paymentSignature,
      provider: "solana-usdc",
      message: "Solana USDC payment verification is not configured.",
    };
  }

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const usdcMint = new PublicKey(usdcMintAddress);
    const treasuryWallet = new PublicKey(treasuryWalletAddress);
    const treasuryTokenAccount = getAssociatedTokenAddressSync(usdcMint, treasuryWallet);
    const transaction = await connection.getParsedTransaction(paymentSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return {
        ok: false,
        status: "failed",
        signature: paymentSignature,
        provider: "solana-usdc",
        message: "Could not find a confirmed Solana transaction for this bid.",
      };
    }

    if (transaction.meta?.err) {
      return {
        ok: false,
        status: "failed",
        signature: paymentSignature,
        provider: "solana-usdc",
        message: "The Solana transaction failed on-chain.",
      };
    }

    if (!isRecentTransaction(transaction.blockTime)) {
      return {
        ok: false,
        status: "failed",
        signature: paymentSignature,
        provider: "solana-usdc",
        message: "The Solana transaction is too old for this bid.",
      };
    }

    const hasVerifiedTransfer = transaction.transaction.message.instructions.some((instruction) =>
      verifyTransferInstruction({
        instruction,
        wallet,
        amountUsdc,
        usdcMint,
        treasuryTokenAccount,
      })
    );

    if (!hasVerifiedTransfer) {
      return {
        ok: false,
        status: "failed",
        signature: paymentSignature,
        provider: "solana-usdc",
        message: "The transaction did not send the exact USDC bid amount to the treasury wallet.",
      };
    }

    return {
      ok: true,
      status: "verified",
      signature: paymentSignature,
      provider: "solana-usdc",
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      signature: paymentSignature,
      provider: "solana-usdc",
      message: "Could not verify the Solana USDC transaction.",
    };
  }
}

export function verifyDemoUsdcPayment({
  amountUsdc,
  wallet,
  paymentSignature,
}: PaymentInput): PaymentVerification {
  if (!wallet) {
    return {
      ok: false,
      status: "failed",
      signature: null,
      provider: "demo-solana-usdc",
      message: "Connect a wallet before placing a bid.",
    };
  }

  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    return {
      ok: false,
      status: "failed",
      signature: null,
      provider: "demo-solana-usdc",
      message: "Enter a valid USDC bid amount.",
    };
  }

  return {
    ok: true,
    status: "verified",
    signature:
      paymentSignature ||
      `demo-usdc-${wallet.slice(0, 6)}-${Date.now().toString(36)}`,
    provider: "demo-solana-usdc",
  };
}
