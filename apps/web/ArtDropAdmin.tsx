"use client";

import { useEffect, useState } from "react";

type Drop = {
  id: string;
  publicId: string;
  claimCode: string;
  rewardUsdc: number;
  status: string;
  scheduledFor: string;
  expiresAt: string | null;
  claimWallet: string;
  payoutSignature: string;
  payoutError: string;
};

type Data = {
  enabled: boolean;
  paused: boolean;
  signerConfigured: boolean;
  treasuryWallet: string;
  treasuryUsdc: number;
  treasurySol: number;
  treasuryStatus: string;
  rewardUsdc: number;
  dailyLimitUsdc: number;
  drops: Drop[];
};

function short(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-6)}` : "—";
}

export default function ArtDropAdmin({ active }: { active: boolean }) {
  const [data, setData] = useState<Data>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (active) void load();
    else setData(undefined);
  }, [active]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/art-drops", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Could not load Art Drops.");
        return;
      }
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  async function action(body: Record<string, unknown>) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/art-drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMessage(result.message ?? "");
      if (result.success) await load();
    } catch {
      setMessage("Could not contact the Art Drop service.");
    } finally {
      setLoading(false);
    }
  }

  if (!active) return null;

  return (
    <section className="art-drop-admin" aria-labelledby="art-drop-admin-title">
      <div className="growth-admin-heading">
        <div>
          <span className="eyebrow">Operator-funded rewards</span>
          <h2 id="art-drop-admin-title">Art Drops</h2>
          <p>
            Randomized, capped USDC drops with atomic first-claim reservation,
            wallet authentication, and public payout receipts.
          </p>
        </div>
        <div className="admin-action-buttons">
          <button className="ghost-button" onClick={load} disabled={loading}>
            Refresh
          </button>
          {data && (
            <button
              className="ghost-button"
              onClick={() => action({ action: "set_paused", paused: !data.paused })}
              disabled={loading}
            >
              {data.paused ? "Resume drops" : "Pause drops"}
            </button>
          )}
          <button
            className="primary-button"
            onClick={() => action({ action: "create_now" })}
            disabled={loading || !data?.enabled || data?.paused}
          >
            Publish drop now
          </button>
        </div>
      </div>

      {message && <p className="form-message">{message}</p>}
      {data && (
        <>
          <div className="growth-stat-grid">
            <div>
              <span>Automation</span>
              <strong>{data.enabled ? (data.paused ? "Paused" : "Live") : "Disabled"}</strong>
            </div>
            <div>
              <span>Signer</span>
              <strong>{data.signerConfigured ? "Ready" : "Missing"}</strong>
            </div>
            <div>
              <span>Reward</span>
              <strong>{data.rewardUsdc.toFixed(2)} USDC</strong>
            </div>
            <div>
              <span>24-hour cap</span>
              <strong>{data.dailyLimitUsdc.toFixed(2)} USDC</strong>
            </div>
          </div>
          <div className="art-drop-treasury">
            <div>
              <span>Fund this reward treasury address</span>
              <code>{data.treasuryWallet || "Signer not configured"}</code>
              <small>
                {data.treasuryUsdc.toFixed(2)} USDC · {data.treasurySol.toFixed(4)} SOL ·{" "}
                {data.treasuryStatus}
              </small>
            </div>
            {data.treasuryWallet && (
              <button
                className="ghost-button"
                onClick={() => {
                  void navigator.clipboard.writeText(data.treasuryWallet);
                  setMessage("Reward treasury address copied.");
                }}
              >
                Copy address
              </button>
            )}
          </div>

          <div className="art-drop-admin-list">
            {data.drops.length === 0 ? (
              <div className="admin-empty"><p>No Art Drops created yet.</p></div>
            ) : (
              data.drops.map((drop) => (
                <article className="art-drop-admin-row" key={drop.id}>
                  <div>
                    <strong>{drop.claimCode}</strong>
                    <span className={`status-pill ${drop.status}`}>{drop.status}</span>
                  </div>
                  <span>{drop.rewardUsdc.toFixed(2)} USDC</span>
                  <span>Scheduled {new Date(drop.scheduledFor).toLocaleString()}</span>
                  <span>Wallet {short(drop.claimWallet)}</span>
                  {drop.payoutSignature && (
                    <a
                      href={`https://solscan.io/tx/${encodeURIComponent(drop.payoutSignature)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Receipt
                    </a>
                  )}
                  {drop.payoutError && <small className="form-message error">{drop.payoutError}</small>}
                  {["scheduled", "active"].includes(drop.status) && (
                    <button
                      className="ghost-button danger-button"
                      onClick={() => action({ action: "cancel", id: drop.id })}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  )}
                  {drop.status === "payout_review" && drop.payoutSignature && (
                    <button
                      className="ghost-button"
                      onClick={() => action({ action: "reconcile", id: drop.id })}
                      disabled={loading}
                    >
                      Verify on-chain
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
