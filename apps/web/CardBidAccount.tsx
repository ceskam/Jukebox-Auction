"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "./lib/supabase/client";

type Props = { auctionId: string; minimumBid: number };
type Authorization = {
  id: string;
  auctionId: string;
  bidValueUsdc: number;
  feeUsd: number;
  status: string;
};

export default function CardBidAccount({ auctionId, minimumBid }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [bidAmount, setBidAmount] = useState(String(minimumBid));
  const [feePercent, setFeePercent] = useState(0);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [stripe, setStripe] = useState<any>({ enabled: false, reason: "Card bidding is loading." });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? "");
      setSignedInEmail(data.session?.user.email ?? "");
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
    const response = await fetch("/api/card-bids", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Could not load card bids.");
    setFeePercent(result.feePercent);
    setStripe(result.stripe);
    setAuthorizations(result.authorizations ?? []);
  }

  useEffect(() => {
    if (accessToken) void refresh(accessToken).catch((error) => setMessage(error.message));
  }, [accessToken]);

  async function sendMagicLink() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/#card-bidding` },
    });
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    setBusy(false);
  }

  async function authorizeBid() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/card-bids/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ auctionId, amount: Number(bidAmount) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not start card authorization.");
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start card authorization.");
      setBusy(false);
    }
  }

  const amount = Number(bidAmount) || 0;
  const feeUsd = Math.round(amount * feePercent) / 100;
  const totalUsd = Math.round((amount + feeUsd) * 100) / 100;

  return (
    <section className="credit-card" id="card-bidding">
      <span className="eyebrow">No Phantom required</span>
      <h2>Authorize a card bid</h2>
      <p>
        Your maximum bid is placed as a temporary card hold. AdBidCoin captures the
        winner only after the 30-minute auction closes and releases every losing hold.
        Card bids and wallet bids compete at the same face value: 1 USD = 1 USDC of bid value.
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
            <div><span>Auction</span><strong>{auctionId}</strong></div>
            <button className="ghost-button" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
          <div className="credit-actions-grid">
            <div>
              <h3>Maximum bid</h3>
              <label><span>Bid value</span><input type="number" min={minimumBid} max="2000" step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} /></label>
              <div className="credit-quote">
                <span>Auction bid value <strong>{amount.toFixed(2)} USDC</strong></span>
                <span>Platform/card fee <strong>{feeUsd.toFixed(2)} USD</strong></span>
                <span>Maximum authorization <strong>{totalUsd.toFixed(2)} USD</strong></span>
                <span>If you lose <strong>Hold released</strong></span>
              </div>
              <button className="primary-button" onClick={authorizeBid} disabled={busy || !stripe.enabled || amount < minimumBid}>{busy ? "Starting authorization..." : "Authorize maximum bid"}</button>
              {!stripe.enabled && <p className="form-message info">{stripe.reason} Live use remains off until Stripe confirms support in writing.</p>}
              {stripe.testMode && <p className="hint">Stripe test mode—no live charge will be made.</p>}
            </div>
            <div>
              <h3>Recent card bids</h3>
              {authorizations.length === 0 ? <p className="hint">No card bids yet.</p> : (
                <ol className="bid-list">
                  {authorizations.map((item) => <li key={item.id}><span>{item.bidValueUsdc.toFixed(2)} USDC · {item.auctionId}</span><strong>{item.status.replaceAll("_", " ")}</strong></li>)}
                </ol>
              )}
              <p className="fine-print">Your bank may take time to remove a released hold. AdBidCoin does not provide a withdrawable stored balance.</p>
            </div>
          </div>
        </>
      )}
      {message && <p className="form-message info">{message}</p>}
    </section>
  );
}
