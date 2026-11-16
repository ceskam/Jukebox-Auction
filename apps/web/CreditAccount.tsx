"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "./lib/supabase/client";

type Props = {
  auctionId: string;
  minimumBid: number;
};

export default function CreditAccount({ auctionId, minimumBid }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [balance, setBalance] = useState(0);
  const [reserved, setReserved] = useState(0);
  const [deficit, setDeficit] = useState(0);
  const [accountStatus, setAccountStatus] = useState<"active" | "frozen">("active");
  const [purchaseCredits, setPurchaseCredits] = useState(25);
  const [feePercent, setFeePercent] = useState(0);
  const [stripe, setStripe] = useState<any>({ enabled: false, reason: "Card purchases are loading." });
  const [bidAmount, setBidAmount] = useState(String(minimumBid));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      setAccessToken(session?.access_token ?? "");
      setSignedInEmail(session?.user.email ?? "");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? "");
      setSignedInEmail(session?.user.email ?? "");
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => setBidAmount(String(minimumBid)), [minimumBid]);

  async function refresh(token = accessToken) {
    if (!token) return;
    const response = await fetch("/api/credits", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Could not load credits.");
    setBalance(result.balanceCredits);
    setReserved(result.reservedCredits);
    setDeficit(result.deficitCredits);
    setAccountStatus(result.status);
    setFeePercent(result.feePercent);
    setStripe(result.stripe);
  }

  useEffect(() => {
    if (!accessToken) return;
    void refresh(accessToken).catch((error) => setMessage(error.message));
  }, [accessToken]);

  async function sendMagicLink() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/#platform-credits` },
    });
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    setBusy(false);
  }

  async function buyCredits() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ credits: purchaseCredits }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not start checkout.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start checkout.");
      setBusy(false);
    }
  }

  async function placeBid() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/credits/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ auctionId, amount: Number(bidAmount) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not place credit bid.");
      setMessage(result.message);
      await refresh();
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place credit bid.");
    } finally {
      setBusy(false);
    }
  }

  const feeUsd = Math.round(purchaseCredits * feePercent) / 100;
  const totalUsd = Math.round((purchaseCredits + feeUsd) * 100) / 100;

  return (
    <section className="credit-card" id="platform-credits">
      <span className="eyebrow">No Phantom required</span>
      <h2>Bid with platform credits</h2>
      <p>
        One platform credit supplies exactly 1 USDC of auction bidding value. Credits are an
        internal, non-transferable AdBidCoin balance—not cryptocurrency, USDC, or a cash account.
      </p>
      {!accessToken ? (
        <div className="credit-signin">
          <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button className="primary-button" onClick={sendMagicLink} disabled={busy || !email}>Email secure sign-in link</button>
        </div>
      ) : (
        <>
          <div className="credit-balance-row">
            <div><span>Signed in</span><strong>{signedInEmail}</strong></div>
            <div><span>Available</span><strong>{balance.toFixed(2)} credits</strong></div>
            <div><span>Reserved</span><strong>{reserved.toFixed(2)} credits</strong></div>
            {deficit > 0 && <div><span>Refund deficit</span><strong>{deficit.toFixed(2)} credits</strong></div>}
            <button className="ghost-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
          <div className="credit-actions-grid">
            <div>
              <h3>Purchase credits</h3>
              <label><span>Credits</span><input type="number" min="5" max="500" step="1" value={purchaseCredits} onChange={(event) => setPurchaseCredits(Number(event.target.value))} /></label>
              <div className="credit-quote">
                <span>Credit value <strong>{purchaseCredits.toFixed(2)} USD</strong></span>
                <span>Purchase fee <strong>{feeUsd.toFixed(2)} USD</strong></span>
                <span>Total charged <strong>{totalUsd.toFixed(2)} USD</strong></span>
                <span>Credits received <strong>{purchaseCredits.toFixed(2)}</strong></span>
              </div>
              <button className="primary-button" onClick={buyCredits} disabled={busy || !stripe.enabled}>Continue to Stripe Checkout</button>
              {!stripe.enabled && <p className="form-message info">{stripe.reason} Test or live purchases remain unavailable until configuration and approval are complete.</p>}
              {stripe.testMode && <p className="hint">Stripe test mode—no live charge will be made.</p>}
            </div>
            <div>
              <h3>Place a credit-funded bid</h3>
              {accountStatus === "frozen" && <p className="form-message info">Bidding is frozen because refunded credits had already been used. New purchases first clear the {deficit.toFixed(2)}-credit deficit.</p>}
              <label><span>Bid amount</span><input type="number" min={minimumBid} step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} /></label>
              <p className="hint">Credit-funded and wallet-funded bids compete at the same face value. Accepted bids are final and non-refundable.</p>
              <button className="primary-button" onClick={placeBid} disabled={busy || accountStatus !== "active" || balance < Number(bidAmount)}>{busy ? "Processing..." : "Bid with credits"}</button>
            </div>
          </div>
        </>
      )}
      {message && <p className="form-message info">{message}</p>}
    </section>
  );
}
