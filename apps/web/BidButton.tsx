"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";
import { getMinimumBidUsdc, OPENING_BID_USDC } from "./lib/bid-rules";
import { calculateEffectiveBidUsdc } from "./lib/bid-power-math";
import { sendUsdcBidPayment } from "./lib/solana-payment";
import { getSolscanTransactionUrl } from "./lib/solscan";

type Props = {
  currentHighestEffectiveBid: number;
  auctionId: string;
};

type BidPower = {
  quietBalance: number;
  bidMultiplier: number;
  mintAddress: string;
};

type PendingPayment = {
  auctionId: string;
  amountUsdc: number;
  wallet: string;
  paymentSignature: string;
};

const PENDING_PAYMENT_KEY = "attention-bid-pending-payment";
const LARGE_BID_CONFIRMATION_USDC = 100;
const QUIET_COIN_URL =
  "https://pump.fun/coin/JCfSVdmBNKwMnMUMccfNbQQVVJKYsQNbXCqhdRuZpump";

export default function BidButton({
  currentHighestEffectiveBid,
  auctionId,
}: Props) {
  const [bidPower, setBidPower] = useState<BidPower>({
    quietBalance: 0,
    bidMultiplier: 1,
    mintAddress: "JCfSVdmBNKwMnMUMccfNbQQVVJKYsQNbXCqhdRuZpump",
  });
  const [bidPowerStatus, setBidPowerStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const minimumBid = useMemo(
    () =>
      getMinimumBidUsdc(
        currentHighestEffectiveBid,
        bidPower.bidMultiplier
      ),
    [currentHighestEffectiveBid, bidPower.bidMultiplier]
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

  async function refreshBidPower(signal?: AbortSignal) {
    if (!wallet) {
      setBidPowerStatus("idle");
      setBidPower((current) => ({
        ...current,
        quietBalance: 0,
        bidMultiplier: 1,
      }));
      return;
    }

    setBidPowerStatus("loading");

    try {
      const response = await fetch("/api/bid-power", {
        cache: "no-store",
        signal,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Could not verify QUIET balance.");
      }

      setBidPower(result.bidPower as BidPower);
      setBidPowerStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBidPowerStatus("error");
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not verify QUIET bid power.",
        "error"
      );
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshBidPower(controller.signal);
    return () => controller.abort();
  }, [wallet]);

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

    if (bidPowerStatus !== "ready") {
      setStatus(
        "Refresh your QUIET bid power before sending USDC.",
        "error"
      );
      return;
    }

    if (
      !Number.isFinite(bidAmount) ||
      bidAmount < minimumBid
    ) {
      setStatus(
        `Enter a bid of at least ${minimumBid.toFixed(2)} USDC.`,
        "error"
      );
      return;
    }

    if (
      bidAmount >= LARGE_BID_CONFIRMATION_USDC &&
      !window.confirm(
        `This will send ${bidAmount.toFixed(2)} USDC. Bids are final and are not refundable. Continue?`
      )
    ) {
      setStatus("Bid canceled. No USDC was sent.");
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
      <div className="bid-power-vault">
        <div className="bid-power-heading">
          <div>
            <span className="eyebrow">QUIET Bid Power Vault</span>
            <strong>
              {wallet && bidPowerStatus === "ready"
                ? `${bidPower.bidMultiplier.toFixed(3).replace(/\.?0+$/, "")}x power`
                : "Connect and verify"}
            </strong>
          </div>
          {wallet && (
            <button
              className="ghost-button"
              type="button"
              onClick={() => void refreshBidPower()}
              disabled={bidPowerStatus === "loading" || isSubmitting}
            >
              {bidPowerStatus === "loading" ? "Checking..." : "Refresh"}
            </button>
          )}
        </div>
        <p>
          {bidPowerStatus === "ready"
            ? `${bidPower.quietBalance.toLocaleString(undefined, {
                maximumFractionDigits: 3,
              })} QUIET verified in this wallet.`
            : "Hold QUIET in your connected wallet to increase your bid power."}
        </p>
        <p className="bid-power-formula">
          Effective bid = USDC bid x min(10, 1 + QUIET / 1,000,000)
        </p>
        <p className="fine-print">
          Non-custodial beta: the server snapshots your wallet balance when the
          bid is recorded. Tokens stay in your wallet and are not locked or
          transferred. Maximum power is 10x at 9,000,000 QUIET.
        </p>
        <a href={QUIET_COIN_URL} target="_blank" rel="noreferrer">
          View QUIET Coin and verify the mint
        </a>
        <code className="quiet-mint">{bidPower.mintAddress}</code>
      </div>
      <div className="quick-bids">
        {(currentHighestEffectiveBid > 0
          ? [minimumBid, minimumBid + 1, minimumBid + 5, minimumBid + 10]
          : [OPENING_BID_USDC, 1, 5, 10]
        ).map((value) => {
          const bidAmount = Math.round(value * 100) / 100;

          return (
            <button
              key={bidAmount}
              className="quick-bid-button"
              onClick={() => placeBid(bidAmount)}
              disabled={isSubmitting || bidPowerStatus !== "ready"}
            >
              {bidAmount.toFixed(2)}
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
        disabled={isSubmitting || !wallet || bidPowerStatus !== "ready"}
      >
        {isSubmitting ? "Processing USDC..." : "Place bid"}
      </button>

      <p className="hint">
        {currentHighestEffectiveBid > 0
          ? `With your ${bidPower.bidMultiplier.toFixed(3).replace(/\.?0+$/, "")}x power, the next bid must be at least ${minimumBid.toFixed(2)} USDC.`
          : `Opening bid starts at ${OPENING_BID_USDC.toFixed(2)} USDC.`}
      </p>
      <p className="hint">
        Estimated effective bid:{" "}
        {calculateEffectiveBidUsdc(
          Number(amount),
          bidPower.bidMultiplier
        ).toFixed(2)} USDC.
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
