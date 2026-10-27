"use client";

type Props = {
  auctionId: string;
  url: string;
  label?: string;
  sponsored?: boolean;
};

export default function TrackedAttentionLink({
  auctionId,
  url,
  label = "Visit link",
  sponsored = false,
}: Props) {
  function recordClick() {
    const body = JSON.stringify({ auctionId, url });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/metrics/click",
        new Blob([body], { type: "application/json" })
      );
      return;
    }

    void fetch("/api/metrics/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  return (
    <a
      className="primary-link"
      href={url}
      target="_blank"
      rel={sponsored ? "sponsored noreferrer" : "noreferrer"}
      onClick={recordClick}
    >
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}
