"use client";

import { useEffect, useState } from "react";
import WalletConnect, { getStoredWallet, subscribeToWallet } from "./WalletConnect";
import { sendUsdcPayment } from "./lib/solana-payment";

const PLANS = {
  starter: { name: "Auto 20", price: 200, placements: 20 },
  growth: { name: "Auto 50", price: 400, placements: 50 },
} as const;

export default function SponsorPackages() {
  const [planCode, setPlanCode] = useState<keyof typeof PLANS>("starter");
  const [wallet, setWallet] = useState("");
  const [form, setForm] = useState({ sponsorName: "", title: "", description: "", url: "", imageUrl: "", contact: "" });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const plan = PLANS[planCode];

  useEffect(() => {
    setWallet(getStoredWallet());
    return subscribeToWallet(setWallet);
  }, []);

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function purchase() {
    setMessage("");
    if (!wallet) return setMessage("Connect and authenticate Phantom first.");
    if (!accepted) return setMessage("Confirm the package terms before paying.");
    if (!form.sponsorName || !form.title || !form.description || !form.url) {
      return setMessage("Complete the required sponsor content fields.");
    }
    if (!window.confirm(`Send ${plan.price.toFixed(2)} USDC for the ${plan.name} package? Content is reviewed before publication.`)) return;
    setBusy(true);
    try {
      setMessage("Approve the USDC package payment in Phantom...");
      const paymentSignature = await sendUsdcPayment({ amountUsdc: plan.price, wallet });
      const response = await fetch("/api/sponsor-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, planCode, paymentSignature }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(`${result.message ?? "Payment could not be recorded."} Save receipt: ${paymentSignature}`);
      }
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not purchase sponsor package.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="sponsor-plan-grid">
        {Object.entries(PLANS).map(([code, item]) => (
          <button
            type="button"
            key={code}
            className={`sponsor-plan${planCode === code ? " selected" : ""}`}
            onClick={() => setPlanCode(code as keyof typeof PLANS)}
          >
            <span className="eyebrow">12-month auto-slot package</span>
            <strong>${item.price} USD</strong>
            <h2>{item.name}</h2>
            <p>Paid as {item.price} USDC. At least {item.placements} homepage house-slot features over the next year.</p>
          </button>
        ))}
      </section>

      <section className="sponsor-order-card">
        <div>
          <span className="eyebrow">Selected · {plan.name}</span>
          <h2>Submit your sponsored feature</h2>
          <p>
            Approved packages enter the automatic house-slot rotation when no user bid owns the next block.
            You may be featured more than the stated minimum when inventory allows. We also support suitable
            campaigns across owned and subsidiary channels, subject to editorial fit and platform rules.
          </p>
          <p className="fine-print">
            Placements, clicks, impressions, sales, and specific subsidiary channels are not guaranteed beyond
            the minimum homepage feature count. Content must pass review.
          </p>
          <WalletConnect />
        </div>
        <div className="sponsor-form">
          <label><span>Sponsor or company name *</span><input value={form.sponsorName} onChange={(e) => update("sponsorName", e.target.value)} /></label>
          <label><span>Feature headline *</span><input value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
          <label><span>Description *</span><textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
          <label><span>HTTPS destination *</span><input type="url" value={form.url} onChange={(e) => update("url", e.target.value)} /></label>
          <label><span>HTTPS image URL</span><input type="url" value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} /></label>
          <label><span>Contact email or Telegram</span><input value={form.contact} onChange={(e) => update("contact", e.target.value)} /></label>
          <label className="terms-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>I understand payment purchases placement inventory, content is reviewed, and performance is not guaranteed.</span></label>
          <button className="primary-button" type="button" disabled={busy || !wallet} onClick={purchase}>
            {busy ? "Processing..." : `Buy ${plan.name} · $${plan.price} (paid in USDC)`}
          </button>
          {message && <p className="form-message" role="status">{message}</p>}
        </div>
      </section>
    </>
  );
}
