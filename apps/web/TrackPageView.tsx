"use client";

import { useEffect } from "react";

export default function TrackPageView({ auctionId }: { auctionId: string }) {
  useEffect(() => {
    void fetch("/api/metrics/view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ auctionId }),
    }).catch(() => undefined);
  }, [auctionId]);

  return null;
}
