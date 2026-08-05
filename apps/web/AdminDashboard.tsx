"use client";

import { useEffect, useState } from "react";
import AttentionImage from "./AttentionImage";

type AttentionContent = {
  auctionId: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  moderationStatus: "pending" | "approved" | "hidden" | "rejected";
  moderationNote: string;
  reviewedAt: string | null;
  reviewedBy: string;
  createdAt: string;
  updatedAt: string | null;
};

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [content, setContent] = useState<AttentionContent[]>([]);
  const [message, setMessage] = useState("");
  const [noteByAuction, setNoteByAuction] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    void loadContent();
  }, []);

  async function login() {
    setMessage("");

    if (token.length < 32) {
      setMessage("The admin token must contain at least 32 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Could not authenticate admin session.");
        return;
      }

      setToken("");
      setIsAuthenticated(true);
      await loadContent();
    } catch {
      setMessage("Could not contact the admin login service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setIsAuthenticated(false);
    setContent([]);
    setMessage("Admin session ended.");
  }

  async function loadContent() {
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/attention");
      const result = await res.json();

      if (!result.success) {
        if (res.status === 401) setIsAuthenticated(false);
        setMessage(result.message ?? "Could not load admin content.");
        return;
      }

      setIsAuthenticated(true);
      setContent(result.content ?? []);
    } finally {
      setIsLoading(false);
    }
  }

  async function moderate(
    auctionId: string,
    status: AttentionContent["moderationStatus"]
  ) {
    setMessage("");

    const res = await fetch("/api/admin/attention", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auctionId,
        status,
        note: noteByAuction[auctionId] ?? "",
      }),
    });
    const result = await res.json();

    setMessage(result.message ?? "");

    if (result.success) {
      loadContent();
    }
  }

  return (
    <main className="page-shell admin-shell">
      <nav className="top-nav">
        <a className="brand" href="/">
          <span>Attention</span> Bid
        </a>
        <div />
        <a className="ghost-button" href="/">
          View site
        </a>
      </nav>

      <section className="admin-header">
        <span className="eyebrow">Admin</span>
        <h1>Attention Review</h1>
        <p>
          Review winner-submitted homepage content and hide anything that should
          not be public.
        </p>
      </section>

      {isAuthenticated ? (
        <section className="admin-token-card">
          <p>Authenticated with a secure, temporary admin session.</p>
          <div className="admin-action-buttons">
            <button
              className="primary-button"
              onClick={() => loadContent()}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Refresh review queue"}
            </button>
            <button className="ghost-button" onClick={logout}>
              Log out
            </button>
          </div>
        </section>
      ) : (
        <section className="admin-token-card">
          <label>
            <span>Admin token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isLoading) void login();
              }}
              placeholder="Paste ADMIN_TOKEN from Vercel"
            />
            <small className="hint">
              Use the exact 32-character-or-longer ADMIN_TOKEN. After changing
              it in Vercel, redeploy before signing in.
            </small>
          </label>
          <button className="primary-button" onClick={login} disabled={isLoading}>
            {isLoading ? "Authenticating..." : "Start secure admin session"}
          </button>
        </section>
      )}

      {message && <p className="form-message">{message}</p>}

      <section className="admin-list">
        {content.length === 0 ? (
          <div className="admin-empty">
            <span className="eyebrow">Queue</span>
            <p>No attention blocks loaded yet.</p>
          </div>
        ) : (
          content.map((item) => (
            <article className="admin-review-card" key={item.auctionId}>
              <div className="admin-review-main">
                {item.imageUrl && (
                  <AttentionImage
                    className="admin-review-image"
                    src={item.imageUrl}
                    alt={`${item.title} preview`}
                  />
                )}
                <div>
                  <div className="admin-review-meta">
                    <span>{item.auctionId}</span>
                    <strong className={`status-pill ${item.moderationStatus}`}>
                      {item.moderationStatus}
                    </strong>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.description || "No description provided."}</p>
                  <p className="hint">Wallet: {shortWallet(item.wallet)}</p>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  )}
                </div>
              </div>

              <div className="admin-actions">
                <label>
                  <span>Moderation note</span>
                  <input
                    value={noteByAuction[item.auctionId] ?? item.moderationNote}
                    onChange={(event) =>
                      setNoteByAuction((current) => ({
                        ...current,
                        [item.auctionId]: event.target.value,
                      }))
                    }
                    placeholder="Optional note"
                  />
                </label>
                <div className="admin-action-buttons">
                  <button
                    className="ghost-button"
                    onClick={() => moderate(item.auctionId, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="ghost-button danger-button"
                    onClick={() => moderate(item.auctionId, "hidden")}
                  >
                    Hide
                  </button>
                  <button
                    className="ghost-button danger-button"
                    onClick={() => moderate(item.auctionId, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
