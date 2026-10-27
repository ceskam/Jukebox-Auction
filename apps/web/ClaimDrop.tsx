"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import WalletConnect, { getStoredWallet, subscribeToWallet } from "./WalletConnect";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          theme: "dark";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export default function ClaimDrop({
  initialCode,
  siteKey,
}: {
  initialCode: string;
  siteKey: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [wallet, setWallet] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [widgetReady, setWidgetReady] = useState(false);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [eligibility, setEligibility] = useState({ eligible: false, visitComplete: false, sponsorClickComplete: false, secondsRemaining: 300 });
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef("");

  useEffect(() => {
    setWallet(getStoredWallet());
    return subscribeToWallet(setWallet);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const response = await fetch("/api/engagement", { cache: "no-store" }).catch(() => undefined);
      if (!response?.ok) return;
      const result = await response.json();
      if (active) setEligibility(result);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!widgetReady || !siteKey || !turnstileContainer.current || widgetId.current) return;
    if (!window.turnstile) return;
    widgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: siteKey,
      theme: "dark",
      callback: setTurnstileToken,
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => {
        setTurnstileToken("");
        setMessage("Human verification could not load. Refresh and try again.");
      },
    });
  }, [siteKey, widgetReady]);

  async function claim() {
    setMessage("");
    setSignature("");
    if (!wallet) {
      setMessage("Connect and authenticate Phantom first.");
      return;
    }
    if (!turnstileToken) {
      setMessage("Complete the human verification before claiming.");
      return;
    }
    if (!eligibility.eligible) {
      setMessage("Complete both engagement requirements before claiming.");
      return;
    }

    setIsClaiming(true);
    try {
      const response = await fetch("/api/art-drops/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, turnstileToken }),
      });
      const result = await response.json();
      setMessage(result.message ?? "");
      if (result.success && result.signature) setSignature(result.signature);
      if (!result.success) {
        setTurnstileToken("");
        window.turnstile?.reset(widgetId.current);
      }
    } catch {
      setMessage("Could not reach the claim service. Try again.");
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <div className="claim-drop-grid">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setWidgetReady(true)}
        />
      )}

      <section className="claim-drop-card">
        <span className="eyebrow">First valid claim wins</span>
        <h1>Claim an Art Drop</h1>
        <p>
          Read the one-time code from the active branded graphic, authenticate your
          wallet, pass the human check, and submit. The database reserves the reward
          atomically for the first valid claimant.
        </p>

        <label>
          <span>One-time Art Drop code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="AD-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <div className="claim-wallet-row">
          <WalletConnect />
          {wallet && <span className="status-pill approved">Wallet authenticated</span>}
        </div>

        <div className="claim-requirements" aria-label="Claim requirements">
          <div className={eligibility.visitComplete ? "complete" : "pending"}>
            <strong>{eligibility.visitComplete ? "✓" : "1"}</strong>
            <span>{eligibility.visitComplete ? "Five active minutes complete" : `Stay active for ${Math.max(1, Math.ceil(eligibility.secondsRemaining / 60))} more minute(s)`}</span>
          </div>
          <div className={eligibility.sponsorClickComplete ? "complete" : "pending"}>
            <strong>{eligibility.sponsorClickComplete ? "✓" : "2"}</strong>
            <span>{eligibility.sponsorClickComplete ? "Latest sponsored post visited" : "Visit the latest sponsored post on the homepage"}</span>
          </div>
          {!eligibility.sponsorClickComplete && <a href="/#sponsored">Open latest sponsored post</a>}
        </div>

        {siteKey ? (
          <div ref={turnstileContainer} className="turnstile-container" />
        ) : (
          <p className="form-message error">
            Claims are not open until human verification is configured.
          </p>
        )}

        <button
          className="primary-button claim-submit"
          onClick={claim}
          disabled={isClaiming || !siteKey || !eligibility.eligible}
        >
          {isClaiming ? "Reserving and sending..." : "Claim USDC reward"}
        </button>

        {message && (
          <p className={`form-message ${signature ? "success" : "error"}`}>{message}</p>
        )}
        {signature && (
          <a
            className="primary-link"
            href={`https://solscan.io/tx/${encodeURIComponent(signature)}`}
            target="_blank"
            rel="noreferrer"
          >
            View payout receipt
          </a>
        )}
      </section>

      <aside className="claim-safety-card">
        <span className="eyebrow">Stay safe</span>
        <h2>We never publish private keys.</h2>
        <ul>
          <li>Connecting and signing the login message is free.</li>
          <li>The claim does not ask you to approve a transaction.</li>
          <li>Never enter a seed phrase, recovery phrase, or private key.</li>
          <li>Only use the official adbidcoin.com claim page.</li>
          <li>Expired, cancelled, or previously claimed codes cannot pay twice.</li>
        </ul>
        <a href="/#art-drops">Return to active Art Drops</a>
      </aside>
    </div>
  );
}
