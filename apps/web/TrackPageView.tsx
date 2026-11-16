"use client";

import { useEffect } from "react";

export default function TrackPageView({
  auctionId,
  featuredContentAuctionId,
}: {
  auctionId: string;
  featuredContentAuctionId: string;
}) {
  useEffect(() => {
    void (async () => {
      // Establish the first-party engagement session before the view event so
      // unique-viewer reporting can use a stable, privacy-preserving hash.
      await fetch("/api/engagement", { method: "POST" }).catch(() => undefined);
      await fetch("/api/metrics/view", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ auctionId, featuredContentAuctionId }),
      }).catch(() => undefined);
    })();
  }, [auctionId, featuredContentAuctionId]);

  return null;
}
