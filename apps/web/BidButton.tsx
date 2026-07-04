"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";
import { sendUsdcBidPayment } from "./lib/solana-payment";

type Props = {
  currentHighBid: number;
};

export default function BidButton({ currentHighBid }: Props) {
  const minimumBid = useMemo(() => Math.round((currentHighBid + 1) * 100) / 100, [currentHighBid]);
  const [amount, setAmount] = useState(String(minimumBid));
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setWallet(getStoredWallet());
    return subscribeToWallet(setWallet);
  }, []);

  useEffect(() => {
    setAmount(String(minimumBid));
  }, [minimumBid]);

  async function placeBid(bidAmount = Number(amount)) {
    setMessage("");

    if (!wallet) {
      setMessage("Connect Phantom before placing a USDC bid.");
      return;
    }

    setIsSubmitting(true);

    try {
      setMessage("Approve the USDC transfer in Phantom...");
      const paymentSignature = await sendUsdcBidPayment({
        amountUsdc: bidAmount,
        wallet,
      });

      setMessage("USDC sent. Verifying on Solana...");
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
        setMessage(result.message);
        return;
      }

      setMessage("Bid accepted. Refreshing the auction...");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete the USDC bid.");
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
      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
