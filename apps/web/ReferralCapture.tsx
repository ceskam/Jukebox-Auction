"use client";

import { useEffect, useState } from "react";

export default function ReferralCapture({ code }: { code: string }) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!code) return;

    void fetch("/api/referrals/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        landingPath: `${window.location.pathname}${window.location.search}`,
      }),
    })
      .then((response) => {
        setIsActive(response.ok);
      })
      .catch(() => setIsActive(false));
  }, [code]);

  if (!isActive) return null;

  return (
    <aside className="referral-disclosure" role="status">
      Referral link active. If you become a first-time verified bidder, the
      referring promoter may receive a manually reviewed USDC reward.
    </aside>
  );
}
