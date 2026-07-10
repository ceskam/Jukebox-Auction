"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";
import { sendUsdcBidPayment } from "./lib/solana-payment";
import { getSolscanTransactionUrl } from "./lib/solscan";

type Props = {
  currentHighBid: number;
};

export default function BidButton({ currentHighBid }: Props) {
  const minimumBid = useMemo(() => Math.round((currentHighBid + 1) * 100) / 100, [currentHighBid]);
  const [amount, setAmount] = useState(String(minimumBid));
  const [wallet, setWallet] = useState("");
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

    setIsSubmitting(true);

    try {
      setStatus("Approve the USDC transfer in Phantom...");
      const paymentSignature = await sendUsdcBidPayment({
        amountUsdc: bidAmount,
        wallet,
      });

      setStatus("USDC sent. Verifying on Solana...", "info", paymentSignature);
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amountUsdc: bidAmount,
          wallet,
          paymentSignature,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setStatus(result.message ?? "Could not verify this bid.", "error", paymentSignature);
        return;
      }

      setStatus(
        "USDC received. You're leading the next block.",
        "success",
        paymentSignature
      );
      window.setTimeout(() => window.location.reload(), 1400);
    } catch (error) {
      setStatus(getFriendlyBidError(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bid-card">
      <span className="eyebrow">Place your bid</span>
      <div className="quick-bids">
        {[1, 5, 10, 25].map((increment) => {
          const bidAmount = Math.round((currentHighBid + increment) * 100) / 100;

          return (
            <button
              key={increment}
              className="quick-bid-button"
              onClick={() => placeBid(bidAmount)}
              disabled={isSubmitting}
            >
              +{increment}
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

      <p className="hint">Next bid must be higher than {currentHighBid.toFixed(2)} USDC.</p>
      <p className="fine-print">
        Winner takes the attention block. All verified bids are final and are
        not refunded.
      </p>
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
