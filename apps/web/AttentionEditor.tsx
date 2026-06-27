"use client";

import { useEffect, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";

type Props = {
  auctionId: string;
  winner: string | null;
  initialTitle?: string;
  initialDescription?: string;
  initialUrl?: string;
};

export default function AttentionEditor({
  auctionId,
  winner,
  initialTitle = "",
  initialDescription = "",
  initialUrl = "",
}: Props) {
  const [wallet, setWallet] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [url, setUrl] = useState(initialUrl);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setWallet(getStoredWallet());
    return subscribeToWallet(setWallet);
  }, []);

  const isWinner = Boolean(winner && wallet === winner);

  if (!isWinner) {
    return (
      <section className="editor-card muted-card">
        <span className="eyebrow">Create attention block</span>
        <h2>Winner controls the live homepage</h2>
        <p>
          The winning wallet for the current block can add the headline,
          description, and link shown in the public attention space.
        </p>
        {winner ? (
          <p className="hint">Winning wallet: {winner.slice(0, 4)}...{winner.slice(-4)}</p>
        ) : (
          <p className="hint">No winner has been recorded for this block yet.</p>
        )}
      </section>
    );
  }

  async function saveAttention() {
    setIsSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/attention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auctionId,
          wallet,
          title,
          description,
          url,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setMessage(result.message);
        return;
      }

      setMessage("Attention block saved. Refreshing...");
      window.setTimeout(() => window.location.reload(), 500);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="editor-card">
      <span className="eyebrow">Create attention block</span>
      <h2>You won this block</h2>

      <label>
        <span>Title</span>
        <input
          placeholder="What should everyone see?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label>
        <span>Description</span>
        <textarea
          placeholder="Add the short message for the public homepage."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label>
        <span>Link</span>
        <input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <button className="primary-button" onClick={saveAttention} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save attention block"}
      </button>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
