"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export default function BitmediaTracking() {
  const pathname = usePathname();
  const conversionId = process.env.NEXT_PUBLIC_BITMEDIA_CONVERSION_ID;
  if (pathname !== "/" || !conversionId || !/^[a-f0-9]{24}$/i.test(conversionId)) {
    return null;
  }

  return (
    <Script
      id="bitmedia-tracking"
      src="https://static.bitmediacdn.com/bmEventManager.js"
      strategy="afterInteractive"
    />
  );
}
