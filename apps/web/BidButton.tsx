"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";
import { getMinimumBidUsdc, OPENING_BID_USDC } from "./lib/bid-rules";
import { sendUsdcBidPayment } from "./lib/solana-payment";
import { getSolscanTransactionUrl } from "./lib/solscan";

type Props = {
  currentHighBid: number;
  auctionId: string;
};

type PendingPayment = {
  auctionId: string;
  amountUsdc: number;
  wallet: string;
  paymentSignature: string;
};

const PENDING_PAYMENT_KEY = "attention-bid-pending-payment";
const MAX_BETA_BID_USDC = Number(
  process.env.NEXT_PUBLIC_MAX_BETA_BID_USDC ?? "100"
);

export default function BidButton({ currentHighBid, auctionId }: Props) {
  const minimumBid = useMemo(
    () => getMinimumBidUsdc(currentHighBid),
    [currentHighBid]
  );
  const [amount, setAmount] = useState(String(minimumBid));
  const [wallet, setWallet] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [receiptSignature, setReceiptSignature] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setWallet(getStoredWallet());
    return subscribeToWallet(setWallet);
  }, []);

  useEffect(() => {
    setAmount(String(minimumBid));
  }, [minimumBid]);

  useEffect(() => {
    try {
      const storedPayment = window.localStorage.getItem(PENDING_PAYMENT_KEY);
      if (!storedPayment) return;

      const parsed = JSON.parse(storedPayment) as PendingPayment;
      if (
        parsed.wallet === wallet &&
        parsed.paymentSignature
      ) {
        setPendingPayment(parsed);
      }
    } catch {
      window.localStorage.removeItem(PENDING_PAYMENT_KEY);
    }
  }, [auctionId, wallet]);

  function setStatus(
    nextMessage: string,
    nextType: "info" | "success" | "error" = "info",
    signature = ""
  ) {
    setMessage(nextMessage);
    setMessageType(nextType);
    setReceiptSignature(signature);
  }

  function getFriendlyBidError(error: unknown) {
    const rawMessage = error instanceof Error ? error.message : String(error ?? "");
    const message = rawMessage.toLowerCase();

    if (message.includes("user rejected") || message.includes("rejected the request")) {
      return "Bid canceled. No USDC was sent.";
    }

    if (message.includes("insufficient")) {
      return "Your wallet does not have enough SOL for fees or enough USDC for this bid.";
    }

    if (message.includes("usdc token account")) {
      return "This wallet does not have Solana USDC yet. Add USDC on Solana, then try again.";
    }

    if (
      message.includes("403") ||
      message.includes("access forbidden") ||
      message.includes("failed to get info about account")
    ) {
      return "The Solana connection could not complete the payment check. Please try again in a moment.";
    }

    if (message.includes("blockhash") || message.includes("timeout")) {
      return "The Solana network took too long to respond. Please try the bid again.";
    }

    if (rawMessage.startsWith("Missing NEXT_PUBLIC_")) {
      return "Solana payments are not fully configured yet. Please contact support.";
    }

    return rawMessage || "Could not complete the USDC bid.";
  }

  async function placeBid(bidAmount = Number(amount)) {
    setStatus("");

    if (!wallet) {
      setStatus("Connect Phantom before placing a USDC bid.", "error");
      return;
    }

    if (
      !Number.isFinite(bidAmount) ||
      bidAmount < minimumBid ||
      bidAmount > MAX_BETA_BID_USDC
    ) {
      setStatus(
        `Enter a bid from ${minimumBid.toFixed(2)} to ${MAX_BETA_BID_USDC.toFixed(2)} USDC.`,
        "error"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      setStatus("Approve the USDC transfer in Phantom...");
      const paymentSignature = await sendUsdcBidPayment({
        amountUsdc: bidAmount,
        wallet,
      });

      const payment = {
        auctionId,
        amountUsdc: bidAmount,
        wallet,
        paymentSignature,
      };
      window.localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment));
      setPendingPayment(payment);
      await recordPayment(payment);
    } catch (error) {
      setStatus(getFriendlyBidError(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function recordPayment(payment: PendingPayment) {
    setStatus("USDC sent. Verifying on Solana...", "info", payment.paymentSignature);

    try {
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payment),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.success) {
        setStatus(
          `${result.message ?? "Could not verify this bid."} Your receipt is saved; retry verification without sending again.`,
          "error",
          payment.paymentSignature
        );
        return;
      }

      window.localStorage.removeItem(PENDING_PAYMENT_KEY);
      setPendingPayment(null);
      setStatus(result.message ?? "USDC received and bid recorded.", "success", payment.paymentSignature);
      window.setTimeout(() => window.location.reload(), 1400);
    } catch (error) {
      setStatus(
        `${getFriendlyBidError(error)} Your receipt is saved; retry verification without sending again.`,
        "error",
        payment.paymentSignature
      );
    }
  }

  async function retryPendingPayment() {
    if (!pendingPayment) return;

    setIsSubmitting(true);
    try {
      await recordPayment(pendingPayment);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bid-card">
      <span className="eyebrow">Place your bid</span>
      <div className="quick-bids">
        {(currentHighBid > 0
          ? [1, 5, 10, 25]
          : [OPENING_BID_USDC, 1, 5, 10]
        ).map((increment) => {
          const bidAmount =
            Math.round((currentHighBid + increment) * 100) / 100;

          return (
            <button
              key={increment}
              className="quick-bid-button"
              onClick={() => placeBid(bidAmount)}
              disabled={isSubmitting || bidAmount > MAX_BETA_BID_USDC}
            >
              {currentHighBid > 0 ? `+${increment}` : bidAmount.toFixed(2)}
              <span>USDC</span>
            </button>
          );
        })}
      </div>

      <label className="bid-input">
        <span>Custom amount</span>
        <input
          type="number"
          min={minimumBid}
          max={MAX_BETA_BID_USDC}
          step="0.01"
          placeholder="Enter USDC amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <button
        className="primary-button"
        onClick={() => placeBid()}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Processing USDC..." : "Place bid"}
      </button>

      <p className="hint">
        {currentHighBid > 0
          ? `Next bid must be at least ${minimumBid.toFixed(2)} USDC.`
          : `Opening bid starts at ${OPENING_BID_USDC.toFixed(2)} USDC.`}
      </p>
      <p className="hint">
        Live beta limit: {MAX_BETA_BID_USDC.toFixed(2)} USDC per bid.
      </p>
      <p className="fine-print">
        Winner takes the attention block. All verified bids are final and are
        not refunded.
      </p>
      {pendingPayment && (
        <button
          className="ghost-button recovery-button"
          onClick={retryPendingPayment}
          disabled={isSubmitting}
        >
          Retry saved payment verification
        </button>
      )}
      {message && (
        <div className={`form-message ${messageType}`} role="status">
          <p>{message}</p>
          {receiptSignature && (
            <a
              href={getSolscanTransactionUrl(receiptSignature)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          )}
        </div>
      )}
    </section>
  );
}
