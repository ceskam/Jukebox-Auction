"use client";

import { useEffect, useState } from "react";
import { getStoredWallet, subscribeToWallet } from "./WalletConnect";
import { createSupabaseBrowserClient } from "./lib/supabase/client";

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
  const [creditIdentity, setCreditIdentity] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [url, setUrl] = useState(initialUrl);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [moderationStatus, setModerationStatus] = useState(initialModerationStatus);
  const [moderationNote, setModerationNote] = useState(initialModerationNote);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setWallet(getStoredWallet());
    return subscribeToWallet(setWallet);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id ?? "";
      setCreditIdentity(userId ? `credit:${userId}` : "");
      setAccessToken(data.session?.access_token ?? "");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCreditIdentity(session?.user.id ? `credit:${session.user.id}` : "");
      setAccessToken(session?.access_token ?? "");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accessToken || !winner?.startsWith("credit:") || creditIdentity !== winner) return;
    void fetch(`/api/attention?auctionId=${encodeURIComponent(auctionId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((content) => {
        if (!content || content.wallet !== winner) return;
        setTitle(content.title ?? "");
        setDescription(content.description ?? "");
        setUrl(content.url ?? "");
        setImageUrl(content.imageUrl ?? "");
        setModerationStatus(content.moderationStatus);
        setModerationNote(content.moderationNote ?? "");
      })
      .catch(() => undefined);
  }, [accessToken, auctionId, creditIdentity, winner]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const ownerIdentity = wallet === winner
    ? wallet
    : creditIdentity === winner
      ? creditIdentity
      : "";
  const isWinner = Boolean(winner && ownerIdentity);

  if (!isWinner) {
    return (
      <section className="editor-card muted-card">
        <span className="eyebrow">Create attention block</span>
        <h2>Winner controls the live homepage</h2>
        <p>
          The winning wallet or signed-in credit account for the current block can add the headline,
          description, image, and link shown in the public attention space.
        </p>
        {winner ? (
          <p className="hint">
            Winning bidder: {winner.startsWith("credit:")
              ? "signed-in credit account"
              : `${winner.slice(0, 4)}...${winner.slice(-4)}`}
          </p>
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
      const body = new FormData();
      body.append("auctionId", auctionId);
      body.append("wallet", ownerIdentity);
      body.append("title", title);
      body.append("description", description);
      body.append("url", url);
      body.append("imageUrl", imageUrl);

      if (imageFile) {
        body.append("image", imageFile);
      }

      const res = await fetch("/api/attention", {
        method: "POST",
        headers:
          accessToken && ownerIdentity.startsWith("credit:")
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        body,
      });

      const result = await res.json();

      if (!result.success) {
        setMessage(result.message);
        return;
      }

      setModerationStatus(result.content?.moderationStatus ?? "approved");
      setModerationNote(result.content?.moderationNote ?? "");
      setImageFile(null);
      setMessage(result.message ?? "Attention block published automatically.");
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
            "This content was rejected. Edit and submit a new version."}
          {!moderationStatus &&
            "Submit your title, description, image, and link to publish automatically. " +
              "An admin can hide or reject it afterward."}
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
        <span>Upload image</span>
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          type="file"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
        <small>JPG, PNG, WebP, or GIF. Max 5 MB.</small>
      </label>

      {(imagePreviewUrl || imageUrl) && (
        <div className="upload-preview">
          <img
            alt="Attention block preview"
            src={imagePreviewUrl || imageUrl}
          />
        </div>
      )}

      <label>
        <span>Image URL fallback</span>
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
        {isSaving ? "Submitting..." : "Submit attention block"}
      </button>

      {message && <p className="form-message">{message}</p>}
    </section>
  );
}
