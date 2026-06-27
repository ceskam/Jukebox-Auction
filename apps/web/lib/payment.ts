export type PaymentVerification = {
  ok: boolean;
  status: "verified" | "failed";
  signature: string | null;
  provider: "demo-solana-usdc";
  message?: string;
};

type DemoPaymentInput = {
  amountUsdc: number;
  wallet: string;
  paymentSignature?: string | null;
};

export function verifyDemoUsdcPayment({
  amountUsdc,
  wallet,
  paymentSignature,
}: DemoPaymentInput): PaymentVerification {
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
