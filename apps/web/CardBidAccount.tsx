"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "./lib/supabase/client";
import { MIN_CARD_BID_USD } from "./lib/bid-rules";

type Props = { auctionId: string; minimumBid: number };
type Authorization = {
  id: string;
  auctionId: string;
  bidValueUsdc: number;
  feeUsd: number;
  status: string;
};

export default function CardBidAccount({ auctionId, minimumBid }: Props) {
  const cardMinimumBid = Math.max(MIN_CARD_BID_USD, minimumBid);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [bidAmount, setBidAmount] = useState(String(cardMinimumBid));
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

  useEffect(() => setBidAmount(String(cardMinimumBid)), [cardMinimumBid]);

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
      // Supabase returns the session in the URL hash. Do not include our own
      // hash here or the browser will receive two fragments and the client
      // will be unable to consume the session.
      options: { emailRedirectTo: window.location.origin },
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
  const quickBids = [5, 10, 25, 50].filter((value) => value >= cardMinimumBid);

  return (
    <section className="credit-card" id="card-bidding">
      <div className="card-bid-heading">
        <div>
          <span className="eyebrow">Fastest way to bid · No Phantom required</span>
          <h2>Bid securely with your card</h2>
          <p>
            Place a temporary card authorization through Stripe. When bidding closes,
            only the winner is charged and every losing hold is released.
          </p>
        </div>
        <div className="stripe-checkout-badge" aria-label="Secure card checkout powered by Stripe">
          <span>Secure checkout</span>
          <strong>Powered by Stripe</strong>
        </div>
      </div>
      <div className="card-bid-steps" aria-label="How card bidding works">
        <div><strong>1</strong><span>Sign in by email</span></div>
        <div><strong>2</strong><span>Authorize your maximum bid</span></div>
        <div><strong>3</strong><span>Only the winner pays</span></div>
      </div>
      <p className="card-bid-rate">
        Card and wallet bids compete at the same face value: <strong>1 USD = 1 USDC</strong>
        {" "}of bid value. Minimum card bid: <strong>${MIN_CARD_BID_USD.toFixed(2)}</strong>.
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
              {quickBids.length > 0 && (
                <div className="card-quick-bids" aria-label="Quick card bid amounts">
                  {quickBids.map((value) => (
                    <button
                      type="button"
                      className={amount === value ? "selected" : ""}
                      key={value}
                      onClick={() => setBidAmount(String(value))}
                    >
                      ${value}
                    </button>
                  ))}
                </div>
              )}
              <label><span>Bid value</span><input type="number" min={cardMinimumBid} max="2000" step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} /></label>
              <div className="credit-quote">
                <span>Auction bid value <strong>{amount.toFixed(2)} USDC</strong></span>
                <span>Platform/card fee <strong>{feeUsd.toFixed(2)} USD</strong></span>
                <span>Maximum authorization <strong>{totalUsd.toFixed(2)} USD</strong></span>
                <span>If you lose <strong>Hold released</strong></span>
              </div>
              <button className="primary-button card-authorize-button" onClick={authorizeBid} disabled={busy || !stripe.enabled || amount < cardMinimumBid}>{busy ? "Opening Stripe..." : `Continue to Stripe · $${totalUsd.toFixed(2)} max`}</button>
              {!stripe.enabled && <p className="form-message info">{stripe.reason} Card bidding is currently unavailable.</p>}
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
