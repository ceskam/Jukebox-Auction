"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    function refreshVisiblePage() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    const interval = setInterval(() => {
      refreshVisiblePage();
    }, intervalMs);

    window.addEventListener("focus", refreshVisiblePage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshVisiblePage);
    };
  }, [intervalMs, router]);

  return null;
}
