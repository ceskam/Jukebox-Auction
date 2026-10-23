"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

// Keep the install token in deployment configuration, not in the repository.
export default function MintfunnelTracking() {
  const pathname = usePathname();
  const token = process.env.NEXT_PUBLIC_MINTFUNNEL_TOKEN;

  // Only the advertised auction page participates in this initial experiment.
  if (pathname !== "/" || !token || !/^[a-f0-9]{64}$/i.test(token)) return null;

  return (
    <Script
      id="mintfunnel-tracking"
      src="https://mintfunnel-cdn.com/sdk/v2/latest.js"
      strategy="afterInteractive"
      data-token={token}
      data-api="https://app.mintfunnel.co"
    />
  );
}
