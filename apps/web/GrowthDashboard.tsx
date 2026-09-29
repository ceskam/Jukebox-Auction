"use client";

import { useEffect, useMemo, useState } from "react";

type Opportunity = {
  id: number;
  source: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  policyRisk: "low" | "opt_in_only" | "manual_review" | "do_not_post";
  status: "new" | "approved" | "published" | "dismissed";
  draftText: string;
  discoveredAt: string;
};

type ReferralCode = {
  id: number;
  code: string;
  label: string;
  promoterWallet: string;
  rewardUsdc: number;
  status: string;
};

type Conversion = {
  id: number;
  referralCode: string;
  referredWallet: string;
  bidId: number;
  rewardUsdc: number;
  status: "pending" | "approved" | "paid" | "rejected";
  payoutSignature: string;
  convertedAt: string;
};

type GrowthData = {
  opportunities: Opportunity[];
  referralCodes: ReferralCode[];
  conversions: Conversion[];
  stats: {
    visits: number;
    pendingRewards: number;
    approvedRewardUsdc: number;
  };
};

const EMPTY_DATA: GrowthData = {
  opportunities: [],
  referralCodes: [],
  conversions: [],
  stats: { visits: 0, pendingRewards: 0, approvedRewardUsdc: 0 },
};

function shortWallet(wallet: string) {
  return wallet.length > 12 ? `${wallet.slice(0, 6)}...${wallet.slice(-6)}` : wallet || "Not set";
}

