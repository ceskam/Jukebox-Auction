"use client";

import { useEffect, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";

type Props = {
  auctionId: string;
  winner: string | null;
  initialTitle?: string;
  initialDescription?: string;
  initialUrl?: string;
  initialImageUrl?: string;
  initialModerationStatus?: "pending" | "approved" | "hidden" | "rejected";
  initialModerationNote?: string;
};

export default function AttentionEditor({
  auctionId,
  winner,
  initialTitle = "",
  initialDescription = "",
  initialUrl = "",
  initialImageUrl = "",
  initialModerationStatus,
  initialModerationNote = "",
}: Props) {
  const [wallet, setWallet] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [url, setUrl] = useState(initialUrl);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [message, setMessage] = useState("");
  const [moderationStatus, setModerationStatus] = useState(initialModerationStatus);
  const [moderationNote, setModerationNote] = useState(initialModerationNote);
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
          description, image, and link shown in the public attention space after
          admin approval.
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
          imageUrl,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        setMessage(result.message);
        return;
      }

      setModerationStatus(result.content?.moderationStatus ?? "pending");
      setModerationNote(result.content?.moderationNote ?? "");
      setMessage(result.message ?? "Attention block submitted for review.");
      window.setTimeout(() => window.location.reload(), 500);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="editor-card">
      <span className="eyebrow">Create attention block</span>
      <h2>You won this block</h2>
      <div className="review-status-panel">
        <strong>
          {moderationStatus
            ? `Status: ${moderationStatus}`
            : "Status: not submitted"}
        </strong>
        <p>
          {moderationStatus === "approved" &&
            "Approved content is live on the homepage."}
          {moderationStatus === "pending" &&
            "Your content is waiting for admin review before it goes live."}
          {moderationStatus === "hidden" &&
            "This content is hidden from the homepage."}
          {moderationStatus === "rejected" &&
            "This content was rejected. Edit and submit a new version for review."}
          {!moderationStatus &&
            "Submit your title, description, image, and link for review."}
        </p>
        {moderationNote && <p className="hint">Admin note: {moderationNote}</p>}
      </div>

      <label>
        <span>Title</span>
        <input
          placeholder="What should everyone see?"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <small>{title.length}/80</small>
      </label>

      <label>
        <span>Description</span>
        <textarea
          placeholder="Add the short message for the public homepage."
          maxLength={600}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <small>{description.length}/600</small>
      </label>

      <label>
        <span>Image URL</span>
        <input
          placeholder="https://example.com/image.png"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
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
        {isSaving ? "Submitting..." : "Submit for review"}
      </button>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
