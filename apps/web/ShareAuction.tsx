"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_SITE_URL = "https://attention-bid2-ten.vercel.app";
const SHARE_TEXT =
  "Attention is valuable. Bid USDC on Solana for the next 15 minutes of homepage attention.";

export default function ShareAuction({ auctionId }: { auctionId: string }) {
  const [shareUrl, setShareUrl] = useState(DEFAULT_SITE_URL);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setShareUrl(`${window.location.origin}/`);
  }, []);

  const xShareUrl = useMemo(() => {
    const params = new URLSearchParams({
      text: SHARE_TEXT,
      url: shareUrl,
      via: "attentionbid",
      hashtags: "AttentionBid,Solana,USDC",
    });
    return `https://x.com/intent/tweet?${params.toString()}`;
  }, [shareUrl]);

  const telegramShareUrl = useMemo(() => {
    const params = new URLSearchParams({
      url: shareUrl,
      text: `${SHARE_TEXT} Live auction: ${auctionId}`,
    });
    return `https://t.me/share/url?${params.toString()}`;
  }, [auctionId, shareUrl]);

  async function shareSite() {
    setMessage("");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Attention Bid",
          text: SHARE_TEXT,
          url: shareUrl,
        });
        setMessage("Shared successfully.");
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setMessage("Live auction link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Could not open sharing. Copy the URL from your browser instead.");
    }
  }

  return (
    <section className="share-card" id="share">
      <div>
        <span className="eyebrow">Bring someone into the next block</span>
        <h2>Share the live auction.</h2>
        <p>
          Invite builders, creators, communities, and curious bidders to watch
          the next 15-minute auction unfold.
        </p>
      </div>
      <div className="share-actions">
        <button className="primary-button" type="button" onClick={shareSite}>
          Share Attention Bid
        </button>
        <a
          className="share-link"
          href={xShareUrl}
          target="_blank"
          rel="noreferrer"
        >
          Post on X <span aria-hidden="true">↗</span>
        </a>
        <a
          className="share-link"
          href={telegramShareUrl}
          target="_blank"
          rel="noreferrer"
        >
          Share on Telegram <span aria-hidden="true">↗</span>
        </a>
      </div>
      {message && (
        <p className="share-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