export default function GrowthDashboard({ active }: { active: boolean }) {
  const [data, setData] = useState<GrowthData>(EMPTY_DATA);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [payoutSignatures, setPayoutSignatures] = useState<Record<number, string>>({});
  const [referral, setReferral] = useState({
    label: "",
    code: "",
    promoterWallet: "",
    rewardUsdc: "1.00",
  });

  const liveOpportunities = useMemo(
    () => data.opportunities.filter((item) => item.status !== "dismissed"),
    [data.opportunities]
  );

  useEffect(() => {
    if (active) void load();
    else setData(EMPTY_DATA);
  }, [active]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/growth", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Could not load Growth Scout.");
        return;
      }
      setData({
        opportunities: result.opportunities ?? [],
        referralCodes: result.referralCodes ?? [],
        conversions: result.conversions ?? [],
        stats: result.stats ?? EMPTY_DATA.stats,
      });
      setDrafts(
        Object.fromEntries(
          (result.opportunities ?? []).map((item: Opportunity) => [item.id, item.draftText])
        )
      );
    } catch {
      setMessage("Could not contact Growth Scout.");
    } finally {
      setLoading(false);
    }
  }

  async function action(payload: Record<string, unknown>) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      setMessage(result.message ?? "");
      if (response.ok && result.success) await load();
      return Boolean(response.ok && result.success);
    } catch {
      setMessage("Growth action could not be completed.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function createReferral() {
    const success = await action({ action: "create_referral", ...referral });
    if (success) {
      setReferral({ label: "", code: "", promoterWallet: "", rewardUsdc: "1.00" });
    }
  }

  if (!active) return null;

  return (
    <section className="growth-admin" aria-labelledby="growth-scout-title">
      <div className="growth-admin-heading">
        <div>
          <span className="eyebrow">Review-first acquisition</span>
          <h2 id="growth-scout-title">Growth Scout</h2>
          <p>
            Find high-intent conversations, prepare tailored drafts, and track first-bid
            referrals. Nothing is posted or paid without approval.
          </p>
        </div>
        <div className="admin-action-buttons">
          <button
            className="primary-button"
            disabled={loading}
            onClick={() => action({ action: "run_scout" })}
          >
            {loading ? "Working..." : "Run scout now"}
          </button>
          <button className="ghost-button" disabled={loading} onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      {message && <p className="form-message">{message}</p>}

      <div className="growth-stat-grid">
        <div><span>Tracked visits</span><strong>{data.stats.visits}</strong></div>
        <div><span>Pending rewards</span><strong>{data.stats.pendingRewards}</strong></div>
        <div><span>Approved, unpaid</span><strong>{data.stats.approvedRewardUsdc.toFixed(2)} USDC</strong></div>
        <div><span>Live opportunities</span><strong>{liveOpportunities.length}</strong></div>
      </div>

      <div className="growth-section-heading">
        <div>
          <span className="eyebrow">Discovery queue</span>
          <h3>Relevant places to engage</h3>
        </div>
        <small>Always read the community rules before using a draft.</small>
      </div>

      <div className="growth-opportunity-list">
        {liveOpportunities.length === 0 ? (
          <div className="admin-empty">
            <p>No opportunities yet. Configure the search key, then run the scout.</p>
          </div>
        ) : (
          liveOpportunities.map((item) => (
            <article className="growth-opportunity" key={item.id}>
              <div className="growth-opportunity-meta">
                <strong>{item.source}</strong>
                <span>{item.relevanceScore}/100 relevance</span>
                <span className={`status-pill ${item.status}`}>{item.status}</span>
                <span className="status-pill pending">{item.policyRisk.replaceAll("_", " ")}</span>
              </div>
              <h4>{item.title}</h4>
              <p>{item.excerpt || "No search excerpt available."}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Review source and community rules
              </a>
              <label>
                <span>Prepared draft</span>
                <textarea
                  value={drafts[item.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                />
              </label>
              <div className="admin-action-buttons">
                <button
                  className="ghost-button"
                  onClick={() =>
                    action({
                      action: "update_opportunity",
                      id: item.id,
                      status: "approved",
                      draftText: drafts[item.id],
                    })
                  }
                >
                  Save approved draft
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    action({
                      action: "publish_telegram",
                      id: item.id,
                      draftText: drafts[item.id],
                    })
                  }
                >
                  Post to owned Telegram
                </button>
                <button
                  className="ghost-button danger-button"
                  onClick={() =>
                    action({
                      action: "update_opportunity",
                      id: item.id,
                      status: "dismissed",
                      draftText: drafts[item.id],
                    })
                  }
                >
                  Dismiss
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="growth-section-heading">
        <div>
          <span className="eyebrow">Crypto-native acquisition</span>
          <h3>Referral codes</h3>
        </div>
        <small>Rewards require a first verified user bid and manual approval.</small>
      </div>

      <div className="referral-create-grid">
        <label><span>Promoter label</span><input value={referral.label} onChange={(e) => setReferral({ ...referral, label: e.target.value })} placeholder="Solana community partner" /></label>
        <label><span>Custom code (optional)</span><input value={referral.code} onChange={(e) => setReferral({ ...referral, code: e.target.value })} placeholder="SOLANA-PARTNER" /></label>
        <label><span>Promoter payout wallet</span><input value={referral.promoterWallet} onChange={(e) => setReferral({ ...referral, promoterWallet: e.target.value })} placeholder="Solana address" /></label>
        <label><span>Reward per first bidder</span><input type="number" min="0" max="25" step="0.25" value={referral.rewardUsdc} onChange={(e) => setReferral({ ...referral, rewardUsdc: e.target.value })} /></label>
        <button className="primary-button" onClick={createReferral}>Create code</button>
      </div>

      <div className="referral-code-list">
        {data.referralCodes.map((item) => (
          <div className="referral-code-row" key={item.id}>
            <div><strong>{item.code}</strong><span>{item.label}</span></div>
            <code>{`https://adbidcoin.com/?ref=${item.code}`}</code>
            <span>{shortWallet(item.promoterWallet)}</span>
            <span>{item.rewardUsdc.toFixed(2)} USDC</span>
          </div>
        ))}
      </div>

      <div className="growth-section-heading">
        <div>
          <span className="eyebrow">Manual payout ledger</span>
          <h3>Qualified conversions</h3>
        </div>
        <small>Verify the promoter and referred wallet before paying.</small>
      </div>

      <div className="conversion-list">
        {data.conversions.length === 0 ? (
          <div className="admin-empty"><p>No first-bid conversions yet.</p></div>
        ) : data.conversions.map((item) => (
          <article className="conversion-row" key={item.id}>
            <div><strong>{item.referralCode}</strong><span>{shortWallet(item.referredWallet)}</span></div>
            <div><span>{item.rewardUsdc.toFixed(2)} USDC</span><span className={`status-pill ${item.status}`}>{item.status}</span></div>
            <input
              value={payoutSignatures[item.id] ?? item.payoutSignature}
              onChange={(event) => setPayoutSignatures((current) => ({ ...current, [item.id]: event.target.value }))}
              placeholder="Solana payout signature (required to mark paid)"
            />
            <div className="admin-action-buttons">
              <button className="ghost-button" onClick={() => action({ action: "update_reward", id: item.id, status: "approved" })}>Approve</button>
              <button className="ghost-button" onClick={() => action({ action: "update_reward", id: item.id, status: "paid", payoutSignature: payoutSignatures[item.id] ?? item.payoutSignature })}>Mark paid</button>
              <button className="ghost-button danger-button" onClick={() => action({ action: "update_reward", id: item.id, status: "rejected" })}>Reject</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
