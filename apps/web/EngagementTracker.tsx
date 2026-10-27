"use client";

import { useEffect } from "react";

export default function EngagementTracker() {
  useEffect(() => {
    const heartbeat = () => {
      if (document.visibilityState === "visible") {
        void fetch("/api/engagement", { method: "POST", keepalive: true }).catch(() => undefined);
      }
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, []);
  return null;
}
